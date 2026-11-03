/* global process */

import { motion } from "framer-motion";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import {
	BrowserRouter,
	Navigate,
	Route,
	Routes,
	useLocation,
	useNavigationType,
} from "react-router-dom";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import Footer from "./components/Footer.jsx";
import NavBar from "./components/NavBar.jsx";
import OfflineBanner from "./components/OfflineBanner.jsx";
import ScrollProgressBar from "./components/ScrollProgressBar.jsx";
import ScrollToTop from "./components/ScrollToTop.jsx";
import ThemeSwitcher from "./components/ThemeSwitcher.jsx";
import { ToastProvider } from "./components/ToastContainer.jsx";
import NeonAtom from "./components/ui/NeonAtom.jsx";
import { clearSession, getCurrentUser, getToken, verifyAndSyncUser } from "./lib/auth.js";
import { trackClientEvent } from "./lib/events.js";
import { logger } from "./lib/logger.js";

const FloatingAssistant = lazy(() => import("./components/FloatingAssistant.jsx"));
const CyberpunkCursor = lazy(() => import("./components/ui/CyberpunkCursor.jsx"));

function LazyLoadError() {
	return (
		<div class="flex min-h-[400px] flex-col items-center justify-center gap-4 p-8 text-center">
			<div class="rounded-full bg-red-100 p-4 dark:bg-red-900/30">
				<svg class="h-8 w-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth={2}
						d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
					/>
				</svg>
			</div>
			<h2 class="text-xl font-semibold text-slate-900 dark:text-white">Failed to load page</h2>
			<p class="max-w-md text-sm text-slate-500 dark:text-slate-400">
				The page could not be loaded. This may be a network issue or a new version was deployed.
			</p>
			<button
				onClick={() => window.location.reload()}
				class="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700"
			>
				Refresh Page
			</button>
		</div>
	);
}

// A route chunk can fail to load right after a deploy: a page opened before
// the deploy asks for chunk names that no longer exist. Retry once (a network
// blip), then reload the page once so it picks up the new build; the error
// screen is only for a failure that survives the reload.
const CHUNK_RELOAD_KEY = "gth_chunk_reload_at";

function reloadOnceForNewBuild() {
	try {
		const last = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY) || 0);
		if (Date.now() - last < 30_000) {
			return false;
		}
		sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()));
	} catch {
		return false;
	}
	window.location.reload();
	return true;
}

const safeLazy = (importFn) =>
	lazy(() =>
		importFn()
			.catch(() => new Promise((resolve) => setTimeout(resolve, 600)).then(importFn))
			.catch(() => {
				if (reloadOnceForNewBuild()) {
					return new Promise(() => {});
				}
				return { default: LazyLoadError };
			}),
	);

const TexHub = safeLazy(() => import("./pages/TexHub.jsx"));
const Pricing = safeLazy(() => import("./pages/Pricing.jsx"));
const Login = safeLazy(() => import("./pages/auth/Login.jsx"));
const Signup = safeLazy(() => import("./pages/auth/Signup.jsx"));
const ForgotPassword = safeLazy(() =>
	import("./pages/auth/ForgotPassword.jsx").then((m) => ({ default: m.ForgotPassword })),
);
const ResetPassword = safeLazy(() => import("./pages/auth/ForgotPassword.jsx"));
const SignupUltra = safeLazy(() => import("./pages/auth/SignupUltra.jsx"));
const OnboardingPage = safeLazy(() => import("./pages/auth/OnboardingPage.jsx"));
const SharedPost = safeLazy(() => import("./pages/SharedPost.jsx"));
const MainFeed = safeLazy(() => import("./pages/MainFeed.jsx"));
const FeedManagement = safeLazy(() => import("./pages/FeedManagement.jsx"));
const SearchResults = safeLazy(() => import("./pages/SearchResults.jsx"));
const BuyerProfile = safeLazy(() => import("./pages/BuyerProfile.jsx"));
const FactoryProfile = safeLazy(() => import("./pages/FactoryProfile.jsx"));
const BuyingHouseProfile = safeLazy(() => import("./pages/BuyingHouseProfile.jsx"));
const MemberManagement = safeLazy(() => import("./pages/MemberManagement.jsx"));
const PartnerNetwork = safeLazy(() => import("./pages/PartnerNetwork.jsx"));
const ProductManagement = safeLazy(() => import("./pages/ProductManagement.jsx"));
const BuyerRequestManagement = safeLazy(() => import("./pages/BuyerRequestManagement.jsx"));
const HelpCenter = safeLazy(() => import("./pages/HelpCenter.jsx"));
const NotificationsCenter = safeLazy(() => import("./pages/NotificationsCenter.jsx"));
const Settings = safeLazy(() => import("./pages/Settings.jsx"));
const Insights = safeLazy(() => import("./pages/Insights.jsx"));
const About = safeLazy(() => import("./pages/About.jsx"));
const Terms = safeLazy(() => import("./pages/Terms.jsx"));
const Privacy = safeLazy(() => import("./pages/Privacy.jsx"));
const ChatInterface = safeLazy(() => import("./pages/ChatInterface.jsx"));
const CallInterface = safeLazy(() => import("./pages/CallInterface.jsx"));
const OwnerDashboard = safeLazy(() => import("./pages/OwnerDashboard.jsx"));
const AgentDashboard = safeLazy(() => import("./pages/AgentDashboard.jsx"));

