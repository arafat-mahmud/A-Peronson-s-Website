import { useMemo } from "react";

const DEFAULT_STEPS = [
	{ label: "Signups", key: "signups" },
	{ label: "Buyer Requests", key: "requests" },
	{ label: "Matched", key: "matched" },
	{ label: "Conversations", key: "conversations" },
	{ label: "Contracts", key: "contracts" },
];

export default function ConversionFunnel({ steps = DEFAULT_STEPS, data = {} }) {
	const funnel = useMemo(() => {
		const values = steps.map((s) => ({
			label: s.label,
			value: Number(data[s.key] ?? 0),
			key: s.key,
		}));
		const maxVal = Math.max(...values.map((v) => v.value), 1);
		return values.map((v, i) => {
			const prev = i > 0 ? values[i - 1].value : null;
			const pct = prev && prev > 0 ? Math.round((v.value / prev) * 100) : null;
			const barWidth = Math.max((v.value / maxVal) * 100, 3);
			return { ...v, pct, barWidth };
		});
	}, [steps, data]);

	const allZero = funnel.every((v) => v.value === 0);

	if (allZero) {
		return (
			<div className="rounded-2xl border border-slate-200 bg-white p-4 text-xs text-slate-400 dark:border-slate-700 dark:bg-slate-950/40">
				No conversion data yet.
			</div>
		);
	}

	return (
		<div className="space-y-2">
			{funnel.map((step, i) => (
				<div key={step.key} className="flex items-center gap-3">
					<div className="w-28 shrink-0 text-right text-[11px] font-medium text-slate-600 dark:text-slate-300">
						{step.label}
					</div>
					<div className="relative h-8 flex-1 overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800">
						<div
							className="flex h-full items-center justify-end rounded-xl bg-gradient-to-r from-sky-400 to-cyan-400 px-3 transition-all duration-500"
							style={{ width: `${step.barWidth}%`, minWidth: step.value > 0 ? "48px" : "0" }}
						>
							<span className="text-[11px] font-bold text-white drop-shadow-sm">{step.value}</span>
						</div>
					</div>
					<div className="w-16 shrink-0 text-right text-[11px] text-slate-400">
						{step.pct !== null ? `${step.pct}%` : "—"}
					</div>
				</div>
			))}
		</div>
	);
}
