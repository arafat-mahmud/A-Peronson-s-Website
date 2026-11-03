import {
	AlertTriangle,
	Bell,
	Bot,
	CheckCircle2,
	ChevronRight,
	ClipboardCopy,
	Factory,
	FileText,
	Fingerprint,
	Gauge,
	Landmark,
	LayoutDashboard,
	LogOut,
	MessageSquareText,
	Plus,
	RefreshCcw,
	Send,
	ShieldCheck,
	Sparkles,
	Trash2,
	Users2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { ThreeDot } from "react-loading-indicators";
import { Link } from "react-router-dom";
import CountUp from "../components/CountUp.jsx";
import HoverCard from "../components/HoverCard.jsx";
import LeadManager from "../components/leads/LeadManager.jsx";
import ScaleIn from "../components/ScaleIn.jsx";
import ScrollReveal from "../components/ScrollReveal.jsx";
import { StaggerContainer, StaggerItem } from "../components/StaggerContainer.jsx";
import NeonAtom from "../components/ui/NeonAtom.jsx";
import useAnalyticsDashboard from "../hooks/useAnalyticsDashboard.js";
import usePageChrome from "../hooks/usePageChrome.js";
import { apiRequest, getToken, syncUserFromApi } from "../lib/auth.js";
import { cn } from "../lib/cn.js";

/**
 * Renders a statistic card.
 * @param {Object} props
 * @param {React.ElementType} props.icon
 * @param {string} props.label
 * @param {string|number} props.value
 * @param {string} [props.sublabel]
 * @param {boolean} [props.accent]
 * @returns {JSX.Element}
 */
const StatCard = ({ icon: Icon, label, value, sublabel, accent = false }) => {
	const isNumeric = typeof value === "number" && !Number.isNaN(value);
	return (
		<HoverCard
			className={cn(
				"rounded-2xl border p-4 shadow-sm backdrop-blur-xl transition-all",
				accent
					? "border-sky-500/30 bg-gradient-to-br from-sky-500/15 to-cyan-400/10"
					: "border-slate-200/70 bg-white/80 dark:border-slate-800/70 dark:bg-slate-950/60",
			)}
		>
			<div className="flex items-start justify-between gap-4">
				<div>
					<p className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
					<p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
						{isNumeric ? (
							<ScaleIn>
								<CountUp value={value} />
							</ScaleIn>
						) : (
							value
						)}
					</p>
					{sublabel ? (
						<p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{sublabel}</p>
					) : null}
				</div>
				<div
					className={cn(
						"flex h-11 w-11 items-center justify-center rounded-2xl border",
						accent
							? "border-sky-500/25 bg-sky-500/15 text-sky-500"
							: "border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300",
					)}
				>
					<Icon className="h-5 w-5" />
				</div>
			</div>
		</HoverCard>
	);
};

/**
 * Renders a section title.
 * @param {Object} props
 * @param {string} props.title
 * @param {string} [props.subtitle]
 * @param {React.ReactNode} [props.right]
 * @returns {JSX.Element}
 */
const SectionTitle = ({ title, subtitle, right }) => (
	<div className="mb-5 flex items-end justify-between gap-4">
		<div>
			<h2 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white">{title}</h2>
			{subtitle ? <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p> : null}
		</div>
		{right}
	</div>
);

/**
 * AgentDashboard component.
 * @returns {JSX.Element}
 */
export default function AgentDashboard() {
	const [activeTab, setActiveTab] = useState("requests");
	const { dashboard, subscription, isEnterprise, loading, error } = useAnalyticsDashboard();
	const totals = dashboard?.totals || {};
	const [aiPrompt, setAiPrompt] = useState("");
	const [aiSuggestion, setAiSuggestion] = useState("");
	const [aiLoading, setAiLoading] = useState(false);
	const [aiError, setAiError] = useState("");
	const [aiChecklist, setAiChecklist] = useState([]);
	const [aiExtractedRequirements, setAiExtractedRequirements] = useState({});
	const [approvalState, setApprovalState] = useState(null);
	const [sendState, setSendState] = useState(null);
	const [queueSummary, setQueueSummary] = useState({ queue: [] });
	const [pageLoading, setPageLoading] = useState(true);
	const [subIds, setSubIds] = useState([]);
	const [subIdLabel, setSubIdLabel] = useState("");
	const [creatingSubId, setCreatingSubId] = useState(false);
	const [subIdFeedback, setSubIdFeedback] = useState("");
	const { navCollapsed, footerCollapsed, toggleNav, toggleFooter } = usePageChrome("agent");

	useEffect(() => {
		if (loading) {
			return;
		}
		syncUserFromApi(getToken()).finally(() => setPageLoading(false));
	}, [loading]);

	useEffect(() => {
		const token = getToken();
		if (!token) return;
		apiRequest("/agents/subids", { token })
			.then((data) => setSubIds(Array.isArray(data) ? data : data?.subIds || []))
			.catch(() => {});
	}, []);

	async function generateAiReply() {
		const token = getToken();
		if (!token) {
			setAiError("Please login to use AI suggestions.");
			return;
		}
		setAiLoading(true);
		setAiError("");
		setApprovalState(null);
		setSendState(null);
		try {
			const prompt =
				aiPrompt.trim() ||
				"Draft a short, professional reply for a textile sourcing conversation. Ask for missing MOQ, price range, and lead time if needed.";
			const res = await apiRequest("/ai/reply/draft", {
				method: "POST",
				token,
				body: { text: prompt },
			});
			const reply = String(res?.draft || "").trim();
			setAiSuggestion(reply);
			setAiChecklist(Array.isArray(res?.checklist) ? res.checklist : []);
			setAiExtractedRequirements(res?.requirements || {});
			if (!aiPrompt.trim()) {
				setAiPrompt(prompt);
			}
		} catch (err) {
			setAiError(err.message || "Unable to generate suggestion");
		} finally {
			setAiLoading(false);
		}
	}

	async function copySuggestion() {
		if (!aiSuggestion) {
			return;
		}
		try {
			await navigator.clipboard.writeText(aiSuggestion);
			setAiError("Copied to clipboard.");
		} catch {
			setAiError("Copy failed.");
		}
	}

	async function approveSuggestion() {
		const token = getToken();
		if (!(token && aiSuggestion)) {
			return;
		}
		setAiLoading(true);
		setAiError("");
		try {
			const res = await apiRequest("/ai/reply/approve", {
				method: "POST",
				token,
				body: {
					draft: aiSuggestion,
					extracted_requirements: aiExtractedRequirements,
				},
			});
			setApprovalState(res);
			if (!res?.approved) {
				setAiError(res?.reason || "Approval blocked by guardrails.");
			}
		} catch (err) {
			setAiError(err.message || "Unable to approve suggestion.");
		} finally {
			setAiLoading(false);
		}
	}

	async function sendSuggestion() {
		const token = getToken();
		if (!(token && aiSuggestion)) {
			return;
		}
		setAiLoading(true);
		setAiError("");
		try {
			const res = await apiRequest("/ai/reply/send", {
				method: "POST",
				token,
				body: {
					draft: aiSuggestion,
					approval: approvalState || {},
				},
			});
			setSendState(res);
			if (!res?.sent) {
				setAiError(res?.message || "Send failed.");
			}
		} catch (err) {
			setAiError(err.message || "Unable to send suggestion.");
		} finally {
			setAiLoading(false);
		}
	}

	async function refreshQueueSummary() {
		const token = getToken();
		if (!token) {
			return;
		}
		try {
			const [queueData, escalationData, workloadData] = await Promise.all([
				apiRequest("/org/ops/queue", { token }),
				apiRequest("/org/ops/escalations", { token }).catch(() => ({
					items: [],
				})),
				apiRequest("/org/ops/workload", { token }).catch(() => ({ items: [] })),
			]);
			setQueueSummary({
				queue: queueData?.queue || [],
				escalations: escalationData?.items || [],
				workload: workloadData?.items || [],
			});
		} catch {
			setQueueSummary({ queue: [], escalations: [], workload: [] });
		}
	}

	const activityTabs = [
		{ key: "requests", label: "Incoming Requests" },
		{ key: "chats", label: "Conversations" },
		{ key: "leads", label: "My Queue" },
	];

	async function createSubId() {
		const token = getToken();
		if (!(token && subIdLabel.trim())) return;
		setCreatingSubId(true);
		setSubIdFeedback("");
		try {
			const data = await apiRequest("/agents/subids", {
				method: "POST",
				token,
				body: { label: subIdLabel.trim() },
			});
			setSubIds((prev) => [data, ...prev]);
			setSubIdLabel("");
			setSubIdFeedback("Sub-ID created successfully.");
		} catch (err) {
			setSubIdFeedback(err.message || "Failed to create sub-ID");
		} finally {
			setCreatingSubId(false);
		}
	}

	async function deleteSubId(id) {
		const token = getToken();
		if (!token) return;
		try {
			await apiRequest(`/agents/subids/${id}`, { method: "DELETE", token });
			setSubIds((prev) => prev.filter((s) => s.id !== id));
		} catch {
			// ignore
		}
	}

	if (pageLoading) {
		return <NeonAtom fill={true} timeout={10000} />;
	}

	return (
		<div className="min-h-full bg-[radial-gradient(circle_at_top_left,_rgba(51,122,176,0.18),_transparent_30%),radial-gradient(circle_at_top_right,_rgba(109,171,223,0.12),_transparent_26%),linear-gradient(180deg,_#f8fbff_0%,_#eef6ff_48%,_#f8fafc_100%)] text-slate-900 transition-colors dark:bg-[radial-gradient(circle_at_top_left,_rgba(51,122,176,0.18),_transparent_30%),radial-gradient(circle_at_top_right,_rgba(109,171,223,0.12),_transparent_26%),linear-gradient(180deg,_#020617_0%,_#06101f_52%,_#020617_100%)] dark:text-slate-100">
			<div className="mx-auto flex min-h-full max-w-[1600px] flex-col lg:flex-row">
				<aside
					data-lenis-prevent={true}
					className="border-b border-white/20 bg-white/70 p-4 backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-950/70 lg:sticky lg:top-0 lg:h-dvh lg:w-80 lg:overflow-y-auto lg:border-b-0 lg:border-r"
				>
					<div className="flex items-center gap-3 rounded-2xl border border-sky-500/20 bg-gradient-to-r from-sky-500/10 to-cyan-400/10 p-4 shadow-sm">
						<div className="flex items-center gap-3">
							<div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-cyan-400 text-white shadow-lg shadow-sky-500/25">
								<LayoutDashboard className="h-6 w-6" />
							</div>
							<div>
								<p className="text-xs uppercase tracking-[0.25em] text-sky-500">gTBlue</p>
								<h1 className="text-lg font-semibold">Agent Dashboard</h1>
							</div>
						</div>
					</div>

					<div className="mt-3 flex gap-2">
						<button
							type="button"
							onClick={toggleNav}
							aria-expanded={!navCollapsed}
							className="rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:-translate-y-0.5 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-300"
						>
							{navCollapsed ? "Show nav" : "Hide nav"}
						</button>
						<button
							type="button"
							onClick={toggleFooter}
							aria-expanded={!footerCollapsed}
							className="rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:-translate-y-0.5 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-300"
						>
							{footerCollapsed ? "Show footer" : "Hide footer"}
						</button>
					</div>

					<div className="mt-5 space-y-4">
						<div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/60">
							<div className="flex items-center justify-between">
								<div>
									<p className="text-sm text-slate-500 dark:text-slate-400">Plan</p>
									<p className="mt-1 text-2xl font-semibold capitalize">
										{subscription?.plan || "free"} plan
									</p>
								</div>
								<div
									className={cn(
										"rounded-2xl px-3 py-2 text-xs font-semibold",
										isEnterprise
											? "bg-sky-500/15 text-sky-600 dark:text-sky-300"
											: "bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-300",
									)}
								>
									{isEnterprise ? "Enterprise analytics on" : "Free analytics view"}
								</div>
							</div>
						</div>

						<div className="rounded-3xl border border-slate-200 bg-white/80 p-5 shadow-sm backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/60">
							<SectionTitle
								title="Operational snapshot"
								subtitle="High-signal metrics designed for quick scanning."
							/>
							<div className="space-y-3">
								{[
									{
										label: "Active conversations",
										value: totals.chats ?? 0,
										icon: MessageSquareText,
									},
									{
										label: "Messages exchanged",
										value: totals.messages ?? 0,
										icon: Bell,
									},
									{
										label: "Connected factories",
										value: totals.partner_network ?? 0,
										icon: Factory,
									},
									{
										label: "Plan",
										value: subscription?.plan || "free",
										icon: Landmark,
									},
								].map((row) => (
									<div
										key={row.label}
										className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/60"
									>
										<div className="flex items-center gap-3">
											<div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-500">
												<row.icon className="h-4 w-4" />
											</div>
											<p className="font-medium text-slate-700 dark:text-slate-200">{row.label}</p>
										</div>
										<div className="text-right">
											<p className="font-semibold text-slate-900 dark:text-white">{row.value}</p>
											<p className="text-xs text-slate-500 dark:text-slate-400">Live signal</p>
										</div>
									</div>
								))}
							</div>
						</div>

						<div className="rounded-3xl border border-slate-200 bg-white/80 p-5 shadow-sm backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/60">
							<div className="mb-4 flex items-center gap-2">
								<Fingerprint className="h-5 w-5 text-sky-500" />
								<h3 className="font-semibold text-slate-900 dark:text-white">Sub-IDs</h3>
							</div>
							<p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
								Create and manage your agent sub-identities.
							</p>
							<div className="flex gap-2">
								<input
									type="text"
									value={subIdLabel}
									onChange={(e) => setSubIdLabel(e.target.value)}
									maxLength={160}
									placeholder="Sub-ID label"
									className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-500/10 dark:border-slate-800 dark:bg-slate-950 dark:placeholder:text-slate-500"
									onKeyDown={(e) => {
										if (e.key === "Enter") createSubId();
									}}
								/>
								<button
									type="button"
									onClick={createSubId}
									disabled={creatingSubId || !subIdLabel.trim()}
									className="inline-flex items-center gap-1.5 rounded-xl bg-sky-500 px-3 py-2 text-sm font-semibold text-white shadow-md shadow-sky-500/20 transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-60"
								>
									<Plus className="h-4 w-4" />
									{creatingSubId ? "..." : "Add"}
								</button>
							</div>
							{subIdFeedback ? (
								<p className="mt-2 text-xs text-sky-600 dark:text-sky-300">{subIdFeedback}</p>
							) : null}
							{subIds.length > 0 ? (
								<div className="mt-3 space-y-2">
									{subIds.map((sub) => (
										<div
											key={sub.id}
											className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/60"
										>
											<div className="min-w-0 flex-1">
												<p className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">
													{sub.label || "Unnamed"}
												</p>
												<p className="text-xs text-slate-400 dark:text-slate-500">
													{new Date(sub.created_at).toLocaleDateString()}
												</p>
											</div>
											<button
												type="button"
												onClick={() => deleteSubId(sub.id)}
												className="flex-shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30 dark:hover:text-rose-400"
												title="Delete sub-ID"
											>
												<Trash2 className="h-4 w-4" />
											</button>
										</div>
									))}
								</div>
							) : (
								<p className="mt-3 text-xs text-slate-400 dark:text-slate-500">No sub-IDs yet.</p>
							)}
						</div>

						<Link
							to="/login"
							className="flex items-center justify-between rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-700 shadow-sm transition hover:bg-rose-100 dark:border-rose-900/60 dark:bg-rose-950/20 dark:text-rose-200"
						>
							<span className="flex items-center gap-3 font-medium">
								<LogOut className="h-5 w-5" />
								Logout
							</span>
							<ChevronRight className="h-4 w-4" />
						</Link>
					</div>
				</aside>

				<main className="flex-1 p-4 md:p-6 xl:p-8">
					<ScrollReveal as="section">
						<div className="mb-6 rounded-3xl border border-sky-500/20 bg-white/75 p-5 shadow-lg shadow-sky-500/5 backdrop-blur-xl dark:bg-slate-950/55">
							<div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
								<div>
									<div className="flex items-center gap-2 text-sm text-sky-600 dark:text-sky-300">
										<Sparkles className="h-4 w-4" />
										Agent Dashboard
									</div>
									<h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">
										Agent Activity
									</h2>
									<p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
										Assigned request tracking, live chat analytics, connected factory visibility,
										plan status, activity tabs, and an AI reply assistant for textile sourcing
										workflows.
									</p>
								</div>

								<StaggerContainer className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:w-[460px]">
									<StaggerItem>
										<StatCard
											icon={Users2}
											label="Incoming Requests"
											value={totals.buyer_requests ?? 0}
										/>
									</StaggerItem>
									<StaggerItem>
										<StatCard
											icon={Gauge}
											label="Awaiting Action"
											value={totals.open_buyer_requests ?? 0}
											accent={true}
										/>
									</StaggerItem>
									<StaggerItem>
										<StatCard
											icon={Factory}
											label="Partner Factories"
											value={totals.partner_network ?? 0}
										/>
									</StaggerItem>
									<StaggerItem>
										<StatCard icon={Bell} label="Messages" value={totals.messages ?? 0} />
									</StaggerItem>
								</StaggerContainer>
							</div>
						</div>
					</ScrollReveal>

					{loading ? (
						<div className="mb-5 rounded-2xl border border-slate-200 bg-white/80 p-4 text-sm dark:border-slate-800 dark:bg-slate-950/60">
							Loading agent metrics...
						</div>
					) : null}
					{error ? (
						<div className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/25 dark:text-red-200">
							{error}
						</div>
					) : null}

					<ScrollReveal as="section">
						<div className="grid gap-6 xl:grid-cols-[1.55fr_1fr]">
							<section className="space-y-6">
								<div className="rounded-3xl border border-slate-200 bg-white/80 p-5 shadow-sm backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/60">
									<SectionTitle
										title="Agent Activity"
										subtitle="Switch between requests, chats, and leads while keeping the core overview in one place."
										right={
											<div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-800 dark:bg-slate-900/60">
												{activityTabs.map((tab) => (
													<button
														key={tab.key}
														onClick={() => setActiveTab(tab.key)}
														className={cn(
															"rounded-xl px-4 py-2 text-sm font-medium transition",
															activeTab === tab.key
																? "bg-sky-500 text-white shadow-md shadow-sky-500/20"
																: "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
														)}
													>
														{tab.label}
													</button>
												))}
											</div>
										}
									/>

									{activeTab === "requests" ? (
										<StaggerContainer className="grid gap-4 md:grid-cols-3">
										<StaggerItem>
											<StatCard
												icon={FileText}
												label="Assigned Requests"
												value={totals.buyer_requests ?? 0}
											/>
										</StaggerItem>
										<StaggerItem>
											<StatCard
												icon={Gauge}
												label="Awaiting Action"
												value={totals.open_buyer_requests ?? 0}
												accent={true}
											/>
										</StaggerItem>
										<StaggerItem>
											<StatCard
												icon={Landmark}
												label="Contracts / Documents"
												value={`${totals.contracts ?? 0} / ${totals.documents ?? 0}`}
											/>
										</StaggerItem>
										</StaggerContainer>
									) : null}

									{activeTab === "chats" ? (
										<StaggerContainer className="grid gap-4 md:grid-cols-3">
											<StaggerItem>
												<StatCard
													icon={MessageSquareText}
													label="Active Conversations"
													value={totals.chats ?? 0}
												/>
											</StaggerItem>
											<StaggerItem>
												<StatCard
													icon={Bell}
													label="Messages Exchanged"
													value={totals.messages ?? 0}
													accent={true}
												/>
											</StaggerItem>
											<StaggerItem>
												<StatCard
													icon={Factory}
													label="Connected Factories"
													value={totals.partner_network ?? 0}
												/>
											</StaggerItem>
										</StaggerContainer>
									) : null}

									{activeTab === "leads" ? (
										<div className="space-y-4">
											<StaggerContainer className="grid gap-4 md:grid-cols-3">
												<StaggerItem>
													<StatCard
														icon={Users2}
														label="Queue ownership"
														value={`${queueSummary.queue.length} leads`}
														accent={true}
													/>
												</StaggerItem>
												<StaggerItem>
													<StatCard
														icon={AlertTriangle}
														label="Escalations pending"
														value={
															queueSummary?.escalations?.filter((item) => !item.resolved_at)
																.length || 0
														}
													/>
												</StaggerItem>
												<StaggerItem>
													<StatCard
														icon={RefreshCcw}
														label="My workload rows"
														value={queueSummary?.workload?.length || 0}
													/>
												</StaggerItem>
											</StaggerContainer>

											<div className="flex flex-wrap items-center gap-3">
												<button
													type="button"
													onClick={refreshQueueSummary}
													className="inline-flex items-center gap-2 rounded-2xl bg-sky-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-sky-500/20 transition hover:bg-sky-600"
												>
													<RefreshCcw className="h-4 w-4" />
													Refresh queue
												</button>
												<div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
													{queueSummary.queue.length} leads currently in queue
												</div>
											</div>

											<LeadManager
												title="My Leads (CRM)"
												allowAssign={false}
												showOperations={true}
											/>
										</div>
									) : null}
								</div>

								<ScrollReveal as="section">
									<StaggerContainer className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
										<StaggerItem>
											<StatCard
												icon={CheckCircle2}
												label="Contracts"
												value={totals.contracts ?? 0}
											/>
										</StaggerItem>
										<StaggerItem>
											<StatCard icon={FileText} label="Documents" value={totals.documents ?? 0} />
										</StaggerItem>
										<StaggerItem>
											<StatCard icon={MessageSquareText} label="Active Conversations" value={totals.chats ?? 0} />
										</StaggerItem>
										<StaggerItem>
											<StatCard
												icon={Factory}
												label="Connected Factories"
												value={totals.partner_network ?? 0}
												accent={true}
											/>
										</StaggerItem>
									</StaggerContainer>
								</ScrollReveal>
							</section>

							<aside className="space-y-6">
								<div className="rounded-3xl border border-slate-200 bg-white/80 p-5 shadow-sm backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/60">
									<SectionTitle
										title="AI Suggested Reply"
										subtitle="Paste a short prompt or let the assistant draft a default reply."
										right={<Bot className="h-5 w-5 text-sky-500" />}
									/>

									<textarea
										value={aiPrompt}
										onChange={(e) => setAiPrompt(e.target.value)}
										rows={3}
										placeholder="Example: Reply to a buyer asking for MOQ and lead time."
										className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-4 focus:ring-sky-500/10 dark:border-slate-800 dark:bg-slate-950 dark:placeholder:text-slate-500"
									/>

									<div className="mt-3 flex flex-wrap gap-2">
										<button
											type="button"
											onClick={generateAiReply}
											disabled={aiLoading}
											className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-sky-500 to-cyan-400 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-sky-500/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
										>
											<Sparkles className="h-4 w-4" />
											{aiLoading ? (
												<ThreeDot
													variant="bounce"
													color="#337ab0"
													size="small"
													text=""
													textColor=""
												/>
											) : (
												"Generate"
											)}
										</button>
										<button
											type="button"
											onClick={copySuggestion}
											disabled={!aiSuggestion}
											className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-sky-400 hover:text-sky-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:text-slate-200"
										>
											<ClipboardCopy className="h-4 w-4" />
											Copy suggestion
										</button>
									</div>

									{aiError ? (
										<div className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/25 dark:text-red-200">
											{aiError}
										</div>
									) : null}

									<div className="mt-4">
										{aiSuggestion ? (
											<textarea
												value={aiSuggestion}
												onChange={(e) => setAiSuggestion(e.target.value)}
												rows={6}
												className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-500/10 dark:border-slate-800 dark:bg-slate-900/70"
											/>
										) : (
											<div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-400">
												No suggestion yet.
											</div>
										)}
									</div>

									{aiSuggestion && aiChecklist.length > 0 ? (
										<div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-100">
											<p className="font-medium">Missing-info checklist</p>
											<p className="mt-1 text-amber-800/90 dark:text-amber-200">
												{aiChecklist.join(", ")}
											</p>
										</div>
									) : null}

									<div className="mt-4 flex flex-wrap gap-2">
										<button
											type="button"
											onClick={approveSuggestion}
											disabled={aiLoading || !aiSuggestion}
											className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-sky-400 hover:text-sky-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:text-slate-200"
										>
											<ShieldCheck className="h-4 w-4" />
											Approve draft
										</button>
										<button
											type="button"
											onClick={sendSuggestion}
											disabled={aiLoading || !aiSuggestion}
											className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100"
										>
											<Send className="h-4 w-4" />
											One-click send
										</button>
									</div>

									<div className="mt-4 grid gap-3 sm:grid-cols-2">
										<div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm dark:border-slate-800 dark:bg-slate-900/60">
											<p className="text-slate-500 dark:text-slate-400">Approval</p>
											<p className="mt-1 font-medium">{approvalState?.status || "idle"}</p>
											{approvalState?.reason ? (
												<p className="mt-1 text-rose-600 dark:text-rose-300">{approvalState.reason}</p>
											) : null}
										</div>
										<div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm dark:border-slate-800 dark:bg-slate-900/60">
											<p className="text-slate-500 dark:text-slate-400">Send status</p>
											<p className="mt-1 font-medium">{sendState?.status || "idle"}</p>
											{sendState?.message ? (
												<p className="mt-1 text-slate-500 dark:text-slate-400">{sendState.message}</p>
											) : null}
										</div>
									</div>
								</div>
							</aside>
						</div>
					</ScrollReveal>
				</main>
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
