import {
	AlertCircle,
	ArrowRightLeft,
	CheckCircle2,
	Filter,
	MoonStar,
	Search,
	Shield,
	Sparkles,
	SunMedium,
	UserRound,
	Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ThreeDot } from "react-loading-indicators";
import { Link } from "react-router-dom";
import ScrollReveal from "../components/ScrollReveal.jsx";
import { StaggerContainer, StaggerItem } from "../components/StaggerContainer.jsx";
import NeonAtom from "../components/ui/NeonAtom.jsx";
import { apiRequest, getCurrentUser, getToken } from "../lib/auth.js";
import { useTheme } from "../lib/ThemeProvider.jsx";

const STATUS_TABS = [
	{ key: "connected", label: "Connected" },
	{ key: "pending", label: "Pending Requests" },
	{ key: "rejected", label: "Rejected" },
];

const capitalize = (value) =>
	String(value || "")
		.replaceAll("_", " ")
		.replace(/\b\w/g, (m) => m.toUpperCase());

const cls = (...items) => items.filter(Boolean).join(" ");

function StatusPill({ tone = "slate", children }) {
	const tones = {
		slate: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
		blue: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200",
		emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200",
		amber: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200",
		rose: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200",
		violet: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-200",
	};
	return (
		<span
			className={cls(
				"inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
				tones[tone],
			)}
		>
			{children}
		</span>
	);
}

function ActionButton({
	children,
	onClick,
	variant = "primary",
	disabled = false,
	className = "",
}) {
	const styles = {
		primary:
			"bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-lg shadow-sky-500/25 hover:from-sky-400 hover:to-blue-500",
		secondary:
			"bg-white/80 text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 dark:bg-slate-900/70 dark:text-slate-200 dark:ring-slate-700 dark:hover:bg-slate-900",
		ghost:
			"bg-transparent text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5",
		success: "bg-emerald-500 text-white hover:bg-emerald-400",
		danger: "bg-rose-500 text-white hover:bg-rose-400",
	};
	return (
		<button
			onClick={onClick}
			disabled={disabled}
			className={cls(
				"inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50",
				styles[variant],
				className,
			)}
		>
			{children}
		</button>
	);
}

function Card({ children, className = "" }) {
	return (
		<div
			className={cls(
				"rounded-[1.5rem] border border-sky-200/60 bg-white/90 p-5 shadow-[0_10px_40px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-sky-400/10 dark:bg-slate-950/75 dark:shadow-[0_10px_40px_rgba(2,6,23,0.35)]",
				className,
			)}
		>
			{children}
		</div>
	);
}

