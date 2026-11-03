import {
	Activity,
	ArrowRight,
	BadgeInfo,
	BellRing,
	Building2,
	CalendarDays,
	CheckCircle2,
	Code2,
	DatabaseZap,
	FileJson,
	FlaskConical,
	Gauge,
	Globe2,
	History,
	Layers3,
	LayoutDashboard,
	LockKeyhole,
	MoonStar,
	Plus,
	RefreshCw,
	ShieldCheck,
	SunMedium,
	UserRoundSearch,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import NeonAtom from "../components/ui/NeonAtom.jsx";
import usePageChrome from "../hooks/usePageChrome.js";
import { apiRequest, getToken } from "../lib/auth.js";
import { logger } from "../lib/logger.js";

const initialPolicy = { code: "", name: "", description: "" };
const initialVersion = {
	policyId: "",
	status: "active",
	effectiveFrom: "",
	roleScopes: "",
	planScopes: "",
	regionScopes: "",
	rulesJson: "",
};
const initialSimulation = {
	policyVersionId: "",
	role: "",
	plan: "",
	region: "",
};
const initialTemplate = {
	templateKey: "",
	channel: "in_app",
	subject: "",
	body: "",
};

/**
 * Splits a CSV string into an array of trimmed strings.
 * @param {string} value
 * @returns {string[]}
 */
function splitCsv(value) {
	return String(value || "")
		.split(",")
		.map((part) => part.trim())
		.filter(Boolean);
}

/**
 * Safely stringifies an object to JSON.
 * @param {any} value
 * @returns {string}
 */
function safeJsonStringify(value) {
	try {
		return JSON.stringify(value, null, 2);
	} catch (err) {
		logger.warn("safeJsonStringify failed:", err);
		return "null";
	}
}

/**
 * Returns the CSS tone class based on status.
 * @param {string} status
 * @returns {string}
 */
function statusTone(status) {
	const s = (status || "").toLowerCase();
	if (!s) {
		return "neutral";
	}
	if (s.includes("failed") || s.includes("error")) {
		return "danger";
	}
	if (
		s.includes("saved") ||
		s.includes("created") ||
		s.includes("applied") ||
		s.includes("loaded")
	) {
		return "success";
	}
	return "info";
}

import { cn } from "../lib/cn.js";

/**
 * Renders a section card.
 * @param {Object} props
 * @param {React.ElementType} props.icon
 * @param {string} props.title
 * @param {string} props.subtitle
 * @param {React.ReactNode} props.children
 * @param {React.ReactNode} [props.right]
 * @returns {JSX.Element}
 */
function SectionCard({ icon: Icon, title, subtitle, children, right }) {
	return (
		<section className="overflow-hidden rounded-3xl border border-sky-200/70 bg-white/80 shadow-[0_20px_60px_-25px_rgba(0,106,106,0.45)] backdrop-blur dark:border-slate-700/70 dark:bg-slate-950/70">
			<div className="flex flex-col gap-4 border-b border-sky-100 px-5 py-5 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
				<div className="flex items-start gap-3">
					<div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-cyan-400 text-white shadow-lg shadow-sky-500/25">
						<Icon className="h-5 w-5" />
					</div>
					<div>
						<h2 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h2>
						<p className="mt-1 max-w-3xl text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
					</div>
				</div>
				{right}
			</div>
			<div className="p-5">{children}</div>
		</section>
	);
}

/**
 * Renders a label.
 * @param {Object} props
 * @param {React.ReactNode} props.children
 * @returns {JSX.Element}
 */
function Label({ children }) {
	return (
		<label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
			{children}
		</label>
	);
}

/**
 * Renders an input field.
 * @param {Object} props
 * @returns {JSX.Element}
 */
function Input(props) {
	return (
		<input
			{...props}
			className={cn(
				"w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition",
				"placeholder:text-slate-400 focus:border-sky-400 focus:ring-4 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-sky-400 dark:focus:ring-sky-950/60",
				props.className,
			)}
		/>
	);
}

/**
 * Renders a textarea.
 * @param {Object} props
 * @returns {JSX.Element}
 */
function Textarea(props) {
	return (
		<textarea
			{...props}
			className={cn(
				"w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition",
				"placeholder:text-slate-400 focus:border-sky-400 focus:ring-4 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-sky-400 dark:focus:ring-sky-950/60",
				props.className,
			)}
		/>
	);
}

/**
 * Renders a button.
 * @param {Object} props
 * @param {React.ReactNode} props.children
 * @param {string} [props.variant]
 * @param {string} [props.className]
 * @returns {JSX.Element}
 */
function Button({ children, variant = "primary", className = "", ...props }) {
	const styles = {
		primary:
			"bg-gradient-to-r from-sky-500 to-cyan-400 text-white shadow-lg shadow-sky-500/20 hover:from-sky-400 hover:to-cyan-300",
		secondary:
			"border border-sky-200 bg-white text-sky-700 hover:bg-sky-50 dark:border-slate-700 dark:bg-slate-900 dark:text-sky-300 dark:hover:bg-slate-800",
		ghost: "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
		danger: "bg-rose-500 text-white hover:bg-rose-600 shadow-lg shadow-rose-500/20",
	};

	return (
		<button
			{...props}
			className={cn(
				"inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60",
				styles[variant],
				className,
			)}
		>
			{children}
		</button>
	);
}

/**
 * Renders a JSON block.
 * @param {Object} props
 * @param {any} props.value
 * @param {number} [props.minHeight]
 * @returns {JSX.Element}
 */
function JsonBlock({ value, minHeight = 160 }) {
	return (
		<pre
			data-lenis-prevent={true}
			className="overflow-auto rounded-2xl border border-slate-200 bg-slate-950 px-4 py-4 text-xs leading-6 text-slate-100 shadow-inner dark:border-slate-800"
			style={{ minHeight }}
		>
			{value === null || value === undefined
				? "No data yet. Run an action to see results."
				: typeof value === "string"
					? value
					: safeJsonStringify(value)}
		</pre>
	);
}

/**
 * AdminGovernance page component.
 * @returns {JSX.Element}
 */
export default function AdminGovernance() {
	const [darkMode, setDarkMode] = useState(true);
	const { navCollapsed, footerCollapsed, toggleNav, toggleFooter } =
		usePageChrome("governance");
	const [policy, setPolicy] = useState(initialPolicy);
	const [version, setVersion] = useState(initialVersion);
	const [simulation, setSimulation] = useState(initialSimulation);
	const [userId, setUserId] = useState("");
	const [trustSignals, setTrustSignals] = useState(null);
	const [policies, setPolicies] = useState([]);
	const [history, setHistory] = useState([]);
	const [simulationResult, setSimulationResult] = useState(null);
	const [reportMonth, setReportMonth] = useState(new Date().toISOString().slice(0, 7));
	const [monthlyReport, setMonthlyReport] = useState(null);
	const [templates, setTemplates] = useState([]);
	const [status, setStatus] = useState("");
	const [pageLoading, setPageLoading] = useState(true);
	const [evalDecision, setEvalDecision] = useState("auto_evaluated");
	const [enforceReason, setEnforceReason] = useState(
		"Automated governance review from admin panel",
	);

	const shellClass = darkMode
		? "dark bg-[radial-gradient(circle_at_top_left,_rgba(51,122,176,0.22),_transparent_26%),radial-gradient(circle_at_top_right,_rgba(109,171,223,0.16),_transparent_23%),linear-gradient(180deg,_#020617_0%,_#0f172a_100%)] text-slate-100"
		: "bg-[radial-gradient(circle_at_top_left,_rgba(51,122,176,0.14),_transparent_26%),radial-gradient(circle_at_top_right,_rgba(155,202,242,0.16),_transparent_23%),linear-gradient(180deg,_#eff8ff_0%,_#f8fbff_100%)] text-slate-900";

	const stats = useMemo(
		() => [
			{ label: "Policies", value: policies.length, icon: Layers3 },
			{ label: "History entries", value: history.length, icon: History },
			{ label: "Templates", value: templates.length, icon: BellRing },
			{ label: "Current month", value: reportMonth, icon: CalendarDays },
		],
		[policies.length, history.length, templates.length, reportMonth],
	);

	const load = async () => {
		const [policyRes, historyRes, templatesRes] = await Promise.all([
			apiRequest("/admin/governance/policies", { token: getToken() }),
			apiRequest("/admin/governance/enforcement/history?limit=50", {
				token: getToken(),
			}),
			apiRequest("/admin/governance/templates", { token: getToken() }),
		]);
		setPolicies(policyRes?.items || []);
		setHistory(historyRes?.items || []);
		setTemplates(templatesRes?.items || []);
	};

	useEffect(() => {
		let active = true;
		const run = async () => {
			try {
				await load();
			} catch (err) {
				logger.warn("Failed to load governance data:", err);
				if (active) {
					setStatus("Failed to load governance data");
				}
			} finally {
				if (active) {
					setPageLoading(false);
				}
			}
		};
		run();
		return () => {
			active = false;
		};
	}, [load]);

	const savePolicy = async () => {
		await apiRequest("/admin/governance/policies", {
			method: "POST",
			token: getToken(),
			body: policy,
		});
		setPolicy(initialPolicy);
		setStatus("Policy saved");
		await load();
	};

	const createVersion = async () => {
		const rules = JSON.parse(version.rulesJson || "{}");
		await apiRequest("/admin/governance/policy-versions", {
			method: "POST",
			token: getToken(),
			body: {
				policyId: version.policyId,
				status: version.status,
				effectiveFrom: version.effectiveFrom || new Date().toISOString(),
				rules,
				scopes: {
					role: splitCsv(version.roleScopes),
					plan: splitCsv(version.planScopes),
					region: splitCsv(version.regionScopes),
				},
			},
		});
		setStatus("Policy version created");
		await load();
	};

	const simulate = async () => {
		const result = await apiRequest("/admin/governance/simulate", {
			method: "POST",
			token: getToken(),
			body: {
				policyVersionId: simulation.policyVersionId,
				actor: {
					role: simulation.role,
					plan: simulation.plan,
					region: simulation.region,
				},
			},
		});
		setSimulationResult(result);
	};

	const evaluateRisk = async () => {
		if (!userId) {
			return;
		}
		const signals = await apiRequest(
			`/admin/governance/trust/signals?user_id=${encodeURIComponent(userId)}`,
			{ token: getToken() },
		);
		setTrustSignals(signals);
		const evalRow = await apiRequest("/admin/governance/trust/evaluate", {
			method: "POST",
			token: getToken(),
			body: { user_id: userId, decision: evalDecision },
		});
		await apiRequest("/admin/governance/enforcement/apply", {
			method: "POST",
			token: getToken(),
			body: {
				userId,
				evaluationId: evalRow?.id,
				reason: enforceReason,
			},
		});
		setStatus("Trust evaluated and enforcement decision applied");
		await load();
	};

	const saveTemplate = async () => {
		await apiRequest("/admin/governance/templates", {
			method: "POST",
			token: getToken(),
			body: initialTemplate,
		});
		setStatus("Template saved");
		await load();
	};

	const generateReport = async () => {
		const result = await apiRequest("/admin/governance/reports/monthly", {
			method: "POST",
			token: getToken(),
			body: { month: reportMonth },
		});
		setMonthlyReport(result?.item || null);
	};

	if (pageLoading) {
		return <NeonAtom fill={true} timeout={10000} />;
	}

	return (
		<div className={cn("min-h-dvh flex-1 transition-colors", shellClass)}>
			<div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
				<div className="mb-6 flex flex-col gap-4 rounded-3xl border border-sky-200/70 bg-white/80 p-5 shadow-[0_20px_60px_-25px_rgba(0,106,106,0.45)] backdrop-blur dark:border-white/10 dark:bg-slate-950/40 lg:flex-row lg:items-center lg:justify-between">
					<div className="flex items-start gap-4">
						<div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-gradient-to-br from-sky-500 via-cyan-400 to-sky-300 text-white shadow-lg shadow-sky-500/25">
							<ShieldCheck className="h-7 w-7" />
						</div>
						<div>
							<div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.24em] text-sky-700 dark:text-sky-300/90">
								<span className="inline-flex items-center gap-1 rounded-full border border-sky-400/30 bg-sky-500/10 px-3 py-1 text-sky-700 dark:text-sky-200">
									<LockKeyhole className="h-3.5 w-3.5" /> Protected admin route
								</span>
								<span className="inline-flex items-center gap-1 rounded-full border border-sky-400/30 bg-sky-500/10 px-3 py-1 text-sky-700 dark:text-sky-200">
									<LayoutDashboard className="h-3.5 w-3.5" /> /admin/governance
								</span>
							</div>
							<h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
								Admin Governance Console
							</h1>
							<p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500 dark:text-slate-300">
								Policy management, rule simulation, trust evaluation, enforcement history,
								notification templates, and monthly reporting.
							</p>
						</div>
					</div>

					<div className="flex flex-wrap items-center gap-2">
						<Button variant="secondary" onClick={() => setDarkMode((v) => !v)}>
							{darkMode ? <SunMedium className="h-4 w-4" /> : <MoonStar className="h-4 w-4" />}
							{darkMode ? "Light mode" : "Dark mode"}
						</Button>
						<Button variant="secondary" onClick={load}>
							<RefreshCw className="h-4 w-4" />
							Reload data
						</Button>
						<Button variant="secondary" onClick={toggleNav} aria-expanded={!navCollapsed}>
							{navCollapsed ? "Show nav" : "Hide nav"}
						</Button>
						<Button variant="secondary" onClick={toggleFooter} aria-expanded={!footerCollapsed}>
							{footerCollapsed ? "Show footer" : "Hide footer"}
						</Button>
					</div>
				</div>

				{status ? (
					<div
						className={cn(
							"mb-6 rounded-2xl border px-4 py-3 text-sm font-medium shadow-sm",
							statusTone(status) === "success" &&
								"border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300",
							statusTone(status) === "danger" &&
								"border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300",
							statusTone(status) === "info" &&
								"border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-300",
							statusTone(status) === "neutral" &&
								"border-slate-200 bg-white text-slate-800 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200",
						)}
					>
						<div className="flex items-center gap-2">
							<BadgeInfo className="h-4 w-4" />
							{status}
						</div>
					</div>
				) : null}

				<div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
					{stats.map((item) => {
						const Icon = item.icon;
						return (
							<div
								key={item.label}
								className="rounded-3xl border border-sky-200/70 bg-white/80 p-5 shadow-[0_20px_60px_-35px_rgba(0,106,106,0.42)] backdrop-blur dark:border-slate-800 dark:bg-slate-950/60"
							>
								<div className="flex items-center justify-between gap-4">
									<div>
										<p className="text-sm text-slate-500 dark:text-slate-400">{item.label}</p>
										<p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
											{item.value}
										</p>
									</div>
									<div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500/15 to-cyan-400/15 text-sky-600 dark:text-sky-300">
										<Icon className="h-5 w-5" />
									</div>
								</div>
							</div>
						);
					})}
				</div>

				<div className="grid gap-6">
					<SectionCard
						icon={Code2}
						title="Policy Editor"
						subtitle="Create governance policies, then attach active versions with scoped roles, plans, regions, and JSON rules."
						right={
							<div className="rounded-full bg-sky-500/10 px-3 py-1 text-xs font-semibold text-sky-700 dark:text-sky-300">
								POST /policies · POST /policy-versions
							</div>
						}
					>
						<div className="grid gap-6 xl:grid-cols-2">
							<div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900/60">
								<div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
									<Plus className="h-4 w-4 text-sky-500" /> Policy definition
								</div>
								<div className="grid gap-4">
									<div>
										<Label>Code</Label>
										<Input
											placeholder="Code"
											value={policy.code}
											onChange={(e) => setPolicy((p) => ({ ...p, code: e.target.value }))}
										/>
									</div>
									<div>
										<Label>Name</Label>
										<Input
											placeholder="Name"
											value={policy.name}
											onChange={(e) => setPolicy((p) => ({ ...p, name: e.target.value }))}
										/>
									</div>
									<div>
										<Label>Description</Label>
										<Textarea
											placeholder="Description"
											rows={4}
											value={policy.description}
											onChange={(e) =>
												setPolicy((p) => ({
													...p,
													description: e.target.value,
												}))
											}
										/>
									</div>
									<div className="flex justify-end">
										<Button onClick={savePolicy}>
											<CheckCircle2 className="h-4 w-4" /> Save policy
										</Button>
									</div>
								</div>
							</div>

							<div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900/60">
								<div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
									<Layers3 className="h-4 w-4 text-cyan-500" /> Policy version
								</div>
								<div className="grid gap-4">
									<div>
										<Label>Select policy</Label>
										<select
											value={version.policyId}
											onChange={(e) => setVersion((p) => ({ ...p, policyId: e.target.value }))}
											className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-sky-950/60"
										>
											<option value="">Select policy</option>
											{policies.map((item) => (
												<option value={item.id} key={item.id}>
													{item.code}
												</option>
											))}
										</select>
									</div>
									<div className="grid gap-4 md:grid-cols-2">
										<div>
											<Label>Effective from</Label>
											<Input
												type="datetime-local"
												value={version.effectiveFrom}
												onChange={(e) =>
													setVersion((p) => ({
														...p,
														effectiveFrom: e.target.value,
													}))
												}
											/>
										</div>
										<div>
											<Label>Rules JSON</Label>
											<Input
												value={version.rulesJson}
												onChange={(e) =>
													setVersion((p) => ({
														...p,
														rulesJson: e.target.value,
													}))
												}
											/>
										</div>
									</div>
									<div className="grid gap-4 md:grid-cols-3">
										<div>
											<Label>Role scopes (CSV)</Label>
											<Input
												placeholder="Role scopes (csv)"
												value={version.roleScopes}
												onChange={(e) =>
													setVersion((p) => ({
														...p,
														roleScopes: e.target.value,
													}))
												}
											/>
										</div>
										<div>
											<Label>Plan scopes (CSV)</Label>
											<Input
												placeholder="Plan scopes (csv)"
												value={version.planScopes}
												onChange={(e) =>
													setVersion((p) => ({
														...p,
														planScopes: e.target.value,
													}))
												}
											/>
										</div>
										<div>
											<Label>Region scopes (CSV)</Label>
											<Input
												placeholder="Region scopes (csv)"
												value={version.regionScopes}
												onChange={(e) =>
													setVersion((p) => ({
														...p,
														regionScopes: e.target.value,
													}))
												}
											/>
										</div>
									</div>
									<div className="flex justify-end">
										<Button onClick={createVersion}>
											<ArrowRight className="h-4 w-4" /> Create policy version
										</Button>
									</div>
								</div>
							</div>
						</div>
					</SectionCard>

					<SectionCard
						icon={FlaskConical}
						title="Rule Simulation"
						subtitle="Simulate a selected policy version against an actor profile and inspect the raw JSON output."
						right={
							<div className="rounded-full bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-700 dark:text-cyan-300">
								POST /simulate
							</div>
						}
					>
						<div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
							<div className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900/60 md:grid-cols-2">
								<div className="md:col-span-2">
									<Label>Policy version ID</Label>
									<Input
										placeholder="Policy version id"
										value={simulation.policyVersionId}
										onChange={(e) =>
											setSimulation((p) => ({
												...p,
												policyVersionId: e.target.value,
											}))
										}
									/>
								</div>
								<div>
									<Label>Role</Label>
									<Input
										placeholder="Role"
										value={simulation.role}
										onChange={(e) => setSimulation((p) => ({ ...p, role: e.target.value }))}
									/>
								</div>
								<div>
									<Label>Plan</Label>
									<Input
										placeholder="Plan"
										value={simulation.plan}
										onChange={(e) => setSimulation((p) => ({ ...p, plan: e.target.value }))}
									/>
								</div>
								<div>
									<Label>Region</Label>
									<Input
										placeholder="Region"
										value={simulation.region}
										onChange={(e) => setSimulation((p) => ({ ...p, region: e.target.value }))}
									/>
								</div>
								<div className="flex items-end justify-end md:col-span-2">
									<Button onClick={simulate}>
										<Gauge className="h-4 w-4" /> Run simulation
									</Button>
								</div>
							</div>

							<div className="rounded-2xl border border-slate-200 bg-slate-950 p-5 dark:border-slate-800">
								<div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
									<FileJson className="h-4 w-4 text-sky-300" /> Simulation result
								</div>
								<JsonBlock value={simulationResult} minHeight={280} />
							</div>
						</div>
					</SectionCard>

					<SectionCard
						icon={ShieldCheck}
						title="Trust Risk & Enforcement"
						subtitle="Fetch trust signals, record an auto evaluation, and apply enforcement in one sequential action."
						right={
							<div className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
								GET signals → POST evaluate → POST apply
							</div>
						}
					>
						<div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
							<div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900/60">
								<Label>User ID</Label>
								<div className="flex gap-3">
									<Input
										placeholder="User ID"
										value={userId}
										onChange={(e) => setUserId(e.target.value)}
										className="flex-1"
									/>
									<Button onClick={evaluateRisk} disabled={!userId}>
										<UserRoundSearch className="h-4 w-4" /> Evaluate + enforce
									</Button>
								</div>
								<div className="space-y-3">
									<div>
										<Label>Decision</Label>
										<Input
											value={evalDecision}
											onChange={(e) => setEvalDecision(e.target.value)}
											placeholder="auto_evaluated"
										/>
									</div>
									<div>
										<Label>Enforcement reason</Label>
										<Input
											value={enforceReason}
											onChange={(e) => setEnforceReason(e.target.value)}
											placeholder="Reason for enforcement"
										/>
									</div>
								</div>
							</div>

							<div className="rounded-2xl border border-slate-200 bg-slate-950 p-5 dark:border-slate-800">
								<div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
									<FileJson className="h-4 w-4 text-emerald-300" /> Trust signals
								</div>
								<JsonBlock value={trustSignals} minHeight={280} />
							</div>
						</div>
					</SectionCard>

					<SectionCard
						icon={History}
						title="Enforcement History Viewer"
						subtitle="The most recent 50 enforcement entries, showing action, user ID, reason, and creation time."
						right={
							<div className="rounded-full bg-sky-500/10 px-3 py-1 text-xs font-semibold text-sky-700 dark:text-sky-300">
								GET /enforcement/history?limit=50
							</div>
						}
					>
						<div className="grid gap-3">
							{history.length > 0 ? (
								history.map((item) => {
									const createdAt = item.created_at
										? new Date(item.created_at).toLocaleString()
										: "Unknown time";
									return (
										<div
											key={item.id}
											className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/60 md:flex-row md:items-center md:justify-between"
										>
											<div className="flex items-start gap-3">
												<div className="mt-0.5 rounded-2xl bg-gradient-to-br from-sky-500 to-cyan-400 p-2 text-white">
													<History className="h-4 w-4" />
												</div>
												<div>
													<div className="text-sm font-semibold text-slate-900 dark:text-white">
														{item.action} <span className="text-slate-400">•</span> {item.user_id}
													</div>
													<div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
														{item.reason || "No reason"}
													</div>
												</div>
											</div>
											<div className="text-sm text-slate-500 dark:text-slate-400">{createdAt}</div>
										</div>
									);
								})
							) : (
								<div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400">
									No enforcement history loaded.
								</div>
							)}
						</div>
					</SectionCard>

					<SectionCard
						icon={BellRing}
						title="Notification Templates & Appeal Workflow"
						subtitle="Save the default trust decision template and inspect the existing templates payload as raw JSON."
						right={
							<div className="rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-700 dark:text-amber-300">
								POST /templates
							</div>
						}
					>
						<div className="grid gap-6 xl:grid-cols-[0.88fr_1.12fr]">
							<div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900/60">
								<div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
									<Building2 className="h-4 w-4 text-sky-500" /> Default template
								</div>
								<Button onClick={saveTemplate}>
									<BellRing className="h-4 w-4" /> Save trust templates
								</Button>
							</div>

							<div className="rounded-2xl border border-slate-200 bg-slate-950 p-5 dark:border-slate-800">
								<div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
									<FileJson className="h-4 w-4 text-amber-300" /> Existing templates
								</div>
								<JsonBlock value={templates} minHeight={280} />
							</div>
						</div>
					</SectionCard>

					<SectionCard
						icon={CalendarDays}
						title="Monthly Governance Reporting"
						subtitle="Generate a month-based governance summary and inspect the JSON response directly."
						right={
							<div className="rounded-full bg-sky-500/10 px-3 py-1 text-xs font-semibold text-sky-700 dark:text-sky-300">
								POST /reports/monthly
							</div>
						}
					>
						<div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
							<div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900/60">
								<Label>Month</Label>
								<div className="flex gap-3">
									<Input
										type="month"
										value={reportMonth}
										onChange={(e) => setReportMonth(e.target.value)}
										className="flex-1"
									/>
									<Button onClick={generateReport}>
										<DatabaseZap className="h-4 w-4" /> Generate report
									</Button>
								</div>
								<div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-200">
									Default month is current YYYY-MM. Report output is shown as raw formatted JSON.
								</div>
							</div>

							<div className="rounded-2xl border border-slate-200 bg-slate-950 p-5 dark:border-slate-800">
								<div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
									<FileJson className="h-4 w-4 text-sky-300" /> Monthly report
								</div>
								<JsonBlock value={monthlyReport} minHeight={260} />
							</div>
						</div>
					</SectionCard>
				</div>

				<div className="mt-8 rounded-3xl border border-slate-200 bg-white/70 p-5 text-sm text-slate-500 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-400">
					<div className="flex flex-wrap items-center gap-2">
						<span className="inline-flex items-center gap-2 rounded-full bg-sky-500/10 px-3 py-1 font-medium text-sky-700 dark:text-sky-300">
							<Activity className="h-3.5 w-3.5" /> Auth required
						</span>
						<span className="inline-flex items-center gap-2 rounded-full bg-cyan-500/10 px-3 py-1 font-medium text-cyan-700 dark:text-cyan-300">
							<RefreshCw className="h-3.5 w-3.5" /> Re-fetch after mutations
						</span>
						<span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 font-medium text-emerald-700 dark:text-emerald-300">
							<CheckCircle2 className="h-3.5 w-3.5" /> Raw JSON outputs
						</span>
						<span className="inline-flex items-center gap-2 rounded-full bg-sky-500/10 px-3 py-1 font-medium text-sky-700 dark:text-sky-300">
							<Globe2 className="h-3.5 w-3.5" /> Owner/Admin access
						</span>
					</div>
				</div>
			</div>
			{(navCollapsed || footerCollapsed) && (
				<div className="fixed bottom-4 right-4 z-40 flex gap-2">
					{navCollapsed && (
						<button
							type="button"
							onClick={toggleNav}
							className="rounded-full bg-sky-500 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-sky-500/25 transition hover:-translate-y-0.5"
						>
							Show nav
						</button>
					)}
					{footerCollapsed && (
						<button
							type="button"
							onClick={toggleFooter}
							className="rounded-full bg-sky-500 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-sky-500/25 transition hover:-translate-y-0.5"
						>
							Show footer
						</button>
					)}
				</div>
			)}
		</div>
	);
}
