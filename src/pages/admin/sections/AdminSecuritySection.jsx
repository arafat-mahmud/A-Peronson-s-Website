import {
	Activity,
	AlertTriangle,
	ArrowUpRight,
	BadgeCheck,
	BookOpen,
	CheckCircle2,
	ChevronRight,
	Clock3,
	Database,
	Globe2,
	KeyRound,
	LockKeyhole,
	Moon,
	RefreshCw,
	Search,
	Shield,
	ShieldAlert,
	ShieldCheck,
	Sparkles,
	SunMedium,
} from "lucide-react";
import { useCallback } from "react";
import { cn } from "../../../lib/cn.js";

/* ── Helpers ── */

function ultraMetricShell(dark) {
	return dark
		? "bg-white/5 border-white/10 text-slate-100 shadow-[0_20px_60px_rgba(2,8,23,0.35)]"
		: "bg-white border-slate-200 text-slate-900 shadow-[0_20px_60px_rgba(15,23,42,0.08)]";
}

const DEFAULT_ULTRA_MINI_CHART_POINTS = [12, 19, 15, 22, 28, 18, 10, 14, 20, 25, 30, 22];

const DEFAULT_ULTRA_MINI_CHART_KPIS = [
	{ label: "Active Users", value: "2,847" },
	{ label: "Total Revenue", value: "$124.5K" },
	{ label: "Conversion Rate", value: "12.4%" },
	{ label: "Avg. Session", value: "8m 32s" },
];

const ULTRA_CAPABILITIES_DEFAULT = [
	"Advanced Search Filters",
	"Priority Buyer Request Placement",
	"Dedicated Support",
	"Contract History & Audit Trail",
	"Early Access to New Verified Factories",
	"Buying Pattern Analysis",
	"Order Completion Certification",
	"Verified Supplier Directory",
	"Real-time Messaging",
	"Video Call Capability",
	"Secure Document Sharing",
	"Escrow Payment Protection",
	"Quality Inspection Reports",
	"Logistics Tracking",
	"Custom RFQ Templates",
];

/* ── Sub‑components ── */

function UltraPill({ dark, active = false, children }) {
	return (
		<span
			className={cn(
				"inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium",
				active
					? dark
						? "border-cyan-400/30 bg-cyan-500/15 text-cyan-200"
						: "border-cyan-300 bg-cyan-50 text-cyan-700"
					: dark
						? "border-white/10 bg-white/5 text-slate-300"
						: "border-slate-200 bg-slate-100 text-slate-700",
			)}
		>
			{children}
		</span>
	);
}

function UltraStatCard({ dark, label, value, sub, icon: Icon, tone = "default" }) {
	const toneClass =
		tone === "good"
			? "from-cyan-500/20 to-sky-500/10 ring-cyan-400/30"
			: tone === "warn"
				? "from-amber-500/20 to-orange-500/10 ring-amber-400/30"
				: tone === "danger"
					? "from-rose-500/20 to-red-500/10 ring-rose-400/30"
					: "from-sky-500/20 to-blue-500/10 ring-sky-400/30";

	return (
		<div
			className={cn(
				ultraMetricShell(dark),
				"relative overflow-hidden rounded-3xl border p-5 backdrop-blur-xl",
			)}
		>
			<div className={cn("absolute inset-0 bg-gradient-to-br opacity-80", toneClass)} />
			<div className="relative flex items-start justify-between gap-4">
				<div>
					<p className={cn("text-sm font-medium", dark ? "text-slate-300" : "text-slate-600")}>
						{label}
					</p>
					<div className="mt-2 flex items-end gap-2">
						<h3 className="text-3xl font-semibold tracking-tight">{value}</h3>
						{sub ? (
							<span className={cn("pb-1 text-xs", dark ? "text-slate-400" : "text-slate-500")}>
								{sub}
							</span>
						) : null}
					</div>
				</div>
				<div className={cn("rounded-2xl p-3", dark ? "bg-slate-950/30" : "bg-slate-100")}>
					<Icon className="h-5 w-5 text-cyan-300" />
				</div>
			</div>
		</div>
	);
}

