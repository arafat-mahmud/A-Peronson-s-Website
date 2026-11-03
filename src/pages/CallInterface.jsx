import {
	AlertTriangle,
	ArrowLeft,
	Camera,
	CameraOff,
	CheckCircle2,
	ChevronDown,
	Circle,
	CircleDot,
	Clock3,
	Copy,
	Ellipsis,
	Maximize,
	MessageSquare,
	Mic,
	MicOff,
	PhoneOff,
	Radio,
	RefreshCw,
	Send,
	ShieldAlert,
	Smile,
	Volume2,
	VolumeX,
	WifiOff,
	X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ThreeDot } from "react-loading-indicators";
import { useNavigate, useSearchParams } from "react-router-dom";
import MarkdownMessage from "../components/chat/MarkdownMessage.jsx";
import JourneyTimeline from "../components/JourneyTimeline.jsx";
import NeonAtom from "../components/ui/NeonAtom.jsx";
import UploadProgressBar from "../components/ui/UploadProgressBar.jsx";
import { apiRequest, getCurrentUser, getToken } from "../lib/auth.js";
import { trackClientEvent } from "../lib/events.js";
import { logger } from "../lib/logger.js";
import { uploadFile } from "../lib/upload.js";

const WS_BASE = (() => {
	if (import.meta.env.VITE_WS_URL) {
		return import.meta.env.VITE_WS_URL;
	}
	const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
	return `${protocol}//${window.location.host}/ws`;
})();

const ICE_SERVERS = (() => {
	const fallback = [{ urls: "stun:stun.l.google.com:19302" }];
	const raw = import.meta.env.VITE_ICE_SERVERS;
	if (!raw) {
		return fallback;
	}
	try {
		const parsed = JSON.parse(raw);
		if (Array.isArray(parsed) && parsed.length > 0) {
			return parsed;
		}
		return fallback;
	} catch {
		return fallback;
	}
})();

import { QUICK_EMOJIS } from "../lib/constants.js";

function cx(...parts) {
	return parts.filter(Boolean).join(" ");
}

function Badge({ tone = "neutral", children, className = "" }) {
	const tones = {
		neutral: "bg-slate-900/80 text-slate-100 ring-white/10 dark:bg-slate-950/80",
		emerald: "bg-emerald-500/15 text-emerald-700 ring-emerald-500/20 dark:text-emerald-300",
		rose: "bg-rose-500/15 text-rose-700 ring-rose-500/20 dark:text-rose-300",
		amber: "bg-amber-500/15 text-amber-700 ring-amber-500/20 dark:text-amber-300",
		sky: "bg-sky-500/15 text-sky-700 ring-sky-500/20 dark:text-sky-300",
		blue: "bg-blue-500/15 text-blue-700 ring-blue-500/20 dark:text-blue-300",
		violet: "bg-sky-500/15 text-sky-700 ring-sky-500/20 dark:text-sky-300",
	};
	return (
		<span
			className={cx(
				"inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ring-1",
				tones[tone],
				className,
			)}
		>
			{children}
		</span>
	);
}

function IconButton({
	icon: Icon,
	label,
	active = false,
	onClick,
	className = "",
	disabled = false,
	tone = "default",
	badge,
}) {
	const toneClasses = {
		default:
			"bg-white/8 hover:bg-white/12 text-white ring-white/10 dark:bg-slate-950/70 dark:text-slate-100",
		primary: "bg-sky-500/15 hover:bg-sky-500/20 text-sky-200 ring-sky-400/20",
		danger: "bg-rose-500/15 hover:bg-rose-500/20 text-rose-200 ring-rose-400/20",
		muted: "bg-slate-500/15 hover:bg-slate-500/20 text-slate-200 ring-slate-400/20",
	};
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={disabled}
			aria-label={label}
			title={label}
			className={cx(
				"relative inline-flex h-11 w-11 items-center justify-center rounded-2xl ring-1 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-sky-400/60 disabled:cursor-not-allowed disabled:opacity-50",
				toneClasses[tone],
				active && "scale-[1.02] shadow-lg shadow-sky-500/10",
				className,
			)}
		>
			<Icon className="h-5 w-5" />
			{badge ? (
				<span className="absolute -right-1 -top-1 rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white shadow">
					{badge}
				</span>
			) : null}
		</button>
	);
}

function MiniStat({ label, value, icon: Icon }) {
	return (
		<div className="rounded-2xl border border-white/10 bg-white/8 p-4 shadow-sm backdrop-blur-xl dark:bg-slate-950/60">
			<div className="flex items-center gap-3">
				<div className="grid h-10 w-10 place-items-center rounded-xl bg-sky-500/15 text-sky-200 ring-1 ring-sky-400/20 dark:text-sky-300">
					<Icon className="h-4 w-4" />
				</div>
				<div>
					<div className="text-xs text-slate-500 dark:text-slate-400">{label}</div>
					<div className="text-sm font-semibold text-slate-900 dark:text-white">{value}</div>
				</div>
			</div>
		</div>
	);
}

function ToastStack({ toasts, onDismiss }) {
	return (
		<div className="pointer-events-none fixed right-4 top-4 z-[80] flex w-[min(92vw,380px)] flex-col gap-3">
			{toasts.map((toast) => (
				<div
					key={toast.id}
					className={cx(
						"pointer-events-auto rounded-2xl border p-4 shadow-2xl backdrop-blur-xl transition-all",
						toast.type === "error" && "border-rose-500/20 bg-rose-500/12 text-rose-50",
						toast.type === "success" && "border-emerald-500/20 bg-emerald-500/12 text-emerald-50",
						toast.type === "info" && "border-slate-500/20 bg-slate-950/85 text-white",
					)}
				>
					<div className="flex items-start gap-3">
						<div className="mt-0.5">
							{toast.type === "error" ? (
								<AlertTriangle className="h-5 w-5" />
							) : toast.type === "success" ? (
								<CheckCircle2 className="h-5 w-5" />
							) : (
								<CircleDot className="h-5 w-5" />
							)}
						</div>
						<div className="min-w-0 flex-1">
							<div className="text-sm font-semibold">{toast.title}</div>
							<div className="mt-1 text-sm opacity-90">{toast.message}</div>
						</div>
						<button
							onClick={() => onDismiss(toast.id)}
							className="rounded-lg p-1 opacity-70 hover:bg-white/10 hover:opacity-100"
						>
							<X className="h-4 w-4" />
						</button>
					</div>
				</div>
			))}
		</div>
	);
}

function MediaGate({ gate, onAction, onDismiss }) {
	if (!gate) {
		return null;
	}
	return (
		<div className="absolute inset-0 z-30 grid place-items-center bg-slate-950/70 p-4 backdrop-blur-md">
			<div className="w-full max-w-lg rounded-[2rem] border border-white/10 bg-white/90 p-6 shadow-2xl dark:bg-slate-950/90">
				<div className="flex items-start gap-4">
					<div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-sky-500/15 text-sky-600 ring-1 ring-sky-500/20 dark:text-sky-300">
						<ShieldAlert className="h-7 w-7" />
					</div>
					<div className="min-w-0 flex-1">
						<h3 className="text-xl font-bold text-slate-900 dark:text-white">{gate.title}</h3>
						<p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
							{gate.message}
						</p>
						{gate.detail ? (
							<p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{gate.detail}</p>
						) : null}
					</div>
				</div>
				<div className="mt-6 flex flex-wrap items-center justify-end gap-3">
					<button
						onClick={onDismiss}
						className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/5"
					>
						Dismiss
					</button>
					<button
						onClick={onAction}
						className="rounded-2xl bg-gradient-to-r from-sky-500 to-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-sky-500/20"
					>
						{gate.actionLabel || "Try again"}
					</button>
				</div>
			</div>
		</div>
	);
}

const PulseSpinner = ({ className }) => (
	<ThreeDot variant="bounce" color="#337ab0" size="small" text="" textColor="" />
);

