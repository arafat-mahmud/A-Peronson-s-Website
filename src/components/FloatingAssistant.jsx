import { motion, useReducedMotion, useSpring } from "framer-motion";
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { ThreeDot } from "react-loading-indicators";
import { useLocation } from "react-router-dom";
import useScrollDirection from "../hooks/useScrollDirection.js";
import { answerFaq, formatFaqAnswer } from "../../shared/assistant/faqEngine.js";
import { API_BASE, getCurrentUserAsync, getToken } from "../lib/auth.js";
import { logger } from "../lib/logger.js";
import BotLogo from "./ui/BotLogo.jsx";

// The markdown renderer (~100 KB) is only needed once the chat panel shows a reply.
const MarkdownMessage = lazy(() => import("./chat/MarkdownMessage.jsx"));

/**
 * @typedef {Object} SessionData
 * @property {Array} messages - The session messages.
 * @property {string|null} title - The session title.
 */

/**
 * Fetches session data from the API.
 *
 * @returns {Promise<SessionData>} The session data.
 */
async function fetchSessionData() {
	const token = getToken();
	if (!token) {
		return { messages: [], title: null };
	}
	try {
		const res = await fetch(`${API_BASE}/assistant/session-messages`, {
			headers: { Authorization: `Bearer ${token}` },
		});
		if (!res.ok) {
			logger.warn("[assistant] fetchSessionData non-ok", { status: res.status });
			return { messages: [], title: null };
		}
		const data = await res.json();
		return { messages: data.messages || [], title: data.title || null };
	} catch (err) {
		logger.warn("[assistant] fetchSessionData failed", { error: err.message });
		return { messages: [], title: null };
	}
}

/**
 * Deletes the current session.
 *
 * @returns {Promise<boolean>} Whether the session was deleted.
 */
async function deleteSessionAPI() {
	const token = getToken();
	if (!token) {
		return false;
	}
	try {
		const res = await fetch(`${API_BASE}/assistant/session`, {
			method: "DELETE",
			headers: { Authorization: `Bearer ${token}` },
		});
		if (!res.ok) {
			logger.warn("[assistant] deleteSessionAPI non-ok", { status: res.status });
			return false;
		}
		const data = await res.json();
		return data.ok;
	} catch (err) {
		logger.warn("[assistant] deleteSessionAPI failed", { error: err.message });
		return false;
	}
}

/**
 * Renders text with a typewriter effect.
 *
 * @param {Object} props
 * @param {string} props.text - The text to display.
 * @param {number} [props.speed=20] - The speed of the typewriter effect.
 * @param {Function} [props.onComplete] - Callback on completion.
 * @returns {JSX.Element} The rendered typewriter text.
 */
function TypewriterText({ text, speed = 20, onComplete }) {
	const [displayedText, setDisplayedText] = useState("");
	const [index, setIndex] = useState(0);

	useEffect(() => {
		if (text && index < text.length) {
			const timeout = setTimeout(() => {
				setDisplayedText((prev) => prev + text[index]);
				setIndex((prev) => prev + 1);
			}, speed);
			return () => clearTimeout(timeout);
		}
		if (onComplete) {
			onComplete();
		}
	}, [index, text, speed, onComplete]);

	return <span>{displayedText}</span>;
}

/**
 * Renders the floating assistant component.
 *
 * @returns {JSX.Element} The rendered floating assistant component.
 */
