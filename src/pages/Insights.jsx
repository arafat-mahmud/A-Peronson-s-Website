import {
	Activity,
	ArrowUpRight,
	BadgeInfo,
	BarChart3,
	Building2,
	CheckCircle2,
	ChevronRight,
	Crown,
	Download,
	Eye,
	FileDown,
	FileText,
	Gauge,
	Globe2,
	Link2,
	Lock,
	MousePointerClick,
	Radar,
	Search,
	ShieldCheck,
	Sparkles,
	TrendingUp,
	Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ThreeDot } from "react-loading-indicators";
import AccessDeniedState from "../components/AccessDeniedState.jsx";
import ScrollReveal from "../components/ScrollReveal.jsx";
import NeonAtom from "../components/ui/NeonAtom.jsx";
import useAnalyticsDashboard from "../hooks/useAnalyticsDashboard.js";
import { apiRequest, getCurrentUser, getToken } from "../lib/auth.js";
import { cn } from "../lib/cn.js";
import { logger } from "../lib/logger.js";

function formatNumber(value) {
	if (value === null || value === undefined || value === "") {
		return "--";
	}
	const n = Number(value);
	if (Number.isNaN(n)) {
		return String(value);
	}
	return new Intl.NumberFormat().format(n);
}

function formatPercent(value) {
	if (value === null || value === undefined || value === "") {
		return "--";
	}
	const n = Number(value);
	if (Number.isNaN(n)) {
		return `${value}%`;
	}
	return `${n}%`;
}

function formatDuration(seconds) {
	if (seconds === null || seconds === undefined || seconds === "") {
		return "--";
	}
	const n = Number(seconds);
	if (Number.isNaN(n)) {
		return `${seconds}s`;
	}
	return `${n}s`;
}

function formatDateTime(value) {
	if (!value) {
		return "--";
	}
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		return String(value);
	}
	return date.toLocaleString();
}

function safeLabel(value) {
	return String(value ?? "").replaceAll(/_/g, " ");
}

function downloadBlob(content, mimeType, filename) {
	const blob = new Blob([content], { type: mimeType });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	a.remove();
	URL.revokeObjectURL(url);
}

function renderCsvFromReport(report = {}) {
	const lines = [];
	lines.push("# Totals");
	lines.push("metric,value");
	const totals = report.totals || {};
	Object.keys(totals).forEach((k) => lines.push(`${k},${String(totals[k] ?? "")}`));
	lines.push("");

	if (Array.isArray(report.monthly_demand_trend)) {
		lines.push("# Monthly Demand Trend");
		lines.push("month,count");
		report.monthly_demand_trend.forEach((r) =>
			lines.push(`${r.month || ""},${Number(r.count || 0)}`),
		);
		lines.push("");
	}

	if (Array.isArray(report.top_categories_global)) {
		lines.push("# Top Categories (Global)");
		lines.push("category,count");
		report.top_categories_global.forEach((r) =>
			lines.push(`${r.label || ""},${Number(r.count || 0)}`),
		);
		lines.push("");
	}

	if (Array.isArray(report.price_range_demand)) {
		lines.push("# Price Range Demand");
		lines.push("bucket,count");
		report.price_range_demand.forEach((r) =>
			lines.push(`${r.bucket || ""},${Number(r.count || 0)}`),
		);
		lines.push("");
	}

	if (Array.isArray(report.top_search_categories_global)) {
		lines.push("# Top Search Categories (Global)");
		lines.push("label,count");
		report.top_search_categories_global.forEach((r) =>
			lines.push(`${r.label || ""},${Number(r.count || 0)}`),
		);
		lines.push("");
	}

	if (Array.isArray(report.top_categories_by_country)) {
		lines.push("# Top Categories By Country");
		lines.push("country,category,count");
		report.top_categories_by_country.forEach((c) => {
			const country = c.country || "";
			const categories = Array.isArray(c.categories) ? c.categories : [];
			categories.forEach((cat) =>
				lines.push(`${country},${cat.label || ""},${Number(cat.count || 0)}`),
			);
		});
		lines.push("");
	}

	return lines.join("\n");
}

function renderHtmlReport(report = {}) {
	const escape = (s) =>
		String(s || "")
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;");
	let html = `<html><head><meta charset="utf-8"><title>Analytics Export</title></head><body style="font-family:system-ui,Arial,Helvetica,sans-serif;padding:24px;">`;
	html += "<h1>Analytics Export</h1>";
	html += "<h2>Totals</h2><ul>";
	const totals = report.totals || {};
	Object.keys(totals).forEach((k) => {
		html += `<li><strong>${escape(k)}:</strong> ${escape(totals[k])}</li>`;
	});
	html += "</ul>";

	if (Array.isArray(report.monthly_demand_trend)) {
		html += `<h2>Monthly Demand Trend</h2><table border="1" cellpadding="6" cellspacing="0"><tr><th>Month</th><th>Count</th></tr>`;
		report.monthly_demand_trend.forEach((r) => {
			html += `<tr><td>${escape(r.month)}</td><td>${escape(r.count)}</td></tr>`;
		});
		html += "</table>";
	}

	if (Array.isArray(report.top_categories_global)) {
		html += "<h2>Top Categories (Global)</h2><ul>";
		report.top_categories_global.forEach((r) => {
			html += `<li>${escape(r.label)} — ${escape(r.count)}</li>`;
		});
		html += "</ul>";
	}

	html += `<p>Generated at ${new Date().toISOString()}</p>`;
	html += "</body></html>";
	return html;
}

