/**
 * @typedef {import('../lib/types').User} User
 */

import { AnimatePresence, motion, useReducedMotion, useScroll, useSpring, useTransform } from "framer-motion";
import {
	BadgeCheck,
	BriefcaseBusiness,
	Building,
	Building2,
	CalendarDays,
	CheckCircle2,
	ChevronDown,
	ChevronLeft,
	CircleDashed,
	ClipboardList,
	Edit3,
	Eye,
	Handshake,
	Heart,
	Mail,
	MapPin,
	MessageSquare,
	Rocket,
	ShieldCheck,
	Sparkles,
	Star,
	Trash2,
	Users,
} from "lucide-react";
/*
  Route: /buyer/:id
  Access: Protected (login required)
  Allowed roles: buyer, buying_house, factory, owner, admin, agent

  Public Pages:
    /, /pricing, /about, /terms, /privacy, /help, /login, /signup, /access-denied
  Protected Pages (login required):
    /feed, /search, /buyer/:id, /factory/:id, /buying-house/:id, /contracts,
    /notifications, /chat, /call, /verification, /verification-center

  Primary responsibilities:
    - Render the Buyer profile (overview + requests).
    - Show trust indicators (verification summary, credibility meter, verified badge).
    - Provide relationship actions (follow/connect/message).

  Key API endpoints:
    - GET /api/profiles/:id
    - GET /api/ratings/profiles/user::id (public ratings summary)
    - GET /api/profiles/:id/requests?cursor=...
*/
import { useCallback, useEffect, useMemo, useState } from "react";
import { Atom } from "react-loading-indicators";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import JourneyTimeline from "../components/JourneyTimeline.jsx";
import CrmSummaryPanel from "../components/profile/CrmSummaryPanel.jsx";
import VerificationPanel from "../components/profile/VerificationPanel.jsx";
import LazyImage from "../components/ui/LazyImage.jsx";
import NeonAtom from "../components/ui/NeonAtom.jsx";
import { usePremiumCheck } from "../hooks/useSecureUser.js";
import { apiRequest, getCurrentUser, getToken } from "../lib/auth.js";
import { useFallbackCover } from "../lib/fallbackCover.js";
import { trackClientEvent } from "../lib/events.js";
import { recordLeadSource } from "../lib/leadSource.js";
import { logger } from "../lib/logger.js";
import { industryLabel } from "../../shared/config/platformTaxonomy.js";

const Motion = motion;

/**
 * Maps a role and ID to a route.
 * @param {string} role The user role.
 * @param {string} id The user ID.
 * @returns {string} The route path.
 */
function roleToRoute(role, id) {
	if (!id) {
		return "/feed";
	}
	if (role === "buyer") {
		return `/buyer/${encodeURIComponent(id)}`;
	}
	if (role === "buying_house") {
		return `/buying-house/${encodeURIComponent(id)}`;
	}
	return `/factory/${encodeURIComponent(id)}`;
}

/**
 * Checks if a profile boost is currently active.
 * @param {Object} boost The boost object.
 * @returns {boolean} True if active.
 */
function isBoostActive(boost) {
	if (!boost) {
		return false;
	}
	if (String(boost.status || "").toLowerCase() !== "active") {
		return false;
	}
	const now = Date.now();
	const startsAt = new Date(boost.starts_at).getTime();
	const endsAt = new Date(boost.ends_at).getTime();
	if (!(Number.isFinite(startsAt) && Number.isFinite(endsAt))) {
		return false;
	}
	return now >= startsAt && now <= endsAt;
}

/**
 * Renders a stylized pill component.
 * @param {Object} props
 * @param {React.ReactNode} props.children
 * @param {string} [props.tone="default"]
 * @param {string} [props.title]
 * @returns {JSX.Element}
 */
