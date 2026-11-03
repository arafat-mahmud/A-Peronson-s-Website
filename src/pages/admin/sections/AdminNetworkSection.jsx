import {
	Activity,
	AlertTriangle,
	ArrowRight,
	ArrowUpRight,
	BadgeCheck,
	BarChart3,
	Bell,
	CheckCircle2,
	ChevronRight,
	CircuitBoard,
	Database,
	Download,
	Filter,
	Globe2,
	HardDrive,
	LayoutDashboard,
	Lock,
	Moon,
	Network,
	RefreshCw,
	Search,
	ShieldCheck,
	SlidersHorizontal,
	SunMedium,
	Users,
	Wifi,
} from "lucide-react";
import { useMemo } from "react";
import { cn } from "../../../lib/cn.js";

function downloadJson(filename, data) {
	const json = JSON.stringify(data, null, 2);
	const blob = new Blob([json], { type: "application/json" });
	const url = window.URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = filename;
	document.body.appendChild(link);
	link.click();
	link.remove();
	window.URL.revokeObjectURL(url);
}

export function AdminNetworkSection({
	adminDark,
	catalog,
	network,
	setNetwork,
	networkInventory,
	setNetworkInventory,
	networkQuery,
	setNetworkQuery,
	networkAuditQuery,
	setNetworkAuditQuery,
	networkNav,
	setNetworkNav,
	vlanForm,
	setVlanForm,
	ipamForm,
	setIpamForm,
	integrationStatus,
	setIntegrationStatus,
	backupForm,
	setBackupForm,
	buildAdminHeaders,
	apiRequest,
	getToken,
	formatNumber,
	error,
	setError,
	toggleTheme,
	audit = [],
	verificationQueue = [],
	disputes = [],
	refreshNetworkInventory,
	refreshVerificationQueue,
	refreshDisputes,
	refreshAudit,
	runNetworkAction,
	networkCapabilities = [],
}) {
	const emptyCopy = (_key, fallback) => fallback;

	const filteredNetworkDevices = useMemo(() => {
		const devices = Array.isArray(networkInventory?.devices) ? networkInventory.devices : [];
		const query = networkQuery.trim().toLowerCase();
		if (!query) {
			return devices;
		}
		return devices.filter((device) => {
			const value =
				`${device?.name || ""} ${device?.id || ""} ${device?.status || ""}`.toLowerCase();
			return value.includes(query);
		});
	}, [networkInventory, networkQuery]);

	const filteredNetworkAuditRows = useMemo(() => {
		const query = networkAuditQuery.trim().toLowerCase();
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
	}, [audit, networkAuditQuery]);

	return (
		<div
			className={cn(
				"relative overflow-hidden rounded-[32px] border p-4 sm:p-5",
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

			<div className="mx-auto max-w-[1600px] space-y-6">
				<section
					className={cn(
						"rounded-[32px] border p-5 shadow-2xl backdrop-blur-xl sm:p-6",
						adminDark ? "border-white/10 bg-white/5" : "border-slate-200 bg-white/75",
					)}
				>
					<div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
						<div className="flex items-center gap-4">
							<div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-cyan-400 text-white shadow-lg">
								<CircuitBoard className="h-6 w-6" />
							</div>
							<div>
								<h1
									className={cn(
										"text-2xl font-semibold",
										adminDark ? "text-white" : "text-slate-900",
									)}
								>
									Network Control
								</h1>
								<p className={cn("text-sm", adminDark ? "text-slate-400" : "text-slate-600")}>
									Enterprise monitoring, configuration, security, and audit
								</p>
							</div>
						</div>

						<button
							type="button"
							onClick={() => toggleTheme}
							className={cn(
								"inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm",
								adminDark ? "border-white/10 bg-white/5" : "border-slate-200 bg-white",
							)}
						>
							{adminDark ? <SunMedium className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
							Toggle Theme
						</button>
					</div>

					<div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
						{[
							{ id: "overview", label: "Overview", icon: LayoutDashboard },
							{ id: "inventory", label: "Inventory", icon: Wifi },
							{ id: "security", label: "Security", icon: Lock },
							{ id: "analytics", label: "Analytics", icon: BarChart3 },
							{ id: "audit", label: "Audit", icon: ShieldCheck },
							{ id: "users", label: "Users", icon: Users },
						].map(({ id, label, icon: Icon }) => (
							<button
								key={id}
								type="button"
								onClick={() => setNetworkNav(id)}
								className={cn(
									"flex items-center justify-between rounded-2xl px-4 py-3 text-sm transition",
									networkNav === id
										? "bg-sky-500 text-white"
										: adminDark
											? "bg-white/5 text-slate-100 hover:bg-white/10"
											: "bg-slate-100 text-slate-900 hover:bg-slate-200",
								)}
							>
								<span className="flex items-center gap-2">
									<Icon className="h-4 w-4" />
									{label}
								</span>
								<ChevronRight className="h-4 w-4 opacity-70" />
							</button>
						))}
					</div>

					<div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
						{["SLA 99.98%", "Security Green", "Latency Stable", "Infra Healthy"].map((item) => (
							<div
								key={item}
								className={cn(
									"rounded-2xl p-4 text-sm",
									adminDark ? "bg-white/5 text-slate-200" : "bg-slate-100 text-slate-800",
								)}
							>
								{item}
							</div>
						))}
					</div>
				</section>

				<section
					className={cn(
						"rounded-[32px] border p-5 shadow-2xl backdrop-blur-xl sm:p-6",
						adminDark ? "border-white/10 bg-white/5" : "border-slate-200 bg-white/75",
					)}
				>
					<div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
						<div className="max-w-3xl">
							<div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-[0.22em] text-sky-400 shadow-sm backdrop-blur-xl">
								<span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.9)]" />
								Network Monitoring & Management
								<span
									className={cn(
										"rounded-full px-2 py-0.5",
										adminDark ? "bg-white/10 text-slate-200" : "bg-slate-100 text-slate-700",
									)}
								>
									Enterprise Level
								</span>
							</div>
							<h2
								className={cn(
									"mt-4 text-3xl font-semibold tracking-tight sm:text-4xl",
									adminDark ? "text-white" : "text-slate-900",
								)}
							>
								Network Overview
							</h2>
							<p
								className={cn(
									"mt-3 max-w-2xl text-sm leading-7 sm:text-base",
									adminDark ? "text-slate-300" : "text-slate-600",
								)}
							>
								Topology status, alerts, and real-time diagnostics with premium visibility across
								devices, security, traffic, and audit history.
							</p>
						</div>

						<div className="flex flex-wrap items-center gap-3">
							<button
								type="button"
								onClick={toggleTheme}
								className={cn(
									"inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-medium transition-all",
									adminDark
										? "border-white/10 bg-white/5 hover:bg-white/10"
										: "border-slate-200 bg-white hover:bg-slate-50",
								)}
							>
								{adminDark ? <SunMedium className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
								{adminDark ? "Light mode" : "Dark mode"}
							</button>
							<button
								type="button"
								onClick={() =>
									downloadJson(`network_report_${new Date().toISOString().slice(0, 10)}.json`, {
										generated_at: new Date().toISOString(),
										summary: {
											device_total: network?.device_total,
											device_up: network?.device_up,
											device_down: network?.device_down,
											alert_count: network?.alert_count,
											vlan_count: networkInventory?.vlans?.length || 0,
											ipam_count: networkInventory?.ipam?.length || 0,
										},
										devices: Array.isArray(networkInventory?.devices)
											? networkInventory.devices.map((d) => ({
													name: d.name,
													type: d.type,
													status: d.status,
													ip: d.ip,
													mac: d.mac,
													uptime: d.uptime,
													firmware: d.firmware,
													last_seen: d.last_seen,
													switch_port: d.switch_port,
													vlan: d.vlan,
												}))
											: [],
										vlans: Array.isArray(networkInventory?.vlans) ? networkInventory.vlans : [],
										ipam: Array.isArray(networkInventory?.ipam) ? networkInventory.ipam : [],
										alerts: Array.isArray(networkInventory?.alerts)
											? networkInventory.alerts.map((a) => ({
													severity: a.severity,
													message: a.message,
													timestamp: a.timestamp,
													resolved: a.resolved,
													device: a.device,
												}))
											: [],
										traffic: networkInventory?.traffic || {},
										capabilities: Array.isArray(networkCapabilities) ? networkCapabilities : [],
										audit: Array.isArray(audit)
											? audit.slice(0, 100).map((e) => ({
													action: e.action,
													timestamp: e.created_at || e.timestamp,
													actor: e.actor,
													path: e.path,
													status: e.status,
													device_id: e.device_id,
												}))
											: [],
									})
								}
								className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-sky-500 to-cyan-400 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-500/30 transition-transform hover:-translate-y-0.5"
							>
								<Download className="h-4 w-4" />
								Export report
							</button>
						</div>
					</div>

					<div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
						{[
							{
								label: "Devices",
								value: formatNumber(network?.device_total),
								sub: `Up: ${formatNumber(network?.device_up)} / Down: ${formatNumber(network?.device_down)}`,
								icon: Network,
							},
							{
								label: "Alerts",
								value: formatNumber(network?.alert_count),
								sub: `Latency: ${network?.traffic_summary?.latency_ms ?? "--"} ms`,
								icon: AlertTriangle,
							},
							{
								label: "Jitter",
								value: `${network?.traffic_summary?.jitter_ms ?? "--"} ms`,
								sub: `Bandwidth: ${network?.traffic_summary?.bandwidth_mbps ?? "--"} Mbps`,
								icon: Activity,
							},
							{
								label: "Loss",
								value: `${network?.traffic_summary?.packet_loss_pct ?? "--"}%`,
								sub: "Topologies stable",
								icon: ShieldCheck,
							},
						].map((card) => {
							const Icon = card.icon;
							return (
								<div
									key={card.label}
									className={cn(
										"group rounded-[24px] border p-5 transition-all hover:-translate-y-0.5",
										adminDark
											? "border-white/10 bg-slate-900/50 hover:bg-slate-900/70"
											: "border-slate-200 bg-white hover:shadow-lg",
									)}
								>
									<div className="flex items-start justify-between gap-4">
										<div>
											<p className={cn("text-sm", adminDark ? "text-slate-400" : "text-slate-500")}>
												{card.label}
											</p>
											<div className="mt-2 flex items-end gap-2">
												<h3
													className={cn(
														"text-3xl font-semibold tracking-tight",
														adminDark ? "text-white" : "text-slate-900",
													)}
												>
													{card.value}
												</h3>
											</div>
											<p
												className={cn(
													"mt-2 text-sm",
													adminDark ? "text-slate-300" : "text-slate-600",
												)}
											>
												{card.sub}
											</p>
										</div>
										<div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-400 ring-1 ring-inset ring-sky-400/20">
											<Icon className="h-5 w-5" />
										</div>
									</div>
								</div>
							);
						})}
					</div>

					<div className="mt-6 grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
						<div
							className={cn(
								"rounded-[28px] border p-5",
								adminDark ? "border-white/10 bg-slate-900/50" : "border-slate-200 bg-white",
							)}
						>
							<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
								<div>
									<p className="text-xs uppercase tracking-[0.22em] text-sky-400">
										Device Inventory
									</p>
									<h3
										className={cn(
											"mt-1 text-xl font-semibold",
											adminDark ? "text-white" : "text-slate-900",
										)}
									>
										Realtime device status
									</h3>
								</div>
								<div className="flex gap-2">
									<button
										type="button"
										onClick={() => refreshNetworkInventory()}
										className={cn(
											"inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-medium",
											adminDark
												? "bg-white/5 hover:bg-white/10"
												: "bg-slate-100 hover:bg-slate-200",
										)}
									>
										<RefreshCw className="h-4 w-4" />
										Refresh
									</button>
									<div
										className={cn(
											"flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm",
											adminDark
												? "bg-emerald-500/10 text-emerald-300"
												: "bg-emerald-50 text-emerald-700",
										)}
									>
										<div className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.9)]" />
										Live data
									</div>
								</div>
							</div>

							<div className="mt-4">
								<div className="relative">
									<Search
										className={cn(
											"pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2",
											adminDark ? "text-slate-500" : "text-slate-400",
										)}
									/>
									<input
										value={networkQuery}
										onChange={(event) => setNetworkQuery(event.target.value)}
										placeholder="Search devices..."
										className={cn(
											"w-full rounded-2xl border py-3 pl-11 pr-4 text-sm outline-none transition-all",
											adminDark
												? "border-white/10 bg-slate-900/60 text-slate-100 placeholder:text-slate-500 focus:border-sky-400/60"
												: "border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:border-sky-400",
										)}
									/>
								</div>
							</div>

							<div className="mt-4 space-y-3">
								{filteredNetworkDevices.map((device) => {
									const status = String(device?.status || "").toLowerCase();
									const isUp = status === "up" || status === "online" || status === "healthy";
									return (
										<div
											key={device.id}
											className={cn(
												"flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between",
												adminDark
													? "border-white/10 bg-white/[0.03]"
													: "border-slate-200 bg-slate-50",
											)}
										>
											<div className="flex items-center gap-3">
												<div
													className={cn(
														"flex h-11 w-11 items-center justify-center rounded-2xl",
														adminDark ? "bg-sky-500/15 text-sky-400" : "bg-sky-100 text-sky-600",
													)}
												>
													<HardDrive className="h-5 w-5" />
												</div>
												<div>
													<p
														className={cn(
															"font-medium",
															adminDark ? "text-white" : "text-slate-900",
														)}
													>
														{device.name || device.id}
													</p>
													<div className="mt-1 flex items-center gap-2 text-sm">
														<span
															className={cn(
																"inline-flex items-center gap-1 rounded-full px-2.5 py-1",
																isUp
																	? "bg-emerald-500/10 text-emerald-400"
																	: adminDark
																		? "bg-rose-500/10 text-rose-300"
																		: "bg-rose-50 text-rose-700",
															)}
														>
															<span
																className={cn(
																	"h-1.5 w-1.5 rounded-full",
																	isUp ? "bg-emerald-400" : "bg-rose-500",
																)}
															/>
															{device.status || "unknown"}
														</span>
														<span className={adminDark ? "text-slate-400" : "text-slate-500"}>
															Stable link
														</span>
													</div>
												</div>
											</div>
											<button
												type="button"
												onClick={() =>
													runNetworkAction("device.reboot", {
														device_id: device.id,
													})
												}
												className={cn(
													"inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-medium transition-all",
													adminDark
														? "border-white/10 bg-white/5 hover:bg-white/10"
														: "border-slate-200 bg-white hover:bg-slate-100",
												)}
											>
												Reboot
												<ArrowRight className="h-4 w-4" />
											</button>
										</div>
									);
								})}
								{filteredNetworkDevices.length === 0 ? (
									<div
										className={cn(
											"rounded-2xl border border-dashed p-4 text-sm",
											adminDark
												? "border-white/10 text-slate-400"
												: "border-slate-200 text-slate-500",
										)}
									>
										No devices found.
									</div>
								) : null}
							</div>
						</div>

						<div
							className={cn(
								"rounded-[28px] border p-5",
								adminDark ? "border-white/10 bg-slate-900/50" : "border-slate-200 bg-white",
							)}
						>
							<div>
								<p className="text-xs uppercase tracking-[0.22em] text-sky-400">Quick Actions</p>
								<h3
									className={cn(
										"mt-1 text-xl font-semibold",
										adminDark ? "text-white" : "text-slate-900",
									)}
								>
									Operations toolkit
								</h3>
							</div>
							<div className="mt-4 space-y-3">
								{[
									{
										label: "VLAN Management",
										icon: Globe2,
										desc: "Create and retire VLANs.",
									},
									{
										label: "IPAM + Config Backups",
										icon: Database,
										desc: "Reserve IPs and capture configs.",
									},
									{
										label: "IDS/IPS + Rogue AP",
										icon: ShieldCheck,
										desc: "Security monitoring feeds.",
									},
									{
										label: "NetFlow + Alert Integrations",
										icon: Activity,
										desc: "Traffic analytics and alert sinks.",
									},
									{
										label: "Client Monitoring + Auth Servers",
										icon: Users,
										desc: "Connected clients and RADIUS/TACACS.",
									},
								].map((item) => {
									const Icon = item.icon;
									return (
										<div
											key={item.label}
											className={cn(
												"rounded-2xl border p-4",
												adminDark
													? "border-white/10 bg-white/[0.03]"
													: "border-slate-200 bg-slate-50",
											)}
										>
											<div className="flex items-start gap-3">
												<div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-400">
													<Icon className="h-4 w-4" />
												</div>
												<div className="min-w-0 flex-1">
													<p
														className={cn(
															"font-medium",
															adminDark ? "text-white" : "text-slate-900",
														)}
													>
														{item.label}
													</p>
													<p
														className={cn(
															"mt-1 text-sm",
															adminDark ? "text-slate-400" : "text-slate-600",
														)}
													>
														{item.desc}
													</p>
												</div>
												<ArrowUpRight
													className={cn("h-4 w-4", adminDark ? "text-slate-500" : "text-slate-400")}
												/>
											</div>
										</div>
									);
								})}
							</div>
						</div>
					</div>
				</section>

				<section className="grid gap-6 xl:grid-cols-2">
					<div
						className={cn(
							"rounded-[32px] border p-5 shadow-2xl backdrop-blur-xl sm:p-6",
							adminDark ? "border-white/10 bg-white/5" : "border-slate-200 bg-white/75",
						)}
					>
						<div className="flex items-start justify-between gap-3">
							<div>
								<p className="text-xs uppercase tracking-[0.22em] text-sky-400">VLAN Management</p>
								<h3
									className={cn(
										"mt-1 text-2xl font-semibold",
										adminDark ? "text-white" : "text-slate-900",
									)}
								>
									Create and retire VLANs
								</h3>
							</div>
							<BadgeCheck className="h-6 w-6 text-sky-400" />
						</div>
						<div className="mt-5 grid gap-3 sm:grid-cols-2">
							{[
								[
									"VLAN ID",
									vlanForm.vlan_id,
									(value) => setVlanForm((prev) => ({ ...prev, vlan_id: value })),
								],
								[
									"Name",
									vlanForm.name,
									(value) => setVlanForm((prev) => ({ ...prev, name: value })),
								],
								[
									"Subnet",
									vlanForm.subnet,
									(value) => setVlanForm((prev) => ({ ...prev, subnet: value })),
								],
								[
									"Gateway",
									vlanForm.gateway,
									(value) => setVlanForm((prev) => ({ ...prev, gateway: value })),
								],
							].map(([label, value, setter]) => (
								<div
									key={label}
									className={cn(
										"rounded-2xl border p-4",
										adminDark ? "border-white/10 bg-slate-900/50" : "border-slate-200 bg-slate-50",
									)}
								>
									<p
										className={cn(
											"text-xs uppercase tracking-[0.2em]",
											adminDark ? "text-slate-400" : "text-slate-500",
										)}
									>
										{label}
									</p>
									<input
										value={value}
										onChange={(event) => setter(event.target.value)}
										className={cn(
											"mt-2 w-full rounded-xl border px-3 py-2 text-sm outline-none",
											adminDark
												? "border-white/10 bg-white/5 text-white placeholder:text-slate-500 focus:border-sky-400/60"
												: "border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:border-sky-400",
										)}
									/>
								</div>
							))}
						</div>
						<button
							type="button"
							onClick={() => runNetworkAction("vlan.create", vlanForm)}
							className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-sky-500 to-cyan-400 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-500/30"
						>
							Add VLAN
							<ArrowRight className="h-4 w-4" />
						</button>
						<div className="mt-4 space-y-2">
							{(networkInventory?.vlans || []).slice(0, 6).map((vlan) => (
								<div
									key={vlan.id}
									className={cn(
										"flex items-center justify-between rounded-2xl border px-4 py-3",
										adminDark ? "border-white/10 bg-white/[0.03]" : "border-slate-200 bg-white",
									)}
								>
									<div
										className={cn(
											"text-sm font-medium",
											adminDark ? "text-white" : "text-slate-900",
										)}
									>
										VLAN {vlan.id} · {vlan.subnet}
									</div>
									<button
										type="button"
										onClick={() =>
											runNetworkAction("vlan.delete", {
												vlan_id: vlan.id,
											})
										}
										className={cn(
											"rounded-xl border px-3 py-1.5 text-xs font-semibold",
											adminDark
												? "border-rose-400/20 bg-rose-500/10 text-rose-300"
												: "border-rose-200 bg-rose-50 text-rose-700",
										)}
									>
										Delete
									</button>
								</div>
							))}
							{(networkInventory?.vlans || []).length === 0 ? (
								<div
									className={cn(
										"rounded-2xl border border-dashed p-4 text-sm",
										adminDark
											? "border-white/10 text-slate-400"
											: "border-slate-200 text-slate-500",
									)}
								>
									No VLANs yet.
								</div>
							) : null}
						</div>
					</div>

					<div
						className={cn(
							"rounded-[32px] border p-5 shadow-2xl backdrop-blur-xl sm:p-6",
							adminDark ? "border-white/10 bg-white/5" : "border-slate-200 bg-white/75",
						)}
					>
						<div className="flex items-start justify-between gap-3">
							<div>
								<p className="text-xs uppercase tracking-[0.22em] text-sky-400">
									IPAM + Config Backups
								</p>
								<h3
									className={cn(
										"mt-1 text-2xl font-semibold",
										adminDark ? "text-white" : "text-slate-900",
									)}
								>
									Reserve IPs and capture configs
								</h3>
							</div>
							<Lock className="h-6 w-6 text-sky-400" />
						</div>
						<div className="mt-5 grid gap-3 sm:grid-cols-2">
							{[
								[
									"IP address",
									ipamForm.ip,
									(value) => setIpamForm((prev) => ({ ...prev, ip: value })),
								],
								[
									"Owner",
									ipamForm.owner,
									(value) => setIpamForm((prev) => ({ ...prev, owner: value })),
								],
								[
									"Device ID for backup",
									backupForm.device_id,
									(value) => setBackupForm({ device_id: value }),
								],
							].map(([label, value, setter]) => (
								<div
									key={label}
									className={cn(
										"rounded-2xl border p-4",
										adminDark ? "border-white/10 bg-slate-900/50" : "border-slate-200 bg-slate-50",
									)}
								>
									<p
										className={cn(
											"text-xs uppercase tracking-[0.2em]",
											adminDark ? "text-slate-400" : "text-slate-500",
										)}
									>
										{label}
									</p>
									<input
										value={value}
										onChange={(event) => setter(event.target.value)}
										className={cn(
											"mt-2 w-full rounded-xl border px-3 py-2 text-sm outline-none",
											adminDark
												? "border-white/10 bg-white/5 text-white placeholder:text-slate-500 focus:border-sky-400/60"
												: "border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:border-sky-400",
										)}
									/>
								</div>
							))}
							<div
								className={cn(
									"rounded-2xl border p-4",
									adminDark ? "border-white/10 bg-slate-900/50" : "border-slate-200 bg-slate-50",
								)}
							>
								<p
									className={cn(
										"text-xs uppercase tracking-[0.2em]",
										adminDark ? "text-slate-400" : "text-slate-500",
									)}
								>
									Backup target
								</p>
								<p
									className={cn("mt-2 font-semibold", adminDark ? "text-white" : "text-slate-900")}
								>
									Encrypted vault
								</p>
							</div>
						</div>
						<div className="mt-4 flex flex-wrap gap-3">
							<button
								type="button"
								onClick={() => runNetworkAction("ipam.reserve", ipamForm)}
								className={cn(
									"rounded-2xl px-4 py-3 text-sm font-semibold",
									adminDark
										? "bg-white/5 hover:bg-white/10 text-white"
										: "bg-slate-100 hover:bg-slate-200 text-slate-900",
								)}
							>
								Reserve IP
							</button>
							<button
								type="button"
								onClick={() => runNetworkAction("config.backup", backupForm)}
								className="rounded-2xl bg-gradient-to-r from-sky-500 to-cyan-400 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-500/30"
							>
								Run config backup
							</button>
						</div>
						<div className="mt-4 space-y-2">
							{(networkInventory?.ipam_reservations || []).slice(0, 4).map((row) => (
								<div
									key={row.id}
									className={cn(
										"flex items-center justify-between rounded-2xl border px-4 py-3",
										adminDark ? "border-white/10 bg-white/[0.03]" : "border-slate-200 bg-white",
									)}
								>
									<div
										className={cn(
											"text-sm font-medium",
											adminDark ? "text-white" : "text-slate-900",
										)}
									>
										{row.ip} · {row.owner || "reserved"}
									</div>
									<button
										type="button"
										onClick={() => runNetworkAction("ipam.release", { ip: row.ip })}
										className={cn(
											"rounded-xl border px-3 py-1.5 text-xs font-semibold",
											adminDark
												? "border-rose-400/20 bg-rose-500/10 text-rose-300"
												: "border-rose-200 bg-rose-50 text-rose-700",
										)}
									>
										Release
									</button>
								</div>
							))}
							{(networkInventory?.config_backups || []).slice(0, 3).map((row) => (
								<div
									key={row.id}
									className={cn(
										"rounded-2xl border px-4 py-3 text-sm",
										adminDark
											? "border-white/10 bg-white/[0.03] text-slate-300"
											: "border-slate-200 bg-white text-slate-700",
									)}
								>
									Backup {row.device_id || "device"} · {row.created_at}
								</div>
							))}
							{(networkInventory?.ipam_reservations || []).length === 0 &&
							(networkInventory?.config_backups || []).length === 0 ? (
								<div
									className={cn(
										"rounded-2xl border border-dashed p-4 text-sm",
										adminDark
											? "border-white/10 text-slate-400"
											: "border-slate-200 text-slate-500",
									)}
								>
									No reservations or backups yet.
								</div>
							) : null}
						</div>
					</div>
				</section>

				<section
					className={cn(
						"rounded-[32px] border p-5 shadow-2xl backdrop-blur-xl sm:p-6",
						adminDark ? "border-white/10 bg-white/5" : "border-slate-200 bg-white/75",
					)}
				>
					<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
						<div>
							<p className="text-xs uppercase tracking-[0.22em] text-sky-400">
								Operational Surfaces
							</p>
							<h3
								className={cn(
									"mt-1 text-2xl font-semibold",
									adminDark ? "text-white" : "text-slate-900",
								)}
							>
								Security • Analytics • Users
							</h3>
						</div>
						<button
							type="button"
							onClick={() => refreshNetworkInventory()}
							className={cn(
								"inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-medium",
								adminDark ? "bg-white/5 hover:bg-white/10" : "bg-slate-100 hover:bg-slate-200",
							)}
						>
							<RefreshCw className="h-4 w-4" />
							Refresh
						</button>
					</div>
					<div className="mt-5 grid gap-4 md:grid-cols-3">
						<div
							className={cn(
								"rounded-[24px] border p-5",
								adminDark ? "border-white/10 bg-slate-900/50" : "border-slate-200 bg-white",
							)}
						>
							<p className="text-xs uppercase tracking-[0.22em] text-sky-400">IDS/IPS + Rogue AP</p>
							<p className={cn("mt-1 text-sm", adminDark ? "text-slate-400" : "text-slate-600")}>
								Security monitoring feeds.
							</p>
							<div
								className={cn(
									"mt-4 space-y-2 text-sm",
									adminDark ? "text-slate-300" : "text-slate-700",
								)}
							>
								{(networkInventory?.ids_alerts || []).slice(0, 3).map((alert) => (
									<div
										key={alert.id}
										className={cn(
											"rounded-2xl border px-4 py-3",
											adminDark
												? "border-white/10 bg-white/[0.03]"
												: "border-slate-200 bg-slate-50",
										)}
									>
										{alert.severity} · {alert.message}
									</div>
								))}
								{(networkInventory?.rogue_aps || []).slice(0, 2).map((ap) => (
									<div
										key={ap.id}
										className={cn(
											"rounded-2xl border px-4 py-3",
											adminDark
												? "border-rose-400/20 bg-rose-500/10 text-rose-300"
												: "border-rose-200 bg-rose-50 text-rose-700",
										)}
									>
										Rogue AP: {ap.ssid}
									</div>
								))}
								<div
									className={cn(
										"rounded-2xl border px-4 py-3 text-sm",
										adminDark
											? "border-white/10 bg-white/[0.03] text-slate-300"
											: "border-slate-200 bg-slate-50 text-slate-700",
									)}
								>
									Firmware jobs: {(networkInventory?.firmware_jobs || []).length} · Bulk config
									jobs: {(networkInventory?.bulk_config_jobs || []).length}
								</div>
							</div>
						</div>

						<div
							className={cn(
								"rounded-[24px] border p-5",
								adminDark ? "border-white/10 bg-slate-900/50" : "border-slate-200 bg-white",
							)}
						>
							<p className="text-xs uppercase tracking-[0.22em] text-sky-400">
								NetFlow + Alert Integrations
							</p>
							<p className={cn("mt-1 text-sm", adminDark ? "text-slate-400" : "text-slate-600")}>
								Traffic analytics and alert sinks.
							</p>
							<div
								className={cn(
									"mt-4 space-y-2 text-sm",
									adminDark ? "text-slate-300" : "text-slate-700",
								)}
							>
								{(networkInventory?.flow_stats || []).slice(0, 2).map((flow) => (
									<div
										key={flow.id}
										className={cn(
											"rounded-2xl border px-4 py-3",
											adminDark
												? "border-white/10 bg-white/[0.03]"
												: "border-slate-200 bg-slate-50",
										)}
									>
										Flows: {flow.total_flows}
									</div>
								))}
								{(networkInventory?.alert_integrations || []).slice(0, 2).map((integration) => (
									<div
										key={integration.id}
										className={cn(
											"rounded-2xl border px-4 py-3",
											adminDark
												? "border-white/10 bg-white/[0.03]"
												: "border-slate-200 bg-slate-50",
										)}
									>
										{integration.type}: {integration.target}
									</div>
								))}
								<div
									className={cn(
										"rounded-2xl border px-4 py-3 text-sm",
										adminDark
											? "border-white/10 bg-white/[0.03] text-slate-300"
											: "border-slate-200 bg-slate-50 text-slate-700",
									)}
								>
									Config audits: {(networkInventory?.config_audit || []).length} · QoS policies:{" "}
									{(networkInventory?.qos_policies || []).length}
								</div>
								<div
									className={cn(
										"rounded-2xl border px-4 py-3 text-sm",
										adminDark
											? "border-white/10 bg-white/[0.03] text-slate-300"
											: "border-slate-200 bg-slate-50 text-slate-700",
									)}
								>
									Traffic shaping: {(networkInventory?.traffic_shapes || []).length} · Restore jobs:{" "}
									{(networkInventory?.config_restore_jobs || []).length}
								</div>
							</div>
						</div>

						<div
							className={cn(
								"rounded-[24px] border p-5",
								adminDark ? "border-white/10 bg-slate-900/50" : "border-slate-200 bg-white",
							)}
						>
							<p className="text-xs uppercase tracking-[0.22em] text-sky-400">
								Client Monitoring + Auth Servers
							</p>
							<p className={cn("mt-1 text-sm", adminDark ? "text-slate-400" : "text-slate-600")}>
								Connected clients and RADIUS/TACACS.
							</p>
							<div
								className={cn(
									"mt-4 space-y-2 text-sm",
									adminDark ? "text-slate-300" : "text-slate-700",
								)}
							>
								{(networkInventory?.clients || []).slice(0, 3).map((client) => (
									<div
										key={client.id}
										className={cn(
											"rounded-2xl border px-4 py-3",
											adminDark
												? "border-white/10 bg-white/[0.03]"
												: "border-slate-200 bg-slate-50",
										)}
									>
										{client.ip || client.mac} · {client.status || "online"}
									</div>
								))}
								{(networkInventory?.auth_servers || []).slice(0, 2).map((srv) => (
									<div
										key={srv.id}
										className={cn(
											"rounded-2xl border px-4 py-3",
											adminDark
												? "border-white/10 bg-white/[0.03]"
												: "border-slate-200 bg-slate-50",
										)}
									>
										{srv.type}: {srv.host}
									</div>
								))}
								<div
									className={cn(
										"rounded-2xl border px-4 py-3 text-sm",
										adminDark
											? "border-white/10 bg-white/[0.03] text-slate-300"
											: "border-slate-200 bg-slate-50 text-slate-700",
									)}
								>
									Active tunnels: {(networkInventory?.tunnels || []).length} · VPN tunnels:{" "}
									{(networkInventory?.vpn_tunnels || []).length}
								</div>
								<div
									className={cn(
										"rounded-2xl border px-4 py-3 text-sm",
										adminDark
											? "border-white/10 bg-white/[0.03] text-slate-300"
											: "border-slate-200 bg-slate-50 text-slate-700",
									)}
								>
									Firewall policies: {(networkInventory?.firewall_policies || []).length}
								</div>
							</div>
						</div>
					</div>
				</section>

				<section
					className={cn(
						"rounded-[32px] border p-5 shadow-2xl backdrop-blur-xl sm:p-6",
						adminDark ? "border-white/10 bg-white/5" : "border-slate-200 bg-white/75",
					)}
				>
					<div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
						<div>
							<p className="text-xs uppercase tracking-[0.22em] text-sky-400">
								Network Capabilities
							</p>
							<h3
								className={cn(
									"mt-1 text-2xl font-semibold",
									adminDark ? "text-white" : "text-slate-900",
								)}
							>
								6 capability groups
							</h3>
						</div>
						<div className="flex items-center gap-3">
							<div
								className={cn(
									"flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium",
									adminDark
										? "bg-emerald-500/10 text-emerald-300"
										: "bg-emerald-50 text-emerald-700",
								)}
							>
								<span className="h-2 w-2 rounded-full bg-emerald-400" />
								live
							</div>
							<button
								type="button"
								className={cn(
									"inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-medium",
									adminDark ? "bg-white/5 hover:bg-white/10" : "bg-slate-100 hover:bg-slate-200",
								)}
							>
								<Filter className="h-4 w-4" />
								Filter
							</button>
							<button
								type="button"
								className={cn(
									"inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-medium",
									adminDark ? "bg-white/5 hover:bg-white/10" : "bg-slate-100 hover:bg-slate-200",
								)}
							>
								<SlidersHorizontal className="h-4 w-4" />
								Sort
							</button>
						</div>
					</div>

					<div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
						{(Array.isArray(networkCapabilities) && networkCapabilities.length > 0
							? networkCapabilities
							: []
						).length > 0
							? (Array.isArray(networkCapabilities) && networkCapabilities.length > 0
									? networkCapabilities
									: []
								).map((section) => (
									<div
										key={section.title}
										className={cn(
											"rounded-[24px] border p-5",
											adminDark ? "border-white/10 bg-slate-900/50" : "border-slate-200 bg-white",
										)}
									>
										<div className="flex items-start justify-between gap-3">
											<div>
												<p className="text-xs uppercase tracking-[0.2em] text-sky-400">live</p>
												<h4
													className={cn(
														"mt-1 text-lg font-semibold",
														adminDark ? "text-white" : "text-slate-900",
													)}
												>
													{section.title}
												</h4>
											</div>
											<div
												className={cn(
													"rounded-2xl px-3 py-1.5 text-sm font-semibold",
													adminDark ? "bg-sky-500/10 text-sky-300" : "bg-sky-50 text-sky-700",
												)}
											>
												{section.count} capabilities
											</div>
										</div>
										<ul
											className={cn(
												"mt-4 space-y-2 text-sm",
												adminDark ? "text-slate-300" : "text-slate-600",
											)}
										>
											{section.items.map((item) => (
												<li key={item} className="flex items-center gap-2">
													<CheckCircle2 className="h-4 w-4 text-sky-400" />
													{item}
												</li>
											))}
										</ul>
									</div>
								))
							: null}
					</div>
				</section>

				<section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
					<div
						className={cn(
							"rounded-[32px] border p-5 shadow-2xl backdrop-blur-xl sm:p-6",
							adminDark ? "border-white/10 bg-white/5" : "border-slate-200 bg-white/75",
						)}
					>
						<div className="flex items-start justify-between gap-3">
							<div>
								<p className="text-xs uppercase tracking-[0.22em] text-sky-400">
									Verification Queue
								</p>
								<h3
									className={cn(
										"mt-1 text-2xl font-semibold",
										adminDark ? "text-white" : "text-slate-900",
									)}
								>
									EU/USA docs pending review
								</h3>
							</div>
							<Bell className="h-6 w-6 text-sky-400" />
						</div>
						<div
							className={cn(
								"mt-5 rounded-[24px] border p-5",
								adminDark ? "border-white/10 bg-slate-900/50" : "border-slate-200 bg-white",
							)}
						>
							{verificationQueue.length > 0 ? (
								<div className="space-y-2">
									{verificationQueue.slice(0, 4).map((row) => (
										<div
											key={row.id || row.user_id}
											className={cn(
												"rounded-2xl border px-4 py-3 text-sm",
												adminDark
													? "border-white/10 bg-white/[0.03]"
													: "border-slate-200 bg-slate-50",
											)}
										>
											<div
												className={cn("font-medium", adminDark ? "text-white" : "text-slate-900")}
											>
												{row.user_name || row.user_email || row.user_id}
											</div>
											<div
												className={cn(
													"mt-1 text-xs",
													adminDark ? "text-slate-400" : "text-slate-600",
												)}
											>
												Doc: {row.doc_type || row.type || "business"} · Status:{" "}
												{row.status || "pending"}
											</div>
										</div>
									))}
								</div>
							) : (
								<p className={cn("text-sm", adminDark ? "text-slate-300" : "text-slate-600")}>
									{emptyCopy("verification.pending", "No pending verifications in queue.")}
								</p>
							)}
							<button
								type="button"
								onClick={() => refreshVerificationQueue()}
								className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-sky-500 to-cyan-400 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-500/30"
							>
								Refresh
								<RefreshCw className="h-4 w-4" />
							</button>
						</div>

						<div className="mt-4 space-y-3">
							<div
								className={cn(
									"rounded-2xl border p-4",
									adminDark ? "border-white/10 bg-white/[0.03]" : "border-slate-200 bg-slate-50",
								)}
							>
								<div className="flex items-center justify-between gap-3">
									<h4 className={cn("font-medium", adminDark ? "text-white" : "text-slate-900")}>
										Dispute Radar
									</h4>
									<button
										type="button"
										onClick={() => refreshDisputes()}
										className="inline-flex items-center gap-2 text-sm text-sky-400"
									>
										Sync
										<ArrowRight className="h-4 w-4" />
									</button>
								</div>
								{disputes.length > 0 ? (
									<div className="mt-2 space-y-2">
										{disputes.slice(0, 3).map((dispute) => (
											<div
												key={dispute.id}
												className={cn(
													"rounded-2xl border px-4 py-3 text-sm",
													adminDark
														? "border-white/10 bg-slate-900/50 text-slate-300"
														: "border-slate-200 bg-white text-slate-700",
												)}
											>
												{dispute.title || dispute.contract_id || "Dispute"} ·{" "}
												{dispute.status || "open"}
											</div>
										))}
									</div>
								) : (
									<p
										className={cn("mt-2 text-sm", adminDark ? "text-slate-400" : "text-slate-600")}
									>
										{emptyCopy("disputes.none", "No active disputes.")}
									</p>
								)}
							</div>
						</div>
					</div>

					<div
						className={cn(
							"rounded-[32px] border p-5 shadow-2xl backdrop-blur-xl sm:p-6",
							adminDark ? "border-white/10 bg-white/5" : "border-slate-200 bg-white/75",
						)}
					>
						<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
							<div>
								<p className="text-xs uppercase tracking-[0.22em] text-sky-400">Audit Pulse</p>
								<h3
									className={cn(
										"mt-1 text-2xl font-semibold",
										adminDark ? "text-white" : "text-slate-900",
									)}
								>
									Most recent admin actions
								</h3>
							</div>
							<button
								type="button"
								onClick={() => refreshAudit()}
								className={cn(
									"inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-medium",
									adminDark ? "bg-white/5 hover:bg-white/10" : "bg-slate-100 hover:bg-slate-200",
								)}
							>
								<RefreshCw className="h-4 w-4" />
								Refresh
							</button>
						</div>
						<div className="mt-5 grid gap-3 lg:grid-cols-2">
							{filteredNetworkAuditRows.slice(0, 6).map((entry) => (
								<div
									key={entry.id || entry.at}
									className={cn(
										"rounded-2xl border p-4",
										adminDark ? "border-white/10 bg-slate-900/50" : "border-slate-200 bg-white",
									)}
								>
									<div className="flex items-center justify-between gap-3">
										<p className={cn("font-medium", adminDark ? "text-white" : "text-slate-900")}>
											{entry.path || entry.action || "Admin action"}
										</p>
										<span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-400">
											{entry.status ?? 200}
										</span>
									</div>
									<p
										className={cn("mt-2 text-sm", adminDark ? "text-slate-400" : "text-slate-600")}
									>
										{entry.at ? new Date(entry.at).toLocaleString() : "--"} · system
									</p>
								</div>
							))}
							{filteredNetworkAuditRows.length > 0 ? null : (
								<div
									className={cn(
										"rounded-2xl border border-dashed p-4 text-sm",
										adminDark
											? "border-white/10 text-slate-400"
											: "border-slate-200 text-slate-500",
									)}
								>
									No recent activity.
								</div>
							)}
						</div>
					</div>
				</section>

				<section
					className={cn(
						"rounded-[32px] border p-5 shadow-2xl backdrop-blur-xl sm:p-6",
						adminDark ? "border-white/10 bg-white/5" : "border-slate-200 bg-white/75",
					)}
				>
					<div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
						<div>
							<p className="text-xs uppercase tracking-[0.22em] text-sky-400">Admin Audit Log</p>
							<h3
								className={cn(
									"mt-1 text-2xl font-semibold",
									adminDark ? "text-white" : "text-slate-900",
								)}
							>
								Immutable, tamper-evident audit trail
							</h3>
						</div>
						<div className="relative w-full max-w-md">
							<Search
								className={cn(
									"pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2",
									adminDark ? "text-slate-500" : "text-slate-400",
								)}
							/>
							<input
								value={networkAuditQuery}
								onChange={(event) => setNetworkAuditQuery(event.target.value)}
								placeholder="Search audit..."
								className={cn(
									"w-full rounded-2xl border py-3 pl-11 pr-4 text-sm outline-none transition-all",
									adminDark
										? "border-white/10 bg-slate-900/60 text-slate-100 placeholder:text-slate-500 focus:border-sky-400/60"
										: "border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:border-sky-400",
								)}
							/>
						</div>
					</div>

					<div
						className={cn(
							"mt-5 overflow-hidden rounded-[24px] border",
							adminDark ? "border-white/10" : "border-slate-200",
						)}
					>
						<div
							className={cn(
								"grid grid-cols-[1.4fr_0.9fr_1.4fr_0.8fr] gap-3 border-b px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em]",
								adminDark
									? "border-white/10 bg-white/[0.03] text-slate-400"
									: "border-slate-200 bg-slate-50 text-slate-500",
							)}
						>
							<div>Endpoint</div>
							<div>Time</div>
							<div>Actor / Device</div>
							<div>Status</div>
						</div>
						<div className={cn("divide-y", adminDark ? "divide-white/10" : "divide-slate-200")}>
							{filteredNetworkAuditRows.slice(0, 30).map((entry) => (
								<div
									key={entry.id || entry.at}
									className={cn(
										"grid grid-cols-[1.4fr_0.9fr_1.4fr_0.8fr] gap-3 px-4 py-4 text-sm",
										adminDark ? "bg-slate-950/30" : "bg-white",
									)}
								>
									<div className={cn("font-medium", adminDark ? "text-white" : "text-slate-900")}>
										{entry.path || entry.action || "--"}
									</div>
									<div className={adminDark ? "text-slate-400" : "text-slate-600"}>
										{entry.at ? new Date(entry.at).toLocaleString() : "--"}
									</div>
									<div className={adminDark ? "text-slate-300" : "text-slate-700"}>
										<div className="truncate">
											Actor: {entry.actor_id || entry.actor || "system"}
										</div>
										<div className={adminDark ? "text-slate-500" : "text-slate-500"}>
											IP: {entry.ip || "--"} / Device: {entry.device_id || "--"}
										</div>
									</div>
									<div>
										<span className="inline-flex rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-400">
											{entry.status ?? 200}
										</span>
									</div>
								</div>
							))}
							{filteredNetworkAuditRows.length > 0 ? null : (
								<div
									className={cn(
										"px-4 py-4 text-sm",
										adminDark ? "text-slate-400" : "text-slate-500",
									)}
								>
									No audit entries found.
								</div>
							)}
						</div>
					</div>
				</section>
			</div>
		</div>
	);
}

export default AdminNetworkSection;