function StatCard({ icon: Icon, label, value, hint = "", subtle = false, className = "" }) {
	return (
		<div
			className={cn(
				"group rounded-3xl border p-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl",
				subtle
					? "border-sky-200/70 bg-white/80 backdrop-blur dark:border-sky-500/20 dark:bg-slate-950/70"
					: "border-sky-200/70 bg-gradient-to-br from-white to-sky-50/80 dark:border-sky-500/20 dark:from-slate-950 dark:to-slate-900",
				className,
			)}
		>
			<div className="mb-4 flex items-start justify-between gap-3">
				<div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-100 text-sky-700 shadow-sm dark:bg-sky-500/10 dark:text-sky-300">
					{Icon ? <Icon className="h-5 w-5" /> : null}
				</div>
				<div className="rounded-full border border-sky-200/70 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-500 shadow-sm dark:border-sky-500/20 dark:bg-slate-950 dark:text-slate-300">
					{hint || "Analytics"}
				</div>
			</div>
			<div className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
				{value}
			</div>
			<div className="mt-1 text-sm text-slate-500 dark:text-slate-400">{label}</div>
		</div>
	);
}

function SectionHeader({ icon: Icon, title, subtitle, right }) {
	return (
		<div className="mb-4 flex items-center justify-between gap-4">
			<div className="flex items-center gap-3">
				<div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-sky-200 bg-white text-sky-700 shadow-sm dark:border-sky-500/20 dark:bg-slate-950 dark:text-sky-300">
					{Icon ? <Icon className="h-5 w-5" /> : null}
				</div>
				<div>
					<h2 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white">
						{title}
					</h2>
					{subtitle ? (
						<div className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</div>
					) : null}
				</div>
			</div>
			{right || null}
		</div>
	);
}

function Badge({ children, tone = "default", className = "" }) {
	const tones = {
		default:
			"border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-300",
		green:
			"border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300",
		rose: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300",
		amber:
			"border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300",
		slate:
			"border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300",
	};
	return (
		<span
			className={cn(
				"inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium",
				tones[tone],
				className,
			)}
		>
			{children}
		</span>
	);
}

function EmptyState({ icon: Icon, title, description }) {
	return (
		<div className="rounded-3xl border border-dashed border-sky-200 bg-white/70 p-6 text-center shadow-sm dark:border-sky-500/20 dark:bg-slate-950/60">
			<div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-100 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300">
				{Icon ? <Icon className="h-5 w-5" /> : null}
			</div>
			<div className="text-base font-semibold text-slate-900 dark:text-white">{title}</div>
			<div className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</div>
		</div>
	);
}

function MiniStat({ label, value }) {
	return (
		<div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/70">
			<div className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
				{label}
			</div>
			<div className="mt-0.5 font-medium text-slate-900 dark:text-white">{value}</div>
		</div>
	);
}

function PanelList({ title, items, emptyText, renderItem }) {
	return (
		<div className="rounded-3xl border border-sky-200/70 bg-slate-50/70 p-5 dark:border-sky-500/20 dark:bg-slate-900/60">
			<div className="mb-4 flex items-center justify-between gap-3">
				<h3 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h3>
				<ChevronRight className="h-4 w-4 text-slate-400" />
			</div>
			<div className="space-y-2">
				{Array.isArray(items) && items.length > 0 ? (
					items.map((item, idx) => (
						<div
							key={
								item.id ||
								item.label ||
								item.product_id ||
								item.country ||
								item.source_type ||
								item.page ||
								idx
							}
							className="rounded-2xl border border-slate-200/80 bg-white px-3 py-2 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-950/60"
						>
							{typeof renderItem === "function" ? renderItem(item) : String(item)}
						</div>
					))
				) : (
					<div className="text-sm text-slate-500 dark:text-slate-400">{emptyText}</div>
				)}
			</div>
		</div>
	);
}

