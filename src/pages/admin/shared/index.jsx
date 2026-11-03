import { ArrowUpRight, CheckCircle2, RefreshCw, Sparkles } from "lucide-react";
import { Mosaic, ThreeDot } from "react-loading-indicators";
import { cn } from "../../../lib/cn.js";
import { accentClasses } from "../../../theme/theme-utils.js";

export function SkeletonChart({ height = 320 }) {
	return (
		<div className="flex items-center justify-center" style={{ height }}>
			<Mosaic color="#337ab0" size="large" style={{ fontSize: "40px" }} text="" textColor="" />
		</div>
	);
}

export function SectionTitle({ title, subtitle, icon: TitleIcon }) {
	return (
		<div className="mb-4 flex items-center justify-between gap-4">
			<div>
				<div className="flex items-center gap-2">
					<div className="rounded-2xl border border-sky-400/20 bg-sky-400/10 p-2 text-sky-300 shadow-lg shadow-sky-500/10">
						<TitleIcon className="h-4 w-4" />
					</div>
					<h2 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white">
						{title}
					</h2>
				</div>
				<p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
			</div>
		</div>
	);
}

export function MetricCard({ label, value, hint, icon: CardIcon, loading = false }) {
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

export function Pill({ children }) {
	return (
		<span className="inline-flex items-center gap-2 rounded-full border border-sky-500/15 bg-sky-500/8 px-3 py-1 text-xs font-medium text-sky-700 shadow-sm shadow-sky-500/5 dark:text-sky-300">
			{children}
		</span>
	);
}

export function BenefitCard({ title, items, accent = "sky" }) {
	const ac = accentClasses(accent);
	return (
		<div className="rounded-3xl border border-slate-200/80 bg-white/80 p-6 shadow-[0_20px_60px_-30px_rgba(55,115,168,0.28)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/70">
			<div className="flex items-center justify-between gap-4">
				<div>
					<h3 className="text-base font-semibold text-slate-900 dark:text-white">{title}</h3>
					<p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
						Premium capability stack and operational advantages.
					</p>
				</div>
				<div className={`rounded-2xl border p-2 ${ac.border} ${ac.bg} ${ac.text}`}>
					<Sparkles className="h-4 w-4" />
				</div>
			</div>
			<div className="mt-5 grid gap-2 sm:grid-cols-2">
				{items.map((item) => (
					<div
						key={item}
						className="flex items-start gap-2 rounded-2xl border border-slate-200/70 bg-slate-50/90 p-3 text-sm text-slate-700 dark:border-white/5 dark:bg-white/5 dark:text-slate-300"
					>
						<CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-sky-500" />
						<span>{item}</span>
					</div>
				))}
			</div>
		</div>
	);
}

export function AdminSecurityGate({
	open,
	message,
	mfaCode,
	setMfaCode,
	stepUpCode,
	setStepUpCode,
	passkeyBusy,
	notice,
	onPasskeyAuth,
	onUnlock,
	onDecline,
}) {
	if (!open) {
		return null;
	}

	return (
		<div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/90 p-6 backdrop-blur-md">
			<div className="admin-panel admin-sweep w-full max-w-lg rounded-3xl p-6 shadow-2xl">
				<h2 className="text-lg font-bold text-white">Security verification required</h2>
				<p className="mt-2 text-sm text-slate-300">
					{message ||
						"Admin security verification required. Use any one of the following methods to unlock the panel."}
				</p>

				<div className="mt-5 grid grid-cols-1 gap-3">
					<label className="text-xs text-slate-400">
						MFA code
						<input
							value={mfaCode}
							onChange={(e) => setMfaCode(e.target.value)}
							className="mt-1 w-full rounded-xl bg-slate-900/90 px-3 py-2 text-sm text-white outline-none ring-1 ring-slate-700 focus:ring-sky-500"
							placeholder="Enter MFA code"
						/>
					</label>
					<label className="text-xs text-slate-400">
						Passkey
						<button
							type="button"
							onClick={onPasskeyAuth}
							disabled={passkeyBusy}
							className="mt-1 w-full rounded-xl bg-indigo-500/80 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
						>
							{passkeyBusy ? "Opening passkey..." : "Verify with passkey"}
						</button>
					</label>
					<label className="text-xs text-slate-400">
						Setup/step-up code
						<input
							value={stepUpCode}
							onChange={(e) => setStepUpCode(e.target.value)}
							className="mt-1 w-full rounded-xl bg-slate-900/90 px-3 py-2 text-sm text-white outline-none ring-1 ring-slate-700 focus:ring-sky-500"
							placeholder="Enter setup code"
						/>
					</label>
				</div>

				{notice ? <p className="mt-3 text-xs text-sky-200">{notice}</p> : null}

				<div className="mt-5 flex flex-wrap gap-2">
					<button
						type="button"
						onClick={onUnlock}
						disabled={passkeyBusy}
						className="rounded-full bg-sky-500 px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
					>
						Unlock access
					</button>
					<button
						type="button"
						onClick={onDecline}
						disabled={passkeyBusy}
						className="rounded-full border border-slate-600 px-4 py-2 text-xs font-semibold text-slate-200 disabled:opacity-60"
					>
						Decline
					</button>
				</div>
			</div>
		</div>
	);
}

export function SkeletonLine({ className = "" }) {
	return <div className={`skeleton rounded-xl ${className}`} />;
}

export function Badge({ children, tone = "default", darkMode = true }) {
	const base = darkMode
		? {
				default: "border-slate-800 bg-slate-900 text-slate-300",
				live: "border-emerald-400/30 bg-emerald-500/10 text-emerald-300",
				info: "border-sky-400/30 bg-sky-500/10 text-sky-300",
				danger: "border-rose-400/30 bg-rose-500/10 text-rose-300",
			}
		: {
				default: "border-slate-200 bg-slate-50 text-slate-700",
				live: "border-emerald-200 bg-emerald-50 text-emerald-700",
				info: "border-sky-200 bg-sky-50 text-sky-700",
				danger: "border-rose-200 bg-rose-50 text-rose-700",
			};

	return (
		<span
			className={cn(
				"inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium",
				base[tone],
			)}
		>
			{children}
		</span>
	);
}

export function StatCard({ icon: Icon, title, value, meta, tone = "sky", darkMode }) {
	const toneClasses = darkMode
		? {
				sky: "border-sky-400/20 bg-slate-950/70 text-sky-300",
				blue: "border-blue-400/20 bg-slate-950/70 text-blue-300",
				emerald: "border-emerald-400/20 bg-slate-950/70 text-emerald-300",
				amber: "border-amber-400/20 bg-slate-950/70 text-amber-300",
			}
		: {
				sky: "border-sky-200 bg-white text-sky-600",
				blue: "border-blue-200 bg-white text-blue-600",
				emerald: "border-emerald-200 bg-white text-emerald-600",
				amber: "border-amber-200 bg-white text-amber-600",
			};

	const shell = darkMode
		? "border-slate-800 bg-slate-950/70 shadow-[0_18px_60px_-30px_rgba(32,101,152,0.35)]"
		: "border-slate-200 bg-white shadow-sm";

	return (
		<div className={cn("rounded-3xl border p-5 transition hover:-translate-y-0.5", shell)}>
			<div
				className={cn(
					"inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium",
					toneClasses[tone],
				)}
			>
				<Icon className="h-3.5 w-3.5" />
				{title}
			</div>
			<div
				className={cn(
					"mt-4 text-2xl font-semibold tracking-tight",
					darkMode ? "text-white" : "text-slate-900",
				)}
			>
				{value}
			</div>
			<p className={cn("mt-1 text-sm", darkMode ? "text-slate-400" : "text-slate-500")}>{meta}</p>
		</div>
	);
}

export function SectionCard({
	title,
	subtitle,
	icon: Icon,
	children,
	actionLabel,
	actionIcon: ActionIcon = RefreshCw,
	onAction,
	darkMode,
}) {
	const shell = darkMode
		? "border-slate-800 bg-slate-950/70 shadow-[0_22px_80px_-38px_rgba(15,23,42,0.35)]"
		: "border-slate-200 bg-white shadow-sm";
	const titleClass = darkMode ? "text-white" : "text-slate-900";
	const subClass = darkMode ? "text-slate-400" : "text-slate-500";
	const buttonClass = darkMode
		? "border-sky-400/20 bg-sky-500/10 text-sky-200 hover:bg-sky-500/15"
		: "border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100";
	const iconShell = darkMode
		? "border-sky-400/20 bg-sky-500/10 text-sky-300"
		: "border-sky-200 bg-sky-50 text-sky-600";

	return (
		<section className={cn("rounded-[28px] border p-5 transition", shell)}>
			<div className="mb-5 flex flex-wrap items-start justify-between gap-3">
				<div className="flex items-start gap-3">
					<div className={cn("rounded-2xl border p-3", iconShell)}>
						<Icon className="h-5 w-5" />
					</div>
					<div>
						<h3 className={cn("text-lg font-semibold tracking-tight", titleClass)}>{title}</h3>
						<p className={cn("mt-1 max-w-2xl text-sm", subClass)}>{subtitle}</p>
					</div>
				</div>
				{actionLabel ? (
					<button
						type="button"
						onClick={onAction}
						disabled={!onAction}
						className={cn(
							"inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60",
							buttonClass,
						)}
					>
						<ActionIcon className="h-4 w-4" />
						{actionLabel}
					</button>
				) : null}
			</div>
			{children}
		</section>
	);
}

/* eslint-disable react-refresh/only-export-components */
export function cmsChipClass(dark, active = false) {
	return [
		"inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition",
		dark
			? active
				? "border-sky-400/30 bg-sky-400/15 text-sky-100 shadow-[0_0_0_1px_rgba(109,171,223,0.12)]"
				: "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
			: active
				? "border-sky-500/20 bg-sky-50 text-sky-700 shadow-sm"
				: "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
	].join(" ");
}

export function CmsMiniBadge({ dark, children }) {
	return (
		<span
			className={[
				"inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium",
				dark
					? "border-sky-400/20 bg-sky-400/10 text-sky-200"
					: "border-sky-200 bg-sky-50 text-sky-700",
			].join(" ")}
		>
			{children}
		</span>
	);
}

export function CmsStatCard({ dark, icon: Icon, label, value, meta, trend }) {
	return (
		<div
			className={[
				"group relative overflow-hidden rounded-3xl border p-5 shadow-sm backdrop-blur-xl transition hover:-translate-y-0.5",
				dark
					? "border-white/10 bg-slate-950/70 text-white shadow-[0_12px_40px_rgba(2,8,23,0.35)]"
					: "border-slate-200/80 bg-white text-slate-900 shadow-[0_12px_30px_rgba(15,23,42,0.06)]",
			].join(" ")}
		>
			<div className="absolute inset-0 bg-gradient-to-br from-sky-400/10 via-transparent to-blue-500/5 opacity-0 transition group-hover:opacity-100" />
			<div className="relative flex items-start justify-between gap-4">
				<div>
					<p
						className={
							dark
								? "text-xs uppercase tracking-[0.28em] text-slate-400"
								: "text-xs uppercase tracking-[0.28em] text-slate-500"
						}
					>
						{label}
					</p>
					<div className="mt-2 flex items-end gap-3">
						<h3 className="text-3xl font-semibold tracking-tight">{value}</h3>
						{trend ? (
							<span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-[11px] font-medium text-emerald-500">
								<ArrowUpRight className="h-3 w-3" /> {trend}
							</span>
						) : null}
					</div>
					<p className={dark ? "mt-2 text-sm text-slate-400" : "mt-2 text-sm text-slate-600"}>
						{meta}
					</p>
				</div>
				<div className="rounded-2xl border border-sky-400/20 bg-sky-400/10 p-3 text-sky-400">
					<Icon className="h-5 w-5" />
				</div>
			</div>
		</div>
	);
}

export function CmsSectionCard({
	dark,
	title,
	subtitle,
	icon: Icon,
	action,
	children,
	accent = "sky",
}) {
	const ac = accentClasses(accent);
	return (
		<section
			className={[
				"overflow-hidden rounded-3xl border backdrop-blur-xl",
				dark
					? "border-white/10 bg-slate-950/70 shadow-[0_18px_55px_rgba(2,8,23,0.4)]"
					: "border-slate-200/80 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.06)]",
			].join(" ")}
		>
			<div className="flex items-center justify-between gap-4 border-b border-slate-200/50 px-6 py-4 dark:border-white/5">
				<div className="flex items-center gap-3">
					<div className={`rounded-xl border p-2 ${ac.border} ${ac.bg} ${ac.text}`}>
						<Icon className="h-5 w-5" />
					</div>
					<div>
						<h3
							className={
								dark
									? "text-base font-semibold text-white"
									: "text-base font-semibold text-slate-900"
							}
						>
							{title}
						</h3>
						<p className={dark ? "text-xs text-slate-400" : "text-xs text-slate-500"}>{subtitle}</p>
					</div>
				</div>
				{action}
			</div>
			<div className="px-6 py-4">{children}</div>
		</section>
	);
}
