import {
	Activity,
	ArrowRight,
	BarChart3,
	Bell,
	CheckCircle2,
	Cloud,
	Download,
	FileText,
	Gauge,
	Globe2,
	Inbox,
	LayoutDashboard,
	Lock,
	Mail,
	MoonStar,
	RefreshCw,
	Search,
	Server,
	ServerCog,
	Shield,
	ShieldAlert,
	ShieldCheck,
	Sparkles,
	SunMedium,
	TerminalSquare,
	Users,
	Workflow,
} from "lucide-react";
import { ThreeDot } from "react-loading-indicators";
import { cn } from "../../../lib/cn.js";

function MetricCard({ label, value, hint, icon: CardIcon, loading = false }) {
	if (loading) {
		return (
			<div className="rounded-3xl border border-slate-200/80 bg-white/80 p-5 shadow-[0_20px_60px_-30px_rgba(51,122,176,0.35)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/70">
				<div className="flex items-center justify-center">
					<ThreeDot variant="bounce" color="#337ab0" size="small" text="" textColor="" />
				</div>
			</div>
		);
	}
	return (
		<div className="group rounded-3xl border border-slate-200/80 bg-white/80 p-5 shadow-[0_20px_60px_-30px_rgba(51,122,176,0.35)] backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-sky-300/70 hover:shadow-[0_24px_80px_-28px_rgba(51,122,176,0.45)] dark:border-white/10 dark:bg-slate-950/70">
			<div className="flex items-start justify-between gap-4">
				<div>
					<p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
					<div className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">
						{value}
					</div>
					<p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{hint}</p>
				</div>
				<div className="rounded-2xl border border-sky-400/15 bg-gradient-to-br from-sky-400/20 to-blue-500/10 p-3 text-sky-500 shadow-lg shadow-sky-500/10 dark:text-sky-300">
					<CardIcon className="h-5 w-5" />
				</div>
			</div>
		</div>
	);
}

