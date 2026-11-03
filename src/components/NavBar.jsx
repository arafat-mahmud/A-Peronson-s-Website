/*
  Component: NavBar (global)

  Routes impacted:
    - Appears on most routes except immersive pages (/chat and /call) where AppLayout hides it.
    - Public links shown when logged out: /pricing, /about, /help
    - Authenticated icon links shown when logged in: /feed, /search, /contracts, /notifications, /chat, /verification

  Purpose:
    - Provide navigation (public + authenticated).
    - Provide theme toggle (light/dark via `.dark` class on <html>).
    - Provide user search suggestions dropdown (backend user search).
    - Provide unread notification badge (backend notifications list).
    - Provide mobile navigation drawer.

  Key UX patterns:
    - Glassmorphism base: semi-transparent + blur + subtle shadow.
    - "Active" indicator uses Framer Motion `layoutId="nav-active"` so it smoothly slides between links.
    - Ctrl+K / Cmd+K focuses search.

  Key APIs:
    - GET /api/notifications (unread count)
    - GET /api/users/search?q=... (user suggestion search)
    - POST /api/users/:id/friend-request (connect)
    - POST /api/users/:id/follow (follow)
    - POST /api/chat/rooms (create/start conversation)
    - POST /api/calls (start call)
*/
/* global process */

