/*
  Route: /notifications
  Access: Protected (login required)
  Allowed roles: buyer, buying_house, factory, owner, admin, agent

  Public Pages:
    /, /pricing, /about, /terms, /privacy, /help, /login, /signup, /access-denied
  Protected Pages (login required):
    /feed, /search, /buyer/:id, /factory/:id, /buying-house/:id, /contracts,
    /notifications, /chat, /call, /verification, /verification-center

  Primary responsibilities:
    - Display system + workflow notifications (search matches, conversation locks, rating requests, etc.).
    - Provide tabbed filtering with animated active pill indicator.
    - Support actions like mark-as-read and manage search alerts.

  Key API endpoints:
    - GET /api/notifications
    - PATCH /api/notifications/:id/read
    - GET /api/notifications/search-alerts
    - DELETE /api/notifications/search-alerts/:id
    - GET /api/products/views/me (for the "Viewed Products" tab)
*/

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
	ArrowRight,
	Bell,
	Factory,
	History,
	Plus,
	RefreshCw,
	ShieldAlert,
	Sparkles,
	Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Mosaic, ThreeDot } from "react-loading-indicators";
import { Link, useNavigate } from "react-router-dom";
import ProductQuickViewModal from "../components/products/ProductQuickViewModal.jsx";
import ScrollReveal from "../components/ScrollReveal.jsx";
import { StaggerContainer, StaggerItem } from "../components/StaggerContainer.jsx";
import NeonAtom from "../components/ui/NeonAtom.jsx";
import { apiRequest, getCurrentUser, getToken, syncUserFromApi } from "../lib/auth.js";
import { logger } from "../lib/logger.js";
import {
	connectNotificationsRealtime,
	subscribeNotificationsRealtime,
} from "../lib/notificationsRealtime.js";
import { useTheme } from "../lib/ThemeProvider.jsx";

const Motion = motion;

const TABS = [
	{ key: "all", label: "All", icon: Bell },
	{ key: "smart_search_match", label: "Search Matches", icon: Sparkles },
	{ key: "partner_request", label: "Partner Requests", icon: Factory },
	{ key: "conversation_lock", label: "Conversation Locks", icon: ShieldAlert },
	{
		key: "rating_feedback_request",
		label: "Rating Requests",
		icon: ShieldAlert,
	},
	{ key: "system", label: "System", icon: Bell },
	{ key: "viewed", label: "Viewed Products", icon: History },
];

const TYPE_LABELS = {
	smart_search_match: "Search Match",
	partner_request: "Connection Request",
	join_request: "Join Request",
	join_request_reminder: "Join Reminder",
	join_request_approved: "Join Approved",
	join_request_rejected: "Join Rejected",
	duplicate_company_detected: "Duplicate Detected",
	duplicate_dispute: "Duplicate Dispute",
	duplicate_dispute_resolved: "Dispute Resolved",
	relationship_request: "Relationship Request",
	relationship_confirmed: "Relationship Confirmed",
	relationship_rejected: "Relationship Rejected",
	license_request: "License Request",
	license_request_fulfilled: "License Received",
	license_request_rejected: "License Request Rejected",

	conversation_lock: "Conversation Lock",
	rating_feedback_request: "Rating Request",
	monthly_summary: "Monthly Summary",
	system: "System",
};

// Content notifications open the item itself on its single-item page
// (/share/:type/:id), which loads it directly and handles deleted or hidden
// items - the feed only showed an item if it was already loaded on the page
// (client report 02/11/2026: "it takes me to the feed, not the post/video").
const SHARE_TYPE_BY_ENTITY = {
	buyer_request: "buyer_request",
	requirement: "buyer_request",
	company_product: "company_product",
	product: "company_product",
	feed_post: "user_feed_post",
	user_feed_post: "user_feed_post",
	post: "user_feed_post",
};

export function notificationLink(item, role = "") {
	const entityType = String(item?.entity_type || "");
	const entityId = item?.entity_id ? String(item.entity_id) : "";
	const isStaff = ["admin", "owner"].includes(String(role || "").toLowerCase());
	if (entityType === "join_request") {
		const requestId = item?.meta?.request_id || entityId || item?.id;
		return requestId ? `/join-requests/${encodeURIComponent(requestId)}` : "/notifications";
	}
	if (SHARE_TYPE_BY_ENTITY[entityType] && entityId) {
		return `/share/${SHARE_TYPE_BY_ENTITY[entityType]}/${encodeURIComponent(entityId)}`;
	}
	switch (entityType) {
		case "partner_request":
			return "/partner-network";
		case "verification":
			return isStaff ? "/admin" : "/verification";
		case "duplicate_dispute":
		case "duplicate_company":
			return isStaff ? "/admin" : "/notifications";
		case "chat_thread":
			return entityId ? `/chat?match_id=${encodeURIComponent(entityId)}` : "/chat";
		case "lead":
			return "/leads";
		case "contract":
			return "/contracts";
		default:
			return "/notifications";
	}
}