function Pill({ children, tone = "default", title }) {
	const tones = {
		default: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
		success: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
		info: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
		warning: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
		premium: "bg-gradient-to-r from-sky-500 to-cyan-500 text-white",
		danger: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
	};
	return (
		<span
			title={title}
			className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${tones[tone] || tones.default}`}
		>
			{children}
		</span>
	);
}

/**
 * Renders a metric card.
 * @param {Object} props
 * @param {string} props.label
 * @param {React.ReactNode} props.value
 * @param {React.ReactNode} [props.helper]
 * @returns {JSX.Element}
 */
function Metric({ label, value, helper }) {
	return (
		<div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800/80 dark:bg-slate-900/40">
			<div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
				{label}
			</div>
			<div className="mt-1.5 text-sm font-bold text-slate-900 dark:text-white">{value}</div>
			{helper ? <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{helper}</div> : null}
		</div>
	);
}

function InfoRow({ label, children }) {
	return (
		<div className="flex items-center justify-between gap-3 py-2">
			<span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
				{label}
			</span>
			<span className="text-right text-sm font-bold text-slate-900 dark:text-white">{children}</span>
		</div>
	);
}

function EmptyState({ icon: Icon, text, action }) {
	return (
		<div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-300/70 bg-slate-50/50 px-4 py-8 text-center dark:border-slate-700/70 dark:bg-slate-900/20">
			{Icon ? (
				<span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-500 dark:text-sky-300">
					<Icon className="h-5 w-5" />
				</span>
			) : null}
			<p className="text-sm text-slate-500 dark:text-slate-400">{text}</p>
			{action}
		</div>
	);
}

/**
 * Renders an avatar with fallback initials.
 * @param {Object} props
 * @param {string} props.name
 * @param {string} [props.imageUrl]
 * @returns {JSX.Element}
 */
function AvatarFallback({ name, imageUrl, compact = false }) {
	const initials = (n) => {
		if (!n) {
			return "?";
		}
		return n
			.split(/\s+/)
			.filter(Boolean)
			.slice(0, 2)
			.map((p) => p[0]?.toUpperCase())
			.join("");
	};
	return (
		<div className={`relative overflow-hidden border border-white/60 bg-gradient-to-br from-sky-500 via-cyan-400 to-indigo-500 p-[2px] shadow-xl ${compact ? "h-12 w-12 rounded-2xl" : "h-24 w-24 rounded-3xl"}`}>
			<div className={`flex h-full w-full items-center justify-center overflow-hidden bg-slate-100 font-bold text-slate-700 dark:bg-slate-900 dark:text-slate-100 ${compact ? "rounded-[0.85rem] text-base" : "rounded-[1.15rem] text-2xl"}`}>
				{imageUrl ? (
            <LazyImage src={imageUrl} alt={name || "Profile avatar"} width={40} height={40} loading="eager" className="h-full w-full object-cover" />
				) : (
					initials(name)
				)}
			</div>
		</div>
	);
}

/**
 * Renders a card with soft styling.
 * @param {Object} props
 * @param {React.ReactNode} props.children
 * @param {string} [props.className]
 * @returns {JSX.Element}
 */
function SoftCard({ children, className = "" }) {
	return (
		<div
			className={`rounded-3xl border border-slate-200/70 bg-white/75 p-4 shadow-[0_10px_40px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-950/65 ${className}`}
		>
			{children}
		</div>
	);
}

/**
 * Renders a section title.
 * @param {Object} props
 * @param {React.ComponentType} [props.icon]
 * @param {string} props.title
 * @param {string} [props.subtitle]
 * @param {React.ReactNode} [props.action]
 * @returns {JSX.Element}
 */
function SectionTitle({ icon: Icon, title, subtitle, action }) {
	return (
		<div className="mb-4 flex items-start justify-between gap-3">
			<div>
				<div className="flex items-center gap-2">
					{Icon ? <Icon className="h-4 w-4 text-sky-500" /> : null}
					<h3 className="text-sm font-semibold tracking-wide text-slate-900 dark:text-slate-100">
						{title}
					</h3>
				</div>
				{subtitle ? (
					<p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
				) : null}
			</div>
			{action}
		</div>
	);
}

/**
 * Buyer profile page component.
 * @returns {JSX.Element}
 */
export default function BuyerProfile() {
	const { id } = useParams();
	const navigate = useNavigate();
	const location = useLocation();
	const token = useMemo(() => getToken(), []);
	const currentUser = useMemo(() => getCurrentUser(), []);
	const { isPremium: isPremiumFromApi } = usePremiumCheck();

	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [profile, setProfile] = useState(null);
	const [ratingSummary, setRatingSummary] = useState(null);
	const [certification, setCertification] = useState(null);

	const [activeTab, setActiveTab] = useState("overview");
	const [requests, setRequests] = useState([]);
	const [requestsCursor, setRequestsCursor] = useState(0);
	const [requestsNext, setRequestsNext] = useState(null);
	const [loadingRequests, setLoadingRequests] = useState(false);
	const [profileBoost, setProfileBoost] = useState(null);
	const reduceMotion = useReducedMotion();
	const { scrollY } = useScroll();
	const coverParallax = useSpring(useTransform(scrollY, [0, 400], [0, 60]), {
		stiffness: 80,
		damping: 20,
		restDelta: 0.001,
	});
	const journeyParams = useMemo(() => new URLSearchParams(location.search), [location.search]);

	const user = profile?.user || null;
	const verification = profile?.verification_summary || null;
	const relationship = profile?.relationship || {
		following: false,
		friend_status: "none",
	};
	const viewerPerms = profile?.viewer_permissions || {
		is_self: false,
		is_admin: false,
	};
	const [reviewEditModal, setReviewEditModal] = useState({
		open: false,
		id: null,
		score: 5,
		comment: "",
	});
	const [moreActionsOpen, setMoreActionsOpen] = useState(false);
	const [reviewDeleteId, setReviewDeleteId] = useState(null);
	const [feedback, setFeedback] = useState(null);
	const fallbackCover = useFallbackCover(!user?.profile?.cover_image_url);
	const [editingCapacity, setEditingCapacity] = useState(false);
	const [capacityValue, setCapacityValue] = useState("");
	const isBoosted = Boolean(profileBoost);
	const isPremium =
		isPremiumFromApi ||
		String(user?.subscription_status || "").toLowerCase() === "premium" ||
		profile?.effective_plan === "premium";
	const isSelfOrAdmin = viewerPerms.is_self || viewerPerms.is_admin;
	const hasRelationship = relationship.friend_status === "friends";
	const brandProfile = isSelfOrAdmin || hasRelationship ? profile?.profile_private || user?.profile || {} : {};
	const hasBrandKit = Boolean(
		brandProfile.brand_name ||
			brandProfile.brand_logo_url ||
			brandProfile.brand_tagline,
	);
	const hasAccountManager = Boolean(
		brandProfile.account_manager_name ||
			brandProfile.account_manager_email ||
			brandProfile.account_manager_phone,
	);
	const isCertified = String(certification?.status || "").toLowerCase() === "certified";

	const loadProfile = useCallback(async () => {
		if (!id) {
			return;
		}
		setLoading(true);
		setError("");
		try {
			const data = await apiRequest(`/profiles/${encodeURIComponent(id)}`, {
				token,
			});
			if (data?.user?.role && data.user.role !== "buyer") {
				navigate(roleToRoute(data.user.role, id), { replace: true });
				return;
			}
			setProfile(data);
		} catch (err) {
			setError(err.message || "Failed to load profile");
			setProfile(null);
		} finally {
			setLoading(false);
		}
	}, [id, navigate, token]);

	const loadRatings = useCallback(async () => {
		if (!id) {
			return;
		}
		try {
			const data = await apiRequest(`/ratings/profiles/user:${encodeURIComponent(id)}`, {
				token: "",
			});
			setRatingSummary(data || null);
		} catch (err) {
			logger.warn("API error:", err);
			setRatingSummary(null);
		}
	}, [id]);

	const loadCertification = useCallback(async () => {
		if (!(id && token)) {
			return;
		}
		try {
			const data = await apiRequest(`/certifications/org/${encodeURIComponent(id)}`, { token });
			setCertification(data?.summary || null);
		} catch (err) {
			logger.warn("API error:", err);
			setCertification(null);
		}
	}, [id, token]);

	const loadRequests = useCallback(
		async ({ reset }) => {
			if (!id) {
				return;
			}
			const cursor = reset ? 0 : requestsCursor;
			setLoadingRequests(true);
			try {
				const data = await apiRequest(
					`/profiles/${encodeURIComponent(id)}/requests?cursor=${cursor}&limit=10`,
					{ token },
				);
				const rows = Array.isArray(data?.items) ? data.items : [];
				setRequests((prev) => (reset ? rows : [...prev, ...rows]));
				setRequestsCursor(reset ? 10 : cursor + 10);
				setRequestsNext(data?.next_cursor ?? null);
			} catch (err) {
				logger.warn("API error:", err);
			} finally {
				setLoadingRequests(false);
			}
		},
		[id, requestsCursor, token],
	);

	useEffect(() => {
		if (!id) {
			return;
		}
		let cancelled = false;

		apiRequest(`/profiles/${encodeURIComponent(id)}`, { token })
			.then((data) => {
				if (cancelled) {
					return;
				}
				setError("");
				if (data?.user?.role && data.user.role !== "buyer") {
					navigate(roleToRoute(data.user.role, id), { replace: true });
					return;
				}
				setProfile(data);
			})
			.catch((err) => {
				if (!cancelled) {
					setError(err.message || "Failed to load profile");
					setProfile(null);
				}
			})
			.finally(() => {
				if (!cancelled) {
					setLoading(false);
				}
			});

		apiRequest(`/ratings/profiles/user:${encodeURIComponent(id)}`, {
			token: "",
		})
			.then((data) => {
				if (!cancelled) {
					setRatingSummary(data || null);
				}
			})
			.catch((err) => {
				logger.warn("API error:", err);
				if (!cancelled) {
					setRatingSummary(null);
				}
			});

		if (token) {
			apiRequest(`/certifications/org/${encodeURIComponent(id)}`, { token })
				.then((data) => {
					if (!cancelled) {
						setCertification(data?.summary || null);
					}
				})
				.catch((err) => {
					logger.warn("API error:", err);
					if (!cancelled) {
						setCertification(null);
					}
				});
		}

		return () => {
			cancelled = true;
		};
	}, [id, navigate, token]);

	useEffect(() => {
		if (!user?.id) {
			return;
		}
		trackClientEvent("profile_view", {
			entityType: "profile",
			entityId: user.id,
			metadata: { role: user.role || "buyer" },
		});
	}, [user?.id, user?.role]);

	useEffect(() => {
		if (!viewerPerms.is_self) {
			return;
		}
		const tokenValue = getToken();
		if (!tokenValue) {
			return;
		}
		apiRequest("/boosts/me", { token: tokenValue })
			.then((data) => {
				const active = (data?.items || []).find(
					(boost) => boost.scope === "profile" && isBoostActive(boost),
				);
				setProfileBoost(active || null);
			})
			.catch(() => setProfileBoost(null));
	}, [viewerPerms.is_self]);

	useEffect(() => {
		if (activeTab !== "requests") {
			return;
		}
		if (requests.length > 0) {
			return;
		}
		if (!id) {
			return;
		}
		let cancelled = false;

		queueMicrotask(() => {
			if (!cancelled) {
				setLoadingRequests(true);
			}
		});

		apiRequest(`/profiles/${encodeURIComponent(id)}/requests?cursor=0&limit=10`, { token })
			.then((data) => {
				if (cancelled) {
					return;
				}
				const rows = Array.isArray(data?.items) ? data.items : [];
				setRequests(rows);
				setRequestsCursor(10);
				setRequestsNext(data?.next_cursor ?? null);
			})
			.catch((err) => {
				logger.warn("API error:", err);
			})
			.finally(() => {
				if (!cancelled) {
					setLoadingRequests(false);
				}
			});

		return () => {
			cancelled = true;
		};
	}, [activeTab, requests.length, id, token]);

	async function follow() {
		if (!id) {
			return;
		}
		try {
			const res = await apiRequest(`/users/${encodeURIComponent(id)}/follow`, {
				method: "POST",
				token,
			});
			setProfile((prev) =>
				prev ? { ...prev, relationship: res?.relation || prev.relationship } : prev,
			);
		} catch (err) {
			logger.warn("API error:", err);
		}
	}

	async function connect() {
		if (!id) {
			return;
		}
		try {
			const res = await apiRequest(`/users/${encodeURIComponent(id)}/friend-request`, {
				method: "POST",
				token,
			});
			setProfile((prev) =>
				prev ? { ...prev, relationship: res?.relation || prev.relationship } : prev,
			);
		} catch (err) {
			logger.warn("API error:", err);
		}
	}

	function contact() {
		if (id) {
			recordLeadSource({
				type: "direct",
				id: `profile:${id}`,
				label: `Profile: ${user?.name || roleLabel}`,
			});
		}
		navigate("/chat", {
			state: {
				notice: `Contacting ${user?.name || roleLabel}. If you are unverified, your first message may appear as a request.`,
			},
		});
	}

	async function requestRelationship() {
		if (!id) {
			return;
		}
		setFeedback(null);
		try {
			const tokenValue = getToken();
			await apiRequest("/relationships", {
				method: "POST",
				token: tokenValue,
				body: { recipient_id: id, recipient_type: "user" },
			});
			setFeedback("Business relationship request sent.");
		} catch (err) {
			setFeedback(err.message || "Failed to send relationship request.");
		}
	}

	async function requestLicense() {
		if (!id) {
			return;
		}
		setFeedback(null);
		try {
			const tokenValue = getToken();
			await apiRequest("/license-requests", {
				method: "POST",
				token: tokenValue,
				body: { recipient_id: id, license_name: user?.profile?.industry || "General" },
			});
			setFeedback("License request sent.");
		} catch (err) {
			setFeedback(err.message || "Failed to send license request.");
		}
	}

	async function saveCapacity() {
		setFeedback(null);
		try {
			const tokenValue = getToken();
			const res = await apiRequest(`/profiles/${encodeURIComponent(id)}`, {
				method: "PATCH",
				token: tokenValue,
				body: { purchasing_capacity: capacityValue },
			});
			setProfile((prev) =>
				prev
					? {
							...prev,
							user: {
								...prev.user,
								profile: {
									...(prev.user?.profile || {}),
									purchasing_capacity: capacityValue,
								},
							},
						}
					: prev,
			);
			setEditingCapacity(false);
			setFeedback("Purchasing capacity updated.");
		} catch (err) {
			setFeedback(err.message || "Failed to update capacity.");
		}
	}

	if (loading) {
		return <NeonAtom fill={true} timeout={10000} />;
	}
	if (error) {
		return (
			<div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(51,122,176,0.16),transparent_28%),linear-gradient(to_bottom,rgba(2,6,23,0.02),rgba(2,6,23,0))] dark:bg-[radial-gradient(circle_at_top,rgba(51,122,176,0.22),transparent_30%),linear-gradient(to_bottom,rgba(2,6,23,0.95),rgba(2,6,23,1))] p-6 text-rose-700 dark:text-rose-200">
				{error}
			</div>
		);
	}
	if (!user) {
		return (
			<div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(51,122,176,0.16),transparent_28%),linear-gradient(to_bottom,rgba(2,6,23,0.02),rgba(2,6,23,0))] dark:bg-[radial-gradient(circle_at_top,rgba(51,122,176,0.22),transparent_30%),linear-gradient(to_bottom,rgba(2,6,23,0.95),rgba(2,6,23,1))] p-6 text-slate-700 dark:text-slate-200">
				Profile not found.
			</div>
		);
	}

	const roleLabel = user?.role
		? user.role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
		: "Buyer";
	const displayName = user?.name || roleLabel;
	const country = user?.profile?.country || "—";
	const industry = user?.profile?.industry_label || industryLabel(user?.profile?.industry) || "";
	const organization =
		user?.profile?.organization_name || user?.profile?.organization || user?.name || "—";
	const avg = ratingSummary?.aggregate?.average_score ?? 0;
	const totalRatings = ratingSummary?.aggregate?.total_count ?? 0;
	const totalRequests = profile?.counts?.requests ?? 0;
	const joinedYear = user?.created_at ? new Date(user.created_at).getFullYear() : "—";

	const badges = [
		user?.verified ? { label: "Verified", icon: ShieldCheck, tone: "info" } : null,
		isCertified ? { label: "Certified", icon: BadgeCheck, tone: "success" } : null,
		isPremium
			? {
					label: "Premium Reach",
					icon: Sparkles,
					tone: "premium",
					title: "Boosted visibility enabled for Premium",
				}
			: null,
		isBoosted ? { label: "Boosted", icon: Rocket, tone: "success" } : null,
	].filter(Boolean);

	const coverImage = user?.profile?.cover_image_url;
	const avatarImage = user?.profile?.profile_image;

	return (
		<div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(51,122,176,0.16),transparent_28%),linear-gradient(to_bottom,rgba(2,6,23,0.02),rgba(2,6,23,0))] text-slate-900 dark:bg-[radial-gradient(circle_at_top,rgba(51,122,176,0.22),transparent_30%),linear-gradient(to_bottom,rgba(2,6,23,0.95),rgba(2,6,23,1))] dark:text-slate-100">
			<div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
				<div className="mb-5 flex items-center justify-between gap-3 rounded-2xl border border-slate-200/70 bg-white/70 px-3 py-2 shadow-sm backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-950/60">
					<button
						onClick={() => navigate(-1)}
						className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-sky-300 hover:text-sky-700 dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-200 dark:hover:text-sky-300"
					>
						<ChevronLeft className="h-4 w-4" /> Back
					</button>
					<div className="flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs text-slate-500 dark:bg-slate-900/70 dark:text-slate-400">
						<ShieldCheck className="h-3.5 w-3.5" /> Role:{" "}
						<span className="font-bold text-slate-900 dark:text-white">{roleLabel}</span>
					</div>
				</div>

				<motion.div
							initial={reduceMotion ? false : { opacity: 0, y: 16 }}
							animate={reduceMotion ? false : { opacity: 1, y: 0 }}
							transition={{ duration: 0.45 }}
							className="overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white/80 shadow-[0_24px_100px_rgba(51,122,176,0.08)] backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/70"
						>
							<div className="relative h-[280px] overflow-hidden sm:h-[340px]">
								{coverImage ? (
									<motion.img
										src={coverImage}
										alt="Cover"
										className="absolute inset-0 h-full w-full object-cover"
										style={{ y: reduceMotion ? 0 : coverParallax }}
									/>
								) : fallbackCover ? (
									<motion.img
										src={fallbackCover}
										alt="Cover"
										className="absolute inset-0 h-full w-full object-cover"
										style={{ y: reduceMotion ? 0 : coverParallax }}
									/>
								) : (
									<div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(109,171,223,0.35),transparent_25%),radial-gradient(circle_at_80%_0%,rgba(99,102,241,0.22),transparent_30%),linear-gradient(135deg,rgba(15,23,42,0.95),rgba(51,122,176,0.3))]" />
								)}
								<div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-slate-950/35 to-transparent" />
								<div className="absolute inset-x-0 bottom-0 p-5 sm:p-7">
									<div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
										<div className="flex items-center gap-4">
											<div className="shrink-0">
												<AvatarFallback name={displayName} imageUrl={avatarImage} />
											</div>
											<div className="min-w-0 text-white">
												<h1 className="truncate text-2xl font-semibold tracking-tight sm:text-3xl">
													{displayName}
												</h1>
												<div className="mt-2 flex flex-wrap items-center gap-2">
													{badges.map((badge) => (
														<Pill key={badge.label} tone={badge.tone} title={badge.title}>
															{badge.label}
														</Pill>
													))}
													<Pill tone="info">{roleLabel}</Pill>
													{country === "—" ? null : (
														<Pill tone="info">
															<MapPin className="h-3.5 w-3.5" /> {country}
														</Pill>
													)}
													{industry ? (
														<Pill tone="info">
															<Building2 className="h-3.5 w-3.5" /> {industry}
														</Pill>
													) : null}
												</div>
												<p className="mt-1 truncate text-sm text-slate-200/90">{organization}</p>
											</div>
										</div>
										<div className="flex w-full shrink-0 flex-col gap-2 md:w-60">
											{currentUser?.id !== user?.id ? (
												<>
													<button
														onClick={contact}
														className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-sky-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-sky-500/20 transition hover:-translate-y-0.5 hover:bg-sky-400"
													>
														<Mail className="h-4 w-4" /> Contact
													</button>
													<button
														onClick={connect}
														className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur transition hover:-translate-y-0.5 hover:bg-white/15"
													>
														<Users className="h-4 w-4" />{" "}
														{relationship.friend_status === "friends"
															? "Connected"
															: relationship.friend_status === "requested"
																? "Requested"
																: "Connect"}
													</button>
													<div className="relative">
														<button
															type="button"
															onClick={() => setMoreActionsOpen((v) => !v)}
															aria-expanded={moreActionsOpen}
															className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 backdrop-blur transition hover:bg-white/10"
														>
															More actions
															<ChevronDown
																className={`h-4 w-4 transition-transform ${moreActionsOpen ? "rotate-180" : ""}`}
															/>
														</button>
														{moreActionsOpen ? (
															<>
																<button
																	type="button"
																	aria-label="Close menu"
																	onClick={() => setMoreActionsOpen(false)}
																	className="fixed inset-0 z-10 cursor-default"
																/>
																<div className="absolute right-0 z-20 mt-2 w-64 overflow-hidden rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-800 dark:bg-slate-950">
																	<button
																		type="button"
																		onClick={() => {
																			setMoreActionsOpen(false);
																			follow();
																		}}
																		className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/5"
																	>
																		<Heart
																			className={`h-4 w-4 ${relationship.following ? "fill-current" : ""}`}
																		/>{" "}
																		{relationship.following ? "Following" : "Follow"}
																	</button>
																	<button
																		type="button"
																		onClick={() => {
																			setMoreActionsOpen(false);
																			requestRelationship();
																		}}
																		className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/5"
																	>
																		<Handshake className="h-4 w-4" /> Confirm Business
																		Relationship
																	</button>
																	<button
																		type="button"
																		onClick={() => {
																			setMoreActionsOpen(false);
																			requestLicense();
																		}}
																		className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/5"
																	>
																		<ShieldCheck className="h-4 w-4" /> Request License
																	</button>
																</div>
															</>
														) : null}
													</div>
												</>
											) : (
												<Link
													to="/settings?tab=profile"
													className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-sky-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-0.5"
												>
													Edit profile
												</Link>
											)}
											{feedback ? (
												<p className="w-full text-center text-xs text-white/80">{feedback}</p>
											) : null}
										</div>
									</div>
								</div>
							</div>

							<div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
								<Metric
									label="Trust"
									value={
										<span className="inline-flex items-center gap-2">
											{user?.verified ? (
												<CheckCircle2 className="h-4 w-4 text-emerald-500" />
											) : (
												<CircleDashed className="h-4 w-4 text-slate-400" />
											)}{" "}
											{user?.verified ? "Verified" : "Unverified"}
										</span>
									}
									helper="Identity signal"
								/>
								<Metric
									label="Rating"
									value={
										<span className="inline-flex items-center gap-1">
											<Star className="h-4 w-4 text-amber-500" /> {avg.toFixed(1)} / 5
										</span>
									}
									helper={`${totalRatings} reviews`}
								/>
								<Metric
									label="Requests"
									value={`${totalRequests} request${totalRequests === 1 ? "" : "s"}`}
									helper="Posted on the platform"
								/>
								<Metric
									label="Joined"
									value={joinedYear}
									helper={
										profile?.effective_plan ? `Plan: ${profile.effective_plan}` : "Account age"
									}
								/>
							</div>
						</motion.div>

						<div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[0.95fr_2.05fr]">
							<div className="space-y-6 xl:sticky xl:top-6 xl:self-start">
								<SoftCard>
									<div className="flex items-center gap-3">
										<div className="shrink-0">
											<AvatarFallback name={displayName} imageUrl={avatarImage} compact={true} />
										</div>
										<div className="min-w-0">
											<div className="truncate text-base font-bold text-slate-900 dark:text-white">
												{displayName}
											</div>
											<div className="mt-1.5 flex flex-wrap gap-1.5">
												{badges.map((badge) => (
													<Pill key={badge.label} tone={badge.tone} title={badge.title}>
														{badge.label}
													</Pill>
												))}
											</div>
										</div>
									</div>
									<div className="mt-4 divide-y divide-slate-200/60 dark:divide-slate-800/60">
										<InfoRow label="Country">{country === "—" ? "—" : country}</InfoRow>
										<InfoRow label="Industry">{industry || "—"}</InfoRow>
										<InfoRow label="Organization">{organization}</InfoRow>
										<InfoRow label="Role">
											<span className="capitalize">{roleLabel}</span>
										</InfoRow>
										{user?.profile?.employee_count ? (
											<InfoRow label="Employees">
												{Number(user.profile.employee_count).toLocaleString("en-US")}
											</InfoRow>
										) : null}
										<InfoRow label="Capacity">
											{user?.profile?.purchasing_capacity || "—"}
										</InfoRow>
									</div>
									<div className="mt-4 space-y-2">
										{currentUser?.id !== user?.id ? (
											<>
												<button
													onClick={contact}
													className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-sky-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-sky-500/20 transition hover:-translate-y-0.5 hover:bg-sky-400"
												>
													<Mail className="h-4 w-4" /> Contact
												</button>
												<button
													onClick={connect}
													className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:-translate-y-0.5 hover:border-sky-300 hover:text-sky-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:text-sky-300"
												>
													<Users className="h-4 w-4" />{" "}
													{relationship.friend_status === "friends"
														? "Connected"
														: relationship.friend_status === "requested"
															? "Requested"
															: "Connect"}
												</button>
											</>
										) : (
											<Link
												to="/settings?tab=profile"
												className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-sky-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-0.5"
											>
												Edit profile
											</Link>
										)}
									</div>
								</SoftCard>
								{certification ? (
									<SoftCard>
										<SectionTitle
											icon={BadgeCheck}
											title="Order Completion Certification"
											subtitle="Signed contract record."
										/>
										<div className="space-y-3">
											<div className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/40">
												<div>
													<div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
														Status
													</div>
													<div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
														Certification status
													</div>
												</div>
												<Pill tone={certification.status === "certified" ? "success" : "default"}>
													{certification.status || "pending"}
												</Pill>
											</div>
											<Metric label="Signed contracts" value={certification.signed_contracts ?? 0} />
										</div>
									</SoftCard>
								) : null}
							</div>
							<div className="w-full min-w-0 space-y-6">
								<SoftCard>
									<div className="flex flex-wrap gap-2">
								{["overview", "requests", "work", "reviews"].map((tab) => {
									const active = activeTab === tab;
									const label =
										tab === "overview"
											? "Overview"
											: tab === "work"
												? "Work History"
												: tab === "requests"
													? "Requests"
													: "Reviews";
									return (
										<button
											key={tab}
											onClick={() => setActiveTab(tab)}
											className={`rounded-full px-4 py-2 text-sm font-semibold transition ${active ? "bg-sky-500 text-white shadow-lg shadow-sky-500/20" : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"}`}
										>
											{label}
										</button>
									);
								})}
							</div>
						</SoftCard>

						<AnimatePresence mode="wait">
							{activeTab === "overview" ? (
								<motion.div
									key="overview"
									initial={{ opacity: 0, y: 10 }}
									animate={{ opacity: 1, y: 0 }}
									exit={{ opacity: 0, y: -10 }}
									className="space-y-6"
								>
									<SoftCard>
										<SectionTitle
											icon={Eye}
											title="About"
											subtitle="Buyer profile summary and positioning."
										/>
										{user?.profile?.about ? (
											<p className="text-sm leading-7 text-slate-600 dark:text-slate-300 whitespace-pre-wrap">
												{user.profile.about}
											</p>
										) : (
											<EmptyState icon={Eye} text="No description added yet." />
										)}
									</SoftCard>

									<div className="grid gap-6 lg:grid-cols-2">
										<SoftCard>
											<SectionTitle
												icon={ClipboardList}
												title="Core Profile"
												subtitle="Quick facts and profile metadata."
											/>
											<div className="grid gap-3 sm:grid-cols-2">
												<Metric label="Country" value={user?.profile?.country || "—"} />
												<Metric label="Industry" value={user?.profile?.industry || "—"} />
												<Metric
													label="Certifications"
													value={(user?.profile?.certifications || []).join(", ") || "—"}
												/>
												<Metric
													label="Active Since"
													value={user?.profile?.active_since || new Date().getFullYear()}
												/>
												<Metric label="Role" value={roleLabel} />
												<div className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/40">
													<div>
														<div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Purchasing Capacity</div>
														<div className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
															{user?.profile?.purchasing_capacity || "—"}
														</div>
													</div>
													{isSelfOrAdmin && (
														<button
															onClick={() => {
																setEditingCapacity(true);
																setCapacityValue(user?.profile?.purchasing_capacity || "");
															}}
															className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-sky-600 dark:hover:bg-slate-800 dark:hover:text-sky-400"
														>
															<Edit3 className="h-3.5 w-3.5" />
														</button>
													)}
												</div>
											</div>
										</SoftCard>

										<SoftCard>
											<SectionTitle
												icon={ShieldCheck}
												title="Trust & Verification"
												subtitle="Verification and commercial status, unified."
											/>
											<VerificationPanel summary={verification} />
											<div className="mt-4 grid gap-3 sm:grid-cols-2">
												<Metric
													label="Signed contracts"
													value={certification?.signed_contracts ?? 0}
												/>
												<Metric
													label="Premium status"
													value={isPremium ? "Enabled" : "Standard"}
													helper={
														isBoosted ? "Boosted visibility active" : "No active profile boost"
													}
												/>
											</div>
										</SoftCard>
									</div>

									{hasBrandKit ? (
										<SoftCard>
											<SectionTitle
												icon={Eye}
												title="Brand Kit"
												subtitle="Visible only to self or admins."
											/>
											<div className="flex items-center gap-3">
												<div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-sky-500/15 to-indigo-500/15 ring-1 ring-sky-500/10">
													{brandProfile.brand_logo_url ? (
														<img
															src={brandProfile.brand_logo_url}
															alt="Brand logo"
															className="h-full w-full object-cover"
														/>
													) : (
														<Building className="h-5 w-5 text-sky-500" />
													)}
												</div>
												<div className="min-w-0">
													<div className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
														{brandProfile.brand_name || user?.name}
													</div>
													{brandProfile.brand_tagline ? (
														<div className="text-xs text-slate-500 dark:text-slate-400">
															{brandProfile.brand_tagline}
														</div>
													) : null}
											</div>
											</div>
										</SoftCard>
									) : null}

									{isPremium && hasAccountManager ? (
										<SoftCard>
											<SectionTitle
												icon={Users}
												title="Dedicated Account Manager"
												subtitle="Premium support contact."
											/>
											<div className="grid gap-4 md:grid-cols-3">
												<Metric
													label="Name"
													value={brandProfile.account_manager_name || "Assigned manager"}
												/>
												<Metric label="Email" value={brandProfile.account_manager_email || "—"} />
												<Metric label="Phone" value={brandProfile.account_manager_phone || "—"} />
											</div>
										</SoftCard>
									) : null}

									<SoftCard>
										<SectionTitle
											icon={Building}
											title="Companies Worked With"
											subtitle="Selected brand and organizational history."
										/>
										{(user?.profile?.companies_worked_with || []).length > 0 ? (
											<div className="grid gap-3 md:grid-cols-2">
											{(user.profile.companies_worked_with || []).map((company, idx) => (
												<div
													key={idx}
													className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/40"
												>
													<div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-sky-500/15 to-indigo-500/15 ring-1 ring-sky-500/10">
														{company.logo ? (
                      <LazyImage
                        src={company.logo}
                        alt={company.name}
                        width={80}
                        height={80}
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
															) : (
																<Building2 className="h-5 w-5 text-sky-500" />
															)}
														</div>
														<div className="min-w-0">
															<div className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
																{company.name || "Untitled company"}
															</div>
															{company.location ? (
																<div className="truncate text-xs text-slate-500 dark:text-slate-400">
																	{company.location}
																</div>
															) : null}
														</div>
													</div>
												))}
											</div>
										) : (
											<EmptyState icon={Building2} text="No companies listed yet." />
										)}
									</SoftCard>
								</motion.div>
							) : null}

							{activeTab === "requests" ? (
								<motion.div
									key="requests"
									initial={{ opacity: 0, y: 10 }}
									animate={{ opacity: 1, y: 0 }}
									exit={{ opacity: 0, y: -10 }}
									className="space-y-6"
								>
									<SoftCard>
										<SectionTitle
											icon={ClipboardList}
											title="Requests"
											subtitle="Buyer sourcing demand and procurement details."
											action={
												<Pill tone="info">
													{totalRequests} request
													{totalRequests === 1 ? "" : "s"}
												</Pill>
											}
										/>
										{viewerPerms.is_self || viewerPerms.is_admin ? (
											<div className="space-y-3">
												{requests.map((r) => (
													<div
														key={r.id}
														className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/40"
													>
														<div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
															<div className="min-w-0">
																<div className="flex flex-wrap items-center gap-2">
																	<div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
																		{r.category || "Request"}
																	</div>
																	<Pill
																		tone={
																			r.status === "active"
																				? "success"
																				: r.status === "pending"
																					? "warning"
																					: "default"
																		}
																	>
																		{r.status || "Unknown"}
																	</Pill>
																</div>
																<p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600 dark:text-slate-300 whitespace-pre-wrap">
																	{r.custom_description || ""}
																</p>
															</div>
															<button
																onClick={contact}
																className="inline-flex shrink-0 items-center gap-2 rounded-full border border-sky-500/20 bg-sky-500/10 px-4 py-2 text-sm font-semibold text-sky-700 transition hover:bg-sky-500/15 dark:text-sky-300"
															>
																<MessageSquare className="h-4 w-4" /> Contact
															</button>
														</div>
														<div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
															<Metric label="Quantity" value={r.quantity || "-"} />
															<Metric
																label="Timeline"
																value={r.timeline_days || "-"}
																helper="days"
															/>
															<Metric label="Material" value={r.material || "-"} />
															<Metric label="Status" value={r.status || "-"} />
														</div>
													</div>
												))}
												{loadingRequests ? (
													<Atom
														color="#337ab0"
														size="large"
														style={{ fontSize: "32px" }}
														text=""
														textColor=""
													/>
												) : null}
												{requestsNext !== null && !loadingRequests ? (
													<div className="flex items-center justify-between gap-3">
														<div className="text-sm text-slate-500 dark:text-slate-400">
															Cursor-based pagination, limit 10.
														</div>
														<button
															type="button"
															onClick={() => loadRequests({ reset: false })}
															className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
														>
															Load more
														</button>
													</div>
												) : null}
												{requests.length > 0 || loadingRequests ? null : (
													<EmptyState
														icon={ClipboardList}
														text="No requests found."
														action={
															!viewerPerms.is_self ? (
																<button
																	type="button"
																	onClick={contact}
																	className="inline-flex items-center gap-2 rounded-full bg-sky-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-sky-500/20 transition hover:-translate-y-0.5 hover:bg-sky-400"
																>
																	<MessageSquare className="h-4 w-4" /> Send First Message
																</button>
															) : null
														}
													/>
												)}
											</div>
										) : (
											<div className="space-y-4">
												<div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-5 dark:border-slate-800 dark:bg-slate-900/40">
													<div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
														Request details are private
													</div>
													<p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-300">
														Only the buyer can view detailed request information to protect business
														privacy.
													</p>
												</div>
												<Metric
													label="Total requests posted"
													value={`${totalRequests} request${totalRequests === 1 ? "" : "s"}`}
												/>
											</div>
										)}
									</SoftCard>
								</motion.div>
							) : null}

							{activeTab === "work" ? (
								<motion.div
									key="work"
									initial={{ opacity: 0, y: 10 }}
									animate={{ opacity: 1, y: 0 }}
									exit={{ opacity: 0, y: -10 }}
									className="space-y-6"
								>
									<SoftCard>
										<SectionTitle
											icon={BriefcaseBusiness}
											title="Work History & Portfolio"
											subtitle="Previously worked companies and engagement history."
										/>
										{(user?.profile?.companies_worked_with || []).length > 0 ? (
											<div className="space-y-3">
												{(user.profile.companies_worked_with || []).map((company, idx) => (
													<div
														key={idx}
														className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800 dark:bg-slate-900/40"
													>
														<div className="flex items-center gap-3 min-w-0">
															<div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-sky-500/15 to-cyan-500/15 ring-1 ring-sky-500/10">
																{company.logo ? (
																	<img
																		src={company.logo}
																		alt={company.name || "Company"}
																		className="h-full w-full object-cover"
																	/>
																) : (
																	<Building2 className="h-5 w-5 text-sky-500" />
																)}
															</div>
															<div className="min-w-0">
																<div className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
																	{company.name || "Untitled company"}
																</div>
																<div className="truncate text-xs text-slate-500 dark:text-slate-400">
																	{company.role || "Role not specified"}
																</div>
															</div>
														</div>
														<div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
															<CalendarDays className="h-4 w-4" />{" "}
															{company.period || company.location || "Period not specified"}
														</div>
													</div>
												))}
											</div>
										) : (
											<EmptyState icon={BriefcaseBusiness} text="No work history added yet." />
										)}
									</SoftCard>
								</motion.div>
							) : null}

							{activeTab === "reviews" ? (
								<motion.div
									key="reviews"
									initial={{ opacity: 0, y: 10 }}
									animate={{ opacity: 1, y: 0 }}
									exit={{ opacity: 0, y: -10 }}
									className="space-y-6"
								>
									<SoftCard>
										<SectionTitle
											icon={Star}
											title="Rating summary"
											subtitle="Public reviews and confidence scoring."
										/>
										<div className="grid gap-4 md:grid-cols-3">
											<Metric label="Average score" value={`${avg.toFixed(1)} / 5`} />
											<Metric label="Total reviews" value={totalRatings} />
											<Metric
												label="Confidence"
												value={ratingSummary?.aggregate?.reliability?.confidence || "low"}
												helper="Aggregate reliability"
											/>
										</div>
										{ratingSummary?.aggregate?.category_averages && (() => {
											const cats = ratingSummary.aggregate.category_averages;
											const filled = [
												{ label: "Sample Accuracy", val: cats.sample_accuracy },
												{ label: "Communication", val: cats.communication_speed },
												{ label: "Quality Control", val: cats.quality_control },
												{ label: "Delivery", val: cats.delivery_timeliness },
												{ label: "After-Sales", val: cats.after_sales_support },
											].filter((c) => c.val != null);
											if (filled.length === 0) return null;
											return (
												<div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
													{filled.map((c) => (
														<div key={c.label} className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-slate-50/80 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/40">
															<span className="text-xs font-medium text-slate-600 dark:text-slate-300">{c.label}</span>
															<span className="flex items-center gap-1 text-xs font-semibold text-sky-600 dark:text-sky-300">
																<Star className="h-3 w-3" />
																{Number(c.val).toFixed(1)}
															</span>
														</div>
													))}
												</div>
											);
										})()}
									</SoftCard>

									<div className="rounded-3xl border border-amber-400/25 bg-amber-500/10 p-4 text-sm leading-7 text-amber-950 dark:text-amber-100">
										<strong className="font-semibold">Review Policy:</strong> Reviews can only be edited
										or deleted by the person who wrote them. Profile owners cannot delete reviews to
										maintain transparency and trust.
									</div>

									<SoftCard>
										<SectionTitle
											icon={MessageSquare}
											title="Recent reviews"
											subtitle="Public feedback from past collaborations."
										/>
										{(ratingSummary?.recent_reviews || []).length > 0 ? (
											<div className="space-y-3">
												{(ratingSummary.recent_reviews || []).map((review) => {
													const canEdit =
														currentUser?.id &&
														String(currentUser.id) === String(review.from_user_id || "");
													return (
														<div
															key={review.id}
															className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/40"
														>
															<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
																<div className="min-w-0">
																	<div className="flex flex-wrap items-center gap-2">
																		<Pill tone="warning">
																			<Star className="h-3.5 w-3.5" />{" "}
																			{Number(review.score || 0).toFixed(1)}
																		</Pill>
																		<div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
																			{review.reviewer_name || "Anonymous"}
																		</div>
																	</div>
																	<p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-300">
																		{review.comment || "No comment provided."}
																	</p>
																	{[review.sample_accuracy, review.communication_speed, review.quality_control, review.delivery_timeliness, review.after_sales_support].some((v) => v != null) && (
																		<div className="mt-2 flex flex-wrap gap-2">
																			{[
																				{ key: "sample_accuracy", label: "Sample Accuracy", val: review.sample_accuracy },
																				{ key: "communication_speed", label: "Communication", val: review.communication_speed },
																				{ key: "quality_control", label: "Quality Control", val: review.quality_control },
																				{ key: "delivery_timeliness", label: "Delivery", val: review.delivery_timeliness },
																				{ key: "after_sales_support", label: "After-Sales", val: review.after_sales_support },
																			].filter((c) => c.val != null).map((c) => (
																				<span key={c.key} className="inline-flex items-center gap-1 rounded-full border border-sky-500/15 bg-sky-500/5 px-2 py-0.5 text-xs text-slate-600 dark:text-slate-300">
																					<Star className="h-3 w-3 text-sky-400" />
																					{c.label}: {Number(c.val)}/5
																				</span>
																			))}
																		</div>
																	)}
																	<div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
																		{review.created_at
																			? new Date(review.created_at).toLocaleDateString()
																			: ""}
																	</div>
																</div>
																{canEdit ? (
																	<div className="flex items-center gap-2">
																		<button
																			type="button"
																			className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-sky-300 hover:text-sky-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:text-sky-300"
																			onClick={() => {
																				setReviewEditModal({
																					open: true,
																					id: review.id,
																					score: Number(review.score || 5),
																					comment: review.comment || "",
																				});
																			}}
																		>
																			<Edit3 className="h-4 w-4" /> Edit
																		</button>
																		<button
																			type="button"
																			className="inline-flex items-center gap-2 rounded-full border border-rose-300 bg-rose-500/10 px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-500/15 dark:border-rose-900/60 dark:text-rose-300"
																			onClick={() => {
																				setReviewDeleteId(review.id);
																			}}
																		>
																			<Trash2 className="h-4 w-4" /> Delete
																		</button>
																	</div>
																) : null}
															</div>
														</div>
													);
												})}
											</div>
										) : (
											<EmptyState icon={Star} text="No reviews yet." />
										)}
									</SoftCard>
								</motion.div>
							) : null}
						</AnimatePresence>

						<JourneyTimeline
							title="Journey Timeline"
							matchId={journeyParams.get("match_id") || journeyParams.get("journey_match_id") || ""}
							contractId={journeyParams.get("contract_id") || ""}
							requirementId={journeyParams.get("requirement_id") || ""}
						/>

						<CrmSummaryPanel
							targetId={user.id}
							onContact={currentUser?.id !== user?.id ? contact : undefined}
						/>
					</div>
				</div>
			</div>

			{reviewEditModal.open ? (
				<div
					className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
					onClick={() => setReviewEditModal({ ...reviewEditModal, open: false })}
					onKeyDown={(e) =>
						e.key === "Escape" && setReviewEditModal({ ...reviewEditModal, open: false })
					}
					tabIndex={-1}
				>
					<div
						className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-950"
						onClick={(e) => e.stopPropagation()}
					>
						<h3 className="text-lg font-semibold text-slate-900 dark:text-white">Edit Review</h3>
						<div className="mt-4 space-y-4">
							<div>
								<label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
									Score (1-5)
								</label>
								<input
									type="number"
									min={1}
									max={5}
									value={reviewEditModal.score}
									onChange={(e) =>
										setReviewEditModal({
											...reviewEditModal,
											score: Number(e.target.value),
										})
									}
									className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
								/>
							</div>
							<div>
								<label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
									Comment
								</label>
								<textarea
									value={reviewEditModal.comment}
									onChange={(e) =>
										setReviewEditModal({
											...reviewEditModal,
											comment: e.target.value,
										})
									}
									rows={3}
									className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
								/>
							</div>
						</div>
						<div className="mt-6 flex items-center justify-end gap-3">
							<button
								onClick={() => setReviewEditModal({ ...reviewEditModal, open: false })}
								className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
							>
								Cancel
							</button>
							<button
								onClick={async () => {
									try {
										await apiRequest(`/ratings/${reviewEditModal.id}`, {
											method: "PATCH",
											token,
											body: {
												score: reviewEditModal.score,
												comment: reviewEditModal.comment,
											},
										});
										await loadRatings();
									} catch (err) {
										logger.warn("API error:", err);
									}
									setReviewEditModal({
										open: false,
										id: null,
										score: 5,
										comment: "",
									});
								}}
								className="rounded-full bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-400"
							>
								Save
							</button>
						</div>
					</div>
				</div>
			) : null}

			{reviewDeleteId ? (
				<div
					className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
					onClick={() => setReviewDeleteId(null)}
					onKeyDown={(e) => e.key === "Escape" && setReviewDeleteId(null)}
					tabIndex={-1}
				>
					<div
						className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-950"
						onClick={(e) => e.stopPropagation()}
					>
						<h3 className="text-lg font-semibold text-slate-900 dark:text-white">Delete Review</h3>
						<p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
							Are you sure you want to delete this review? This action cannot be undone.
						</p>
						<div className="mt-6 flex items-center justify-end gap-3">
							<button
								onClick={() => setReviewDeleteId(null)}
								className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
							>
								Cancel
							</button>
							<button
								onClick={async () => {
									try {
										await apiRequest(`/ratings/${reviewDeleteId}`, {
											method: "DELETE",
											token,
										});
										await loadRatings();
									} catch (err) {
										logger.warn("API error:", err);
									}
									setReviewDeleteId(null);
								}}
								className="rounded-full bg-rose-500 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-400"
							>
								Delete
							</button>
						</div>
					</div>
				</div>
			) : null}

			{editingCapacity && (
				<div
					className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
					onClick={() => setEditingCapacity(false)}
					onKeyDown={(e) => e.key === "Escape" && setEditingCapacity(false)}
					tabIndex={-1}
				>
					<div
						className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-950"
						onClick={(e) => e.stopPropagation()}
					>
						<h3 className="text-lg font-semibold text-slate-900 dark:text-white">Edit Purchasing Capacity</h3>
						<p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
							Update the purchasing capacity for this buyer account.
						</p>
						<input
							type="text"
							value={capacityValue}
							onChange={(e) => setCapacityValue(e.target.value)}
							placeholder="e.g. 5000 yards/month"
							className="mt-4 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-500"
							autoFocus
						/>
						<div className="mt-6 flex items-center justify-end gap-3">
							<button
								onClick={() => setEditingCapacity(false)}
								className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
							>
								Cancel
							</button>
							<button
								onClick={saveCapacity}
								className="rounded-full bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-400"
							>
								Save
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