import { AnimatePresence, motion as Motion, useReducedMotion, useSpring } from "framer-motion";
import {
	Bell,
	Briefcase,
	Building2,
	ChevronRight,
	FileText,
	LayoutDashboard,
	LogOut,
	Menu,
	MessageSquare,
	Moon,
	Package,
	Search,
	Settings,
	ShieldCheck,
	Star,
	Sun,
	Users,
	Vote,
	X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { ThreeDot } from "react-loading-indicators";
import { Link, useLocation, useNavigate } from "react-router-dom";
import useScrollDirection from "../hooks/useScrollDirection.js";
import { apiRequest, clearSession, getCurrentUser, getRoleHome, getToken } from "../lib/auth.js";
import { cn } from "../lib/cn.js";
import {
	connectNotificationsRealtime,
	subscribeNotificationsRealtime,
} from "../lib/notificationsRealtime.js";
import { isRouteValid } from "../lib/routeHealthCheck.js";
import { useTheme } from "../lib/ThemeProvider.jsx";
import SlideIn from "./SlideIn.jsx";
import BrandMark from "./ui/BrandMark.jsx";
import { IconNavLink } from "./ui/IconNavLink.jsx";
import { MagneticNavLink } from "./ui/MagneticNavLink.jsx";
import { NavDropdown } from "./ui/NavDropdown.jsx";

// Public navigation (shown for logged-out visitors).
const publicLinks = [
	{ to: "/pricing", label: "Pricing" },
	{ to: "/about", label: "About" },
	{ to: "/help", label: "Help" },
	{ to: "mailto:gartexhubsupport@gmail.com", label: "Support", external: true },
];

// Auth navigation dropdown structure
const navigationGroups = [
	{
		label: "Core",
		icon: LayoutDashboard,
		items: [
			{ to: "/settings?tab=profile", label: "My Profile" },
			{ to: "/feed", label: "Feed" },
			{ to: "/feed/manage", label: "Post Editor" },
			{ to: "/search", label: "Search" },
			{ to: "/verification", label: "Verification" },
			{
				to: "/owner",
				label: "Owner Dashboard",
				roles: ["owner", "admin", "buying_house", "factory"],
			},
			{
				to: "/agent",
				label: "Agent Dashboard",
				roles: ["buying_house", "owner", "admin", "agent"],
			},
		],
	},
	{
		label: "Communication",
		icon: MessageSquare,
		items: [
			{ to: "/notifications", label: "Notifications", badge: true },
			{ to: "/chat", label: "Chat" },
		],
	},
	{
		label: "Business",
		icon: Briefcase,
		items: [
			{
				to: "/buyer-requests",
				label: "Requests",
				roles: ["buyer", "buying_house", "admin"],
			},
			{
				to: "/product-management",
				label: "Products",
				roles: ["factory", "buying_house", "admin"],
			},
			{
				to: "/partner-network",
				label: "Partners",
				roles: ["buying_house", "factory", "owner", "admin", "agent"],
			},
			{
				to: "/ratings/feedback",
				label: "Ratings",
				roles: ["buyer", "buying_house", "factory", "owner", "admin", "agent"],
			},
		],
	},
	{
		label: "Organization",
		icon: Building2,
		items: [
			{
				to: "/member-management",
				label: "Members",
				roles: ["owner", "admin", "buying_house", "factory"],
			},
			{
				to: "/insights",
				label: "Insights",
				roles: ["owner", "admin", "buying_house", "factory", "buyer"],
			},
		],
	},
	{
		label: "Admin",
		icon: ShieldCheck,
		items: [
			{ to: "/admin", label: "Admin Panel", roles: ["owner", "admin"] },
			{
				to: "/admin/governance",
				label: "Governance",
				roles: ["owner", "admin"],
			},
		],
	},
	{
		label: "Support",
		icon: Settings,
		items: [
			{ to: "mailto:gartexhubsupport@gmail.com", label: "Contact Support", external: true },
			{ to: "/feedback", label: "Feedback" },
			{
				to: "/onboarding",
				label: "Onboarding",
				roles: ["buyer", "buying_house", "factory", "owner", "admin", "agent"],
			},
			{ to: "/settings", label: "Settings" },
		],
	},
];

const easePremium = [0.16, 1, 0.3, 1];

export default function NavBar() {
	const { theme, toggleTheme } = useTheme();
	const dark = theme === "dark";
	const [mobileOpen, setMobileOpen] = useState(false);
	const [openDropdown, setOpenDropdown] = useState(null);
	const [searchExpanded, setSearchExpanded] = useState(false);
	const user = getCurrentUser();
	const userId = user?.id || "";

	const validPublicLinks = useMemo(() => publicLinks.filter((link) => isRouteValid(link.to)), []);

	const validNavGroups = useMemo(
		() =>
			navigationGroups
				.map((group) => ({
					...group,
					items: group.items
						.filter(
							(item) =>
								item.external ||
								(isRouteValid(item.to) &&
									(!item.roles || item.roles.includes(String(user?.role || "").toLowerCase()))),
						)
						.map((item) => {
							if (item.label !== "My Profile" || !userId) return item;
							const role = String(user?.role || "").toLowerCase();
							const id = encodeURIComponent(userId);
							const to =
								role === "factory"
									? `/factory/${id}`
									: role === "buyer"
										? `/buyer/${id}`
										: role === "buying_house" || role === "agent"
											? `/buying-house/${id}`
											: `/profile/${id}`;
							return { ...item, to };
						}),
				}))
				.filter((group) => group.items.length > 0),
		[user?.role, userId],
	);
	const [searchQuery, setSearchQuery] = useState("");
	const [searchResults, setSearchResults] = useState([]);
	const [searchLoading, setSearchLoading] = useState(false);
	const [searchOpen, setSearchOpen] = useState(false);
	const [searchError, setSearchError] = useState("");
	const [unreadCount, setUnreadCount] = useState(0);
	const [actionStatus, setActionStatus] = useState("");
	const [actionBusyKey, setActionBusyKey] = useState("");

	const direction = useScrollDirection();
	const reduceMotion = useReducedMotion();
	const navTarget = reduceMotion ? 0 : direction === "down" ? -120 : 0;
	const navY = useSpring(navTarget, {
		stiffness: 120,
		damping: 24,
		restDelta: 0.001,
	});

	useEffect(() => {
		navY.set(navTarget);
	}, [navTarget, navY]);

	const location = useLocation();
	const navigate = useNavigate();
	const searchInputRef = useRef(null);
	const isMac = useMemo(
		() => typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/.test(navigator.platform),
		[],
	);

	const searchRef = useRef(null);

	const handleSetDropdown = useCallback((label) => {
		setOpenDropdown((prev) => (prev === label ? null : label));
	}, []);

	useEffect(() => {
		const handleClickOutside = (e) => {
			if (
				searchExpanded &&
				searchRef.current &&
				!searchRef.current.contains(e.target) &&
				!searchQuery.trim()
			) {
				setSearchExpanded(false);
			}
		};
		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, [searchExpanded, searchQuery]);

	useEffect(() => {
		const handleClickOutside = (e) => {
			if (openDropdown) {
				const nav = document.querySelector("nav");
				if (nav && !nav.contains(e.target)) {
					setOpenDropdown(null);
				}
			}
		};
		if (openDropdown) {
			document.addEventListener("mousedown", handleClickOutside);
			return () => document.removeEventListener("mousedown", handleClickOutside);
		}
	}, [openDropdown]);

	useEffect(() => {
		if (!user) return;
		const handler = (e) => {
			const key = String(e.key || "").toLowerCase();
			if (key !== "k") {
				return;
			}
			if (!(e.ctrlKey || e.metaKey)) {
				return;
			}
			e.preventDefault();
			searchInputRef.current?.focus?.();
			setSearchOpen(true);
		};

		window.addEventListener("keydown", handler);
		return () => window.removeEventListener("keydown", handler);
	}, []);

	const refreshUnreadCount = useCallback(async () => {
		if (!userId) {
			setUnreadCount(0);
			return;
		}
		const token = getToken();
		if (!token) {
			setUnreadCount(0);
			return;
		}
		try {
			const data = await apiRequest("/notifications", { token });
			const rows = Array.isArray(data) ? data : [];
			flushSync(() => {
				setUnreadCount(rows.filter((n) => !n?.read).length);
			});
		} catch {
			flushSync(() => {
				setUnreadCount(0);
			});
		}
	}, [userId]);

	useEffect(() => {
		if (typeof process !== "undefined" && process.env && process.env.NODE_ENV === "test") {
			return;
		}
		refreshUnreadCount();
	}, [refreshUnreadCount]);

	useEffect(() => {
		if (location.pathname === "/notifications") {
			refreshUnreadCount();
		}
	}, [location.pathname, refreshUnreadCount]);

	useEffect(() => {
		if (typeof process !== "undefined" && process.env && process.env.NODE_ENV === "test") {
			return;
		}
		if (!userId) {
			return;
		}
		const token = getToken();
		if (!token) {
			return;
		}

		connectNotificationsRealtime(token);
		const unsubscribe = subscribeNotificationsRealtime((msg) => {
			if (!msg) {
				return;
			}
			if (msg.type === "notification_created" || msg.type === "notification_read") {
				refreshUnreadCount();
			}
		});

		return unsubscribe;
	}, [userId, refreshUnreadCount]);

	const fetchUserSuggestions = useCallback(
		async (query) => {
			if (!userId) {
				return;
			}
			try {
				const data = await apiRequest(`/users/search?q=${encodeURIComponent(query)}`, {
					token: getToken(),
				});
				flushSync(() => {
					setSearchResults(Array.isArray(data?.users) ? data.users : []);
				});
			} catch (err) {
				flushSync(() => {
					setSearchResults([]);
					setSearchError(err.message || "Search failed");
				});
			} finally {
				flushSync(() => {
					setSearchLoading(false);
				});
			}
		},
		[userId],
	);

	useEffect(() => {
		if (!userId) {
			return;
		}

		const query = searchQuery.trim();
		if (query.length === 0) {
			setSearchResults([]);
			setSearchError("");
			return;
		}

		setSearchLoading(true);
		setSearchError("");
		setActionStatus("");

		const timer = window.setTimeout(() => {
			fetchUserSuggestions(query);
		}, 250);

		return () => window.clearTimeout(timer);
	}, [fetchUserSuggestions, searchQuery, userId]);

	const handleLogout = () => {
		clearSession();
		navigate("/login");
	};

	const updateRelationState = (targetId, relation) => {
		if (!targetId) {
			return;
		}
		setSearchResults((previous) =>
			previous.map((item) => (item.id === targetId ? { ...item, ...(relation || {}) } : item)),
		);
	};

	const followUser = async (targetId) => {
		const token = getToken();
		if (!targetId) {
			return;
		}
		if (!token) {
			setSearchError("Please login to follow users.");
			return;
		}

		const key = `follow:${targetId}`;
		setActionBusyKey(key);
		setSearchError("");
		setActionStatus("");
		try {
			const response = await apiRequest(`/users/${targetId}/follow`, {
				method: "POST",
				token,
			});
			updateRelationState(targetId, response?.relation || { following: true });
			setActionStatus("Followed successfully.");
			const query = searchQuery.trim();
			if (query) {
				fetchUserSuggestions(query);
			}
		} catch (err) {
			setSearchError(err.message || "Unable to follow user");
			setActionStatus("Follow failed.");
		} finally {
			setActionBusyKey("");
		}
	};

	const addFriend = async (targetId) => {
		const token = getToken();
		if (!targetId) {
			return;
		}
		if (!token) {
			setSearchError("Please login to add friends.");
			return;
		}

		const key = `friend:${targetId}`;
		setActionBusyKey(key);
		setSearchError("");
		setActionStatus("");
		try {
			const response = await apiRequest(`/users/${targetId}/friend-request`, {
				method: "POST",
				token,
			});
			updateRelationState(targetId, response?.relation || { friend_status: "requested" });
			setActionStatus("Friend request sent.");
			const query = searchQuery.trim();
			if (query) {
				fetchUserSuggestions(query);
			}
		} catch (err) {
			setSearchError(err.message || "Unable to add friend");
			setActionStatus("Friend request failed.");
		} finally {
			setActionBusyKey("");
		}
	};

	const messageFriend = async (targetId) => {
		const token = getToken();
		if (!token) {
			setSearchError("Please login to message friends.");
			return;
		}

		const key = `message:${targetId}`;
		setActionBusyKey(key);
		setSearchError("");
		try {
			await apiRequest(`/messages/friend/${targetId}`, {
				method: "POST",
				token,
				body: { message: "Hi! Great to connect with you." },
			});
			setSearchOpen(false);
			navigate("/chat");
		} catch (err) {
			setSearchError(err.message || "Unable to start direct message");
		} finally {
			setActionBusyKey("");
		}
	};

	const callFriend = async (targetId) => {
		const token = getToken();
		if (!token) {
			setSearchError("Please login to call friends.");
			return;
		}

		const key = `call:${targetId}`;
		setActionBusyKey(key);
		setSearchError("");
		try {
			const result = await apiRequest(`/calls/friend/${targetId}/join`, {
				method: "POST",
				token,
			});
			const callId = result?.call?.id;
			const matchId = result?.call?.match_id;
			if (!callId) {
				throw new Error("Unable to create call session");
			}
			setSearchOpen(false);
			navigate(
				`/call?callId=${encodeURIComponent(callId)}${matchId ? `&matchId=${encodeURIComponent(matchId)}` : ""}`,
			);
		} catch (err) {
			setSearchError(err.message || "Unable to start friend call");
		} finally {
			setActionBusyKey("");
		}
	};

	const mobileMenuRef = useRef(null);
	const mobileOpenRef = useRef(mobileOpen);

	useEffect(() => {
		mobileOpenRef.current = mobileOpen;
	}, [mobileOpen]);

	useEffect(() => {
		if (mobileOpen) {
			document.body.style.overflow = "hidden";
		} else {
			document.body.style.overflow = "";
		}
		return () => {
			document.body.style.overflow = "";
		};
	}, [mobileOpen]);

	useEffect(() => {
		const handleBackButton = () => {
			if (mobileOpenRef.current) {
				setMobileOpen(false);
			}
		};

		window.addEventListener("popstate", handleBackButton);
		return () => window.removeEventListener("popstate", handleBackButton);
	}, []);

	useEffect(() => {
		const handleClickOutside = (event) => {
			if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target)) {
				setMobileOpen(false);
			}
		};

		if (mobileOpen) {
			document.addEventListener("mousedown", handleClickOutside);
		} else {
			document.removeEventListener("mousedown", handleClickOutside);
		}

		return () => {
			document.removeEventListener("mousedown", handleClickOutside);
		};
	}, [mobileOpen]);

	useEffect(() => {
		const html = document.documentElement;
		html.style.transition =
			"background-color 0.3s ease, color 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease";
		const timer = setTimeout(() => {
			html.style.transition = "";
		}, 400);
		return () => clearTimeout(timer);
	}, []);

	return (
		<Motion.nav
			style={{ y: navY }}
			className="sticky top-0 z-50 w-full border-b border-white/10 bg-white/65 backdrop-blur-2xl dark:bg-slate-950/55"
		>
			<div className="mx-auto w-full max-w-[1600px] px-4 sm:px-6 lg:px-8">
				<div className="flex min-h-20 flex-nowrap items-center justify-between gap-1 sm:gap-3 py-3">
					<div className="flex min-w-0 flex-shrink items-center gap-1 md:gap-4">
						{location.pathname !== "/" && (
							<button
								onClick={() => navigate(-1)}
								className="inline-flex h-11 w-11 items-center justify-center rounded-full text-slate-600 transition hover:bg-slate-900/5 dark:text-slate-300 dark:hover:bg-white/10"
								aria-label="Go back"
							>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									width="20"
									height="20"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="2"
									strokeLinecap="round"
									strokeLinejoin="round"
								>
									<path d="m15 18-6-6 6-6" />
								</svg>
							</button>
						)}
						<Link
							to={user ? getRoleHome(user.role) : "/"}
							className="inline-flex min-w-0 items-center gap-2.5 rounded-full px-1 py-1 transition sm:px-2"
							aria-label="GarTexHub home"
						>
							<BrandMark size={40} alt="" />
							<span className="min-w-0">
								<span className="block text-base font-bold leading-tight text-slate-900 dark:text-white">
									GarTexHub
								</span>
								<span className="block truncate text-xs leading-tight text-slate-500 dark:text-slate-400">
									Garments &amp; Textile Sourcing
								</span>
							</span>
						</Link>

						<SlideIn
							direction="down"
							as="div"
							className="hidden min-w-0 flex-shrink items-center gap-1 md:flex"
						>
							{user
								? validNavGroups.map((group, idx) => (
										<Motion.div
											key={group.label}
											initial={{ opacity: 0, y: -8 }}
											animate={{ opacity: 1, y: 0 }}
											transition={{
												duration: 0.35,
												delay: idx ? 0.05 : 0,
												ease: easePremium,
											}}
										>
											<NavDropdown
												group={group}
												isOpen={openDropdown === group.label}
												onToggle={handleSetDropdown}
												userRole={String(user?.role || "").toLowerCase()}
												badgeCount={unreadCount}
											/>
										</Motion.div>
									))
								: validPublicLinks.map(({ to, label, external }, idx) => (
										<Motion.div
											key={to}
											initial={{ opacity: 0, y: -8 }}
											animate={{ opacity: 1, y: 0 }}
											transition={{
												duration: 0.35,
												delay: idx ? 0.05 : 0,
												ease: easePremium,
											}}
										>
											{external ? (
												<a
													href={to}
													className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium text-slate-600 transition hover:text-slate-950 dark:text-slate-300 dark:hover:text-white"
												>
													{label}
												</a>
											) : (
												<MagneticNavLink to={to} label={label} active={location.pathname === to} />
											)}
										</Motion.div>
									))}
						</SlideIn>
					</div>

					<div className="flex flex-shrink-0 items-center gap-2 sm:gap-3">
						{user && (
							<div ref={searchRef} className="relative hidden items-center md:flex">
								{searchExpanded ? (
									<div
										className={cn(
											"relative flex w-[400px] max-w-[calc(100vw-2rem)] items-center rounded-full border border-white/10 bg-white/65 px-3 py-2 backdrop-blur-xl shadow-[0_20px_45px_rgba(51,122,176,0.12)] transition-[width,box-shadow] duration-300",
											"dark:bg-slate-950/70",
										)}
									>
										<Search className="h-4 w-4 text-slate-400" />
										<input
											ref={searchInputRef}
											value={searchQuery}
											onChange={(e) => {
												setSearchQuery(e.target.value);
												setSearchOpen(true);
											}}
											onFocus={() => setSearchOpen(true)}
											onBlur={() => {
												if (!searchQuery.trim()) {
													setSearchExpanded(false);
												}
											}}
											onKeyDown={(e) => {
												if (e.key === "Enter" && searchQuery.trim()) {
													navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
													setSearchExpanded(false);
													setSearchOpen(false);
												}
											}}
											placeholder="Search users..."
											className="min-w-0 flex-1 bg-transparent px-2 text-sm text-slate-700 outline-none placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500"
										/>
										<button
											type="button"
											onClick={() => {
												setSearchExpanded(false);
												setSearchQuery("");
												setSearchOpen(false);
											}}
											className="pointer-events-auto rounded-full bg-slate-900/5 px-2.5 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-900/10 dark:bg-white/5 dark:text-slate-400 dark:hover:bg-white/10"
										>
											✕
										</button>
									</div>
								) : (
									<button
										type="button"
										onClick={() => setSearchExpanded(true)}
										className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/65 text-slate-600 shadow-sm transition hover:-translate-y-0.5 hover:text-sky-600 dark:bg-slate-950/70 dark:text-slate-300 dark:hover:text-sky-300"
										aria-label="Open search"
									>
										<Search className="h-5 w-5" />
									</button>
								)}

								{user && searchOpen && searchQuery.trim().length > 0 ? (
									<div className="absolute left-0 top-[calc(100%+10px)] z-50 w-[360px] overflow-hidden rounded-3xl border border-white/10 bg-white/95 p-2 shadow-[0_25px_70px_rgba(15,23,42,0.16)] backdrop-blur-2xl dark:bg-slate-950/95">
										{searchLoading ? (
											<ThreeDot
												variant="bounce"
												color="#337ab0"
												size="small"
												text=""
												textColor=""
											/>
										) : null}
										{!searchLoading && searchError ? (
											<p className="px-2 py-3 text-xs text-rose-500">{searchError}</p>
										) : null}
										{!(searchLoading || searchError) && searchResults.length === 0 ? (
											<p className="px-2 py-3 text-xs text-slate-500">No users found.</p>
										) : null}
										{!(searchLoading || searchError) && searchResults.length > 0 ? (
											<p className="px-3 pb-2 text-[11px] uppercase tracking-[0.2em] text-slate-400">
												Suggestions
											</p>
										) : null}
										{actionStatus ? (
											<p className="px-3 pb-2 text-[11px] text-emerald-600">{actionStatus}</p>
										) : null}

										{!(searchLoading || searchError) &&
											searchResults.map((result) => (
												<div
													key={result.id}
													className="mb-1 rounded-2xl px-2 py-2 last:mb-0 transition hover:bg-slate-900/5 dark:hover:bg-white/5"
												>
													<div className="flex items-center justify-between gap-2">
														<div>
															<p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
																{result.name}
																{result.is_self ? " (You)" : ""}
															</p>
															<p className="text-xs text-slate-500">
																{result.role} - {result.email}
															</p>
														</div>
														{result.verified ? (
															<span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
																Verified
															</span>
														) : null}
													</div>

													<div className="mt-2 flex flex-wrap gap-2">
														<button
															disabled={
																result.is_self ||
																result.following ||
																actionBusyKey === `follow:${result.id}`
															}
															onClick={() => followUser(result.id)}
															className="inline-flex items-center rounded-xl bg-sky-500/10 px-2.5 py-1.5 text-xs font-semibold text-sky-700 transition hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-60 dark:text-sky-300"
														>
															{actionBusyKey === `follow:${result.id}`
																? "Following..."
																: result.is_self
																	? "Follow"
																	: result.following
																		? "Following"
																		: "Follow"}
														</button>
														<button
															disabled={
																result.is_self ||
																["friends", "requested", "self"].includes(result.friend_status) ||
																actionBusyKey === `friend:${result.id}`
															}
															onClick={() => addFriend(result.id)}
															className="inline-flex items-center rounded-xl bg-indigo-500/10 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-500/20 disabled:cursor-not-allowed disabled:opacity-60 dark:text-indigo-300"
														>
															{actionBusyKey === `friend:${result.id}` ? (
																<ThreeDot
																	variant="bounce"
																	color="#337ab0"
																	size="small"
																	text=""
																	textColor=""
																/>
															) : result.is_self ? (
																"Add Friend"
															) : result.friend_status === "incoming" ? (
																"Accept"
															) : (
																"Add Friend"
															)}
														</button>
														{result.friend_status === "friends" ? (
															<>
																<button
																	disabled={actionBusyKey === `message:${result.id}`}
																	onClick={() => messageFriend(result.id)}
																	className="inline-flex items-center rounded-xl bg-emerald-500/10 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60 dark:text-emerald-300"
																>
																	Message
																</button>
																<button
																	disabled={actionBusyKey === `call:${result.id}`}
																	onClick={() => callFriend(result.id)}
																	className="inline-flex items-center rounded-xl bg-sky-500/10 px-2.5 py-1.5 text-xs font-semibold text-sky-700 transition hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-60 dark:text-sky-300"
																>
																	Call
																</button>
															</>
														) : null}
													</div>
												</div>
											))}
									</div>
								) : null}
							</div>
						)}

						<div className="ml-auto flex items-center gap-2">
							<div className="hidden md:block">
								<IconNavLink
									to="/notifications"
									Icon={Bell}
									label="Notifications"
									badgeCount={unreadCount}
									active={location.pathname === "/notifications"}
								/>
							</div>

							<span
								aria-hidden="true"
								className="hidden h-6 w-px bg-slate-900/10 sm:block dark:bg-white/10"
							/>

							<button
								onClick={toggleTheme}
								className="inline-flex h-11 items-center gap-2 rounded-full border border-white/10 bg-white/65 px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm transition hover:-translate-y-0.5 dark:bg-slate-950/70 dark:text-white"
								aria-label={
									dark
										? "Light theme on, switch to dark mode"
										: "Dark theme on, switch to light mode"
								}
							>
								{dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
								<span className="hidden sm:inline">{dark ? "Light" : "Dark"}</span>
							</button>

							<span
								aria-hidden="true"
								className="hidden h-6 w-px bg-slate-900/10 sm:block dark:bg-white/10"
							/>
							{user ? (
								<button
									onClick={handleLogout}
									className="hidden md:inline-flex h-11 items-center gap-2 rounded-full bg-gradient-to-r from-sky-500 to-cyan-500 px-4 text-sm font-semibold text-white shadow-lg shadow-sky-500/20 transition hover:brightness-110"
								>
									Logout
								</button>
							) : (
								<Link
									to="/login"
									className="hidden md:inline-flex h-11 items-center gap-2 rounded-full bg-gradient-to-r from-sky-500 to-cyan-500 px-4 text-sm font-semibold text-white shadow-lg shadow-sky-500/20 transition hover:brightness-110"
								>
									Login
								</Link>
							)}

							{user && (
								<button
									type="button"
									onClick={() => navigate("/search")}
									className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/70 text-slate-600 shadow-sm transition hover:-translate-y-0.5 hover:text-sky-600 dark:bg-slate-950/70 dark:text-slate-300 dark:hover:text-sky-300 md:hidden"
									aria-label="Search"
								>
									<Search className="h-5 w-5" />
								</button>
							)}
							<button
								onClick={() => setMobileOpen((v) => !v)}
								className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/70 text-slate-900 shadow-sm transition hover:-translate-y-0.5 dark:bg-slate-950/70 dark:text-white md:hidden"
								aria-label={mobileOpen ? "Close menu" : "Open menu"}
							>
								{mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
							</button>
						</div>
					</div>
				</div>
			</div>

			<AnimatePresence>
				{mobileOpen && (
					<Motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						className="fixed inset-0 z-[60] bg-white dark:bg-slate-950 md:hidden"
					>
						<Motion.div
							ref={mobileMenuRef}
							initial={{ x: "-100%", opacity: 0 }}
							animate={{ x: 0, opacity: 1 }}
							exit={{ x: "-100%", opacity: 0 }}
							transition={{ type: "spring", stiffness: 300, damping: 30 }}
							className="mx-auto mt-16 w-[min(92vw,28rem)] overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_30px_90px_rgba(15,23,42,0.22)] dark:border-white/10 dark:bg-slate-950"
						>
							<div className="flex items-center justify-between border-b border-slate-900/5 px-5 py-4 dark:border-white/10">
								<div className="flex items-center gap-3">
									<BrandMark size={32} />
									<div>
										<div className="text-sm font-semibold text-slate-900 dark:text-white">
											GarTexHub
										</div>
										<div className="text-xs text-slate-500 dark:text-slate-400">Navigation</div>
									</div>
								</div>
								<button
									onClick={() => setMobileOpen(false)}
									className="rounded-full p-2 text-slate-600 hover:bg-slate-900/5 dark:text-slate-300 dark:hover:bg-white/10"
									aria-label="Close menu"
								>
									<X className="h-5 w-5" />
								</button>
							</div>

							<div className="max-h-[calc(100dvh-9rem)] overflow-y-auto overscroll-contain p-4">
								<div className="space-y-3">
									{user
										? validNavGroups.map((group) => (
												<div
													key={group.label}
													className="rounded-3xl border border-slate-900/5 bg-white/70 p-3 dark:border-white/10 dark:bg-white/5"
												>
													<div className="mb-2 flex items-center gap-2 px-1 text-sm font-semibold text-slate-900 dark:text-white">
														<group.icon className="h-4 w-4 text-sky-500" />
														{group.label}
													</div>
													<div className="space-y-1">
														{group.items
															.filter((item) => item.to !== "/settings")
															.map((item) => {
																const ItemIcon =
																	{
																		"My Profile": Vote,
																		Feed: LayoutDashboard,
																		"Manage Listings": Package,
																		Search,
																		Contracts: FileText,
																		Verification: ShieldCheck,
																		Notifications: Bell,
																		Chat: MessageSquare,
																		Requests: FileText,
																		Products: Package,
																		Partners: Users,
																		Ratings: Star,
																		Members: Users,
																		Settings,
																		Insights: FileText,
																		"Owner Dashboard": Star,
																		"Agent Dashboard": Star,
																		"Admin Panel": ShieldCheck,
																		Governance: Settings,
																		"Contact Support": Settings,
																		Onboarding: Star,
																	}[item.label] || Settings;
																const LinkTag2 = item.external ? "a" : Link;
																const linkProps2 = item.external
																	? { href: item.to, target: "_blank", rel: "noopener noreferrer" }
																	: { to: item.to, onClick: () => setMobileOpen(false) };
																return (
																	<LinkTag2
																		key={item.to}
																		{...linkProps2}
																		className={cn(
																			"flex items-center justify-between rounded-2xl px-3 py-2.5 text-sm transition",
																			location.pathname === item.to ||
																				`${location.pathname}?${location.search}` === item.to
																				? "bg-sky-500/10 text-sky-700 dark:text-sky-300"
																				: "text-slate-600 hover:bg-slate-900/5 dark:text-slate-300 dark:hover:bg-white/10",
																		)}
																	>
																		<span className="flex items-center gap-3">
																			<ItemIcon className="h-4 w-4" />
																			{item.label}
																		</span>
																		{item.badge &&
																			item.to === "/notifications" &&
																			unreadCount > 0 && (
																				<Motion.span
																					animate={{ scale: [1, 1.15, 1] }}
																					transition={{
																						duration: 1.5,
																						repeat: Number.POSITIVE_INFINITY,
																						ease: "easeInOut",
																					}}
																					className="rounded-full bg-cyan-500 px-2 py-0.5 text-[10px] font-semibold text-white"
																				>
																					{unreadCount > 99 ? "99+" : unreadCount}
																				</Motion.span>
																			)}
																		<ChevronRight className="h-4 w-4 opacity-40" />
																	</LinkTag2>
																);
															})}
													</div>
												</div>
											))
										: validPublicLinks.map(({ to, label, external }) => {
												const LinkTag3 = external ? "a" : Link;
												const linkProps3 = external
													? { href: to, target: "_blank", rel: "noopener noreferrer" }
													: { to, onClick: () => setMobileOpen(false) };
												return (
													<LinkTag3
														key={to}
														{...linkProps3}
														className={cn(
															"flex items-center justify-between rounded-2xl px-3 py-2.5 text-sm font-medium transition",
															location.pathname === to
																? "bg-sky-500/10 text-sky-700 dark:text-sky-300"
																: "text-slate-600 hover:bg-slate-900/5 dark:text-slate-300 dark:hover:bg-white/10",
														)}
													>
														<span>{label}</span>
														<ChevronRight className="h-4 w-4 opacity-40" />
													</LinkTag3>
												);
											})}

									{/* Account actions close the same list (client 02/11/2026,
									    IMG-20261102-WA0021) instead of a detached button row. */}
									{user ? (
										<div className="rounded-3xl border border-slate-900/5 bg-white/70 p-3 dark:border-white/10 dark:bg-white/5">
											<div className="mb-2 flex items-center gap-2 px-1 text-sm font-semibold text-slate-900 dark:text-white">
												<Settings className="h-4 w-4 text-sky-500" />
												Account
											</div>
											<div className="space-y-1">
												<Link
													to="/settings"
													onClick={() => setMobileOpen(false)}
													className={cn(
														"flex items-center justify-between rounded-2xl px-3 py-2.5 text-sm transition",
														location.pathname === "/settings"
															? "bg-sky-500/10 text-sky-700 dark:text-sky-300"
															: "text-slate-600 hover:bg-slate-900/5 dark:text-slate-300 dark:hover:bg-white/10",
													)}
												>
													<span className="flex items-center gap-3">
														<Settings className="h-4 w-4" />
														Settings
													</span>
													<ChevronRight className="h-4 w-4 opacity-40" />
												</Link>
												<button
													type="button"
													onClick={toggleTheme}
													className="flex w-full items-center justify-between rounded-2xl px-3 py-2.5 text-left text-sm text-slate-600 transition hover:bg-slate-900/5 dark:text-slate-300 dark:hover:bg-white/10"
												>
													<span className="flex items-center gap-3">
														{dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
														{dark ? "Light mode" : "Dark mode"}
													</span>
												</button>
												<button
													type="button"
													onClick={handleLogout}
													className="flex w-full items-center justify-between rounded-2xl px-3 py-2.5 text-left text-sm font-medium text-rose-600 transition hover:bg-rose-500/10 dark:text-rose-300"
												>
													<span className="flex items-center gap-3">
														<LogOut className="h-4 w-4" />
														Logout
													</span>
												</button>
											</div>
										</div>
									) : null}
								</div>

								{user ? null : (
									<div className="mt-4 rounded-3xl border border-sky-400/10 bg-gradient-to-br from-sky-500/10 to-cyan-500/10 p-4">
										<div className="text-sm font-semibold text-slate-900 dark:text-white">
											Guest access
										</div>
										<div className="mt-3 flex flex-col gap-2">
											<Link
												to="/login"
												onClick={() => setMobileOpen(false)}
												className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white dark:bg-white dark:text-slate-950"
											>
												Login
											</Link>
											<Link
												to="/signup"
												onClick={() => setMobileOpen(false)}
												className="inline-flex items-center justify-center rounded-2xl border border-slate-900/10 bg-white/70 px-4 py-2.5 text-sm font-semibold text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-white"
											>
												Signup
											</Link>
											<div className="mt-1 grid grid-cols-2 gap-2 text-xs text-slate-500 dark:text-slate-400">
												<Link
													to="/terms"
													onClick={() => setMobileOpen(false)}
													className="hover:text-sky-600"
												>
													Terms
												</Link>
												<Link
													to="/privacy"
													onClick={() => setMobileOpen(false)}
													className="text-right hover:text-sky-600"
												>
													Privacy
												</Link>
											</div>
										</div>
									</div>
								)}
							</div>
						</Motion.div>
					</Motion.div>
				)}
			</AnimatePresence>
		</Motion.nav>
	);
}
