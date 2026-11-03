import {
	ArrowLeft,
	ChevronRight,
	Home,
	Lock,
	LogIn,
	MoonStar,
	ShieldAlert,
	SunMedium,
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { getToken } from "../lib/auth.js";
import { useTheme } from "../lib/ThemeProvider.jsx";
import usePageMeta from "../lib/usePageMeta.js";

/**
 * Helper to format route label.
 * @param {string|Object} fromValue
 * @returns {string}
 */
function formatRouteLabel(fromValue) {
	if (!fromValue) {
		return "this page";
	}
	if (typeof fromValue === "string") {
		return fromValue;
	}
	if (typeof fromValue === "object") {
		return fromValue.pathname || fromValue.path || "this page";
	}
	return "this page";
}

/**
 * Renders an information item.
 * @param {Object} props
 * @param {string} props.label
 * @param {string} props.value
 * @returns {JSX.Element}
 */
function InfoItem({ label, value }) {
	return (
		<div class="rounded-2xl border border-slate-200/70 bg-white/80 p-4 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-950/50">
			<p class="text-xs font-medium uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
				{label}
			</p>
			<p class="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">{value}</p>
		</div>
	);
}

/**
 * AccessDenied page component.
 * @returns {JSX.Element}
 */
export default function AccessDenied() {
	usePageMeta({
		title: "Access Denied — GarTexHub",
		description:
			"You don't have permission to access this page on GarTexHub. Upgrade your plan or contact support.",
		url: "/access-denied",
		robots: "noindex,nofollow",
	});

	const { theme, toggleTheme } = useTheme();
	const isDark = theme === "dark";
	const location = useLocation();
	const navigate = useNavigate();
	const isLoggedIn = Boolean(getToken());
	const attemptedRoute = formatRouteLabel(location.state?.from);
	const hasHistory = typeof window !== "undefined" && window.history.length > 1;

	const handleBack = () => {
		if (hasHistory) {
			navigate(-1);
			return;
		}
		navigate("/", { replace: true });
	};

	return (
		<div class="relative min-h-screen overflow-hidden bg-slate-50 text-slate-900 transition-colors duration-300 dark:bg-[var(--theme-custom-06111f)] dark:text-slate-100">
			<div class="pointer-events-none absolute inset-0 -z-0">
				<div class="absolute left-1/2 top-[-8rem] h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-sky-300/30 blur-3xl dark:bg-sky-500/15" />
				<div class="absolute right-[-6rem] top-24 h-72 w-72 rounded-full bg-blue-300/25 blur-3xl dark:bg-blue-500/10" />
				<div class="absolute bottom-[-8rem] left-[-6rem] h-72 w-72 rounded-full bg-cyan-300/25 blur-3xl dark:bg-cyan-500/10" />
				<div class="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(109,171,223,0.16),transparent_40%),radial-gradient(circle_at_right,rgba(55,115,168,0.12),transparent_35%)] dark:bg-[radial-gradient(circle_at_top,rgba(109,171,223,0.12),transparent_40%),radial-gradient(circle_at_right,rgba(55,115,168,0.08),transparent_35%)]" />
			</div>

			<main class="relative z-10 mx-auto flex min-h-screen w-full max-w-7xl items-center px-4 py-10 sm:px-6 lg:px-8">
				<div class="grid w-full gap-6 lg:grid-cols-[1.5fr_0.9fr] lg:gap-8">
					<section class="overflow-hidden rounded-[2rem] border border-white/60 bg-white/75 shadow-[0_24px_90px_rgba(2,8,23,0.10)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/60 dark:shadow-[0_24px_90px_rgba(0,0,0,0.35)]">
						<div class="border-b border-slate-200/70 px-6 py-5 dark:border-slate-800">
							<div class="flex flex-wrap items-center gap-3">
								<span class="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold tracking-wide text-sky-700 dark:border-sky-400/20 dark:bg-sky-400/10 dark:text-sky-200">
									<Lock class="h-3.5 w-3.5" />
									Restricted access
								</span>
								<span class="text-xs font-medium uppercase tracking-[0.26em] text-slate-500 dark:text-slate-400">
									Access denied
								</span>
							</div>
						</div>

						<div class="px-6 py-8 sm:px-8 sm:py-10 lg:px-10 lg:py-12">
							<div class="flex items-start gap-4">
								<div class="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 via-blue-500 to-cyan-500 shadow-lg shadow-sky-500/20">
									<ShieldAlert class="h-7 w-7 text-white" />
								</div>
								<div class="min-w-0">
									<p class="text-sm font-semibold uppercase tracking-[0.26em] text-sky-600 dark:text-sky-300">
										Access denied
									</p>
									<h1 class="mt-3 text-4xl font-black tracking-tight sm:text-5xl">Access denied</h1>
									<p class="mt-4 max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-300 sm:text-lg">
										You do not have permission to access{" "}
										<span class="font-semibold text-slate-900 dark:text-white">
											{attemptedRoute}
										</span>
										.
									</p>
								</div>
							</div>

							<div class="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
								<button
									type="button"
									onClick={handleBack}
									class="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/10 transition hover:-translate-y-0.5 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-400 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100"
								>
									<ArrowLeft class="h-4 w-4" />
									Back
								</button>

								{isLoggedIn ? (
									<Link
										to="/feed"
										class="inline-flex items-center justify-center gap-2 rounded-2xl border border-sky-200 bg-sky-50 px-5 py-3 text-sm font-semibold text-sky-700 transition hover:-translate-y-0.5 hover:bg-sky-100 focus:outline-none focus:ring-2 focus:ring-sky-400 dark:border-sky-400/20 dark:bg-sky-400/10 dark:text-sky-200 dark:hover:bg-sky-400/15"
									>
										Go to Feed
										<ChevronRight class="h-4 w-4" />
									</Link>
								) : (
									<Link
										to="/login"
										class="inline-flex items-center justify-center gap-2 rounded-2xl border border-sky-200 bg-sky-50 px-5 py-3 text-sm font-semibold text-sky-700 transition hover:-translate-y-0.5 hover:bg-sky-100 focus:outline-none focus:ring-2 focus:ring-sky-400 dark:border-sky-400/20 dark:bg-sky-400/10 dark:text-sky-200 dark:hover:bg-sky-400/15"
									>
										<LogIn class="h-4 w-4" />
										Login with another account
									</Link>
								)}

								<Link
									to="/feed"
									class="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:-translate-y-0.5 hover:border-sky-200 hover:text-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-400 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-200 dark:hover:border-sky-400/30 dark:hover:text-sky-200"
								>
									Go to Feed
								</Link>
							</div>

							<div class="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
								<InfoItem label="Account" value="Restricted" />
								<InfoItem label="Status" value="No access" />
								<InfoItem label="Action" value="Switch login" />
								<InfoItem label="Route" value={location.state?.from ? attemptedRoute : "Unknown"} />
							</div>
						</div>
					</section>

					<aside class="relative overflow-hidden rounded-[2rem] border border-white/60 bg-white/75 p-6 shadow-[0_24px_90px_rgba(2,8,23,0.10)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/60 dark:shadow-[0_24px_90px_rgba(0,0,0,0.35)] sm:p-8 lg:self-center">
						<div class="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold tracking-wide text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200">
							Secure area
						</div>

						<h2 class="mt-5 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
							Permission required
						</h2>
						<p class="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">
							This area is protected for authorized users only. Switch accounts or return to the
							feed to continue browsing.
						</p>

						<div class="mt-6 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/50">
							<p class="text-sm font-medium leading-7 text-slate-700 dark:text-slate-200">
								Try signing in with the correct organization account or return to the feed to
								explore public content.
							</p>
						</div>

						<div class="mt-6 space-y-3">
							<div class="flex items-center gap-3 rounded-2xl border border-slate-200/70 bg-white/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/50">
								<div class="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-300">
									<ShieldAlert class="h-5 w-5" />
								</div>
								<div>
									<p class="text-xs uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
										Session
									</p>
									<p class="text-sm font-semibold text-slate-900 dark:text-slate-100">
										{isLoggedIn ? "Logged in" : "Guest"}
									</p>
								</div>
							</div>

							<div class="flex items-center gap-3 rounded-2xl border border-slate-200/70 bg-white/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/50">
								<div class="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-300">
									<Home class="h-5 w-5" />
								</div>
								<div>
									<p class="text-xs uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
										Secondary route
									</p>
									<p class="text-sm font-semibold text-slate-900 dark:text-slate-100">/feed</p>
								</div>
							</div>
						</div>
					</aside>
				</div>
			</main>

			<button
				type="button"
				onClick={toggleTheme}
				class="fixed bottom-5 right-5 z-20 inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/90 px-4 py-3 text-sm font-semibold text-slate-800 shadow-[0_16px_40px_rgba(2,8,23,0.14)] backdrop-blur-xl transition hover:-translate-y-0.5 hover:shadow-[0_20px_50px_rgba(2,8,23,0.18)] focus:outline-none focus:ring-2 focus:ring-sky-400 dark:border-white/10 dark:bg-slate-950/80 dark:text-slate-100"
				aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
			>
				{isDark ? (
					<>
						<SunMedium class="h-4 w-4" />
						Light mode
					</>
				) : (
					<>
						<MoonStar class="h-4 w-4" />
						Dark mode
					</>
				)}
			</button>
		</div>
	);
}