const IndustryPage = safeLazy(() => import("./pages/IndustryPage.jsx"));
const RatingFeedback = safeLazy(() => import("./pages/RatingFeedback.jsx"));
const SupportReports = safeLazy(() => import("./pages/SupportReports.jsx"));
const VerificationPage = safeLazy(() => import("./pages/VerificationPage.jsx"));
const JoinRequestPage = safeLazy(() => import("./pages/JoinRequestPage.jsx"));
const TaskTracker = safeLazy(() => import("./pages/TaskTracker.jsx"));
const FeedbackPage = safeLazy(() => import("./pages/FeedbackPage.jsx"));
const ProfilePage = safeLazy(() => import("./pages/ProfilePage.jsx"));
const AdminPanel = safeLazy(() => import("./pages/AdminPanel.jsx"));
const AdminGovernance = safeLazy(() => import("./pages/AdminGovernance.jsx"));
const AccessDenied = safeLazy(() => import("./pages/AccessDenied.jsx"));
const NotFound = safeLazy(() => import("./pages/NotFound.jsx"));

const OrderManagement = safeLazy(() => import("./pages/OrderManagement.jsx"));
const BoostDetailsPage = safeLazy(() => import("./pages/BoostDetailsPage.jsx"));

const AUTH_ROLES = ["buyer", "buying_house", "factory", "owner", "admin", "agent"];
const OWNER_ROLES = ["owner", "admin", "buying_house", "factory"];
const CONTRACT_ROLES = ["owner", "admin", "buying_house", "factory", "buyer"];
const INSIGHTS_ROLES = ["owner", "admin", "buying_house", "factory", "buyer"];
const MEMBER_MANAGEMENT_ROLES = ["owner", "admin", "buying_house", "factory"];

function OrgSettingsRedirect() {
	const location = useLocation();
	return <Navigate to={`/settings${location.search}`} replace={true} />;
}

// Company accounts manage verification inside the owner console; buyers and
// agents get the standalone verification page (they used to hit Access denied).
function VerificationRoute() {
	const role = String(getCurrentUser()?.role || "").toLowerCase();
	return OWNER_ROLES.includes(role) ? <OwnerDashboard /> : <VerificationPage />;
}

