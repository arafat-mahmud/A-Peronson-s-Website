/*
  Route: /login
  Access: Public

  Public Pages:
    /, /pricing, /about, /terms, /privacy, /help, /login, /signup, /access-denied
  Protected Pages (login required):
    /feed, /search, /buyer/:id, /factory/:id, /buying-house/:id, /contracts,
    /notifications, /chat, /call, /verification, /verification-center

  Purpose:
    - Authenticate the user and persist a session (token + user object).
    - Redirect the user back to the originally requested page (if present),
      otherwise redirect to the role home route.

  Key API:
    - POST /api/auth/login  (via `apiRequest('/auth/login')`)

  Notes:
    - Tailwind-only styling (no legacy App.css utilities).
*/

import { startAuthentication, startRegistration } from "@simplewebauthn/browser";
import { useEffect, useMemo, useState } from "react";
import { ThreeDot } from "react-loading-indicators";
import { Link, useLocation, useNavigate } from "react-router-dom";
import BrandMark from "../../components/ui/BrandMark.jsx";
import NeonAtom from "../../components/ui/NeonAtom.jsx";
import { apiRequest, getCurrentUser, getRoleHome, saveSession } from "../../lib/auth.js";
import { useTheme } from "../../lib/ThemeProvider.jsx";
import usePageMeta from "../../lib/usePageMeta.js";

const Icon = ({ d, className: cn, class: cls }) => (
	<svg
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth="2"
		strokeLinecap="round"
		strokeLinejoin="round"
		class={cn || cls}
	>
		<path d={d} />
	</svg>
);

const ArrowLeft = (p) => <Icon d="M19 12H5M12 19l-7-7 7-7" {...p} />;
const AtSign = (p) => <Icon d="M16 8a4 4 0 1 1-8 0 4 4 0 0 1 8 0zm2 0v6a2 2 0 1 1-4 0V8" {...p} />;
const BadgeCheck = (p) => <Icon d="M9 12l2 2 4-4M12 22l7-4V6l-7-4-7 4v12l7 4z" {...p} />;
const Eye = (p) => (
	<Icon
		d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"
		{...p}
	/>
);
const EyeOff = (p) => (
	<Icon
		d="M17.94 17.94A10.94 10.94 0 0 1 12 19C5 19 1 12 1 12a21.77 21.77 0 0 1 5.06-6.94M9.9 4.24A10.94 10.94 0 0 1 12 5c7 0 11 7 11 7a21.77 21.77 0 0 1-2.34 3.36M1 1l22 22"
		{...p}
	/>
);
const Fingerprint = (p) => (
	<Icon d="M12 12a4 4 0 0 0-4 4v2a4 4 0 0 0 8 0v-2a4 4 0 0 0-4-4zm0-8a8 8 0 0 0-8 8v3" {...p} />
);
const Lock = (p) => <Icon d="M6 10V7a6 6 0 1 1 12 0v3M5 10h14v10H5z" {...p} />;
const ShieldCheck = (p) => <Icon d="M12 22l7-4V6l-7-4-7 4v12l7 4zm-2-10l2 2 4-4" {...p} />;
const SunMedium = (p) => (
	<Icon
		d="M12 4V2m0 20v-2m8-8h2M2 12h2m13.66-5.66l1.41-1.41M4.93 19.07l1.41-1.41m0-11.32L4.93 4.93m14.14 14.14l-1.41-1.41M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8z"
		{...p}
	/>
);
const MoonStar = (p) => <Icon d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" {...p} />;
const UserRound = (p) => (
	<Icon d="M20 21a8 8 0 1 0-16 0m8-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" {...p} />
);
const ChevronRight = (p) => <Icon d="M9 18l6-6-6-6" {...p} />;