function UltraSectionCard({ dark, title, subtitle, children, right }) {
	return (
		<section
			className={cn(
				ultraMetricShell(dark),
				"relative overflow-hidden rounded-[28px] border p-6 backdrop-blur-xl",
			)}
		>
			<div className="mb-5 flex flex-wrap items-start justify-between gap-4">
				<div>
					<div className="flex items-center gap-2">
						<h2
							className={cn(
								"text-xl font-semibold tracking-tight",
								dark ? "text-white" : "text-slate-900",
							)}
						>
							{title}
						</h2>
						<span className="inline-flex items-center gap-1 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-300">
							live
						</span>
					</div>
					{subtitle ? (
						<p
							className={cn(
								"mt-2 max-w-2xl text-sm leading-6",
								dark ? "text-slate-400" : "text-slate-600",
							)}
						>
							{subtitle}
						</p>
					) : null}
				</div>
				{right}
			</div>
			{children}
		</section>
	);
}

function UltraToggle({ dark, on, label, hint, onToggle }) {
	return (
		<div
			className={cn(
				"flex items-center justify-between gap-4 rounded-2xl border p-4",
				dark ? "border-white/10 bg-white/5" : "border-slate-200 bg-slate-50",
			)}
		>
			<div>
				<p className={cn("font-medium", dark ? "text-white" : "text-slate-900")}>{label}</p>
				{hint ? (
					<p className={cn("mt-1 text-sm", dark ? "text-slate-400" : "text-slate-500")}>{hint}</p>
				) : null}
			</div>
			<div className="flex items-center gap-3">
				<span
					className={cn(
						"text-sm",
						on ? "text-cyan-300" : dark ? "text-slate-400" : "text-slate-500",
					)}
				>
					{on ? "On" : "Off"}
				</span>
				<button
					type="button"
					onClick={onToggle}
					className={cn(
						"flex h-10 w-20 items-center rounded-full border px-1 transition",
						on
							? "border-cyan-400/40 bg-cyan-500/20"
							: dark
								? "border-white/10 bg-white/5"
								: "border-slate-200 bg-white",
					)}
					aria-pressed={on}
				>
					<div
						className={cn(
							"h-8 w-8 rounded-full shadow-md transition-transform",
							on ? "translate-x-10 bg-cyan-400" : dark ? "bg-slate-400" : "bg-slate-500",
						)}
					/>
				</button>
			</div>
		</div>
	);
}

function UltraTinyChart({
	dark,
	points = DEFAULT_ULTRA_MINI_CHART_POINTS,
	kpis = DEFAULT_ULTRA_MINI_CHART_KPIS,
}) {
	const safePoints =
		Array.isArray(points) && points.length >= 3 ? points : DEFAULT_ULTRA_MINI_CHART_POINTS;
	const width = 640;
	const height = 180;
	const max = Math.max(...safePoints);
	const min = Math.min(...safePoints);
	const range = max - min || 1;
	const pad = 16;
	const step = (width - pad * 2) / (safePoints.length - 1);
	const y = (v) => height - pad - ((v - min) / range) * (height - pad * 2);
	const path = safePoints
		.map((p, i) => `${i === 0 ? "M" : "L"}${pad + i * step} ${y(p)}`)
		.join(" ");
	const area = `${path} L ${width - pad} ${height - pad} L ${pad} ${height - pad} Z`;
	const safeKpis =
		Array.isArray(kpis) && kpis.length > 0 ? kpis.slice(0, 6) : DEFAULT_ULTRA_MINI_CHART_KPIS;

	return (
		<div
			className={cn(
				"rounded-[24px] border p-4",
				dark ? "border-white/10 bg-slate-950/25" : "border-slate-200 bg-white",
			)}
		>
			<div className="mb-3 flex items-center justify-between">
				<div>
					<p className={cn("text-sm font-medium", dark ? "text-white" : "text-slate-900")}>
						Live Metrics
					</p>
					<p className={cn("text-xs", dark ? "text-slate-400" : "text-slate-500")}>
						Metrics coming from live feeds.
					</p>
				</div>
				<div className="flex items-center gap-2 text-xs text-cyan-300">
					<Activity className="h-4 w-4" />
					streaming
				</div>
			</div>
			<svg viewBox={`0 0 ${width} ${height}`} className="h-44 w-full">
				<defs>
					<linearGradient id="ultraSkyFill" x1="0" x2="0" y1="0" y2="1">
						<stop offset="0%" stopColor="rgba(109,171,223,0.38)" />
						<stop offset="100%" stopColor="rgba(109,171,223,0)" />
					</linearGradient>
				</defs>
				<path d={area} fill="url(#ultraSkyFill)" />
				<path
					d={path}
					fill="none"
					stroke="currentColor"
					strokeWidth="3"
					className="text-cyan-300"
				/>
				{safePoints.map((p, i) => (
					<circle
						key={i}
						cx={pad + i * step}
						cy={y(p)}
						r="4.2"
						className="fill-cyan-300 text-cyan-300"
					/>
				))}
			</svg>
			<div className="mt-2 grid grid-cols-3 gap-3 text-center text-xs">
				{safeKpis.slice(0, 3).map((row) => (
					<div
						key={row.label}
						className={cn(
							"rounded-2xl border p-3",
							dark ? "border-white/10 bg-white/5" : "border-slate-200 bg-slate-50",
						)}
					>
						<div className={cn("font-semibold", dark ? "text-white" : "text-slate-900")}>
							{row.value}
						</div>
						<div className={dark ? "text-slate-400" : "text-slate-500"}>{row.label}</div>
					</div>
				))}
			</div>
		</div>
	);
}

