/*
  Route: /chat
  Access: Protected (login required)
  Allowed roles: buyer, buying_house, factory, owner, admin, agent

  Public Pages:
    /, /pricing, /about, /terms, /privacy, /help, /login, /signup, /access-denied
  Protected Pages (login required):
    /feed, /search, /buyer/:id, /factory/:id, /buying-house/:id, /contracts,
    /notifications, /chat, /call, /verification, /verification-center

  Primary responsibilities:
    - Provide real-time-ish messaging UI: conversations list + message thread.
    - Enforce buying-house "conversation lock" rules (ownership/permissions) per backend.
    - Support sending attachments/media and viewing shared docs (contract-adjacent UX).

  Key API endpoints (high level):
    - GET /api/chat/rooms, GET /api/chat/rooms/:id/messages
    - POST /api/chat/rooms, POST /api/chat/messages
    - Any lock/permission endpoints (depending on server implementation)

  Notes:
    - AppLayout hides NavBar/Footer for /chat (immersive route).
    - This file is large; comments focus on major blocks (state/effects/render sections).
    - HyperCache cacheMode: chat (default) — message threads are user-scoped and
      mutation-heavy; no shared-entity caching registry entry. No behavior change.
*/

import { Bell, CircleHelp, Download, FolderOpen, Home, MessageCircle, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import AttachmentPreviewModal from "../components/chat/AttachmentPreviewModal.jsx";
import FileAttachmentCard from "../components/chat/FileAttachmentCard.jsx";
import MarkdownMessage from "../components/chat/MarkdownMessage.jsx";
import { SignedImage, SignedVideo } from "../components/chat/SignedMedia.jsx";
import NeonAtom from "../components/ui/NeonAtom.jsx";
import { useSecureUser } from "../hooks/useSecureUser.js";
import { apiRequest, getCurrentUser, getToken } from "../lib/auth.js";
import { trackClientEvent } from "../lib/events.js";
import { consumeLeadSource } from "../lib/leadSource.js";
import { uploadFile } from "../lib/upload.js";

const WS_BASE = (() => {
	if (import.meta.env.VITE_WS_URL) {
		return import.meta.env.VITE_WS_URL;
	}
	const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
	return `${protocol}//${window.location.host}/ws`;
})();

import LazyImage from "../components/ui/LazyImage.jsx";
import { isRouteValid } from "../lib/routeHealthCheck.js";
import { ROUTES } from "../lib/routes.js";
import MessageArea from "./chat/MessageArea.jsx";

const CHAT_NAV_ITEMS = [
	{ to: ROUTES.FEED, label: "Feed", icon: Home },
	{ to: ROUTES.SEARCH, label: "Search", icon: Search },
	{ to: ROUTES.NOTIFICATIONS, label: "Alerts", icon: Bell },
	{ to: ROUTES.CHAT, label: "Chat", icon: MessageCircle },
	{ to: ROUTES.CONTRACTS, label: "Vault", icon: FolderOpen },
	{ to: ROUTES.HELP, label: "Help", icon: CircleHelp },
].filter((item) => isRouteValid(item.to));

import ChatSidebar from "./chat/ChatSidebar.jsx";
import {
	avatarUrl,
	dateDividerLabel,
	extractFirstUrl,
	extractLatestNote,
	formatDisplayName,
	friendCounterpartyId,
	getInitials,
	isImageMessage,
	isVideoMessage,
	linkPreviewMeta,
	normalizeThreads,
	sortByOldest,
	splitSuggestedReply,
	toAbsoluteAssetUrl,
} from "./chat/chatUtils.js";
import GrantTransferModal from "./chat/GrantTransferModal.jsx";
import RightPanel from "./chat/RightPanel.jsx";
import ThreadList from "./chat/ThreadList.jsx";

export default function ChatInterface() {
	const [themeMode, setThemeMode] = useState(() => {
		try {
			return localStorage.getItem("chat-theme-mode") || "dark";
		} catch {
			return "dark";
		}
	});
	const [priorityInbox, setPriorityInbox] = useState([]);
	// ... rest of state ...
	const [messageRequests, setMessageRequests] = useState([]);
	const [activeThreadId, setActiveThreadId] = useState(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [query, setQuery] = useState("");
	const [scheduleStatus, setScheduleStatus] = useState("");
	const [callHistoryByThread, setCallHistoryByThread] = useState({});
	const [messagesByThread, setMessagesByThread] = useState({});
	const [draftMessage, setDraftMessage] = useState("");
	const [showGrantModal, setShowGrantModal] = useState(false);
	const [grantUserId, setGrantUserId] = useState("");
	const [grantMode, setGrantMode] = useState(""); // "grant" | "transfer"
	const [pageLoading, setPageLoading] = useState(true);
	const [uploading, setUploading] = useState(false);
	const [uploadStatus, setUploadStatus] = useState("");
	const [uploadProgress, setUploadProgress] = useState(0);
	const [policyFeedback, setPolicyFeedback] = useState({
		reason: "",
		retryAfter: 0,
	});
	const [callPromptThread, setCallPromptThread] = useState(null);
	const [previewAttachment, setPreviewAttachment] = useState(null);
	const [accordionState, setAccordionState] = useState({
		sharedDocument: true,
		sharedMedia: true,
		sharedPost: true,
	});
	const [presenceMap, setPresenceMap] = useState({});
	const navigate = useNavigate();
	const location = useLocation();
	const [notice, setNotice] = useState(() => location.state?.notice ?? null);
	const [aiSuggesting, setAiSuggesting] = useState(false);
	const [aiError, setAiError] = useState("");
	const [aiSummary, setAiSummary] = useState(null);
	const [aiSummaryLoading, setAiSummaryLoading] = useState(false);
	const [aiSummaryError, setAiSummaryError] = useState("");
	const [aiNegotiation, setAiNegotiation] = useState(null);
	const [aiNegotiationLoading, setAiNegotiationLoading] = useState(false);
	const [aiNegotiationError, setAiNegotiationError] = useState("");
	const [leadSummary, setLeadSummary] = useState(null);
	const [leadLoading, setLeadLoading] = useState(false);
	const [prequalOverride, setPrequalOverride] = useState(false);
	const [countdownSeconds, setCountdownSeconds] = useState(0);

	const wsRef = useRef(null);
	const fileInputRef = useRef(null);
	const reconnectTimerRef = useRef(null);
	const reconnectAttemptsRef = useRef(0);
	const activeThreadMatchIdRef = useRef("");
	const pendingMatchIdRef = useRef("");
	const [currentUser, setCurrentUser] = useState(() => getCurrentUser());
	const { user: secureUser, loading: secureLoading } = useSecureUser();
	const isLight = themeMode === "light";
	const userRole = secureUser?.role || String(currentUser?.role || "").toLowerCase();
	const isBuyerUser = userRole === "buyer";
	const isAdminUser = ["owner", "admin"].includes(userRole);

	const presenceStatus = useCallback(
		(userId) => presenceMap?.[userId]?.status || "offline",
		[presenceMap],
	);
	const presenceLastSeen = useCallback(
		(userId) => presenceMap?.[userId]?.last_seen || null,
		[presenceMap],
	);

	const theme = useMemo(
		() => ({
			pageBg: isLight ? "#f8fafc" : "rgb(4, 0, 23)",
			panelBg: isLight ? "#ffffff" : "rgb(16, 13, 34)",
			rightPanelBg: isLight ? "#ffffff" : "#100D22",
			subPanelBg: isLight ? "#fcfdfe" : "#100D22",
			tileBg: isLight ? "#f1f5f9" : "#171031",
			threadIdleBg: isLight ? "transparent" : "#101328",
			threadActiveBg: isLight ? "#f0f7ff" : "#2f295c",
			textPrimary: isLight ? "#1e293b" : "#ffffff",
			textMuted: isLight ? "#64748b" : "#8e93b4",
			inputBg: isLight ? "#f1f5f9" : "#171031",
			shadow: isLight
				? "0 10px 15px -3px rgba(0, 0, 0, 0.04), 0 4px 6px -2px rgba(0, 0, 0, 0.02)"
				: "0 10px 40px rgba(0,0,0,0.45)",
			accent: "#4f46e5",
		}),
		[isLight],
	);

	useEffect(() => {
		try {
			localStorage.setItem("chat-theme-mode", themeMode);
		} catch {
			// no-op
		}
	}, [themeMode]);

	useEffect(() => {
		if (location.state?.notice) {
			navigate(location.pathname, { replace: true, state: {} });
		}
		if (location.state?.matchId) {
			pendingMatchIdRef.current = String(location.state.matchId);
			navigate(location.pathname, { replace: true, state: {} });
		}

		const params = new URLSearchParams(location.search || "");
		const matchId = params.get("match_id");
		if (matchId) {
			pendingMatchIdRef.current = String(matchId);
		}
	}, [location.state, location.pathname, location.search, navigate]);

	const loadInbox = useCallback(async () => {
		setLoading(true);
		setError("");

		try {
			const token = getToken();
			let liveUser = getCurrentUser();
			if (token && !liveUser?.id) {
				try {
					liveUser = await apiRequest("/users/me", { token });
				} catch {
					liveUser = null;
				}
			}
			setCurrentUser(liveUser);
			const currentUserId = liveUser?.id || "";
			if (!token) {
				setPriorityInbox([]);
				setMessageRequests([]);
				setError("Please sign in to view your inbox.");
				return;
			}

			const data = await apiRequest("/messages/inbox", { token });
			const priority = normalizeThreads(data?.priority || [], currentUserId);
			const requests = normalizeThreads(data?.request_pool || [], currentUserId);
			const allMatchIds = [
				...new Set([...priority, ...requests].map((thread) => thread.matchId).filter(Boolean)),
			];

			const friendCounterpartyIds = [
				...new Set(
					[...priority, ...requests]
						.filter((thread) => thread.isFriendThread)
						.map((thread) => friendCounterpartyId(thread.matchId, currentUserId))
						.filter(Boolean),
				),
			];

			let userById = {};
			if (friendCounterpartyIds.length > 0) {
				const lookup = await apiRequest("/users/lookup", {
					method: "POST",
					token,
					body: { ids: friendCounterpartyIds },
				});
				userById = (lookup?.users || []).reduce((acc, user) => {
					acc[user.id] = user;
					return acc;
				}, {});
			}

			const applyFriendDisplay = (threads) =>
				threads.map((thread) => {
					if (!thread.isFriendThread) {
						return thread;
					}
					const counterpartyId = friendCounterpartyId(thread.matchId, currentUserId);
					const user = userById[counterpartyId];
					if (!user) {
						return { ...thread, senderId: counterpartyId || thread.senderId };
					}
					return {
						...thread,
						name: formatDisplayName(user.name, user.id),
						avatar: user.avatar_url || user.avatar || thread.avatar,
						senderId: user.id,
						verified: Boolean(user.verified),
					};
				});

			setPriorityInbox(applyFriendDisplay(priority));
			setMessageRequests(applyFriendDisplay(requests));
			setActiveThreadId((currentThreadId) => {
				const pendingMatchId = pendingMatchIdRef.current;
				if (pendingMatchId) {
					const matchThread = [...priority, ...requests].find(
						(thread) => thread.matchId === pendingMatchId,
					);
					pendingMatchIdRef.current = "";
					if (matchThread) {
						return matchThread.id;
					}
				}
				const threadStillVisible = [...priority, ...requests].some(
					(thread) => thread.id === currentThreadId,
				);
				if (threadStillVisible) {
					return currentThreadId;
				}
				if (priority.length > 0) {
					return priority[0].id;
				}
				if (requests.length > 0) {
					return requests[0].id;
				}
				return null;
			});

			if (allMatchIds.length > 0) {
				const callHistoryResponse = await apiRequest(
					`/calls/history?match_ids=${allMatchIds.join(",")}`,
					{ token },
				);
				const grouped = (callHistoryResponse?.items || []).reduce((acc, item) => {
					const key = item.match_id || item.context?.chat_thread_id;
					if (!key) {
						return acc;
					}
					if (!acc[key]) {
						acc[key] = [];
					}
					acc[key].push(item);
					return acc;
				}, {});
				setCallHistoryByThread(grouped);
			} else {
				setCallHistoryByThread({});
			}
		} catch (err) {
			setPriorityInbox([]);
			setMessageRequests([]);
			setError(err.message || "Failed to load inbox");
		} finally {
			setLoading(false);
		}
	}, []);

	const loadThreadMessages = useCallback(async (matchId) => {
		const token = getToken();
		if (!(token && matchId)) {
			return;
		}

		try {
			const data = await apiRequest(`/messages/${matchId}`, { token });
			setMessagesByThread((previous) => ({
				...previous,
				[matchId]: Array.isArray(data) ? data.sort(sortByOldest) : [],
			}));
		} catch {
			setMessagesByThread((previous) => ({
				...previous,
				[matchId]: [],
			}));
		}
	}, []);

	useEffect(() => {
		// eslint-disable-next-line react-hooks/set-state-in-effect
		loadInbox();
	}, [loadInbox]);

	const filteredPriorityInbox = useMemo(() => {
		if (!query.trim()) {
			return priorityInbox;
		}
		const search = query.toLowerCase();
		return priorityInbox.filter(
			(thread) =>
				thread.name.toLowerCase().includes(search) || thread.last.toLowerCase().includes(search),
		);
	}, [priorityInbox, query]);

	const filteredRequests = useMemo(() => {
		if (!query.trim()) {
			return messageRequests;
		}
		const search = query.toLowerCase();
		return messageRequests.filter(
			(thread) =>
				thread.name.toLowerCase().includes(search) || thread.last.toLowerCase().includes(search),
		);
	}, [messageRequests, query]);

	const allVisibleThreads = useMemo(
		() => [...filteredPriorityInbox, ...filteredRequests],
		[filteredPriorityInbox, filteredRequests],
	);
	const totalUnread = useMemo(
		() => allVisibleThreads.reduce((sum, t) => sum + Number(t.unread || 0), 0),
		[allVisibleThreads],
	);
	const activeThread = useMemo(
		() => allVisibleThreads.find((thread) => thread.id === activeThreadId),
		[allVisibleThreads, activeThreadId],
	);
	useEffect(() => {
		activeThreadMatchIdRef.current = activeThread?.matchId || "";
	}, [activeThread?.matchId]);

	useEffect(() => {
		if (loading || secureLoading) {
			return;
		}
		if (!activeThread?.matchId) {
			// eslint-disable-next-line react-hooks/set-state-in-effect
			setPageLoading(false);
		} else if (messagesByThread[activeThread.matchId]) {
			setPageLoading(false);
		}
	}, [loading, secureLoading, activeThread, messagesByThread]);

	useEffect(() => {
		const token = getToken();
		if (!(token && activeThread?.matchId) || activeThread?.isFriendThread) {
			// eslint-disable-next-line react-hooks/set-state-in-effect
			setLeadSummary(null);
			setPrequalOverride(false);
			setAiSummary(null);
			setAiNegotiation(null);
			return;
		}

		setLeadLoading(true);
		apiRequest(`/leads/by-match/${encodeURIComponent(activeThread.matchId)}`, {
			token,
		})
			.then((data) => setLeadSummary(data || null))
			.catch(() => setLeadSummary(null))
			.finally(() => setLeadLoading(false));
	}, [activeThread?.matchId, activeThread?.isFriendThread]);

	useEffect(() => {
		if (!leadSummary?.notes) {
			// eslint-disable-next-line react-hooks/set-state-in-effect
			setAiSummary(null);
			setAiNegotiation(null);
			return;
		}

		const summaryNote = extractLatestNote(leadSummary.notes, "AI Summary:");
		if (summaryNote?.note) {
			const parsed = splitSuggestedReply(String(summaryNote.note).replace(/^AI Summary:\\s*/i, ""));
			setAiSummary({
				text: parsed.text,
				suggestedReply: parsed.suggested,
				updatedAt: summaryNote.created_at || null,
			});
		} else {
			setAiSummary(null);
		}

		const negotiationNote = extractLatestNote(leadSummary.notes, "AI Negotiation:");
		if (negotiationNote?.note) {
			const parsed = splitSuggestedReply(
				String(negotiationNote.note).replace(/^AI Negotiation:\\s*/i, ""),
			);
			setAiNegotiation({
				guidance: parsed.text,
				suggestedReply: parsed.suggested,
				updatedAt: negotiationNote.created_at || null,
			});
		} else {
			setAiNegotiation(null);
		}
	}, [leadSummary]);
	const activeCallHistory = useMemo(() => {
		if (!activeThread?.matchId) {
			return [];
		}
		return callHistoryByThread[activeThread.matchId] || [];
	}, [activeThread, callHistoryByThread]);
	const hasRecordedCall = useMemo(
		() =>
			activeCallHistory.some(
				(call) =>
					String(call.recording_status || "").toLowerCase() === "available" && call.recording_url,
			),
		[activeCallHistory],
	);
	const activeMessages = useMemo(() => {
		if (!activeThread?.matchId) {
			return [];
		}
		return messagesByThread[activeThread.matchId] || [];
	}, [activeThread, messagesByThread]);

	function parsePrequal(notes = []) {
		const rows = Array.isArray(notes) ? notes : [];
		const match = rows.find((n) => String(n.note || "").startsWith("AI Pre-Qual Summary")) || null;
		if (!match) {
			return null;
		}
		const text = String(match.note || "");
		const scoreMatch = text.match(/Score\s+([0-9.]+)/i);
		const missingMatch = text.match(/Missing:\s*([^|]+)/i);
		return {
			raw: text,
			score: scoreMatch ? Number(scoreMatch[1]) : null,
			missing: missingMatch ? missingMatch[1].trim() : "",
		};
	}

	const prequal = useMemo(
		() => parsePrequal(leadSummary?.notes || []),
		[leadSummary, parsePrequal],
	);
	const prequalNeedsInfo = Number.isFinite(prequal?.score) ? prequal.score < 0.6 : false;
	const prequalCanOverride = Boolean(currentUser?.verified || isAdminUser);
	const prequalBlocked = prequalNeedsInfo && !isBuyerUser && !prequalOverride && prequalCanOverride;
	const prequalHardBlocked = prequalNeedsInfo && !isBuyerUser && !prequalCanOverride;

	useEffect(() => {
		if (!activeThread?.matchId || hasRecordedCall) {
			return;
		}
		trackClientEvent("call_warning_shown", {
			entityType: "chat_thread",
			entityId: activeThread.matchId,
		});
	}, [activeThread?.matchId, hasRecordedCall]);

	const lockMeta = activeThread?.lock || null;
	const lockStatus = lockMeta?.status || "unclaimed";
	const lockType = lockMeta?.lock_type || null;
	const isAgentUser = userRole === "agent";
	const shouldRespectLock =
		lockType === "verified_first"
			? !(isBuyerUser || isAdminUser)
			: lockType === "agent_claim"
				? isAgentUser
				: isAgentUser;
	const isLockRestricted = shouldRespectLock && lockStatus === "request_access";
	const isLockOwner = Boolean(
		lockMeta && lockMeta?.claimed_by === currentUser?.id && !activeThread?.isFriendThread,
	);
	const canSendMessage = !(isLockRestricted || prequalBlocked || prequalHardBlocked);

	const sharedMedia = useMemo(
		() =>
			activeMessages
				.filter(
					(message) =>
						(isImageMessage(message) || isVideoMessage(message)) && message?.attachment?.url,
				)
				.slice(-9)
				.reverse(),
		[activeMessages],
	);

	const sharedLinks = useMemo(
		() =>
			activeMessages
				.filter(
					(message) =>
						message?.attachment?.url && !isImageMessage(message) && !isVideoMessage(message),
				)
				.slice(-6)
				.reverse(),
		[activeMessages],
	);

	const sharedPosts = useMemo(
		() =>
			activeMessages
				.filter((message) => message?.type === "post")
				.slice(-6)
				.reverse(),
		[activeMessages],
	);

	const participantIds = useMemo(() => {
		const ids = new Set();
		activeMessages.forEach((m) => {
			if (m.sender_id) {
				ids.add(m.sender_id);
			}
		});
		if (activeThread?.senderId) {
			ids.add(activeThread.senderId);
		}
		if (currentUser?.id) {
			ids.add(currentUser.id);
		}
		return Array.from(ids);
	}, [activeMessages, activeThread, currentUser]);

	useEffect(() => {
		if (!activeThread?.matchId) {
			return;
		}
		// eslint-disable-next-line react-hooks/set-state-in-effect
		loadThreadMessages(activeThread.matchId);
	}, [activeThread, loadThreadMessages]);

	useEffect(() => {
		const token = getToken();
		if (!(token && activeThread?.matchId)) {
			return;
		}
		apiRequest(`/messages/${encodeURIComponent(activeThread.matchId)}/read`, {
			method: "POST",
			token,
		})
			.then((data) => {
				const lastReadAt = data?.last_read_at || new Date().toISOString();
				const updateThread = (thread) => {
					if (thread.id !== activeThread.id) {
						return thread;
					}
					return { ...thread, unread: 0, lastReadAt };
				};
				setPriorityInbox((prev) => prev.map(updateThread));
				setMessageRequests((prev) => prev.map(updateThread));
			})
			.catch(() => {
				// ignore read errors
			});
	}, [activeThread?.matchId, activeThread?.id]);

	const refreshPresence = useCallback(async (ids) => {
		const token = getToken();
		if (!(token && ids) || ids.length === 0) {
			return;
		}
		try {
			const data = await apiRequest("/presence", {
				method: "POST",
				token,
				body: { user_ids: ids },
			});
			if (data?.presence) {
				setPresenceMap(data.presence);
			}
		} catch {
			// silent
		}
	}, []);

	useEffect(() => {
		if (participantIds.length === 0) {
			return;
		}
		// eslint-disable-next-line react-hooks/set-state-in-effect
		refreshPresence(participantIds);
	}, [participantIds, refreshPresence]);

	useEffect(() => {
		let isActive = true;

		const connect = () => {
			const token = getToken();
			if (!token) {
				return;
			}

			const ws = new WebSocket(WS_BASE);
			wsRef.current = ws;

			ws.onopen = () => {
				if (!isActive) {
					return;
				}
				reconnectAttemptsRef.current = 0;
				ws.send(
					JSON.stringify({
						type: "identify",
						token,
					}),
				);
				const matchId = activeThreadMatchIdRef.current;
				if (matchId) {
					ws.send(
						JSON.stringify({
							type: "join_chat_room",
							match_id: matchId,
							token,
						}),
					);
				}
			};

			ws.onmessage = (event) => {
				if (!isActive) {
					return;
				}
				const payload = JSON.parse(String(event.data || "{}"));

				if (payload.type === "joined_chat_room") {
					const roomMatchId = payload.match_id;
					const history = Array.isArray(payload.messages)
						? payload.messages.sort(sortByOldest)
						: [];
					setMessagesByThread((previous) => ({
						...previous,
						[roomMatchId]: history,
					}));
					return;
				}

				if (payload.type === "chat_message") {
					const roomMatchId = payload.match_id;
					const incomingMessage = payload.message;
					if (!(roomMatchId && incomingMessage?.id)) {
						return;
					}
					setMessagesByThread((previous) => {
						const existing = previous[roomMatchId] || [];
						if (existing.some((message) => message.id === incomingMessage.id)) {
							return previous;
						}
						return {
							...previous,
							[roomMatchId]: [...existing, incomingMessage].sort(sortByOldest),
						};
					});
					return;
				}

				if (payload.type === "incoming_call") {
					const from = payload?.from || {};
					if (!payload?.call_id) {
						return;
					}
					setCallPromptThread({
						id: payload.match_id || payload.call_id,
						matchId: payload.match_id || "",
						callId: payload.call_id,
						name: from.name || from.email || "Caller",
						avatar: from.avatar || "",
						senderId: from.id || "",
						verified: Boolean(from.verified),
						direction: "incoming",
					});
					return;
				}

				if (payload.type === "chat_error") {
					const retryAfter = Number(payload.retry_after_seconds || 0);
					if (payload.reason || retryAfter > 0) {
						setPolicyFeedback({
							reason: payload.reason || payload.error || "policy_blocked",
							retryAfter,
						});
					}
					if (
						!String(payload.error || "")
							.toLowerCase()
							.includes("forbidden")
					) {
						setError(payload.error || "Live messaging issue");
					}
				}
			};

			ws.onerror = () => {};

			ws.onclose = () => {
				if (!isActive) {
					return;
				}
				if (reconnectTimerRef.current) {
					window.clearTimeout(reconnectTimerRef.current);
				}
				reconnectAttemptsRef.current += 1;
				const delay = Math.min(1000 * 2 ** reconnectAttemptsRef.current, 120_000);
				reconnectTimerRef.current = window.setTimeout(connect, delay);
			};
		};

		connect();

		return () => {
			isActive = false;
			if (reconnectTimerRef.current) {
				window.clearTimeout(reconnectTimerRef.current);
				reconnectTimerRef.current = null;
			}
			if (wsRef.current) {
				wsRef.current.onopen = null;
				wsRef.current.onmessage = null;
				wsRef.current.onerror = null;
				wsRef.current.onclose = null;
				wsRef.current.close();
				wsRef.current = null;
			}
		};
	}, []);

	useEffect(() => {
		const token = getToken();
		const matchId = activeThread?.matchId || "";
		if (!(token && matchId)) {
			return;
		}
		const ws = wsRef.current;
		if (!ws || ws.readyState !== WebSocket.OPEN) {
			return;
		}
		ws.send(
			JSON.stringify({
				type: "join_chat_room",
				match_id: matchId,
				token,
			}),
		);
	}, [activeThread?.matchId]);

	useEffect(() => {
		const token = getToken();
		if (!token) {
			return;
		}

		if (callPromptThread?.direction === "incoming") {
			return;
		}

		const interval = window.setInterval(async () => {
			try {
				const data = await apiRequest("/calls/pending", { token });
				const invite = (data?.invites || [])[0];
				if (!invite?.call_id) {
					return;
				}
				const from = invite?.from || {};
				setCallPromptThread({
					id: invite.match_id || invite.call_id,
					matchId: invite.match_id || "",
					callId: invite.call_id,
					name: from.name || from.email || "Caller",
					avatar: from.avatar || "",
					senderId: from.id || "",
					verified: Boolean(from.verified),
					direction: "incoming",
				});
			} catch {
				// silent
			}
		}, 2000);

		return () => window.clearInterval(interval);
	}, [callPromptThread]);

	async function startInstantCall(thread) {
		const token = getToken();
		if (!(token && thread?.matchId)) {
			setScheduleStatus("Please sign in and select a valid thread before starting a call.");
			return;
		}

		const participantIds = new Set();
		const currentUserId = currentUser?.id || "";
		if (thread.isFriendThread) {
			const parts = String(thread.matchId || "").split(":");
			if (parts.length === 3) {
				if (parts[1]) {
					participantIds.add(parts[1]);
				}
				if (parts[2]) {
					participantIds.add(parts[2]);
				}
			}
		} else {
			activeMessages.forEach((message) => {
				if (message?.sender_id) {
					participantIds.add(message.sender_id);
				}
			});
			if (thread.senderId) {
				participantIds.add(thread.senderId);
			}
		}
		if (currentUserId) {
			participantIds.delete(currentUserId);
		}

		setScheduleStatus("Starting call room...");
		try {
			const result = await apiRequest("/calls/join", {
				method: "POST",
				token,
				body: {
					match_id: thread.matchId,
					chat_thread_id: thread.matchId,
					title: `Call with ${thread.name}`,
					participant_ids: [...participantIds],
				},
			});
			const callId = result?.call?.id;
			if (!callId) {
				throw new Error("Unable to open call room");
			}
			setScheduleStatus("Call room ready. Redirecting...");
			trackClientEvent("call_start", {
				entityType: "call_session",
				entityId: callId,
				metadata: { match_id: thread.matchId },
			});
			navigate(
				`${ROUTES.CALL}?callId=${encodeURIComponent(callId)}&matchId=${encodeURIComponent(thread.matchId)}`,
			);
		} catch (err) {
			setScheduleStatus(err.message || "Failed to start call");
		}
	}

	function closeCallPrompt() {
		setCallPromptThread(null);
	}

	async function acceptCallPrompt() {
		if (!callPromptThread) {
			return;
		}
		const thread = callPromptThread;
		setCallPromptThread(null);
		if (thread.callId) {
			navigate(
				`${ROUTES.CALL}?callId=${encodeURIComponent(thread.callId)}&matchId=${encodeURIComponent(thread.matchId || "")}`,
			);
		}
	}

	async function sendAttachment(file) {
		const token = getToken();
		if (!(token && activeThread?.matchId && file)) {
			return;
		}
		if (!canSendMessage) {
			const message = prequalHardBlocked
				? "AI pre-qualification requires more buyer info. Only verified suppliers can override."
				: prequalBlocked
					? "AI pre-qualification flagged missing fields. Ask the buyer for details or override to send."
					: lockMeta?.lock_type === "verified_first"
						? "This buyer request is locked by a verified supplier. Request access before sharing files."
						: "This conversation is locked. Request access before sharing files.";
			setNotice({ title: "Access required", message, type: "error" });
			return;
		}

		setUploading(true);
		setUploadProgress(0);
		setUploadStatus("Uploading file...");
		try {
			const leadSource = consumeLeadSource();
			const fields = { message: draftMessage.trim() };
			if (leadSource?.type) {
				fields.source_type = leadSource.type;
			}
			if (leadSource?.id) {
				fields.source_id = leadSource.id;
			}
			if (leadSource?.label) {
				fields.source_label = leadSource.label;
			}

			const payload = await uploadFile(
				`/messages/${encodeURIComponent(activeThread.matchId)}/upload`,
				{
					file,
					token,
					fields,
					onProgress: setUploadProgress,
				},
			);

			setMessagesByThread((previous) => ({
				...previous,
				[activeThread.matchId]: [...(previous[activeThread.matchId] || []), payload].sort(
					sortByOldest,
				),
			}));
			setDraftMessage("");
			setUploadStatus("File sent.");
			await loadInbox();
		} catch (err) {
			const msg = err.message || "Unable to upload file";
			if (msg.toLowerCase().includes("verified-only")) {
				setNotice({
					title: "Verified suppliers only",
					message:
						"This buyer accepts messages only from verified suppliers. Verify your account to unlock direct access and priority visibility.",
					type: "error",
				});
			} else {
				setUploadStatus(msg);
			}
		} finally {
			setUploading(false);
			setUploadProgress(0);
			if (fileInputRef.current) {
				fileInputRef.current.value = "";
			}
		}
	}

	function openAttachmentPreview(attachment, absoluteUrlOverride = "") {
		const rawUrl = absoluteUrlOverride || attachment?.url || "";
		if (!rawUrl) {
			return;
		}
		setPreviewAttachment({
			url: absoluteUrlOverride ? absoluteUrlOverride : toAbsoluteAssetUrl(rawUrl),
			name: attachment?.name || "Attachment",
			mimeType: attachment?.mime_type || attachment?.mimeType || "",
		});
	}

	function downloadAttachmentMetadata(attachment, absoluteUrl = "") {
		if (!attachment) return;
		const url = absoluteUrl || attachment.url || "";
		const name = String(attachment.name || url.split("/").pop() || "download");
		const base = name.includes(".") ? name.slice(0, name.lastIndexOf(".")) : name;
		const data = {
			exported_at: new Date().toISOString(),
			file: {
				name,
				mime_type: attachment.mime_type || attachment.mimeType || "",
				size_bytes: attachment.size || null,
				url,
				extension: name.includes(".") ? name.split(".").pop() : "",
			},
			sender: attachment.sender || null,
			message_id: attachment.message_id || attachment.id || null,
			uploaded_at: attachment.uploaded_at || attachment.created_at || null,
		};
		const json = JSON.stringify(data, null, 2);
		const blob = new Blob([json], { type: "application/json" });
		const blobUrl = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = blobUrl;
		a.download = `${base}_metadata.json`;
		document.body.appendChild(a);
		a.click();
		a.remove();
		URL.revokeObjectURL(blobUrl);
	}

	function handleDownloadWithMetadata(message) {
		if (message?.attachment) {
			downloadAttachmentMetadata(message.attachment, message?.attachment?.url || "");
		}
	}

	function renderMessageBody(message, isOwn = false) {
		const attachmentUrl = toAbsoluteAssetUrl(message?.attachment?.url || "");

		if (isImageMessage(message) && attachmentUrl) {
			return (
				<div class="space-y-1">
					{message.message ? (
						<div class="mb-1">
							<MarkdownMessage text={message.message} />
						</div>
					) : null}
					<button
						type="button"
						onClick={() => openAttachmentPreview(message?.attachment, attachmentUrl)}
						class="block w-full overflow-hidden rounded-xl shadow-borderless dark:shadow-borderlessDark text-left transition-opacity hover:opacity-95"
						title="View image"
					>
						<SignedImage
							src={message?.attachment?.url || ""}
							alt={message?.attachment?.name || "Shared image"}
							width={600}
							height={400}
							className="max-h-64 w-full object-cover"
						/>
					</button>
					<button
						type="button"
						onClick={() => handleDownloadWithMetadata(message)}
						class="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 underline underline-offset-2 dark:text-blue-200"
					>
						<Download size={12} />
						Download
					</button>
				</div>
			);
		}

		if (isVideoMessage(message) && attachmentUrl) {
			return (
				<div class="space-y-1">
					{message.message ? (
						<div class="mb-1">
							<MarkdownMessage text={message.message} />
						</div>
					) : null}
					<button
						type="button"
						onClick={() => openAttachmentPreview(message?.attachment, attachmentUrl)}
						class="relative block w-full overflow-hidden rounded-xl shadow-borderless dark:shadow-borderlessDark text-left"
						title="View video"
					>
						<SignedVideo
							src={message?.attachment?.url || ""}
							muted={true}
							playsInline={true}
							preload="metadata"
							className="max-h-64 w-full object-cover"
						/>
						<div class="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/25">
							<div class="rounded-full bg-black/40 px-3 py-1 text-[11px] font-semibold text-white">
								Play
							</div>
						</div>
					</button>
					<button
						type="button"
						onClick={() => handleDownloadWithMetadata(message)}
						class="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 underline underline-offset-2 dark:text-blue-200"
					>
						<Download size={12} />
						Download
					</button>
				</div>
			);
		}

		if (message?.attachment?.url) {
			return (
				<div class="space-y-1">
					{message.message && message.message !== "Shared a file" ? (
						<div class="mb-1">
							<MarkdownMessage text={message.message} />
						</div>
					) : null}
					<FileAttachmentCard
						attachment={message?.attachment}
						url={attachmentUrl}
						isOwn={isOwn}
						isLight={isLight}
						onOpen={() => openAttachmentPreview(message?.attachment, attachmentUrl)}
					/>
				</div>
			);
		}

		const firstUrl = extractFirstUrl(message?.message || "");
		if (firstUrl) {
			const meta = linkPreviewMeta(firstUrl);
			return (
				<div class="space-y-2">
					<MarkdownMessage text={message.message} />
					<a
						href={firstUrl}
						target="_blank"
						rel="noreferrer"
						class="block rounded-xl shadow-borderless dark:shadow-borderlessDark bg-slate-50 p-2 dark:bg-black/20"
					>
						<div class="mb-2 h-24 overflow-hidden rounded-lg bg-slate-200 flex items-center justify-center text-xs text-slate-500 dark:bg-[var(--theme-custom-1f2448)] dark:text-[var(--theme-custom-b8bfe8)]">
							{meta.host}
						</div>
						<div class="text-sm font-semibold">{meta.host}</div>
						{meta.path ? <div class="text-xs opacity-70">{meta.path}</div> : null}
					</a>
				</div>
			);
		}

		return <MarkdownMessage text={message.message} />;
	}

	function buildAiReplyPrompt() {
		const threadName = activeThreadDisplayName || "this contact";
		const recent = activeMessages
			.slice(-6)
			.map((msg) => {
				const sender = msg.sender_id === currentUser?.id ? "Me" : msg.sender_name || "Contact";
				const text = String(msg.message || "").trim();
				return text ? `${sender}: ${text}` : `${sender}: [attachment]`;
			})
			.join("\n");

		return [
			"Draft a concise, professional reply for a B2B textile sourcing conversation.",
			`Thread with: ${threadName}`,
			"Recent messages:",
			recent || "(no recent messages)",
			"Reply guidelines: short, polite, confirm requirements, ask missing info if needed.",
		].join("\n");
	}

	async function requestAiSuggestion() {
		const token = getToken();
		if (!(token && activeThread?.matchId)) {
			return;
		}
		setAiSuggesting(true);
		setAiError("");
		try {
			const prompt = buildAiReplyPrompt();
			const res = await apiRequest("/assistant/ask", {
				method: "POST",
				token,
				body: { question: prompt },
			});
			const suggestion = res?.matched_answer || res?.answer || res?.reply || "";
			if (suggestion) {
				setDraftMessage(String(suggestion).trim());
			} else {
				setAiError("AI could not generate a suggestion yet.");
			}
		} catch (err) {
			setAiError(err.message || "Unable to generate AI suggestion");
		} finally {
			setAiSuggesting(false);
		}
	}

	async function requestAiSummary() {
		const token = getToken();
		if (!(token && activeThread?.matchId)) {
			return;
		}
		setAiSummaryLoading(true);
		setAiSummaryError("");
		try {
			const res = await apiRequest("/assistant/conversation-summary", {
				method: "POST",
				token,
				body: { match_id: activeThread.matchId, force: true },
			});
			const summaryText = String(res?.summary || "").trim();
			const suggested = String(res?.suggested_reply || "").trim();
			if (summaryText) {
				setAiSummary({
					text: summaryText,
					suggestedReply: suggested,
					updatedAt: new Date().toISOString(),
				});
			} else {
				setAiSummaryError("AI summary not available yet.");
			}
		} catch (err) {
			setAiSummaryError(err.message || "Unable to generate AI summary");
		} finally {
			setAiSummaryLoading(false);
		}
	}

	async function requestNegotiationHelper() {
		const token = getToken();
		if (!(token && activeThread?.matchId)) {
			return;
		}
		setAiNegotiationLoading(true);
		setAiNegotiationError("");
		try {
			const res = await apiRequest("/assistant/negotiation", {
				method: "POST",
				token,
				body: { match_id: activeThread.matchId },
			});
			const guidance = String(res?.guidance || "").trim();
			const suggested = String(res?.suggested_reply || "").trim();
			if (guidance) {
				setAiNegotiation({
					guidance,
					suggestedReply: suggested,
					updatedAt: new Date().toISOString(),
				});
			} else {
				setAiNegotiationError("AI negotiation helper is not ready yet.");
			}
		} catch (err) {
			setAiNegotiationError(err.message || "Unable to generate negotiation help");
		} finally {
			setAiNegotiationLoading(false);
		}
	}

	useEffect(() => {
		if (!policyFeedback.retryAfter || policyFeedback.retryAfter <= 0) {
			// eslint-disable-next-line react-hooks/set-state-in-effect
			setCountdownSeconds(0);
			return;
		}
		setCountdownSeconds(policyFeedback.retryAfter);
		const timer = window.setInterval(() => {
			setCountdownSeconds((prev) => Math.max(0, prev - 1));
		}, 1000);
		return () => window.clearInterval(timer);
	}, [policyFeedback.retryAfter]);

	async function sendMessage() {
		const token = getToken();
		if (!(token && activeThread?.matchId)) {
			return;
		}

		const content = draftMessage.trim();
		if (!content) {
			return;
		}
		if (!canSendMessage) {
			const message = prequalHardBlocked
				? "AI pre-qualification requires more buyer info. Only verified suppliers can override."
				: prequalBlocked
					? "AI pre-qualification flagged missing fields. Ask the buyer for details or override to send."
					: lockMeta?.lock_type === "verified_first"
						? "This buyer request is locked by a verified supplier. Request access to continue."
						: "This conversation is locked by another agent. Request access to continue.";
			setNotice({ title: "Access required", message, type: "error" });
			return;
		}

		try {
			const leadSource = consumeLeadSource();
			const sourcePayload = leadSource?.type
				? {
						source_type: leadSource.type,
						source_id: leadSource.id,
						source_label: leadSource.label,
					}
				: {};
			// Optimistic local append of the user's message so UI feels instant.
			// The server will still be the source of truth after `loadInbox()`.
			if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
				wsRef.current.send(
					JSON.stringify({
						type: "chat_message",
						match_id: activeThread.matchId,
						token,
						message: content,
						message_type: "text",
						...sourcePayload,
					}),
				);
			} else {
				const created = await apiRequest(`/messages/${activeThread.matchId}`, {
					method: "POST",
					token,
					body: {
						message: content,
						type: "text",
						...sourcePayload,
					},
				});
				setMessagesByThread((previous) => ({
					...previous,
					[activeThread.matchId]: [...(previous[activeThread.matchId] || []), created].sort(
						sortByOldest,
					),
				}));
			}

			trackClientEvent("message_sent", {
				entityType: "chat_thread",
				entityId: activeThread.matchId,
				metadata: {
					length: content.length,
					role: currentUser?.role || "",
				},
			});

			// Chatbot (project.md): optionally generate an immediate "first response" from the company side.
			// This does NOT replace the human reply; it just handles common questions and can hand off to an agent.
			try {
				const botRes = await apiRequest("/chatbot/reply", {
					method: "POST",
					token,
					body: { match_id: activeThread.matchId, message: content },
				});
				if (botRes?.reply) {
					setMessagesByThread((previous) => ({
						...previous,
						[activeThread.matchId]: [...(previous[activeThread.matchId] || []), botRes.reply].sort(
							sortByOldest,
						),
					}));
				}
			} catch {
				// Silent: chatbot is best-effort and should never block messaging.
			}

			setDraftMessage("");
			setPolicyFeedback({ reason: "", retryAfter: 0 });
			await loadInbox();
		} catch (err) {
			const msg = err.message || "Unable to send message";
			const retryAfter = Number(
				err?.details?.policy?.retry_after_seconds || err?.details?.retry_after_seconds || 0,
			);
			const reason = err?.details?.policy?.reason || err?.details?.reason || "";
			if (reason || retryAfter > 0) {
				setPolicyFeedback({ reason: reason || msg, retryAfter });
			}
			if (msg.toLowerCase().includes("verified-only")) {
				setNotice({
					title: "Verified suppliers only",
					message:
						"This buyer accepts messages only from verified suppliers. Verify your account to unlock direct access and priority visibility.",
					type: "error",
				});
			} else {
				setError(msg);
			}
		}
	}

	async function requestAccess() {
		const token = getToken();
		if (!(token && activeThread?.requestId)) {
			return;
		}
		try {
			await apiRequest(
				`/conversations/${encodeURIComponent(activeThread.requestId)}/request-access`,
				{ method: "POST", token },
			);
			setNotice({
				title: "Access requested",
				message: "The lock owner has been notified.",
				type: "info",
			});
			await loadInbox();
		} catch (err) {
			setNotice({
				title: "Request failed",
				message: err.message || "Unable to request access",
				type: "error",
			});
		}
	}

	function openGrantModal() {
		setGrantUserId("");
		setGrantMode("grant");
		setShowGrantModal(true);
	}

	function openTransferModal() {
		setGrantUserId("");
		setGrantMode("transfer");
		setShowGrantModal(true);
	}

	async function submitGrantOrTransfer() {
		const t = getToken();
		if (!(t && activeThread?.requestId && grantUserId.trim())) {
			return;
		}
		const mode = grantMode;
		setShowGrantModal(false);
		try {
			const endpoint = mode === "grant" ? "grant" : "transfer";
			await apiRequest(`/conversations/${encodeURIComponent(activeThread.requestId)}/${endpoint}`, {
				method: "POST",
				t,
				body: { target_user_id: grantUserId.trim() },
			});
			setNotice({
				title: mode === "grant" ? "Access granted" : "Conversation transferred",
				message:
					mode === "grant"
						? `User ${grantUserId.trim()} can now join this conversation.`
						: `Ownership moved to ${grantUserId.trim()}. You no longer have messaging access.`,
				type: "info",
			});
			await loadInbox();
		} catch (err) {
			setNotice({
				title: mode === "grant" ? "Grant failed" : "Transfer failed",
				message: err.message || `Unable to ${mode} conversation`,
				type: "error",
			});
		}
	}

	const activeThreadDisplayName = formatDisplayName(
		activeThread?.name,
		activeThread?.senderId || activeThread?.matchId,
	);
	const activeAvatar = avatarUrl(activeThread?.avatar);
	const visibleError = String(error || "")
		.toLowerCase()
		.includes("forbidden")
		? ""
		: error;
	const todayLabel = dateDividerLabel(activeMessages.at(-1)?.timestamp);

	if (pageLoading) {
		return <NeonAtom fill={true} timeout={10_000} />;
	}

	return (
		<div
			class="fixed inset-0 font-['Poppins',sans-serif] text-white chat-interface-container overflow-hidden"
			style={{
				background: theme.pageBg,
				color: theme.textPrimary,
			}}
		>
			<style>{`
        .chat-interface-container *,
        .chat-interface-container *:before,
        .chat-interface-container *:after {
          outline: none !important;
        }
        .chat-interface-container input::placeholder {
          color: ${isLight ? "#94a3b8" : "#7f86ae"} !important;
        }
      `}</style>
			{notice ? (
				<div
					class="mx-3 mt-2 rounded-xl px-4 py-3 text-sm font-medium shadow-sm"
					style={{
						background: notice.type === "error" ? "#fee2e2" : "#e1f0fe",
						color: "#0f172a",
					}}
				>
					<div class="flex items-center justify-between gap-4">
						<div>
							<div class="text-[13px] font-semibold">{notice.title || "Notice"}</div>
							<div class="text-[12px] opacity-80">{notice.message || ""}</div>
						</div>
						<button onClick={() => setNotice(null)} class="text-xs font-semibold">
							Dismiss
						</button>
					</div>
				</div>
			) : null}
			<AttachmentPreviewModal
				open={Boolean(previewAttachment)}
				attachment={previewAttachment}
				onClose={() => setPreviewAttachment(null)}
			/>
			{callPromptThread ? (
				<div class="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4">
					<div class="w-full max-w-sm rounded-2xl shadow-borderless dark:shadow-borderlessDark bg-[var(--theme-custom-14122b)] p-6 text-white shadow-2xl">
						<div class="flex items-center gap-4">
							{callPromptThread.avatar ? (
								<LazyImage
									src={avatarUrl(callPromptThread.avatar)}
									alt={callPromptThread.name}
									width={64}
									height={64}
									class="h-16 w-16 rounded-full object-cover"
									eager={true}
								/>
							) : (
								<div class="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--theme-custom-2a2744)] text-lg font-bold">
									{getInitials(formatDisplayName(callPromptThread.name, callPromptThread.senderId))}
								</div>
							)}
							<div>
								<p class="text-sm text-slate-300">
									{callPromptThread.direction === "incoming" ? "Incoming call" : "Calling"}
								</p>
								<p class="text-lg font-semibold">
									{formatDisplayName(callPromptThread.name, callPromptThread.senderId)}
								</p>
								<p class="text-xs text-slate-400">
									{callPromptThread.direction === "incoming"
										? "Accept to join the call."
										: "Ready to start the call*"}
								</p>
							</div>
						</div>
						<div class="mt-6 flex items-center justify-between gap-3">
							<button
								onClick={closeCallPrompt}
								class="flex-1 rounded-xl shadow-borderless dark:shadow-borderlessDark bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-300 hover:bg-red-500/20"
							>
								Decline
							</button>
							<button
								onClick={acceptCallPrompt}
								class="flex-1 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-400"
							>
								Accept
							</button>
						</div>
					</div>
				</div>
			) : null}
			<div class="grid h-full w-full grid-cols-1 gap-2 p-2 md:grid-cols-[62px_1fr] lg:grid-cols-[62px_minmax(260px,22vw)_1fr] xl:grid-cols-[62px_minmax(260px,20vw)_1fr_minmax(280px,22vw)]">
				<ChatSidebar
					themeMode={themeMode}
					setThemeMode={setThemeMode}
					isLight={isLight}
					theme={theme}
					location={location}
					navigate={navigate}
					ROUTES={ROUTES}
					CHAT_NAV_ITEMS={CHAT_NAV_ITEMS}
					totalUnread={totalUnread}
				/>

				<ThreadList
					query={query}
					setQuery={setQuery}
					allVisibleThreads={allVisibleThreads}
					loading={loading}
					visibleError={visibleError}
					activeThreadId={activeThreadId}
					setActiveThreadId={setActiveThreadId}
					presenceStatus={presenceStatus}
					isLight={isLight}
					theme={theme}
				/>

				<MessageArea
					activeThread={activeThread}
					activeMessages={activeMessages}
					draftMessage={draftMessage}
					setDraftMessage={setDraftMessage}
					canSendMessage={canSendMessage}
					isLockRestricted={isLockRestricted}
					isLockOwner={isLockOwner}
					isAdminUser={isAdminUser}
					isLight={isLight}
					theme={theme}
					currentUser={currentUser}
					activeAvatar={activeAvatar}
					activeThreadDisplayName={activeThreadDisplayName}
					presenceStatus={presenceStatus}
					presenceLastSeen={presenceLastSeen}
					lockMeta={lockMeta}
					hasRecordedCall={hasRecordedCall}
					scheduleStatus={scheduleStatus}
					uploading={uploading}
					uploadProgress={uploadProgress}
					uploadStatus={uploadStatus}
					policyFeedback={policyFeedback}
					countdownSeconds={countdownSeconds}
					aiSuggesting={aiSuggesting}
					aiError={aiError}
					sendMessage={sendMessage}
					sendAttachment={sendAttachment}
					openAttachmentPreview={openAttachmentPreview}
					requestAiSuggestion={requestAiSuggestion}
					prequalNeedsInfo={prequalNeedsInfo}
					prequalHardBlocked={prequalHardBlocked}
					prequalCanOverride={prequalCanOverride}
					prequal={prequal}
					notice={notice}
					renderMessageBody={renderMessageBody}
					openGrantModal={openGrantModal}
					openTransferModal={openTransferModal}
					startInstantCall={startInstantCall}
					requestAccess={requestAccess}
					setPrequalOverride={setPrequalOverride}
					fileInputRef={fileInputRef}
				/>

				<RightPanel
					activeThread={activeThread}
					activeAvatar={activeAvatar}
					activeThreadDisplayName={activeThreadDisplayName}
					isLight={isLight}
					theme={theme}
					leadLoading={leadLoading}
					prequal={prequal}
					aiSummary={aiSummary}
					aiSummaryLoading={aiSummaryLoading}
					aiSummaryError={aiSummaryError}
					aiNegotiation={aiNegotiation}
					aiNegotiationLoading={aiNegotiationLoading}
					aiNegotiationError={aiNegotiationError}
					accordionState={accordionState}
					setAccordionState={setAccordionState}
					sharedMedia={sharedMedia}
					sharedLinks={sharedLinks}
					sharedPosts={sharedPosts}
					requestAiSummary={requestAiSummary}
					requestNegotiationHelper={requestNegotiationHelper}
					openAttachmentPreview={openAttachmentPreview}
					userRole={userRole}
				/>
			</div>

			<GrantTransferModal
				showModal={showGrantModal}
				mode={grantMode}
				userId={grantUserId}
				setUserId={setGrantUserId}
				setShowModal={setShowGrantModal}
				onSubmit={submitGrantOrTransfer}
			/>
		</div>
	);
}