export default function PartnerNetwork() {
	const user = getCurrentUser();
	const token = getToken();
	const { theme, toggleTheme } = useTheme();
	const isDark = theme === "dark";
	const [query, setQuery] = useState("");
	const [tab, setTab] = useState("connected");
	const [targetAccountId, setTargetAccountId] = useState("");
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [rows, setRows] = useState([]);
	const [permissions, setPermissions] = useState({
		can_manage: false,
		view_only: false,
	});

	const loadNetwork = useCallback(
		async (status = tab) => {
			setLoading(true);
			setError("");
			try {
				const data = await apiRequest(`/partners?status=${status}`, { token });
				setRows(data.requests || []);
				setPermissions(data.permissions || { can_manage: false, view_only: false });
			} catch (err) {
				setError(
					err.status === 403 ? "You do not have permission to perform this action." : err.message,
				);
			} finally {
				setLoading(false);
			}
		},
		[tab, token],
	);

	useEffect(() => {
		// eslint-disable-next-line react-hooks/set-state-in-effect
		loadNetwork(tab);
	}, [loadNetwork, tab]);

	const filteredRows = useMemo(() => {
		const q = query.trim().toLowerCase();
		if (!q) {
			return rows;
		}
		return rows.filter((row) => {
			const counterparty = row.counterparty || {};
			return (
				String(counterparty.name || "")
					.toLowerCase()
					.includes(q) ||
				String(counterparty.id || "")
					.toLowerCase()
					.includes(q)
			);
		});
	}, [query, rows]);

	const sendRequest = async () => {
		if (!targetAccountId.trim()) {
			return;
		}
		setLoading(true);
		setError("");
		try {
			await apiRequest("/partners/requests", {
				method: "POST",
				token,
				body: { targetAccountId: targetAccountId.trim() },
			});
			setTargetAccountId("");
			setTab("pending");
			await loadNetwork("pending");
		} catch (err) {
			setError(
				err.status === 403 ? "You do not have permission to perform this action." : err.message,
			);
		} finally {
			setLoading(false);
		}
	};

	const applyAction = async (requestId, action) => {
		setLoading(true);
		setError("");
		try {
			await apiRequest(`/partners/requests/${requestId}/${action}`, {
				method: "POST",
				token,
			});
			await loadNetwork(tab);
		} catch (err) {
			setError(
				err.status === 403 ? "You do not have permission to perform this action." : err.message,
			);
		} finally {
			setLoading(false);
		}
	};

	const canManage = permissions.can_manage && !permissions.view_only;
	const connectedCount = rows.filter((r) => r.status === "connected").length;
	const pendingIncoming = rows.filter(
		(r) => r.status === "pending" && r.direction === "incoming",
	).length;

	const badges = [
		{ label: `Connected ${connectedCount}`, tone: "emerald" },
		{ label: `Pending ${pendingIncoming}`, tone: "amber" },
		{ label: `Role ${capitalize(user?.role || "unknown")}`, tone: "blue" },
	];

	if (loading) {
		return <NeonAtom fill={true} timeout={10000} />;
	}

	return (
		<div
			className={cls(
				"min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(109,171,223,0.24),_transparent_35%),radial-gradient(circle_at_top_right,_rgba(55,115,168,0.18),_transparent_30%),linear-gradient(to_bottom,_#f8fcff,_#edf6ff_35%,_#e2efff)] text-slate-900 transition-colors duration-300 dark:bg-[radial-gradient(circle_at_top_left,_rgba(109,171,223,0.16),_transparent_30%),radial-gradient(circle_at_top_right,_rgba(106,161,212,0.14),_transparent_25%),linear-gradient(to_bottom,_#0b1120,_#090d18_48%,_#050816)] dark:text-slate-100",
			)}
		>
			<div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
				<div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
					<div className="space-y-4">
						<div className="inline-flex items-center gap-2 rounded-full border border-sky-300/50 bg-white/70 px-3 py-1 text-xs font-semibold tracking-wide text-sky-700 shadow-sm backdrop-blur dark:border-sky-400/20 dark:bg-white/5 dark:text-sky-200">
							<Sparkles className="h-3.5 w-3.5" />
							Partner Network · Protected workspace
						</div>

						<div>
							<h1 className="text-3xl font-black tracking-tight sm:text-4xl">Partner Network</h1>
							<p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
								Manage connected factories and request workflow by account ID
							</p>
							{permissions.view_only && (
								<p className="mt-1 text-xs font-medium text-amber-700 dark:text-amber-200">
									Agent mode: view-only access enabled.
								</p>
							)}
						</div>

						<div className="flex flex-wrap gap-2">
							{badges.map((item) => (
								<StatusPill key={item.label} tone={item.tone}>
									{item.label}
								</StatusPill>
							))}
						</div>
					</div>

					<div className="flex flex-wrap items-center gap-3">
						<Card className="flex items-center gap-3 px-4 py-3">
							<div className="rounded-2xl bg-sky-500/10 p-3 text-sky-600 dark:text-sky-300">
								<UserRound className="h-5 w-5" />
							</div>
							<div>
								<div className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
									Signed in as
								</div>
								<div className="font-semibold">{user?.role || "unknown"}</div>
							</div>
						</Card>

						<ActionButton variant="secondary" onClick={toggleTheme}>
							{isDark ? <SunMedium className="h-4 w-4" /> : <MoonStar className="h-4 w-4" />}
							{isDark ? "Light" : "Dark"}
						</ActionButton>
					</div>
				</div>

				<div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
					<div className="space-y-6">
						<ScrollReveal as="section">
							<Card>
								<div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
									<ArrowRightLeft className="h-4 w-4 text-sky-500" />
									Send Request
								</div>

								<div className="space-y-3">
									<label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
										Target account ID
									</label>
									<div className="flex gap-3">
										<input
											value={targetAccountId}
											onChange={(e) => setTargetAccountId(e.target.value)}
											placeholder="Target account ID"
											disabled={!canManage || loading}
											className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none ring-0 transition focus:border-sky-400 focus:ring-4 focus:ring-sky-500/15 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950/70 dark:text-white dark:placeholder:text-slate-500"
										/>
										<ActionButton
											onClick={sendRequest}
											disabled={!canManage || loading || !targetAccountId.trim()}
											className="min-w-32"
										>
											{loading ? (
												<ThreeDot
													variant="bounce"
													color="#337ab0"
													size="small"
													text=""
													textColor=""
												/>
											) : (
												<Sparkles className="h-4 w-4" />
											)}
											Send Request
										</ActionButton>
									</div>
								</div>
							</Card>
						</ScrollReveal>

						<ScrollReveal as="section">
							<Card>
								<div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
									<Search className="h-4 w-4 text-sky-500" />
									Search and filter
								</div>
								<div className="space-y-3">
									<input
										value={query}
										onChange={(e) => setQuery(e.target.value)}
										placeholder="Search partners"
										className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-500/15 dark:border-slate-700 dark:bg-slate-950/70 dark:text-white dark:placeholder:text-slate-500"
									/>
									<div className="flex items-center justify-between rounded-2xl border border-dashed border-sky-300/50 bg-sky-50/70 px-4 py-3 text-sm text-slate-700 dark:border-sky-500/20 dark:bg-sky-500/5 dark:text-slate-300">
										<span className="inline-flex items-center gap-2">
											<Filter className="h-4 w-4 text-sky-500" />
											Search by name or ID
										</span>
										<span className="font-medium">{filteredRows.length} visible</span>
									</div>
								</div>
							</Card>
						</ScrollReveal>

						<ScrollReveal as="section">
							<Card className="bg-gradient-to-br from-sky-500/10 via-blue-500/5 to-transparent dark:from-sky-500/15 dark:via-blue-500/10">
								<div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
									<Shield className="h-4 w-4 text-sky-500" />
									Permission snapshot
								</div>
								<div className="grid gap-3 sm:grid-cols-2">
									<div className="rounded-2xl border border-slate-200 bg-white/70 p-4 dark:border-slate-700 dark:bg-slate-950/50">
										<div className="text-xs text-slate-500 dark:text-slate-400">View access</div>
										<div className="mt-1 font-semibold">
											{permissions.view_only ? "Read only" : "Allowed"}
										</div>
									</div>
									<div className="rounded-2xl border border-slate-200 bg-white/70 p-4 dark:border-slate-700 dark:bg-slate-950/50">
										<div className="text-xs text-slate-500 dark:text-slate-400">Manage access</div>
										<div className="mt-1 font-semibold">{canManage ? "Enabled" : "Read only"}</div>
									</div>
								</div>
							</Card>
						</ScrollReveal>
					</div>

					<div className="space-y-6">
						<ScrollReveal as="section">
							<Card>
								<div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
									<div className="flex flex-wrap gap-2">
										{STATUS_TABS.map((item) => (
											<button
												key={item.key}
												onClick={() => setTab(item.key)}
												className={cls(
													"rounded-2xl px-4 py-2.5 text-sm font-semibold transition-all",
													tab === item.key
														? "bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-lg shadow-sky-500/20"
														: "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800",
												)}
											>
												{item.label}
											</button>
										))}
									</div>
								</div>
							</Card>
						</ScrollReveal>

						{error && (
							<div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 shadow-sm dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200">
								<div className="flex items-start gap-3">
									<AlertCircle className="mt-0.5 h-4 w-4 flex-none" />
									<div>{error}</div>
								</div>
							</div>
						)}

						<StaggerContainer className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
							{filteredRows.length > 0
								? filteredRows.map((row) => {
										const counterparty = row.counterparty || {};
										const isIncoming = row.direction === "incoming";
										const isMine = row.requester_id === user?.id;
										const isConnected = row.status === "connected";
										const isPending = row.status === "pending";
										const tone = isConnected ? "emerald" : isPending ? "amber" : "rose";
										const counterpartyRoute =
											counterparty.role === "factory"
												? `/factory/${counterparty.id}`
												: `/buying-house/${counterparty.id}`;

										return (
											<StaggerItem key={row.id}>
												<Card className="group relative overflow-hidden">
													<div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-sky-500 via-blue-500 to-cyan-400" />
													<div className="flex items-start justify-between gap-3">
														<div>
															<div className="flex items-center gap-2">
																<h3 className="text-lg font-bold text-slate-900 dark:text-white">
																	{counterparty.name || "Unknown account"}
																</h3>
																{counterparty.verified && (
																	<StatusPill tone="emerald">
																		<CheckCircle2 className="mr-1 h-3.5 w-3.5" />
																		Verified
																	</StatusPill>
																)}
															</div>
															<p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
																Account ID: {counterparty.id}
															</p>
														</div>
														<StatusPill tone={tone}>{capitalize(row.status)}</StatusPill>
													</div>

													<div className="mt-4 grid grid-cols-2 gap-3 text-sm">
														<div className="rounded-2xl bg-slate-50 p-3 dark:bg-white/5">
															<div className="text-xs text-slate-500 dark:text-slate-400">Role</div>
															<div className="mt-1 font-semibold">
																{capitalize(counterparty.role || "unknown")}
															</div>
														</div>
														<div className="rounded-2xl bg-slate-50 p-3 dark:bg-white/5">
															<div className="text-xs text-slate-500 dark:text-slate-400">
																Direction
															</div>
															<div className="mt-1 font-semibold">{capitalize(row.direction)}</div>
														</div>
													</div>

													<div className="mt-5 flex flex-wrap gap-2">
														<Link to={counterpartyRoute}>
															<ActionButton variant="secondary">View Profile</ActionButton>
														</Link>

														{isPending && canManage && isIncoming && (
															<>
																<ActionButton
																	variant="success"
																	onClick={() => applyAction(row.id, "accept")}
																	disabled={loading}
																>
																	Accept
																</ActionButton>
																<ActionButton
																	variant="danger"
																	onClick={() => applyAction(row.id, "reject")}
																	disabled={loading}
																>
																	Reject
																</ActionButton>
															</>
														)}

														{isPending && canManage && isMine && (
															<ActionButton
																variant="ghost"
																onClick={() => applyAction(row.id, "cancel")}
																disabled={loading}
															>
																Cancel
															</ActionButton>
														)}
													</div>
												</Card>
											</StaggerItem>
										);
									})
								: !loading && (
										<Card className="lg:col-span-2 xl:col-span-3">
											<div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
												<div className="rounded-full bg-sky-500/10 p-4 text-sky-500 dark:bg-sky-500/15">
													<Users className="h-6 w-6" />
												</div>
												<div>
													<h3 className="text-lg font-semibold">
														No requests found for this filter.
													</h3>
													<p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
														Try another tab or search term.
													</p>
												</div>
											</div>
										</Card>
									)}
						</StaggerContainer>

						<ScrollReveal as="section">
							<Card>
								<div className="flex flex-wrap items-center justify-between gap-3">
									<div>
										<h4 className="font-semibold">Summary</h4>
										<p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
											{rows.filter((r) => r.status === tab).length} request(s) in the current tab.
										</p>
									</div>
								</div>
							</Card>
						</ScrollReveal>
					</div>
				</div>
			</div>
		</div>
	);
}
