/*
  Route: /feed
  Access: Protected (login required)
  Using the exact template layout with glass-morphism theme
*/

import { motion, useReducedMotion, useScroll, useSpring, useTransform } from "framer-motion";
import {
	BadgeCheck,
	Bell,
	BriefcaseBusiness,
	ChevronDown,
	Filter,
	LayoutGrid,
	Plus,
	Search,
	Upload,
} from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import FeedItemCard from "../components/feed/FeedItemCard.jsx";
import PostDetailModal from "../components/feed/PostDetailModal.jsx";
import ReportModal from "../components/feed/ReportModal.jsx";
import LazyImage from "../components/ui/LazyImage.jsx";
import NeonAtom from "../components/ui/NeonAtom.jsx";
import useLocalStorageState from "../hooks/useLocalStorageState.js";
import { apiRequest, fetchCurrentUser, getCurrentUser, getToken } from "../lib/auth.js";
import { trackClientEvent } from "../lib/events.js";
import { subscribeFeedRealtime } from "../lib/feedRealtime.js";
import { recordLeadSource } from "../lib/leadSource.js";
import { logger } from "../lib/logger.js";
import usePageMeta from "../lib/usePageMeta.js";

const Motion = motion;

// HyperCache Phase 4: SSE-invalidation coalescing state lives in refs inside
// the component (never module scope) so hooks order is unaffected and
// concurrent mounts cannot share the in-flight flag.

const TABS = ["All", "Buyer Requests", "Company Products", "Posts"];

const FEED_CATEGORIES = [
	"All categories",
	"T-Shirt",
	"Polo",
	"Denim",
	"Hoodie",
	"Sportswear",
	"Knitwear",
	"Woven",
	"Outerwear",
];

const DEFAULT_FEED_CONFIG = {
	tabs: ["All", "Buyer Requests", "Company Products", "Posts"],
	labels: {
		feed_center: "Feed Center",
		premium_badge: "Premium moderation dashboard",
		quick_actions: "Quick actions",
		live_status: "Live",
		search: "Search",
		search_placeholder: "Search posts, buyers...",
		categories: "All categories",
		hero_title: "Feed Center",
		hero_description:
			"Browse buyer requests, company products, and posts from one unified workspace.",
		stats: {
			buyer_requests: "Buyer Requests",
			company_products: "Company Products",
			feed_posts: "Feed Posts",
		},
	},
	messages: {
		share_copied: "Share link copied to clipboard.",
		report_submitted: "Report submitted. Thank you.",
		interest_expressed: "Interest expressed.",
		rate_limited: "Please wait a few seconds before reporting again.",
		all_caught_up: "You're all caught up.",
		no_results: "No posts matched your filters.",
		load_failed: "Failed to load feed",
	},
};

// ====== UTILITIES ======
function cx(...classes) {
	return classes.filter(Boolean).join(" ");
}

function formatRelativeTime(value) {
	if (!value) {
		return "";
	}
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		return "";
	}
	const diffMs = Date.now() - date.getTime();
	const diffMinutes = Math.floor(diffMs / 60_000);
	if (diffMinutes < 1) {
		return "Just now";
	}
	if (diffMinutes < 60) {
		return `${diffMinutes}m ago`;
	}
	const diffHours = Math.floor(diffMinutes / 60);
	if (diffHours < 24) {
		return `${diffHours}h ago`;
	}
	const diffDays = Math.floor(diffHours / 24);
	return `${diffDays}d ago`;
}

function buildFeedLeadLabel(item) {
	const title = String(item?.title || "").trim();
	if (title) {
		return title;
	}
	const category = String(item?.category || "").trim();
	if (category) {
		return category;
	}
	const content = String(item?.content || "")
		.replace(/\s+/g, " ")
		.trim();
	if (content) {
		return content.slice(0, 80);
	}
	const author = String(item?.author?.name || "").trim();
	return author ? `${author} update` : "Feed post";
}

function profileUrl(user) {
	if (!user?.id) return "/feed";
	const role = String(user.role || "").toLowerCase();
	if (role === "buyer") return `/buyer/${encodeURIComponent(user.id)}`;
	if (role === "buying_house") return `/buying-house/${encodeURIComponent(user.id)}`;
	return `/factory/${encodeURIComponent(user.id)}`;
}

function normalizeFeedItem(raw) {
	const entityType =
		raw.feed_type === "buyer_request"
			? "buyer_request"
			: raw.feed_type === "user_feed_post"
				? "user_feed_post"
				: "company_product";
	const isBuyerRequest = entityType === "buyer_request";
	const isUserFeedPost = entityType === "user_feed_post";
	const authorId = raw.buyer_id || raw.company_id || raw.user_id || raw.author_id || "";
	const accountType =
		raw.author?.role ||
		raw.company_role ||
		(isBuyerRequest ? "buyer" : isUserFeedPost ? "member" : "factory");
	// Fallback "profile" keeps owner/admin/member/agent posts on a real route
	// instead of an empty rolePath that rendered as a dead link (404).
	const rolePath =
		raw.author?.rolePath ||
		(accountType === "buying_house"
			? "buying-house"
			: accountType === "buyer"
				? "buyer"
				: accountType === "factory"
					? "factory"
					: "profile");

	return {
		id: raw.id,
		entityType,
		author: {
			id: authorId,
			name:
				raw.author?.company_name ||
				raw.company_name ||
				raw.organization_name ||
				raw.author?.name ||
				raw.org ||
				raw.name ||
				"Unknown",
			accountType: accountType
				? String(accountType).replaceAll("_", " ")
				: isBuyerRequest
					? "Buyer"
					: "Company",
			rolePath,
			avatar_url: raw.author?.avatar_url || "",
		},
		verified: Boolean(raw.author?.verified || raw.verified),
		createdAt: formatRelativeTime(raw.created_at),
		content: isBuyerRequest
			? raw.custom_description || ""
			: isUserFeedPost
				? raw.caption || ""
				: raw.description || "",
		title: raw.title || "",
		descriptionMarkdown: raw.description_markdown || "",
		category: raw.category || "",
		tags: [raw.category, raw.material, ...(Array.isArray(raw.hashtags) ? raw.hashtags : [])].filter(
			Boolean,
		),
		material: raw.material || "",
		quantity: raw.quantity || "",
		timelineDays: raw.timeline_days || "",
		shippingTerms: raw.shipping_terms || "",
		certifications: Array.isArray(raw.certifications_required) ? raw.certifications_required : [],
		moq: raw.moq || "",
		leadTimeDays: raw.lead_time_days || "",
		hasVideo: Boolean(
			raw.hasVideo ||
				(!raw.video_restricted && raw.video_review_status === "approved" && raw.video_url),
		),
		media: Array.isArray(raw.media) ? raw.media : [],
		ctaText: raw.cta_text || "",
		ctaUrl: raw.cta_url || "",
		mentions: Array.isArray(raw.mentions) ? raw.mentions : [],
		links: Array.isArray(raw.links) ? raw.links : [],
		link_previews: Array.isArray(raw.link_previews) ? raw.link_previews : [],
		productTags: Array.isArray(raw.product_tags) ? raw.product_tags : [],
		locationTag: raw.location_tag || "",
		emojis: Array.isArray(raw.emojis) ? raw.emojis : [],
		discussionActive: Boolean(raw.discussion_active),
		feedMetadata: raw.feed_metadata || {},
		priorityActive: Boolean(raw.priority_active),
		certificationStatus: raw.order_certification_status || "",
	};
}

