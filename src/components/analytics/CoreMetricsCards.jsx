import {
	Activity,
	ArrowUpRight,
	BadgeCheck,
	BarChart3,
	Clock,
	Handshake,
	TrendingUp,
	Users,
} from "lucide-react";
import { ThreeDot } from "react-loading-indicators";
import { useCoreMetrics } from "../../hooks/useCoreMetrics.js";

const ICON_MAP = {
	Handshake,
	TrendingUp,
	Clock,
	BarChart3,
	BadgeCheck,
	Users,
	Activity,
};

function SkeletonCard() {
	return (
		<div className="animate-pulse rounded-3xl border border-slate-200/80 bg-white/80 p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/70">
			<div className="mb-4 h-11 w-11 rounded-2xl bg-slate-200 dark:bg-slate-700" />
			<div className="mb-2 h-6 w-20 rounded bg-slate-200 dark:bg-slate-700" />
			<div className="h-4 w-32 rounded bg-slate-200 dark:bg-slate-700" />
		</div>
	);
}

function MetricCard({ metric }) {
	const IconComponent = ICON_MAP[metric.icon] || Activity;
	const value = metric.value ?? "--";
	const displayValue = metric.unit ? `${value}${metric.unit}` : String(value);

	let hintColor = "text-slate-500 dark:text-slate-400";
	if (metric.key === "trusted_deal_score" || metric.key === "buyer_supplier_match_rate") {
		const num = Number(metric.value);
		if (!Number.isNaN(num)) {
			hintColor =
				num >= 70
					? "text-emerald-600 dark:text-emerald-400"
					: num >= 40
						? "text-amber-600 dark:text-amber-400"
						: "text-rose-600 dark:text-rose-400";
		}
	}

	return (
		<div className="group rounded-3xl border border-sky-200/70 bg-gradient-to-br from-white to-sky-50/80 p-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl dark:border-sky-500/20 dark:from-slate-950 dark:to-slate-900">
			<div className="mb-4 flex items-start justify-between gap-3">
				<div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-100 text-sky-700 shadow-sm dark:bg-sky-500/10 dark:text-sky-300">
					{IconComponent ? <IconComponent className="h-5 w-5" /> : null}
				</div>
				{metric.hint ? (
					<div className="rounded-full border border-sky-200/70 bg-white px-2.5 py-1 text-[11px] font-medium shadow-sm dark:border-sky-500/20 dark:bg-slate-950 dark:text-slate-300">
						{metric.hint}
					</div>
				) : null}
			</div>
			<div className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
				{displayValue}
			</div>
			<div className="mt-1 text-sm text-slate-500 dark:text-slate-400">{metric.label}</div>
		</div>
	);
}

export default function CoreMetricsCards() {
	const { metrics, loading, error } = useCoreMetrics();

	if (loading) {
		return (
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{Array.from({ length: 5 }).map((_, i) => (
					<SkeletonCard key={i} />
				))}
			</div>
		);
	}

	if (error) {
		return (
			<div className="rounded-3xl border border-rose-200/80 bg-rose-50/80 p-5 text-sm text-rose-700 dark:border-rose-800/40 dark:bg-rose-950/30 dark:text-rose-300">
				Failed to load analytics: {error}
			</div>
		);
	}

	if (metrics.length === 0) {
		return null;
	}

	return (
		<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{metrics.map((m) => (
				<MetricCard key={m.key} metric={m} />
			))}
		</div>
	);
}