export default function Insights() {
	const {
		dashboard,
		companyAnalytics,
		platformAnalytics,
		premiumInsights,
		subscription,
		isEnterprise,
		loading,
		error,
		forbidden,
	} = useAnalyticsDashboard();
	const currentUser = useMemo(() => getCurrentUser(), []);
	const [profileViewers, setProfileViewers] = useState([]);
	const [productViewers, setProductViewers] = useState([]);
	const [viewerLoading, setViewerLoading] = useState(false);
	const totals = dashboard?.totals || {};
	const byType = dashboard?.analytics_events?.by_type || {};
	const interactionSummary = dashboard?.interaction_summary || {};
	const topMetrics = Array.isArray(dashboard?.top_metrics) ? dashboard.top_metrics : [];
	const companyTotals = companyAnalytics?.totals || {};
	const topProducts = Array.isArray(companyAnalytics?.top_products)
		? companyAnalytics.top_products
		: [];
	const visitCountries = Array.isArray(companyAnalytics?.profile_visits_by_country)
		? companyAnalytics.profile_visits_by_country
		: [];
	const leadSources = Array.isArray(companyAnalytics?.top_lead_sources)
		? companyAnalytics.top_lead_sources
		: [];
	const platformTotals = platformAnalytics?.totals || {};
	const platformCategories = Array.isArray(platformAnalytics?.top_categories_global)
		? platformAnalytics.top_categories_global
		: [];
	const platformByCountry = Array.isArray(platformAnalytics?.top_categories_by_country)
		? platformAnalytics.top_categories_by_country
		: [];
	const platformPriceDemand = Array.isArray(platformAnalytics?.price_range_demand)
		? platformAnalytics.price_range_demand
		: [];
	const platformMonthly = Array.isArray(platformAnalytics?.monthly_demand_trend)
		? platformAnalytics.monthly_demand_trend
		: [];
	const platformSearchGlobal = Array.isArray(platformAnalytics?.top_search_categories_global)
		? platformAnalytics.top_search_categories_global
		: [];
	const platformSearchByCountry = Array.isArray(platformAnalytics?.top_search_categories_by_country)
		? platformAnalytics.top_search_categories_by_country
		: [];
	const platformTrending = Array.isArray(platformAnalytics?.trending_search_categories)
		? platformAnalytics.trending_search_categories
		: [];
	const searchEventCount = platformAnalytics?.search_event_count ?? 0;
	const searchDataReady = platformAnalytics?.search_data_ready ?? true;
	const searchMinEvents = platformAnalytics?.search_min_events ?? 25;
	const scopeLevel = String(platformAnalytics?.scope_level || "not_available");
	const suppressedFields = Array.isArray(platformAnalytics?.suppressed_fields)
		? platformAnalytics.suppressed_fields
		: [];
	const privacyThresholdApplied = Boolean(platformAnalytics?.privacy_threshold_applied);
	const premiumRole = premiumInsights?.role || "";
	const canExportAnalytics = currentUser?.capabilities?.leads?.export !== false;
	const [exportLoading, setExportLoading] = useState(false);
	const [exportError, setExportError] = useState("");

	useEffect(() => {
		const role = String(premiumRole || "").toLowerCase();
		if (!["factory", "buying_house"].includes(role)) {
			return;
		}
		const token = getToken();
		if (!(token && currentUser?.id)) {
			return;
		}

		async function loadViewers() {
			setViewerLoading(true);
			try {
				const productId = companyAnalytics?.top_products?.[0]?.product_id || "";
				const requests = [
					apiRequest(
						`/analytics/viewers?entity=profile&id=${encodeURIComponent(currentUser.id)}&limit=8`,
						{ token },
					),
				];
				if (productId) {
					requests.push(
						apiRequest(
							`/analytics/viewers?entity=product&id=${encodeURIComponent(productId)}&limit=8`,
							{ token },
						),
					);
				}
				const results = await Promise.all(requests);
				const profileData = results[0];
				const productData = results[1];
				setProfileViewers(Array.isArray(profileData?.items) ? profileData.items : []);
				setProductViewers(Array.isArray(productData?.items) ? productData.items : []);
			} catch (err) {
				logger.warn("Failed to load viewers:", err);
				setProfileViewers([]);
				setProductViewers([]);
			} finally {
				setViewerLoading(false);
			}
		}

		loadViewers();
	}, [premiumRole, currentUser?.id, companyAnalytics?.top_products]);

	const platformTopCategories = platformCategories
		.slice(0, 3)
		.map((c) => c.label)
		.filter(Boolean);

	if (loading) {
		return <NeonAtom fill={true} size={64} text="Loading analytics..." timeout={10000} />;
	}

	if (forbidden) {
		return (
			<div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-cyan-50 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900">
				<AccessDeniedState message={error} />
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-cyan-50 text-slate-900 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900 dark:text-white">
			<div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
				<div className="relative overflow-hidden rounded-[2rem] border border-sky-200/80 bg-white/85 p-6 shadow-[0_20px_80px_-30px_rgba(51,122,176,0.35)] backdrop-blur dark:border-sky-500/20 dark:bg-slate-950/70 lg:p-8">
					<div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(109,171,223,0.18),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(51,122,176,0.12),transparent_28%)]" />

					{error ? (
						<div className="relative mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 shadow-sm dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200">
							{error}
						</div>
					) : null}

					<div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
						<div>
							<div className="mb-3 inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-300">
								<Sparkles className="h-3.5 w-3.5" />
								Insights &amp; Analytics
							</div>
							<h1 className="text-3xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-4xl">
								Insights &amp; Analytics
							</h1>
							<p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
								Owner/admin intelligence dashboard for KPIs, interaction metrics, company analytics,
								platform analytics, and premium insights.
							</p>
						</div>
						<div className="flex flex-wrap items-center gap-2">
							<Badge tone={isEnterprise ? "green" : "slate"}>
								{isEnterprise ? "Enterprise Plan" : "Free Plan"}
							</Badge>
							<Badge tone={scopeLevel === "platform_admin_full_detail" ? "green" : "amber"}>
								Scope: {safeLabel(scopeLevel)}
							</Badge>
							<Badge tone={canExportAnalytics ? "green" : "rose"}>
								{canExportAnalytics ? "Export enabled" : "Export blocked"}
							</Badge>
						</div>
					</div>

					<ScrollReveal as="section">
						<div className="relative mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
							{(topMetrics.length > 0
								? topMetrics.slice(0, 5)
								: Object.entries(totals)
										.slice(0, 5)
										.map(([key, value]) => ({
											key,
											label: safeLabel(key),
											value: String(value ?? 0),
											hint: "",
										}))
							).map((m, idx) => (
								<StatCard
									key={m.key || idx}
									icon={[Gauge, Users, Link2, FileText, Building2][idx % 5]}
									label={m.label}
									value={formatNumber(m.value)}
									hint={m.hint || "Top metric"}
								/>
							))}
						</div>
					</ScrollReveal>

					<ScrollReveal as="section">
						<div className="relative mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
							<StatCard
								icon={Users}
								label="Total Buyer Requests"
								value={formatNumber(totals.buyer_requests ?? 0)}
								hint="Requests"
								subtle={true}
							/>
							<StatCard
								icon={Activity}
								label="Active Chats"
								value={formatNumber(totals.chats ?? 0)}
								hint="Chats"
								subtle={true}
							/>
							<StatCard
								icon={Link2}
								label="Connected Partners"
								value={formatNumber(totals.partner_network ?? 0)}
								hint="Partners"
								subtle={true}
							/>
							<StatCard
								icon={FileText}
								label="Contracts / Documents"
								value={`${formatNumber(totals.contracts ?? 0)} / ${formatNumber(totals.documents ?? 0)}`}
								hint="Docs"
								subtle={true}
							/>
						</div>
					</ScrollReveal>

					<ScrollReveal as="section">
						<div className="relative mt-7 grid gap-4 xl:grid-cols-4">
							<StatCard
								icon={Eye}
								label="Total Page Views"
								value={formatNumber(interactionSummary.total_page_views ?? 0)}
								hint="Views"
								subtle={true}
							/>
							<StatCard
								icon={MousePointerClick}
								label="Total Clicks"
								value={formatNumber(interactionSummary.total_clicks ?? 0)}
								hint="Clicks"
								subtle={true}
							/>
							<StatCard
								icon={TrendingUp}
								label="Avg Session Duration"
								value={formatDuration(interactionSummary.avg_session_duration_seconds ?? 0)}
								hint="Seconds"
								subtle={true}
							/>
							<div className="rounded-3xl border border-sky-200/70 bg-white/80 p-5 shadow-sm backdrop-blur dark:border-sky-500/20 dark:bg-slate-950/70">
								<div className="mb-4 flex items-center justify-between">
									<div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-100 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300">
										<Search className="h-5 w-5" />
									</div>
									<Badge tone="default">Top Pages</Badge>
								</div>
								<div className="space-y-2">
									{(interactionSummary.top_pages || []).length > 0 ? (
										interactionSummary.top_pages.map((row) => (
											<div
												key={row.page}
												className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-slate-50/80 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-900/60"
											>
												<span className="truncate text-slate-700 dark:text-slate-300">
													{row.page}
												</span>
												<span className="ml-3 font-medium text-slate-950 dark:text-white">
													{formatNumber(row.count)}
												</span>
											</div>
										))
									) : (
										<div className="text-sm text-slate-500 dark:text-slate-400">
											No page view data yet.
										</div>
									)}
								</div>
							</div>
						</div>
					</ScrollReveal>

					<ScrollReveal as="section">
						<div className="relative mt-7 rounded-[2rem] border border-sky-200/70 bg-white/80 p-5 shadow-sm backdrop-blur dark:border-sky-500/20 dark:bg-slate-950/70">
							<SectionHeader
								icon={Crown}
								title="Analytics Panel"
								subtitle={
									(isEnterprise ? "Enterprise" : subscription?.plan || "Free") +
									" — analytics and platform intelligence"
								}
								right={
									<Badge tone={isEnterprise ? "green" : "amber"}>
										{isEnterprise ? "Enterprise view" : "Free view"}
									</Badge>
								}
							/>

							{isEnterprise ? (
								<div className="grid gap-4 lg:grid-cols-2">
									<div className="rounded-3xl border border-sky-200/70 bg-slate-50/70 p-5 dark:border-sky-500/20 dark:bg-slate-900/60">
										<div className="mb-4 flex items-center justify-between">
											<h3 className="text-sm font-semibold text-slate-900 dark:text-white">
												Analytics Events by Type
											</h3>
											<Badge tone="default">Live</Badge>
										</div>
										<div className="space-y-2">
											{Object.keys(byType).length === 0 ? (
												<div className="text-sm text-slate-500 dark:text-slate-400">
													No analytics events recorded yet.
												</div>
											) : null}
											{Object.entries(byType).map(([type, count]) => (
												<div
													key={type}
													className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-white px-3 py-2 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-950/60"
												>
													<span className="truncate text-slate-700 dark:text-slate-300">
														{type}
													</span>
													<span className="font-medium text-slate-950 dark:text-white">
														{formatNumber(count)}
													</span>
												</div>
											))}
										</div>
									</div>

									<div className="rounded-3xl border border-sky-200/70 bg-gradient-to-br from-white to-sky-50/80 p-5 dark:border-sky-500/20 dark:from-slate-950 dark:to-slate-900">
										<div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
											<Download className="h-4 w-4 text-sky-600 dark:text-sky-300" />
											Export Controls
										</div>
										<div className="grid gap-3 sm:grid-cols-2">
											<button
												title={
													canExportAnalytics
														? scopeLevel === "platform_admin_full_detail"
															? "Export CSV"
															: "Export restricted to admin full-platform view"
														: "Export disabled by policy"
												}
												disabled={
													!canExportAnalytics ||
													scopeLevel !== "platform_admin_full_detail" ||
													exportLoading
												}
												onClick={async () => {
													if (!canExportAnalytics || scopeLevel !== "platform_admin_full_detail") {
														return;
													}
													setExportError("");
													setExportLoading(true);
													try {
														const token = getToken();
														const resp = await apiRequest("/export/analytics", {
															method: "POST",
															token,
														});
														const report = resp?.report || {};
														const csv = renderCsvFromReport(report);
														downloadBlob(
															csv,
															"text/csv;charset=utf-8;",
															`analytics_export_${Date.now()}.csv`,
														);
													} catch (err) {
														setExportError(err?.message || String(err));
													} finally {
														setExportLoading(false);
													}
												}}
												className={cn(
													"inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition",
													!canExportAnalytics ||
														scopeLevel !== "platform_admin_full_detail" ||
														exportLoading
														? "cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-600"
														: "bg-sky-600 text-white shadow-lg shadow-sky-600/20 hover:bg-sky-500",
												)}
											>
												{exportLoading ? (
													<ThreeDot
														variant="bounce"
														color="#337ab0"
														size="small"
														text=""
														textColor=""
													/>
												) : (
													<FileDown className="h-4 w-4" />
												)}
												{exportLoading ? "Exporting..." : "Export CSV"}
											</button>
											<button
												title={
													canExportAnalytics
														? scopeLevel === "platform_admin_full_detail"
															? "Download PDF Report"
															: "Export restricted to admin full-platform view"
														: "Export disabled by policy"
												}
												disabled={
													!canExportAnalytics ||
													scopeLevel !== "platform_admin_full_detail" ||
													exportLoading
												}
												onClick={async () => {
													if (!canExportAnalytics || scopeLevel !== "platform_admin_full_detail") {
														return;
													}
													setExportError("");
													setExportLoading(true);
													try {
														const token = getToken();
														const resp = await apiRequest("/export/analytics", {
															method: "POST",
															token,
														});
														const report = resp?.report || {};
														const html = renderHtmlReport(report);
														const blob = new Blob([html], {
															type: "text/html",
														});
														const url = URL.createObjectURL(blob);
														window.open(url, "_blank");
													} catch (err) {
														setExportError(err?.message || String(err));
													} finally {
														setExportLoading(false);
													}
												}}
												className={cn(
													"inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition",
													!canExportAnalytics ||
														scopeLevel !== "platform_admin_full_detail" ||
														exportLoading
														? "cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-600"
														: "border border-sky-200 bg-white text-sky-700 shadow-sm hover:bg-sky-50 dark:border-sky-500/20 dark:bg-slate-950 dark:text-sky-300 dark:hover:bg-slate-900",
												)}
											>
												{exportLoading ? (
													<ThreeDot
														variant="bounce"
														color="#337ab0"
														size="small"
														text=""
														textColor=""
													/>
												) : (
													<FileText className="h-4 w-4" />
												)}
												{exportLoading ? "Preparing..." : "Download PDF Report"}
											</button>
										</div>
										{exportError ? (
											<div className="mt-3 text-xs text-rose-600 dark:text-rose-300">
												{exportError}
											</div>
										) : null}
										{canExportAnalytics ? null : (
											<div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
												Export is disabled by organization policy.
											</div>
										)}
									</div>
								</div>
							) : (
								<div className="grid gap-4 lg:grid-cols-[1.4fr_0.8fr]">
									<div className="rounded-3xl border border-sky-200 bg-gradient-to-br from-sky-50 to-white p-5 dark:border-sky-500/20 dark:from-sky-500/10 dark:to-slate-950">
										<div className="flex items-start gap-4">
											<div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sky-100 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300">
												<Crown className="h-5 w-5" />
											</div>
											<div>
												<div className="text-base font-semibold text-slate-950 dark:text-white">
													{subscription?.plan === "premium"
														? "Premium plan"
														: "Upgrade to unlock advanced analytics"}
												</div>
												<p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
													{subscription?.plan === "premium"
														? "You are on the Premium plan. Upgrade to Enterprise for unlimited advanced filters, expanded analytics, and exports."
														: `You are currently on ${subscription?.plan || "free"}. Upgrade to Premium/Enterprise to unlock unlimited advanced filters, expanded analytics, and exports.`}
												</p>
											</div>
										</div>
									</div>
									<div className="flex items-center justify-center rounded-3xl border border-dashed border-sky-200 bg-white/70 p-5 dark:border-sky-500/20 dark:bg-slate-950/60">
										<button
											onClick={() => (window.location.href = "/pricing")}
											className="inline-flex items-center gap-2 rounded-2xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-600/20 transition hover:bg-sky-500"
										>
											Upgrade to Enterprise <ArrowUpRight className="h-4 w-4" />
										</button>
									</div>
								</div>
							)}
						</div>
					</ScrollReveal>

					<ScrollReveal as="section">
						<div className="relative mt-7 rounded-[2rem] border border-sky-200/70 bg-white/80 p-5 shadow-sm backdrop-blur dark:border-sky-500/20 dark:bg-slate-950/70">
							<SectionHeader
								icon={Radar}
								title="Premium Insights"
								right={
									<Badge tone={premiumInsights ? "green" : "amber"}>
										{premiumRole || "premium"}
									</Badge>
								}
							/>

							{premiumInsights ? (
								<div className="space-y-6">
									<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
										{premiumInsights.request_performance ? (
											<StatCard
												icon={CheckCircle2}
												label="Request Match Rate"
												value={formatPercent(
													premiumInsights.request_performance.match_rate_pct ?? 0,
												)}
												hint="Matched buyer requests"
												subtle={true}
											/>
										) : null}
										{premiumInsights.smart_matching_success_rate ? (
											<StatCard
												icon={ShieldCheck}
												label="Smart Match Success"
												value={formatPercent(
													premiumInsights.smart_matching_success_rate.match_rate_pct ?? 0,
												)}
												hint="Matched requests converted"
												subtle={true}
											/>
										) : null}
										{premiumInsights.request_performance_insights ? (
											<StatCard
												icon={Activity}
												label="Open Requests"
												value={formatNumber(
													premiumInsights.request_performance_insights.open_requests ?? 0,
												)}
												hint="Requests still open"
												subtle={true}
											/>
										) : null}
										{premiumInsights.request_performance_insights ? (
											<StatCard
												icon={Gauge}
												label="Response Speed"
												value={
													premiumInsights.request_performance_insights.response_speed ||
													premiumInsights.request_performance_insights.response_speed_hours ||
													"--"
												}
												hint="Avg response time"
												subtle={true}
											/>
										) : null}
										{premiumInsights.request_performance ? (
											<StatCard
												icon={TrendingUp}
												label="Avg Response Time"
												value={premiumInsights.request_performance.avg_response_time || "--"}
												hint="Premium response speed"
												subtle={true}
											/>
										) : null}
										{premiumInsights.buyer_conversion_insights ? (
											<StatCard
												icon={TrendingUp}
												label="Conversion Rate"
												value={formatPercent(
													premiumInsights.buyer_conversion_insights.conversion_rate_pct ?? 0,
												)}
												hint="Deals closed"
												subtle={true}
											/>
										) : null}
										{premiumInsights.advanced_analytics ? (
											<StatCard
												icon={Eye}
												label="Product Views"
												value={formatNumber(premiumInsights.advanced_analytics.product_views ?? 0)}
												hint="Premium visibility"
												subtle={true}
											/>
										) : null}
										{premiumInsights.advanced_analytics ? (
											<StatCard
												icon={MousePointerClick}
												label="Inquiry Rate"
												value={premiumInsights.advanced_analytics.inquiry_rate ?? "--"}
												hint="Inbound inquiries per view"
												subtle={true}
											/>
										) : null}
										{premiumInsights.buyer_interest_analytics ? (
											<StatCard
												icon={Users}
												label="Buyer Interest"
												value={formatNumber(
													premiumInsights.buyer_interest_analytics.unique_buyers ?? 0,
												)}
												hint="Unique buyers reached"
												subtle={true}
											/>
										) : null}
										{premiumInsights.buyer_interest_analytics ? (
											<StatCard
												icon={Link2}
												label="Matched Requests"
												value={formatNumber(
													premiumInsights.buyer_interest_analytics.matched_requests ?? 0,
												)}
												hint="Requests matched"
												subtle={true}
											/>
										) : null}
										{premiumInsights.buyer_communication_insights ? (
											<StatCard
												icon={Activity}
												label="Inbound Messages"
												value={formatNumber(
													premiumInsights.buyer_communication_insights.inbound_messages ?? 0,
												)}
												hint="Buyer communications"
												subtle={true}
											/>
										) : null}
										{premiumInsights.buyer_communication_insights ? (
											<StatCard
												icon={FileText}
												label="Total Messages"
												value={formatNumber(
													premiumInsights.buyer_communication_insights.total_messages ?? 0,
												)}
												hint="All thread messages"
												subtle={true}
											/>
										) : null}
										{premiumInsights.buyer_communication_insights ? (
											<StatCard
												icon={Gauge}
												label="Avg Reply Time"
												value={
													premiumInsights.buyer_communication_insights.avg_response_time || "--"
												}
												hint="Response speed"
												subtle={true}
											/>
										) : null}
										{premiumInsights.order_completion_certification ? (
											<StatCard
												icon={BadgeInfo}
												label="Completion Cert"
												value={premiumInsights.order_completion_certification.status || "pending"}
												hint="Order completion status"
												subtle={true}
											/>
										) : null}
										{premiumInsights.buyer_conversion_insights ? (
											<StatCard
												icon={BarChart3}
												label="Contracts Signed"
												value={formatNumber(
													premiumInsights.buyer_conversion_insights.contracts_signed ?? 0,
												)}
												hint="Closed deals"
												subtle={true}
											/>
										) : null}
									</div>

									{premiumInsights?.agent_performance_analytics?.length > 0 ? (
										<div className="rounded-3xl border border-sky-200/70 bg-slate-50/70 p-5 dark:border-sky-500/20 dark:bg-slate-900/60">
											<div className="mb-4 flex items-center justify-between">
												<h3 className="text-sm font-semibold text-slate-900 dark:text-white">
													{premiumInsights?.agent_performance_analytics?.length === 1
														? "Agent Performance"
														: "Team Performance"}
												</h3>
												<Badge tone="default">
													{premiumInsights?.agent_performance_analytics?.length || 0} members
												</Badge>
											</div>
											<div className="space-y-2">
												{premiumInsights.agent_performance_analytics.map((agent) => (
													<div
														key={agent.agent_id}
														className="rounded-2xl border border-slate-200/80 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-950/60"
													>
														<div className="flex flex-wrap items-center justify-between gap-3">
															<div className="font-medium text-slate-950 dark:text-white">
																{agent.name || agent.agent_id}
															</div>
															<div className="text-sm text-slate-600 dark:text-slate-300">
																{formatNumber(agent.assigned_leads ?? 0)} leads
															</div>
														</div>
														<div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
															<MiniStat label="Agent" value={agent.agent_id || "--"} />
															<MiniStat
																label="Assigned"
																value={formatNumber(agent.assigned_leads ?? 0)}
															/>
															<MiniStat
																label="Closed"
																value={formatNumber(agent.closed_leads ?? 0)}
															/>
															<MiniStat
																label="Confirmed"
																value={formatNumber(agent.orders_confirmed ?? 0)}
															/>
															<MiniStat
																label="Converted"
																value={formatNumber(agent.conversions ?? 0)}
															/>
														</div>
													</div>
												))}
											</div>
										</div>
									) : null}

									{premiumInsights?.buying_pattern_analysis?.length > 0 ? (
										<div className="rounded-3xl border border-sky-200/70 bg-slate-50/70 p-5 dark:border-sky-500/20 dark:bg-slate-900/60">
											<h3 className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">
												Buying Pattern Analysis
											</h3>
											<div className="flex flex-wrap gap-2">
												{premiumInsights.buying_pattern_analysis.map((row) => (
													<Badge key={row.label} tone="slate">
														{row.label} - {formatNumber(row.count)}
													</Badge>
												))}
											</div>
										</div>
									) : null}

									{premiumInsights?.lead_distribution ? (
										<div className="rounded-3xl border border-sky-200/70 bg-slate-50/70 p-5 dark:border-sky-500/20 dark:bg-slate-900/60">
											<h3 className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">
												Lead Distribution
											</h3>
											<div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
												{Object.entries(premiumInsights.lead_distribution).map(
													([agentId, count]) => (
														<div
															key={agentId}
															className="rounded-2xl border border-slate-200/80 bg-white px-3 py-2 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-950/60"
														>
															<span className="text-slate-600 dark:text-slate-300">{agentId}</span>
															<span className="ml-2 font-semibold text-slate-950 dark:text-white">
																{formatNumber(count)}
															</span>
														</div>
													),
												)}
											</div>
										</div>
									) : null}

									{["factory", "buying_house"].includes(String(premiumRole || "").toLowerCase()) ? (
										<div className="grid gap-4 lg:grid-cols-2">
											<div className="rounded-3xl border border-sky-200/70 bg-slate-50/70 p-5 dark:border-sky-500/20 dark:bg-slate-900/60">
												<div className="mb-4 flex items-center justify-between">
													<h3 className="text-sm font-semibold text-slate-900 dark:text-white">
														Recent Profile Viewers
													</h3>
													<Badge tone="default">Limit 8</Badge>
												</div>
												{viewerLoading ? (
													<ThreeDot
														variant="bounce"
														color="#337ab0"
														size="medium"
														style={{ fontSize: "24px" }}
														text=""
														textColor=""
													/>
												) : (
													<div className="space-y-2">
														{profileViewers.length > 0 ? (
															profileViewers.map((row) => (
																<div
																	key={row.viewer_id}
																	className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-white px-3 py-2 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-950/60"
																>
																	<span className="truncate text-slate-700 dark:text-slate-300">
																		{row.viewer?.name || row.viewer_id}
																	</span>
																	<span className="ml-3 shrink-0 text-xs text-slate-500 dark:text-slate-400">
																		{formatDateTime(row.viewed_at)}
																	</span>
																</div>
															))
														) : (
															<div className="text-sm text-slate-500 dark:text-slate-400">
																No viewers yet.
															</div>
														)}
													</div>
												)}
											</div>
											<div className="rounded-3xl border border-sky-200/70 bg-slate-50/70 p-5 dark:border-sky-500/20 dark:bg-slate-900/60">
												<div className="mb-4 flex items-center justify-between">
													<h3 className="text-sm font-semibold text-slate-900 dark:text-white">
														Recent Product Viewers
													</h3>
													<Badge tone="default">Limit 8</Badge>
												</div>
												{viewerLoading ? (
													<ThreeDot
														variant="bounce"
														color="#337ab0"
														size="medium"
														style={{ fontSize: "24px" }}
														text=""
														textColor=""
													/>
												) : (
													<div className="space-y-2">
														{productViewers.length > 0 ? (
															productViewers.map((row) => (
																<div
																	key={row.viewer_id}
																	className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-white px-3 py-2 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-950/60"
																>
																	<span className="truncate text-slate-700 dark:text-slate-300">
																		{row.viewer?.name || row.viewer_id}
																	</span>
																	<span className="ml-3 shrink-0 text-xs text-slate-500 dark:text-slate-400">
																		{formatDateTime(row.viewed_at)}
																	</span>
																</div>
															))
														) : (
															<div className="text-sm text-slate-500 dark:text-slate-400">
																No viewers yet.
															</div>
														)}
													</div>
												)}
											</div>
										</div>
									) : null}
								</div>
							) : (
								<EmptyState
									icon={Lock}
									title={
										subscription?.plan === "enterprise"
											? "Premium analytics not available"
											: "Premium analytics locked"
									}
									description={
										subscription?.plan === "enterprise"
											? "Premium analytics data is not available at this time. Check back later."
											: `Premium analytics unlock buying patterns, conversion insights, and agent performance. Upgrade from ${subscription?.plan || "free"} to Premium to view.`
									}
								/>
							)}
						</div>
					</ScrollReveal>

					<ScrollReveal as="section">
						{companyAnalytics ? (
							<div className="relative mt-7 rounded-[2rem] border border-sky-200/70 bg-white/80 p-5 shadow-sm backdrop-blur dark:border-sky-500/20 dark:bg-slate-950/70">
								<SectionHeader
									icon={Building2}
									title="Company Analytics"
									right={
										companyAnalytics.limited ? (
											<Badge tone="amber">Limited</Badge>
										) : (
											<Badge tone="green">Full</Badge>
										)
									}
								/>

								{companyAnalytics.limited ? (
									<div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
										Advanced analytics (who viewed, inquiry rate, conversion metrics) require the{" "}
										<strong>{subscription?.plan === "premium" ? "Enterprise" : "Premium"}</strong>{" "}
										plan. You are currently on <strong>{subscription?.plan || "free"}</strong>.
									</div>
								) : null}

								<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
									<StatCard
										icon={Eye}
										label="Profile Visits"
										value={formatNumber(companyTotals.profile_visits ?? 0)}
										hint="Profiles"
										subtle={true}
									/>
									<StatCard
										icon={Gauge}
										label="Product Views"
										value={formatNumber(companyTotals.product_views ?? 0)}
										hint="Products"
										subtle={true}
									/>
									<StatCard
										icon={Activity}
										label="Inbound Messages"
										value={formatNumber(companyTotals.inbound_messages ?? 0)}
										hint="Messages"
										subtle={true}
									/>
									<StatCard
										icon={TrendingUp}
										label="Conversion Rate"
										value={formatPercent(companyTotals.conversion_rate_pct ?? 0)}
										hint="Percent"
										subtle={true}
									/>
									<StatCard
										icon={Gauge}
										label="Avg Response Time"
										value={companyTotals.avg_response_time || "--"}
										hint="Response"
										subtle={true}
									/>
								</div>

								<div className="mt-5 grid gap-4 lg:grid-cols-3">
									<PanelList
										title="Top Viewed Products"
										items={topProducts}
										emptyText="No product views yet."
										renderItem={(item) => (
											<div className="flex items-center justify-between">
												<span className="truncate">{item.title}</span>
												<span className="ml-3 font-semibold text-slate-950 dark:text-white">
													{formatNumber(item.views)}
												</span>
											</div>
										)}
									/>
									<PanelList
										title="Profile Visits by Country"
										items={visitCountries}
										emptyText="No visits yet."
										renderItem={(item) => (
											<div className="flex items-center justify-between">
												<span className="truncate">{item.country}</span>
												<span className="ml-3 font-semibold text-slate-950 dark:text-white">
													{formatNumber(item.count)}
												</span>
											</div>
										)}
									/>
									<PanelList
										title="Top Lead Sources"
										items={leadSources}
										emptyText="No lead source data yet."
										renderItem={(item) => (
											<div>
												<div className="flex items-center justify-between">
													<span className="truncate">{item.label}</span>
													<span className="ml-3 font-semibold text-slate-950 dark:text-white">
														{formatNumber(item.count)}
													</span>
												</div>
												{item.source_type ? (
													<div className="text-[10px] text-slate-400">
														{safeLabel(item.source_type)}
													</div>
												) : null}
											</div>
										)}
									/>
								</div>
							</div>
						) : null}
					</ScrollReveal>

					<ScrollReveal as="section">
						{platformAnalytics ? (
							<div className="relative mt-7 rounded-[2rem] border border-sky-200/70 bg-white/80 p-5 shadow-sm backdrop-blur dark:border-sky-500/20 dark:bg-slate-950/70">
								<SectionHeader
									icon={Globe2}
									title="Platform Analytics"
									right={<Badge tone="default">Privacy-aware</Badge>}
								/>

								<div className="mb-4 grid gap-3 lg:grid-cols-3">
									<div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-800 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-200">
										<div className="font-semibold">Scope: {safeLabel(scopeLevel)}</div>
										<div className="mt-1 text-xs">
											Privacy thresholds: {privacyThresholdApplied ? "applied" : "not applied"}.
											{suppressedFields.length > 0
												? ` Suppressed controls: ${suppressedFields.join(", ")}.`
												: " No suppressed slices in this snapshot."}
										</div>
									</div>
									<div className="rounded-2xl border border-sky-200 bg-white p-4 text-sm text-slate-700 shadow-sm dark:border-sky-500/20 dark:bg-slate-950 dark:text-slate-300">
										{suppressedFields.length > 0 ? (
											<>
												<div className="font-semibold">Suppressed controls</div>
												<div className="mt-1 text-xs">{suppressedFields.join(", ")}</div>
											</>
										) : (
											<div>No suppressed slices in this snapshot.</div>
										)}
									</div>
									<div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
										{privacyThresholdApplied ? (
											<div title="Anonymized platform data: identifiers removed/suppressed according to privacy policy">
												<span className="inline-flex items-center gap-2 font-semibold">
													<BadgeInfo className="h-4 w-4" /> Anonymized platform data
												</span>
												<div className="mt-1 text-xs">
													Identifiers removed/suppressed according to privacy policy
												</div>
											</div>
										) : (
											<div>No anonymization threshold active.</div>
										)}
									</div>
								</div>

								{searchDataReady ? null : (
									<div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
										Search trends are still warming up. We need more search activity to show
										reliable demand insights. Current events: {searchEventCount}/{searchMinEvents}.
										Showing proxy demand from buyer requests.
									</div>
								)}

								<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
									<StatCard
										icon={Users}
										label="Total Buyer Requests"
										value={formatNumber(platformTotals.buyer_requests ?? 0)}
										hint="Platform"
										subtle={true}
									/>
									<StatCard
										icon={TrendingUp}
										label="Repeat Buyer Rate"
										value={formatPercent(platformTotals.repeat_buyer_rate ?? 0)}
										hint="Retention"
										subtle={true}
									/>
									<StatCard
										icon={Sparkles}
										label="Top Categories"
										value={
											platformTopCategories.length > 0 ? platformTopCategories.join(", ") : "--"
										}
										hint="Global"
										subtle={true}
									/>
								</div>

								<div className="mt-5 grid gap-4 lg:grid-cols-2">
									{scopeLevel === "platform_summary_aggregated" ? (
										<div className="rounded-3xl border border-dashed border-sky-200 bg-white/70 p-6 text-sm text-slate-600 shadow-sm dark:border-sky-500/20 dark:bg-slate-950/60 dark:text-slate-300 lg:col-span-2">
											Detailed geography and segment breakdowns are hidden for this role. Switch to
											organization-scoped or admin scope for deeper cuts.
										</div>
									) : (
										<div className="grid gap-4 lg:grid-cols-2 lg:col-span-2">
											<PanelList
												title="Top Categories by Country"
												items={platformByCountry}
												emptyText="No data yet."
												renderItem={(item) => (
													<div>
														<div className="font-medium text-slate-900 dark:text-white">
															{item.country}
														</div>
														<div className="text-xs text-slate-500 dark:text-slate-400">
															{(item.categories || []).map((c) => c.label).join(", ") || "--"}
														</div>
													</div>
												)}
											/>
											<PanelList
												title="Price Range Demand"
												items={platformPriceDemand}
												emptyText="No price-range data yet."
												renderItem={(item) => (
													<div className="flex items-center justify-between">
														<span className="truncate">{item.bucket}</span>
														<span className="ml-3 font-semibold text-slate-950 dark:text-white">
															{formatNumber(item.count)}
														</span>
													</div>
												)}
											/>
										</div>
									)}
								</div>

								<div className="mt-5 grid gap-4 lg:grid-cols-2">
									<PanelList
										title="Top Search Categories"
										items={platformSearchGlobal}
										emptyText="No search data yet."
										renderItem={(item) => (
											<div className="flex items-center justify-between">
												<span className="truncate">{item.label}</span>
												<span className="ml-3 font-semibold text-slate-950 dark:text-white">
													{formatNumber(item.count)}
												</span>
											</div>
										)}
									/>
									<PanelList
										title="Trending Searches (30d)"
										items={platformTrending}
										emptyText="No trend data yet."
										renderItem={(item) => (
											<div className="flex items-center justify-between">
												<span className="truncate">{item.label}</span>
												<span className="ml-3 font-semibold text-slate-950 dark:text-white">
													{item.delta}
												</span>
											</div>
										)}
									/>
								</div>

								<div className="mt-5 grid gap-4 lg:grid-cols-2">
									<PanelList
										title="Search Categories by Country"
										items={platformSearchByCountry}
										emptyText="No search data yet."
										renderItem={(item) => (
											<div>
												<div className="font-medium text-slate-900 dark:text-white">
													{item.country}
												</div>
												<div className="text-xs text-slate-500 dark:text-slate-400">
													{(item.categories || []).map((c) => c.label).join(", ") || "--"}
												</div>
											</div>
										)}
									/>
									<PanelList
										title="Monthly Demand Trend"
										items={platformMonthly}
										emptyText="No monthly data yet."
										renderItem={(item) => (
											<div className="flex items-center justify-between">
												<span className="truncate">{item.month}</span>
												<span className="ml-3 font-semibold text-slate-950 dark:text-white">
													{formatNumber(item.count)}
												</span>
											</div>
										)}
									/>
								</div>
							</div>
						) : null}
					</ScrollReveal>
				</div>
			</div>
		</div>
	);
}
