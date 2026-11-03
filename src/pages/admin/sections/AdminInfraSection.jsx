import {
	Activity,
	AlertTriangle,
	ArrowRight,
	CheckCircle2,
	ChevronDown,
	Clock3,
	Database,
	Download,
	LayoutDashboard,
	Lock,
	LockKeyhole,
	Moon,
	RefreshCw,
	Search,
	Server,
	Shield,
	ShieldCheck,
	SlidersHorizontal,
	Sparkles,
	SunMedium,
	TerminalSquare,
	Trash2,
	UserCog,
	Users,
	Wifi,
	XCircle,
} from "lucide-react";
import { useMemo } from "react";
import { cn } from "../../../lib/cn.js";
import { Badge, SectionCard, StatCard } from "../shared/index.jsx";

const INFRA_CAPABILITIES = [
	{
		title: "System Health & Performance Monitoring",
		count: 5,
		icon: Activity,
		subtitle: "Real-time signals, resource visibility, and operational pulse.",
	},
	{
		title: "OS & Software Maintenance",
		count: 4,
		icon: Server,
		subtitle: "Safe updates, package checks, and controlled maintenance flows.",
	},
	{
		title: "User & Security Administration",
		count: 5,
		icon: UserCog,
		subtitle: "Accounts, SSH keys, access, and permission hygiene.",
	},
	{
		title: "Backup & Disaster Recovery",
		count: 3,
		icon: Database,
		subtitle: "Retention, recovery posture, and scheduled protection.",
	},
	{
		title: "Networking & System Settings",
		count: 2,
		icon: Wifi,
		subtitle: "Firewall, SSL, DNS, timezone, and NTP coordination.",
	},
];