import { cn } from "../lib/cn.js";

function Badge({ children, tone = "slate" }) {
	const tones = {
		emerald: "bg-emerald-500/10 text-emerald-300 ring-emerald-400/20",
		blue: "bg-sky-500/10 text-sky-300 ring-sky-400/20",
		rose: "bg-rose-500/10 text-rose-300 ring-rose-400/20",
		amber: "bg-amber-500/10 text-amber-300 ring-amber-400/20",
		slate: "bg-slate-500/10 text-slate-300 ring-slate-400/20",
		sky: "bg-cyan-500/10 text-cyan-300 ring-cyan-400/20",
	};
	return (
		<span
			class={cn(
				"inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1",
				tones[tone] || tones.slate,
			)}
		>
			{children}
		</span>
	);
}

function ActionButton({ children, variant = "primary", onClick }) {
	const styles = {
		primary: "bg-sky-500 text-white shadow-lg shadow-sky-500/20 hover:bg-sky-400",
		ghost: "bg-white/5 text-slate-200 ring-1 ring-white/10 hover:bg-white/10",
		danger: "bg-rose-500/10 text-rose-200 ring-1 ring-rose-500/20 hover:bg-rose-500/15",
		success:
			"bg-emerald-500/10 text-emerald-200 ring-1 ring-emerald-500/20 hover:bg-emerald-500/15",
	};
	return (
		<button
			onClick={onClick}
			class={cn(
				"inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition-all duration-200 active:scale-[0.98]",
				styles[variant],
			)}
		>
			{children}
		</button>
	);
}

function getRelativeTone(type) {
	switch (type) {
		case "smart_search_match":
			return "emerald";
		case "partner_request":
			return "blue";
		case "conversation_lock":
			return "rose";
		case "rating_feedback_request":
			return "amber";
		case "viewed":
			return "sky";
		default:
			return "slate";
	}
}