export default function Login() {
	usePageMeta({
		title: "Login — GarTexHub",
		type: "website",
		description: "Sign in to your GarTexHub account to manage sourcing, products, and connections.",
		canonical: "https://gartexhub.onrender.com/login",
		robots: "noindex,nofollow",
		siteName: "GarTexHub",
		locale: "en_US",
	});
	const navigate = useNavigate();
	const location = useLocation();
	const existingUser = getCurrentUser();

	const [identifier, setIdentifier] = useState("");
	const [password, setPassword] = useState("");
	const [rememberMe, setRememberMe] = useState(true);
	const [sessionDuration, setSessionDuration] = useState("12h");
	const [showSessionExpiry, setShowSessionExpiry] = useState(false);
	const [loading, setLoading] = useState(false);
	const [passkeyLoading, setPasskeyLoading] = useState(false);
	const [enrollLoading, setEnrollLoading] = useState(false);
	const [suppressRedirect, setSuppressRedirect] = useState(false);
	const [rememberPasskeyUser, setRememberPasskeyUser] = useState(() => {
		const raw = localStorage.getItem("remember_passkey_user");
		return raw ? raw === "true" : true;
	});
	const [passkeyHint, setPasskeyHint] = useState(() => {
		try {
			const raw = localStorage.getItem("passkey_user_hint");
			return raw ? JSON.parse(raw) : null;
		} catch {
			return null;
		}
	});
	const [error, setError] = useState("");
	const [showPassword, setShowPassword] = useState(false);
	const [passkeySupported, setPasskeySupported] = useState(() => {
		if (typeof window === "undefined") {
			return false;
		}
		return Boolean(window.PublicKeyCredential);
	});

	const { theme: currentTheme, toggleTheme } = useTheme();
	const [systemDark, setSystemDark] = useState(
		() =>
			typeof window !== "undefined" &&
			window.matchMedia?.("(prefers-color-scheme: dark)")?.matches === true,
	);

	useEffect(() => {
		if (currentTheme !== "system") {
			return;
		}
		const mq = window.matchMedia("(prefers-color-scheme: dark)");
		const handler = (e) => setSystemDark(e.matches);
		setSystemDark(mq.matches);
		mq.addEventListener("change", handler);
		return () => mq.removeEventListener("change", handler);
	}, [currentTheme]);

	const darkMode = currentTheme === "dark" || (currentTheme === "system" && systemDark);

	const redirectTo = location.state?.from || null;

	useEffect(() => {
		if (suppressRedirect) {
			return;
		}
		if (!existingUser?.role) {
			return;
		}
		navigate(getRoleHome(existingUser.role), { replace: true });
	}, [existingUser?.role, navigate, suppressRedirect]);

	useEffect(() => {
		// eslint-disable-next-line react-hooks/set-state-in-effect
		setPasskeySupported(typeof window !== "undefined" && Boolean(window.PublicKeyCredential));
	}, []);

	useEffect(() => {
		localStorage.setItem("remember_passkey_user", rememberPasskeyUser ? "true" : "false");
		if (!rememberPasskeyUser) {
			localStorage.removeItem("passkey_user_hint");
			// eslint-disable-next-line react-hooks/set-state-in-effect
			setPasskeyHint(null);
		}
	}, [rememberPasskeyUser]);

	const handleBack = () => {
		if (window.history.length > 1) {
			navigate(-1);
			return;
		}
		navigate("/", { replace: true });
	};

	const handleLogin = async (e) => {
		e.preventDefault();
		setError("");
		setLoading(true);
		try {
			const expiresIn = sessionDuration === "never" ? null : sessionDuration;
			const data = await apiRequest("/auth/login", {
				method: "POST",
				body: { identifier, password, expiresIn },
			});
			saveSession(data.user, data.token, { remember: rememberMe });
			const onboardingCompleted =
				data?.user?.profile?.onboarding_completed === true ||
				String(data?.user?.profile?.onboarding_completed || "").toLowerCase() === "true";
			navigate(onboardingCompleted ? redirectTo || getRoleHome(data.user.role) : "/onboarding", {
				replace: true,
			});
		} catch (err) {
			setError(err.message);
		} finally {
			setLoading(false);
		}
	};

	const handlePasskeyLogin = async () => {
		if (typeof window === "undefined" || !window.PublicKeyCredential) {
			setError("Passkeys are not supported on this device/browser.");
			return;
		}
		setError("");
		setPasskeyLoading(true);
		try {
			const optionsRes = await apiRequest("/auth/passkey/login/options", {
				method: "POST",
				body: {
					identifier: identifier.trim() || undefined,
					expiresIn: sessionDuration === "never" ? null : sessionDuration,
				},
			});
			const assertion = await startAuthentication(optionsRes.options);
			const data = await apiRequest("/auth/passkey/login/verify", {
				method: "POST",
				body: {
					identifier: identifier.trim() || undefined,
					credential: assertion,
				},
			});
			if (rememberPasskeyUser) {
				const hint = {
					user_name: data?.user?.name || "",
					user_email: data?.user?.email || "",
					passkey_name: data?.passkey?.name || "",
				};
				localStorage.setItem("passkey_user_hint", JSON.stringify(hint));
				localStorage.setItem("remember_passkey_user", "true");
				setPasskeyHint(hint);
			} else {
				localStorage.removeItem("passkey_user_hint");
				localStorage.setItem("remember_passkey_user", "false");
				setPasskeyHint(null);
			}
			saveSession(data.user, data.token, { remember: rememberMe });
			const onboardingCompleted =
				data?.user?.profile?.onboarding_completed === true ||
				String(data?.user?.profile?.onboarding_completed || "").toLowerCase() === "true";
			navigate(onboardingCompleted ? redirectTo || getRoleHome(data.user.role) : "/onboarding", {
				replace: true,
			});
		} catch (err) {
			setError(err.message || "Passkey login failed");
		} finally {
			setPasskeyLoading(false);
		}
	};

	const handlePasskeyEnroll = async () => {
		if (!(identifier.trim() && password)) {
			setError("Enter your email/Agent ID and password to set up a passkey.");
			return;
		}
		if (typeof window === "undefined" || !window.PublicKeyCredential) {
			setError("Passkeys are not supported on this device/browser.");
			return;
		}
		setError("");
		setEnrollLoading(true);
		setSuppressRedirect(true);
		try {
			const loginRes = await apiRequest("/auth/login", {
				method: "POST",
				body: { identifier, password },
			});
			const optionsRes = await apiRequest("/auth/passkey/registration/options", {
				method: "POST",
				token: loginRes.token,
			});
			if (!optionsRes?.options?.challenge) {
				throw new Error("Passkey setup failed. Please refresh and try again.");
			}
			const credential = await startRegistration(optionsRes.options);
			await apiRequest("/auth/passkey/registration/verify", {
				method: "POST",
				token: loginRes.token,
				body: { credential },
			});
			saveSession(loginRes.user, loginRes.token, { remember: rememberMe });
			const onboardingCompleted =
				loginRes?.user?.profile?.onboarding_completed === true ||
				String(loginRes?.user?.profile?.onboarding_completed || "").toLowerCase() === "true";
			navigate(
				onboardingCompleted ? redirectTo || getRoleHome(loginRes.user.role) : "/onboarding",
				{ replace: true },
			);
		} catch (err) {
			setError(err.message || "Passkey setup failed");
		} finally {
			setEnrollLoading(false);
			setSuppressRedirect(false);
		}
	};

	const theme = useMemo(
		() =>
			darkMode
				? {
						page: "bg-[var(--theme-custom-06131f)] text-slate-100",
						panel: "bg-white/5 border-white/10 shadow-black/20",
						card: "bg-[var(--theme-custom-081826-85)] border-white/10 shadow-[0_30px_80px_rgba(2,8,23,0.55)] backdrop-blur-xl",
						muted: "text-slate-300",
						soft: "text-slate-400",
						field:
							"bg-white/5 border-white/10 text-slate-100 placeholder:text-slate-500 focus:border-sky-400/70 focus:ring-sky-400/20",
						chip: "bg-white/5 border-white/10 text-slate-200",
						gradient: "from-sky-500 via-cyan-400 to-blue-500",
						glow: "bg-sky-500/30",
						button: "bg-white text-slate-950 hover:bg-slate-200",
						buttonAlt: "bg-sky-500/15 text-sky-100 border-sky-400/20 hover:bg-sky-500/25",
						outline: "border-white/10 hover:bg-white/5",
					}
				: {
						page: "bg-[var(--theme-custom-edf6ff)] text-slate-900",
						panel: "bg-white/70 border-sky-200/70 shadow-sky-200/50",
						card: "bg-white/85 border-sky-100 shadow-[0_30px_80px_rgba(109,171,223,0.18)] backdrop-blur-xl",
						muted: "text-slate-600",
						soft: "text-slate-500",
						field:
							"bg-white border-sky-200 text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:ring-sky-500/20",
						chip: "bg-sky-50 border-sky-200 text-sky-700",
						gradient: "from-sky-500 via-cyan-400 to-blue-500",
						glow: "bg-sky-400/30",
						button: "bg-slate-900 text-white hover:bg-slate-800",
						buttonAlt: "bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-100",
						outline: "border-sky-200 hover:bg-sky-50",
					},
		[darkMode],
	);

	const roles = ["Buyer", "Factory", "Buying House"];

	if (loading || passkeyLoading || enrollLoading) {
		return <NeonAtom fill={true} timeout={10_000} />;
	}

	return (
		<div class={`min-h-screen overflow-hidden ${theme.page}`}>
			<div class="pointer-events-none absolute inset-0 overflow-hidden">
				<div
					class={`absolute -top-24 left-[-8rem] h-72 w-72 rounded-full ${theme.glow} blur-3xl`}
				/>
				<div class="absolute right-[-6rem] top-20 h-80 w-80 rounded-full bg-cyan-400/20 blur-3xl" />
				<div class="absolute bottom-[-7rem] left-1/3 h-96 w-96 rounded-full bg-blue-500/10 blur-3xl" />
			</div>

			<div class="relative mx-auto grid min-h-screen max-w-7xl grid-cols-1 lg:grid-cols-[1.1fr_0.9fr]">
				<section class="flex items-center justify-center px-5 py-8 sm:px-8 lg:px-10">
					<div class={`relative w-full max-w-xl rounded-[2rem] border p-6 sm:p-8 ${theme.panel}`}>
						<div class="absolute right-5 top-5 flex items-center gap-2">
							<button
								type="button"
								onClick={toggleTheme}
								class={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition ${theme.outline}`}
								aria-label="Toggle theme"
							>
								{darkMode ? <SunMedium class="h-4 w-4" /> : <MoonStar class="h-4 w-4" />}
								<span>{darkMode ? "Light" : "Dark"}</span>
							</button>
						</div>

						<div class="mb-5 flex items-center gap-2.5">
							<BrandMark size={32} alt="" />
							<div>
								<p class="text-xs font-bold tracking-tight">GarTexHub</p>
								<p class={`text-[9px] font-semibold uppercase tracking-[0.15em] ${theme.soft}`}>
									Vault Access
								</p>
							</div>
						</div>

						<div class="space-y-6">
							<div class="max-w-lg">
								<p class={`text-sm leading-6 ${theme.muted}`}>
									Access pages based on your role{" "}
									<span class="font-semibold text-sky-400">(Buyer, Factory, Buying House)</span>.
								</p>
							</div>

							<div class="grid gap-3 sm:grid-cols-2">
								{roles.map((role) => (
									<div key={role} class={`rounded-2xl border px-4 py-3 ${theme.chip}`}>
										<div class="flex items-center gap-2 text-sm font-medium">
											<BadgeCheck class="h-4 w-4 text-sky-400" />
											{role}
										</div>
										<p class={`mt-1 text-xs ${theme.soft}`}>Role-based dashboard access</p>
									</div>
								))}
							</div>

							<div class={`rounded-[1.75rem] border p-5 sm:p-6 ${theme.card}`}>
								<div class="flex items-start gap-4">
									<div class="rounded-2xl border border-sky-400/20 bg-sky-500/10 p-3 text-sky-400">
										<ShieldCheck class="h-5 w-5" />
									</div>
									<div>
										<h2 class="text-lg font-semibold">Secure access, built for speed</h2>
										<p class={`mt-1 text-sm leading-6 ${theme.soft}`}>
											Fast sign-in, passkey support, and a clean interface designed for premium
											workflows.
										</p>
									</div>
								</div>

								<div class="mt-6 grid gap-3 sm:grid-cols-3">
									{[
										["Encrypted", "Credentials protected"],
										["Passkeys", "One-tap authentication"],
										["Verified", "Trusted team access"],
									].map(([title, desc]) => (
										<div key={title} class={`rounded-2xl border px-4 py-3 ${theme.panel}`}>
											<p class="text-sm font-semibold">{title}</p>
											<p class={`mt-1 text-xs ${theme.soft}`}>{desc}</p>
										</div>
									))}
								</div>
							</div>
						</div>
					</div>
				</section>

				<section class="flex items-center justify-center px-5 py-8 sm:px-8 lg:px-10">
					<div class={`w-full max-w-xl rounded-[2rem] border p-6 sm:p-8 ${theme.card}`}>
						<div class="mb-8 flex items-center justify-between gap-4">
							<button
								type="button"
								onClick={handleBack}
								class={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition ${theme.outline}`}
							>
								<ArrowLeft class="h-4 w-4" />
								Back
							</button>
							<div
								class={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium ${theme.chip}`}
							>
								<Fingerprint class="h-4 w-4 text-sky-400" />
								{passkeyHint
									? "Passkey enrolled"
									: passkeySupported
										? "Passkey ready"
										: "Passkey unavailable"}
							</div>
						</div>

						<div class="mb-8">
							<p class={`text-sm font-semibold uppercase tracking-[0.3em] ${theme.soft}`}>
								Welcome back
							</p>
							<h2 class="mt-2 text-2xl font-semibold sm:text-3xl">Sign in to continue</h2>
							<p class={`mt-3 max-w-lg text-sm leading-6 ${theme.muted}`}>
								Use your email or assigned Agent ID to access your account.
							</p>
						</div>

						{error && (
							<div class="mb-5 rounded-xl bg-rose-500/15 border border-rose-500/30 px-4 py-3 text-sm text-rose-300">
								{error}
							</div>
						)}

						<form onSubmit={handleLogin} class="space-y-5">
							<div>
								<label class={`mb-2 block text-sm font-medium ${theme.muted}`}>
									Email or Agent ID
								</label>
								<div class="relative">
									<AtSign
										class={`pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 ${theme.soft}`}
									/>
									<input
										value={identifier}
										onChange={(e) => setIdentifier(e.target.value)}
										class={`w-full rounded-2xl border px-10 py-2.5 text-sm outline-none transition focus:ring-4 ${theme.field}`}
										placeholder="Enter your email or Agent ID"
									/>
								</div>
								<p class={`mt-2 text-xs ${theme.soft}`}>
									Agents: Use your assigned Agent ID to login
								</p>
							</div>

							<div>
								<label class={`mb-2 block text-sm font-medium ${theme.muted}`}>Password</label>
								<div class="relative">
									<Lock
										class={`pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 ${theme.soft}`}
									/>
									<input
										type={showPassword ? "text" : "password"}
										value={password}
										onChange={(e) => setPassword(e.target.value)}
										class={`w-full rounded-2xl border px-10 py-2.5 pr-24 text-sm outline-none transition focus:ring-4 ${theme.field}`}
										placeholder="•••••••••••"
									/>
									<button
										type="button"
										onClick={() => setShowPassword((v) => !v)}
										class={`absolute right-3 top-1/2 -translate-y-1/2 rounded-full border px-3 py-2 text-xs font-semibold transition ${theme.outline}`}
									>
										{showPassword ? (
											<span class="inline-flex items-center gap-1">
												<EyeOff class="h-3.5 w-3.5" /> Hide
											</span>
										) : (
											<span class="inline-flex items-center gap-1">
												<Eye class="h-3.5 w-3.5" /> Show
											</span>
										)}
									</button>
								</div>
							</div>

							<div class="flex flex-wrap items-center justify-between gap-3">
								<label class="inline-flex items-center gap-3 text-sm">
									<input
										type="checkbox"
										checked={rememberMe}
										onChange={(e) => setRememberMe(e.target.checked)}
										class="h-4 w-4 rounded border-sky-400/40 text-sky-500 focus:ring-sky-400/30"
									/>
									<span class={theme.muted}>Remember me</span>
								</label>

								<button
									type="button"
									onClick={() => setShowSessionExpiry(!showSessionExpiry)}
									class="text-xs text-sky-500 hover:text-sky-600"
								>
									{showSessionExpiry ? "Hide session options" : "Session options"}
								</button>
							</div>

							{showSessionExpiry && (
								<div class="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-3">
									<p class="text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">
										Session duration
									</p>
									<div class="flex flex-wrap gap-2">
										{[
											{ value: "12h", label: "12 hours" },
											{ value: "24h", label: "24 hours" },
											{ value: "7d", label: "7 days" },
											{ value: "30d", label: "30 days" },
											{ value: "never", label: "Never expire" },
										].map((opt) => (
											<button
												key={opt.value}
												type="button"
												onClick={() => setSessionDuration(opt.value)}
												class={`rounded-lg px-3 py-1 text-xs font-medium transition ${
													sessionDuration === opt.value
														? "bg-sky-500 text-white"
														: "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600"
												}`}
											>
												{opt.label}
											</button>
										))}
									</div>
								</div>
							)}

							<label class="inline-flex items-center gap-3 text-sm">
								<input
									type="checkbox"
									checked={rememberPasskeyUser}
									onChange={(e) => setRememberPasskeyUser(e.target.checked)}
									class="h-4 w-4 rounded border-sky-400/40 text-sky-500 focus:ring-sky-400/30"
								/>
								<span class={theme.muted}>Remember passkey user</span>
							</label>

							{passkeyHint && (
								<p class={`text-xs ${theme.soft}`}>
									Passkey:{" "}
									<span class="font-semibold">{passkeyHint.passkey_name || "Passkey"}</span>
									{passkeyHint.user_name ? ` · ${passkeyHint.user_name}` : ""}
									{passkeyHint.user_email ? ` (${passkeyHint.user_email})` : ""}
								</p>
							)}

							<div class="space-y-3 pt-2">
								<button
									type="submit"
									disabled={loading}
									class={`group inline-flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold shadow-lg shadow-sky-500/20 transition ${theme.button}`}
								>
									{loading ? (
										<ThreeDot variant="bounce" color="#337ab0" size="small" text="" textColor="" />
									) : (
										"Sign in"
									)}
									{!loading && (
										<ChevronRight class="h-4 w-4 transition group-hover:translate-x-0.5" />
									)}
								</button>

								<div class="grid gap-3 sm:grid-cols-2">
									<button
										type="button"
										onClick={handlePasskeyLogin}
										disabled={passkeyLoading}
										class={`inline-flex items-center justify-center gap-2 rounded-2xl border px-5 py-3 text-sm font-semibold transition ${theme.buttonAlt} disabled:opacity-60`}
									>
										<Fingerprint class="h-4 w-4" />
										{passkeyLoading ? (
											<ThreeDot
												variant="bounce"
												color="#337ab0"
												size="small"
												text=""
												textColor=""
											/>
										) : (
											"Passkey"
										)}
									</button>
									<button
										type="button"
										onClick={handlePasskeyEnroll}
										disabled={enrollLoading}
										class={`inline-flex items-center justify-center gap-2 rounded-2xl border px-5 py-3 text-sm font-semibold transition ${theme.buttonAlt} disabled:opacity-60`}
									>
										<BadgeCheck class="h-4 w-4" />
										{enrollLoading ? (
											<ThreeDot
												variant="bounce"
												color="#337ab0"
												size="small"
												text=""
												textColor=""
											/>
										) : (
											"Set up passkey"
										)}
									</button>
								</div>
							</div>
						</form>

						<div class={`mt-8 rounded-[1.5rem] border p-5 ${theme.panel}`}>
							<div class="flex items-start gap-4">
								<div class="rounded-2xl bg-sky-500/10 p-3 text-sky-400">
									<UserRound class="h-4 w-4" />
								</div>
								<div class="flex-1">
									<p class="text-sm font-semibold">New here?</p>
									<p class={`mt-1 text-sm ${theme.soft}`}>Create an account to get started.</p>
								</div>
								<Link
									to="/signup"
									state={redirectTo ? { from: redirectTo } : undefined}
									class={`rounded-full border px-4 py-2 text-sm font-semibold transition ${theme.outline}`}
								>
									Create account
								</Link>
							</div>
						</div>
					</div>
				</section>
			</div>
		</div>
	);
}