export function AdminInfraSection({
	adminDark,
	infra,
	infraState,
	infraSearch,
	setInfraSearch,
	audit = [],
	verificationQueue = [],
	disputes = [],
	firewallForm,
	setFirewallForm,
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
	infraBackupForm,
	setInfraBackupForm,
	timeForm,
	setTimeForm,
	formatNumber,
	toggleTheme,
	refreshInfraAll,
	refreshInfraState,
	refreshVerificationQueue,
	refreshDisputes,
	refreshAudit,
	runInfraAction,
}) {
	const emptyCopy = (_key, fallback) => fallback;

	const infraInputClass = adminDark
		? "w-full rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-sky-400/60"
		: "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-sky-400/60";

	const infraFieldPanel = adminDark
		? "rounded-2xl border border-slate-800 bg-slate-900/60 p-4"
		: "rounded-2xl border border-slate-200 bg-slate-50 p-4";

	const filteredInfraAuditRows = useMemo(() => {
		const query = infraSearch.trim().toLowerCase();
		if (!query) {
			return audit;
		}
		return audit.filter((entry) => {
			const haystack = [
				entry?.action,
				entry?.path,
				entry?.actor,
				entry?.actor_id,
				entry?.ip,
				entry?.device_id,
				entry?.status,
			]
				.map((value) => String(value || "").toLowerCase())
				.join(" ");
			return haystack.includes(query);
		});
	}, [audit, infraSearch]);

	return (
		<div
			className={cn(
				"rounded-[32px] border p-4 sm:p-5",
				adminDark ? "border-slate-800/70 bg-slate-950/50" : "border-slate-200 bg-white/75",
			)}
		>
			<div
				className={cn(
					"rounded-[28px] p-4 sm:p-5",
					adminDark
						? "bg-[radial-gradient(circle_at_top,_rgba(109,171,223,0.18),_transparent_38%),linear-gradient(180deg,#07111f_0%,#020617_100%)] text-slate-100"
						: "bg-[radial-gradient(circle_at_top,_rgba(155,202,242,0.22),_transparent_36%),linear-gradient(180deg,#f8fdff_0%,#eef7ff_100%)] text-slate-900",
				)}
			>
				<div className="mx-auto max-w-[1700px]">
					<header
						className={cn(
							"sticky top-3 z-30 mb-6 rounded-[28px] border px-4 py-4 lg:px-6",
							adminDark
								? "border-slate-800 bg-slate-950/75 shadow-[0_18px_70px_-34px_rgba(15,23,42,0.4)]"
								: "border-slate-200 bg-white shadow-sm",
						)}
					>
						<div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
							<div className="flex flex-wrap items-center gap-3">
								<div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 via-blue-500 to-cyan-400 text-white shadow-lg shadow-sky-500/30">
									<LayoutDashboard className="h-6 w-6" />
								</div>
								<div>
									<div className="flex flex-wrap items-center gap-2">
										<h1
											className={cn(
												"text-xl font-semibold tracking-tight sm:text-2xl",
												adminDark ? "text-white" : "text-slate-900",
											)}
										>
											Server / System / Infrastructure Management
										</h1>
										<Badge tone="live" darkMode={adminDark}>
											live
										</Badge>
									</div>
									<p className={cn("mt-1 text-sm", adminDark ? "text-slate-400" : "text-slate-500")}>
										Professional operations console with auditability, safety guards, and premium
										status surfaces.
									</p>
								</div>
							</div>

							<div className="flex flex-1 flex-col gap-3 xl:max-w-3xl xl:flex-row xl:items-center xl:justify-end">
								<div className="relative w-full xl:max-w-xl">
									<Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
									<input
										value={infraSearch}
										onChange={(event) => setInfraSearch(event.target.value)}
										placeholder="Search users, logs, rules, services, APIs..."
										className={cn(infraInputClass, "pl-11")}
									/>
								</div>
								<div className="flex items-center gap-3">
									<button
										type="button"
										onClick={toggleTheme}
										className={cn(
											"inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-medium transition",
											adminDark
												? "border-sky-400/20 bg-sky-500/10 text-sky-200 hover:bg-sky-500/15"
												: "border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100",
										)}
									>
										{adminDark ? <SunMedium className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
										{adminDark ? "Light mode" : "Dark mode"}
									</button>
								</div>
							</div>
						</div>
					</header>

					<div className="mb-6 grid gap-4 lg:grid-cols-4">
						<StatCard
							icon={Server}
							title="CPU"
							value={`${infra?.cpu?.cores || "--"} cores`}
							meta={`Usage: ${infra?.cpu?.usage_percent?.toFixed?.(0) || "0"}%`}
							tone="sky"
							darkMode={adminDark}
						/>
						<StatCard
							icon={Database}
							title="Memory"
							value={`${infra?.memory?.used_bytes ? formatNumber(Math.round(infra.memory.used_bytes / (1024 * 1024))) : "--"} MB used`}
							meta={`Free: ${infra?.memory?.free_bytes ? formatNumber(Math.round(infra.memory.free_bytes / (1024 * 1024))) : "--"} MB`}
							tone="blue"
							darkMode={adminDark}
						/>
						<StatCard
							icon={Users}
							title="Services"
							value={`${formatNumber(infra?.services?.length)}`}
							meta={`Processes: ${formatNumber(infra?.processes?.length)}`}
							tone="emerald"
							darkMode={adminDark}
						/>
						<StatCard
							icon={Database}
							title="Storage + I/O"
							value={`${formatNumber(infra?.storage?.length)} mounts`}
							meta={`Disk IOPS: ${infra?.io?.disk_iops ?? "--"} · Bandwidth: ${infra?.network?.bandwidth_mbps ?? "--"} Mbps`}
							tone="amber"
							darkMode={adminDark}
						/>
					</div>

					<div className="grid gap-6 xl:grid-cols-12">
						<div className="space-y-6 xl:col-span-8">
							<SectionCard
								title="System Overview"
								subtitle="CPU, memory, storage, and services pulled from infra adapters."
								icon={Activity}
								actionLabel="Refresh"
								onAction={() => refreshInfraAll()}
								darkMode={adminDark}
							>
								<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
									{[
										[
											"CPU",
											`${infra?.cpu?.cores || "--"} cores`,
											`Usage: ${infra?.cpu?.usage_percent?.toFixed?.(0) || "0"}%`,
										],
										[
											"Memory",
											`${infra?.memory?.used_bytes ? formatNumber(Math.round(infra.memory.used_bytes / (1024 * 1024))) : "--"} MB used`,
											`Free: ${infra?.memory?.free_bytes ? formatNumber(Math.round(infra.memory.free_bytes / (1024 * 1024))) : "--"} MB`,
										],
										[
											"Services",
											`${formatNumber(infra?.services?.length)}`,
											`Processes: ${formatNumber(infra?.processes?.length)}`,
										],
										[
											"Storage + I/O",
											`${formatNumber(infra?.storage?.length)} mounts`,
											`Disk IOPS: ${infra?.io?.disk_iops ?? "--"} · Bandwidth: ${infra?.network?.bandwidth_mbps ?? "--"} Mbps`,
										],
									].map(([label, value, meta]) => (
										<div key={label} className={infraFieldPanel}>
											<div className={adminDark ? "text-slate-400" : "text-slate-500"}>{label}</div>
											<div
												className={cn(
													"mt-2 text-2xl font-semibold",
													adminDark ? "text-white" : "text-slate-900",
												)}
											>
												{value}
											</div>
											<div
												className={
													adminDark ? "mt-1 text-sm text-slate-400" : "mt-1 text-sm text-slate-500"
												}
											>
												{meta}
											</div>
										</div>
									))}
								</div>
							</SectionCard>

							<div className="grid gap-6 md:grid-cols-2">
								<SectionCard
									title="Verification Queue"
									subtitle="EU/USA docs pending review."
									icon={ShieldCheck}
									actionLabel="Refresh"
									actionIcon={RefreshCw}
									onAction={() => refreshVerificationQueue()}
									darkMode={adminDark}
								>
									<div className="space-y-3">
										{verificationQueue.slice(0, 3).map((row) => (
											<div
												key={row.id || row.user_id}
												className={cn(
													"rounded-3xl border px-4 py-3 text-sm",
													adminDark
														? "border-slate-800 bg-slate-900/70 text-slate-400"
														: "border-slate-200 bg-slate-50 text-slate-600",
												)}
											>
												<div className={cn("font-medium", adminDark ? "text-white" : "text-slate-900")}>
													{row.user_name || row.user_email || row.user_id}
												</div>
												<div
													className={
														adminDark
															? "mt-1 text-xs text-slate-400"
															: "mt-1 text-xs text-slate-500"
													}
												>
													Doc: {row.doc_type || row.type || "business"} · Status:{" "}
													{row.status || "pending"}
												</div>
											</div>
										))}
										{verificationQueue.length > 0 ? null : (
											<div
												className={cn(
													"rounded-3xl border border-dashed p-5 text-sm",
													adminDark
														? "border-slate-800 bg-slate-900/70 text-slate-400"
														: "border-slate-200 bg-slate-50 text-slate-500",
												)}
											>
												{emptyCopy("verification.pending", "No pending verifications in queue.")}
											</div>
										)}
									</div>
								</SectionCard>

								<SectionCard
									title="Dispute Radar"
									subtitle="Contracts with open issues."
									icon={AlertTriangle}
									actionLabel="Sync"
									actionIcon={RefreshCw}
									onAction={() => refreshDisputes()}
									darkMode={adminDark}
								>
									<div className="space-y-3">
										{disputes.slice(0, 3).map((dispute) => (
											<div
												key={dispute.id}
												className={cn(
													"rounded-3xl border px-4 py-3 text-sm",
													adminDark
														? "border-slate-800 bg-slate-900/70 text-slate-400"
														: "border-slate-200 bg-slate-50 text-slate-600",
												)}
											>
												<div className={cn("font-medium", adminDark ? "text-white" : "text-slate-900")}>
													{dispute.title || dispute.contract_id || "Dispute"}
												</div>
												<div
													className={
														adminDark
															? "mt-1 text-xs text-slate-400"
															: "mt-1 text-xs text-slate-500"
													}
												>
													Status: {dispute.status || "open"} · Priority:{" "}
													{dispute.priority || "normal"}
												</div>
											</div>
										))}
										{disputes.length > 0 ? null : (
											<div
												className={cn(
													"rounded-3xl border border-dashed p-5 text-sm",
													adminDark
														? "border-slate-800 bg-slate-900/70 text-slate-400"
														: "border-slate-200 bg-slate-50 text-slate-500",
												)}
											>
												{emptyCopy("disputes.none", "No active disputes.")}
											</div>
										)}
									</div>
								</SectionCard>
							</div>

							<SectionCard
								title="Audit Pulse"
								subtitle="Most recent admin actions."
								icon={ShieldCheck}
								actionLabel="Refresh"
								actionIcon={RefreshCw}
								onAction={() => refreshAudit()}
								darkMode={adminDark}
							>
								<div className="space-y-3">
									{filteredInfraAuditRows.slice(0, 5).map((entry) => (
										<div
											key={entry.id || entry.at}
											className={cn(
												"flex items-center justify-between rounded-2xl border px-4 py-3",
												adminDark
													? "border-slate-800 bg-slate-900/60"
													: "border-slate-200 bg-white",
											)}
										>
											<div className="flex items-center gap-3">
												<div
													className={cn(
														"flex h-9 w-9 items-center justify-center rounded-2xl",
														adminDark ? "bg-sky-500/10 text-sky-300" : "bg-sky-50 text-sky-600",
													)}
												>
													<TerminalSquare className="h-4 w-4" />
												</div>
												<div>
													<div
														className={cn("font-medium", adminDark ? "text-white" : "text-slate-900")}
													>
														{entry.action || entry.path || "Admin action"}
													</div>
													<div
														className={adminDark ? "text-xs text-slate-400" : "text-xs text-slate-500"}
													>
														{entry.at ? new Date(entry.at).toLocaleString() : "--"} ·{" "}
														{entry.actor || "system"}
													</div>
												</div>
											</div>
											<Badge tone="info" darkMode={adminDark}>
												{entry.status ?? 200}
											</Badge>
										</div>
									))}
									{filteredInfraAuditRows.length > 0 ? null : (
										<div
											className={cn(
												"rounded-3xl border border-dashed p-5 text-sm",
												adminDark
													? "border-slate-800 bg-slate-900/70 text-slate-400"
													: "border-slate-200 bg-slate-50 text-slate-500",
											)}
										>
											No recent activity.
										</div>
									)}
								</div>
							</SectionCard>

							<div className="grid gap-6 md:grid-cols-2">
								<SectionCard
									title="Firewall Rules"
									subtitle="Safe presets for allow/deny."
									icon={Shield}
									actionLabel="Refresh"
									onAction={() => refreshInfraState()}
									darkMode={adminDark}
								>
									<div className="space-y-3">
										<div>
											<label
												className={cn(
													"mb-2 block text-xs font-medium uppercase tracking-[0.18em]",
													adminDark ? "text-slate-400" : "text-slate-500",
												)}
											>
												Preset
											</label>
											<div className="relative">
												<select
													value={`${firewallForm.action}:${firewallForm.port || ""}`}
													onChange={(event) => {
														const [actionValue, portValue] = event.target.value.split(":");
														setFirewallForm((prev) => ({
															...prev,
															action: actionValue,
															port: portValue || "",
															protocol: "tcp",
														}));
													}}
													className={cn(infraInputClass, "appearance-none pr-10")}
												>
													<option value="allow:">Preset (select)</option>
													<option value="allow:22">Allow SSH 22</option>
													<option value="allow:80">Allow HTTP 80</option>
													<option value="allow:443">Allow HTTPS 443</option>
													<option value="block:25">Block SMTP 25</option>
												</select>
												<ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
											</div>
										</div>
										<div className="grid grid-cols-2 gap-3">
											<div>
												<label
													className={cn(
														"mb-2 block text-xs font-medium uppercase tracking-[0.18em]",
														adminDark ? "text-slate-400" : "text-slate-500",
													)}
												>
													Port
												</label>
												<input
													value={firewallForm.port}
													onChange={(event) =>
														setFirewallForm((prev) => ({
															...prev,
															port: event.target.value,
														}))
													}
													placeholder="22"
													className={infraInputClass}
												/>
											</div>
											<div>
												<label
													className={cn(
														"mb-2 block text-xs font-medium uppercase tracking-[0.18em]",
														adminDark ? "text-slate-400" : "text-slate-500",
													)}
												>
													Protocol
												</label>
												<select
													value={firewallForm.protocol}
													onChange={(event) =>
														setFirewallForm((prev) => ({
															...prev,
															protocol: event.target.value,
														}))
													}
													className={infraInputClass}
												>
													<option value="tcp">tcp</option>
													<option value="udp">udp</option>
												</select>
											</div>
										</div>
										<div>
											<label
												className={cn(
													"mb-2 block text-xs font-medium uppercase tracking-[0.18em]",
													adminDark ? "text-slate-400" : "text-slate-500",
												)}
											>
												Description
											</label>
											<input
												value={firewallForm.description}
												onChange={(event) =>
													setFirewallForm((prev) => ({
														...prev,
														description: event.target.value,
													}))
												}
												placeholder="Allow ingress from trusted host"
												className={infraInputClass}
											/>
										</div>
										<button
											type="button"
											onClick={() =>
												runInfraAction(`firewall.${firewallForm.action}_port`, {
													port: firewallForm.port,
													protocol: firewallForm.protocol,
													description: firewallForm.description,
												})
											}
											className={cn(
												"w-full rounded-2xl px-4 py-3.5 text-sm font-semibold text-white transition",
												adminDark
													? "bg-gradient-to-r from-sky-500 to-cyan-400 shadow-lg shadow-sky-500/25"
													: "bg-sky-600 hover:bg-sky-500",
											)}
										>
											Apply rule
										</button>
										<div className="space-y-2">
											{(infraState?.firewall_rules || []).slice(0, 6).map((rule) => (
												<div
													key={rule.id}
													className={cn(
														"flex items-center justify-between rounded-2xl border px-4 py-3 text-sm",
														adminDark
															? "border-slate-800 bg-slate-900/60"
															: "border-slate-200 bg-white",
													)}
												>
													<div
														className={cn(
															"text-sm font-medium",
															adminDark ? "text-white" : "text-slate-900",
														)}
													>
														{rule.action} {rule.port}/{rule.protocol}
													</div>
													<button
														type="button"
														onClick={() =>
															runInfraAction("firewall.remove_rule", {
																rule_id: rule.id,
															})
														}
														className={cn(
															"inline-flex items-center gap-1 rounded-xl border px-3 py-1.5 text-xs font-semibold",
															adminDark
																? "border-rose-400/20 bg-rose-500/10 text-rose-300"
																: "border-rose-200 bg-rose-50 text-rose-700",
														)}
													>
														<Trash2 className="h-3.5 w-3.5" /> Remove
													</button>
												</div>
											))}
											{(infraState?.firewall_rules || []).length === 0 ? (
												<div
													className={cn(
														"rounded-2xl border border-dashed p-4 text-sm",
														adminDark
															? "border-slate-800 text-slate-400"
															: "border-slate-200 text-slate-500",
													)}
												>
													{emptyCopy("firewall.rules.none", "No rules yet.")}
												</div>
											) : null}
										</div>
									</div>
								</SectionCard>

								<SectionCard
									title="Package Updates"
									subtitle="Safe presets for update checks and installs."
									icon={Server}
									actionLabel="Run package action"
									actionIcon={Download}
									onAction={() =>
										runInfraAction("package.update", {
											mode: packageForm.mode,
											apply: packageForm.mode !== "check",
										})
									}
									darkMode={adminDark}
								>
									<div className="space-y-3">
										<div className="relative">
											<select
												value={packageForm.mode}
												onChange={(event) =>
													setPackageForm((prev) => ({
														...prev,
														mode: event.target.value,
														apply: event.target.value !== "check",
													}))
												}
												className={cn(infraInputClass, "appearance-none pr-10")}
											>
												<option value="check">Check updates (safe)</option>
												<option value="security">Apply security updates</option>
												<option value="all">Apply all updates</option>
											</select>
											<ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
										</div>
										<div className="grid gap-3 sm:grid-cols-2">
											<div className={infraFieldPanel}>
												<div
													className={cn(
														"flex items-center gap-2 text-sm font-medium",
														adminDark ? "text-white" : "text-slate-900",
													)}
												>
													<CheckCircle2 className="h-4 w-4 text-emerald-500" /> Safe check
												</div>
												<p
													className={
														adminDark
															? "mt-2 text-sm text-slate-400"
															: "mt-2 text-sm text-slate-500"
													}
												>
													Run controlled update scans without auto-installing risky packages.
												</p>
											</div>
											<div className={infraFieldPanel}>
												<div
													className={cn(
														"flex items-center gap-2 text-sm font-medium",
														adminDark ? "text-white" : "text-slate-900",
													)}
												>
													<ShieldCheck className="h-4 w-4 text-sky-500" /> Admin guard
												</div>
												<p
													className={
														adminDark
															? "mt-2 text-sm text-slate-400"
															: "mt-2 text-sm text-slate-500"
													}
												>
													Only verified operators may apply changes on production nodes.
												</p>
											</div>
										</div>
										<div
											className={cn(
												"rounded-2xl border border-dashed p-4 text-sm",
												adminDark
													? "border-slate-800 text-slate-400"
													: "border-slate-200 text-slate-500",
											)}
										>
											Last updates:{" "}
											{(infraState?.updates || [])
												.slice(0, 3)
												.map((row) => row.mode)
												.join(", ") || "none"}
										</div>
									</div>
								</SectionCard>
							</div>

							<div className="grid gap-6 md:grid-cols-2">
								<SectionCard
									title="Cron Manager"
									subtitle="Schedule safe recurring tasks."
									icon={Clock3}
									actionLabel="Add cron job"
									actionIcon={ArrowRight}
									onAction={() => runInfraAction("cron.add", cronForm)}
									darkMode={adminDark}
								>
									<div className="space-y-3">
										<div className="relative">
											<select
												value={cronForm.schedule}
												onChange={(event) => {
													const value = event.target.value;
													if (value === "0 2 * * *") {
														setCronForm({
															name: "Daily backup",
															schedule: value,
															command: "backup.run",
														});
													} else if (value === "0 0 * * 0") {
														setCronForm({
															name: "Weekly cleanup",
															schedule: value,
															command: "log.rotate",
														});
													} else {
														setCronForm((prev) => ({
															...prev,
															schedule: value,
														}));
													}
												}}
												className={cn(infraInputClass, "appearance-none pr-10")}
											>
												<option value="">Preset (select)</option>
												<option value="0 2 * * *">Daily backup at 2am</option>
												<option value="0 0 * * 0">Weekly cleanup (Sunday)</option>
											</select>
											<ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
										</div>
										<input
											value={cronForm.name}
											onChange={(event) =>
												setCronForm((prev) => ({
													...prev,
													name: event.target.value,
												}))
											}
											placeholder="Job name"
											className={infraInputClass}
										/>
										<input
											value={cronForm.schedule}
											onChange={(event) =>
												setCronForm((prev) => ({
													...prev,
													schedule: event.target.value,
												}))
											}
											placeholder="Cron schedule"
											className={infraInputClass}
										/>
										<input
											value={cronForm.command}
											onChange={(event) =>
												setCronForm((prev) => ({
													...prev,
													command: event.target.value,
												}))
											}
											placeholder="Command"
											className={infraInputClass}
										/>
										<div className="space-y-2">
											{(infraState?.cron_jobs || []).slice(0, 4).map((job) => (
												<div
													key={job.id}
													className={cn(
														"flex items-center justify-between rounded-2xl border px-4 py-3 text-sm",
														adminDark
															? "border-slate-800 bg-slate-900/60"
															: "border-slate-200 bg-white",
													)}
												>
													<div
														className={cn(
															"text-sm font-medium",
															adminDark ? "text-white" : "text-slate-900",
														)}
													>
														{job.name} · {job.schedule}
													</div>
													<button
														type="button"
														onClick={() =>
															runInfraAction("cron.remove", {
																job_id: job.id,
															})
														}
														className={cn(
															"inline-flex items-center gap-1 rounded-xl border px-3 py-1.5 text-xs font-semibold",
															adminDark
																? "border-rose-400/20 bg-rose-500/10 text-rose-300"
																: "border-rose-200 bg-rose-50 text-rose-700",
														)}
													>
														<Trash2 className="h-3.5 w-3.5" /> Remove
													</button>
												</div>
											))}
											{(infraState?.cron_jobs || []).length === 0 ? (
												<div
													className={cn(
														"rounded-2xl border border-dashed p-4 text-sm",
														adminDark
															? "border-slate-800 text-slate-400"
															: "border-slate-200 text-slate-500",
													)}
												>
													{emptyCopy("cron.jobs.none", "No cron jobs yet.")}
												</div>
											) : null}
										</div>
									</div>
								</SectionCard>

								<SectionCard
									title="System Logs + Zombie Scan"
									subtitle="Syslog snapshots and zombie detection."
									icon={AlertTriangle}
									actionLabel="Collect logs"
									actionIcon={RefreshCw}
									onAction={() =>
										runInfraAction("log.collect", {
											level: "info",
											message: "Manual log snapshot",
										})
									}
									darkMode={adminDark}
								>
									<div className="space-y-3">
										<button
											type="button"
											onClick={() => runInfraAction("process.scan_zombies")}
											className={cn(
												"w-full rounded-2xl px-4 py-3 text-sm font-semibold transition",
												adminDark
													? "border border-sky-400/20 bg-sky-500/10 text-sky-200 hover:bg-sky-500/15"
													: "border border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100",
											)}
										>
											Scan zombies
										</button>
										<div className="grid gap-3 sm:grid-cols-2">
											<div className={infraFieldPanel}>
												<div
													className={
														adminDark
															? "text-xs uppercase tracking-[0.2em] text-slate-400"
															: "text-xs uppercase tracking-[0.2em] text-slate-500"
													}
												>
													Log integrity
												</div>
												<div
													className={cn(
														"mt-2 flex items-center gap-2 text-sm font-medium",
														adminDark ? "text-white" : "text-slate-900",
													)}
												>
													<Lock className="h-4 w-4 text-emerald-500" /> Tamper-evident
												</div>
											</div>
											<div className={infraFieldPanel}>
												<div
													className={
														adminDark
															? "text-xs uppercase tracking-[0.2em] text-slate-400"
															: "text-xs uppercase tracking-[0.2em] text-slate-500"
													}
												>
													Zombie scan
												</div>
												<div
													className={cn(
														"mt-2 flex items-center gap-2 text-sm font-medium",
														adminDark ? "text-white" : "text-slate-900",
													)}
												>
													{(infraState?.zombie_processes || []).length > 0 ? (
														<>
															<XCircle className="h-4 w-4 text-rose-500" />{" "}
															{(infraState?.zombie_processes || []).length} anomalies
														</>
													) : (
														<>
															<CheckCircle2 className="h-4 w-4 text-sky-500" /> No anomalies
														</>
													)}
												</div>
											</div>
										</div>
										<div className="space-y-2">
											{(infraState?.logs || []).slice(0, 4).map((log) => (
												<div
													key={log.id}
													className={cn(
														"rounded-2xl border px-4 py-3 text-sm",
														adminDark
															? "border-slate-800 bg-slate-900/60 text-slate-300"
															: "border-slate-200 bg-white text-slate-700",
													)}
												>
													{log.level || "info"} · {log.message}
												</div>
											))}
											{(infraState?.zombie_processes || []).slice(0, 2).map((proc) => (
												<div
													key={proc.pid}
													className={cn(
														"rounded-2xl border px-4 py-3 text-sm",
														adminDark
															? "border-rose-400/20 bg-rose-500/10 text-rose-300"
															: "border-rose-200 bg-rose-50 text-rose-700",
													)}
												>
													Zombie: {proc.name} ({proc.pid})
												</div>
											))}
											{(infraState?.logs || []).length === 0 ? (
												<div
													className={cn(
														"rounded-2xl border border-dashed p-4 text-sm",
														adminDark
															? "border-slate-800 text-slate-400"
															: "border-slate-200 text-slate-500",
													)}
												>
													No logs collected yet.
												</div>
											) : null}
										</div>
									</div>
								</SectionCard>
							</div>
						</div>

						<div className="space-y-6 xl:col-span-4">
							<SectionCard
								title="OS Users + SSH Keys"
								subtitle="Create/delete accounts and manage keys."
								icon={Users}
								actionLabel="Manage access"
								actionIcon={Shield}
								onAction={() => refreshInfraState()}
								darkMode={adminDark}
							>
								<div className="space-y-3">
									<input
										value={osUserForm.username}
										onChange={(event) =>
											setOsUserForm((prev) => ({
												...prev,
												username: event.target.value,
											}))
										}
										placeholder="Username"
										className={infraInputClass}
									/>
									<button
										type="button"
										onClick={() =>
											runInfraAction("os.user.create", {
												username: osUserForm.username,
												role: osUserForm.role,
											})
										}
										className={cn(
											"w-full rounded-2xl px-4 py-3 text-sm font-semibold text-white",
											adminDark ? "bg-gradient-to-r from-sky-500 to-blue-500" : "bg-sky-600",
										)}
									>
										Create OS user
									</button>
									<input
										value={sshKeyForm.label}
										onChange={(event) =>
											setSshKeyForm((prev) => ({
												...prev,
												label: event.target.value,
											}))
										}
										placeholder="SSH key label"
										className={infraInputClass}
									/>
									<input
										value={sshKeyForm.fingerprint}
										onChange={(event) =>
											setSshKeyForm((prev) => ({
												...prev,
												fingerprint: event.target.value,
											}))
										}
										placeholder="Fingerprint"
										className={infraInputClass}
									/>
									<button
										type="button"
										onClick={() => runInfraAction("ssh.key.add", sshKeyForm)}
										className={cn(
											"w-full rounded-2xl border px-4 py-3 text-sm font-semibold",
											adminDark
												? "border-sky-400/20 bg-sky-500/10 text-sky-200"
												: "border-sky-200 bg-sky-50 text-sky-700",
										)}
									>
										Add SSH key
									</button>

									<div className="space-y-2 pt-2">
										{(infraState?.os_users || []).slice(0, 4).map((userRow) => (
											<div
												key={userRow.id}
												className={cn(
													"flex items-center justify-between rounded-2xl border px-4 py-3",
													adminDark
														? "border-slate-800 bg-slate-900/60"
														: "border-slate-200 bg-white",
												)}
											>
												<div
													className={cn(
														"flex items-center gap-2 text-sm font-medium",
														adminDark ? "text-white" : "text-slate-900",
													)}
												>
													<Shield className="h-4 w-4 text-sky-500" /> {userRow.username}
												</div>
												<button
													type="button"
													onClick={() =>
														runInfraAction("os.user.delete", {
															username: userRow.username,
														})
													}
													className={cn(
														"inline-flex items-center gap-1 rounded-xl border px-3 py-1.5 text-xs font-semibold",
														adminDark
															? "border-rose-400/20 bg-rose-500/10 text-rose-300"
															: "border-rose-200 bg-rose-50 text-rose-700",
													)}
												>
													<Trash2 className="h-3.5 w-3.5" /> Delete
												</button>
											</div>
										))}
										{(infraState?.ssh_keys || []).slice(0, 3).map((key) => (
											<div
												key={key.id}
												className={cn(
													"flex items-center justify-between rounded-2xl border px-4 py-3",
													adminDark
														? "border-slate-800 bg-slate-900/60"
														: "border-slate-200 bg-white",
												)}
											>
												<div
													className={cn(
														"flex items-center gap-2 text-sm font-medium",
														adminDark ? "text-white" : "text-slate-900",
													)}
												>
													<LockKeyhole className="h-4 w-4 text-sky-500" /> {key.label}
												</div>
												<button
													type="button"
													onClick={() =>
														runInfraAction("ssh.key.remove", {
															key_id: key.id,
														})
													}
													className={cn(
														"inline-flex items-center gap-1 rounded-xl border px-3 py-1.5 text-xs font-semibold",
														adminDark
															? "border-rose-400/20 bg-rose-500/10 text-rose-300"
															: "border-rose-200 bg-rose-50 text-rose-700",
													)}
												>
													<Trash2 className="h-3.5 w-3.5" /> Remove
												</button>
											</div>
										))}
										{(infraState?.os_users || []).length === 0 &&
										(infraState?.ssh_keys || []).length === 0 ? (
											<div
												className={cn(
													"rounded-2xl border border-dashed p-4 text-sm",
													adminDark
														? "border-slate-800 text-slate-400"
														: "border-slate-200 text-slate-500",
												)}
											>
												No OS users or SSH keys found.
											</div>
										) : null}
									</div>
								</div>
							</SectionCard>

							<SectionCard
								title="SSL + Backups + Network Settings"
								subtitle="Certificates, retention, DNS, timezone."
								icon={Wifi}
								actionLabel="Save settings"
								actionIcon={SlidersHorizontal}
								onAction={async () => {
									if (sslForm.domain) {
										await runInfraAction("ssl.cert.issue", {
											domain: sslForm.domain,
										});
									}
									if (infraBackupForm.retention_days) {
										await runInfraAction("backup.retention", {
											retention_days: infraBackupForm.retention_days,
										});
									}
									if (timeForm.timezone) {
										await runInfraAction("system.timezone.set", {
											timezone: timeForm.timezone,
										});
									}
								}}
								darkMode={adminDark}
							>
								<div className="space-y-3">
									<input
										value={sslForm.domain}
										onChange={(event) =>
											setSslForm((prev) => ({
												...prev,
												domain: event.target.value,
											}))
										}
										placeholder="Domain"
										className={infraInputClass}
									/>
									<button
										type="button"
										onClick={() =>
											runInfraAction("ssl.cert.issue", {
												domain: sslForm.domain,
											})
										}
										className={cn(
											"w-full rounded-2xl px-4 py-3 text-sm font-semibold text-white",
											adminDark ? "bg-gradient-to-r from-sky-500 to-cyan-400" : "bg-sky-600",
										)}
									>
										Issue SSL cert
									</button>
									<div className="grid grid-cols-2 gap-3">
										<input
											value={infraBackupForm.retention_days}
											onChange={(event) =>
												setInfraBackupForm((prev) => ({
													...prev,
													retention_days: event.target.value,
												}))
											}
											placeholder="Retention days"
											className={infraInputClass}
										/>
										<button
											type="button"
											onClick={() =>
												runInfraAction("backup.retention", {
													retention_days: infraBackupForm.retention_days,
												})
											}
											className={cn(
												"rounded-2xl border px-4 py-3 text-sm font-semibold",
												adminDark
													? "border-sky-400/20 bg-sky-500/10 text-sky-200"
													: "border-sky-200 bg-sky-50 text-sky-700",
											)}
										>
											Update retention
										</button>
									</div>
									<input
										value={timeForm.timezone}
										onChange={(event) =>
											setTimeForm((prev) => ({
												...prev,
												timezone: event.target.value,
											}))
										}
										placeholder="Timezone (e.g. UTC)"
										className={infraInputClass}
									/>
									<button
										type="button"
										onClick={() =>
											runInfraAction("system.timezone.set", {
												timezone: timeForm.timezone,
											})
										}
										className={cn(
											"w-full rounded-2xl border px-4 py-3 text-sm font-semibold",
											adminDark
												? "border-sky-400/20 bg-sky-500/10 text-sky-200"
												: "border-sky-200 bg-sky-50 text-sky-700",
										)}
									>
										Set timezone
									</button>
									<div
										className={cn(
											"rounded-2xl p-4 text-sm",
											adminDark
												? "border border-slate-800 bg-slate-900/60 text-slate-400"
												: "border border-slate-200 bg-slate-50 text-slate-600",
										)}
									>
										<div className="flex items-center justify-between gap-4">
											<span>
												Retention: {infraState?.backups?.retention_days || 0} days · SSLs:{" "}
												{(infraState?.ssl_certs || []).length}
											</span>
											<span
												className={adminDark ? "font-medium text-white" : "font-medium text-slate-900"}
											>
												Timezone: {infraState?.time_settings?.timezone || "unset"}
											</span>
										</div>
										<div className="mt-2 text-xs">
											NTP sync: {infraState?.time_settings?.last_sync_at || "never"}
										</div>
									</div>
								</div>
							</SectionCard>

							<SectionCard
								title="Admin Audit Log"
								subtitle="Immutable, tamper-evident audit trail for every admin action."
								icon={ShieldCheck}
								actionLabel="Refresh log"
								actionIcon={RefreshCw}
								onAction={() => refreshAudit()}
								darkMode={adminDark}
							>
								<div className="space-y-3">
									{filteredInfraAuditRows.slice(0, 8).map((entry) => (
										<div
											key={entry.id || entry.at}
											className={cn(
												"rounded-2xl border p-4",
												adminDark
													? "border-slate-800 bg-slate-900/60"
													: "border-slate-200 bg-white",
											)}
										>
											<div className="flex items-start justify-between gap-3">
												<div>
													<div
														className={cn("font-medium", adminDark ? "text-white" : "text-slate-900")}
													>
														{entry.action || entry.path || "Admin action"}
													</div>
													<div
														className={
															adminDark
																? "mt-1 text-xs text-slate-400"
																: "mt-1 text-xs text-slate-500"
														}
													>
														{entry.at ? new Date(entry.at).toLocaleString() : "--"} ·{" "}
														{entry.actor || "system"}
													</div>
												</div>
												<Badge tone="live" darkMode={adminDark}>
													{entry.status ?? 200}
												</Badge>
											</div>
											<div
												className={
													adminDark
														? "mt-3 grid gap-1 text-xs text-slate-400"
														: "mt-3 grid gap-1 text-xs text-slate-500"
												}
											>
												<div>Actor: {entry.actor_id || entry.actor || "system"}</div>
												<div>
													IP: {entry.ip || "--"} / Device: {entry.device_id || "--"}
												</div>
											</div>
										</div>
									))}
									{filteredInfraAuditRows.length > 0 ? null : (
										<div
											className={cn(
												"rounded-2xl border border-dashed p-4 text-sm",
												adminDark
													? "border-slate-800 text-slate-400"
													: "border-slate-200 text-slate-500",
											)}
										>
											No audit entries yet.
										</div>
									)}
								</div>
							</SectionCard>
						</div>
					</div>

					<div className="mt-6 grid gap-4 xl:grid-cols-5">
						{INFRA_CAPABILITIES.map((cap) => {
							const Icon = cap.icon;
							return (
								<div
									key={cap.title}
									className={cn(
										"rounded-[26px] border p-5",
										adminDark
											? "border-slate-800 bg-slate-950/70 shadow-[0_18px_70px_-36px_rgba(15,23,42,0.35)]"
											: "border-slate-200 bg-white shadow-sm",
									)}
								>
									<div className="flex items-start justify-between gap-3">
										<div
											className={cn(
												"rounded-2xl border p-3",
												adminDark
													? "border-sky-400/20 bg-sky-500/10 text-sky-300"
													: "border-sky-200 bg-sky-50 text-sky-600",
											)}
										>
											<Icon className="h-5 w-5" />
										</div>
										<Badge tone="live" darkMode={adminDark}>
											live
										</Badge>
									</div>
									<div
										className={cn(
											"mt-4 text-base font-semibold tracking-tight",
											adminDark ? "text-white" : "text-slate-900",
										)}
									>
										{cap.title}
									</div>
									<div
										className={cn(
											"mt-2 text-3xl font-semibold",
											adminDark ? "text-sky-300" : "text-sky-600",
										)}
									>
										{cap.count}
									</div>
									<p
										className={
											adminDark ? "mt-2 text-sm text-slate-400" : "mt-2 text-sm text-slate-500"
										}
									>
										{cap.subtitle}
									</p>
								</div>
							);
						})}
					</div>

					<footer
						className={cn(
							"mt-6 rounded-[28px] border px-5 py-4 text-sm",
							adminDark
								? "border-slate-800 bg-slate-950/70 text-slate-400 shadow-[0_18px_70px_-36px_rgba(15,23,42,0.3)]"
								: "border-slate-200 bg-white text-slate-500 shadow-sm",
						)}
					>
						<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
							<div className="flex items-center gap-2">
								<Server className="h-4 w-4 text-sky-500" /> Premium infrastructure control surface
							</div>
							<div className="flex items-center gap-2">
								<Sparkles className="h-4 w-4 text-cyan-400" /> Blue-sky themed • audit-first •
								responsive
							</div>
						</div>
					</footer>
				</div>
			</div>
		</div>
	);
}

export default AdminInfraSection;