function Pill({ children }) {
	return (
		<span className="inline-flex items-center gap-2 rounded-full border border-sky-500/15 bg-sky-500/8 px-3 py-1 text-xs font-medium text-sky-700 shadow-sm shadow-sky-500/5 dark:text-sky-300">
			{children}
		</span>
	);
}
export function AdminServerSection({
	adminDark,
	catalog,
	serverAdminState,
	setServerAdminState,
	serverAdminAuditQuery,
	setServerAdminAuditQuery,
	packageForm,
	setPackageForm,
	cronForm,
	setCronForm,
	osUserForm,
	setOsUserForm,
	sshKeyForm,
	setSshKeyForm,
	sslForm,
	setSslForm,
	timeForm,
	setTimeForm,
	buildAdminHeaders,
	apiRequest,
	getToken,
	formatNumber,
	error,
	setError,
	toggleTheme,
	loading,
	users,
	verificationQueue,
	infraState,
	supportTickets,
	refreshServerAdminState,
	integrationStatus,
	refreshIntegrationStatus,
	securityContext,
	openSearchConfig,
	setOpenSearchConfig,
	openSearchStatus,
	refreshOpenSearchStatus,
	openSearchNotice,
	openSearchError,
	openSearchConfigBusy,
	openSearchActionBusy,
	openSearchReset,
	setOpenSearchReset,
	openSearchOrgId,
	setOpenSearchOrgId,
	saveOpenSearchConfig,
	runOpenSearchAction,
	emailConfig,
	setEmailConfig,
	emailConfigNotice,
	emailConfigError,
	emailConfigBusy,
	saveEmailConfig,
	sendEmailTest,
	adminUiSettingsForm,
	setAdminUiSettingsForm,
	adminUiSettingsDirty,
	setAdminUiSettingsDirty,
	adminUiSettingsNotice,
	adminUiSettingsError,
	adminUiSettingsBusy,
	saveAdminUiSettings,
	audit,
	filteredServerAdminAuditRows,
	filteredNetworkAuditRows,
	refreshAudit,
	downloadJson,
}) {
	return (
		<div
			className={cn(
				"relative overflow-hidden rounded-[32px] border p-4 sm:p-6",
				adminDark ? "border-white/10 bg-white/5" : "border-slate-200 bg-white/75",
			)}
		>
			<div className="absolute inset-0 -z-10 overflow-hidden">
				<div
					className={cn(
						"absolute -top-40 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full blur-3xl",
						adminDark ? "bg-sky-500/20" : "bg-sky-400/20",
					)}
				/>
				<div
					className={cn(
						"absolute top-40 -left-20 h-72 w-72 rounded-full blur-3xl",
						adminDark ? "bg-blue-500/15" : "bg-blue-300/25",
					)}
				/>
				<div
					className={cn(
						"absolute bottom-0 right-0 h-96 w-96 rounded-full blur-3xl",
						adminDark ? "bg-cyan-500/10" : "bg-cyan-300/20",
					)}
				/>
			</div>

			<div className="mx-auto max-w-7xl space-y-6">
				<header
					className={cn(
						"flex flex-col gap-4 rounded-[2rem] border p-5 shadow-2xl shadow-sky-900/10 backdrop-blur-xl lg:flex-row lg:items-center lg:justify-between",
						adminDark ? "border-white/10 bg-white/5" : "border-slate-200 bg-white/70",
					)}
				>
					<div className="flex items-start gap-4">
						<div
							className={cn(
								"rounded-3xl border bg-gradient-to-br p-4 shadow-lg",
								adminDark
									? "border-sky-400/20 from-sky-400/20 to-blue-500/10 text-sky-200 shadow-sky-500/10"
									: "border-sky-200 from-sky-100 to-blue-50 text-sky-700 shadow-sky-200/40",
							)}
						>
							<Sparkles className="h-7 w-7" />
						</div>
						<div>
							<div className="flex flex-wrap items-center gap-2">
								<h1
									className={cn(
										"text-2xl font-semibold tracking-tight sm:text-3xl",
										adminDark ? "text-white" : "text-slate-900",
									)}
								>
									Server Admin + App Management
								</h1>
								<Pill>Full Stack</Pill>
								<Pill>
									<span
										className={cn(
											"h-2 w-2 rounded-full",
											adminDark
												? "bg-emerald-400 shadow-[0_0_0_4px_rgba(52,211,153,0.15)]"
												: "bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.12)]",
										)}
									/>
									live
								</Pill>
							</div>
							<p
								className={cn(
									"mt-2 max-w-3xl text-sm leading-6",
									adminDark ? "text-slate-300" : "text-slate-600",
								)}
							>
								Premium control plane for servers, apps, security, backups, search, and audit
								operations with a blue-sky themed surface.
							</p>
						</div>
					</div>

					<div className="flex flex-wrap items-center gap-3">
						<button
							type="button"
							onClick={toggleTheme}
							className={cn(
								"inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-medium shadow-lg transition hover:-translate-y-0.5",
								adminDark
									? "border-white/10 bg-white/10 text-white shadow-sky-950/20 hover:bg-white/15"
									: "border-slate-200 bg-white text-slate-700 shadow-slate-200/40 hover:bg-slate-50",
							)}
						>
							{adminDark ? <SunMedium className="h-4 w-4" /> : <MoonStar className="h-4 w-4" />}
							{adminDark ? "Light mode" : "Dark mode"}
						</button>
						<button
							type="button"
							onClick={() => {
								refreshServerAdminState();
								refreshIntegrationStatus();
								refreshOpenSearchStatus();
								refreshAudit();
							}}
							className={cn(
								"inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-medium transition",
								adminDark
									? "border-sky-400/20 bg-sky-500/10 text-sky-200 hover:bg-sky-500/15"
									: "border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100",
							)}
						>
							<RefreshCw className="h-4 w-4" /> Refresh
						</button>
						<button
							type="button"
							onClick={() =>
								downloadJson(
									`server_admin_snapshot_${new Date().toISOString().slice(0, 10)}.json`,
									{
										generated_at: new Date().toISOString(),
										summary: {
											total_accounts: users?.length || 0,
											pending_verifications: verificationQueue?.length || 0,
											infra_alerts: (infraState?.zombie_processes || []).length,
											open_tickets: supportTickets?.length || 0,
										},
										server_admin: serverAdminState
											? {
													uptime: serverAdminState.uptime,
													node_version: serverAdminState.node_version,
													os_info: serverAdminState.os_info,
													cpu_usage: serverAdminState.cpu_usage,
													memory_usage: serverAdminState.memory_usage,
													disk_usage: serverAdminState.disk_usage,
													service_health: serverAdminState.service_health,
													database_status: serverAdminState.database_status,
													cache_status: serverAdminState.cache_status,
													queue_status: serverAdminState.queue_status,
													version: serverAdminState.version,
													active_processes: serverAdminState.active_processes,
													scheduled_tasks: serverAdminState.scheduled_tasks,
													cron_jobs: serverAdminState.cron_jobs,
													ssl_expiry: serverAdminState.ssl_expiry,
													last_deploy: serverAdminState.last_deploy,
													package_versions: serverAdminState.package_versions,
												}
											: null,
										integrations: integrationStatus
											? {
													email: {
														status: integrationStatus?.email?.status,
														provider: integrationStatus?.email?.provider,
														last_sync: integrationStatus?.email?.last_sync,
													},
													crm: {
														status: integrationStatus?.crm?.status,
														last_sync: integrationStatus?.crm?.last_sync,
													},
													storage: {
														status: integrationStatus?.storage?.status,
														used_mb: integrationStatus?.storage?.used_mb,
														limit_mb: integrationStatus?.storage?.limit_mb,
													},
												}
											: null,
										opensearch: {
											config: openSearchConfig
												? {
														index_prefix: openSearchConfig.index_prefix,
														shard_count: openSearchConfig.shard_count,
														replica_count: openSearchConfig.replica_count,
														version: openSearchConfig.version,
													}
												: null,
											status: openSearchStatus
												? {
														connected: openSearchStatus.connected,
														index_count: openSearchStatus.index_count,
														document_count: openSearchStatus.document_count,
														node_count: openSearchStatus.node_count,
														cluster_health: openSearchStatus.cluster_health,
													}
												: null,
										},
										email: emailConfig
											? {
													provider: emailConfig.provider,
													from_address: emailConfig.from_address,
													verified: emailConfig.verified,
												}
											: null,
										audit: Array.isArray(audit)
											? audit.slice(0, 40).map((e) => ({
													action: e.action,
													timestamp: e.created_at || e.timestamp,
													actor: e.actor,
													path: e.path,
													status: e.status,
												}))
											: [],
									},
								)
							}
							className={cn(
								"inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-medium transition",
								adminDark
									? "border-white/10 bg-white/10 text-white hover:bg-white/15"
									: "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
							)}
						>
							<Download className="h-4 w-4" /> Export
						</button>
					</div>
				</header>

				<section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
					<MetricCard
						loading={loading}
						label="Total accounts"
						value={formatNumber(users.length)}
						hint="Owner access enabled"
						icon={Users}
					/>
					<MetricCard
						loading={loading}
						label="Pending verifications"
						value={formatNumber(verificationQueue.length)}
						hint="Audit gate clear"
						icon={ShieldCheck}
					/>
					<MetricCard
						loading={loading}
						label="Infra alerts"
						value={formatNumber((infraState?.zombie_processes || []).length)}
						hint="System pulse live"
						icon={Bell}
					/>
					<MetricCard
						loading={loading}
						label="Open tickets"
						value={formatNumber(supportTickets.length)}
						hint="Support queue view"
						icon={Inbox}
					/>
				</section>

				<section className="grid gap-4 xl:grid-cols-3">
					<div
						className={cn(
							"xl:col-span-2 rounded-[2rem] border p-5 shadow-xl shadow-sky-900/10 backdrop-blur-xl",
							adminDark ? "border-white/10 bg-white/5" : "border-slate-200 bg-white/70",
						)}
					>
						<div className="flex items-center justify-between gap-4">
							<div>
								<p
									className={cn(
										"text-xs uppercase tracking-[0.22em]",
										adminDark ? "text-slate-400" : "text-slate-500",
									)}
								>
									4 sections
								</p>
								<h2
									className={cn(
										"mt-1 text-xl font-semibold",
										adminDark ? "text-white" : "text-slate-900",
									)}
								>
									Live operations overview
								</h2>
							</div>
							<Pill>24/7 active</Pill>
						</div>

						<div className="mt-5 grid gap-4 md:grid-cols-2">
							{[
								{
									title: "Web Server + PHP",
									description: "Config editor and version manager.",
									icon: Server,
									onRefresh: refreshServerAdminState,
									lines: [
										`Web: ${serverAdminState?.web_server?.type || "--"} · ${serverAdminState?.web_server?.status || "--"}`,
										`PHP ${serverAdminState?.php?.version || "--"}`,
									],
									accent: "from-sky-500/20 via-cyan-500/10 to-blue-500/10",
								},
								{
									title: "Domains + Apps",
									description: "DNS, installers, and file manager.",
									icon: Globe2,
									onRefresh: refreshServerAdminState,
									lines: [
										...((serverAdminState?.domains || [])
											.slice(0, 2)
											.map((domain) => `${domain.domain} · ${domain.status}`) || []),
										...((serverAdminState?.apps || [])
											.slice(0, 1)
											.map((app) => `${app.name} · ${app.version}`) || []),
										`Files: ${(serverAdminState?.files || []).length}`,
									],
									accent: "from-cyan-500/20 via-sky-500/10 to-blue-500/10",
								},
								{
									title: "RBAC + Queues + Backups",
									description: "Admin roles and task queues.",
									icon: Lock,
									onRefresh: refreshServerAdminState,
									lines: [
										`IDS status: ${serverAdminState?.security?.ids_status || "idle"}`,
										`DB admin sessions: ${(serverAdminState?.db_admin_sessions || []).length}`,
										`Backup providers: ${(serverAdminState?.backups?.providers || []).length}`,
										`Auto updates: ${serverAdminState?.automation?.auto_updates ? "On" : "Off"} · Window ${serverAdminState?.automation?.patch_window || "--"}`,
									],
									accent: "from-blue-500/20 via-indigo-500/10 to-sky-500/10",
								},
								{
									title: "Integrations + Installers",
									description: "Provider wiring and tooling status.",
									icon: Workflow,
									onRefresh: refreshIntegrationStatus,
									lines: [
										`Signature: ${integrationStatus?.signature?.provider || "--"} · ${integrationStatus?.signature?.status || "missing"}`,
										`Bank validation: ${integrationStatus?.bank_validation?.provider || "--"} · ${integrationStatus?.bank_validation?.status || "missing"}`,
										`IDS/IPS: ${integrationStatus?.ids_ips?.status || "missing"}`,
										`Alert delivery: Slack ${integrationStatus?.alerts?.slack ? "on" : "off"} · SMS ${integrationStatus?.alerts?.sms ? "on" : "off"} · Email ${integrationStatus?.alerts?.email ? "on" : "off"}`,
										`Backups: S3 ${integrationStatus?.backups?.s3 ? "on" : "off"} · GCS ${integrationStatus?.backups?.gcs ? "on" : "off"} · Spaces ${integrationStatus?.backups?.spaces ? "on" : "off"}`,
										`Installer: ${integrationStatus?.installer?.provider || "winget"} · ${integrationStatus?.installer?.platform || "windows"}`,
									],
									accent: "from-sky-500/20 via-blue-500/10 to-cyan-500/10",
								},
							].map((card) => {
								const Icon = card.icon;
								return (
									<div
										key={card.title}
										className={cn(
											"rounded-3xl border p-5 shadow-lg shadow-sky-950/10",
											adminDark
												? `border-white/10 bg-gradient-to-br ${card.accent}`
												: "border-slate-200 bg-white",
										)}
									>
										<div className="flex items-start justify-between gap-3">
											<div className="flex items-start gap-3">
												<div
													className={cn(
														"rounded-2xl border p-3 backdrop-blur-md",
														adminDark
															? "border-white/10 bg-slate-950/30 text-sky-100"
															: "border-sky-200 bg-sky-50 text-sky-700",
													)}
												>
													<Icon className="h-5 w-5" />
												</div>
												<div>
													<div className="flex items-center gap-2">
														<h3
															className={cn(
																"font-semibold",
																adminDark ? "text-white" : "text-slate-900",
															)}
														>
															{card.title}
														</h3>
														<Pill>live</Pill>
													</div>
													<p
														className={cn(
															"mt-1 text-sm",
															adminDark ? "text-slate-300" : "text-slate-600",
														)}
													>
														{card.description}
													</p>
												</div>
											</div>
											<button
												type="button"
												onClick={card.onRefresh}
												className={cn(
													"inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs font-semibold transition",
													adminDark
														? "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
														: "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100",
												)}
											>
												<RefreshCw className="h-3.5 w-3.5" /> Refresh
											</button>
										</div>

										<div className="mt-4 space-y-2">
											{card.lines
												.filter(Boolean)
												.slice(0, 6)
												.map((line) => (
													<div
														key={line}
														className={cn(
															"rounded-2xl border px-4 py-3 text-sm shadow-sm",
															adminDark
																? "border-white/10 bg-slate-950/35 text-slate-200"
																: "border-slate-200 bg-white text-slate-700",
														)}
													>
														{line}
													</div>
												))}
										</div>
									</div>
								);
							})}
						</div>
					</div>

					<div
						className={cn(
							"rounded-[2rem] border p-5 shadow-xl shadow-sky-900/10 backdrop-blur-xl",
							adminDark ? "border-white/10 bg-white/5" : "border-slate-200 bg-white/70",
						)}
					>
						<div className="flex items-center justify-between gap-3">
							<div>
								<p
									className={cn(
										"text-xs uppercase tracking-[0.22em]",
										adminDark ? "text-slate-400" : "text-slate-500",
									)}
								>
									Platform Snapshot
								</p>
								<h2
									className={cn(
										"mt-1 text-xl font-semibold",
										adminDark ? "text-white" : "text-slate-900",
									)}
								>
									System health
								</h2>
							</div>
							<Shield className={cn("h-5 w-5", adminDark ? "text-sky-300" : "text-sky-600")} />
						</div>

						<div className="mt-5 space-y-3">
							{[
								["MFA Required", securityContext?.mfa_required ? "On" : "Off"],
								["Exec Enabled", securityContext?.exec_enabled ? "On" : "Simulated"],
								["OpenSearch", openSearchConfig.enabled ? "On" : "Off"],
								["Email delivery", emailConfig.enabled ? "Enabled" : "Skipped if not configured"],
								[
									"Backup providers",
									`${(serverAdminState?.backups?.providers || []).length} configured`,
								],
							].map(([label, value]) => (
								<div
									key={label}
									className={cn(
										"rounded-2xl border px-4 py-3",
										adminDark ? "border-white/10 bg-slate-950/35" : "border-slate-200 bg-white",
									)}
								>
									<div className="flex items-center justify-between gap-3">
										<span
											className={cn("text-sm", adminDark ? "text-slate-300" : "text-slate-600")}
										>
											{label}
										</span>
										<Pill>{value}</Pill>
									</div>
								</div>
							))}
						</div>

						<div
							className={cn(
								"mt-5 rounded-3xl border p-4",
								adminDark ? "border-sky-400/20 bg-sky-500/10" : "border-sky-200 bg-sky-50",
							)}
						>
							<div className="flex items-start gap-3">
								<TerminalSquare
									className={cn("mt-0.5 h-5 w-5", adminDark ? "text-sky-300" : "text-sky-600")}
								/>
								<div>
									<p className={cn("font-medium", adminDark ? "text-white" : "text-slate-900")}>
										OpenSearch control
									</p>
									<p
										className={cn("mt-1 text-sm", adminDark ? "text-slate-300" : "text-slate-600")}
									>
										Enable search only when reachable, then save settings, ensure indices, and
										reindex.
									</p>
								</div>
							</div>
							<button
								type="button"
								onClick={() =>
									setOpenSearchConfig((prev) => ({
										...prev,
										enabled: true,
									}))
								}
								className={cn(
									"mt-4 inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:translate-y-[-1px]",
									adminDark ? "bg-sky-500 shadow-sky-500/25" : "bg-sky-600 shadow-sky-500/20",
								)}
							>
								Enable OpenSearch <ArrowRight className="h-4 w-4" />
							</button>
						</div>
					</div>
				</section>

				<section
					className={cn(
						"rounded-[2rem] border p-5 shadow-xl shadow-sky-900/10 backdrop-blur-xl",
						adminDark ? "border-white/10 bg-white/5" : "border-slate-200 bg-white/70",
					)}
				>
					<div className="flex flex-wrap items-center justify-between gap-3">
						<div>
							<p
								className={cn(
									"text-xs uppercase tracking-[0.22em]",
									adminDark ? "text-slate-400" : "text-slate-500",
								)}
							>
								Configuration surfaces
							</p>
							<h2
								className={cn(
									"mt-1 text-xl font-semibold",
									adminDark ? "text-white" : "text-slate-900",
								)}
							>
								OpenSearch + Email Notifications
							</h2>
						</div>
						<Pill>Premium controls</Pill>
					</div>

					<div className="mt-5 grid gap-5 lg:grid-cols-2">
						<div
							className={cn(
								"rounded-3xl border p-5",
								adminDark ? "border-white/10 bg-slate-950/30" : "border-slate-200 bg-white",
							)}
						>
							<div className="flex items-center gap-3">
								<Search className={cn("h-5 w-5", adminDark ? "text-sky-300" : "text-sky-600")} />
								<div>
									<h3 className={cn("font-semibold", adminDark ? "text-white" : "text-slate-900")}>
										OpenSearch
									</h3>
									<p className={cn("text-sm", adminDark ? "text-slate-400" : "text-slate-600")}>
										Faceted search engine + fast estimates.
									</p>
								</div>
							</div>
							<div className={cn("mt-2 text-sm", adminDark ? "text-slate-300" : "text-slate-600")}>
								Enabled: {openSearchConfig.enabled ? "On" : "Off"} · Configured:{" "}
								{openSearchStatus?.configured ? "yes" : "no"} · Reachable:{" "}
								{openSearchStatus?.reachable ? "yes" : "no"}
							</div>

							<div className="mt-4 grid gap-4 md:grid-cols-2">
								<label className="md:col-span-2">
									<span
										className={cn(
											"mb-2 block text-xs font-medium uppercase tracking-[0.2em]",
											adminDark ? "text-slate-400" : "text-slate-500",
										)}
									>
										OpenSearch URL
									</span>
									<input
										value={openSearchConfig.url}
										onChange={(e) =>
											setOpenSearchConfig((prev) => ({
												...prev,
												url: e.target.value,
											}))
										}
										placeholder={
											import.meta.env.VITE_OPENSEARCH_URL || "https://your-opensearch-host:443"
										}
										className={cn(
											"w-full rounded-2xl border px-4 py-3 text-sm outline-none",
											adminDark
												? "border-white/10 bg-white/5 text-white placeholder:text-slate-500 focus:border-sky-400/40"
												: "border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:border-sky-400",
										)}
									/>
								</label>
								<label>
									<span
										className={cn(
											"mb-2 block text-xs font-medium uppercase tracking-[0.2em]",
											adminDark ? "text-slate-400" : "text-slate-500",
										)}
									>
										Username (optional)
									</span>
									<input
										value={openSearchConfig.username}
										onChange={(e) =>
											setOpenSearchConfig((prev) => ({
												...prev,
												username: e.target.value,
											}))
										}
										placeholder="username"
										className={cn(
											"w-full rounded-2xl border px-4 py-3 text-sm outline-none",
											adminDark
												? "border-white/10 bg-white/5 text-white placeholder:text-slate-500 focus:border-sky-400/40"
												: "border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:border-sky-400",
										)}
									/>
								</label>
								<label>
									<span
										className={cn(
											"mb-2 block text-xs font-medium uppercase tracking-[0.2em]",
											adminDark ? "text-slate-400" : "text-slate-500",
										)}
									>
										Password (optional)
									</span>
									<input
										value={openSearchConfig.password}
										onChange={(e) =>
											setOpenSearchConfig((prev) => ({
												...prev,
												password: e.target.value,
											}))
										}
										placeholder="••••••••"
										className={cn(
											"w-full rounded-2xl border px-4 py-3 text-sm outline-none",
											adminDark
												? "border-white/10 bg-white/5 text-white placeholder:text-slate-500 focus:border-sky-400/40"
												: "border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:border-sky-400",
										)}
									/>
								</label>
								<label>
									<span
										className={cn(
											"mb-2 block text-xs font-medium uppercase tracking-[0.2em]",
											adminDark ? "text-slate-400" : "text-slate-500",
										)}
									>
										Index prefix
									</span>
									<input
										value={openSearchConfig.index_prefix}
										onChange={(e) =>
											setOpenSearchConfig((prev) => ({
												...prev,
												index_prefix: e.target.value,
											}))
										}
										placeholder="app"
										className={cn(
											"w-full rounded-2xl border px-4 py-3 text-sm outline-none",
											adminDark
												? "border-white/10 bg-white/5 text-white placeholder:text-slate-500 focus:border-sky-400/40"
												: "border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:border-sky-400",
										)}
									/>
								</label>
								<label>
									<span
										className={cn(
											"mb-2 block text-xs font-medium uppercase tracking-[0.2em]",
											adminDark ? "text-slate-400" : "text-slate-500",
										)}
									>
										Timeout (ms)
									</span>
									<input
										type="number"
										value={openSearchConfig.timeout_ms}
										onChange={(e) =>
											setOpenSearchConfig((prev) => ({
												...prev,
												timeout_ms: e.target.value,
											}))
										}
										placeholder="3000"
										className={cn(
											"w-full rounded-2xl border px-4 py-3 text-sm outline-none",
											adminDark
												? "border-white/10 bg-white/5 text-white placeholder:text-slate-500 focus:border-sky-400/40"
												: "border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:border-sky-400",
										)}
									/>
								</label>
							</div>

							<div className="mt-4 flex flex-wrap items-center gap-3">
								<label
									className={cn(
										"inline-flex items-center gap-2 text-sm",
										adminDark ? "text-slate-300" : "text-slate-700",
									)}
								>
									<input
										type="checkbox"
										checked={openSearchConfig.enabled}
										onChange={(e) =>
											setOpenSearchConfig((prev) => ({
												...prev,
												enabled: e.target.checked,
											}))
										}
										className="h-4 w-4"
									/>
									Enabled
								</label>
								<label
									className={cn(
										"inline-flex items-center gap-2 text-sm",
										adminDark ? "text-slate-300" : "text-slate-700",
									)}
								>
									<input
										type="checkbox"
										checked={openSearchConfig.verify_tls}
										onChange={(e) =>
											setOpenSearchConfig((prev) => ({
												...prev,
												verify_tls: e.target.checked,
											}))
										}
										className="h-4 w-4"
									/>
									Verify TLS certificate
								</label>
								<button
									type="button"
									onClick={refreshOpenSearchStatus}
									className={cn(
										"inline-flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-medium transition",
										adminDark
											? "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
											: "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100",
									)}
								>
									<RefreshCw className="h-4 w-4" /> Refresh status
								</button>
							</div>

							{openSearchNotice ? (
								<div className="mt-3 text-sm text-emerald-400">{openSearchNotice}</div>
							) : null}
							{openSearchError ? (
								<div className="mt-3 text-sm text-rose-300">{openSearchError}</div>
							) : null}

							<div className="mt-4 flex flex-wrap gap-2">
								<button
									type="button"
									onClick={saveOpenSearchConfig}
									disabled={openSearchConfigBusy}
									className={cn(
										"inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-medium transition disabled:opacity-60",
										adminDark
											? "bg-sky-500 text-white shadow-lg shadow-sky-500/20 hover:translate-y-[-1px]"
											: "bg-sky-600 text-white shadow-lg shadow-sky-500/20 hover:translate-y-[-1px]",
									)}
								>
									{openSearchConfigBusy ? (
										<ThreeDot variant="bounce" color="#337ab0" size="small" text="" textColor="" />
									) : (
										"Save settings"
									)}
								</button>
								<button
									type="button"
									onClick={() => runOpenSearchAction("opensearch.test_connection")}
									disabled={Boolean(openSearchActionBusy)}
									className={cn(
										"inline-flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-medium transition disabled:opacity-60",
										adminDark
											? "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
											: "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100",
									)}
								>
									{openSearchActionBusy === "opensearch.test_connection"
										? "Testing..."
										: "Test connection"}
								</button>
								<button
									type="button"
									onClick={() => runOpenSearchAction("opensearch.ensure_indices")}
									disabled={Boolean(openSearchActionBusy)}
									className={cn(
										"inline-flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-medium transition disabled:opacity-60",
										adminDark
											? "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
											: "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100",
									)}
								>
									Ensure indices
								</button>
								<button
									type="button"
									onClick={() =>
										runOpenSearchAction("opensearch.reindex_all", { reset: openSearchReset })
									}
									disabled={Boolean(openSearchActionBusy)}
									className={cn(
										"inline-flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-medium transition disabled:opacity-60",
										adminDark
											? "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
											: "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100",
									)}
								>
									Reindex all
								</button>
							</div>

							<div className="mt-3 flex flex-wrap items-center gap-3">
								<label
									className={cn(
										"inline-flex items-center gap-2 text-sm",
										adminDark ? "text-slate-300" : "text-slate-700",
									)}
								>
									<input
										type="checkbox"
										checked={openSearchReset}
										onChange={(e) => setOpenSearchReset(e.target.checked)}
										className="h-4 w-4"
									/>
									Reset
								</label>
								<input
									value={openSearchOrgId}
									onChange={(e) => setOpenSearchOrgId(e.target.value)}
									placeholder="Org ID (reindex org)"
									className={cn(
										"flex-1 rounded-2xl border px-4 py-3 text-sm outline-none",
										adminDark
											? "border-white/10 bg-white/5 text-white placeholder:text-slate-500 focus:border-sky-400/40"
											: "border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:border-sky-400",
									)}
								/>
								<button
									type="button"
									onClick={() =>
										runOpenSearchAction("opensearch.reindex_org", { org_id: openSearchOrgId })
									}
									disabled={Boolean(openSearchActionBusy) || !String(openSearchOrgId || "").trim()}
									className={cn(
										"inline-flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-medium transition disabled:opacity-60",
										adminDark
											? "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
											: "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100",
									)}
								>
									Reindex org
								</button>
							</div>

							<p className={cn("mt-3 text-sm", adminDark ? "text-slate-400" : "text-slate-600")}>
								Save settings → Ensure indices → Reindex (all or org). Search uses OpenSearch only
								when enabled + reachable.
							</p>
						</div>

						<div
							className={cn(
								"rounded-3xl border p-5",
								adminDark ? "border-white/10 bg-slate-950/30" : "border-slate-200 bg-white",
							)}
						>
							<div className="flex items-center gap-3">
								<Mail className={cn("h-5 w-5", adminDark ? "text-sky-300" : "text-sky-600")} />
								<div>
									<h3 className={cn("font-semibold", adminDark ? "text-white" : "text-slate-900")}>
										Email Notifications
									</h3>
									<p className={cn("text-sm", adminDark ? "text-slate-400" : "text-slate-600")}>
										SMTP or Gmail API delivery for reminders.
									</p>
								</div>
							</div>

							<div className="mt-4 grid gap-4 md:grid-cols-2">
								<label className="md:col-span-2">
									<span
										className={cn(
											"mb-2 block text-xs font-medium uppercase tracking-[0.2em]",
											adminDark ? "text-slate-400" : "text-slate-500",
										)}
									>
										Enabled
									</span>
									<label
										className={cn(
											"inline-flex items-center gap-2 text-sm",
											adminDark ? "text-slate-200" : "text-slate-700",
										)}
									>
										<input
											type="checkbox"
											checked={emailConfig.enabled}
											onChange={(e) =>
												setEmailConfig((prev) => ({
													...prev,
													enabled: e.target.checked,
												}))
											}
											className="h-4 w-4"
										/>
										{emailConfig.enabled ? "On" : "Off"}
									</label>
								</label>

								<label>
									<span
										className={cn(
											"mb-2 block text-xs font-medium uppercase tracking-[0.2em]",
											adminDark ? "text-slate-400" : "text-slate-500",
										)}
									>
										Provider
									</span>
									<select
										value={emailConfig.provider}
										onChange={(e) =>
											setEmailConfig((prev) => ({
												...prev,
												provider: e.target.value,
											}))
										}
										className={cn(
											"w-full rounded-2xl border px-4 py-3 text-sm outline-none",
											adminDark
												? "border-white/10 bg-white/5 text-white focus:border-sky-400/40"
												: "border-slate-200 bg-white text-slate-900 focus:border-sky-400",
										)}
									>
										<option value="smtp">SMTP</option>
										<option value="gmail_api">Gmail API</option>
									</select>
								</label>

								<label>
									<span
										className={cn(
											"mb-2 block text-xs font-medium uppercase tracking-[0.2em]",
											adminDark ? "text-slate-400" : "text-slate-500",
										)}
									>
										From name
									</span>
									<input
										value={emailConfig.from_name}
										onChange={(e) =>
											setEmailConfig((prev) => ({
												...prev,
												from_name: e.target.value,
											}))
										}
										placeholder="Admin Team"
										className={cn(
											"w-full rounded-2xl border px-4 py-3 text-sm outline-none",
											adminDark
												? "border-white/10 bg-white/5 text-white placeholder:text-slate-500 focus:border-sky-400/40"
												: "border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:border-sky-400",
										)}
									/>
								</label>

								<label>
									<span
										className={cn(
											"mb-2 block text-xs font-medium uppercase tracking-[0.2em]",
											adminDark ? "text-slate-400" : "text-slate-500",
										)}
									>
										From email
									</span>
									<input
										value={emailConfig.from_email}
										onChange={(e) =>
											setEmailConfig((prev) => ({
												...prev,
												from_email: e.target.value,
											}))
										}
										placeholder="admin@example.com"
										className={cn(
											"w-full rounded-2xl border px-4 py-3 text-sm outline-none",
											adminDark
												? "border-white/10 bg-white/5 text-white placeholder:text-slate-500 focus:border-sky-400/40"
												: "border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:border-sky-400",
										)}
									/>
								</label>

								<label className="md:col-span-2">
									<span
										className={cn(
											"mb-2 block text-xs font-medium uppercase tracking-[0.2em]",
											adminDark ? "text-slate-400" : "text-slate-500",
										)}
									>
										Test recipient
									</span>
									<input
										value={emailConfig.test_recipient}
										onChange={(e) =>
											setEmailConfig((prev) => ({
												...prev,
												test_recipient: e.target.value,
											}))
										}
										placeholder="recipient@example.com"
										className={cn(
											"w-full rounded-2xl border px-4 py-3 text-sm outline-none",
											adminDark
												? "border-white/10 bg-white/5 text-white placeholder:text-slate-500 focus:border-sky-400/40"
												: "border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:border-sky-400",
										)}
									/>
								</label>
							</div>

							{emailConfigNotice ? (
								<div className="mt-3 text-sm text-emerald-400">{emailConfigNotice}</div>
							) : null}
							{emailConfigError ? (
								<div className="mt-3 text-sm text-rose-300">{emailConfigError}</div>
							) : null}

							<div className="mt-4 flex flex-wrap items-center gap-2">
								<button
									type="button"
									onClick={saveEmailConfig}
									disabled={emailConfigBusy}
									className="inline-flex items-center gap-2 rounded-2xl bg-sky-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-sky-500/20 transition hover:translate-y-[-1px] disabled:opacity-60"
								>
									{emailConfigBusy ? (
										<ThreeDot variant="bounce" color="#337ab0" size="small" text="" textColor="" />
									) : (
										"Save settings"
									)}
								</button>
								<button
									type="button"
									onClick={sendEmailTest}
									className={cn(
										"inline-flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-medium transition",
										adminDark
											? "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
											: "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100",
									)}
								>
									Send test
								</button>
							</div>

							<div
								className={cn(
									"mt-4 rounded-2xl border p-4 text-sm",
									adminDark
										? "border-amber-500/20 bg-amber-500/10 text-amber-100"
										: "border-amber-200 bg-amber-50 text-amber-800",
								)}
							>
								Secrets remain in env vars. If provider is not configured, email is skipped
								silently.
							</div>
						</div>
					</div>
				</section>

				<section
					className={cn(
						"mt-6 rounded-[2rem] border p-5 shadow-xl shadow-sky-900/10 backdrop-blur-xl",
						adminDark ? "border-white/10 bg-white/5" : "border-slate-200 bg-white/70",
					)}
				>
					<div className="flex flex-wrap items-center justify-between gap-3">
						<div>
							<p
								className={cn(
									"text-xs uppercase tracking-[0.22em]",
									adminDark ? "text-slate-400" : "text-slate-500",
								)}
							>
								Admin UI Settings
							</p>
							<h2
								className={cn(
									"mt-1 text-xl font-semibold",
									adminDark ? "text-white" : "text-slate-900",
								)}
							>
								Role gating + UI fallbacks + copy
							</h2>
							<p
								className={cn(
									"mt-2 max-w-3xl text-sm",
									adminDark ? "text-slate-300" : "text-slate-600",
								)}
							>
								These settings control what the Admin Panel UI shows when backend inventory is
								unavailable, and which roles may view the admin panel UI. Backend security still
								enforces access for all <span className="font-medium">/api/admin</span> routes.
							</p>
						</div>
						<button
							type="button"
							onClick={saveAdminUiSettings}
							disabled={adminUiSettingsBusy}
							className={cn(
								"inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition disabled:opacity-60",
								adminDark
									? "bg-sky-500 shadow-sky-500/25 hover:translate-y-[-1px]"
									: "bg-sky-600 shadow-sky-500/20 hover:translate-y-[-1px]",
							)}
						>
							{adminUiSettingsBusy ? (
								<ThreeDot variant="bounce" color="#337ab0" size="small" text="" textColor="" />
							) : (
								"Save settings"
							)}
						</button>
					</div>

					{adminUiSettingsNotice ? (
						<div className="mt-3 text-sm text-emerald-400">{adminUiSettingsNotice}</div>
					) : null}
					{adminUiSettingsError ? (
						<div className="mt-3 text-sm text-rose-300">{adminUiSettingsError}</div>
					) : null}

					<div className="mt-5 grid gap-5 lg:grid-cols-2">
						<div
							className={cn(
								"rounded-3xl border p-5",
								adminDark ? "border-white/10 bg-slate-950/30" : "border-slate-200 bg-white",
							)}
						>
							<div className="flex items-center gap-3">
								<ShieldCheck
									className={cn("h-5 w-5", adminDark ? "text-sky-300" : "text-sky-600")}
								/>
								<div>
									<h3 className={cn("font-semibold", adminDark ? "text-white" : "text-slate-900")}>
										Allowed roles
									</h3>
									<p className={cn("text-sm", adminDark ? "text-slate-400" : "text-slate-600")}>
										Comma or newline separated. Known roles: buyer, factory, buying_house, owner,
										admin, agent.
									</p>
								</div>
							</div>
							<textarea
								value={adminUiSettingsForm.allowed_roles}
								onChange={(e) => {
									setAdminUiSettingsDirty(true);
									setAdminUiSettingsForm((prev) => ({
										...prev,
										allowed_roles: e.target.value,
									}));
								}}
								placeholder="owner, admin"
								rows={3}
								className={cn(
									"mt-4 w-full resize-y rounded-2xl border px-4 py-3 text-sm outline-none",
									adminDark
										? "border-white/10 bg-white/5 text-white placeholder:text-slate-500 focus:border-sky-400/40"
										: "border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:border-sky-400",
								)}
							/>
						</div>

						<div
							className={cn(
								"rounded-3xl border p-5",
								adminDark ? "border-white/10 bg-slate-950/30" : "border-slate-200 bg-white",
							)}
						>
							<div className="flex items-center gap-3">
								<LayoutDashboard
									className={cn("h-5 w-5", adminDark ? "text-sky-300" : "text-sky-600")}
								/>
								<div>
									<h3 className={cn("font-semibold", adminDark ? "text-white" : "text-slate-900")}>
										Fallback inventory
									</h3>
									<p className={cn("text-sm", adminDark ? "text-slate-400" : "text-slate-600")}>
										JSON array of objects: id, label, icon_name (optional).
									</p>
								</div>
							</div>
							<textarea
								value={adminUiSettingsForm.fallback_inventory_json}
								onChange={(e) => {
									setAdminUiSettingsDirty(true);
									setAdminUiSettingsForm((prev) => ({
										...prev,
										fallback_inventory_json: e.target.value,
									}));
								}}
								rows={10}
								className={cn(
									"mt-4 w-full resize-y rounded-2xl border px-4 py-3 font-mono text-xs outline-none",
									adminDark
										? "border-white/10 bg-white/5 text-slate-100 placeholder:text-slate-500 focus:border-sky-400/40"
										: "border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:border-sky-400",
								)}
							/>
							<div className={cn("mt-3 text-xs", adminDark ? "text-slate-400" : "text-slate-600")}>
								Icon names are resolved via a safe registry (e.g.{" "}
								<span className={cn("font-mono", adminDark ? "text-slate-200" : "text-slate-800")}>
									ShieldCheck
								</span>
								,{" "}
								<span className={cn("font-mono", adminDark ? "text-slate-200" : "text-slate-800")}>
									Server
								</span>
								,{" "}
								<span className={cn("font-mono", adminDark ? "text-slate-200" : "text-slate-800")}>
									Network
								</span>
								,{" "}
								<span className={cn("font-mono", adminDark ? "text-slate-200" : "text-slate-800")}>
									Database
								</span>
								,{" "}
								<span className={cn("font-mono", adminDark ? "text-slate-200" : "text-slate-800")}>
									Settings
								</span>
								,{" "}
								<span className={cn("font-mono", adminDark ? "text-slate-200" : "text-slate-800")}>
									Lock
								</span>
								).
							</div>
						</div>
					</div>

					<div className="mt-5 grid gap-5 lg:grid-cols-2">
						<div
							className={cn(
								"rounded-3xl border p-5",
								adminDark ? "border-white/10 bg-slate-950/30" : "border-slate-200 bg-white",
							)}
						>
							<div className="flex items-center gap-3">
								<BarChart3 className={cn("h-5 w-5", adminDark ? "text-sky-300" : "text-sky-600")} />
								<div>
									<h3 className={cn("font-semibold", adminDark ? "text-white" : "text-slate-900")}>
										Chart theme
									</h3>
									<p className={cn("text-sm", adminDark ? "text-slate-400" : "text-slate-600")}>
										Pie palette + chart fallback labels.
									</p>
								</div>
							</div>

							<label className="mt-4 block">
								<div
									className={cn(
										"mb-2 text-xs font-medium uppercase tracking-[0.2em]",
										adminDark ? "text-slate-400" : "text-slate-600",
									)}
								>
									Pie palette (hex colors)
								</div>
								<textarea
									value={adminUiSettingsForm.pie_palette}
									onChange={(e) => {
										setAdminUiSettingsDirty(true);
										setAdminUiSettingsForm((prev) => ({
											...prev,
											pie_palette: e.target.value,
										}));
									}}
									rows={4}
									placeholder="#6dabdf\n#6aa1d4\n#0f172a"
									className={cn(
										"w-full resize-y rounded-2xl border px-4 py-3 font-mono text-xs outline-none",
										adminDark
											? "border-white/10 bg-white/5 text-slate-100 placeholder:text-slate-500 focus:border-sky-400/40"
											: "border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:border-sky-400",
									)}
								/>
							</label>

							<label className="mt-4 block">
								<div
									className={cn(
										"mb-2 text-xs font-medium uppercase tracking-[0.2em]",
										adminDark ? "text-slate-400" : "text-slate-600",
									)}
								>
									Contract status “no data” label
								</div>
								<input
									value={adminUiSettingsForm.contract_no_data_label}
									onChange={(e) => {
										setAdminUiSettingsDirty(true);
										setAdminUiSettingsForm((prev) => ({
											...prev,
											contract_no_data_label: e.target.value,
										}));
									}}
									placeholder="No Data"
									className={cn(
										"w-full rounded-2xl border px-4 py-3 text-sm outline-none",
										adminDark
											? "border-white/10 bg-white/5 text-white placeholder:text-slate-500 focus:border-sky-400/40"
											: "border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:border-sky-400",
									)}
								/>
							</label>
						</div>

						<div
							className={cn(
								"rounded-3xl border p-5",
								adminDark ? "border-white/10 bg-slate-950/30" : "border-slate-200 bg-white",
							)}
						>
							<div className="flex items-center gap-3">
								<Gauge className={cn("h-5 w-5", adminDark ? "text-sky-300" : "text-sky-600")} />
								<div>
									<h3 className={cn("font-semibold", adminDark ? "text-white" : "text-slate-900")}>
										CMS weekly trend fallback
									</h3>
									<p className={cn("text-sm", adminDark ? "text-slate-400" : "text-slate-600")}>
										Used when analytics trend data is unavailable.
									</p>
								</div>
							</div>
							<textarea
								value={adminUiSettingsForm.cms_weekly_trend_json}
								onChange={(e) => {
									setAdminUiSettingsDirty(true);
									setAdminUiSettingsForm((prev) => ({
										...prev,
										cms_weekly_trend_json: e.target.value,
									}));
								}}
								rows={10}
								className={cn(
									"mt-4 w-full resize-y rounded-2xl border px-4 py-3 font-mono text-xs outline-none",
									adminDark
										? "border-white/10 bg-white/5 text-slate-100 placeholder:text-slate-500 focus:border-sky-400/40"
										: "border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:border-sky-400",
								)}
							/>
						</div>
					</div>

					<div className="mt-5 grid gap-5 lg:grid-cols-2">
						<div
							className={cn(
								"rounded-3xl border p-5",
								adminDark ? "border-white/10 bg-slate-950/30" : "border-slate-200 bg-white",
							)}
						>
							<div className="flex items-center gap-3">
								<ShieldAlert
									className={cn("h-5 w-5", adminDark ? "text-sky-300" : "text-sky-600")}
								/>
								<div>
									<h3 className={cn("font-semibold", adminDark ? "text-white" : "text-slate-900")}>
										Ultra Security demo data
									</h3>
									<p className={cn("text-sm", adminDark ? "text-slate-400" : "text-slate-600")}>
										Mini-chart points, KPI tiles, and capabilities list.
									</p>
								</div>
							</div>

							<label className="mt-4 block">
								<div
									className={cn(
										"mb-2 text-xs font-medium uppercase tracking-[0.2em]",
										adminDark ? "text-slate-400" : "text-slate-600",
									)}
								>
									Mini-chart points (JSON array)
								</div>
								<textarea
									value={adminUiSettingsForm.ultra_mini_points_json}
									onChange={(e) => {
										setAdminUiSettingsDirty(true);
										setAdminUiSettingsForm((prev) => ({
											...prev,
											ultra_mini_points_json: e.target.value,
										}));
									}}
									rows={6}
									className={cn(
										"w-full resize-y rounded-2xl border px-4 py-3 font-mono text-xs outline-none",
										adminDark
											? "border-white/10 bg-white/5 text-slate-100 placeholder:text-slate-500 focus:border-sky-400/40"
											: "border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:border-sky-400",
									)}
								/>
							</label>

							<label className="mt-4 block">
								<div
									className={cn(
										"mb-2 text-xs font-medium uppercase tracking-[0.2em]",
										adminDark ? "text-slate-400" : "text-slate-600",
									)}
								>
									Mini-chart KPIs (JSON array)
								</div>
								<textarea
									value={adminUiSettingsForm.ultra_mini_kpis_json}
									onChange={(e) => {
										setAdminUiSettingsDirty(true);
										setAdminUiSettingsForm((prev) => ({
											...prev,
											ultra_mini_kpis_json: e.target.value,
										}));
									}}
									rows={6}
									className={cn(
										"w-full resize-y rounded-2xl border px-4 py-3 font-mono text-xs outline-none",
										adminDark
											? "border-white/10 bg-white/5 text-slate-100 placeholder:text-slate-500 focus:border-sky-400/40"
											: "border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:border-sky-400",
									)}
								/>
							</label>

							<label className="mt-4 block">
								<div
									className={cn(
										"mb-2 text-xs font-medium uppercase tracking-[0.2em]",
										adminDark ? "text-slate-400" : "text-slate-600",
									)}
								>
									Capabilities (newline/comma list)
								</div>
								<textarea
									value={adminUiSettingsForm.ultra_capabilities}
									onChange={(e) => {
										setAdminUiSettingsDirty(true);
										setAdminUiSettingsForm((prev) => ({
											...prev,
											ultra_capabilities: e.target.value,
										}));
									}}
									rows={6}
									className={cn(
										"w-full resize-y rounded-2xl border px-4 py-3 text-sm outline-none",
										adminDark
											? "border-white/10 bg-white/5 text-white placeholder:text-slate-500 focus:border-sky-400/40"
											: "border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:border-sky-400",
									)}
								/>
							</label>
						</div>

						<div
							className={cn(
								"rounded-3xl border p-5",
								adminDark ? "border-white/10 bg-slate-950/30" : "border-slate-200 bg-white",
							)}
						>
							<div className="flex items-center gap-3">
								<FileText className={cn("h-5 w-5", adminDark ? "text-sky-300" : "text-sky-600")} />
								<div>
									<h3 className={cn("font-semibold", adminDark ? "text-white" : "text-slate-900")}>
										Empty-state copy
									</h3>
									<p className={cn("text-sm", adminDark ? "text-slate-400" : "text-slate-600")}>
										JSON object keyed by id (e.g. verification.pending).
									</p>
								</div>
							</div>
							<textarea
								value={adminUiSettingsForm.empty_states_json}
								onChange={(e) => {
									setAdminUiSettingsDirty(true);
									setAdminUiSettingsForm((prev) => ({
										...prev,
										empty_states_json: e.target.value,
									}));
								}}
								rows={16}
								className={cn(
									"mt-4 w-full resize-y rounded-2xl border px-4 py-3 font-mono text-xs outline-none",
									adminDark
										? "border-white/10 bg-white/5 text-slate-100 placeholder:text-slate-500 focus:border-sky-400/40"
										: "border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:border-sky-400",
								)}
							/>
						</div>
					</div>
				</section>

				<section className="mt-6 grid gap-4 lg:grid-cols-2">
					<div
						className={cn(
							"rounded-[2rem] border p-5 shadow-xl shadow-sky-900/10 backdrop-blur-xl",
							adminDark ? "border-white/10 bg-white/5" : "border-slate-200 bg-white/70",
						)}
					>
						<div className="flex items-center justify-between gap-3">
							<div>
								<p
									className={cn(
										"text-xs uppercase tracking-[0.22em]",
										adminDark ? "text-slate-400" : "text-slate-500",
									)}
								>
									Capabilities
								</p>
								<h2
									className={cn(
										"mt-1 text-xl font-semibold",
										adminDark ? "text-white" : "text-slate-900",
									)}
								>
									Live modules
								</h2>
							</div>
							<Pill>7 groups</Pill>
						</div>
						<div className="mt-4 grid gap-3 sm:grid-cols-2">
							{[
								{
									title: "Real-Time Monitoring & Analytics",
									count: 4,
									icon: Activity,
								},
								{
									title: "Security Management",
									count: 4,
									icon: ShieldCheck,
								},
								{
									title: "Server Config & Optimization",
									count: 4,
									icon: ServerCog,
								},
								{
									title: "Backup & Data Protection",
									count: 3,
									icon: Cloud,
								},
								{
									title: "Website/App Management",
									count: 3,
									icon: LayoutDashboard,
								},
								{
									title: "User Account Management (System Admin)",
									count: 2,
									icon: Users,
								},
								{
									title: "Automation",
									count: 2,
									icon: Workflow,
								},
							].map((item) => {
								const Icon = item.icon;
								return (
									<div
										key={item.title}
										className={cn(
											"rounded-3xl border p-4",
											adminDark ? "border-white/10 bg-slate-950/30" : "border-slate-200 bg-white",
										)}
									>
										<div className="flex items-start justify-between gap-3">
											<div className="flex items-start gap-3">
												<div
													className={cn(
														"rounded-2xl border p-2.5",
														adminDark
															? "border-sky-400/20 bg-sky-500/10 text-sky-300"
															: "border-sky-200 bg-sky-50 text-sky-600",
													)}
												>
													<Icon className="h-4 w-4" />
												</div>
												<div>
													<p
														className={cn(
															"font-medium",
															adminDark ? "text-white" : "text-slate-900",
														)}
													>
														{item.title}
													</p>
													<p
														className={cn(
															"text-sm",
															adminDark ? "text-slate-400" : "text-slate-600",
														)}
													>
														{item.count} capabilities
													</p>
												</div>
											</div>
											<Pill>live</Pill>
										</div>
									</div>
								);
							})}
						</div>
					</div>

					<div
						className={cn(
							"rounded-[2rem] border p-5 shadow-xl shadow-sky-900/10 backdrop-blur-xl",
							adminDark ? "border-white/10 bg-white/5" : "border-slate-200 bg-white/70",
						)}
					>
						<div className="flex flex-wrap items-center justify-between gap-3">
							<div>
								<p
									className={cn(
										"text-xs uppercase tracking-[0.22em]",
										adminDark ? "text-slate-400" : "text-slate-500",
									)}
								>
									Audit trail
								</p>
								<h2
									className={cn(
										"mt-1 text-xl font-semibold",
										adminDark ? "text-white" : "text-slate-900",
									)}
								>
									Admin Audit Log
								</h2>
							</div>
							<button
								type="button"
								onClick={refreshAudit}
								className={cn(
									"rounded-2xl border px-4 py-2 text-sm font-medium transition",
									adminDark
										? "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
										: "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100",
								)}
							>
								Refresh log
							</button>
						</div>

						<div
							className={cn(
								"mt-4 flex items-center gap-3 rounded-2xl border px-4 py-3",
								adminDark ? "border-white/10 bg-slate-950/30" : "border-slate-200 bg-white",
							)}
						>
							<Search className={cn("h-4 w-4", adminDark ? "text-slate-400" : "text-slate-500")} />
							<input
								value={serverAdminAuditQuery}
								onChange={(e) => setServerAdminAuditQuery(e.target.value)}
								placeholder="Filter logs by route or actor"
								className={cn(
									"w-full bg-transparent text-sm outline-none",
									adminDark
										? "text-slate-100 placeholder:text-slate-500"
										: "text-slate-900 placeholder:text-slate-400",
								)}
							/>
						</div>

						<div className="mt-4 space-y-3">
							{filteredServerAdminAuditRows.slice(0, 6).map((item) => (
								<div
									key={`${item.id || item.at}`}
									className={cn(
										"rounded-3xl border p-4",
										adminDark ? "border-white/10 bg-slate-950/30" : "border-slate-200 bg-white",
									)}
								>
									<div className="flex flex-wrap items-start justify-between gap-3">
										<div>
											<p className={cn("font-medium", adminDark ? "text-white" : "text-slate-900")}>
												{item.path || item.action || "--"}
											</p>
											<p
												className={cn(
													"mt-1 text-sm",
													adminDark ? "text-slate-400" : "text-slate-600",
												)}
											>
												{item.at ? new Date(item.at).toLocaleString() : "--"} · system
											</p>
										</div>
										<Pill>Status: {item.status ?? 200}</Pill>
									</div>
									<div
										className={cn(
											"mt-3 grid gap-2 text-xs sm:grid-cols-3",
											adminDark ? "text-slate-400" : "text-slate-600",
										)}
									>
										<div>Actor: {item.actor_id || item.actor || "system"}</div>
										<div>IP: {item.ip || "--"}</div>
										<div>Device: {item.device_id || "--"}</div>
									</div>
								</div>
							))}
							{filteredServerAdminAuditRows.length === 0 ? (
								<div
									className={cn(
										"rounded-3xl border border-dashed p-5 text-sm",
										adminDark
											? "border-white/10 bg-white/[0.03] text-slate-400"
											: "border-slate-200 bg-slate-50 text-slate-600",
									)}
								>
									No audit entries found.
								</div>
							) : null}
						</div>
					</div>
				</section>

				<section
					className={cn(
						"rounded-[2rem] border p-5 shadow-xl shadow-sky-900/10 backdrop-blur-xl",
						adminDark ? "border-white/10 bg-white/5" : "border-slate-200 bg-white/70",
					)}
				>
					<div className="flex flex-wrap items-center justify-between gap-3">
						<div>
							<p
								className={cn(
									"text-xs uppercase tracking-[0.22em]",
									adminDark ? "text-slate-400" : "text-slate-500",
								)}
							>
								Design system
							</p>
							<h2
								className={cn(
									"mt-1 text-xl font-semibold",
									adminDark ? "text-white" : "text-slate-900",
								)}
							>
								Blue-sky premium admin experience
							</h2>
						</div>
						<Pill>Responsive</Pill>
					</div>
					<div className="mt-4 grid gap-4 md:grid-cols-3">
						{[
							["Clean surface", "Large rounded cards, soft borders, and glassy depth."],
							["Fast scanning", "Strong hierarchy, compact labels, and clear live states."],
							["Dual mode", "Dark and light themes tuned for blue-sky visuals."],
						].map(([title, text]) => (
							<div
								key={title}
								className={cn(
									"rounded-3xl border p-4",
									adminDark ? "border-white/10 bg-slate-950/30" : "border-slate-200 bg-white",
								)}
							>
								<div className="flex items-center gap-2">
									<CheckCircle2
										className={cn("h-4 w-4", adminDark ? "text-sky-300" : "text-sky-600")}
									/>
									<p className={cn("font-medium", adminDark ? "text-white" : "text-slate-900")}>
										{title}
									</p>
								</div>
								<p className={cn("mt-2 text-sm", adminDark ? "text-slate-400" : "text-slate-600")}>
									{text}
								</p>
							</div>
						))}
					</div>
				</section>
			</div>
		</div>
	);
}

export default AdminServerSection;