export default function NotificationsCenter() {
	const token = useMemo(() => getToken(), []);
	const user = useMemo(() => getCurrentUser(), []);
	const reduceMotion = useReducedMotion();
	const { theme, setTheme } = useTheme();
	const [tab, setTab] = useState("all");
	const [unreadOnly, setUnreadOnly] = useState(false);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [livePulse, setLivePulse] = useState(true);

	const [items, setItems] = useState([]);
	const [alerts, setAlerts] = useState([]);

	const [views, setViews] = useState([]);
	const [viewsCursor, setViewsCursor] = useState(0);
	const [viewsNext, setViewsNext] = useState(null);
	const [loadingViews, setLoadingViews] = useState(false);
	const [quickViewItem, setQuickViewItem] = useState(null);
	const [pageLoading, setPageLoading] = useState(true);
	const [loadingAlerts, setLoadingAlerts] = useState(true);
	const [viewedItems, setViewedItems] = useState(new Set());
	const navigate = useNavigate();

	const loadNotifications = useCallback(async () => {
		if (!token) {
			return;
		}
		setLoading(true);
		setError("");
		try {
			const data = await apiRequest("/notifications", { token });
			setItems(Array.isArray(data) ? data : []);
		} catch (err) {
			setError(err.message || "Failed to load notifications");
			setItems([]);
		} finally {
			setLoading(false);
		}
	}, [token]);

	const loadAlerts = useCallback(async () => {
		if (!token) {
			return;
		}
		setLoadingAlerts(true);
		try {
			const data = await apiRequest("/notifications/search-alerts", { token });
			setAlerts(Array.isArray(data) ? data : []);
		} catch (err) {
			logger.warn("Failed to load search alerts:", err);
			setAlerts([]);
		} finally {
			setLoadingAlerts(false);
		}
	}, [token]);

	const loadViews = useCallback(
		async ({ reset }) => {
			if (!token) {
				return;
			}
			const cursor = reset ? 0 : viewsCursor;
			setLoadingViews(true);
			try {
				const data = await apiRequest(`/products/views/me?cursor=${cursor}&limit=10`, { token });
				const rows = Array.isArray(data?.items) ? data.items : [];
				setViews((prev) => (reset ? rows : [...prev, ...rows]));
				setViewsCursor(reset ? 10 : cursor + 10);
				setViewsNext(data?.next_cursor ?? null);
			} catch (err) {
				logger.warn("Failed to load views:", err);
				if (reset) {
					setViews([]);
				}
				setViewsNext(null);
			} finally {
				setLoadingViews(false);
			}
		},
		[token, viewsCursor],
	);

	useEffect(() => {
		let notifsDone = false;
		let alertsDone = false;
		let userDone = false;
		function tryDone() {
			if (notifsDone && alertsDone && userDone) {
				setPageLoading(false);
			}
		}
		(async () => {
			try {
				await loadNotifications();
			} finally {
				notifsDone = true;
				tryDone();
			}
		})();
		(async () => {
			try {
				await loadAlerts();
			} finally {
				alertsDone = true;
				tryDone();
			}
		})();
		(async () => {
			try {
				await syncUserFromApi(getToken());
			} finally {
				userDone = true;
				tryDone();
			}
		})();
	}, [loadAlerts, loadNotifications]);

	useEffect(() => {
		if (!token) {
			return;
		}
		connectNotificationsRealtime(token);
		const unsubscribe = subscribeNotificationsRealtime((msg) => {
			if (!msg) {
				return;
			}
			if (msg.type === "notification_created" && msg.notification?.id) {
				setItems((prev) => {
					const exists = prev.some((n) => String(n?.id) === String(msg.notification.id));
					if (exists) {
						return prev;
					}
					return [msg.notification, ...prev];
				});
			}
			if (msg.type === "notification_read" && msg.id) {
				setItems((prev) =>
					prev.map((n) => (String(n?.id) === String(msg.id) ? { ...n, read: true } : n)),
				);
			}
		});
		return unsubscribe;
	}, [token]);

	useEffect(() => {
		if (tab !== "viewed") {
			return;
		}
		if (views.length > 0) {
			return;
		}
		// eslint-disable-next-line react-hooks/set-state-in-effect
		loadViews({ reset: true });
	}, [loadViews, tab, views.length]);

	async function markRead(id) {
		if (!(token && id)) {
			return;
		}
		await apiRequest(`/notifications/${encodeURIComponent(id)}/read`, {
			method: "PATCH",
			token,
		});
		setItems((prev) => prev.map((n) => (String(n?.id) === String(id) ? { ...n, read: true } : n)));
		setViewedItems((prev) => new Set([...prev, id]));
	}

	async function markAllRead() {
		if (!token) return;
		await apiRequest("/notifications/read-all", { method: "PATCH", token });
		setItems((prev) => prev.map((n) => ({ ...n, read: true })));
		setViewedItems((prev) => {
			const next = new Set(prev);
			items.forEach((n) => next.add(n.id));
			return next;
		});
	}

	async function respondPartnerRequest(requestId, action, notificationId) {
		if (!(token && requestId)) {
			return;
		}
		await apiRequest(`/partners/requests/${encodeURIComponent(requestId)}/${action}`, {
			method: "POST",
			token,
		});
		if (notificationId) {
			await apiRequest(`/notifications/${encodeURIComponent(notificationId)}/read`, {
				method: "PATCH",
				token,
			});
			setItems((prev) =>
				prev.map((n) => (String(n?.id) === String(notificationId) ? { ...n, read: true } : n)),
			);
		}
	}

	async function deleteAlert(id) {
		if (!(token && id)) {
			return;
		}
		await apiRequest(`/notifications/search-alerts/${encodeURIComponent(id)}`, {
			method: "DELETE",
			token,
		});
		await loadAlerts();
	}

	const filteredItems = useMemo(
		() =>
			items.filter((it) => {
				if (unreadOnly && it.read) {
					return false;
				}
				if (tab === "all") {
					return it.type !== "viewed";
				}
				if (tab === "viewed") {
					return false;
				}
				return it.type === tab;
			}),
		[items, tab, unreadOnly],
	);

	const unreadCount = items.filter((n) => !n.read).length;

	const refreshViewed = () => {
		setViews((prev) => [...prev]);
		setLivePulse(true);
		window.setTimeout(() => setLivePulse(false), 1200);
		loadViews({ reset: true });
	};

	const pageBg =
		theme === "dark"
			? "bg-[var(--theme-custom-07111f)] text-slate-100"
			: "bg-gradient-to-br from-sky-50 via-white to-cyan-50 text-slate-900";
	const cardBg =
		theme === "dark"
			? "bg-white/5 border-white/10 shadow-2xl shadow-black/20"
			: "bg-white/75 border-sky-100 shadow-xl shadow-sky-100/50 backdrop-blur";
	const softBg = theme === "dark" ? "bg-white/5" : "bg-slate-900/5";
	const subtleText = theme === "dark" ? "text-slate-400" : "text-slate-600";
	const mutedText = theme === "dark" ? "text-slate-300" : "text-slate-700";

	if (pageLoading) {
		return <NeonAtom fill={true} timeout={10_000} />;
	}

	return (
		<div class={cn("min-h-screen transition-colors duration-500", pageBg)}>
			<div class="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
				<div class="absolute inset-x-0 top-0 -z-10 h-72 bg-gradient-to-b from-sky-500/20 via-cyan-400/10 to-transparent blur-3xl" />

				<div class={cn("overflow-hidden rounded-[28px] border p-5 sm:p-6 lg:p-8", cardBg)}>
					<div class="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
						<div class="flex-1">
							<div class="flex flex-wrap items-center gap-3">
								<div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-cyan-400 text-white shadow-lg shadow-sky-500/30">
									<Bell class="h-6 w-6" />
								</div>
								<div>
									<h1 class="text-3xl font-black tracking-tight sm:text-4xl">Notifications</h1>
									<p class={cn("mt-1 text-sm sm:text-base", subtleText)}>
										Smart search matches, system alerts, and your viewed history.
									</p>
								</div>
								<div class="flex items-center gap-2 rounded-full border border-sky-400/20 bg-sky-500/10 px-3 py-1.5 text-xs font-semibold text-sky-200">
									<span
										class={cn(
											"h-2 w-2 rounded-full",
											livePulse ? "animate-pulse bg-emerald-400" : "bg-sky-400",
										)}
									/>
									Live updates enabled
								</div>
							</div>

							<div class="mt-5 flex flex-wrap items-center gap-3">
								<label
									class={cn(
										"inline-flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-medium",
										softBg,
										theme === "dark" ? "border-white/10" : "border-sky-100",
									)}
								>
									<input
										type="checkbox"
										checked={unreadOnly}
										onChange={(e) => setUnreadOnly(e.target.checked)}
										class="h-4 w-4 rounded border-sky-400 text-sky-500 focus:ring-sky-400"
									/>
									<span>Unread only</span>
									<span class="rounded-full bg-sky-500/10 px-2 py-0.5 text-xs text-sky-300">
										{unreadCount}
									</span>
								</label>

								<div class="ml-auto flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-1 shadow-lg shadow-black/10">
									<button
										onClick={() => setTheme("dark")}
										class={cn(
											"rounded-xl px-4 py-2 text-sm font-semibold transition",
											theme === "dark"
												? "bg-sky-500 text-white"
												: "text-slate-400 hover:text-slate-200",
										)}
									>
										Dark
									</button>
									<button
										onClick={() => setTheme("light")}
										class={cn(
											"rounded-xl px-4 py-2 text-sm font-semibold transition",
											theme === "light"
												? "bg-sky-500 text-white"
												: "text-slate-400 hover:text-slate-200",
										)}
									>
										Light
									</button>
								</div>
							</div>

							<div class="mt-5 flex flex-wrap gap-2">
								{TABS.map((item) => {
									const active = tab === item.key;
									const Icon = item.icon;
									return (
										<motion.button
											key={item.key}
											type="button"
											onClick={() => setTab(item.key)}
											whileTap={reduceMotion ? undefined : { scale: 0.98 }}
											class={cn(
												"inline-flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-semibold transition-all duration-200",
												active
													? "border-sky-400/40 bg-sky-500 text-white shadow-lg shadow-sky-500/20"
													: cn("border-white/10", softBg, "hover:bg-white/10", mutedText),
											)}
										>
											<span class="relative inline-flex items-center gap-2">
												<Icon size={16} />
												{item.label}
											</span>
										</motion.button>
									);
								})}
							</div>
						</div>

						<div
							class={cn(
								"w-full max-w-sm rounded-3xl border p-5",
								softBg,
								theme === "dark" ? "border-white/10" : "border-sky-100",
							)}
						>
							<div class="flex items-center justify-between">
								<div>
									<div class="text-sm font-semibold text-sky-300">Real-time feed</div>
									<div class={cn("mt-1 text-xs", subtleText)}>
										WebSocket updates appear instantly at the top.
									</div>
								</div>
								<div class="rounded-2xl bg-sky-500/10 p-3 text-sky-300 ring-1 ring-sky-400/20">
									<ArrowRight class="h-5 w-5" />
								</div>
							</div>
							<div class="mt-4 grid grid-cols-3 gap-3">
								<Stat label="Unread" value={String(unreadCount)} />
								<Stat label="Alerts" value={String(alerts.length)} />
								<Stat label="Viewed" value={String(views.length)} />
							</div>
						</div>
					</div>

					<div class="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
						<div class="space-y-6">
							<ScrollReveal as="section">
								<section class={cn("rounded-[28px] border p-4 sm:p-5", cardBg)}>
									<div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
										<div>
											<h2 class="text-xl font-bold">Notifications feed</h2>
											<p class={cn("mt-1 text-sm", subtleText)}>
												{tab === "viewed"
													? "Showing viewed products history from Quick View."
													: "All notification types except Viewed Products are grouped here."}
											</p>
										</div>
										<div class={cn("rounded-2xl px-4 py-2 text-sm", softBg, subtleText)}>
											Showing {filteredItems.length} item
											{filteredItems.length === 1 ? "" : "s"}
										</div>
										{items.some((n) => !n.read) && (
											<button
												onClick={markAllRead}
												class="rounded-2xl px-4 py-2 text-sm font-medium text-sky-600 hover:bg-sky-50 dark:text-sky-400 dark:hover:bg-white/5"
											>
												Mark all as read
											</button>
										)}
									</div>

									<StaggerContainer class="space-y-3">
										{loading ? (
											<Mosaic
												color="#337ab0"
												size="large"
												style={{ fontSize: "40px" }}
												text=""
												textColor=""
											/>
										) : error ? (
											<div class="text-sm text-rose-300">{error}</div>
										) : filteredItems.length === 0 ? (
											<EmptyState
												title="No notifications found"
												description="Try changing the tab or turning off the unread-only filter."
											/>
										) : (
											<AnimatePresence mode="popLayout">
												{filteredItems.map((item) => (
													<StaggerItem key={item.id}>
														<NotificationCard
															item={item}
															theme={theme}
															user={user}
															viewedItems={viewedItems}
															onMarkRead={() => markRead(item.id)}
															onAccept={() =>
																respondPartnerRequest(
																	item?.meta?.request_id || item.entity_id,
																	"accept",
																	item.id,
																)
															}
															onReject={() =>
																respondPartnerRequest(
																	item?.meta?.request_id || item.entity_id,
																	"reject",
																	item.id,
																)
															}
														/>
													</StaggerItem>
												))}
											</AnimatePresence>
										)}
									</StaggerContainer>
								</section>
							</ScrollReveal>

							<AnimatePresence mode="wait">
								{tab === "viewed" && (
									<ScrollReveal as="section">
										<section class={cn("rounded-[28px] border p-4 sm:p-5", cardBg)}>
											<div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
												<div>
													<div class="flex items-center gap-3">
														<h2 class="text-xl font-bold">Viewed Products</h2>
														<Badge tone="sky">Private to you</Badge>
													</div>
													<p class={cn("mt-1 text-sm", subtleText)}>
														Recorded on Quick View. This history helps you revisit products quickly.
													</p>
												</div>
												<button
													onClick={refreshViewed}
													class="inline-flex items-center gap-2 rounded-2xl border border-sky-400/20 bg-sky-500/10 px-4 py-2.5 text-sm font-semibold text-sky-200 transition hover:bg-sky-500/15"
												>
													<RefreshCw class="h-4 w-4" />
													Refresh
												</button>
											</div>

											<div class="mt-5 space-y-3">
												{loadingViews ? (
													<ThreeDot
														variant="bounce"
														color="#337ab0"
														size="small"
														text=""
														textColor=""
													/>
												) : views.length === 0 ? (
													<EmptyState
														title="No viewed products yet"
														description="View products from the search page to see them here."
													/>
												) : (
													views.map((row) => (
														<ViewedCard
															key={row.id}
															product={row}
															theme={theme}
															onQuickView={() =>
																setQuickViewItem({
																	...row.product,
																	author: row.author,
																})
															}
														/>
													))
												)}
											</div>

											{viewsNext !== null && !loadingViews && (
												<div class="mt-5 flex justify-center">
													<button
														onClick={() => loadViews({ reset: false })}
														class="rounded-2xl bg-sky-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-500/20 transition hover:bg-sky-400"
													>
														Load more
													</button>
												</div>
											)}
										</section>
									</ScrollReveal>
								)}
							</AnimatePresence>
						</div>

						<aside class="space-y-6">
							<ScrollReveal as="section">
								<section class={cn("rounded-[28px] border p-4 sm:p-5", cardBg)}>
									<div class="flex items-start justify-between gap-3">
										<div>
											<h3 class="text-lg font-bold">Saved Search Alerts</h3>
											<p class={cn("mt-1 text-sm", subtleText)}>
												These power smart notifications for new matching posts.
											</p>
										</div>
										<Badge tone="blue">Active</Badge>
									</div>

									<div class="mt-4 space-y-3">
										{loadingAlerts ? (
											<ThreeDot
												variant="bounce"
												color="#337ab0"
												size="small"
												text=""
												textColor=""
											/>
										) : alerts.length === 0 ? (
											<EmptyState
												title="No saved alerts yet."
												description="Save an alert from the search page."
												compact={true}
											/>
										) : (
											alerts.map((alert) => (
												<div
													key={alert.id}
													class={cn(
														"flex items-center justify-between gap-4 rounded-2xl border p-4",
														theme === "dark"
															? "border-white/10 bg-white/5"
															: "border-sky-100 bg-white/80",
													)}
												>
													<div>
														<div class="font-semibold text-slate-100 dark:text-slate-900">
															{alert.query}
														</div>
														<div class={cn("mt-1 text-xs", subtleText)}>
															Updated{" "}
															{new Date(alert.updated_at || alert.created_at).toLocaleDateString()}
														</div>
													</div>
													<button
														onClick={() => deleteAlert(alert.id)}
														class="rounded-xl p-2 text-slate-400 transition hover:bg-rose-500/10 hover:text-rose-300"
														aria-label="Delete alert"
													>
														<Trash2 class="h-4 w-4" />
													</button>
												</div>
											))
										)}
									</div>
								</section>
							</ScrollReveal>

							<ScrollReveal as="section">
								<section class={cn("rounded-[28px] border p-4 sm:p-5", cardBg)}>
									<h3 class="text-lg font-bold">Tips</h3>
									<div class="mt-4 space-y-3 text-sm leading-6">
										<TipItem
											tone="emerald"
											text="Smart matches trigger when new buyer requests or products match your saved alert keywords."
										/>
										<TipItem
											tone="blue"
											text="Use verification and credibility signals to reduce fraud risk before accepting requests."
										/>
										<TipItem
											tone="sky"
											text="Viewed history is private and helps you revisit products quickly without losing context."
										/>
									</div>
								</section>
							</ScrollReveal>

							<ScrollReveal as="section">
								<section class={cn("rounded-[28px] border p-4 sm:p-5", cardBg)}>
									<h3 class="text-lg font-bold">API endpoints</h3>
									<div class="mt-4 space-y-3 text-sm">
										<ApiChip method="GET" path="/notifications" />
										<ApiChip method="PATCH" path="/notifications/:id/read" />
										<ApiChip method="DELETE" path="/notifications/search-alerts/:id" />
										<ApiChip method="GET" path="/products/views/me" />
									</div>
								</section>
							</ScrollReveal>
						</aside>
					</div>
				</div>
			</div>

			{quickViewItem && (
				<div class="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/70 p-4 backdrop-blur-sm sm:items-center">
					<div
						class={cn(
							"w-full max-w-2xl rounded-[28px] border p-5 shadow-2xl",
							theme === "dark"
								? "border-white/10 bg-[var(--theme-custom-0b1324)]"
								: "border-sky-100 bg-white",
						)}
					>
						<div class="flex items-start justify-between gap-4">
							<div>
								<h3 class="text-2xl font-black">Quick View</h3>
								<p class={cn("mt-1 text-sm", subtleText)}>Full product details preview.</p>
							</div>
							<button
								onClick={() => setQuickViewItem(null)}
								class="rounded-2xl bg-white/5 px-3 py-2 text-sm font-semibold text-slate-300 hover:bg-white/10"
							>
								Close
							</button>
						</div>

						<div
							class={cn(
								"mt-5 grid gap-4 rounded-3xl border p-5 sm:grid-cols-[1.6fr_1fr]",
								theme === "dark" ? "border-white/10 bg-white/5" : "border-sky-100 bg-sky-50/50",
							)}
						>
							<div>
								<div class="flex flex-wrap items-center gap-2">
									<Badge tone="sky">Product</Badge>
									<Badge tone="blue">Company profile</Badge>
								</div>
								<h4 class="mt-3 text-xl font-bold">
									{quickViewItem.product?.title || quickViewItem.title || "Product"}
								</h4>
								<p class={cn("mt-2 text-sm leading-6", mutedText)}>
									{quickViewItem.product?.description || quickViewItem.description || "--"}
								</p>
								<div class="mt-4 flex gap-3">
									<ActionButton variant="primary">Quick view</ActionButton>
									<ActionButton
										variant="ghost"
										onClick={() => {
											const author = quickViewItem.author;
											if (author?.id) {
												const route =
													author.role === "buying_house"
														? `/buying-house/${author.id}`
														: `/factory/${author.id}`;
												navigate(route);
												setQuickViewItem(null);
											}
										}}
									>
										Company page
									</ActionButton>
								</div>
							</div>
							<div
								class={cn(
									"rounded-3xl border p-4",
									theme === "dark" ? "border-white/10 bg-black/20" : "border-sky-100 bg-white",
								)}
							>
								<DetailRow
									label="Company"
									value={quickViewItem.author?.name || quickViewItem.companyName || "--"}
								/>
								<DetailRow
									label="Viewed"
									value={
										quickViewItem.viewed_at
											? new Date(quickViewItem.viewed_at).toLocaleDateString()
											: "--"
									}
								/>
								<DetailRow
									label="Category"
									value={quickViewItem.product?.category || quickViewItem.category || "--"}
								/>
								<DetailRow
									label="MOQ"
									value={quickViewItem.product?.moq || quickViewItem.moq || "--"}
								/>
								<DetailRow
									label="Lead time"
									value={quickViewItem.product?.lead_time_days || quickViewItem.leadTime || "--"}
								/>
							</div>
						</div>
					</div>
				</div>
			)}

			<ProductQuickViewModal
				open={Boolean(quickViewItem)}
				item={quickViewItem}
				onClose={() => setQuickViewItem(null)}
				onViewed={() => loadViews({ reset: true })}
			/>
		</div>
	);
}