export default function FloatingAssistant() {
	const [userId, setUserId] = useState(null);
	const location = useLocation();
	const orbMode = location.pathname === "/help";
	const [open, setOpen] = useState(false);
	const didPushRef = useRef(false);

	useEffect(() => {
		const handlePop = () => {
			if (didPushRef.current) {
				didPushRef.current = false;
				setOpen(false);
			}
		};
		window.addEventListener("popstate", handlePop);
		return () => window.removeEventListener("popstate", handlePop);
	}, []);

	const openPanel = useCallback(() => {
		history.pushState({ assistantOpen: true }, "");
		didPushRef.current = true;
		setOpen(true);
	}, []);

	const closePanel = useCallback(() => {
		setOpen(false);
		if (didPushRef.current) {
			didPushRef.current = false;
			history.back();
		}
	}, []);

	const scrollDir = useScrollDirection();
	const reduceMotion = useReducedMotion();
	const buttonVisible = open || reduceMotion || scrollDir !== "down";
	const buttonOpacity = useSpring(buttonVisible ? 1 : 0, {
		stiffness: 120,
		damping: 24,
		restDelta: 0.001,
	});
	const [input, setInput] = useState("");
	const [messages, setMessages] = useState([]);
	const [title, setTitle] = useState(null);
	const [loading, setLoading] = useState(false);
	const [sessionLoaded, setSessionLoaded] = useState(false);
	const [firstChunkReceived, setFirstChunkReceived] = useState(false);
	const [wsConnected, setWsConnected] = useState(false);
	const scrollRef = useRef(null);
	const socketRef = useRef(null);
	const requestSeqRef = useRef(1);
	const hasUserMessagesRef = useRef(false);
	const sessionLoadedRef = useRef(false);

	useEffect(() => {
		getCurrentUserAsync().then((user) => setUserId(user?.id || null));
	}, []);

	// Pre-load session data on mount (before panel opens)
	useEffect(() => {
		if (!userId) {
			return;
		}
		fetchSessionData()
			.then(({ messages: msgs, title: t }) => {
				if (msgs && msgs.length > 0) {
					const formatted = msgs.map((m) => ({
						role: m.role === "user" ? "user" : "assistant",
						text: m.text || "",
						isNew: false,
					}));
					setMessages(formatted);
					hasUserMessagesRef.current = formatted.some((m) => m.role === "user");
				}
				if (t) {
					setTitle(t);
				}
				setSessionLoaded(true);
				sessionLoadedRef.current = true;
			})
			.catch((err) => logger.warn("Failed to load session data:", err));
	}, [userId]);

	// Fallback: load session when panel opens if mount-load didn't run
	useEffect(() => {
		if (!(open && userId) || sessionLoadedRef.current) {
			return;
		}
		fetchSessionData()
			.then(({ messages: msgs, title: t }) => {
				if (msgs && msgs.length > 0) {
					const formatted = msgs.map((m) => ({
						role: m.role === "user" ? "user" : "assistant",
						text: m.text || "",
						isNew: false,
					}));
					setMessages(formatted);
					hasUserMessagesRef.current = formatted.some((m) => m.role === "user");
				} else {
			setMessages([
					{
						role: "assistant",
						text: "Hello! I am your GarTex Assistant. I can help you with:\n\n- **Account** verification & settings\n- **Products** listing & management\n- **Contracts** & payment proofs\n- **Buyer requests** & matching\n- **Premium** plans & billing\n- **LC (Letter of Credit)** guidance\n\nHow can I help you today?",
						isNew: false,
					},
				]);
				}
				if (t) {
					setTitle(t);
				}
				setSessionLoaded(true);
				sessionLoadedRef.current = true;
			})
			.catch((err) => logger.warn("Failed to load fallback session data:", err));
	}, [open, userId]);

	async function deleteSession() {
		if (userId) {
			await deleteSessionAPI();
		}
		setMessages([
			{
				role: "assistant",
				text: "Chat cleared. I can help you with account verification, products, contracts, payments, and more. What do you need?",
				isNew: false,
			},
		]);
		setTitle(null);
		setSessionLoaded(false);
		sessionLoadedRef.current = false;
		hasUserMessagesRef.current = false;
	}

	function getWsUrl() {
		if (API_BASE.startsWith("http://") || API_BASE.startsWith("https://")) {
			return API_BASE.replace(/^http/, "ws").replace(/\/api\/*$/, "/ws");
		}
		const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
		return `${protocol}//${window.location.host}/ws`;
	}

	const streamingIdsRef = useRef(new Set());
	const reconnectTimerRef = useRef(null);
	const reconnectAttemptsRef = useRef(0);
	const wsUrlRef = useRef(getWsUrl());

	// Stable identity: it is a dependency of the connect effect below. As a
	// plain function it changed on every render, so every render (typing,
	// opening the panel, a reply arriving) closed the socket and opened a new
	// one - and the answer to a question arrived on a socket nobody listened to.
	const cancelReconnect = useCallback(() => {
		if (reconnectTimerRef.current) {
			clearTimeout(reconnectTimerRef.current);
			reconnectTimerRef.current = null;
		}
		reconnectAttemptsRef.current = 0;
	}, []);

	const connectWs = useCallback(function connectWs() {
		if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
			return;
		}

		const socket = new WebSocket(wsUrlRef.current);

		socket.onopen = () => {
			setWsConnected(true);
			reconnectAttemptsRef.current = 0;
			try {
				const token = typeof getToken === "function" ? getToken() : null;
				if (token) {
					socket.send(JSON.stringify({ type: "identify", token }));
				}
			} catch (err) {
				logger.warn("Assistant identify failed", err);
			}
		};

		socket.onmessage = (event) => {
			let data;
			try {
				data = JSON.parse(event.data);
			} catch (err) {
				logger.error("Failed to parse WS message", err);
				return;
			}
			if (data.type === "chunk") {
				const rid = data.request_id;
				streamingIdsRef.current.add(rid);
				setFirstChunkReceived(true);
				setMessages((prev) => {
					const idx = prev.findLastIndex((m) => m.role === "assistant" && m.request_id === rid);
					if (idx >= 0) {
						const updated = [...prev];
						updated[idx] = { ...updated[idx], text: data.text || "" };
						return updated;
					}
					return [
						...prev,
						{
							role: "assistant",
							text: data.text || "",
							isNew: false,
							request_id: rid,
						},
					];
				});
			} else if (data.type === "reply") {
				const rid = data.request_id;
				streamingIdsRef.current.delete(rid);

				if (data.source === "system:greeting" && hasUserMessagesRef.current) {
					return;
				}

				setMessages((prev) => {
					const idx = prev.findLastIndex((m) => m.role === "assistant" && m.request_id === rid);
					const text = data.answer || "I am sorry, I could not find an answer to that.";
					if (idx >= 0) {
						const updated = [...prev];
						updated[idx] = { ...updated[idx], text, isNew: false };
						return updated;
					}
					return [
						...prev,
						{
							role: "assistant",
							text,
							isNew: true,
							request_id: rid,
						},
					];
				});
				setLoading(false);
				setFirstChunkReceived(false);
			} else if (data.type === "error") {
				setMessages((prev) => [
					...prev,
					{
						role: "assistant",
						text: `Error: ${data.message || "Something went wrong"}`,
						isNew: true,
					},
				]);
				setLoading(false);
				setFirstChunkReceived(false);
			}
		};

		socket.onclose = () => {
			setWsConnected(false);
			if (reconnectTimerRef.current) {
				clearTimeout(reconnectTimerRef.current);
			}
			reconnectAttemptsRef.current += 1;
			const delay = Math.min(1000 * 2 ** reconnectAttemptsRef.current, 120_000);
			reconnectTimerRef.current = setTimeout(() => {
				connectWs();
			}, delay);
		};
		socket.onerror = () => {
			socket.close();
		};

		socketRef.current = socket;
	}, []);

	useEffect(() => {
		connectWs();
		return () => {
			cancelReconnect();
			if (socketRef.current) {
				socketRef.current.onopen = null;
				socketRef.current.onmessage = null;
				socketRef.current.onclose = null;
				socketRef.current.onerror = null;
				if (
					socketRef.current.readyState === WebSocket.OPEN ||
					socketRef.current.readyState === WebSocket.CONNECTING
				) {
					socketRef.current.close();
				}
			}
		};
	}, [connectWs, cancelReconnect]);

	useEffect(() => {
		if (scrollRef.current) {
			scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
		}
	}, []);

	async function handleSend(textOverride) {
		const text = textOverride || input;
		if (!text.trim() || loading) {
			return;
		}

		const requestId = `req_${requestSeqRef.current++}`;
		const userMsg = { role: "user", text, request_id: requestId, isNew: false };
		setMessages((prev) => [...prev, userMsg]);
		hasUserMessagesRef.current = true;
		setInput("");
		setLoading(true);
		setFirstChunkReceived(false);

		if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
			socketRef.current.send(
				JSON.stringify({ type: "ask", question: text, request_id: requestId }),
			);
		} else {
			// No live connection (cold server, offline, guest): answer the common
			// questions from the built-in FAQ instead of a dead end.
			const faq = answerFaq(text);
			setMessages((prev) => [
				...prev,
				{
					role: "assistant",
					text: formatFaqAnswer(faq),
					request_id: requestId,
					isNew: true,
				},
			]);
			setLoading(false);
			connectWs();
		}
	}

	function markAsOld(msgIndex) {
		setMessages((prev) => prev.map((m, i) => (i === msgIndex ? { ...m, isNew: false } : m)));
	}

	const suggestions = [
		"How do I verify my account?",
		"Tell me about Premium benefits",
		"How do contracts work?",
		"Need help with onboarding",
		"How to list products?",
		"What payment methods are supported?",
		"How does buyer request matching work?",
		"What is LC (Letter of Credit)?",
	];

	return (
		<>
			<motion.div className="fixed right-4 bottom-20 z-50 sm:right-6 sm:bottom-10" style={{ opacity: buttonOpacity }}>
				<button
					type="button"
					onClick={() => (open ? closePanel() : openPanel())}
					className={[
						"w-14 h-14 rounded-full flex items-center justify-center text-white transition-all duration-300 active:scale-90",
						orbMode
							? "assistant-orb-btn hover:scale-110"
							: "bg-gradient-to-br from-sky-500 to-cyan-400 shadow-lg shadow-sky-500/30 hover:shadow-xl hover:shadow-sky-500/40 hover:scale-110 ring-2 ring-white/30 dark:ring-white/10",
					].join(" ")}
					aria-label={open ? "Close assistant" : "Open assistant"}
					title={open ? "Close assistant" : "Open assistant"}
				>
					{open ? (
						<svg
							aria-hidden="true"
							width="18"
							height="18"
							viewBox="0 0 24 24"
							fill="none"
							className="text-white"
						>
							<path
								stroke="currentColor"
								strokeWidth="2"
								strokeLinecap="round"
								strokeLinejoin="round"
								d="M6 6 L18 18 M6 18 L18 6"
							/>
						</svg>
					) : (
						<BotLogo width={22} height={22} />
					)}
				</button>
			</motion.div>

			{open ? (
				<div className="fixed top-0 right-0 h-full w-full md:w-[420px] z-50 flex flex-col overflow-x-hidden">
					<div className="h-full w-full bg-white/80 dark:bg-slate-950/90 backdrop-blur-xl border-l border-slate-200/70 dark:border-slate-800/60 shadow-borderless dark:shadow-borderlessDark flex flex-col">
						<div className="bg-gradient-to-r from-sky-500 via-sky-600 to-cyan-400 text-white flex items-center justify-between px-5 py-4 shrink-0">
							<div className="flex items-center gap-3 min-w-0">
								<div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center font-bold backdrop-blur-sm shrink-0">
									<BotLogo width={22} height={22} variant="glyph" className="text-white" />
								</div>
								<div className="min-w-0">
									<p className="font-bold tracking-tight text-[15px] truncate max-w-[200px]">
										{title || "GarTex Assistant"}
									</p>
									<div className="flex items-center gap-1.5">
										{loading ? (
											<ThreeDot
												variant="bounce"
												color="#337ab0"
												size="small"
												text=""
												textColor=""
											/>
										) : (
											<>
												<span
													className={`w-2 h-2 rounded-full ${wsConnected ? "bg-green-300" : "bg-amber-400"}`}
												/>
												<p className="text-[10px] uppercase tracking-wider text-white/80 font-semibold">
													{wsConnected ? "Online" : "Connecting"}
												</p>
											</>
										)}
									</div>
								</div>
							</div>
							<div className="flex items-center gap-0.5 shrink-0">
								<button
									onClick={deleteSession}
									aria-label="Delete session"
									title="Delete session & start new chat"
									type="button"
									className="hover:bg-white/15 p-2 rounded-xl transition-colors"
								>
									<svg
										aria-hidden="true"
										width="16"
										height="16"
										viewBox="0 0 24 24"
										fill="none"
										className="text-white/80"
									>
										<path
											stroke="currentColor"
											strokeWidth="2"
											strokeLinecap="round"
											strokeLinejoin="round"
											d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6"
										/>
									</svg>
								</button>
								<button
									onClick={closePanel}
									aria-label="Close assistant"
									title="Close assistant"
									type="button"
									className="hover:bg-white/15 p-2 rounded-xl transition-colors"
								>
									<svg
										aria-hidden="true"
										width="16"
										height="16"
										viewBox="0 0 24 24"
										fill="none"
										className="text-white/80"
									>
										<path
											stroke="currentColor"
											strokeWidth="2"
											strokeLinecap="round"
											strokeLinejoin="round"
											d="M6 6 L18 18 M6 18 L18 6"
										/>
									</svg>
								</button>
							</div>
						</div>

						<div
							data-lenis-prevent={true}
							ref={scrollRef}
							className="flex-1 overflow-y-auto px-4 py-5 space-y-4 scroll-smooth"
						>
							{messages.map((msg, i) => (
								<div
									key={i}
									className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} animate-in fade-in slide-in-from-bottom-2 duration-300`}
								>
									<div
										className={`max-w-[88%] text-sm leading-relaxed ${
											msg.role === "user"
												? "bg-gradient-to-br from-sky-500 to-cyan-400 text-white rounded-2xl rounded-br-none px-4 py-3 shadow-md shadow-sky-500/20"
												: "bg-white dark:bg-slate-900/80 text-slate-800 dark:text-slate-100 rounded-2xl rounded-bl-none px-4 py-3 border border-slate-200/60 dark:border-slate-700/50 shadow-sm"
										}`}
									>
										{msg.role === "assistant" && msg.isNew ? (
											<TypewriterText text={msg.text} onComplete={() => markAsOld(i)} />
										) : msg.role === "assistant" ? (
											<Suspense fallback={<span className="whitespace-pre-wrap">{msg.text}</span>}>
												<MarkdownMessage text={msg.text} />
											</Suspense>
										) : (
											msg.text
										)}
									</div>
								</div>
							))}

							{loading && !firstChunkReceived && (
								<div className="flex justify-start animate-in fade-in duration-200">
									<div className="bg-white dark:bg-slate-900/80 border border-slate-200/60 dark:border-slate-700/50 rounded-2xl rounded-bl-none px-4 py-3.5 shadow-sm">
										<ThreeDot variant="bounce" color="#6dabdf" size="small" text="" textColor="" />
									</div>
								</div>
							)}
						</div>

						<div className="px-4 pt-3 pb-5 border-t border-slate-200/60 dark:border-slate-800/50 bg-white/50 dark:bg-slate-950/50 backdrop-blur-sm shrink-0">
							{messages.length < 3 && !loading && (
								<div className="flex flex-wrap gap-2 mb-3 animate-in fade-in slide-in-from-bottom-1 duration-500">
									{suggestions.map((s, i) => (
										<button
											key={i}
											onClick={() => handleSend(s)}
											className="text-[11px] font-medium bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border border-sky-200/60 dark:border-sky-800/50 px-3 py-1.5 rounded-full hover:bg-sky-100 dark:hover:bg-sky-900/40 transition-all hover:scale-105 active:scale-95 shadow-sm"
										>
											{s}
										</button>
									))}
								</div>
							)}

							<div className="flex gap-2 items-center">
								<div className="flex-1 relative">
									<input
										value={input}
										onChange={(e) => setInput(e.target.value)}
										onKeyDown={(e) => e.key === "Enter" && handleSend()}
										placeholder="Type your question..."
										className="w-full px-4 py-2.5 bg-slate-100 dark:bg-slate-800/60 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-400/50 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500 text-slate-800 dark:text-slate-100 border border-slate-200/60 dark:border-slate-700/50"
									/>
								</div>
								<button
									type="button"
									onClick={() => handleSend()}
									disabled={loading || !input.trim()}
									className="w-10 h-10 rounded-2xl bg-gradient-to-br from-sky-500 to-cyan-400 text-white flex items-center justify-center disabled:opacity-30 disabled:grayscale transition-all hover:shadow-lg hover:shadow-sky-500/30 active:scale-90 shrink-0"
								>
									<svg
										className="w-5 h-5 rotate-45"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
									>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth="2.5"
											d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
										/>
									</svg>
								</button>
							</div>
							<p className="text-[10px] text-slate-400 dark:text-slate-500 text-center mt-3 font-medium">
								GarTex AI Assistant
							</p>
						</div>
					</div>
				</div>
			) : null}
		</>
	);
}