/* ── Main Section Component ── */

export function AdminSecuritySection({
	adminDark,
	catalog,
	securityState,
	setSecurityState,
	ultraAuditQuery,
	setUltraAuditQuery,
	buildAdminHeaders,
	apiRequest,
	getToken,
	formatNumber,
	error,
	setError,
	audit,
	filteredUltraAuditRows,
	toggleTheme,
	verificationQueue = [],
	disputes = [],
	ultraMiniChartPoints,
	ultraMiniChartKpis,
	ultraSecurityCapabilities = ULTRA_CAPABILITIES_DEFAULT,
	emptyCopy = (_key, fallback) => fallback,
}) {
	const refreshSecurityState = useCallback(async () => {
		const token = getToken();
		if (!token) {
			return;
		}
		const headers = buildAdminHeaders();
		const data = await apiRequest("/admin/security/state", { token, headers });
		setSecurityState(data || null);
	}, [getToken, buildAdminHeaders, apiRequest, setSecurityState]);

	const refreshAudit = useCallback(async () => {
		const token = getToken();
		if (!token) {
			return;
		}
		try {
			await apiRequest("/admin/audit?limit=40", {
				token,
				headers: buildAdminHeaders(),
			});
		} catch {
			if (import.meta.env.DEV) {
			}
		}
	}, [getToken, buildAdminHeaders, apiRequest]);

	const refreshVerificationQueue = useCallback(async () => {
		const token = getToken();
		if (!token) {
			return;
		}
		const headers = buildAdminHeaders();
		await apiRequest("/verification/admin/queue", { token, headers });
	}, [getToken, buildAdminHeaders, apiRequest]);

	const refreshDisputes = useCallback(async () => {
		const token = getToken();
		if (!token) {
			return;
		}
		const headers = buildAdminHeaders();
		await apiRequest("/admin/disputes", { token, headers });
	}, [getToken, buildAdminHeaders, apiRequest]);

	const runSecurityAction = useCallback(
		async (action, payload = {}) => {
			const token = getToken();
			if (!token) {
				return;
			}
			const headers = buildAdminHeaders({ stepUp: true });
			try {
				await apiRequest("/admin/security/actions", {
					method: "POST",
					token,
					headers,
					body: { action, payload },
				});
				await refreshSecurityState();
				await refreshAudit();
			} catch (err) {
				setError(err.message || "Failed to run security action");
			}
		},
		[getToken, buildAdminHeaders, apiRequest, refreshSecurityState, refreshAudit, setError],
	);

	return (
		<div
			className={cn(
				"rounded-[32px] border p-4 sm:p-5",
				adminDark ? "border-slate-800/70 bg-slate-950/50" : "border-slate-200 bg-white/75",
			)}
		>
			<div
				className={cn(
					"rounded-[32px] border p-5 backdrop-blur-xl",
					adminDark
						? "border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(51,122,176,0.24),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(55,115,168,0.18),_transparent_22%),linear-gradient(180deg,_#020617_0%,_#07111f_55%,_#050b16_100%)] text-slate-100"
						: "border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(109,171,223,0.18),_transparent_26%),radial-gradient(circle_at_top_right,_rgba(28,83,129,0.10),_transparent_22%),linear-gradient(180deg,_#eff8ff_0%,_#f8fbff_55%,_#eef6ff_100%)] text-slate-900",
				)}
			>
				<div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
					<div>
						<div className="flex flex-wrap items-center gap-2">
							<span className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
								<ShieldCheck className="h-4 w-4" /> ultra security layer
							</span>
							<UltraPill dark={adminDark} active={true}>
								Advanced
							</UltraPill>
							<UltraPill dark={adminDark}>Live</UltraPill>
						</div>
						<h1
							className={cn(
								"mt-4 text-3xl font-semibold tracking-tight sm:text-4xl",
								adminDark ? "text-white" : "text-slate-900",
							)}
						>
							Zero Trust, incident response, and immutable audit control in one command deck.
						</h1>
						<p
							className={cn(
								"mt-3 max-w-3xl text-sm leading-6 sm:text-base",
								adminDark ? "text-slate-300" : "text-slate-700",
							)}
						>
							A premium admin surface for secure operations, session governance, forensic logs, and
							tamper-evident oversight.
						</p>
					</div>

					<div className="flex flex-wrap items-center gap-3">
						<button
							type="button"
							onClick={toggleTheme}
							className={cn(
								"inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-medium transition hover:-translate-y-0.5",
								adminDark
									? "border-white/10 bg-white/10 text-white"
									: "border-slate-200 bg-white text-slate-900",
							)}
						>
							{adminDark ? <SunMedium className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
							{adminDark ? "Light mode" : "Dark mode"}
						</button>
						<button
							type="button"
							onClick={() => {
								refreshSecurityState();
								refreshAudit();
							}}
							className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-sky-500 to-cyan-400 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-500/25 transition hover:-translate-y-0.5"
						>
							<RefreshCw className="h-4 w-4" /> Refresh
						</button>
					</div>
				</div>

				<div className="mt-6 grid gap-5 xl:grid-cols-12">
					<div className="space-y-5 xl:col-span-8">
						<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
							<UltraStatCard
								dark={adminDark}
								label="Zero-trust"
								value={securityState?.zero_trust?.enabled ? "On" : "Off"}
								icon={Shield}
								tone={securityState?.zero_trust?.enabled ? "good" : "warn"}
							/>
							<UltraStatCard
								dark={adminDark}
								label="MFA required"
								value={securityState?.mfa?.required ? "Yes" : "No"}
								icon={BadgeCheck}
								tone={securityState?.mfa?.required ? "good" : "warn"}
							/>
							<UltraStatCard
								dark={adminDark}
								label="Session timeout"
								value={String(securityState?.session?.timeout_minutes ?? 30)}
								sub="min"
								icon={Clock3}
							/>
							<UltraStatCard
								dark={adminDark}
								label="IP allowlist"
								value={String((securityState?.ip_whitelist || []).length)}
								icon={Globe2}
								tone="good"
							/>
						</div>

						<UltraSectionCard
							dark={adminDark}
							title="Zero Trust + MFA"
							subtitle="Session control and device fingerprints."
							right={
								<div className="flex items-center gap-2 text-sm text-cyan-300">
									<LockKeyhole className="h-4 w-4" />
									hardened access
								</div>
							}
						>
							<div className="grid gap-4 lg:grid-cols-2">
								<div className="space-y-4">
									<UltraToggle
										dark={adminDark}
										on={Boolean(securityState?.zero_trust?.enabled)}
										label="Toggle zero-trust"
										hint="Strict session validation and conditional access."
										onToggle={() =>
											runSecurityAction("security.zero_trust.toggle", {
												enabled: !securityState?.zero_trust?.enabled,
											})
										}
									/>

									<div
										className={cn(
											"grid gap-4 rounded-2xl border p-4",
											adminDark ? "border-white/10 bg-white/5" : "border-slate-200 bg-slate-50",
										)}
									>
										<div className="flex items-center justify-between">
											<div>
												<p
													className={cn("font-medium", adminDark ? "text-white" : "text-slate-900")}
												>
													Rotate keys
												</p>
												<p
													className={cn("text-sm", adminDark ? "text-slate-400" : "text-slate-500")}
												>
													Encryption keys and session secrets.
												</p>
											</div>
											<button
												type="button"
												onClick={() => runSecurityAction("security.encryption.rotate")}
												className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-cyan-400 px-4 py-2 text-sm font-semibold text-white"
											>
												<KeyRound className="h-4 w-4" /> Rotate
											</button>
										</div>

										<div
											className={cn(
												"grid gap-3 sm:grid-cols-2",
												adminDark ? "text-slate-200" : "text-slate-800",
											)}
										>
											<div
												className={cn(
													"rounded-xl border p-3",
													adminDark ? "border-white/10 bg-black/10" : "border-slate-200 bg-white",
												)}
											>
												<p
													className={cn(
														"text-xs uppercase tracking-[0.18em]",
														adminDark ? "text-slate-400" : "text-slate-500",
													)}
												>
													Session fingerprint
												</p>
												<p className="mt-1 font-medium">
													{securityState?.device_fingerprinting?.enabled ? "Enabled" : "Off"}
												</p>
											</div>
											<div
												className={cn(
													"rounded-xl border p-3",
													adminDark ? "border-white/10 bg-black/10" : "border-slate-200 bg-white",
												)}
											>
												<p
													className={cn(
														"text-xs uppercase tracking-[0.18em]",
														adminDark ? "text-slate-400" : "text-slate-500",
													)}
												>
													Geo-fence
												</p>
												<p className="mt-1 font-medium">
													{securityState?.geo_fence?.enabled ? "On" : "Off"}
												</p>
											</div>
										</div>
									</div>
								</div>

								<div className="grid gap-4">
									<div
										className={cn(
											"rounded-2xl border p-4",
											adminDark ? "border-white/10 bg-white/5" : "border-slate-200 bg-slate-50",
										)}
									>
										<div className="mb-3 flex items-center justify-between">
											<p className={cn("font-medium", adminDark ? "text-white" : "text-slate-900")}>
												Current security state
											</p>
											<span className="inline-flex items-center gap-1 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-2.5 py-1 text-[11px] font-semibold text-cyan-300">
												<ShieldCheck className="h-3.5 w-3.5" /> active
											</span>
										</div>
										<div className="space-y-3 text-sm">
											{[
												["Zero-trust", securityState?.zero_trust?.enabled ? "On" : "Off"],
												["MFA required", securityState?.mfa?.required ? "Yes" : "No"],
												["Session timeout", `${securityState?.session?.timeout_minutes ?? 30} min`],
												["IP allowlist", String((securityState?.ip_whitelist || []).length)],
												["Geo-fence", securityState?.geo_fence?.enabled ? "On" : "Off"],
											].map(([key, value]) => (
												<div
													key={key}
													className={cn(
														"flex items-center justify-between border-b border-dashed pb-2 last:border-0 last:pb-0",
														adminDark ? "border-white/10" : "border-slate-200",
													)}
												>
													<span className={adminDark ? "text-slate-400" : "text-slate-600"}>
														{key}
													</span>
													<span
														className={cn(
															"font-medium",
															adminDark ? "text-white" : "text-slate-900",
														)}
													>
														{value}
													</span>
												</div>
											))}
										</div>
									</div>

									<div
										className={cn(
											"rounded-2xl border p-4",
											adminDark ? "border-white/10 bg-white/5" : "border-slate-200 bg-slate-50",
										)}
									>
										<div className="flex items-center justify-between">
											<div>
												<p
													className={cn("font-medium", adminDark ? "text-white" : "text-slate-900")}
												>
													Incident Response
												</p>
												<p
													className={cn("text-sm", adminDark ? "text-slate-400" : "text-slate-500")}
												>
													Incident dashboard and approvals.
												</p>
											</div>
											<AlertTriangle className="h-5 w-5 text-amber-400" />
										</div>
										<div className="mt-4 flex flex-wrap gap-2">
											<button
												type="button"
												onClick={() =>
													runSecurityAction("security.export.request", { dataset: "full" })
												}
												className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-200"
											>
												Approvals queue
											</button>
											<button
												type="button"
												onClick={() =>
													runSecurityAction("security.incident.create", {
														title: "Lockdown",
														severity: "high",
													})
												}
												className={cn(
													"rounded-xl border px-4 py-2 text-sm font-medium",
													adminDark
														? "border-white/10 text-slate-200"
														: "border-slate-200 text-slate-800",
												)}
											>
												Lockdown playbook
											</button>
										</div>
										<div
											className={cn(
												"mt-4 space-y-2 text-[11px]",
												adminDark ? "text-slate-300" : "text-slate-700",
											)}
										>
											{(securityState?.incidents || []).slice(0, 3).map((incident) => (
												<div
													key={incident.id}
													className={cn(
														"rounded-xl border px-3 py-2",
														adminDark
															? "border-white/10 bg-slate-950/25"
															: "border-slate-200 bg-white",
													)}
												>
													{incident.title} · {incident.status}
												</div>
											))}
											{(securityState?.data_exports?.pending || []).slice(0, 2).map((req) => (
												<div
													key={req.id}
													className={cn(
														"text-[11px]",
														adminDark ? "text-slate-400" : "text-slate-600",
													)}
												>
													Export {req.dataset} · {req.status}
												</div>
											))}
											{securityState?.incidents?.length > 0 ||
											(securityState?.data_exports?.pending || []).length > 0 ? null : (
												<div className={adminDark ? "text-slate-400" : "text-slate-600"}>
													No active incidents.
												</div>
											)}
										</div>
									</div>
								</div>
							</div>
						</UltraSectionCard>

						<UltraSectionCard
							dark={adminDark}
							title="Forensic + Immutable Backups"
							subtitle="Tamper-proof logs and snapshots."
							right={
								<UltraPill dark={adminDark} active={true}>
									Immutable
								</UltraPill>
							}
						>
							<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
								<UltraStatCard
									dark={adminDark}
									label="Forensic logs"
									value={String((securityState?.forensic_logs || []).length)}
									icon={BookOpen}
								/>
								<UltraStatCard
									dark={adminDark}
									label="Immutable snapshots"
									value={securityState?.immutable_backups?.last_snapshot_at || "none"}
									icon={Database}
									tone="warn"
								/>
								<UltraStatCard
									dark={adminDark}
									label="Last key rotation"
									value={securityState?.encryption?.last_rotated_at || "never"}
									icon={KeyRound}
									tone="warn"
								/>
								<UltraStatCard
									dark={adminDark}
									label="Tamper-proof logs"
									value={securityState?.tamper_proof_logs?.enabled ? "On" : "Off"}
									icon={ShieldAlert}
									tone={securityState?.tamper_proof_logs?.enabled ? "good" : "warn"}
								/>
							</div>

							<div className="mt-4 grid gap-4 lg:grid-cols-3">
								<div
									className={cn(
										"rounded-2xl border p-4 lg:col-span-2",
										adminDark ? "border-white/10 bg-slate-950/25" : "border-slate-200 bg-white",
									)}
								>
									<div className="mb-3 flex items-center justify-between">
										<div>
											<p className={cn("font-medium", adminDark ? "text-white" : "text-slate-900")}>
												Zero-Trust & Incident Response
											</p>
											<p className={cn("text-sm", adminDark ? "text-slate-400" : "text-slate-500")}>
												{ultraSecurityCapabilities.length} capabilities
											</p>
										</div>
										<Sparkles className="h-5 w-5 text-cyan-300" />
									</div>
									<div className="grid gap-2 sm:grid-cols-2">
										{ultraSecurityCapabilities.map((cap) => (
											<div
												key={cap}
												className={cn(
													"flex items-start gap-2 rounded-xl border p-3 text-sm",
													adminDark ? "border-white/10 bg-white/5" : "border-slate-200 bg-slate-50",
												)}
											>
												<CheckCircle2 className="mt-0.5 h-4 w-4 flex-none text-cyan-300" />
												<span className={cn(adminDark ? "text-slate-200" : "text-slate-800")}>
													{cap}
												</span>
											</div>
										))}
									</div>
								</div>

								<div
									className={cn(
										"rounded-2xl border p-4",
										adminDark ? "border-white/10 bg-white/5" : "border-slate-200 bg-slate-50",
									)}
								>
									<p className={cn("font-medium", adminDark ? "text-white" : "text-slate-900")}>
										Risk posture
									</p>
									<div className="mt-4 space-y-4">
										{[
											["Access risk", "Low", "w-2/5", "from-sky-500 to-cyan-400", "text-cyan-300"],
											[
												"Backup integrity",
												"High",
												"w-4/5",
												"from-cyan-400 to-sky-500",
												"text-cyan-300",
											],
											[
												"Response readiness",
												"Review",
												"w-3/5",
												"from-amber-400 to-orange-400",
												"text-amber-300",
											],
										].map(([label, value, widthClass, gradient, valueClass]) => (
											<div key={label}>
												<div className="mb-2 flex items-center justify-between text-sm">
													<span className={adminDark ? "text-slate-300" : "text-slate-700"}>
														{label}
													</span>
													<span className={valueClass}>{value}</span>
												</div>
												<div
													className={cn(
														"h-2 rounded-full",
														adminDark ? "bg-white/10" : "bg-slate-200",
													)}
												>
													<div
														className={cn(
															"h-2 rounded-full bg-gradient-to-r",
															widthClass,
															gradient,
														)}
													/>
												</div>
											</div>
										))}
									</div>
								</div>
							</div>
						</UltraSectionCard>
					</div>

					<div className="space-y-5 xl:col-span-4">
						<UltraTinyChart
							dark={adminDark}
							points={ultraMiniChartPoints}
							kpis={ultraMiniChartKpis}
						/>

						<UltraSectionCard
							dark={adminDark}
							title="Verification Queue"
							subtitle="EU/USA docs pending review."
							right={
								<button
									type="button"
									onClick={() => refreshVerificationQueue()}
									className={cn(
										"inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm",
										adminDark
											? "border-white/10 bg-white/5 text-slate-200"
											: "border-slate-200 bg-white text-slate-900",
									)}
								>
									<RefreshCw className="h-4 w-4" /> Refresh
								</button>
							}
						>
							<div
								className={cn(
									"rounded-2xl border p-4",
									adminDark ? "border-white/10 bg-white/5" : "border-slate-200 bg-slate-50",
								)}
							>
								<div className="space-y-2 text-xs">
									{verificationQueue.slice(0, 3).map((row) => (
										<div
											key={row.id || row.user_id}
											className={cn(
												"rounded-2xl border px-3 py-2",
												adminDark ? "border-white/10 bg-slate-950/25" : "border-slate-200 bg-white",
											)}
										>
											<p
												className={cn(
													"text-[11px] font-semibold",
													adminDark ? "text-white" : "text-slate-900",
												)}
											>
												{row.user_name || row.user_email || row.user_id}
											</p>
											<p
												className={cn(
													"text-[10px]",
													adminDark ? "text-slate-400" : "text-slate-600",
												)}
											>
												Doc: {row.doc_type || row.type || "business"} · Status:{" "}
												{row.status || "pending"}
											</p>
										</div>
									))}
									{verificationQueue.length > 0 ? null : (
										<p className={cn("text-sm", adminDark ? "text-slate-400" : "text-slate-600")}>
											{emptyCopy("verification.pending", "No pending verifications in queue.")}
										</p>
									)}
								</div>
							</div>
						</UltraSectionCard>

						<UltraSectionCard
							dark={adminDark}
							title="Dispute Radar"
							subtitle="Contracts with open issues."
							right={
								<button
									type="button"
									onClick={() => refreshDisputes()}
									className={cn(
										"inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm",
										adminDark
											? "border-white/10 bg-white/5 text-slate-200"
											: "border-slate-200 bg-white text-slate-900",
									)}
								>
									<RefreshCw className="h-4 w-4" /> Sync
								</button>
							}
						>
							<div
								className={cn(
									"rounded-2xl border p-4",
									adminDark ? "border-white/10 bg-white/5" : "border-slate-200 bg-slate-50",
								)}
							>
								<div className="space-y-2 text-xs">
									{disputes.slice(0, 3).map((dispute) => (
										<div
											key={dispute.id}
											className={cn(
												"rounded-2xl border px-3 py-2",
												adminDark ? "border-white/10 bg-slate-950/25" : "border-slate-200 bg-white",
											)}
										>
											<p
												className={cn(
													"text-[11px] font-semibold",
													adminDark ? "text-white" : "text-slate-900",
												)}
											>
												{dispute.title || dispute.contract_id || "Dispute"}
											</p>
											<p
												className={cn(
													"text-[10px]",
													adminDark ? "text-slate-400" : "text-slate-600",
												)}
											>
												Status: {dispute.status || "open"} · Priority:{" "}
												{dispute.priority || "normal"}
											</p>
										</div>
									))}
									{disputes.length > 0 ? null : (
										<p className={cn("text-sm", adminDark ? "text-slate-400" : "text-slate-600")}>
											{emptyCopy("disputes.none", "No active disputes.")}
										</p>
									)}
								</div>
							</div>
						</UltraSectionCard>

						<UltraSectionCard
							dark={adminDark}
							title="Audit Pulse"
							subtitle="Most recent admin actions."
							right={
								<button
									type="button"
									onClick={() => refreshAudit()}
									className={cn(
										"inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm",
										adminDark
											? "border-white/10 bg-white/5 text-slate-200"
											: "border-slate-200 bg-white text-slate-900",
									)}
								>
									<RefreshCw className="h-4 w-4" /> Refresh
								</button>
							}
						>
							<div className="space-y-3">
								{audit.slice(0, 5).map((entry) => (
									<div
										key={entry.id || entry.at}
										className={cn(
											"rounded-2xl border p-3",
											adminDark ? "border-white/10 bg-white/5" : "border-slate-200 bg-slate-50",
										)}
									>
										<div className="flex items-start justify-between gap-4">
											<div>
												<p
													className={cn("font-medium", adminDark ? "text-white" : "text-slate-900")}
												>
													{entry.path || entry.action || "Admin action"}
												</p>
												<p
													className={cn(
														"mt-1 text-xs",
														adminDark ? "text-slate-400" : "text-slate-600",
													)}
												>
													{entry.at ? new Date(entry.at).toLocaleString() : "--"} · system
												</p>
											</div>
											<ArrowUpRight className="h-4 w-4 text-cyan-300" />
										</div>
										<div
											className={cn(
												"mt-3 text-xs",
												adminDark ? "text-slate-400" : "text-slate-600",
											)}
										>
											Actor: {entry.actor_id || entry.actor || "system"} / Status:{" "}
											{entry.status ?? 200}
											<br />
											IP: {entry.ip || "--"} / Device: {entry.device_id || "--"}
										</div>
									</div>
								))}
								{audit.length > 0 ? null : (
									<p className={cn("text-sm", adminDark ? "text-slate-400" : "text-slate-600")}>
										No recent activity.
									</p>
								)}
							</div>
						</UltraSectionCard>
					</div>
				</div>

				<section
					className={cn(
						"mt-5 rounded-[32px] border p-6 backdrop-blur-xl",
						adminDark ? "border-white/10 bg-white/5" : "border-slate-200 bg-white/80",
					)}
				>
					<div className="mb-5 flex flex-wrap items-center justify-between gap-4">
						<div>
							<h2
								className={cn(
									"text-xl font-semibold tracking-tight",
									adminDark ? "text-white" : "text-slate-900",
								)}
							>
								Admin Audit Log
							</h2>
							<p className={cn("mt-2 text-sm", adminDark ? "text-slate-400" : "text-slate-600")}>
								Immutable, tamper-evident audit trail for every admin action.
							</p>
						</div>
						<div className="flex flex-wrap items-center gap-2">
							<div
								className={cn(
									"flex items-center gap-2 rounded-2xl border px-3 py-2",
									adminDark ? "border-white/10 bg-white/5" : "border-slate-200 bg-white",
								)}
							>
								<Search
									className={cn("h-4 w-4", adminDark ? "text-slate-400" : "text-slate-500")}
								/>
								<input
									value={ultraAuditQuery}
									onChange={(e) => setUltraAuditQuery(e.target.value)}
									placeholder="Search audit..."
									className={cn(
										"w-44 bg-transparent text-sm outline-none",
										adminDark
											? "text-slate-100 placeholder:text-slate-500"
											: "text-slate-900 placeholder:text-slate-400",
									)}
								/>
							</div>
							<button
								type="button"
								onClick={() => refreshAudit()}
								className={cn(
									"inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-medium",
									adminDark
										? "border-white/10 bg-white/10 text-white"
										: "border-slate-200 bg-white text-slate-900",
								)}
							>
								<RefreshCw className="h-4 w-4" /> Refresh log
							</button>
						</div>
					</div>

					<div className="grid gap-3">
						{filteredUltraAuditRows.slice(0, 10).map((entry) => (
							<div
								key={`${entry.id || entry.at}-${entry.path || entry.action}`}
								className={cn(
									"grid gap-2 rounded-2xl border p-4 md:grid-cols-[1.4fr_0.8fr_1fr] md:items-center",
									adminDark ? "border-white/10 bg-slate-950/25" : "border-slate-200 bg-slate-50",
								)}
							>
								<div className="flex items-center gap-3">
									<div className="rounded-2xl bg-cyan-500/10 p-2 text-cyan-300">
										<ShieldAlert className="h-4 w-4" />
									</div>
									<div>
										<p className={cn("font-medium", adminDark ? "text-white" : "text-slate-900")}>
											{entry.path || entry.action || "--"}
										</p>
										<p className={cn("text-xs", adminDark ? "text-slate-400" : "text-slate-600")}>
											Actor: {entry.actor_id || entry.actor || "system"} / Status:{" "}
											{entry.status ?? 200}
										</p>
									</div>
								</div>
								<div className={cn("text-sm", adminDark ? "text-slate-400" : "text-slate-600")}>
									{entry.at ? new Date(entry.at).toLocaleString() : "--"}
								</div>
								<div className="flex items-center justify-between gap-3">
									<div className={cn("text-sm", adminDark ? "text-slate-400" : "text-slate-600")}>
										IP: {entry.ip || "--"} / Device: {entry.device_id || "--"}
									</div>
									<ChevronRight
										className={cn("h-4 w-4", adminDark ? "text-slate-500" : "text-slate-400")}
									/>
								</div>
							</div>
						))}
						{filteredUltraAuditRows.length === 0 ? (
							<div
								className={cn(
									"rounded-2xl border border-dashed p-5 text-sm",
									adminDark
										? "border-white/10 bg-white/[0.03] text-slate-400"
										: "border-slate-200 bg-slate-50 text-slate-600",
								)}
							>
								No audit entries found.
							</div>
						) : null}
					</div>
				</section>
			</div>
		</div>
	);
}

export default AdminSecuritySection;