function Stat({ label, value }) {
	return (
		<div class="rounded-2xl border border-white/10 bg-white/5 p-3 text-center">
			<div class="text-xl font-black text-sky-300">{value}</div>
			<div class="mt-1 text-[11px] uppercase tracking-[0.2em] text-slate-400">{label}</div>
		</div>
	);
}

function TipItem({ tone, text }) {
	const dot = {
		emerald: "bg-emerald-400",
		blue: "bg-sky-400",
		sky: "bg-cyan-400",
	};
	return (
		<div class="flex gap-3">
			<span class={cn("mt-2 h-2.5 w-2.5 rounded-full shrink-0", dot[tone] || dot.sky)} />
			<p class="text-slate-300 dark:text-slate-700">{text}</p>
		</div>
	);
}

function ApiChip({ method, path }) {
	return (
		<div class="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5">
			<span class="rounded-lg bg-sky-500/10 px-2.5 py-1 text-xs font-bold text-sky-300">
				{method}
			</span>
			<code class="text-xs text-slate-300">{path}</code>
		</div>
	);
}

function EmptyState({ title, description, compact = false }) {
	return (
		<div
			class={cn(
				"rounded-3xl border border-dashed border-white/10 bg-white/5 text-center",
				compact ? "p-5" : "p-8",
			)}
		>
			<div class="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-300">
				<Plus class="h-6 w-6" />
			</div>
			<h4 class="mt-4 text-base font-bold">{title}</h4>
			<p class="mt-2 text-sm text-slate-400">{description}</p>
		</div>
	);
}