export default function CallInterface() {
	const [searchParams] = useSearchParams();
	const navigate = useNavigate();
	const [pageLoading, setPageLoading] = useState(true);
	const [statusMessage, setStatusMessage] = useState("");
	const [callDetails, setCallDetails] = useState(null);
	const [participants, setParticipants] = useState([]);
	const [isMuted, setIsMuted] = useState(false);
	const [isSpeakerMuted, setIsSpeakerMuted] = useState(false);
	const [isCameraOn, setIsCameraOn] = useState(true);
	const [isFullscreen, setIsFullscreen] = useState(false);
	const [timer, setTimer] = useState("00:00:00");
	const [chatDraft, setChatDraft] = useState("");
	const [chatMessages, setChatMessages] = useState([]);
	const [isChatOpen, setIsChatOpen] = useState(() => {
		if (typeof window === "undefined") {
			return true;
		}
		return window.innerWidth >= 1024;
	});
	const [unreadChatCount, setUnreadChatCount] = useState(0);
	const [isChatLive, setIsChatLive] = useState(false);
	const [wsStatus, setWsStatus] = useState("offline");
	const [rtcConnectionState, setRtcConnectionState] = useState("new");
	const [rtcIceState, setRtcIceState] = useState("new");
	const [micLevel, setMicLevel] = useState(0);
	const [isEmojiOpen, setIsEmojiOpen] = useState(false);
	const [isMoreOpen, setIsMoreOpen] = useState(false);
	const [toast, setToast] = useState(null);
	const [reconnectNonce, setReconnectNonce] = useState(0);
	const [hasRemoteStream, setHasRemoteStream] = useState(false);
	const [hasLocalStream, setHasLocalStream] = useState(false);
	const [isRequestingMedia, setIsRequestingMedia] = useState(false);
	const [mediaGate, setMediaGate] = useState(null);
	const [recordingState, setRecordingState] = useState("idle");
	const [toastQueue, setToastQueue] = useState([]);

	const localVideoRef = useRef(null);
	const remoteVideoRef = useRef(null);
	const stageRef = useRef(null);
	const chatScrollRef = useRef(null);
	const chatEndRef = useRef(null);
	const chatInputRef = useRef(null);
	const emojiPopoverRef = useRef(null);
	const morePopoverRef = useRef(null);
	const toastTimerRef = useRef(null);
	const wsRef = useRef(null);
	const reconnectTimerRef = useRef(null);
	const peerConnectionRef = useRef(null);
	const iceServersRef = useRef(ICE_SERVERS);
	const localStreamRef = useRef(null);
	const remoteStreamRef = useRef(null);
	const localStreamPromiseRef = useRef(null);
	const pendingCandidatesRef = useRef([]);
	const pendingRemoteOfferRef = useRef(null);
	const shouldOfferRef = useRef(false);
	const offerSentRef = useRef(false);
	const tokenRef = useRef("");
	const hasLocalStreamRef = useRef(false);
	const mediaGateRef = useRef(null);
	const isMutedRef = useRef(false);
	const audioRafRef = useRef(null);
	const audioContextRef = useRef(null);
	const isChatOpenRef = useRef(true);
	const chatRoomMatchIdRef = useRef("");
	const chatInitializedRef = useRef(false);
	const mountedRef = useRef(true);
	const redirectedRef = useRef(false);
	const recorderRef = useRef(null);
	const recordingChunksRef = useRef([]);
	const recordingCleanupRef = useRef(null);

	const callId = useMemo(() => searchParams.get("callId") || "", [searchParams]);
	const matchId = useMemo(() => searchParams.get("matchId") || "", [searchParams]);
	const user = useMemo(() => getCurrentUser(), []);
	const participantId = useMemo(() => (user?.id ? String(user.id) : ""), [user?.id]);
	const effectiveMatchId = callDetails?.match_id || callDetails?.context?.chat_thread_id || matchId;

	const localName = user?.name || user?.email || "You";
	const remoteParticipant = participants.find((p) => p.id && p.id !== user?.id) || null;
	const remoteName =
		remoteParticipant?.name || remoteParticipant?.email || callDetails?.title || "Participant";
	const [recordingUploadProgress, setRecordingUploadProgress] = useState(0);
	const recordingLabel =
		recordingState === "recording"
			? "REC"
			: recordingState === "uploading"
				? "Uploading"
				: recordingState === "available"
					? "Saved"
					: recordingState === "failed"
						? "Failed"
						: "Idle";

	const userMap = useMemo(() => {
		const map = new Map();
		participants.forEach((p) => {
			if (p?.id) {
				map.set(p.id, p);
			}
		});
		if (user?.id) {
			map.set(user.id, user);
		}
		return map;
	}, [participants, user]);

	const sortedChatMessages = useMemo(
		() =>
			[...chatMessages].sort(
				(a, b) => new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime(),
			),
		[chatMessages],
	);

	const isSpeaking = !isMuted && micLevel > 0.12;

	const connectionBadge = useMemo(() => {
		const wsOnline = wsStatus === "online";
		const rtcConnected = rtcConnectionState === "connected";
		const rtcFailed = rtcConnectionState === "failed" || rtcIceState === "failed";
		const rtcConnecting =
			["new", "connecting"].includes(rtcConnectionState) || ["checking"].includes(rtcIceState);

		if (!wsOnline) {
			if (wsStatus === "connecting") {
				return { tone: "amber", label: "Connecting", pulse: true };
			}
			return { tone: "neutral", label: "Offline", pulse: false };
		}
		if (rtcFailed) {
			return { tone: "rose", label: "Connection issue", pulse: false };
		}
		if (rtcConnected) {
			return { tone: "emerald", label: "Live", pulse: true };
		}
		if (rtcConnecting) {
			return { tone: "amber", label: "Connecting", pulse: true };
		}
		return { tone: "sky", label: "Waiting", pulse: false };
	}, [rtcConnectionState, rtcIceState, wsStatus]);

	const showToast = useCallback((type, title, message) => {
		const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
		setToastQueue((prev) => [...prev, { id, type, title, message }]);
		window.setTimeout(() => {
			setToastQueue((prev) => prev.filter((t) => t.id !== id));
		}, 2200);
	}, []);

	const formatMessageTime = (iso) => {
		if (!iso) {
			return "";
		}
		return new Date(iso).toLocaleTimeString([], {
			hour: "2-digit",
			minute: "2-digit",
		});
	};

	const buildMediaGate = (error) => {
		if (!window.isSecureContext) {
			return {
				title: "Camera/microphone requires HTTPS",
				message: "Open this app on https:// (or localhost). Then refresh and try again.",
				actionLabel: null,
			};
		}

		const name = String(error?.name || "");
		if (name === "NotAllowedError" || name === "PermissionDeniedError") {
			return {
				title: "Camera/microphone blocked",
				message:
					'Allow Camera + Microphone for this site (browser lock icon → Site settings), then click "Try again".',
				actionLabel: "Try again",
			};
		}

		if (name === "NotFoundError") {
			return {
				title: "No camera/microphone found",
				message:
					'Connect a camera/microphone (or enable it in OS settings), then click "Try again".',
				actionLabel: "Try again",
			};
		}

		if (name === "NotReadableError") {
			return {
				title: "Camera/microphone is busy",
				message:
					'Close other apps using your camera/microphone (Zoom/Meet/etc.), then click "Try again".',
				actionLabel: "Try again",
			};
		}

		return {
			title: "Unable to access camera/microphone",
			message: error?.message
				? String(error.message)
				: "Please check browser and OS permissions, then try again.",
			actionLabel: "Try again",
		};
	};

	const ensureLocalStream = useCallback(async () => {
		if (localStreamRef.current) {
			return localStreamRef.current;
		}
		if (localStreamPromiseRef.current) {
			return localStreamPromiseRef.current;
		}

		if (!window.isSecureContext) {
			const error = new Error("Camera/microphone requires a secure context (HTTPS or localhost).");
			if (mountedRef.current) {
				setHasLocalStream(false);
				setMediaGate(buildMediaGate(error));
				setStatusMessage("Camera/microphone requires HTTPS.");
			}
			throw error;
		}

		if (!navigator?.mediaDevices?.getUserMedia) {
			const error = new Error("getUserMedia is not supported in this browser/environment.");
			if (mountedRef.current) {
				setHasLocalStream(false);
				setMediaGate(buildMediaGate(error));
				setStatusMessage("Camera/microphone is not supported here.");
			}
			throw error;
		}

		if (mountedRef.current) {
			setIsRequestingMedia(true);
		}

		localStreamPromiseRef.current = navigator.mediaDevices
			.getUserMedia({ video: true, audio: true })
			.then((stream) => {
				localStreamRef.current = stream;
				if (mountedRef.current) {
					setHasLocalStream(true);
					setMediaGate(null);
				}
				if (localVideoRef.current) {
					localVideoRef.current.srcObject = stream;
					const playAttempt = localVideoRef.current.play?.();
					if (playAttempt && typeof playAttempt.catch === "function") {
						playAttempt.catch(() => logger.warn("Local video play failed"));
					}
				}

				if (peerConnectionRef.current) {
					stream.getTracks().forEach((track) => {
						try {
							peerConnectionRef.current.addTrack(track, stream);
						} catch {
							// ignore duplicate track errors
						}
					});
				}
				return stream;
			})
			.catch((err) => {
				localStreamPromiseRef.current = null;
				if (mountedRef.current) {
					setHasLocalStream(false);
					setMediaGate(buildMediaGate(err));
					setStatusMessage("Camera/microphone permission not granted.");
				}
				throw err;
			})
			.finally(() => {
				if (mountedRef.current) {
					setIsRequestingMedia(false);
				}
			});

		return localStreamPromiseRef.current;
	}, [buildMediaGate]);

	const toSessionDescriptionInit = (description) => {
		if (!description) {
			return null;
		}
		if (typeof description.toJSON === "function") {
			return description.toJSON();
		}
		if (typeof description.sdp === "string" && typeof description.type === "string") {
			return { type: description.type, sdp: description.sdp };
		}
		return description;
	};

	const toIceCandidateInit = (candidate) => {
		if (!candidate) {
			return null;
		}
		if (typeof candidate.toJSON === "function") {
			return candidate.toJSON();
		}
		return candidate;
	};

	const createPeerConnection = useCallback(
		(token) => {
			if (peerConnectionRef.current) {
				return peerConnectionRef.current;
			}
			const pc = new RTCPeerConnection({
				iceServers: iceServersRef.current,
			});

			pc.onicecandidate = (event) => {
				if (!event.candidate) {
					return;
				}
				if (wsRef.current?.readyState !== WebSocket.OPEN) {
					return;
				}
				wsRef.current.send(
					JSON.stringify({
						type: "webrtc_signal",
						call_id: callId,
						token,
						signal: {
							type: "candidate",
							candidate: toIceCandidateInit(event.candidate),
						},
					}),
				);
			};

			pc.ontrack = (event) => {
				let stream = event.streams?.[0] || null;
				if (!stream) {
					if (!remoteStreamRef.current) {
						remoteStreamRef.current = new MediaStream();
					}
					stream = remoteStreamRef.current;
					try {
						stream.addTrack(event.track);
					} catch {
						// ignore duplicate track errors
					}
				}

				if (!stream) {
					return;
				}
				remoteStreamRef.current = stream;
				if (remoteVideoRef.current) {
					remoteVideoRef.current.srcObject = stream;
					const playAttempt = remoteVideoRef.current.play?.();
					if (playAttempt && typeof playAttempt.catch === "function") {
						playAttempt.catch(() => logger.warn("Remote video play failed"));
					}
				}
				if (mountedRef.current) {
					setHasRemoteStream(true);
				}
			};

			pc.onconnectionstatechange = () => {
				if (!mountedRef.current) {
					return;
				}
				setRtcConnectionState(pc.connectionState || "new");
				if (pc.connectionState === "connected") {
					setStatusMessage("Call connected.");
				} else if (pc.connectionState === "failed") {
					setStatusMessage("Call connection failed.");
				}
			};

			pc.oniceconnectionstatechange = () => {
				if (!mountedRef.current) {
					return;
				}
				setRtcIceState(pc.iceConnectionState || "new");
				if (pc.iceConnectionState === "failed") {
					setStatusMessage("ICE negotiation failed (TURN server may be required).");
				} else if (pc.iceConnectionState === "disconnected") {
					setStatusMessage("ICE disconnected.");
				}
			};

			if (mountedRef.current) {
				setRtcConnectionState(pc.connectionState || "new");
				setRtcIceState(pc.iceConnectionState || "new");
			}

			if (localStreamRef.current) {
				localStreamRef.current.getTracks().forEach((track) => {
					pc.addTrack(track, localStreamRef.current);
				});
			}

			peerConnectionRef.current = pc;
			return pc;
		},
		[callId, toIceCandidateInit],
	);

	const tryStartOffer = useCallback(async () => {
		if (!shouldOfferRef.current) {
			return false;
		}
		if (offerSentRef.current) {
			return false;
		}
		if (!hasLocalStreamRef.current) {
			return false;
		}

		const token = tokenRef.current;
		if (!token) {
			return false;
		}
		if (!callId) {
			return false;
		}
		if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
			return false;
		}

		try {
			const pc = createPeerConnection(token);
			const offer = await pc.createOffer();
			await pc.setLocalDescription(offer);
			wsRef.current.send(
				JSON.stringify({
					type: "webrtc_signal",
					call_id: callId,
					token,
					signal: {
						type: "offer",
						sdp: toSessionDescriptionInit(pc.localDescription) || offer,
					},
				}),
			);

			offerSentRef.current = true;
			if (mountedRef.current) {
				setStatusMessage("Offer sent. Waiting for answer...");
			}
			return true;
		} catch (error) {
			offerSentRef.current = false;
			throw error;
		}
	}, [callId, createPeerConnection, toSessionDescriptionInit]);

	const tryAnswerPendingOffer = useCallback(async () => {
		const pendingOffer = pendingRemoteOfferRef.current;
		if (!pendingOffer) {
			return false;
		}
		if (!hasLocalStreamRef.current) {
			return false;
		}

		const token = tokenRef.current;
		if (!token) {
			return false;
		}
		if (!callId) {
			return false;
		}
		if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
			return false;
		}

		try {
			const pc = createPeerConnection(token);
			await pc.setRemoteDescription(pendingOffer);
			const answer = await pc.createAnswer();
			await pc.setLocalDescription(answer);
			wsRef.current.send(
				JSON.stringify({
					type: "webrtc_signal",
					call_id: callId,
					token,
					signal: {
						type: "answer",
						sdp: toSessionDescriptionInit(pc.localDescription) || answer,
					},
				}),
			);

			pendingRemoteOfferRef.current = null;
			const pending = pendingCandidatesRef.current;
			pendingCandidatesRef.current = [];
			for (const queued of pending) {
				try {
					await pc.addIceCandidate(queued);
				} catch {
					// ignore candidate errors
				}
			}

			if (mountedRef.current) {
				setStatusMessage("Answer sent. Connecting...");
			}
			return true;
		} catch (error) {
			// Keep pending offer for retry after the user fixes permissions.
			pendingRemoteOfferRef.current = pendingOffer;
			throw error;
		}
	}, [callId, createPeerConnection, toSessionDescriptionInit]);

	useEffect(() => {
		if (!(callId || redirectedRef.current)) {
			redirectedRef.current = true;
			navigate("/chat", {
				state: {
					notice: {
						type: "error",
						title: "Call link missing",
						message:
							"You were redirected because this page needs a valid call id. Please start a call from the chat page.",
					},
				},
			});
		}
	}, [callId, navigate]);

	const loadCallDetails = useCallback(async () => {
		const token = getToken();
		if (!(token && callId)) {
			return;
		}
		try {
			const details = await apiRequest(`/calls/${callId}`, { token });
			setCallDetails(details);
		} catch {
			if (!redirectedRef.current) {
				redirectedRef.current = true;
				navigate("/chat", {
					state: {
						notice: {
							type: "error",
							title: "Call not available",
							message:
								"You were redirected because the call id is invalid or you no longer have access.",
						},
					},
				});
			}
		}
	}, [callId, navigate]);

	const startCallIfNeeded = useCallback(async () => {
		const token = getToken();
		if (!(token && callId)) {
			return;
		}
		try {
			await apiRequest(`/calls/${callId}/start`, { method: "POST", token });
			if (effectiveMatchId) {
				const journey = await apiRequest("/workflow/journeys", {
					method: "POST",
					token,
					body: { match_id: effectiveMatchId, initial_state: "discovered" },
				});
				if (journey?.id) {
					await apiRequest(`/workflow/journeys/${encodeURIComponent(journey.id)}/transition`, {
						method: "POST",
						token,
						body: { to_state: "negotiating", event_type: "call_joined" },
					});
				}
			}
		} catch {
			// no-op
		}
	}, [callId, effectiveMatchId]);

	const loadParticipants = useCallback(async () => {
		const token = getToken();
		if (!(token && callDetails?.participant_ids?.length > 0)) {
			return;
		}
		const data = await apiRequest("/users/lookup", {
			method: "POST",
			token,
			body: { ids: callDetails.participant_ids },
		});
		setParticipants(data?.users || []);
	}, [callDetails]);

	const loadChatMessages = useCallback(async () => {
		const token = getToken();
		if (!(token && effectiveMatchId)) {
			return;
		}
		const data = await apiRequest(`/messages/${effectiveMatchId}`, { token });
		setChatMessages(Array.isArray(data) ? data : []);
	}, [effectiveMatchId]);

	const loadIceServers = useCallback(
		async (token) => {
			if (!(token && callId)) {
				return ICE_SERVERS;
			}
			try {
				const data = await apiRequest(`/calls/${callId}/ice`, { token });
				const servers = Array.isArray(data?.iceServers) ? data.iceServers : [];
				if (servers.length > 0) {
					return servers;
				}
			} catch {
				// fallback to VITE_ICE_SERVERS / STUN-only
			}
			return ICE_SERVERS;
		},
		[callId],
	);

	const joinChatRoom = useCallback((matchToJoin) => {
		const matchToJoinId = String(matchToJoin || "").trim();
		if (!matchToJoinId) {
			return false;
		}

		const ws = wsRef.current;
		if (!ws || ws.readyState !== WebSocket.OPEN) {
			return false;
		}

		const token = tokenRef.current || getToken();
		if (!token) {
			return false;
		}

		chatRoomMatchIdRef.current = matchToJoinId;
		chatInitializedRef.current = false;
		if (mountedRef.current) {
			setIsChatLive(false);
		}

		try {
			ws.send(
				JSON.stringify({
					type: "join_chat_room",
					match_id: matchToJoinId,
					token,
				}),
			);
			return true;
		} catch {
			return false;
		}
	}, []);

	const pushToast = useCallback((message, tone = "info") => {
		const safeMessage = String(message || "").trim();
		if (!safeMessage) {
			return;
		}
		if (!mountedRef.current) {
			return;
		}

		setToast({ message: safeMessage, tone });
		if (toastTimerRef.current && typeof window !== "undefined") {
			window.clearTimeout(toastTimerRef.current);
		}
		if (typeof window !== "undefined") {
			toastTimerRef.current = window.setTimeout(() => {
				if (mountedRef.current) {
					setToast(null);
				}
			}, 2200);
		}
	}, []);

	const reconnectCall = useCallback(() => {
		offerSentRef.current = false;
		shouldOfferRef.current = false;
		pendingRemoteOfferRef.current = null;
		pendingCandidatesRef.current = [];

		if (mountedRef.current) {
			setStatusMessage("Reconnecting...");
			setHasRemoteStream(false);
			setIsChatLive(false);
			setWsStatus("connecting");
			setRtcConnectionState("new");
			setRtcIceState("new");
		}

		remoteStreamRef.current = null;
		if (remoteVideoRef.current) {
			remoteVideoRef.current.srcObject = null;
		}

		try {
			peerConnectionRef.current?.close?.();
		} catch {
			// ignore
		}
		peerConnectionRef.current = null;

		try {
			wsRef.current?.close?.();
		} catch {
			// ignore
		}

		setReconnectNonce((value) => value + 1);
	}, []);

	const copyCallLink = useCallback(async () => {
		try {
			await navigator.clipboard.writeText(window.location.href);
			pushToast("Call link copied.", "success");
		} catch {
			pushToast("Unable to copy call link.", "error");
		}
	}, [pushToast]);

	const requestMediaPermissions = useCallback(() => {
		if (mountedRef.current) {
			setMediaGate(null);
		}
		ensureLocalStream()
			.then(() => pushToast("Camera & microphone ready.", "success"))
			.catch(() => pushToast("Please allow camera & microphone for calls.", "error"));
	}, [ensureLocalStream, pushToast]);

	useEffect(() => {
		mountedRef.current = true;
		// eslint-disable-next-line react-hooks/set-state-in-effect
		setPageLoading(false);
		return () => {
			mountedRef.current = false;
			if (toastTimerRef.current && typeof window !== "undefined") {
				window.clearTimeout(toastTimerRef.current);
			}
			if (audioRafRef.current && typeof window !== "undefined") {
				window.cancelAnimationFrame(audioRafRef.current);
			}
			if (audioContextRef.current) {
				audioContextRef.current.close?.().catch?.(() => {});
			}
		};
	}, []);

	useEffect(() => {
		hasLocalStreamRef.current = Boolean(hasLocalStream);
	}, [hasLocalStream]);

	useEffect(() => {
		isMutedRef.current = Boolean(isMuted);
	}, [isMuted]);

	useEffect(() => {
		mediaGateRef.current = mediaGate;
	}, [mediaGate]);

	useEffect(() => {
		isChatOpenRef.current = Boolean(isChatOpen);
		if (isChatOpen) {
			// eslint-disable-next-line react-hooks/set-state-in-effect
			setUnreadChatCount(0);
		}
	}, [isChatOpen]);

	useEffect(() => {
		if (!isChatOpen) {
			return;
		}
		if (typeof window === "undefined") {
			return;
		}
		window.requestAnimationFrame(() => {
			chatEndRef.current?.scrollIntoView?.({ behavior: "auto", block: "end" });
		});
	}, [isChatOpen]);

	useEffect(() => {
		// eslint-disable-next-line react-hooks/set-state-in-effect
		loadCallDetails();
	}, [loadCallDetails]);
	useEffect(() => {
		startCallIfNeeded();
	}, [startCallIfNeeded]);
	useEffect(() => {
		// eslint-disable-next-line react-hooks/set-state-in-effect
		loadParticipants();
	}, [loadParticipants]);
	useEffect(() => {
		// eslint-disable-next-line react-hooks/set-state-in-effect
		loadChatMessages();
	}, [loadChatMessages]);

	useEffect(() => {
		if (!effectiveMatchId) {
			return;
		}
		joinChatRoom(effectiveMatchId);
	}, [effectiveMatchId, joinChatRoom]);

	useEffect(() => {
		if (sortedChatMessages.length === 0) {
			return;
		}

		const last = sortedChatMessages.at(-1);
		const lastIsOwn = last?.sender_id === user?.id;
		const firstLoad = !chatInitializedRef.current;

		const scrollEl = chatScrollRef.current;
		const distanceFromBottom = scrollEl
			? scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight
			: 0;
		const nearBottom = distanceFromBottom < 140;

		const shouldAutoScroll = firstLoad || (isChatOpenRef.current && (lastIsOwn || nearBottom));
		if (firstLoad) {
			chatInitializedRef.current = true;
		}

		if (shouldAutoScroll) {
			setUnreadChatCount(0);
			chatEndRef.current?.scrollIntoView?.({
				behavior: firstLoad ? "auto" : "smooth",
				block: "end",
			});
			return;
		}

		if (!(firstLoad || lastIsOwn || isChatOpenRef.current)) {
			setUnreadChatCount((count) => count + 1);
		}
	}, [sortedChatMessages, user?.id]);

	useEffect(() => {
		if (isChatOpen) {
			return;
		}
		// eslint-disable-next-line react-hooks/set-state-in-effect
		if (isEmojiOpen) {
			setIsEmojiOpen(false);
		}
		if (isMoreOpen) {
			setIsMoreOpen(false);
		}
	}, [isChatOpen, isEmojiOpen, isMoreOpen]);

	useEffect(() => {
		if (!(isEmojiOpen || isMoreOpen)) {
			return;
		}

		const handleKeyDown = (event) => {
			if (event.key !== "Escape") {
				return;
			}
			setIsEmojiOpen(false);
			setIsMoreOpen(false);
		};

		const handleMouseDown = (event) => {
			const target = event.target;
			if (isEmojiOpen && emojiPopoverRef.current?.contains(target)) {
				return;
			}
			if (isMoreOpen && morePopoverRef.current?.contains(target)) {
				return;
			}
			setIsEmojiOpen(false);
			setIsMoreOpen(false);
		};

		document.addEventListener("keydown", handleKeyDown);
		document.addEventListener("mousedown", handleMouseDown);
		return () => {
			document.removeEventListener("keydown", handleKeyDown);
			document.removeEventListener("mousedown", handleMouseDown);
		};
	}, [isEmojiOpen, isMoreOpen]);

	useEffect(() => {
		if (!hasLocalStream) {
			// eslint-disable-next-line react-hooks/set-state-in-effect
			setMicLevel(0);
			return;
		}

		if (typeof window === "undefined") {
			return;
		}
		const stream = localStreamRef.current;
		const audioTrack = stream?.getAudioTracks?.()[0] || null;
		if (!audioTrack) {
			setMicLevel(0);
			return;
		}

		const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
		if (!AudioContextCtor) {
			return;
		}

		let cancelled = false;
		let ctx = null;
		let analyser = null;
		let source = null;
		let smoothing = 0;
		let lastUiUpdateAt = 0;

		try {
			ctx = new AudioContextCtor();
			audioContextRef.current = ctx;
			analyser = ctx.createAnalyser();
			analyser.fftSize = 512;
			source = ctx.createMediaStreamSource(new MediaStream([audioTrack]));
			source.connect(analyser);
		} catch {
			setMicLevel(0);
			return;
		}

		const data = new Uint8Array(analyser.fftSize);

		const tick = (timestamp) => {
			if (cancelled) {
				return;
			}
			try {
				analyser.getByteTimeDomainData(data);
				let sum = 0;
				for (let i = 0; i < data.length; i++) {
					const v = (data[i] - 128) / 128;
					sum += v * v;
				}
				const rms = Math.sqrt(sum / data.length);
				const level = Math.min(1, rms * 3.2);
				smoothing = smoothing * 0.82 + level * 0.18;

				if (mountedRef.current && timestamp - lastUiUpdateAt > 90) {
					lastUiUpdateAt = timestamp;
					setMicLevel(isMutedRef.current ? 0 : Number(smoothing.toFixed(3)));
				}
			} catch {
				// ignore
			}
			audioRafRef.current = window.requestAnimationFrame(tick);
		};

		audioRafRef.current = window.requestAnimationFrame(tick);
		ctx.resume?.().catch?.(() => {});

		return () => {
			cancelled = true;
			if (audioRafRef.current && typeof window !== "undefined") {
				window.cancelAnimationFrame(audioRafRef.current);
			}
			try {
				source?.disconnect?.();
			} catch {
				/* ignore */
			}
			try {
				analyser?.disconnect?.();
			} catch {
				/* ignore */
			}
			try {
				ctx?.close?.();
			} catch {
				/* ignore */
			}
			audioContextRef.current = null;
			if (mountedRef.current) {
				setMicLevel(0);
			}
		};
	}, [hasLocalStream]);

	useEffect(() => {
		let active = true;
		async function initPermissions() {
			if (!active) {
				return;
			}

			if (!window.isSecureContext) {
				if (mountedRef.current) {
					setMediaGate(buildMediaGate(new Error("insecure_context")));
					setHasLocalStream(false);
				}
				return;
			}

			if (!navigator?.permissions?.query) {
				ensureLocalStream().catch(() => logger.warn("No permissions API, stream attempt failed"));
				return;
			}

			try {
				const [cam, mic] = await Promise.all([
					navigator.permissions.query({ name: "camera" }),
					navigator.permissions.query({ name: "microphone" }),
				]);

				const state = [cam?.state, mic?.state];
				if (state.includes("denied")) {
					if (mountedRef.current) {
						setMediaGate(buildMediaGate({ name: "NotAllowedError" }));
						setHasLocalStream(false);
					}
					return;
				}

				if (state.includes("prompt")) {
					if (mountedRef.current) {
						setMediaGate({
							title: "Enable camera & microphone",
							message:
								'Click "Allow access" to let this page use your camera/microphone for the call.',
							actionLabel: "Allow access",
						});
						setHasLocalStream(false);
					}
					return;
				}

				ensureLocalStream().catch(() => logger.warn("Permission-granted stream request failed"));
			} catch {
				ensureLocalStream().catch(() => logger.warn("Exception during stream request"));
			}
		}

		initPermissions();
		return () => {
			active = false;
			if (localStreamRef.current) {
				localStreamRef.current.getTracks().forEach((track) => track.stop());
			}
			if (mountedRef.current) {
				setHasLocalStream(false);
			}
		};
	}, [ensureLocalStream, buildMediaGate]);

	useEffect(() => {
		if (!hasLocalStream) {
			return;
		}
		tryAnswerPendingOffer().catch(() => logger.warn("Failed to answer pending offer"));
		tryStartOffer().catch(() => logger.warn("Failed to start offer"));
	}, [hasLocalStream, tryAnswerPendingOffer, tryStartOffer]);

	useEffect(() => {
		const token = getToken();
		if (!(token && callId)) {
			return;
		}
		tokenRef.current = token;

		let active = true;
		const safeSetStatus = (message) => {
			if (!(active && mountedRef.current)) {
				return;
			}
			setStatusMessage(message);
		};
		const safeSetWsStatus = (next) => {
			if (!(active && mountedRef.current)) {
				return;
			}
			setWsStatus(next);
		};
		const safeSetRemoteStream = (value) => {
			if (!(active && mountedRef.current)) {
				return;
			}
			setHasRemoteStream(value);
		};

		let ws = null;

		async function connect() {
			safeSetStatus("Fetching ICE servers...");
			const resolvedIceServers = await loadIceServers(token);
			iceServersRef.current = resolvedIceServers;
			if (!active) {
				return;
			}

			safeSetWsStatus("connecting");
			ws = new WebSocket(WS_BASE);
			wsRef.current = ws;
			safeSetStatus("Connecting to call server...");

			const sendSignal = (payload) => {
				if (ws.readyState !== WebSocket.OPEN) {
					return;
				}
				ws.send(JSON.stringify(payload));
			};

			ws.onopen = () => {
				safeSetWsStatus("online");
				safeSetStatus("Joining call...");
				sendSignal({
					type: "join_call_room",
					call_id: callId,
					token,
					participant_id: participantId,
				});
				const chatToJoin = chatRoomMatchIdRef.current || matchId;
				if (chatToJoin) {
					joinChatRoom(chatToJoin);
				}
			};

			ws.onmessage = async (event) => {
				let payload;
				try {
					payload = JSON.parse(String(event.data || ""));
				} catch {
					return;
				}

				if (payload.type === "call_error") {
					safeSetStatus(payload.error || "Unable to join call room.");
					return;
				}

				if (payload.type === "joined_call_room") {
					safeSetStatus(
						payload.should_offer
							? "Participant found. Starting call..."
							: "Waiting for participant to join...",
					);
					shouldOfferRef.current = Boolean(payload.should_offer);
					offerSentRef.current = false;
					createPeerConnection(token);
					if (payload.should_offer) {
						if (!hasLocalStreamRef.current) {
							safeSetStatus("Allow camera/mic access to start the call.");
							if (!mediaGateRef.current && mountedRef.current) {
								setMediaGate({
									title: "Enable camera & microphone",
									message: 'Click "Allow access" to start the call.',
									actionLabel: "Allow access",
								});
							}
							return;
						}

						tryStartOffer().catch((error) => {
							safeSetStatus(`Unable to start call: ${error?.message || "offer failed"}`);
						});
					}
					return;
				}

				if (payload.type === "participant_joined") {
					safeSetStatus("Participant joined. Connecting...");
					createPeerConnection(token);
					return;
				}

				if (payload.type === "joined_chat_room") {
					const history = Array.isArray(payload.messages) ? [...payload.messages] : [];
					history.sort(
						(a, b) => new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime(),
					);
					chatInitializedRef.current = false;
					if (payload.match_id) {
						chatRoomMatchIdRef.current = String(payload.match_id);
					}
					setChatMessages(history);
					setIsChatLive(true);
					return;
				}

				if (payload.type === "chat_message") {
					const incoming = payload.message;
					if (!incoming?.id) {
						return;
					}
					setIsChatLive(true);
					setChatMessages((previous) => {
						if (previous.some((msg) => msg.id === incoming.id)) {
							return previous;
						}
						return [...previous, incoming];
					});
					return;
				}

				if (payload.type === "chat_error") {
					safeSetStatus(payload.error || "Chat error.");
					return;
				}

				if (payload.type === "webrtc_signal" && payload.signal) {
					const pc = createPeerConnection(token);
					const signal = payload.signal;
					if (signal.type === "offer") {
						if (!signal.sdp) {
							safeSetStatus("Offer handling failed: Missing offer SDP");
							return;
						}

						if (!hasLocalStreamRef.current) {
							pendingRemoteOfferRef.current = signal.sdp;
							safeSetStatus("Incoming call. Allow camera/mic to answer...");
							if (!mediaGateRef.current && mountedRef.current) {
								setMediaGate({
									title: "Enable camera & microphone",
									message: 'Click "Allow access" to answer the call.',
									actionLabel: "Allow access",
								});
							}
							return;
						}

						try {
							safeSetStatus("Offer received. Sending answer...");
							await pc.setRemoteDescription(signal.sdp);
							const answer = await pc.createAnswer();
							await pc.setLocalDescription(answer);
							sendSignal({
								type: "webrtc_signal",
								call_id: callId,
								token,
								signal: {
									type: "answer",
									sdp: toSessionDescriptionInit(pc.localDescription) || answer,
								},
							});
							safeSetStatus("Answer sent. Connecting...");

							const pending = pendingCandidatesRef.current;
							pendingCandidatesRef.current = [];
							for (const queued of pending) {
								try {
									await pc.addIceCandidate(queued);
								} catch {
									// ignore candidate errors
								}
							}
						} catch (error) {
							safeSetStatus(`Offer handling failed: ${error?.message || "unknown error"}`);
						}
					} else if (signal.type === "answer") {
						try {
							safeSetStatus("Answer received. Connecting...");
							if (!signal.sdp) {
								throw new Error("Missing answer SDP");
							}
							await pc.setRemoteDescription(signal.sdp);

							const pending = pendingCandidatesRef.current;
							pendingCandidatesRef.current = [];
							for (const queued of pending) {
								try {
									await pc.addIceCandidate(queued);
								} catch {
									// ignore candidate errors
								}
							}
						} catch (error) {
							safeSetStatus(`Answer handling failed: ${error?.message || "unknown error"}`);
						}
					} else if (signal.type === "candidate") {
						try {
							const candidate = signal.candidate;
							if (pc.remoteDescription?.type) {
								await pc.addIceCandidate(candidate);
							} else {
								pendingCandidatesRef.current.push(candidate);
							}
						} catch {
							// ignore candidate errors
						}
					}
				}

				if (payload.type === "participant_left") {
					safeSetStatus("Participant left the call.");
					safeSetRemoteStream(false);
					remoteStreamRef.current = null;
					if (remoteVideoRef.current) {
						remoteVideoRef.current.srcObject = null;
					}
				}
			};

			ws.onerror = () => {
				safeSetWsStatus("error");
				safeSetStatus("Unable to reach call server.");
			};

			ws.onclose = () => {
				safeSetWsStatus("offline");
				safeSetStatus("Call server disconnected.");
				if (mountedRef.current) {
					setIsChatLive(false);
				}
				safeSetRemoteStream(false);
				remoteStreamRef.current = null;
				if (remoteVideoRef.current) {
					remoteVideoRef.current.srcObject = null;
				}
				if (peerConnectionRef.current) {
					peerConnectionRef.current.close();
					peerConnectionRef.current = null;
				}
				if (mountedRef.current) {
					setRtcConnectionState("new");
					setRtcIceState("new");
				}
				if (active && mountedRef.current) {
					reconnectTimerRef.current = window.setTimeout(() => {
						reconnectTimerRef.current = null;
						setReconnectNonce((n) => n + 1);
					}, 30_000);
				}
			};
		}

		connect().catch(() => {
			safeSetStatus("Unable to start call signaling.");
		});

		return () => {
			active = false;
			if (reconnectTimerRef.current) {
				window.clearTimeout(reconnectTimerRef.current);
				reconnectTimerRef.current = null;
			}
			if (ws) {
				ws.onopen = null;
				ws.onmessage = null;
				ws.onerror = null;
				ws.onclose = null;
				ws.close();
			}
		};
	}, [
		callId,
		matchId,
		participantId,
		createPeerConnection,
		joinChatRoom,
		loadIceServers,
		tryStartOffer,
		toSessionDescriptionInit,
	]);

	useEffect(() => {
		const startedAt = callDetails?.started_at || callDetails?.created_at;
		if (!startedAt) {
			return;
		}
		const startMs = new Date(startedAt).getTime();
		const interval = setInterval(() => {
			const elapsed = Math.max(0, Date.now() - startMs);
			const totalSeconds = Math.floor(elapsed / 1000);
			const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
			const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
			const seconds = String(totalSeconds % 60).padStart(2, "0");
			setTimer(`${hours}:${minutes}:${seconds}`);
		}, 1000);
		return () => clearInterval(interval);
	}, [callDetails]);

	useEffect(() => {
		const handleFullscreenChange = () => {
			setIsFullscreen(Boolean(document.fullscreenElement));
		};

		document.addEventListener("fullscreenchange", handleFullscreenChange);
		return () => {
			document.removeEventListener("fullscreenchange", handleFullscreenChange);
		};
	}, []);

	const toggleMute = () => {
		setIsMuted((prev) => {
			const next = !prev;
			if (localStreamRef.current) {
				localStreamRef.current.getAudioTracks().forEach((track) => {
					track.enabled = !next;
				});
			}
			return next;
		});
	};

	const toggleSpeaker = () => {
		setIsSpeakerMuted((prev) => {
			const next = !prev;
			if (remoteVideoRef.current) {
				remoteVideoRef.current.muted = next;
				if (!next) {
					const playAttempt = remoteVideoRef.current.play?.();
					if (playAttempt && typeof playAttempt.catch === "function") {
						playAttempt.catch(() => logger.warn("Remote video play after unmute failed"));
					}
				}
			}
			return next;
		});
	};

	const toggleCamera = () => {
		setIsCameraOn((prev) => {
			const next = !prev;
			if (localStreamRef.current) {
				localStreamRef.current.getVideoTracks().forEach((track) => {
					track.enabled = !next;
				});
			}
			return next;
		});
	};

	const toggleFullscreen = async () => {
		try {
			if (document.fullscreenElement) {
				await document.exitFullscreen?.();
				return;
			}
			await stageRef.current?.requestFullscreen?.();
		} catch {
			// ignore
		}
	};

	const startCallRecording = useCallback(async () => {
		if (recordingState !== "idle") {
			return;
		}
		if (!callId) {
			return;
		}
		if (!hasLocalStreamRef.current) {
			return;
		}
		if (!remoteStreamRef.current) {
			return;
		}
		if (typeof MediaRecorder === "undefined") {
			setRecordingState("failed");
			return;
		}

		const localStream = localStreamRef.current;
		const remoteStream = remoteStreamRef.current;
		if (!(localStream && remoteStream)) {
			return;
		}

		try {
			const canvas = document.createElement("canvas");
			canvas.width = 1280;
			canvas.height = 720;
			const ctx = canvas.getContext("2d", { alpha: false });
			if (!ctx) {
				throw new Error("Canvas recording context not available");
			}

			const drawFrame = () => {
				ctx.fillStyle = "#000";
				ctx.fillRect(0, 0, canvas.width, canvas.height);

				const remoteVideo = remoteVideoRef.current;
				const localVideo = localVideoRef.current;

				const canDrawRemote = remoteVideo && remoteVideo.readyState >= 2;
				const canDrawLocal = localVideo && localVideo.readyState >= 2;

				if (canDrawRemote) {
					ctx.drawImage(remoteVideo, 0, 0, canvas.width, canvas.height);
				} else if (canDrawLocal) {
					ctx.drawImage(localVideo, 0, 0, canvas.width, canvas.height);
				}

				if (canDrawLocal && canDrawRemote) {
					const pad = 22;
					const pipW = Math.round(canvas.width * 0.28);
					const pipH = Math.round(canvas.height * 0.28);
					const x = canvas.width - pipW - pad;
					const y = canvas.height - pipH - pad;
					ctx.save();
					ctx.globalAlpha = 0.98;
					ctx.fillStyle = "rgba(0,0,0,0.25)";
					ctx.fillRect(x - 6, y - 6, pipW + 12, pipH + 12);
					ctx.drawImage(localVideo, x, y, pipW, pipH);
					ctx.strokeStyle = "rgba(255,255,255,0.18)";
					ctx.lineWidth = 2;
					ctx.strokeRect(x, y, pipW, pipH);
					ctx.restore();
				}

				recordingCleanupRef.current.raf = window.requestAnimationFrame(drawFrame);
			};

			const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
			const dest = audioCtx.createMediaStreamDestination();

			const connectStreamAudio = (stream) => {
				const hasAudio = stream.getAudioTracks().length > 0;
				if (!hasAudio) {
					return;
				}
				const source = audioCtx.createMediaStreamSource(stream);
				source.connect(dest);
			};

			connectStreamAudio(localStream);
			connectStreamAudio(remoteStream);

			const canvasStream = canvas.captureStream(30);
			const mixedStream = new MediaStream([
				...canvasStream.getVideoTracks(),
				...dest.stream.getAudioTracks(),
			]);

			const supported = [
				"video/webm;codecs=vp8,opus",
				"video/webm;codecs=vp9,opus",
				"video/webm",
			].find((mime) => {
				try {
					return MediaRecorder.isTypeSupported(mime);
				} catch {
					return false;
				}
			});

			const recorder = new MediaRecorder(
				mixedStream,
				supported ? { mimeType: supported } : undefined,
			);
			recordingChunksRef.current = [];

			recorder.ondataavailable = (event) => {
				if (event.data && event.data.size > 0) {
					recordingChunksRef.current.push(event.data);
				}
			};

			recorder.onerror = () => {
				setRecordingState("failed");
			};

			recordingCleanupRef.current = {
				raf: null,
				stop: () => {
					try {
						if (recordingCleanupRef.current?.raf) {
							window.cancelAnimationFrame(recordingCleanupRef.current.raf);
						}
					} catch {
						// ignore
					}
					try {
						audioCtx.close?.();
					} catch {
						// ignore
					}
					try {
						mixedStream.getTracks().forEach((t) => t.stop());
					} catch {
						// ignore
					}
				},
			};

			drawFrame();
			recorder.start(1000);
			recorderRef.current = recorder;
			setRecordingState("recording");
		} catch (err) {
			setRecordingState("failed");
			setToast({
				tone: "error",
				message: err?.message || "Recording could not be started.",
			});
		}
	}, [callId, recordingState]);

	const stopRecordingAndUpload = useCallback(async () => {
		const token = getToken();
		if (!(token && callId)) {
			return;
		}
		const recorder = recorderRef.current;
		if (!recorder || recorder.state === "inactive") {
			return;
		}

		setRecordingState("uploading");

		const stopped = new Promise((resolve) => {
			recorder.onstop = () => resolve(true);
		});

		try {
			recorder.stop();
		} catch {
			// ignore
		}

		await stopped;

		try {
			recordingCleanupRef.current?.stop?.();
		} catch {
			// ignore
		}

		const chunks = recordingChunksRef.current || [];
		const mimeType = recorder.mimeType || "video/webm";
		const blob = new Blob(chunks, { type: mimeType });

		recorderRef.current = null;
		recordingChunksRef.current = [];

		try {
			setRecordingUploadProgress(0);
			const data = await uploadFile(`/calls/${encodeURIComponent(callId)}/recording/upload`, {
				file: new File([blob], `call-${callId}.webm`, { type: mimeType }),
				token,
				onProgress: setRecordingUploadProgress,
			});

			setRecordingState("available");
			setToast({ tone: "success", message: "Call recording saved securely." });
		} catch (err) {
			setRecordingState("failed");
			setToast({
				tone: "error",
				message: err?.message || "Recording upload failed.",
			});
		}
	}, [callId]);

	useEffect(() => {
		if (recordingState !== "idle") {
			return;
		}
		if (rtcConnectionState !== "connected") {
			return;
		}
		if (!(hasLocalStream && hasRemoteStream)) {
			return;
		}
		// eslint-disable-next-line react-hooks/set-state-in-effect
		startCallRecording();
	}, [hasLocalStream, hasRemoteStream, recordingState, rtcConnectionState, startCallRecording]);

	const endCall = async () => {
		const token = getToken();
		if (token && callId) {
			try {
				await apiRequest(`/calls/${callId}/end`, { method: "POST", token });
				if (effectiveMatchId) {
					const journey = await apiRequest(
						`/workflow/journeys/by-match/${encodeURIComponent(effectiveMatchId)}`,
						{ token },
					);
					if (journey?.id) {
						await apiRequest(`/workflow/journeys/${encodeURIComponent(journey.id)}/transition`, {
							method: "POST",
							token,
							body: { to_state: "negotiating", event_type: "call_ended" },
						});
					}
				}
			} catch {
				// ignore
			}
		}

		if (callId) {
			trackClientEvent("call_end", {
				entityType: "call_session",
				entityId: callId,
				metadata: { match_id: effectiveMatchId || "" },
			});
		}

		try {
			await stopRecordingAndUpload();
		} catch {
			// ignore
		}
		navigate("/chat");
	};

	const sendChatMessage = async () => {
		setIsEmojiOpen(false);
		const token = getToken();
		const content = chatDraft.trim();
		const threadId = effectiveMatchId || matchId;
		if (!(token && content && threadId)) {
			return;
		}
		try {
			if (
				isChatLive &&
				wsRef.current &&
				wsRef.current.readyState === WebSocket.OPEN &&
				chatRoomMatchIdRef.current === threadId
			) {
				wsRef.current.send(
					JSON.stringify({
						type: "chat_message",
						match_id: threadId,
						token,
						message: content,
						message_type: "text",
					}),
				);
			} else {
				const created = await apiRequest(`/messages/${threadId}`, {
					method: "POST",
					token,
					body: { message: content, type: "text" },
				});
				setChatMessages((prev) => [...prev, created]);
			}
			setChatDraft("");
		} catch (err) {
			setStatusMessage(err?.message || "Unable to send message");
		}
	};

	const conn = connectionBadge;

	if (pageLoading) {
		return <NeonAtom fill={true} timeout={10000} />;
	}

	return (
		<div className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(109,171,223,0.30),transparent_28%),radial-gradient(circle_at_top_right,rgba(28,83,129,0.22),transparent_30%),linear-gradient(180deg,#f8fbff_0%,#eef6ff_42%,#e7f1ff_100%)] text-slate-900 transition-colors dark:bg-[radial-gradient(circle_at_top_left,rgba(51,122,176,0.20),transparent_28%),radial-gradient(circle_at_top_right,rgba(55,115,168,0.18),transparent_30%),linear-gradient(180deg,#020617_0%,#07111f_45%,#0b1728_100%)] dark:text-white">
			<ToastStack
				toasts={toastQueue}
				onDismiss={(id) => setToastQueue((prev) => prev.filter((t) => t.id !== id))}
			/>

			<div ref={stageRef} className="relative flex min-h-screen flex-col">
				<div className="pointer-events-none absolute inset-0 opacity-70">
					<div className="absolute left-[-10%] top-[-10%] h-72 w-72 rounded-full bg-sky-400/20 blur-3xl dark:bg-sky-500/10" />
					<div className="absolute right-[-8%] top-[12%] h-80 w-80 rounded-full bg-blue-500/20 blur-3xl dark:bg-blue-500/10" />
					<div className="absolute bottom-[-18%] left-[22%] h-80 w-80 rounded-full bg-cyan-400/20 blur-3xl dark:bg-cyan-400/10" />
				</div>

				<header className="relative z-20 border-b border-white/12 bg-white/45 backdrop-blur-xl dark:bg-slate-950/50">
					<div className="mx-auto flex max-w-[1800px] items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
						<div className="flex min-w-0 items-center gap-3">
							<button
								type="button"
								onClick={() => navigate(-1)}
								className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-slate-800 ring-1 ring-white/10 hover:bg-white/15 dark:text-white"
							>
								<ArrowLeft className="h-5 w-5" />
							</button>
							<div className="min-w-0">
								<div className="flex flex-wrap items-center gap-2">
									<h1 className="truncate text-lg font-extrabold tracking-tight sm:text-xl">
										Live Call
									</h1>
									<Badge tone={conn.tone} className="gap-1.5">
										<span
											className={cx(
												"h-2 w-2 rounded-full bg-current",
												conn.pulse && "animate-pulse",
											)}
										/>
										{conn.label}
									</Badge>
									<Badge
										tone={
											recordingState === "recording"
												? "rose"
												: recordingState === "uploading"
													? "amber"
													: recordingState === "available"
														? "emerald"
														: recordingState === "failed"
															? "rose"
															: "neutral"
										}
									>
										<Radio className="h-3.5 w-3.5" /> {recordingLabel}
									</Badge>
									{recordingState === "uploading" && (
										<UploadProgressBar progress={recordingUploadProgress} className="w-24" />
									)}
								</div>
								<div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
									<span className="inline-flex items-center gap-1.5">
										<Clock3 className="h-3.5 w-3.5" />
										{timer}
									</span>
									<span className="hidden sm:inline">•</span>
									<span className="truncate">{statusMessage}</span>
								</div>
							</div>
						</div>

						<div className="flex items-center gap-2">
							<button
								type="button"
								onClick={() => setIsEmojiOpen((prev) => !prev)}
								className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-slate-800 ring-1 ring-white/10 hover:bg-white/15 dark:text-white lg:hidden"
								title="Emoji"
							>
								<Smile className="h-5 w-5" />
							</button>
							<Badge tone={conn.tone}>{conn.label}</Badge>
						</div>
					</div>
				</header>

				<main className="relative z-10 mx-auto flex w-full max-w-[1800px] flex-1 gap-4 px-4 py-4 sm:px-6 lg:px-8">
					<section
						className={cx("flex min-w-0 flex-1 flex-col gap-4", isChatOpen ? "lg:pr-0" : "")}
					>
						<div className="grid gap-4 xl:grid-cols-[1.18fr_0.82fr]">
							<div className="rounded-[2rem] border border-white/12 bg-white/40 p-4 shadow-[0_25px_80px_rgba(15,23,42,0.12)] backdrop-blur-2xl dark:bg-slate-950/50">
								<div className="flex flex-wrap items-center justify-between gap-3">
									<div>
										<div className="flex flex-wrap items-center gap-2">
											<h2 className="text-base font-bold text-slate-900 dark:text-white">
												{remoteName}
											</h2>
											<Badge tone="sky">{localName}</Badge>
											{isSpeaking ? (
												<Badge tone="emerald">Speaking</Badge>
											) : (
												<Badge tone="neutral">Listening</Badge>
											)}
										</div>
										<p className="mt-1 text-sm text-slate-500 dark:text-slate-300">
											{statusMessage || "Live call in progress."}
										</p>
									</div>
									<div className="flex items-center gap-2">
										<MiniStat
											label="Mic level"
											value={`${Math.round(micLevel * 100)}%`}
											icon={Mic}
										/>
										<MiniStat
											label="Participants"
											value={String(Math.max(1, participants.length || 0))}
											icon={MessageSquare}
										/>
									</div>
								</div>

								<div className="mt-4 grid gap-4 xl:grid-cols-[1.6fr_0.9fr]">
									<div className="relative overflow-hidden rounded-[2rem] border border-white/12 bg-slate-950 shadow-2xl shadow-slate-950/20">
										<div className="absolute left-4 top-4 z-10 flex items-center gap-2">
											<Badge tone="sky">{statusMessage || "Live call in progress."}</Badge>
											{recordingState === "recording" ? <Badge tone="rose">REC</Badge> : null}
										</div>
										<div className="absolute right-4 top-4 z-10 flex gap-2">
											<IconButton
												icon={isFullscreen ? ChevronDown : Maximize}
												label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
												onClick={toggleFullscreen}
												tone="default"
											/>
										</div>

										<div className="relative aspect-[16/10] w-full bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950">
											<video
												ref={remoteVideoRef}
												autoPlay={true}
												playsInline={true}
												muted={isSpeakerMuted}
												className="absolute inset-0 h-full w-full object-cover"
											/>

											<div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/90 via-slate-950/40 to-transparent p-4 text-white">
												<div className="flex flex-wrap items-center justify-between gap-3">
													<div className="min-w-0">
														<div className="flex flex-wrap items-center gap-2">
															<span className="text-lg font-bold">{remoteName}</span>
															<span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium backdrop-blur">
																{rtcConnectionState}
															</span>
														</div>
														<div className="mt-1 max-w-2xl text-sm text-white/80">
															{statusMessage || "Call is ready."}
														</div>
													</div>
													<div className="flex items-center gap-2 text-white/80">
														<div className="flex h-9 items-end gap-1 rounded-2xl bg-white/10 px-3 py-2 ring-1 ring-white/10">
															{[0, 1, 2, 3, 4].map((i) => {
																const active = micLevel * 5 > i;
																return (
																	<span
																		key={i}
																		className={cx(
																			"w-1.5 rounded-full bg-sky-300 transition-all",
																			active ? "h-4" : "h-2 opacity-40",
																		)}
																	/>
																);
															})}
														</div>
														<span className="text-xs">Mic</span>
													</div>
												</div>
											</div>

											{mediaGate && !hasLocalStream ? (
												<MediaGate
													gate={mediaGate}
													onAction={async () => {
														if (!mediaGate) {
															return;
														}
														if (mediaGate.actionLabel === "Dismiss") {
															setMediaGate(null);
															return;
														}
														setMediaGate(null);
														await ensureLocalStream();
													}}
													onDismiss={() => setMediaGate(null)}
												/>
											) : null}
										</div>
									</div>

									<div className="grid gap-4">
										<div className="rounded-[2rem] border border-white/12 bg-white/70 p-4 shadow-xl backdrop-blur-xl dark:bg-slate-950/55">
											<div className="flex items-center justify-between gap-3">
												<div>
													<h3 className="text-sm font-bold text-slate-900 dark:text-white">
														Call controls
													</h3>
													<p className="text-xs text-slate-500 dark:text-slate-400">
														Mic, camera, speaker, screen.
													</p>
												</div>
												<Badge tone={isCameraOn ? "emerald" : "amber"}>
													{isCameraOn ? "Camera on" : "Camera off"}
												</Badge>
											</div>

											<div className="mt-4 grid grid-cols-4 gap-3 sm:grid-cols-6 xl:grid-cols-3">
												<IconButton
													icon={PhoneOff}
													label="End call"
													onClick={endCall}
													tone="danger"
													className="col-span-2 sm:col-span-2 xl:col-span-3 w-full"
												/>
												<IconButton
													icon={isMuted ? MicOff : Mic}
													label={isMuted ? "Unmute mic" : "Mute mic"}
													onClick={toggleMute}
													active={!isMuted}
													tone="default"
												/>
												<IconButton
													icon={isSpeakerMuted ? VolumeX : Volume2}
													label={isSpeakerMuted ? "Unmute speaker" : "Mute speaker"}
													onClick={toggleSpeaker}
													active={!isSpeakerMuted}
													tone="default"
												/>
												<IconButton
													icon={isCameraOn ? Camera : CameraOff}
													label={isCameraOn ? "Camera off" : "Camera on"}
													onClick={toggleCamera}
													active={isCameraOn}
													tone="default"
												/>
												<IconButton
													icon={MessageSquare}
													label={isChatOpen ? "Hide chat" : "Show chat"}
													onClick={() => setIsChatOpen((v) => !v)}
													badge={
														!isChatOpen && unreadChatCount
															? unreadChatCount > 99
																? "99+"
																: String(unreadChatCount)
															: null
													}
													tone="primary"
												/>
												<IconButton
													icon={Ellipsis}
													label="More menu"
													onClick={() => setIsMoreOpen((prev) => !prev)}
													tone="default"
												/>
											</div>

											<div className="mt-4 grid gap-3 md:grid-cols-3">
												<MiniStat
													label="Connection"
													value={conn.label}
													icon={conn.pulse ? PulseSpinner : WifiOff}
												/>
												<MiniStat
													label="Chat"
													value={effectiveMatchId ? "Ready" : "Unavailable"}
													icon={MessageSquare}
												/>
												<MiniStat label="Recording" value={recordingLabel} icon={Radio} />
											</div>
										</div>

										<div className="rounded-[2rem] border border-white/12 bg-white/70 p-4 shadow-xl backdrop-blur-xl dark:bg-slate-950/55">
											<h3 className="text-sm font-bold text-slate-900 dark:text-white">Status</h3>
											<div className="mt-2 rounded-2xl border border-white/10 bg-white/60 p-3 text-sm text-slate-700 dark:bg-white/5 dark:text-slate-200">
												{statusMessage || "Live call in progress."}
											</div>
											<div className="mt-3 flex flex-wrap gap-2">
												{[
													"😀",
													"🤝",
													"🙏",
													"👏",
													"🎉",
													"🔥",
													"💯",
													"✅",
													"⚡",
													"💡",
													"📝",
													"📎",
													"🧠",
													"🚀",
													"❤️",
													"✨",
												].map((emoji) => (
													<button
														key={emoji}
														type="button"
														onClick={() => {
															setChatDraft((prev) => `${prev}${emoji}`);
															if (chatInputRef.current) {
																chatInputRef.current.focus();
															}
														}}
														className="rounded-xl border border-white/10 bg-white/70 px-3 py-2 text-base hover:bg-sky-50 dark:bg-white/5 dark:hover:bg-white/10"
													>
														{emoji}
													</button>
												))}
											</div>
										</div>

										<div className="rounded-[2rem] border border-white/12 bg-white/40 p-4 shadow-xl backdrop-blur-xl dark:bg-slate-950/50">
											<JourneyTimeline title="Journey Timeline" matchId={effectiveMatchId || ""} />
										</div>
									</div>
								</div>
							</div>

							<div className="grid gap-4">
								<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
									<MiniStat label="Call ID" value={callId || "\u2014"} icon={Circle} />
									<MiniStat
										label="Match ID"
										value={effectiveMatchId || "\u2014"}
										icon={CircleDot}
									/>
									<MiniStat label="Remote" value={remoteName} icon={CheckCircle2} />
									<MiniStat label="Local" value={localName} icon={CheckCircle2} />
								</div>
								<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
									<MiniStat
										label="WebSocket"
										value={wsStatus === "online" ? "Online" : wsStatus}
										icon={WifiOff}
									/>
									<MiniStat label="RTC" value={rtcConnectionState} icon={Radio} />
									<MiniStat
										label="Unread"
										value={unreadChatCount > 99 ? "99+" : String(unreadChatCount)}
										icon={MessageSquare}
									/>
									<MiniStat label="Mic level" value={`${Math.round(micLevel * 100)}%`} icon={Mic} />
								</div>
							</div>
						</div>
					</section>

					<aside
						className={cx(
							"fixed inset-y-0 right-0 z-30 w-full max-w-[420px] border-l border-white/12 bg-white/80 shadow-2xl backdrop-blur-2xl transition-transform duration-300 dark:bg-slate-950/85 lg:static lg:z-auto lg:translate-x-0 lg:rounded-[2rem] lg:border lg:border-white/12",
							isChatOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0",
						)}
					>
						<div className="flex h-full flex-col">
							<div className="flex items-center justify-between gap-3 border-b border-white/10 p-4">
								<div>
									<h3 className="text-base font-bold text-slate-900 dark:text-white">Chat</h3>
									<p className="text-xs text-slate-500 dark:text-slate-400">
										{effectiveMatchId ? "Connected to the call room" : "Waiting for match id"}
									</p>
								</div>
								<div className="flex items-center gap-2">
									<Badge tone={effectiveMatchId ? "emerald" : "rose"}>
										{effectiveMatchId ? "Live" : "Closed"}
									</Badge>
									<button
										onClick={() => setIsChatOpen(false)}
										className="rounded-xl border border-white/10 bg-white/60 p-2 text-slate-700 hover:bg-white/90 dark:bg-white/5 dark:text-slate-200 lg:hidden"
									>
										<X className="h-4 w-4" />
									</button>
								</div>
							</div>

							<div
								data-lenis-prevent={true}
								ref={chatScrollRef}
								className="flex-1 space-y-3 overflow-y-auto p-4"
							>
								{sortedChatMessages.length > 0 ? (
									sortedChatMessages.map((msg) => {
										const isOwn = msg.sender_id === user?.id;
										const sender = userMap.get(msg.sender_id);
										const senderName = msg.sender_name || sender?.name || sender?.email || "User";
										return (
											<div
												key={msg.id}
												className={cx(
													"max-w-[88%] rounded-2xl px-4 py-3 shadow-sm",
													isOwn
														? "ml-auto bg-gradient-to-r from-sky-500 to-blue-500 text-white"
														: "bg-white/70 text-slate-800 dark:bg-white/8 dark:text-slate-100",
												)}
											>
												<div className="flex items-center justify-between gap-3 text-[11px] font-semibold opacity-80">
													<span>{isOwn ? "You" : senderName}</span>
													<span>{formatMessageTime(msg.timestamp)}</span>
												</div>
												<div className="mt-1 whitespace-pre-wrap text-sm leading-6">
													<MarkdownMessage text={msg.message || ""} />
												</div>
											</div>
										);
									})
								) : (
									<div className="rounded-2xl border border-dashed border-slate-200 bg-white/40 p-5 text-sm text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
										No messages yet.
									</div>
								)}
								<div ref={chatEndRef} />
							</div>

							<div className="border-t border-white/10 p-4">
								<div className="relative flex items-center gap-2 rounded-2xl bg-white/70 p-2 shadow-sm ring-1 ring-slate-200/60 focus-within:ring-sky-500/30 dark:bg-white/5 dark:ring-white/10">
									<div ref={emojiPopoverRef} className="relative ml-1">
										<button
											type="button"
											onClick={() => {
												setIsEmojiOpen((prev) => !prev);
												setIsMoreOpen(false);
											}}
											className={cx(
												"flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-slate-200",
												isEmojiOpen ? "bg-slate-100 dark:bg-white/10" : "",
											)}
											title="Emoji"
										>
											<Smile size={20} />
										</button>

										{isEmojiOpen ? (
											<div className="absolute bottom-full left-0 z-50 mb-2 w-72 rounded-2xl bg-white/90 p-3 shadow-xl ring-1 ring-slate-200/60 backdrop-blur-xl dark:bg-slate-950/60 dark:ring-white/10">
												<div className="grid grid-cols-8 gap-1">
													{QUICK_EMOJIS.map((emoji) => (
														<button
															key={emoji}
															type="button"
															onClick={() => {
																setChatDraft((prev) => `${prev}${emoji}`);
																setIsEmojiOpen(false);
																chatInputRef.current?.focus?.();
															}}
															className="flex h-8 w-8 items-center justify-center rounded-xl text-lg transition hover:bg-slate-100 dark:hover:bg-white/10"
															title={`Insert ${emoji}`}
														>
															{emoji}
														</button>
													))}
												</div>
												<div className="mt-2 text-[11px] font-medium text-slate-500 dark:text-slate-300/70">
													Press Esc to close.
												</div>
											</div>
										) : null}
									</div>
									<input
										ref={chatInputRef}
										type="text"
										placeholder="Type here..."
										className="flex-1 bg-transparent px-1 text-sm text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-400/70"
										value={chatDraft}
										onChange={(e) => setChatDraft(e.target.value)}
										onKeyDown={(e) => {
											if (e.key === "Enter") {
												sendChatMessage();
											}
										}}
										onFocus={() => setIsEmojiOpen(false)}
									/>
									<button
										type="button"
										onClick={sendChatMessage}
										className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-r from-sky-500 to-blue-500 text-white shadow-lg shadow-sky-500/20 transition hover:from-sky-600 hover:to-blue-600 active:scale-95"
										title="Send"
									>
										<Send size={16} />
									</button>
								</div>
							</div>
						</div>
					</aside>
				</main>

				<div className="fixed bottom-4 left-4 z-40 flex flex-wrap gap-2" data-more-menu={true}>
					<div className="relative">
						{isMoreOpen ? (
							<div className="absolute bottom-14 left-0 w-72 overflow-hidden rounded-3xl border border-white/12 bg-white/95 p-2 shadow-2xl backdrop-blur-xl dark:bg-slate-950/95">
								<button
									onClick={() => {
										copyCallLink();
										setIsMoreOpen(false);
									}}
									className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-medium hover:bg-sky-50 dark:hover:bg-white/5"
								>
									<Copy className="h-4 w-4" /> Copy call link
								</button>
								<button
									onClick={() => {
										requestMediaPermissions();
										setIsMoreOpen(false);
									}}
									className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-medium hover:bg-sky-50 dark:hover:bg-white/5"
								>
									<Camera className="h-4 w-4" /> Request permissions
								</button>
								<button
									onClick={() => {
										reconnectCall();
										setIsMoreOpen(false);
									}}
									className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-medium hover:bg-sky-50 dark:hover:bg-white/5"
								>
									<RefreshCw className="h-4 w-4" /> Reconnect
								</button>
								<button
									onClick={() => {
										setIsChatOpen(false);
										setIsMoreOpen(false);
									}}
									className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-medium hover:bg-sky-50 dark:hover:bg-white/5"
								>
									<MessageSquare className="h-4 w-4" /> Hide chat
								</button>
							</div>
						) : null}
					</div>
				</div>
			</div>
		</div>
	);
}