// New pages open at the top; "#section" links land on that section; browser
// back/forward is left to the browser's own scroll restoration.
function RouteScrollManager() {
	const location = useLocation();
	const navigationType = useNavigationType();

	useEffect(() => {
		if (navigationType === "POP") {
			return undefined;
		}
		const id = decodeURIComponent(location.hash.replace(/^#/, ""));
		if (!id) {
			window.scrollTo(0, 0);
			return undefined;
		}
		// Lazy pages render after navigation, so look for the anchor briefly.
		let frame = 0;
		let tries = 0;
		const seek = () => {
			const target = document.getElementById(id);
			if (target) {
				target.scrollIntoView({ block: "start" });
			} else if (tries++ < 40) {
				frame = requestAnimationFrame(seek);
			}
		};
		seek();
		return () => cancelAnimationFrame(frame);
	}, [location.pathname, location.hash, navigationType]);

	return null;
}

function ProtectedRoute({ children, roles }) {
	const location = useLocation();
	const token = getToken();
	const [user, setUser] = useState(() => getCurrentUser());

	// Background sync: if user is null on mount, poll until cached or redirect after timeout.
	// Hooks run before any early return - a token that disappears mid-session
	// (logout, expired refresh) must not change the hook order.
	useEffect(() => {
		if (user || !token) return;
		let attempts = 0;
		const maxAttempts = 30; // 30 * 500ms = 15 seconds max
		const interval = setInterval(() => {
			attempts++;
			const cached = getCurrentUser();
			if (cached) {
				setUser(cached);
				clearInterval(interval);
			} else if (attempts >= maxAttempts) {
				clearInterval(interval);
				clearSession();
				window.location.href = "/login";
			}
		}, 500);
		return () => clearInterval(interval);
	}, [user, token]);

	if (!token) {
		return (
			<Navigate
				to="/login"
				replace={true}
				state={{ from: `${location.pathname}${location.search}${location.hash}` }}
			/>
		);
	}

	if (!user) {
		return <NeonAtom fill={true} size={80} />;
	}

	// Account locked screen
	const isLocked = user?.status === "locked";
	const isUnlockPage = location.pathname === "/settings" || location.pathname === "/profile";
	if (isLocked && !isUnlockPage) {
		return (
			<div class="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-[var(--theme-custom-0b1220)] px-4">
				<div class="max-w-md w-full rounded-3xl border border-white/70 bg-white/80 p-8 text-center shadow-2xl backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/80">
					<div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
						<svg
							class="h-8 w-8 text-amber-600 dark:text-amber-400"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							strokeWidth={2}
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
							/>
						</svg>
					</div>
					<h2 class="text-xl font-bold text-slate-900 dark:text-white">Account Locked</h2>
					<p class="mt-2 text-sm text-slate-500 dark:text-slate-400">
						Your account has been temporarily locked. Some features are limited.
					</p>
					<button
						type="button"
						onClick={() => {
							try {
								localStorage.removeItem("ght_account_locked");
							} catch {}
							window.location.href = "/settings";
						}}
						class="mt-6 rounded-full bg-amber-500 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-amber-500/25 transition hover:bg-amber-600"
					>
						Unlock Account
					</button>
					<button
						type="button"
						onClick={() => {
							clearSession();
							window.location.href = "/login";
						}}
						class="mt-3 block w-full text-center text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
					>
						Log out instead
					</button>
				</div>
			</div>
		);
	}

	const userRole = user?.role;
	if (Array.isArray(roles) && roles.length > 0 && userRole && !roles.includes(userRole)) {
		return <Navigate to="/access-denied" replace={true} state={{ from: location.pathname }} />;
	}

	return children;
}

function AppRoutes() {
	const location = useLocation();
	return (
		<Routes location={location} key={location.pathname}>
			<Route path="/" element={<TexHub />} />
			<Route path="/pricing" element={<Pricing />} />
			<Route path="/about" element={<About />} />
			<Route path="/terms" element={<Terms />} />
			<Route path="/privacy" element={<Privacy />} />
			<Route path="/help" element={<HelpCenter />} />
			<Route
				path="/login"
				element={
					<ErrorBoundary>
						<Login />
					</ErrorBoundary>
				}
			/>
			<Route
				path="/signup"
				element={
					<ErrorBoundary>
						<Signup />
					</ErrorBoundary>
				}
			/>
			<Route path="/forgot-password" element={<ForgotPassword />} />
			<Route path="/reset-password" element={<ResetPassword />} />
			<Route
				path="/share/:entityType/:entityId"
				element={
					<ErrorBoundary>
						<SharedPost />
					</ErrorBoundary>
				}
			/>
			<Route path="/:time/meow/:date/SignupUltra" element={<SignupUltra />} />
			<Route
				path="/onboarding"
				element={
					<ProtectedRoute roles={AUTH_ROLES}>
						<OnboardingPage />
					</ProtectedRoute>
				}
			/>
			<Route path="/access-denied" element={<AccessDenied />} />

			<Route
				path="/feed"
				element={
					<ProtectedRoute roles={AUTH_ROLES}>
						<MainFeed />
					</ProtectedRoute>
				}
			/>
			<Route
				path="/feed/manage"
				element={
					<ProtectedRoute roles={AUTH_ROLES}>
						<FeedManagement />
					</ProtectedRoute>
				}
			/>
			<Route
				path="/search"
				element={
					<ProtectedRoute roles={AUTH_ROLES}>
						<SearchResults />
					</ProtectedRoute>
				}
			/>
			<Route
				path="/boosts/:id"
				element={
					<ProtectedRoute roles={AUTH_ROLES}>
						<BoostDetailsPage />
					</ProtectedRoute>
				}
			/>
			<Route
				path="/industry/:slug"
				element={
					<ProtectedRoute roles={AUTH_ROLES}>
						<IndustryPage />
					</ProtectedRoute>
				}
			/>
			<Route
				path="/buyer/:id"
				element={
					<ProtectedRoute roles={AUTH_ROLES}>
						<BuyerProfile />
					</ProtectedRoute>
				}
			/>
			<Route
				path="/factory/:id"
				element={
					<ProtectedRoute roles={AUTH_ROLES}>
						<FactoryProfile />
					</ProtectedRoute>
				}
			/>
			<Route
				path="/buying-house/:id"
				element={
					<ProtectedRoute roles={AUTH_ROLES}>
						<BuyingHouseProfile />
					</ProtectedRoute>
				}
			/>
			<Route
				path="/partner-network"
				element={
					<ProtectedRoute roles={["buying_house", "admin", "factory", "agent", "owner"]}>
						<PartnerNetwork />
					</ProtectedRoute>
				}
			/>
			<Route
				path="/product-management"
				element={
					<ProtectedRoute roles={["factory", "buying_house", "admin"]}>
						<ProductManagement />
					</ProtectedRoute>
				}
			/>
			<Route
				path="/buyer-requests"
				element={
					<ProtectedRoute roles={["buyer", "buying_house", "admin"]}>
						<BuyerRequestManagement />
					</ProtectedRoute>
				}
			/>
			<Route
				path="/notifications"
				element={
					<ProtectedRoute roles={AUTH_ROLES}>
						<NotificationsCenter />
					</ProtectedRoute>
				}
			/>
			<Route
				path="/join-requests/:requestId"
				element={
					<ProtectedRoute roles={AUTH_ROLES}>
						<JoinRequestPage />
					</ProtectedRoute>
				}
			/>
			<Route
				path="/chat"
				element={
					<ProtectedRoute roles={AUTH_ROLES}>
						<ChatInterface />
					</ProtectedRoute>
				}
			/>
			<Route
				path="/call"
				element={
					<ProtectedRoute roles={AUTH_ROLES}>
						<CallInterface />
					</ProtectedRoute>
				}
			/>
			<Route
				path="/ratings/feedback"
				element={
					<ProtectedRoute roles={AUTH_ROLES}>
						<RatingFeedback />
					</ProtectedRoute>
				}
			/>
			<Route
				path="/support"
				element={
					<ProtectedRoute roles={AUTH_ROLES}>
						<SupportReports />
					</ProtectedRoute>
				}
			/>

			<Route
				path="/member-management"
				element={
					<ProtectedRoute roles={MEMBER_MANAGEMENT_ROLES}>
						<MemberManagement />
					</ProtectedRoute>
				}
			/>
			<Route
				path="/settings"
				element={
					<ProtectedRoute roles={AUTH_ROLES}>
						<Settings />
					</ProtectedRoute>
				}
			/>
			<Route path="/org-settings" element={<OrgSettingsRedirect />} />
			<Route
				path="/insights"
				element={
					<ProtectedRoute roles={INSIGHTS_ROLES}>
						<Insights />
					</ProtectedRoute>
				}
			/>
			<Route
				path="/owner"
				element={
					<ProtectedRoute roles={OWNER_ROLES}>
						<OwnerDashboard />
					</ProtectedRoute>
				}
			/>
			<Route
				path="/contracts"
				element={
					<ProtectedRoute roles={CONTRACT_ROLES}>
						<OwnerDashboard />
					</ProtectedRoute>
				}
			/>
			<Route
				path="/leads"
				element={
					<ProtectedRoute roles={OWNER_ROLES}>
						<OwnerDashboard />
					</ProtectedRoute>
				}
			/>
			<Route
				path="/verification"
				element={
					<ProtectedRoute roles={AUTH_ROLES}>
						<VerificationRoute />
					</ProtectedRoute>
				}
			/>
			<Route
				path="/verification-center"
				element={
					<ProtectedRoute roles={AUTH_ROLES}>
						<VerificationPage />
					</ProtectedRoute>
				}
			/>
			<Route
				path="/agent"
				element={
					<ProtectedRoute roles={["buying_house", "owner", "admin", "agent"]}>
						<AgentDashboard />
					</ProtectedRoute>
				}
			/>
			<Route
				path="/admin"
				element={
					<ProtectedRoute roles={["owner", "admin"]}>
						<AdminPanel />
					</ProtectedRoute>
				}
			/>
			<Route
				path="/admin/governance"
				element={
					<ProtectedRoute roles={["owner", "admin"]}>
						<AdminGovernance />
					</ProtectedRoute>
				}
			/>

			<Route
				path="/orders"
				element={
					<ProtectedRoute roles={AUTH_ROLES}>
						<OrderManagement />
					</ProtectedRoute>
				}
			/>

			<Route
				path="/tasks"
				element={
					<ProtectedRoute roles={AUTH_ROLES}>
						<TaskTracker />
					</ProtectedRoute>
				}
			/>
			<Route
				path="/feedback"
				element={
					<ProtectedRoute roles={AUTH_ROLES}>
						<FeedbackPage />
					</ProtectedRoute>
				}
			/>
			<Route
				path="/profile/:id"
				element={
					<ProtectedRoute roles={AUTH_ROLES}>
						<ProfilePage />
					</ProtectedRoute>
				}
			/>
			<Route path="*" element={<NotFound />} />
		</Routes>
	);
}

function AppLayout() {
	const location = useLocation();
	// The first page of a visit is shown without the route fade: content that
	// starts at opacity 0 delays first paint (LCP). Later navigations still fade.
	const landingPathRef = useRef(location.pathname);
	useEffect(() => {
		if (location.pathname !== landingPathRef.current) landingPathRef.current = null;
	}, [location.pathname]);
	const isImmersiveRoute = location.pathname === "/chat" || location.pathname === "/call";
	const isAdminRoute = location.pathname.startsWith("/admin");
	const hideChrome = isImmersiveRoute;
	const isViewportLockedRoute = ["/owner", "/contracts", "/leads", "/verification"].includes(
		location.pathname,
	);
	const content =
		isImmersiveRoute ? (
			<ErrorBoundary>
				<Suspense
					fallback={
						<div class="flex min-h-screen items-center justify-center">
							<NeonAtom size={48} />
						</div>
					}
				>
					<AppRoutes />
				</Suspense>
			</ErrorBoundary>
		) : (
			<>
				{hideChrome ? null : <ScrollProgressBar />}
				<div class="flex w-full justify-center bg-transparent">
					<div
						class={`app-shell flex ${isViewportLockedRoute ? "h-dvh overflow-hidden lg:h-[125dvh]" : "min-h-[125vh]"} flex-col text-slate-900 dark:text-slate-100 overflow-x-hidden lg:[zoom:0.8]${location.pathname === "/feed" ? " h-screen" : ""}`}
						style={{ width: "100%" }}
					>
						{hideChrome ? null : (
							<div className="global-navbar">
								<NavBar />
							</div>
						)}
						<main class="flex flex-1 min-h-0 flex-col bg-transparent overflow-x-hidden">
							<ErrorBoundary>
								<Suspense
									fallback={
										<div class="flex min-h-screen items-center justify-center">
											<NeonAtom size={48} />
										</div>
									}
								>
									<motion.div
										key={location.pathname}
										initial={landingPathRef.current === location.pathname ? false : { opacity: 0 }}
										animate={{ opacity: 1 }}
										transition={{ duration: 0.15, ease: "easeOut" }}
										class="flex min-h-0 flex-1 flex-col"
									>
										<AppRoutes />
									</motion.div>
								</Suspense>
							</ErrorBoundary>
						</main>
						{!hideChrome && location.pathname !== "/feed" ? (
							<div className="global-footer">
								<Footer />
							</div>
						) : null}
						{hideChrome ? null : (
							<Suspense fallback={null}>
								<FloatingAssistant />
							</Suspense>
						)}
					</div>
				</div>
			</>
		);

	const navigationRef = useRef({ path: "", startedAt: 0 });
	const sessionRef = useRef({ startedAt: 0, ended: false });

	// Sync user data from API on first load - security critical
	useEffect(() => {
		const token = getToken();
		if (token) {
			verifyAndSyncUser(token).catch((err) => logger.error("User sync failed:", err));
		}
	}, []);

	useEffect(() => {
		// Global event tracking (project.md): page views + time-on-page.
		// Uses a public endpoint that also accepts auth (if present).
		const currentPath = `${location.pathname}${location.search || ""}`;
		const now = Date.now();
		const prev = navigationRef.current;

		if (prev?.path) {
			const durationMs = Math.max(0, now - (prev.startedAt || now));
			trackClientEvent("page_duration", {
				entityType: "route",
				entityId: prev.path,
				metadata: { duration_ms: durationMs },
			});
		} else {
			// First route hit in this SPA session.
			trackClientEvent("session_start", {
				entityType: "route",
				entityId: currentPath,
			});
		}

		trackClientEvent("page_view", {
			entityType: "route",
			entityId: currentPath,
		});
		navigationRef.current = { path: currentPath, startedAt: now };
	}, [location.pathname, location.search]);

	useEffect(() => {
		function handleClick(event) {
			const target = event.target?.closest?.("button, a, [data-track-click]");
			if (!target) {
				return;
			}
			const label = String(target.getAttribute("aria-label") || target.textContent || "")
				.trim()
				.slice(0, 120);
			const tag = String(target.tagName || "").toLowerCase();
			trackClientEvent("click", {
				entityType: "route",
				entityId: `${location.pathname}${location.search || ""}`,
				metadata: { tag, label },
			});
		}

		document.addEventListener("click", handleClick);
		return () => {
			document.removeEventListener("click", handleClick);
		};
	}, [location.pathname, location.search]);

	useEffect(() => {
		function finalizeSession() {
			if (sessionRef.current.ended) {
				return;
			}
			sessionRef.current.ended = true;
			const durationSeconds = Math.max(
				1,
				Math.round((Date.now() - (sessionRef.current.startedAt || Date.now())) / 1000),
			);
			trackClientEvent("session_end", {
				entityType: "route",
				entityId: navigationRef.current?.path || "session",
				metadata: { duration_seconds: durationSeconds },
			});
		}

		function handleVisibility() {
			if (document.visibilityState === "hidden") {
				finalizeSession();
			}
		}

		sessionRef.current.startedAt = Date.now();
		sessionRef.current.ended = false;
		window.addEventListener("beforeunload", finalizeSession);
		document.addEventListener("visibilitychange", handleVisibility);
		return () => {
			window.removeEventListener("beforeunload", finalizeSession);
			document.removeEventListener("visibilitychange", handleVisibility);
		};
	}, []);

	// Native browser scrolling everywhere: the old smooth-scroll layer (Lenis)
	// intercepted wheel and touch input, which made every page feel slow and
	// stopped nested lists and keyboard-open forms from scrolling on phones.
	return content;
}

function App() {
	return (
		<BrowserRouter>
			<RouteScrollManager />
			<Suspense fallback={null}>
				<CyberpunkCursor />
			</Suspense>
			<ToastProvider>
				<ErrorBoundary>
					<AppLayout />
				</ErrorBoundary>
				<ScrollToTop />
				<OfflineBanner />
				<ThemeSwitcher />
			</ToastProvider>
		</BrowserRouter>
	);
}

export default App;