function NotificationCard({ item, theme, user, onMarkRead, onAccept, onReject, viewedItems }) {
	const tone = getRelativeTone(item.type);
	const borderClass =
		theme === "dark" ? "border-white/10 bg-white/5" : "border-sky-100 bg-white/80";
	const isViewed = viewedItems?.has?.(item.id) || item.read;

	return (
		<motion.div
			layout={true}
			class={cn(
				"group rounded-3xl border p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl",
				borderClass,
				item.read ? "" : "ring-1 ring-sky-400/20",
			)}
		>
			<div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
				<div class="min-w-0 flex-1">
					<div class="flex flex-wrap items-center gap-2">
						<Badge tone={tone}>{TYPE_LABELS[item.type] || "Update"}</Badge>
						{!item.read && <Badge tone="emerald">New</Badge>}
						{item?.meta?.request_id && (
							<span class="rounded-full bg-slate-500/10 px-2.5 py-1 text-xs font-semibold text-slate-300 ring-1 ring-white/10">
								{item.meta.request_id}
							</span>
						)}
					</div>
					<h3 class="mt-3 text-lg font-bold leading-7">
						{item.message || item.title || "Notification"}
					</h3>
					<p
						class={cn(
							"mt-2 text-sm leading-6",
							theme === "dark" ? "text-slate-300" : "text-slate-700",
						)}
					>
						{item.message}
					</p>
					<div
						class={cn(
							"mt-3 flex flex-wrap items-center gap-2 text-xs",
							theme === "dark" ? "text-slate-400" : "text-slate-600",
						)}
					>
						<span>{new Date(item.created_at).toLocaleString()}</span>
					</div>
				</div>

				<div class="flex shrink-0 flex-col gap-2 sm:flex-row md:flex-col lg:flex-row">
					{item.type === "partner_request" &&
						(user?.role === "factory" || user?.role === "admin" || user?.role === "owner") && (
							<>
								<ActionButton variant="success" onClick={onAccept}>
									Accept
								</ActionButton>
								<ActionButton variant="danger" onClick={onReject}>
									Reject
								</ActionButton>
							</>
						)}
					{item.type === "rating_feedback_request" ? (
						<Link
							to={`/ratings/feedback?profile_key=${encodeURIComponent(item?.entity_id || item?.meta?.profile_key || "")}`}
							onClick={() => onMarkRead()}
							class={cn(
								"rounded-full px-3 py-2 text-xs font-semibold text-center transition-all duration-200",
								isViewed
									? "bg-slate-500/10 text-slate-400 hover:bg-slate-500/15 dark:bg-white/5 dark:text-slate-500 dark:hover:bg-white/10"
									: "bg-sky-600 text-white hover:bg-sky-700 shadow-lg shadow-sky-500/20",
							)}
						>
							{isViewed ? "Rated" : "Rate now"}
						</Link>
					) : item.entity_type ? (
						<Link
							to={notificationLink(item, user?.role)}
							onClick={() => onMarkRead()}
							class={cn(
								"rounded-full px-3 py-2 text-xs font-semibold text-center transition-all duration-200",
								isViewed
									? "bg-slate-500/10 text-slate-400 hover:bg-slate-500/15 dark:bg-white/5 dark:text-slate-500 dark:hover:bg-white/10"
									: "bg-sky-600 text-white hover:bg-sky-700 shadow-lg shadow-sky-500/20",
							)}
						>
							{isViewed ? "Viewed" : "View"}
						</Link>
					) : null}
					{!item.read && (
						<ActionButton variant="ghost" onClick={onMarkRead}>
							Mark read
						</ActionButton>
					)}
				</div>
			</div>
		</motion.div>
	);
}