async function copyToClipboard(text) {
	if (!text) {
		return false;
	}
	if (navigator.clipboard?.writeText) {
		await navigator.clipboard.writeText(text);
		return true;
	}
	const el = document.createElement("textarea");
	el.value = text;
	el.setAttribute("readonly", "true");
	el.style.position = "fixed";
	el.style.left = "-9999px";
	document.body.appendChild(el);
	el.select();
	const ok = document.execCommand("copy");
	document.body.removeChild(el);
	return ok;
}

// ====== UI COMPONENTS ======
const Pill = memo(function Pill({ children, active = false, onClick }) {
	return (
		<button
			onClick={onClick}
			class={cx(
				"inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-200 sm:gap-2 sm:px-4 sm:py-2 sm:text-sm",
				active
					? "bg-sky-500 text-white shadow-lg shadow-sky-500/25"
					: "bg-white/70 text-slate-600 hover:bg-sky-50 hover:text-sky-700 dark:bg-slate-900/60 dark:text-slate-300 dark:hover:bg-slate-800",
			)}
		>
			{children}
		</button>
	);
});

const StatCard = memo(function StatCard({ icon, label, value, accent = "sky" }) {
	return (
		<div class="rounded-3xl border border-white/60 bg-white/80 p-2.5 shadow-[0_12px_40px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/70 sm:p-3">
			<div class="flex items-center justify-between gap-2">
				<div class="flex-1">
					<p class="text-[10px] font-medium uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400">
						{label}
					</p>
					<p class="text-lg font-semibold text-slate-900 dark:text-white sm:text-xl">{value}</p>
				</div>
				<div
					class={cx(
						"flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
						accent === "sky" && "bg-sky-500/15 text-sky-600 dark:text-sky-400",
						accent === "blue" && "bg-blue-500/15 text-blue-600 dark:text-blue-400",
						accent === "indigo" && "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400",
					)}
				>
					{icon}
				</div>
			</div>
		</div>
	);
});

const ActionButton = memo(function ActionButton({ icon, label, onClick }) {
	return (
		<button
			onClick={onClick}
			class="inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-sky-500 hover:text-white dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-sky-500 dark:hover:text-white"
		>
			{icon}
			{label}
		</button>
	);
});