function ViewedCard({ product, theme, onQuickView }) {
	return (
		<motion.div
			layout={true}
			class={cn(
				"rounded-3xl border p-4",
				theme === "dark" ? "border-white/10 bg-white/5" : "border-sky-100 bg-white/85",
			)}
		>
			<div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
				<div>
					<div class="flex flex-wrap items-center gap-2">
						<Badge tone="sky">Viewed</Badge>
						<Badge tone="blue">{product.product?.category || product.category || "--"}</Badge>
					</div>
					<h3 class="mt-3 text-lg font-bold">
						{product.product?.title || product.title || "Product"}
					</h3>
					<div class={cn("mt-1 text-sm", theme === "dark" ? "text-slate-300" : "text-slate-700")}>
						{product.author?.name || product.company || "--"} · Viewed{" "}
						{new Date(product.viewed_at).toLocaleDateString()}
					</div>
					<div class="mt-3 flex flex-wrap gap-2 text-xs text-slate-400">
						<span class="rounded-full bg-white/5 px-2.5 py-1 ring-1 ring-white/10">
							MOQ {product.product?.moq || product.moq || "--"}
						</span>
						<span class="rounded-full bg-white/5 px-2.5 py-1 ring-1 ring-white/10">
							Lead time {product.product?.lead_time_days || product.leadTime || "--"}
						</span>
					</div>
				</div>
				<div class="flex flex-col gap-2 sm:flex-row lg:flex-col xl:flex-row">
					<ActionButton variant="primary" onClick={onQuickView}>
						Quick view
					</ActionButton>
					{product.author?.id && (
						<Link
							to={
								product.author.role === "buying_house"
									? `/buying-house/${product.author.id}`
									: `/factory/${product.author.id}`
							}
							class="rounded-full bg-sky-600 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-700 text-center"
						>
							Company
						</Link>
					)}
				</div>
			</div>
		</motion.div>
	);
}

function DetailRow({ label, value }) {
	return (
		<div class="mb-3 flex items-center justify-between gap-4 border-b border-white/10 pb-3 last:mb-0 last:border-0 last:pb-0">
			<span class="text-xs uppercase tracking-[0.2em] text-slate-400">{label}</span>
			<span class="text-sm font-semibold text-slate-100 dark:text-slate-900">{value}</span>
		</div>
	);
}