// ====== MAIN COMPONENT ======
export default function MainFeed() {
	usePageMeta({
		title: "Feed — GarTexHub",
		description:
			"Stay updated with the latest textile and garment industry posts, product launches, and market insights on GarTexHub.",
		url: "/feed",
		robots: "noindex,nofollow",
	});

	const navigate = useNavigate();
	const [searchParams] = useSearchParams();
	const token = useMemo(() => getToken(), []);
	const sessionUser = getCurrentUser();
	const userId = sessionUser?.id || "user";
	const uniqueKey = `gartexhub_unique:${userId}`;

	const [user, setUser] = useState(sessionUser);
	const [feedConfig, setFeedConfig] = useState(DEFAULT_FEED_CONFIG);
	const [activeType, setActiveType] = useState(feedConfig.tabs[0]);
	const [activeCategory, setActiveCategory] = useState(feedConfig.labels.categories);
	const [isLargeScreen, setIsLargeScreen] = useState(window.innerWidth >= 1024);

	useEffect(() => {
		const onResize = () => setIsLargeScreen(window.innerWidth >= 1024);
		window.addEventListener("resize", onResize);
		return () => window.removeEventListener("resize", onResize);
	}, []);
	const [sidebarOpen, setSidebarOpen] = useState(false);
	const [unique, setUnique] = useLocalStorageState(uniqueKey, false);
	const [search, setSearch] = useState("");

	const [items, setItems] = useState([]);
	const [tags, setTags] = useState([]);
	const [nextCursor, setNextCursor] = useState(0);
	const nextCursorRef = useRef(0);
	const setNextCursorBoth = useCallback((val) => {
		setNextCursor(val);
		nextCursorRef.current = val;
	}, []);
	// The page shell renders as soon as the user is known - a signed-in user is
	// already cached from login. The feed list shows its own skeleton, and the
	// labels/config arrive in the background. Waiting for user + config + feed
	// before rendering anything kept a full-screen spinner up for seconds.
	const [pageLoading, setPageLoading] = useState(() => !sessionUser);
	const loadFlags = useRef({ user: Boolean(sessionUser), config: false, feed: false });
	const markLoaded = useCallback((key) => {
		loadFlags.current[key] = true;
		if (loadFlags.current.user) {
			setPageLoading(false);
		}
	}, []);

	const [loading, setLoading] = useState(true);
	const [loadingMore, setLoadingMore] = useState(false);
	const [error, setError] = useState("");
	const [notice, setNotice] = useState({ type: "", message: "" });
	const [filtersOpen, setFiltersOpen] = useState(false);
	const filtersPanelRef = useRef(null);

	const [commentsItem, setCommentsItem] = useState(null);
	const [reportItem, setReportItem] = useState(null);
	const [reportCooldowns, setReportCooldowns] = useState({});
	const [reportBusy, setReportBusy] = useState(false);
	const [expressBusyId, setExpressBusyId] = useState("");
	const [claimedRequestId, setClaimedRequestId] = useState("");

	const liveRef = useRef({
		token,
		activeCategory,
		activeType,
		unique,
		feedConfig,
		nextCursor: nextCursorRef.current,
	});
	liveRef.current = {
		token,
		activeCategory,
		activeType,
		unique,
		feedConfig,
		nextCursor: nextCursorRef.current,
	};

	// HyperCache Phase 4: per-mount invalidation coalescing (replaces the old
	// module-scope flag). Queued invalidations drain after the in-flight pass;
	// the queue is dropped on unmount.
	const syncInFlightRef = useRef(false);
	const syncQueueRef = useRef([]);
	const syncUnmountedRef = useRef(false);
	useEffect(() => {
		syncUnmountedRef.current = false;
		return () => {
			syncUnmountedRef.current = true;
			syncQueueRef.current.length = 0;
		};
	}, []);

	// HyperCache Phase 2: render Dexie feedPosts snapshot instantly on mount (if present).
	// Filtered to the active tab/category so a stale page from another filter
	// never flashes under the current tab.
	useEffect(() => {
		let cancelled = false;
		(async () => {
			try {
				const { getDb } = await import("../offline/db.js");
				const s = liveRef.current;
				const tab = s.activeType || "All";
				const catLabel = s.activeCategory || "";
				const acceptedFeedTypes =
					tab === "Buyer Requests"
						? new Set(["buyer_request", "requests", "request"])
						: tab === "Company Products"
							? new Set(["company_product", "product", "products"])
							: tab === "Posts"
								? new Set(["user_feed_post", "post", "posts"])
								: null;
				const acceptedCategory =
					!catLabel || /^all\b/i.test(catLabel) ? null : catLabel.toLowerCase();
				const rows = await getDb()
					.table("feedPosts")
					.orderBy("updatedAt")
					.reverse()
					.limit(60)
					.toArray();
				const matching = rows.filter((r) => {
					if (acceptedFeedTypes && r?.feed_type && !acceptedFeedTypes.has(String(r.feed_type)))
						return false;
					if (acceptedCategory && String(r?.category || "").toLowerCase() !== acceptedCategory)
						return false;
					return true;
				});
				const page = matching.slice(0, 24);
				if (cancelled || page.length === 0) return;
				const raws = page.map((r) => r.raw || r).filter((r) => r?.id != null);
				if (raws.length === 0) return;
				const normalized = raws
					.map((raw) => {
						try {
							return normalizeFeedItem(raw);
						} catch {
							return null;
						}
					})
					.filter(Boolean);
				if (normalized.length === 0) return;
				setItems(normalized);
				// Dismiss the loading spinner instantly; background refresh still runs below.
				if (!loadFlags.current.feed) markLoaded("feed");
			} catch {
				/* IndexedDB unavailable — fall through to network */
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [markLoaded]);

	const highlightKey = searchParams.get("item") || "";
	const sentinelRef = useRef(null);

	useEffect(() => {
		if (!filtersOpen) return;
		function handleClickOutside(e) {
			if (filtersPanelRef.current && !filtersPanelRef.current.contains(e.target)) {
				setFiltersOpen(false);
			}
		}
		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, [filtersOpen]);

	const reduceMotion = useReducedMotion();
	const { scrollY } = useScroll();
	const heroScale = useSpring(useTransform(scrollY, [0, 200], [1, 0.95]), {
		stiffness: 80,
		damping: 20,
		restDelta: 0.001,
	});
	const bgParallax = useSpring(useTransform(scrollY, [0, 600], [0, -40]), {
		stiffness: 80,
		damping: 20,
		restDelta: 0.001,
	});

	const canExpressInterest = useMemo(() => {
		const role = user?.role || "";
		return role === "buying_house" || role === "admin";
	}, [user?.role]);

	const loadUser = useCallback(async () => {
		const t = liveRef.current.token;
		if (!t) return;
		try {
			const fresh = await fetchCurrentUser(t);
			if (fresh) {
				setUser(fresh);
			}
		} catch {
			/* ignore */
		} finally {
			markLoaded("user");
		}
	}, [markLoaded]);

	const loadFeedPage = useCallback(
		async ({ reset }) => {
			const limit = 12;
			const cursor = reset ? 0 : Number(nextCursorRef.current || 0);

			if (reset) {
				setLoading(true);
				setError("");
				setNotice({ type: "", message: "" });
			} else {
				setLoadingMore(true);
				setError("");
			}

			const s = liveRef.current;
			const token = s.token;
			const feedConfig = s.feedConfig;
			const activeType = s.activeType;
			const activeCategory = s.activeCategory;
			const unique = s.unique;

			if (!token) return;

			try {
				let feedType = activeType;

				// "All" must reach the backend as "all": getCombinedFeed already
				// mixes requests + products + posts, and narrowing by role here
				// made the All tab look empty.
				if (activeType === "All") {
					feedType = "all";
				} else if (activeType === "Buyer Requests") {
					feedType = "requests";
				} else if (activeType === "Company Products") {
					feedType = "products";
				} else if (activeType === "Posts") {
					feedType = "posts";
				}

				const categoryParam =
					activeCategory === feedConfig.labels.categories ? "" : activeCategory.toLowerCase();

				const query = new URLSearchParams({
					unique: unique ? "true" : "false",
					type: feedType,
					category: categoryParam,
					cursor: String(cursor),
					limit: String(limit),
					role_filter: "true",
				}).toString();

				const data = await apiRequest(`/feed?${query}`, { token });
				const rows = Array.isArray(data?.items) ? data.items : [];
				const normalized = rows.map(normalizeFeedItem);

				// HyperCache Phase 2: upsert fresh rows into Dexie (fire-and-forget).
				try {
					const { getDb } = await import("../offline/db.js");
					const now = Date.now();
					const toEpochMs = (value, fallback) => {
						if (value === null || value === undefined || value === "") return fallback;
						if (typeof value === "number" && Number.isFinite(value)) {
							return value < 1e12 ? value * 1000 : value;
						}
						const t = new Date(value).getTime();
						return Number.isFinite(t) ? t : fallback;
					};
					const records = rows
						.filter((r) => r?.id != null)
						.map((r) => ({
							id: r.id,
							feed_type: r.feed_type || "",
							category: r.category || "",
							updatedAt: toEpochMs(r.updated_at ?? r.created_at, now),
							raw: r,
						}));
					if (records.length > 0) {
						getDb()
							.table("feedPosts")
							.bulkPut(records)
							.catch(() => {});
					}
				} catch {
					/* IndexedDB unavailable — ignore */
				}

				setTags(Array.isArray(data?.tags) ? data.tags : []);
				setItems((previous) => {
					if (reset) {
						return normalized;
					}
					const existingIds = new Set(previous.map((i) => i.id));
					const fresh = normalized.filter((i) => !existingIds.has(i.id));
					return fresh.length > 0 ? [...previous, ...fresh] : previous;
				});

				const serverNext = data?.next_cursor;
				setNextCursorBoth(serverNext === null || serverNext === undefined ? null : serverNext);

				if (reset) {
					normalized.slice(0, 6).forEach((item) => {
						trackClientEvent("feed_item_viewed", {
							entityType: item.entityType,
							entityId: item.id,
						});
					});
				}
			} catch (err) {
				setError(err.message || feedConfig.messages.load_failed);
				if (reset) {
					setItems([]);
				}
				setNextCursorBoth(null);
			} finally {
				setLoading(false);
				setLoadingMore(false);
				if (!loadFlags.current.feed && reset) {
					markLoaded("feed");
				}
			}
		},
		[markLoaded],
	);

	useEffect(() => {
		// eslint-disable-next-line react-hooks/set-state-in-effect
		loadUser();
	}, [loadUser]);

	useEffect(() => {
		let cancelled = false;
		const token = getToken();
		if (!token) {
			return markLoaded("config");
		}
		apiRequest("/feed/page-config", { token })
			.then((data) => {
				if (cancelled || !data || typeof data !== "object") return;
				const next = { ...DEFAULT_FEED_CONFIG, ...data };
				setFeedConfig(next);
				const previousAll = liveRef.current.feedConfig?.labels?.categories;
				const nextAll = next.labels?.categories;
				if (nextAll && previousAll !== nextAll) {
					setActiveCategory((current) => (current === previousAll ? nextAll : current));
				}
			})
			.catch(() => logger.warn("Failed to load feed config"))
			.finally(() => {
				if (!cancelled) markLoaded("config");
			});
		return () => {
			cancelled = true;
		};
	}, [markLoaded]);

	useEffect(() => {
		setItems([]);
		setNextCursorBoth(0);
		loadFeedPage({ reset: true });
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [loadFeedPage, activeCategory, activeType, unique]);

	useEffect(() => {
		const node = sentinelRef.current;
		if (!node) {
			return;
		}
		if (nextCursor === null || loadingMore || loading) {
			return;
		}

		const observer = new IntersectionObserver(
			(entries) => {
				const entry = entries[0];
				if (entry?.isIntersecting && !loadingMore && !loading && nextCursor !== null) {
					loadFeedPage({ reset: false });
				}
			},
			{ rootMargin: "220px" },
		);

		observer.observe(node);
		return () => observer.disconnect();
	}, [loadFeedPage, loading, loadingMore, nextCursor]);

	useEffect(() => {
		const token = getToken();
		if (!token) {
			return;
		}

		const source = subscribeFeedRealtime({
			onNewPost(raw) {
				const normalized = normalizeFeedItem({
					...raw,
					feed_type: "user_feed_post",
				});
				setItems((prev) => {
					if (prev.some((i) => i.id === normalized.id)) {
						return prev;
					}
					return [normalized, ...prev];
				});
			},
			onDeletedPost(id) {
				setItems((prev) => prev.filter((i) => i.id !== id));
			},
			onUpdatedPost(raw) {
				const normalized = normalizeFeedItem({
					...raw,
					feed_type: "user_feed_post",
				});
				setItems((prev) => prev.map((i) => (i.id === normalized.id ? normalized : i)));
			},
			// HyperCache Phase 4: SSE invalidations -> offline sync engine delta.
			// Dynamic import with @vite-ignore so the build never breaks when
			// the Phase 2 syncEngine track hasn't landed yet. Coalesced via
			// refs (never module scope); queued events drain after the
			// in-flight pass and are dropped on unmount.
			async onInvalidate(invalidation) {
				if (!invalidation || syncUnmountedRef.current) {
					return;
				}
				if (syncInFlightRef.current) {
					syncQueueRef.current.push(invalidation);
					if (syncQueueRef.current.length > 20) syncQueueRef.current.shift();
					return;
				}
				syncInFlightRef.current = true;
				try {
					let current = invalidation;
					while (current) {
						if (syncUnmountedRef.current) break;
						try {
							const mod = await import(/* @vite-ignore */ "../offline/syncEngine.js");
							const applyDelta =
								mod?.applyDelta || mod?.default?.applyDelta || mod?.syncEngine?.applyDelta;
							if (typeof applyDelta === "function") {
								await applyDelta(current);
							} else if (
								typeof mod?.runSync === "function" ||
								typeof mod?.default?.runSync === "function"
							) {
								// syncEngine (Phase 2) exposes runSync instead of per-event
								// applyDelta — one sync pass catches up from the delta log.
								const runSync = mod.runSync || mod.default.runSync;
								await runSync({ apiRequest, token: getToken() });
							} else {
								// TODO(Phase 2): syncEngine has no delta entrypoint yet.
								logger.debug("[feed] syncEngine has no applyDelta/runSync, skipped", {
									entity: current.entity,
									id: current.id,
								});
							}
						} catch {
							// TODO(Phase 2): syncEngine module not present — invalidation dropped.
							logger.debug("[feed] syncEngine unavailable, skipped applyDelta", {
								entity: current.entity,
								id: current.id,
							});
						}
						current = syncQueueRef.current.shift() || null;
						// Coalesce the backlog into a single extra pass: one runSync
						// already catches up from the delta log.
						if (current && syncQueueRef.current.length > 0) syncQueueRef.current.length = 0;
					}
				} finally {
					syncInFlightRef.current = false;
				}
			},
		});

		return () => {
			syncUnmountedRef.current = true;
			syncQueueRef.current.length = 0;
			source?.close();
		};
	}, []);

	useEffect(() => {
		if (!(highlightKey && items.length > 0)) {
			return;
		}
		const match = items.find((i) => `${i.entityType}:${i.id}` === highlightKey);
		if (match) {
			// eslint-disable-next-line react-hooks/set-state-in-effect
			setCommentsItem(match);
		}
	}, [highlightKey, items]);

	const _nowRef = useRef(null);
	useEffect(() => {
		_nowRef.current = Date.now();
	}, []);
	function isReportCoolingDown(item) {
		const key = `${item.entityType}:${item.id}`;
		const ends = reportCooldowns[key] || 0;
		return ends > _nowRef.current;
	}

	async function handleShare(item) {
		setNotice({ type: "", message: "" });
		try {
			const url = `${window.location.origin}/share/${encodeURIComponent(item.entityType)}/${encodeURIComponent(item.id)}`;
			await copyToClipboard(url);
			await apiRequest(
				`/social/${encodeURIComponent(item.entityType)}/${encodeURIComponent(item.id)}/share`,
				{ method: "POST", token },
			);
			setNotice({ type: "success", message: feedConfig.messages.share_copied });
		} catch (err) {
			setNotice({ type: "error", message: err.message || "Share failed." });
		}
	}

	function handleMessage(item = null) {
		if (item?.id) {
			const sourceType =
				item.entityType === "buyer_request"
					? "buyer_request"
					: item.entityType === "product" || item.entityType === "company_product"
						? "product"
						: "feed_post";
			recordLeadSource({
				type: sourceType,
				id: item.id,
				label: buildFeedLeadLabel(item),
			});
		}
		navigate("/chat", {
			state: {
				lead: item
					? {
							type: item.entityType,
							id: item.id,
							label: buildFeedLeadLabel(item),
						}
					: undefined,
			},
		});
	}

	async function handleExpressInterest(item) {
		if (expressBusyId) {
			return;
		}
		setExpressBusyId(item.id);
		try {
			await apiRequest(`/buyer-requests/${item.id}/express-interest`, {
				method: "POST",
				token,
			});
			setNotice({
				type: "success",
				message: feedConfig.messages.interest_expressed,
			});
			setClaimedRequestId(item.id);
		} catch (err) {
			setNotice({
				type: "error",
				message: err.message || "Failed to express interest.",
			});
		} finally {
			setExpressBusyId("");
		}
	}

	async function handleSubmitReport(reason) {
		setReportBusy(true);
		try {
			await apiRequest(
				`/social/${encodeURIComponent(reportItem.entityType)}/${encodeURIComponent(reportItem.id)}/report`,
				{
					method: "POST",
					token,
					body: { reason },
				},
			);
			setNotice({
				type: "success",
				message: feedConfig.messages.report_submitted,
			});
			setReportItem(null);
			setReportCooldowns((prev) => ({
				...prev,
				[`${reportItem.entityType}:${reportItem.id}`]: Date.now() + 30_000,
			}));
		} catch (err) {
			setNotice({ type: "error", message: err.message || "Report failed." });
		} finally {
			setReportBusy(false);
		}
	}

	const filtered = useMemo(
		() =>
			items.filter((item) => {
				const searchBlob = [
					item.author?.name,
					item.title,
					item.content,
					item.category,
					...(item.tags || []),
					...(item.productTags || []),
				]
					.join(" ")
					.toLowerCase();

				const searchHit = search === "" || searchBlob.includes(search.toLowerCase());
				const categoryHit =
					activeCategory === feedConfig.labels.categories ||
					item.category?.toLowerCase() === activeCategory.toLowerCase();

				return searchHit && categoryHit;
			}),
		[items, search, activeCategory, feedConfig],
	);

	const quickActions = useMemo(() => {
		const role = user?.role || "";
		if (role === "buyer") {
			return [
				{ to: "/buyer-requests", label: "Post a Buyer Request" },
				{ to: "/feed/manage", label: "Create Listing" },
			];
		}
		if (role === "factory") {
			return [
				{ to: "/product-management", label: "Create Listing" },
				{ to: "/member-management", label: "Members" },
			];
		}
		if (role === "buying_house") {
			return [
				{ to: "/product-management", label: "Create Listing" },
				{ to: "/agent", label: "Go to Agent Dashboard" },
			];
		}
		return [
			{ to: "/feed/manage", label: "Create Listing" },
			{ to: "/search", label: "Search" },
		];
	}, [user?.role]);

	const stats = useMemo(
		() => ({
			requests: items.filter((i) => i.entityType === "buyer_request").length,
			products: items.filter(
				(i) => i.entityType === "company_product" || i.entityType === "product",
			).length,
			posts: items.filter((i) => i.entityType === "user_feed_post").length,
		}),
		[items],
	);

	if (pageLoading) {
		return <NeonAtom fill={true} size={80} text="Loading feed..." timeout={10_000} />;
	}

	return (
		<div class="flex min-h-0 flex-1 flex-col bg-slate-50 text-slate-900 dark:bg-[var(--theme-custom-0b1220)] dark:text-slate-100">
			<motion.div
				style={{ y: reduceMotion ? 0 : bgParallax }}
				class="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,_rgba(109,171,223,0.14),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(55,115,168,0.12),_transparent_25%),linear-gradient(180deg,#f8fbff_0%,#eef8ff_48%,#f8fbff_100%)] dark:bg-[radial-gradient(circle_at_top_left,_rgba(109,171,223,0.20),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(55,115,168,0.16),_transparent_25%),linear-gradient(180deg,#07111f_0%,#081627_45%,#06111f_100%)]"
			/>
			<div class="flex min-h-0 flex-1 flex-col text-slate-900 transition-colors dark:text-white">
				<div class="mx-auto flex w-full max-w-[1500px] flex-1 flex-col gap-4 px-4 py-4 sm:gap-6 md:px-6 lg:flex-row lg:overflow-hidden lg:p-6 min-h-0">
					{/* Mobile hamburger */}
					<div class="flex items-center justify-between lg:hidden">
						<h1 class="text-base font-bold text-slate-900 dark:text-white sm:text-lg">Feed</h1>
						<button
							onClick={() => setSidebarOpen(true)}
							class="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/80 text-slate-600 shadow-sm dark:bg-slate-800 dark:text-slate-300"
							aria-label="Open sidebar"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								class="h-5 w-5"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								strokeWidth={2}
							>
								<path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
							</svg>
						</button>
					</div>

					{/* Mobile drawer overlay */}
					{sidebarOpen && (
						<div class="fixed inset-0 z-50 lg:hidden">
							<div class="absolute inset-0 bg-black/40" onClick={() => setSidebarOpen(false)} />
							<aside class="absolute left-0 top-0 h-full w-[320px] max-w-[85vw] overflow-y-auto border-r border-white/10 bg-white/95 p-4 backdrop-blur-2xl dark:bg-slate-950/95">
								<div class="flex justify-end mb-4">
									<button
										onClick={() => setSidebarOpen(false)}
										class="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
										aria-label="Close sidebar"
									>
										✕
									</button>
								</div>
								{/* ====== MOBILE SIDEBAR CONTENT ====== */}
								{/* Header */}
								<Link
									to={profileUrl(user)}
									onClick={() => setSidebarOpen(false)}
									class="block rounded-[28px] bg-gradient-to-br from-sky-500 via-blue-600 to-cyan-400 p-5 text-white shadow-xl shadow-sky-500/20 transition hover:shadow-2xl hover:shadow-sky-500/30"
								>
									<div class="flex items-center justify-between">
										<div class="flex items-center gap-3">
											{user?.profile?.profile_image || user?.avatar_url ? (
												<img
													src={user.profile?.profile_image || user.avatar_url}
													alt={user?.name || "User"}
													class="h-12 w-12 rounded-2xl object-cover"
												/>
											) : (
												<div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
													<LayoutGrid class="h-6 w-6" />
												</div>
											)}
											<div>
												<p class="text-sm/none font-medium opacity-90">
													{user?.role
														? user.role.charAt(0).toUpperCase() +
															user.role.slice(1).replace(/_/g, " ")
														: "User"}
												</p>
												<p class="text-lg font-semibold sm:text-xl">
													{user?.name || "Feed Center"}
												</p>
											</div>
										</div>
									</div>
									<div class="mt-4 flex items-center gap-2 text-sm opacity-95">
										<BadgeCheck class="h-4 w-4" />
										{user?.profile?.bio || feedConfig.labels.premium_badge}
									</div>
									{user?.email && <div class="mt-2 text-xs opacity-75">{user.email}</div>}
								</Link>
								{/* Quick Actions */}
								<div class="mt-4 rounded-[28px] border border-slate-200 bg-white/75 p-4 dark:border-slate-800 dark:bg-slate-900/60">
									<div class="flex items-center justify-between">
										<h2 class="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
											{feedConfig.labels.quick_actions}
										</h2>
										<span class="rounded-full bg-sky-500/10 px-2.5 py-1 text-xs font-medium text-sky-700 dark:text-sky-300">
											{feedConfig.labels.live_status}
										</span>
									</div>
									<div class="mt-4 grid gap-3">
										{quickActions.map((a) => (
											<Link
												key={a.to}
												to={a.to}
												onClick={() => setSidebarOpen(false)}
												class="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 text-left text-sm font-medium text-slate-700 transition hover:bg-sky-50 hover:text-sky-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-sky-500/10 dark:hover:text-sky-300"
											>
												<span class="flex items-center gap-2">
													{a.label.includes("Post") ? (
														<Upload class="h-4 w-4" />
													) : (
														<Plus class="h-4 w-4" />
													)}
													{a.label}
												</span>
												<ChevronDown class="h-4 w-4" />
											</Link>
										))}
									</div>
								</div>
								{/* Search */}
								<div class="mt-4 rounded-[28px] border border-slate-200 bg-white/75 p-4 dark:border-slate-800 dark:bg-slate-900/60">
									<div class="flex items-center justify-between gap-3">
										<h2 class="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
											Search
										</h2>
										<span class="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">
											Feed
										</span>
									</div>
									<div class="mt-4 relative">
										<Search class="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
										<input
											value={search}
											onChange={(e) => setSearch(e.target.value)}
											placeholder={feedConfig.labels.search_placeholder}
											class="w-full rounded-2xl border border-slate-200 bg-white px-11 py-3 text-sm outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-400/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
										/>
									</div>
								</div>
							</aside>
						</div>
					)}

					{/* ====== SIDEBAR ====== */}
					<aside
						data-lenis-prevent={isLargeScreen ? true : undefined}
						class="hidden lg:flex h-fit w-full flex-col gap-4 rounded-[32px] border border-white/70 bg-white/75 p-4 shadow-[0_30px_80px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/70 lg:h-full lg:w-[320px] lg:overflow-y-auto scrollbar-invisible"
					>
						{/* Header */}
						<Link
							to={profileUrl(user)}
							class="block rounded-[28px] bg-gradient-to-br from-sky-500 via-blue-600 to-cyan-400 p-5 text-white shadow-xl shadow-sky-500/20 transition hover:shadow-2xl hover:shadow-sky-500/30"
						>
							<div class="flex items-center justify-between">
								<div class="flex items-center gap-3">
									{user?.profile?.profile_image || user?.avatar_url ? (
										<img
											src={user.profile?.profile_image || user.avatar_url}
											alt={user?.name || "User"}
											class="h-12 w-12 rounded-2xl object-cover"
										/>
									) : (
										<div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
											<LayoutGrid class="h-6 w-6" />
										</div>
									)}
									<div>
										<p class="text-sm/none font-medium opacity-90">
											{user?.role
												? user.role.charAt(0).toUpperCase() + user.role.slice(1).replace(/_/g, " ")
												: "User"}
										</p>
										<p class="text-xl font-semibold">{user?.name || "Feed Center"}</p>
									</div>
								</div>
							</div>
							<div class="mt-4 flex items-center gap-2 text-sm opacity-95">
								<BadgeCheck class="h-4 w-4" />
								{user?.profile?.bio || feedConfig.labels.premium_badge}
							</div>
							{user?.email && <div class="mt-2 text-xs opacity-75">{user.email}</div>}
						</Link>

						{/* Quick Actions */}
						<div class="rounded-[28px] border border-slate-200 bg-white/75 p-4 dark:border-slate-800 dark:bg-slate-900/60">
							<div class="flex items-center justify-between">
								<h2 class="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
									{feedConfig.labels.quick_actions}
								</h2>
								<span class="rounded-full bg-sky-500/10 px-2.5 py-1 text-xs font-medium text-sky-700 dark:text-sky-300">
									{feedConfig.labels.live_status}
								</span>
							</div>
							<div class="mt-4 grid gap-3">
								{quickActions.map((a) => (
									<Link
										key={a.to}
										to={a.to}
										class="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 text-left text-sm font-medium text-slate-700 transition hover:bg-sky-50 hover:text-sky-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-sky-500/10 dark:hover:text-sky-300"
									>
										<span class="flex items-center gap-2">
											{a.label.includes("Post") ? (
												<Upload class="h-4 w-4" />
											) : (
												<Plus class="h-4 w-4" />
											)}
											{a.label}
										</span>
										<ChevronDown class="h-4 w-4" />
									</Link>
								))}
							</div>
						</div>

						{/* Search */}
						<div class="rounded-[28px] border border-slate-200 bg-white/75 p-4 dark:border-slate-800 dark:bg-slate-900/60">
							<div class="flex items-center justify-between gap-3">
								<h2 class="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
									Search
								</h2>
								<span class="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">
									Feed
								</span>
							</div>
							<div class="mt-4 relative">
								<Search class="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
								<input
									value={search}
									onChange={(e) => setSearch(e.target.value)}
									placeholder={feedConfig.labels.search_placeholder}
									class="w-full rounded-2xl border border-slate-200 bg-white px-11 py-3 text-sm outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-400/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
								/>
							</div>
						</div>
					</aside>

					{/* ====== MAIN CONTENT ====== */}
					<main
						data-lenis-prevent={isLargeScreen ? true : undefined}
						class="min-w-0 flex-1 space-y-4 overflow-y-auto pb-4 sm:space-y-6 lg:pb-0 scrollbar-invisible"
					>
						{/* Hero Section */}
						<motion.section
							class="rounded-[32px] border border-white/70 bg-white/75 p-4 shadow-[0_30px_80px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/70 sm:p-5 md:p-6"
							style={{ scale: reduceMotion ? 1 : heroScale }}
						>
							<div class="flex flex-col gap-3 sm:gap-5 xl:flex-row xl:items-end xl:justify-between">
								<div class="grid grid-cols-3 gap-2 sm:gap-3 xl:w-[540px]">
									<StatCard
										icon={<BriefcaseBusiness class="h-3 w-3" />}
										label={feedConfig.labels.stats.buyer_requests}
										value={String(stats.requests)}
										accent="sky"
									/>
									<StatCard
										icon={<LayoutGrid class="h-3 w-3" />}
										label={feedConfig.labels.stats.company_products}
										value={String(stats.products)}
										accent="blue"
									/>
									<StatCard
										icon={<Bell class="h-3 w-3" />}
										label={feedConfig.labels.stats.feed_posts}
										value={String(stats.posts)}
										accent="indigo"
									/>
								</div>
							</div>
						</motion.section>

						{/* Tabs */}
						<section class="rounded-[32px] border border-white/70 bg-white/75 p-3 shadow-[0_30px_80px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/70 sm:p-4 md:p-5">
							<div class="flex flex-col gap-3 sm:gap-4 xl:flex-row xl:items-center xl:justify-between">
								<div class="flex flex-wrap gap-2">
									{feedConfig.tabs.map((tab) => (
										<Pill key={tab} active={activeType === tab} onClick={() => setActiveType(tab)}>
											{tab}
										</Pill>
									))}
									<button
										type="button"
										onClick={() => setUnique((v) => !v)}
										class={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all sm:px-4 sm:py-2 sm:text-sm ${
											unique
												? "bg-emerald-500 text-white shadow-md shadow-emerald-500/25"
												: "border border-slate-200 bg-white text-slate-600 hover:border-sky-300 hover:text-sky-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-sky-500/30"
										}`}
									>
										{unique ? "Unique ON" : "Unique OFF"}
									</button>
								</div>
								<div class="flex flex-wrap items-center gap-3">
									<button
										onClick={() => setFiltersOpen((v) => !v)}
										class="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:border-sky-300 hover:text-sky-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-sky-500/30 dark:hover:text-sky-300 sm:gap-2 sm:px-4 sm:py-2.5 sm:text-sm"
									>
										<Filter class="h-3.5 w-3.5 sm:h-4 sm:w-4" />
										Filters
									</button>
									<Link
										to="/feed/manage"
										class="inline-flex items-center gap-1.5 rounded-full bg-sky-500 px-3 py-2 text-xs font-semibold text-white shadow-lg shadow-sky-500/25 transition hover:bg-sky-600 sm:gap-2 sm:px-4 sm:py-2.5 sm:text-sm"
									>
										<Plus class="h-3.5 w-3.5 sm:h-4 sm:w-4" />
										Create post
									</Link>
								</div>
							</div>
						</section>

						{/* Filter Panel */}
						{filtersOpen && (
							<section
								ref={filtersPanelRef}
								class="rounded-[32px] border border-white/70 bg-white/75 p-4 shadow-[0_30px_80px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/70 sm:p-5"
							>
								<div class="flex items-center justify-between mb-4">
									<h3 class="text-sm font-semibold text-slate-700 dark:text-slate-200">
										Filter by Category
									</h3>
									<button
										onClick={() => setFiltersOpen(false)}
										class="text-xs text-slate-500 hover:text-sky-600 dark:text-slate-400 dark:hover:text-sky-400"
									>
										Close
									</button>
								</div>
								<div class="flex flex-wrap gap-2">
									{FEED_CATEGORIES.map((cat) => (
										<button
											key={cat}
											type="button"
											onClick={() => setActiveCategory(cat)}
											class={`rounded-full px-4 py-2 text-sm font-medium transition-all ${
												activeCategory === cat
													? "bg-sky-500 text-white shadow-md shadow-sky-500/25"
													: "border border-slate-200 bg-white text-slate-600 hover:border-sky-300 hover:text-sky-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-sky-500/30"
											}`}
										>
											{cat}
										</button>
									))}
								</div>
							</section>
						)}

						{/* Notice */}
						{notice?.message && (
							<div
								class={`rounded-2xl p-4 text-sm ring-1 ${
									notice.type === "error"
										? "bg-rose-50 text-rose-800 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-200 dark:ring-rose-500/30"
										: notice.type === "success"
											? "bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-200 dark:ring-emerald-500/25"
											: "bg-sky-50 text-sky-800 ring-sky-200 dark:bg-sky-500/10 dark:text-sky-200 dark:ring-sky-500/25"
								}`}
							>
								<div class="flex items-center justify-between gap-3">
									<p class="font-medium">{notice.message}</p>
									{claimedRequestId && (
										<button
											type="button"
											onClick={() =>
												navigate("/chat", {
													state: {
														notice: `Buyer request ${claimedRequestId} claimed. Open inbox to continue.`,
													},
												})
											}
											class="rounded-full bg-white px-3 py-2 text-xs font-semibold text-slate-700 ring-1 ring-slate-200/70 hover:bg-slate-50 active:scale-95 dark:bg-white/5 dark:text-slate-100 dark:ring-white/10 dark:hover:bg-white/8"
										>
											Open Chat
										</button>
									)}
								</div>
							</div>
						)}

						{/* Feed Items */}
						<section class="grid gap-5">
							{error ? (
								<div class="rounded-2xl bg-rose-50 p-6 text-sm text-rose-800 ring-1 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-200 dark:ring-rose-500/30">
									{error}
									<div class="mt-3">
										<button
											type="button"
											onClick={() => loadFeedPage({ reset: true })}
											class="rounded-full bg-white px-4 py-2 text-xs font-semibold text-slate-700 ring-1 ring-slate-200/70 hover:bg-slate-50 active:scale-95 dark:bg-white/5 dark:text-slate-100 dark:ring-white/10 dark:hover:bg-white/8"
										>
											Retry
										</button>
									</div>
								</div>
							) : null}

							{loading && items.length === 0 && !error ? (
								<div className="grid gap-5" aria-busy="true" aria-label="Loading feed">
									{[0, 1, 2].map((n) => (
										<div
											key={n}
											className="animate-pulse rounded-[32px] border border-slate-200/70 bg-white/70 p-6 dark:border-slate-800 dark:bg-slate-950/70"
										>
											<div className="flex items-center gap-3">
												<div className="h-10 w-10 rounded-full bg-slate-200 dark:bg-slate-800" />
												<div className="h-3 w-40 rounded bg-slate-200 dark:bg-slate-800" />
											</div>
											<div className="mt-5 h-3 w-full rounded bg-slate-200 dark:bg-slate-800" />
											<div className="mt-3 h-3 w-2/3 rounded bg-slate-200 dark:bg-slate-800" />
										</div>
									))}
								</div>
							) : null}

							{!(loading || error) && filtered.length === 0 && (
								<div class="rounded-[32px] border border-dashed border-slate-300 bg-white/70 p-6 text-center text-slate-500 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-400 sm:p-10">
									{feedConfig.messages.no_results}
								</div>
							)}

							{!(loading || error) &&
								// eslint-disable-next-line react-hooks/refs
								filtered.map((item, idx) => {
									const highlight = highlightKey === `${item.entityType}:${item.id}`;
									const reportDisabled = isReportCoolingDown(item);

									return (
										<motion.div
											key={`${item.entityType}:${item.id}`}
											initial={reduceMotion ? false : { opacity: 0, y: 20 }}
											animate={reduceMotion ? false : { opacity: 1, y: 0 }}
											transition={{
												duration: 0.45,
												ease: [0.16, 1, 0.3, 1],
												delay: idx * 0.05,
											}}
										>
											<FeedItemCard
												item={item}
												highlight={highlight}
												canExpressInterest={
													canExpressInterest && item.entityType === "buyer_request"
												}
												expressInterestDisabled={expressBusyId === item.id}
												onExpressInterest={() => handleExpressInterest(item)}
												onOpenComments={() => setCommentsItem(item)}
												onShare={() => handleShare(item)}
												onReport={() => {
													if (reportDisabled) {
														setNotice({
															type: "info",
															message: feedConfig.messages.rate_limited,
														});
														return;
													}
													setReportItem(item);
												}}
												onMessage={() => handleMessage(item)}
											/>
										</motion.div>
									);
								})}

							<div ref={sentinelRef} class="h-10" />

							{loadingMore ? (
								<div class="rounded-[28px] border border-white/60 bg-white/85 shadow-[0_20px_70px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/75 p-5">
									<div class="h-3 w-40 mx-auto rounded-full relative overflow-hidden bg-slate-200/80 dark:bg-white/5" />
								</div>
							) : null}

							{!(loading || error) && nextCursor === null ? (
								<div class="text-center text-xs text-slate-400 dark:text-slate-500 py-3">
									{feedConfig.messages.all_caught_up}
								</div>
							) : null}
						</section>
					</main>
				</div>

				<PostDetailModal
					open={Boolean(commentsItem)}
					onClose={() => setCommentsItem(null)}
					item={commentsItem}
					onShare={() => commentsItem && handleShare(commentsItem)}
				/>
				<ReportModal
					open={Boolean(reportItem)}
					item={reportItem}
					onClose={() => setReportItem(null)}
					onSubmit={(reason) => handleSubmitReport(reason)}
				/>
			</div>
		</div>
	);
}
