import { startAuthentication } from "@simplewebauthn/browser";
// HyperCache cacheMode: admin (network-required) — admin panels must always
// read fresh server state (moderation queues, entitlements); never serve from
// the shared-entity cache. No behavior change — registry note only.
import {
	Activity,
	ArrowUpRight,
	Bot,
	CheckCircle2,
	ChevronRight,
	Crown,
	Database,
	FolderOpen,
	LayoutDashboard,
	Menu,
	MonitorCog,
	Moon,
	Network,
	RefreshCw,
	Search,
	Server,
	Shield,
	ShieldCheck,
	Sparkles,
	Sun,
	SunMedium,
	Wallet,
	X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Mosaic, ThreeDot } from "react-loading-indicators";
import { useSearchParams } from "react-router-dom";
import AccessDeniedState from "../components/AccessDeniedState.jsx";
import RejectionReasonModal from "../components/admin/RejectionReasonModal.jsx";
import ConfirmDialog from "../components/ConfirmDialog.jsx";
import { useToast } from "../components/ToastContainer.jsx";
import LazyImage from "../components/ui/LazyImage.jsx";
import NeonAtom from "../components/ui/NeonAtom.jsx";
import {
	useActionGroups,
	useActions,
	useCapabilities,
	useInventory,
	useRoleConfig,
	useUiConfig,
} from "../hooks/useAdminConfig.js";
import usePageChrome from "../hooks/usePageChrome.js";
import { apiRequest, getCurrentUser, getToken, saveSession } from "../lib/auth.js";
import { secureStorage } from "../lib/secureStorage.js";
import { useTheme } from "../lib/ThemeProvider.jsx";
import { accentClasses } from "../theme/theme-utils.js";
import * as Helpers from "./AdminPanel.helpers.js";
import * as Utils from "./AdminPanel.utils.js";
import { AdminAISection } from "./admin/sections/AdminAISection.jsx";
import { AdminCMSSection } from "./admin/sections/AdminCMSSection.jsx";
import { AdminConfigSection } from "./admin/sections/AdminConfigSection.jsx";
import { AdminFinanceSection } from "./admin/sections/AdminFinanceSection.jsx";
import { AdminHomeSection } from "./admin/sections/AdminHomeSection.jsx";
import { AdminInfraSection } from "./admin/sections/AdminInfraSection.jsx";
import { AdminMediaReviewSection } from "./admin/sections/AdminMediaReviewSection.jsx";
import { AdminNetworkSection } from "./admin/sections/AdminNetworkSection.jsx";
import { AdminPlatformSection } from "./admin/sections/AdminPlatformSection.jsx";
import { AdminSecuritySection } from "./admin/sections/AdminSecuritySection.jsx";
import { AdminServerSection } from "./admin/sections/AdminServerSection.jsx";
import { FileExplorerSection } from "./admin/sections/FileExplorerSection.jsx";

const {
	KNOWN_ROLES,
	DEFAULT_ADMIN_PANEL_ALLOWED_ROLES,
	DEFAULT_ADMIN_PANEL_FALLBACK_INVENTORY,
	INFRA_CAPABILITIES,
	NETWORK_CAPABILITIES,
	SECTION_METRICS,
	METRIC_CARDS,
	DEFAULT_BENEFITS,
	ULTRA_CAPABILITIES_DEFAULT,
	DEFAULT_CMS_WEEKLY_TREND,
	DEFAULT_ULTRA_MINI_CHART_POINTS,
	DEFAULT_ULTRA_MINI_CHART_KPIS,
	DEFAULT_EMPTY_STATE_COPY,
	BUYER_BENEFITS_DEFAULT,
	FACTORY_BENEFITS_DEFAULT,
	BUYING_HOUSE_BENEFITS_DEFAULT,
	NO_DATA_LABEL,
	DEFAULT_PIE_PALETTE,
	ICON_REGISTRY,
	getIconComponent,
} = Utils;

const {
	statusBadge,
	formatNumber,
	formatCurrency,
	_resolvePath,
	exportEmailsCsv,
	isHexColor,
	getAdminPanelPiePalette,
	getCmsWeeklyTrendFallback,
	getUltraMiniChartPoints,
	getUltraMiniChartKpis,
	getUltraSecurityCapabilities,
	getContractNoDataLabel,
	getEmptyStateCopy,
	buyerBenefits,
	factoryBenefits,
	buyingHouseBenefits,
	DEFAULT_CONTRACT_NO_DATA_LABEL,
	cn,
	normalizeRole,
	getAdminPanelAllowedRoles,
	getAdminPanelFallbackInventory,
	listToTextarea,
	textareaToList,
	ACTION_GROUPS,
	describeEmailTestOutcome,
} = Helpers;

function SkeletonChart({ height = 320 }) {
	return (
		<div class="flex items-center justify-center" style={{ height }}>
			<Mosaic color="#337ab0" size="large" style={{ fontSize: "40px" }} text="" textColor="" />
		</div>
	);
}

function SectionTitle({ title, subtitle, icon: TitleIcon }) {
	return (
		<div class="mb-4 flex items-center justify-between gap-4">
			<div>
				<div class="flex items-center gap-2">
					<div class="rounded-2xl border border-sky-400/20 bg-sky-400/10 p-2 text-sky-300 shadow-lg shadow-sky-500/10">
						<TitleIcon class="h-4 w-4" />
					</div>
					<h2 class="text-lg font-semibold tracking-tight text-slate-900 dark:text-white">
						{title}
					</h2>
				</div>
				<p class="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
			</div>
		</div>
	);
}

function MetricCard({ label, value, hint, icon: CardIcon, loading = false }) {
	if (loading) {
		return (
			<div class="rounded-3xl border border-slate-200/80 bg-white/80 p-5 shadow-[0_20px_60px_-30px_rgba(51,122,176,0.35)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/70">
				<div class="flex items-center justify-center">
					<ThreeDot variant="bounce" color="#337ab0" size="small" text="" textColor="" />
				</div>
			</div>
		);
	}
	return (
		<div class="group rounded-3xl border border-slate-200/80 bg-white/80 p-5 shadow-[0_20px_60px_-30px_rgba(51,122,176,0.35)] backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-sky-300/70 hover:shadow-[0_24px_80px_-28px_rgba(51,122,176,0.45)] dark:border-white/10 dark:bg-slate-950/70">
			<div class="flex items-start justify-between gap-4">
				<div>
					<p class="text-sm text-slate-500 dark:text-slate-400">{label}</p>
					<div class="mt-2 text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">
						{value}
					</div>
					<p class="mt-2 text-xs text-slate-500 dark:text-slate-400">{hint}</p>
				</div>
				<div class="rounded-2xl border border-sky-400/15 bg-gradient-to-br from-sky-400/20 to-blue-500/10 p-3 text-sky-500 shadow-lg shadow-sky-500/10 dark:text-sky-300">
					<CardIcon class="h-5 w-5" />
				</div>
			</div>
		</div>
	);
}

function Pill({ children }) {
	return (
		<span class="inline-flex items-center gap-2 rounded-full border border-sky-500/15 bg-sky-500/8 px-3 py-1 text-xs font-medium text-sky-700 shadow-sm shadow-sky-500/5 dark:text-sky-300">
			{children}
		</span>
	);
}

function BenefitCard({ title, items, accent = "sky" }) {
	const ac = accentClasses(accent);
	return (
		<div class="rounded-3xl border border-slate-200/80 bg-white/80 p-6 shadow-[0_20px_60px_-30px_rgba(55,115,168,0.28)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/70">
			<div class="flex items-center justify-between gap-4">
				<div>
					<h3 class="text-base font-semibold text-slate-900 dark:text-white">{title}</h3>
					<p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
						Premium capability stack and operational advantages.
					</p>
				</div>
				<div class={`rounded-2xl border p-2 ${ac.border} ${ac.bg} ${ac.text}`}>
					<Sparkles class="h-4 w-4" />
				</div>
			</div>
			<div class="mt-5 grid gap-2 sm:grid-cols-2">
				{items.map((item) => (
					<div
						key={item}
						class="flex items-start gap-2 rounded-2xl border border-slate-200/70 bg-slate-50/90 p-3 text-sm text-slate-700 dark:border-white/5 dark:bg-white/5 dark:text-slate-300"
					>
						<CheckCircle2 class="mt-0.5 h-4 w-4 shrink-0 text-sky-500" />
						<span>{item}</span>
					</div>
				))}
			</div>
		</div>
	);
}

function AdminSecurityGate({
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
		<div class="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/90 p-6 backdrop-blur-md">
			<div class="admin-panel admin-sweep w-full max-w-lg rounded-3xl p-6 shadow-2xl">
				<h2 class="text-lg font-bold text-white">Security verification required</h2>
				<p class="mt-2 text-sm text-slate-300">
					{message ||
						"Admin security verification required. Use any one of the following methods to unlock the panel."}
				</p>

				<div class="mt-5 grid grid-cols-1 gap-3">
					<label class="text-xs text-slate-400">
						MFA code
						<input
							value={mfaCode}
							onChange={(e) => setMfaCode(e.target.value)}
							class="mt-1 w-full rounded-xl bg-slate-900/90 px-3 py-2 text-sm text-white outline-none ring-1 ring-slate-700 focus:ring-sky-500"
							placeholder="Enter MFA code"
						/>
					</label>
					<label class="text-xs text-slate-400">
						Passkey
						<button
							type="button"
							onClick={onPasskeyAuth}
							disabled={passkeyBusy}
							class="mt-1 w-full rounded-xl bg-indigo-500/80 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
						>
							{passkeyBusy ? "Opening passkey..." : "Verify with passkey"}
						</button>
					</label>
					<label class="text-xs text-slate-400">
						Setup/step-up code
						<input
							value={stepUpCode}
							onChange={(e) => setStepUpCode(e.target.value)}
							class="mt-1 w-full rounded-xl bg-slate-900/90 px-3 py-2 text-sm text-white outline-none ring-1 ring-slate-700 focus:ring-sky-500"
							placeholder="Enter setup code"
						/>
					</label>
				</div>

				{notice ? <p class="mt-3 text-xs text-sky-200">{notice}</p> : null}

				<div class="mt-5 flex flex-wrap gap-2">
					<button
						type="button"
						onClick={onUnlock}
						disabled={passkeyBusy}
						class="rounded-full bg-sky-500 px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
					>
						Unlock access
					</button>
					<button
						type="button"
						onClick={onDecline}
						disabled={passkeyBusy}
						class="rounded-full border border-slate-600 px-4 py-2 text-xs font-semibold text-slate-200 disabled:opacity-60"
					>
						Decline
					</button>
				</div>
			</div>
		</div>
	);
}

function SkeletonLine({ className = "" }) {
	return <div class={`skeleton rounded-xl ${className}`} />;
}

function Badge({ children, tone = "default", darkMode = true }) {
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
			class={cn(
				"inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium",
				base[tone],
			)}
		>
			{children}
		</span>
	);
}

function StatCard({ icon: Icon, title, value, meta, tone = "sky", darkMode }) {
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
		<div class={cn("rounded-3xl border p-5 transition hover:-translate-y-0.5", shell)}>
			<div
				class={cn(
					"inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium",
					toneClasses[tone],
				)}
			>
				<Icon class="h-3.5 w-3.5" />
				{title}
			</div>
			<div
				class={cn(
					"mt-4 text-2xl font-semibold tracking-tight",
					darkMode ? "text-white" : "text-slate-900",
				)}
			>
				{value}
			</div>
			<p class={cn("mt-1 text-sm", darkMode ? "text-slate-400" : "text-slate-500")}>{meta}</p>
		</div>
	);
}

function SectionCard({
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
		<section class={cn("rounded-[28px] border p-5 transition", shell)}>
			<div class="mb-5 flex flex-wrap items-start justify-between gap-3">
				<div class="flex items-start gap-3">
					<div class={cn("rounded-2xl border p-3", iconShell)}>
						<Icon class="h-5 w-5" />
					</div>
					<div>
						<h3 class={cn("text-lg font-semibold tracking-tight", titleClass)}>{title}</h3>
						<p class={cn("mt-1 max-w-2xl text-sm", subClass)}>{subtitle}</p>
					</div>
				</div>
				{actionLabel ? (
					<button
						type="button"
						onClick={onAction}
						disabled={!onAction}
						class={cn(
							"inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60",
							buttonClass,
						)}
					>
						<ActionIcon class="h-4 w-4" />
						{actionLabel}
					</button>
				) : null}
			</div>
			{children}
		</section>
	);
}

function cmsChipClass(dark, active = false) {
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

function CmsMiniBadge({ dark, children }) {
	return (
		<span
			class={[
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

function CmsStatCard({ dark, icon: Icon, label, value, meta, trend }) {
	return (
		<div
			class={[
				"group relative overflow-hidden rounded-3xl border p-5 shadow-sm backdrop-blur-xl transition hover:-translate-y-0.5",
				dark
					? "border-white/10 bg-slate-950/70 text-white shadow-[0_12px_40px_rgba(2,8,23,0.35)]"
					: "border-slate-200/80 bg-white text-slate-900 shadow-[0_12px_30px_rgba(15,23,42,0.06)]",
			].join(" ")}
		>
			<div class="absolute inset-0 bg-gradient-to-br from-sky-400/10 via-transparent to-blue-500/5 opacity-0 transition group-hover:opacity-100" />
			<div class="relative flex items-start justify-between gap-4">
				<div>
					<p
						class={
							dark
								? "text-xs uppercase tracking-[0.28em] text-slate-400"
								: "text-xs uppercase tracking-[0.28em] text-slate-500"
						}
					>
						{label}
					</p>
					<div class="mt-2 flex items-end gap-3">
						<h3 class="text-3xl font-semibold tracking-tight">{value}</h3>
						{trend ? (
							<span class="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-[11px] font-medium text-emerald-500">
								<ArrowUpRight class="h-3 w-3" /> {trend}
							</span>
						) : null}
					</div>
					<p class={dark ? "mt-2 text-sm text-slate-400" : "mt-2 text-sm text-slate-600"}>{meta}</p>
				</div>
				<div class="rounded-2xl border border-sky-400/20 bg-sky-400/10 p-3 text-sky-400">
					<Icon class="h-5 w-5" />
				</div>
			</div>
		</div>
	);
}

function CmsSectionCard({ dark, title, subtitle, icon: Icon, action, children, accent = "sky" }) {
	return (
		<section
			class={[
				"overflow-hidden rounded-3xl border backdrop-blur-xl",
				dark
					? "border-white/10 bg-slate-950/70 shadow-[0_18px_55px_rgba(2,8,23,0.4)]"
					: "border-slate-200/80 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.06)]",
			].join(" ")}
		>
			<div
				class={[
					"flex flex-wrap items-start justify-between gap-4 border-b p-5",
					dark ? "border-white/10" : "border-slate-100",
				].join(" ")}
			>
				<div class="flex items-start gap-4">
					<div
						class={[
							"rounded-2xl p-3",
							accent === "sky"
								? dark
									? "bg-sky-400/10 text-sky-300"
									: "bg-sky-50 text-sky-600"
								: dark
									? "bg-blue-400/10 text-blue-300"
									: "bg-blue-50 text-blue-600",
						].join(" ")}
					>
						<Icon class="h-5 w-5" />
					</div>
					<div>
						<h2
							class={
								dark ? "text-lg font-semibold text-white" : "text-lg font-semibold text-slate-900"
							}
						>
							{title}
						</h2>
						<p class={dark ? "mt-1 text-sm text-slate-400" : "mt-1 text-sm text-slate-600"}>
							{subtitle}
						</p>
					</div>
				</div>
				{action}
			</div>
			<div class="p-5">{children}</div>
		</section>
	);
}

function ultraMetricShell(dark) {
	return dark
		? "bg-white/5 border-white/10 text-slate-100 shadow-[0_20px_60px_rgba(2,8,23,0.35)]"
		: "bg-white border-slate-200 text-slate-900 shadow-[0_20px_60px_rgba(15,23,42,0.08)]";
}

function UltraPill({ dark, active = false, children }) {
	return (
		<span
			class={cn(
				"inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium",
				active
					? dark
						? "border-cyan-400/30 bg-cyan-500/15 text-cyan-200"
						: "border-cyan-300 bg-cyan-50 text-cyan-700"
					: dark
						? "border-white/10 bg-white/5 text-slate-300"
						: "border-slate-200 bg-slate-100 text-slate-700",
			)}
		>
			{children}
		</span>
	);
}

function UltraStatCard({ dark, label, value, sub, icon: Icon, tone = "default" }) {
	const toneClass =
		tone === "good"
			? "from-cyan-500/20 to-sky-500/10 ring-cyan-400/30"
			: tone === "warn"
				? "from-amber-500/20 to-orange-500/10 ring-amber-400/30"
				: tone === "danger"
					? "from-rose-500/20 to-red-500/10 ring-rose-400/30"
					: "from-sky-500/20 to-blue-500/10 ring-sky-400/30";

	return (
		<div
			class={cn(
				ultraMetricShell(dark),
				"relative overflow-hidden rounded-3xl border p-5 backdrop-blur-xl",
			)}
		>
			<div class={cn("absolute inset-0 bg-gradient-to-br opacity-80", toneClass)} />
			<div class="relative flex items-start justify-between gap-4">
				<div>
					<p class={cn("text-sm font-medium", dark ? "text-slate-300" : "text-slate-600")}>
						{label}
					</p>
					<div class="mt-2 flex items-end gap-2">
						<h3 class="text-3xl font-semibold tracking-tight">{value}</h3>
						{sub ? (
							<span class={cn("pb-1 text-xs", dark ? "text-slate-400" : "text-slate-500")}>
								{sub}
							</span>
						) : null}
					</div>
				</div>
				<div class={cn("rounded-2xl p-3", dark ? "bg-slate-950/30" : "bg-slate-100")}>
					<Icon class="h-5 w-5 text-cyan-300" />
				</div>
			</div>
		</div>
	);
}

function UltraSectionCard({ dark, title, subtitle, children, right }) {
	return (
		<section
			class={cn(
				ultraMetricShell(dark),
				"relative overflow-hidden rounded-[28px] border p-6 backdrop-blur-xl",
			)}
		>
			<div class="mb-5 flex flex-wrap items-start justify-between gap-4">
				<div>
					<div class="flex items-center gap-2">
						<h2
							class={cn(
								"text-xl font-semibold tracking-tight",
								dark ? "text-white" : "text-slate-900",
							)}
						>
							{title}
						</h2>
						<span class="inline-flex items-center gap-1 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-300">
							live
						</span>
					</div>
					{subtitle ? (
						<p
							class={cn(
								"mt-2 max-w-2xl text-sm leading-6",
								dark ? "text-slate-400" : "text-slate-600",
							)}
						>
							{subtitle}
						</p>
					) : null}
				</div>
				{right}
			</div>
			{children}
		</section>
	);
}

function UltraToggle({ dark, on, label, hint, onToggle }) {
	return (
		<div
			class={cn(
				"flex items-center justify-between gap-4 rounded-2xl border p-4",
				dark ? "border-white/10 bg-white/5" : "border-slate-200 bg-slate-50",
			)}
		>
			<div>
				<p class={cn("font-medium", dark ? "text-white" : "text-slate-900")}>{label}</p>
				{hint ? (
					<p class={cn("mt-1 text-sm", dark ? "text-slate-400" : "text-slate-500")}>{hint}</p>
				) : null}
			</div>
			<div class="flex items-center gap-3">
				<span
					class={cn("text-sm", on ? "text-cyan-300" : dark ? "text-slate-400" : "text-slate-500")}
				>
					{on ? "On" : "Off"}
				</span>
				<button
					type="button"
					onClick={onToggle}
					class={cn(
						"flex h-10 w-20 items-center rounded-full border px-1 transition",
						on
							? "border-cyan-400/40 bg-cyan-500/20"
							: dark
								? "border-white/10 bg-white/5"
								: "border-slate-200 bg-white",
					)}
					aria-pressed={on}
				>
					<div
						class={cn(
							"h-8 w-8 rounded-full shadow-md transition-transform",
							on ? "translate-x-10 bg-cyan-400" : dark ? "bg-slate-400" : "bg-slate-500",
						)}
					/>
				</button>
			</div>
		</div>
	);
}

function UltraTinyChart({
	dark,
	points = DEFAULT_ULTRA_MINI_CHART_POINTS,
	kpis = DEFAULT_ULTRA_MINI_CHART_KPIS,
}) {
	const safePoints =
		Array.isArray(points) && points.length >= 3 ? points : DEFAULT_ULTRA_MINI_CHART_POINTS;
	const width = 640;
	const height = 180;
	const max = Math.max(...safePoints);
	const min = Math.min(...safePoints);
	const range = max - min || 1;
	const pad = 16;
	const step = (width - pad * 2) / (safePoints.length - 1);
	const y = (v) => height - pad - ((v - min) / range) * (height - pad * 2);
	const path = safePoints
		.map((p, i) => `${i === 0 ? "M" : "L"}${pad + i * step} ${y(p)}`)
		.join(" ");
	const area = `${path} L ${width - pad} ${height - pad} L ${pad} ${height - pad} Z`;
	const safeKpis =
		Array.isArray(kpis) && kpis.length > 0 ? kpis.slice(0, 6) : DEFAULT_ULTRA_MINI_CHART_KPIS;

	return (
		<div
			class={cn(
				"rounded-[24px] border p-4",
				dark ? "border-white/10 bg-slate-950/25" : "border-slate-200 bg-white",
			)}
		>
			<div class="mb-3 flex items-center justify-between">
				<div>
					<p class={cn("text-sm font-medium", dark ? "text-white" : "text-slate-900")}>
						Live Metrics
					</p>
					<p class={cn("text-xs", dark ? "text-slate-400" : "text-slate-500")}>
						Metrics coming from live feeds.
					</p>
				</div>
				<div class="flex items-center gap-2 text-xs text-cyan-300">
					<Activity class="h-4 w-4" />
					streaming
				</div>
			</div>
			<svg viewBox={`0 0 ${width} ${height}`} class="h-44 w-full">
				<defs>
					<linearGradient id="ultraSkyFill" x1="0" x2="0" y1="0" y2="1">
						<stop offset="0%" stopColor="rgba(109,171,223,0.38)" />
						<stop offset="100%" stopColor="rgba(109,171,223,0)" />
					</linearGradient>
				</defs>
				<path d={area} fill="url(#ultraSkyFill)" />
				<path d={path} fill="none" stroke="currentColor" strokeWidth="3" class="text-cyan-300" />
				{safePoints.map((p, i) => (
					<circle
						key={i}
						cx={pad + i * step}
						cy={y(p)}
						r="4.2"
						class="fill-cyan-300 text-cyan-300"
					/>
				))}
			</svg>
			<div class="mt-2 grid grid-cols-3 gap-3 text-center text-xs">
				{safeKpis.slice(0, 3).map((row) => (
					<div
						key={row.label}
						class={cn(
							"rounded-2xl border p-3",
							dark ? "border-white/10 bg-white/5" : "border-slate-200 bg-slate-50",
						)}
					>
						<div class={cn("font-semibold", dark ? "text-white" : "text-slate-900")}>
							{row.value}
						</div>
						<div class={dark ? "text-slate-400" : "text-slate-500"}>{row.label}</div>
					</div>
				))}
			</div>
		</div>
	);
}

/**
 * AdminPanel component.
 * @returns {JSX.Element}
 */
export default function AdminPanel() {
	const user = getCurrentUser();
	const userRole = normalizeRole(user?.role);
	const { theme, toggleTheme } = useTheme();
	const [adminDark, setAdminDark] = useState(theme === "dark");
	const [sidebarOpen, setSidebarOpen] = useState(false);
	const { navCollapsed, footerCollapsed, toggleNav, toggleFooter } = usePageChrome("admin");

	const [loading, setLoading] = useState(true);
	const [pageLoading, setPageLoading] = useState(true);
	const [error, setError] = useState("");
	const [master, setMaster] = useState(null);
	const [catalog, setCatalog] = useState(null);
	const [infra, setInfra] = useState(null);
	const [network, setNetwork] = useState(null);
	const [infraState, setInfraState] = useState(null);
	const [networkInventory, setNetworkInventory] = useState(null);
	const [serverAdminState, setServerAdminState] = useState(null);
	const [cmsState, setCmsState] = useState(null);
	const [securityState, setSecurityState] = useState(null);
	const [integrationStatus, setIntegrationStatus] = useState(null);
	const [couponReport, setCouponReport] = useState(null);
	const [signups, setSignups] = useState([]);
	const [strikeHistory, setStrikeHistory] = useState([]);
	const [fraudReview, setFraudReview] = useState({ items: [], duplicates: [] });
	const [duplicateDisputes, setDuplicateDisputes] = useState([]);
	const [orgOwnership, setOrgOwnership] = useState({
		orgs: [],
		staff_list: [],
	});

	const { inventory: dynamicInventory } = useInventory();
	const { piePalette: dynamicPiePalette, emptyStates: dynamicEmptyStates } = useUiConfig();
	const { capabilities: _infraCapabilities } = useCapabilities("infra");
	const { capabilities: _networkCapabilities } = useCapabilities("network");
	const { capabilities: _ultraCapabilities } = useCapabilities("ultra-security");
	const { actions: _adminActions } = useActions();
	const { groups: dynamicActionGroups } = useActionGroups();
	const _roleConfig = useRoleConfig();
	const [walletLedger, setWalletLedger] = useState([]);
	const [featuredForm, setFeaturedForm] = useState({
		entity_type: "product",
		entity_id: "",
		label: "",
	});
	const [audit, setAudit] = useState([]);
	const [infraSearch, setInfraSearch] = useState("");
	const [networkQuery, setNetworkQuery] = useState("");
	const [networkAuditQuery, setNetworkAuditQuery] = useState("");
	const [networkNav, setNetworkNav] = useState("overview");
	const [serverAdminAuditQuery, setServerAdminAuditQuery] = useState("");
	const [cmsTab, setCmsTab] = useState("cms");
	const [cmsAuditQuery, setCmsAuditQuery] = useState("");
	const [ultraAuditQuery, setUltraAuditQuery] = useState("");
	const [users, setUsers] = useState([]);
	const [verificationQueue, setVerificationQueue] = useState([]);
	const [contractsVault, setContractsVault] = useState([]);
	const [disputes, setDisputes] = useState([]);
	const [supportTickets, setSupportTickets] = useState([]);
	const [supportLoading, setSupportLoading] = useState(false);
	const [supportFilters, setSupportFilters] = useState({
		status: "all",
		priority: "all",
		assigned_to: "",
	});
	const [moderationPending, setModerationPending] = useState([]);
	const [moderationRejected, setModerationRejected] = useState([]);
	const [loadingModeration, setLoadingModeration] = useState(false);
	const toast = useToast();
	const [aiModalDoc, setAiModalDoc] = useState(null);
	const [reanalyzingId, setReanalyzingId] = useState(null);
	const [rejectionModalOpen, setRejectionModalOpen] = useState(false);
	const [forceLogoutTarget, setForceLogoutTarget] = useState(null);
	const [passwordResetTarget, setPasswordResetTarget] = useState(null);
	const [passwordResetValue, setPasswordResetValue] = useState("");
	const [resolutionReportTarget, setResolutionReportTarget] = useState(null);
	const [resolutionNote, setResolutionNote] = useState("");
	const [assignTicketTarget, setAssignTicketTarget] = useState(null);
	const [assigneeIdValue, setAssigneeIdValue] = useState("");
	const [rejectionItem, setRejectionItem] = useState(null);
	const [policyQueueItems, setPolicyQueueItems] = useState([]);
	const [policyReviewRows, setPolicyReviewRows] = useState([]);
	const [policyMetrics, setPolicyMetrics] = useState(null);
	const [reputationSenderId, setReputationSenderId] = useState("");
	const [reputationDelta, setReputationDelta] = useState("0");

	const [emailConfig, setEmailConfig] = useState({
		enabled: false,
		provider: "smtp",
		from_name: "GarTexHub",
		from_email: "",
		test_recipient: "",
	});
	const [emailConfigBusy, setEmailConfigBusy] = useState(false);
	const [emailConfigNotice, setEmailConfigNotice] = useState("");
	const [emailConfigError, setEmailConfigError] = useState("");
	const [openSearchConfig, setOpenSearchConfig] = useState({
		enabled: false,
		url: "",
		username: "",
		password: "",
		index_prefix: "gartexhub_",
		timeout_ms: 3000,
		verify_tls: true,
	});
	const [openSearchStatus, setOpenSearchStatus] = useState(null);
	const [openSearchOrgId, setOpenSearchOrgId] = useState("");
	const [openSearchReset, setOpenSearchReset] = useState(false);
	const [openSearchConfigBusy, setOpenSearchConfigBusy] = useState(false);
	const [openSearchActionBusy, setOpenSearchActionBusy] = useState("");
	const [openSearchNotice, setOpenSearchNotice] = useState("");
	const [openSearchError, setOpenSearchError] = useState("");
	const [clothingRulesForm, setClothingRulesForm] = useState({
		forbidden_terms: "",
		flag_terms: "",
		allowed_terms: "",
		context_exceptions: "",
		reason_rejected: "",
		reason_pending: "",
		reason_fix: "",
	});
	const [clothingRulesBusy, setClothingRulesBusy] = useState(false);
	const [clothingRulesNotice, setClothingRulesNotice] = useState("");
	const [clothingRulesError, setClothingRulesError] = useState("");

	const [adminUiSettingsForm, setAdminUiSettingsForm] = useState({
		allowed_roles: "",
		fallback_inventory_json: "",
		pie_palette: "",
		cms_weekly_trend_json: "",
		ultra_mini_points_json: "",
		ultra_mini_kpis_json: "",
		ultra_capabilities: "",
		contract_no_data_label: "",
		empty_states_json: "",
	});
	const [adminUiSettingsDirty, setAdminUiSettingsDirty] = useState(false);
	const [adminUiSettingsBusy, setAdminUiSettingsBusy] = useState(false);
	const [adminUiSettingsNotice, setAdminUiSettingsNotice] = useState("");
	const [adminUiSettingsError, setAdminUiSettingsError] = useState("");
	const [systemReports, setSystemReports] = useState([]);
	const [productAppealReports, setProductAppealReports] = useState([]);
	const [contentReports, setContentReports] = useState([]);
	const [partnerRequests, setPartnerRequests] = useState([]);
	const [paymentProofs, setPaymentProofs] = useState([]);
	const [userQuery, setUserQuery] = useState("");
	const [roleFilter, setRoleFilter] = useState("all");
	const [statusFilter, setStatusFilter] = useState("all");
	const [regionFilter, setRegionFilter] = useState("all");
	const [verificationFilter, setVerificationFilter] = useState("all");
	const [premiumFilter, setPremiumFilter] = useState("all");
	const [userDrafts, setUserDrafts] = useState({});
	const [mfaCode, setMfaCode] = useState(() => secureStorage.getItem("admin_mfa_code") || "");
	const [deviceId, setDeviceId] = useState(() => secureStorage.getItem("admin_device_id") || "");
	const [passkeyValue] = useState(() => secureStorage.getItem("admin_passkey") || "");
	const [stepUpCode, setStepUpCode] = useState(
		() => secureStorage.getItem("admin_stepup_code") || "",
	);
	const [passkeyBusy, setPasskeyBusy] = useState(false);
	const [securityGateOpen, setSecurityGateOpen] = useState(false);
	const [securityGateMessage, setSecurityGateMessage] = useState("");
	const [securityGateNotice, setSecurityGateNotice] = useState("");
	const [activeCategory, setActiveCategory] = useState("home");
	const [actionBusy, setActionBusy] = useState("");

	// The emailed deep link.
	//
	// The support investigation report mail links to `/admin?case=<caseId>`,
	// and the case lives in the platform section. A link that arrives in the
	// console therefore has to open that section - otherwise the link lands
	// on the admin home page and the case it names is nowhere on screen.
	// The case itself is selected by AdminPlatformSection, which reads the
	// same query parameter.
	const [searchParams] = useSearchParams();
	const deepLinkedCaseId = searchParams.get("case") || "";
	useEffect(() => {
		if (!deepLinkedCaseId) {
			return;
		}
		setActiveCategory("platform");
	}, [deepLinkedCaseId]);

	const [configEditorTab, setConfigEditorTab] = useState("inventory");
	const [configEditorData, setConfigEditorData] = useState({
		inventory: [],
		actions: [],
		ui: {},
	});
	const [configEditorLoading, setConfigEditorLoading] = useState(false);
	const [configEditorSaving, setConfigEditorSaving] = useState(false);
	const [configEditorNotice, setConfigEditorNotice] = useState("");
	const [configEditorError, setConfigEditorError] = useState("");

	const adminPanelAllowedRoles = useMemo(
		() => getAdminPanelAllowedRoles(master?.config),
		[master?.config],
	);
	const isAllowedAdminViewer = adminPanelAllowedRoles.includes(userRole);

	const actionGroups = useMemo(() => {
		const staticGroups = ACTION_GROUPS;
		if (dynamicActionGroups && dynamicActionGroups.length > 0) {
			const merged = [];
			const seen = new Map();
			for (const group of staticGroups) {
				merged.push(group);
				seen.set(group.label, true);
			}
			for (const group of dynamicActionGroups) {
				if (!seen.has(group.label)) {
					merged.push(group);
				}
			}
			return merged;
		}
		return staticGroups;
	}, [dynamicActionGroups]);

	const actionOptions = useMemo(
		() =>
			actionGroups.flatMap((group) =>
				group.actions.map((action) => ({
					...action,
					group: group.label,
				})),
			),
		[actionGroups],
	);
	const [selectedActionId, setSelectedActionId] = useState(actionOptions[0]?.id || "");
	const selectedAction = actionOptions.find((action) => action.id === selectedActionId);
	const [actionForm, setActionForm] = useState({});
	const [firewallForm, setFirewallForm] = useState({
		action: "allow",
		port: "",
		protocol: "tcp",
		description: "",
	});
	const [packageForm, setPackageForm] = useState({
		mode: "check",
		apply: false,
	});
	const [cronForm, setCronForm] = useState({
		name: "",
		schedule: "",
		command: "",
	});
	const [osUserForm, setOsUserForm] = useState({ username: "", role: "user" });
	const [sshKeyForm, setSshKeyForm] = useState({ label: "", fingerprint: "" });
	const [sslForm, setSslForm] = useState({ domain: "" });
	const [infraBackupForm, setInfraBackupForm] = useState({
		retention_days: "",
	});
	const [timeForm, setTimeForm] = useState({ timezone: "" });
	const [vlanForm, setVlanForm] = useState({
		vlan_id: "",
		name: "",
		subnet: "",
		gateway: "",
	});
	const [ipamForm, setIpamForm] = useState({ ip: "", owner: "" });
	const [backupForm, setBackupForm] = useState({ device_id: "" });

	useEffect(() => {
		if (!selectedAction) {
			return;
		}
		const defaults = {};
		selectedAction.fields.forEach((field) => {
			defaults[field.key] = "";
		});
		// eslint-disable-next-line react-hooks/set-state-in-effect
		setActionForm(defaults);
	}, [selectedAction]);

	useEffect(() => {
		if (!mfaCode) {
			return;
		}
		secureStorage.setItem("admin_mfa_code", mfaCode, 60);
	}, [mfaCode]);

	useEffect(() => {
		if (!deviceId) {
			return;
		}
		secureStorage.setItem("admin_device_id", deviceId, 60);
	}, [deviceId]);

	useEffect(() => {
		if (deviceId) {
			return;
		}
		const fallback = `device-${Math.random().toString(36).slice(2, 10)}`;
		// eslint-disable-next-line react-hooks/set-state-in-effect
		setDeviceId(fallback);
	}, [deviceId]);

	useEffect(() => {
		if (!passkeyValue) {
			return;
		}
		secureStorage.setItem("admin_passkey", passkeyValue, 60);
	}, [passkeyValue]);

	useEffect(() => {
		if (!stepUpCode) {
			return;
		}
		secureStorage.setItem("admin_stepup_code", stepUpCode, 60);
	}, [stepUpCode]);

	useEffect(() => {
		const rules = master?.config?.moderation?.clothing_rules;
		if (rules) {
			// eslint-disable-next-line react-hooks/set-state-in-effect
			setClothingRulesForm({
				forbidden_terms: listToTextarea(rules.forbidden_terms),
				flag_terms: listToTextarea(rules.flag_terms),
				allowed_terms: listToTextarea(rules.allowed_terms),
				context_exceptions: listToTextarea(rules.context_exceptions),
				reason_rejected: rules?.reason_templates?.rejected || "",
				reason_pending: rules?.reason_templates?.pending_review || "",
				reason_fix: rules?.reason_templates?.fix_guidance || "",
			});
		}

		const email = master?.config?.notifications?.email;
		if (email) {
			setEmailConfig({
				enabled: Boolean(email.enabled),
				provider: email.provider || "smtp",
				from_name: email.from_name || "GarTexHub",
				from_email: email.from_email || "",
				test_recipient: email.test_recipient || "",
			});
		}

		const opensearch = master?.config?.integrations?.opensearch;
		if (opensearch) {
			setOpenSearchConfig({
				enabled: Boolean(opensearch.enabled),
				url: opensearch.url || "",
				username: opensearch.username || "",
				password: opensearch.password || "",
				index_prefix: opensearch.index_prefix || "gartexhub_",
				timeout_ms: Number(opensearch.timeout_ms || 3000),
				verify_tls: opensearch.verify_tls !== false,
			});
		}

		if (!adminUiSettingsDirty) {
			const allowedRoles = getAdminPanelAllowedRoles(master?.config);
			const fallbackInventory = getAdminPanelFallbackInventory(master?.config).map((row) => ({
				id: row.id,
				label: row.label,
				icon_name: row.icon_name || "",
			}));
			const piePalette = getAdminPanelPiePalette(master?.config);
			const cmsWeeklyTrend = getCmsWeeklyTrendFallback(master?.config);
			const ultraPoints = getUltraMiniChartPoints(master?.config);
			const ultraKpis = getUltraMiniChartKpis(master?.config);
			const ultraCapabilities = getUltraSecurityCapabilities(master?.config);
			const contractNoDataLabel = getContractNoDataLabel(master?.config);
			const rawEmptyStates = master?.config?.ui?.admin_panel?.copy?.empty_states;
			const sanitizedEmptyStates =
				rawEmptyStates && typeof rawEmptyStates === "object" && !Array.isArray(rawEmptyStates)
					? Object.fromEntries(
							Object.entries(rawEmptyStates)
								.map(([key, value]) => [String(key || "").trim(), String(value || "").trim()])
								.filter(([k, v]) => k && v),
						)
					: {};
			const emptyStates = {
				...DEFAULT_EMPTY_STATE_COPY,
				...sanitizedEmptyStates,
			};

			setAdminUiSettingsForm({
				allowed_roles: allowedRoles.join(", "),
				fallback_inventory_json: JSON.stringify(fallbackInventory, null, 2),
				pie_palette: listToTextarea(piePalette),
				cms_weekly_trend_json: JSON.stringify(cmsWeeklyTrend, null, 2),
				ultra_mini_points_json: JSON.stringify(ultraPoints, null, 2),
				ultra_mini_kpis_json: JSON.stringify(ultraKpis, null, 2),
				ultra_capabilities: listToTextarea(ultraCapabilities),
				contract_no_data_label: contractNoDataLabel,
				empty_states_json: JSON.stringify(emptyStates, null, 2),
			});
			setAdminUiSettingsNotice("");
			setAdminUiSettingsError("");
		}
	}, [master?.config, adminUiSettingsDirty]);

	const buildAdminHeaders = useCallback(
		({ stepUp = false } = {}) => {
			const headers = {};
			if (mfaCode) {
				headers["x-admin-mfa"] = mfaCode;
			}
			if (deviceId) {
				headers["x-admin-device"] = deviceId;
			}
			if (passkeyValue) {
				headers["x-admin-passkey"] = passkeyValue;
			}
			if (stepUp && stepUpCode) {
				headers["x-admin-stepup"] = stepUpCode;
				headers["x-admin-stepup-at"] = new Date().toISOString();
			}
			return headers;
		},
		[mfaCode, deviceId, stepUpCode, passkeyValue],
	);

	const handleSecurityFailure = useCallback((err) => {
		if (Number(err?.status) !== 403) {
			return false;
		}
		setSecurityGateOpen(true);
		setSecurityGateMessage(err?.message || "Admin security verification failed.");
		return true;
	}, []);

	async function refreshAudit() {
		const token = getToken();
		if (!token) {
			return;
		}
		try {
			const auditData = await apiRequest("/admin/audit?limit=40", {
				token,
				headers: buildAdminHeaders(),
			});
			setAudit(Array.isArray(auditData?.items) ? auditData.items : []);
		} catch {
			if (import.meta.env.DEV) {
			}
		}
	}

	const loadAdminData = useCallback(async () => {
		if (!isAllowedAdminViewer) {
			return;
		}
		const token = getToken();
		if (!token) {
			return;
		}

		setLoading(true);
		setError("");
		const headers = buildAdminHeaders();

		try {
			const [
				masterData,
				userRows,
				infraData,
				infraStateData,
				networkData,
				networkInventoryData,
				auditData,
				verificationData,
				contractsData,
				disputesData,
				partnersData,
				proofsData,
				catalogData,
				couponReportData,
				serverAdminData,
				cmsData,
				securityData,
				integrationData,
				signupsData,
				strikesData,
				fraudData,
				orgOwnershipData,
				walletLedgerData,
				disputeData,
			] = await Promise.all([
				apiRequest("/admin/master", { token, headers }),
				apiRequest("/admin/users", { token, headers }),
				apiRequest("/infra/overview", { token, headers }),
				apiRequest("/infra/state", { token, headers }),
				apiRequest("/network/overview", { token, headers }),
				apiRequest("/network/inventory", { token, headers }),
				apiRequest("/admin/audit?limit=40", { token, headers }),
				apiRequest("/verification/admin/queue", { token, headers }),
				apiRequest("/admin/contracts", { token, headers }),
				apiRequest("/admin/disputes", { token, headers }),
				apiRequest("/admin/partner-requests", { token, headers }),
				apiRequest("/admin/payment-proofs", { token, headers }),
				apiRequest("/admin/catalog", { token, headers }),
				apiRequest("/admin/coupons/report", { token, headers }),
				apiRequest("/admin/server-admin/state", { token, headers }),
				apiRequest("/admin/cms/state", { token, headers }),
				apiRequest("/admin/security/state", { token, headers }),
				apiRequest("/admin/integrations/status", { token, headers }),
				apiRequest("/admin/signups", { token, headers }),
				apiRequest("/admin/strikes", { token, headers }),
				apiRequest("/admin/fraud/verification", { token, headers }),
				apiRequest("/admin/orgs/ownership", { token, headers }),
				apiRequest("/admin/wallet/ledger", { token, headers }),
				apiRequest("/join-requests/disputes/all", { token, headers }).catch(() => ({ items: [] })),
			]);
			setMaster(masterData || null);
			setUsers(Array.isArray(userRows) ? userRows : []);
			setInfra(infraData || null);
			setInfraState(infraStateData || null);
			setNetwork(networkData || null);
			setNetworkInventory(networkInventoryData || null);
			setAudit(Array.isArray(auditData?.items) ? auditData.items : []);
			setVerificationQueue(
				Array.isArray(verificationData)
					? verificationData
					: Array.isArray(verificationData?.items)
						? verificationData.items
						: [],
			);
			setContractsVault(Array.isArray(contractsData?.items) ? contractsData.items : []);
			setDisputes(Array.isArray(disputesData?.items) ? disputesData.items : []);
			setPartnerRequests(Array.isArray(partnersData?.items) ? partnersData.items : []);
			setPaymentProofs(Array.isArray(proofsData?.items) ? proofsData.items : []);
			setCatalog(catalogData || null);
			setCouponReport(couponReportData || null);
			setServerAdminState(serverAdminData || null);
			setCmsState(cmsData || null);
			setSecurityState(securityData || null);
			setIntegrationStatus(integrationData || null);
			setSignups(Array.isArray(signupsData?.items) ? signupsData.items : []);
			setStrikeHistory(Array.isArray(strikesData?.items) ? strikesData.items : []);
			setFraudReview({
				items: Array.isArray(fraudData?.items) ? fraudData.items : [],
				duplicates: Array.isArray(fraudData?.duplicates) ? fraudData.duplicates : [],
			});
			setOrgOwnership(orgOwnershipData || { orgs: [], staff_list: [] });
			setWalletLedger(Array.isArray(walletLedgerData?.items) ? walletLedgerData.items : []);
			setDuplicateDisputes(Array.isArray(disputeData?.items) ? disputeData.items : []);
			setSecurityGateOpen(false);
			setSecurityGateMessage("");
			setSecurityGateNotice("");
		} catch (err) {
			if (!handleSecurityFailure(err)) {
				setError(err.message || "Failed to load admin data");
			}
		} finally {
			setLoading(false);
		}
	}, [isAllowedAdminViewer, buildAdminHeaders, handleSecurityFailure]);

	useEffect(() => {
		// eslint-disable-next-line react-hooks/set-state-in-effect
		loadAdminData();
	}, [loadAdminData]);

	useEffect(() => {
		if (pageLoading && !loading) {
			// eslint-disable-next-line react-hooks/set-state-in-effect
			setPageLoading(false);
		}
	}, [pageLoading, loading]);

	const summary = master?.summary || {};
	const uiFallbackInventory = useMemo(
		() => getAdminPanelFallbackInventory(master?.config),
		[master?.config],
	);
	const inventory = useMemo(() => {
		const inv = Array.isArray(master?.inventory) ? master.inventory : [];
		if (inv.length > 0) {
			return inv;
		}
		if (dynamicInventory && dynamicInventory.length > 0) {
			return dynamicInventory;
		}
		return uiFallbackInventory;
	}, [master?.inventory, uiFallbackInventory, dynamicInventory]);
	const securityContext = master?.security_context || {};
	const premiumUsers = useMemo(
		() => users.filter((u) => String(u.subscription_status || "").toLowerCase() === "premium"),
		[users],
	);
	const regionOptions = useMemo(() => {
		const set = new Set();
		users.forEach((u) => {
			const country = String(u.profile?.country || "").trim();
			if (country) {
				set.add(country);
			}
		});
		return ["all", ...Array.from(set).sort()];
	}, [users]);
	const filteredUsers = useMemo(() => {
		const query = userQuery.trim().toLowerCase();
		return users.filter((u) => {
			const matchesQuery =
				!query ||
				[u.name, u.email, u.role, u.id].some((value) =>
					String(value || "")
						.toLowerCase()
						.includes(query),
				);
			if (!matchesQuery) {
				return false;
			}
			if (roleFilter !== "all" && String(u.role || "").toLowerCase() !== roleFilter) {
				return false;
			}
			if (statusFilter !== "all" && String(u.status || "").toLowerCase() !== statusFilter) {
				return false;
			}
			if (regionFilter !== "all" && String(u.profile?.country || "").trim() !== regionFilter) {
				return false;
			}
			if (verificationFilter !== "all") {
				const isVerified = Boolean(u.verified);
				if (verificationFilter === "verified" && !isVerified) {
					return false;
				}
				if (verificationFilter === "unverified" && isVerified) {
					return false;
				}
			}
			if (premiumFilter !== "all") {
				const plan = String(u.subscription_status || "").toLowerCase();
				if (premiumFilter === "premium" && plan !== "premium") {
					return false;
				}
				if (premiumFilter === "free" && plan === "premium") {
					return false;
				}
			}
			return true;
		});
	}, [users, userQuery, roleFilter, statusFilter, regionFilter, verificationFilter, premiumFilter]);

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
	}, [networkInventory?.devices, networkQuery]);

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

	const filteredServerAdminAuditRows = useMemo(() => {
		const query = serverAdminAuditQuery.trim().toLowerCase();
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
	}, [audit, serverAdminAuditQuery]);

	const filteredCmsAuditRows = useMemo(() => {
		const query = cmsAuditQuery.trim().toLowerCase();
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
	}, [audit, cmsAuditQuery]);

	const filteredUltraAuditRows = useMemo(() => {
		const query = ultraAuditQuery.trim().toLowerCase();
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
	}, [audit, ultraAuditQuery]);

	const piePalette = useMemo(() => {
		const existing = getAdminPanelPiePalette(master?.config);
		if (existing && existing.length >= 2) {
			return existing;
		}
		if (dynamicPiePalette && dynamicPiePalette.length >= 2) {
			return dynamicPiePalette;
		}
		return existing;
	}, [master?.config, dynamicPiePalette]);
	const cmsWeeklyTrendFallback = useMemo(
		() => getCmsWeeklyTrendFallback(master?.config),
		[master?.config],
	);
	const ultraMiniChartPoints = useMemo(
		() => getUltraMiniChartPoints(master?.config),
		[master?.config],
	);
	const ultraMiniChartKpis = useMemo(() => getUltraMiniChartKpis(master?.config), [master?.config]);
	const contractNoDataLabel = useMemo(
		() => getContractNoDataLabel(master?.config),
		[master?.config],
	);
	const emptyCopy = useCallback(
		(key, fallback) => {
			const existing = getEmptyStateCopy(master?.config, key, fallback);
			if (existing && existing !== fallback) {
				return existing;
			}
			return dynamicEmptyStates?.[key] || fallback;
		},
		[master?.config, dynamicEmptyStates],
	);

	const analyticsOverview = catalog?.analytics || {};
	const activeUsersTrend = useMemo(() => {
		const trend = analyticsOverview.active_users_trend;
		return Array.isArray(trend) ? trend : [];
	}, [analyticsOverview?.active_users_trend]);
	const buyerRequestTrend = useMemo(() => {
		const trend = analyticsOverview.buyer_request_trend;
		return Array.isArray(trend) ? trend : [];
	}, [analyticsOverview?.buyer_request_trend]);
	const cmsTrendData = useMemo(() => {
		if (activeUsersTrend.length > 0) {
			return activeUsersTrend.slice(-7).map((row, idx) => ({
				name: row?.name || row?.day || row?.label || `D${idx + 1}`,
				value: Number(row?.value ?? row?.count ?? row?.users ?? 0) || 0,
			}));
		}
		return cmsWeeklyTrendFallback;
	}, [activeUsersTrend, cmsWeeklyTrendFallback]);

	const ultraSecurityCapabilities = useMemo(
		() => getUltraSecurityCapabilities(master?.config),
		[master?.config],
	);
	const contractStatusData = useMemo(() => {
		const counts = { signed: 0, pending: 0, dispute: 0 };
		contractsVault.forEach((row) => {
			const status = String(row?.lifecycle_status || "").toLowerCase();
			if (status.includes("signed")) {
				counts.signed += 1;
			} else if (status.includes("dispute")) {
				counts.dispute += 1;
			} else {
				counts.pending += 1;
			}
		});

		const total = counts.signed + counts.pending + counts.dispute;
		if (total === 0) {
			return [{ name: contractNoDataLabel, value: 1 }];
		}

		return [
			{ name: "Signed", value: counts.signed },
			{ name: "Pending", value: counts.pending },
			{ name: "Dispute", value: counts.dispute },
		];
	}, [contractsVault, contractNoDataLabel]);

	function updateDraft(id, field, value) {
		setUserDrafts((prev) => ({
			...prev,
			[id]: { ...prev[id], [field]: value },
		}));
	}

	async function saveUserEdits(userId) {
		const token = getToken();
		if (!token) {
			return;
		}
		const headers = buildAdminHeaders({ stepUp: true });
		const draft = userDrafts[userId] || {};

		const body = {
			role: draft.role,
			status: draft.status,
			verified: draft.verified,
			subscription_status: draft.subscription_status,
			policy_strikes: draft.policy_strikes,
			fraud_flags: draft.fraud_flags
				? String(draft.fraud_flags)
						.split(",")
						.map((v) => v.trim())
						.filter(Boolean)
				: undefined,
			admin_notes: draft.admin_notes,
			mfa_setup_code: draft.mfa_setup_code,
			stepup_setup_code: draft.stepup_setup_code,
		};

		const cleaned = Object.fromEntries(
			Object.entries(body).filter(([, value]) => value !== undefined),
		);
		try {
			await apiRequest(`/users/${userId}`, {
				method: "PATCH",
				token,
				headers,
				body: cleaned,
			});
			setUserDrafts((prev) => {
				const next = { ...prev };
				delete next[userId];
				return next;
			});
			const updatedUsers = await apiRequest("/admin/users", { token, headers });
			setUsers(Array.isArray(updatedUsers) ? updatedUsers : []);
		} catch (err) {
			setError(err.message || "Failed to update user");
		}
	}

	async function resetPassword(userId) {
		setPasswordResetTarget(userId);
		setPasswordResetValue("");
	}

	async function confirmResetPassword() {
		const userId = passwordResetTarget;
		if (!userId) {
			return;
		}
		const token = getToken();
		if (!token) {
			return;
		}
		const headers = buildAdminHeaders({ stepUp: true });
		if (!passwordResetValue || passwordResetValue.length < 8) {
			setError("Password must be at least 8 characters.");
			return;
		}
		try {
			await apiRequest(`/users/${userId}/reset-password`, {
				method: "POST",
				token,
				headers,
				body: { new_password: passwordResetValue },
			});
			setError("");
			setPasswordResetTarget(null);
			setPasswordResetValue("");
		} catch (err) {
			setError(err.message || "Failed to reset password");
		}
	}

	async function forceLogout(userId) {
		const token = getToken();
		if (!token) {
			return;
		}
		const headers = buildAdminHeaders({ stepUp: true });
		try {
			await apiRequest(`/users/${userId}/force-logout`, {
				method: "POST",
				token,
				headers,
			});
			toast.success("User logged out");
		} catch (err) {
			toast.error(err.message || "Failed to force logout");
		}
	}

	function confirmForceLogout(userId) {
		setForceLogoutTarget(userId);
	}

	async function lockMessaging(userId, hours = 24) {
		const token = getToken();
		if (!token) {
			return;
		}
		const headers = buildAdminHeaders({ stepUp: true });
		try {
			await apiRequest(`/users/${userId}/lock-messaging`, {
				method: "POST",
				token,
				headers,
				body: { lock_hours: hours },
			});
		} catch (err) {
			setError(err.message || "Failed to lock messaging");
		}
	}

	async function runAction(actionConfig) {
		if (!actionConfig) {
			return;
		}
		const token = getToken();
		if (!token) {
			return;
		}
		setActionBusy(actionConfig.id);
		const headers = buildAdminHeaders({ stepUp: true });
		try {
			await apiRequest(actionConfig.route, {
				method: "POST",
				token,
				headers,
				body: {
					action: actionConfig.id,
					payload: actionForm,
				},
			});
			await refreshAudit();
		} catch (err) {
			setError(err.message || "Failed to run admin action");
		} finally {
			setActionBusy("");
		}
	}

	async function runInlineAdminAction(actionId, payload = {}) {
		const token = getToken();
		if (!token) {
			return;
		}
		const headers = buildAdminHeaders({ stepUp: true });
		try {
			await apiRequest("/admin/actions", {
				method: "POST",
				token,
				headers,
				body: { action: actionId, payload },
			});
			await refreshAudit();
		} catch (err) {
			setError(err.message || "Failed to run admin action");
		}
	}

	async function refreshVerificationQueue() {
		const token = getToken();
		if (!token) {
			return;
		}
		const headers = buildAdminHeaders();
		const data = await apiRequest("/verification/admin/queue", {
			token,
			headers,
		});
		setVerificationQueue(Array.isArray(data?.items) ? data.items : []);
	}

	async function refreshContractsVault() {
		const token = getToken();
		if (!token) {
			return;
		}
		const headers = buildAdminHeaders();
		const data = await apiRequest("/admin/contracts", { token, headers });
		setContractsVault(Array.isArray(data?.items) ? data.items : []);
	}

	async function refreshDisputes() {
		const token = getToken();
		if (!token) {
			return;
		}
		const headers = buildAdminHeaders();
		const data = await apiRequest("/admin/disputes", { token, headers });
		setDisputes(Array.isArray(data?.items) ? data.items : []);
	}

	const refreshSupportTickets = useCallback(async () => {
		const token = getToken();
		if (!token) {
			return;
		}
		setSupportLoading(true);
		const headers = buildAdminHeaders();
		try {
			const params = new URLSearchParams();
			if (supportFilters.status && supportFilters.status !== "all") {
				params.set("status", supportFilters.status);
			}
			if (supportFilters.priority && supportFilters.priority !== "all") {
				params.set("priority", supportFilters.priority);
			}
			if (supportFilters.assigned_to) {
				params.set("assigned_to", supportFilters.assigned_to);
			}
			const query = params.toString();
			const path = query ? `/admin/support/tickets?${query}` : "/admin/support/tickets";
			const data = await apiRequest(path, { token, headers });
			setSupportTickets(Array.isArray(data?.items) ? data.items : []);
		} catch (err) {
			setSupportTickets([]);
			setError(err.message || "Failed to load support tickets");
		} finally {
			setSupportLoading(false);
		}
	}, [buildAdminHeaders, supportFilters]);

	const refreshModerationQueues = useCallback(async () => {
		setLoadingModeration(true);
		try {
			const token = getToken();
			if (!token) {
				return;
			}
			const headers = buildAdminHeaders();
			const [pendingData, rejectedData, mediaPendingData] = await Promise.all([
				apiRequest("/admin/moderation/products?status=pending_review", {
					token,
					headers,
				}),
				apiRequest("/admin/moderation/products?status=rejected", {
					token,
					headers,
				}),
				apiRequest("/admin/media/pending", {
					token,
					headers,
				}),
			]);
			const mediaItems = Array.isArray(mediaPendingData?.items) ? mediaPendingData.items : [];
			setModerationPending([
				...mediaItems,
				...(Array.isArray(pendingData?.items) ? pendingData.items : []),
			]);
			setModerationRejected(Array.isArray(rejectedData?.items) ? rejectedData.items : []);
		} finally {
			setLoadingModeration(false);
		}
	}, [buildAdminHeaders]);

	const refreshReportQueues = useCallback(async () => {
		const token = getToken();
		if (!token) {
			return;
		}
		const headers = buildAdminHeaders();
		const [systemData, appealData, contentData] = await Promise.all([
			apiRequest("/admin/reports/system", { token, headers }),
			apiRequest("/admin/reports/product-appeals", { token, headers }),
			apiRequest("/admin/reports/content", { token, headers }),
		]);
		setSystemReports(Array.isArray(systemData?.items) ? systemData.items : []);
		setProductAppealReports(Array.isArray(appealData?.items) ? appealData.items : []);
		setContentReports(Array.isArray(contentData?.items) ? contentData.items : []);
	}, [buildAdminHeaders]);

	const refreshMessagePolicyOps = useCallback(async () => {
		const token = getToken();
		if (!token) {
			return;
		}
		const headers = buildAdminHeaders();
		try {
			const [queueData, reviewData, metricsData] = await Promise.all([
				apiRequest("/messages/policy/queue-inspector?status=queued", {
					token,
					headers,
				}),
				apiRequest("/messages/policy/review-queue", { token, headers }),
				apiRequest("/messages/policy/reports/weekly-decision-quality", {
					token,
					headers,
				}),
			]);
			setPolicyQueueItems(Array.isArray(queueData?.rows) ? queueData.rows : []);
			setPolicyReviewRows(Array.isArray(reviewData?.rows) ? reviewData.rows : []);
			setPolicyMetrics(metricsData || null);
		} catch (err) {
			setPolicyQueueItems([]);
			setPolicyReviewRows([]);
			setPolicyMetrics(null);
			setError(err.message || "Failed to load communication policy queues");
		}
	}, [buildAdminHeaders]);

	async function saveClothingRules() {
		const token = getToken();
		if (!token) {
			return;
		}
		setClothingRulesBusy(true);
		setClothingRulesNotice("");
		setClothingRulesError("");
		try {
			const patch = {
				moderation: {
					clothing_rules: {
						forbidden_terms: textareaToList(clothingRulesForm.forbidden_terms),
						flag_terms: textareaToList(clothingRulesForm.flag_terms),
						allowed_terms: textareaToList(clothingRulesForm.allowed_terms),
						context_exceptions: textareaToList(clothingRulesForm.context_exceptions),
						reason_templates: {
							rejected: String(clothingRulesForm.reason_rejected || "").trim(),
							pending_review: String(clothingRulesForm.reason_pending || "").trim(),
							fix_guidance: String(clothingRulesForm.reason_fix || "").trim(),
						},
					},
				},
			};
			const updated = await apiRequest("/admin/config", {
				method: "PATCH",
				token,
				headers: buildAdminHeaders({ stepUp: true }),
				body: patch,
			});
			setMaster((prev) => (prev ? { ...prev, config: updated } : prev));
			setClothingRulesNotice("Clothing moderation rules updated.");
		} catch (err) {
			setClothingRulesError(err.message || "Unable to update rules.");
		} finally {
			setClothingRulesBusy(false);
		}
	}

	function isValidEmail(v) {
		return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v).trim());
	}

	async function saveEmailConfig() {
		const token = getToken();
		if (!token) {
			return;
		}
		const fromEmail = String(emailConfig.from_email || "").trim();
		const testRecipient = String(emailConfig.test_recipient || "").trim();
		if (fromEmail && !isValidEmail(fromEmail)) {
			setEmailConfigError("Invalid sender email address.");
			return;
		}
		if (testRecipient && !isValidEmail(testRecipient)) {
			setEmailConfigError("Invalid test recipient email address.");
			return;
		}
		setEmailConfigBusy(true);
		setEmailConfigNotice("");
		setEmailConfigError("");
		try {
			const patch = {
				notifications: {
					email: {
						enabled: Boolean(emailConfig.enabled),
						provider: emailConfig.provider || "smtp",
						from_name: String(emailConfig.from_name || "").trim(),
						from_email: fromEmail,
						test_recipient: testRecipient,
					},
				},
			};
			const updated = await apiRequest("/admin/config", {
				method: "PATCH",
				token,
				headers: buildAdminHeaders({ stepUp: true }),
				body: patch,
			});
			setMaster((prev) => (prev ? { ...prev, config: updated } : prev));
			setEmailConfigNotice("Email configuration saved.");
		} catch (err) {
			setEmailConfigError(err.message || "Unable to update email settings.");
		} finally {
			setEmailConfigBusy(false);
		}
	}

	async function saveOpenSearchConfig() {
		const token = getToken();
		if (!token) {
			return;
		}
		const url = String(openSearchConfig.url || "").trim();
		if (url && !/^https?:\/\/.+/.test(url)) {
			setOpenSearchError("Please enter a valid URL (http://... or https://...)");
			setOpenSearchConfigBusy(false);
			return;
		}
		setOpenSearchConfigBusy(true);
		setOpenSearchNotice("");
		setOpenSearchError("");
		try {
			const patch = {
				integrations: {
					opensearch: {
						enabled: Boolean(openSearchConfig.enabled),
						url,
						username: String(openSearchConfig.username || "").trim(),
						password: String(openSearchConfig.password || ""),
						index_prefix: String(openSearchConfig.index_prefix || "").trim(),
						timeout_ms: Math.max(
							500,
							Math.min(60_000, Number(openSearchConfig.timeout_ms || 3000)),
						),
						verify_tls: Boolean(openSearchConfig.verify_tls),
					},
				},
			};
			const updated = await apiRequest("/admin/config", {
				method: "PATCH",
				token,
				headers: buildAdminHeaders({ stepUp: true }),
				body: patch,
			});
			setMaster((prev) => (prev ? { ...prev, config: updated } : prev));
			setOpenSearchNotice("OpenSearch configuration saved.");
			await refreshIntegrationStatus();
			await refreshOpenSearchStatus();
		} catch (err) {
			setOpenSearchError(err.message || "Unable to update OpenSearch settings.");
		} finally {
			setOpenSearchConfigBusy(false);
		}
	}

	async function saveAdminUiSettings() {
		const token = getToken();
		if (!token) {
			return;
		}

		setAdminUiSettingsBusy(true);
		setAdminUiSettingsNotice("");
		setAdminUiSettingsError("");

		try {
			const roles = textareaToList(adminUiSettingsForm.allowed_roles)
				.map(normalizeRole)
				.filter((r) => KNOWN_ROLES.has(r));
			if (roles.length === 0) {
				throw new Error("Allowed roles cannot be empty.");
			}

			let inventory = [];
			try {
				const parsed = JSON.parse(adminUiSettingsForm.fallback_inventory_json || "[]");
				if (!Array.isArray(parsed)) {
					throw new Error("fallback_inventory must be a JSON array.");
				}
				inventory = parsed
					.map((row) => {
						const id = String(row?.id || "").trim();
						const label = String(row?.label || "").trim();
						const iconName = String(row?.icon_name || "").trim();
						if (!(id && label)) {
							return null;
						}
						return { id, label, icon_name: iconName };
					})
					.filter(Boolean);
			} catch (err) {
				throw new Error(`Invalid fallback inventory JSON: ${err.message || "parse error"}`);
			}

			if (inventory.length === 0) {
				throw new Error("Fallback inventory cannot be empty.");
			}

			const piePalette = textareaToList(adminUiSettingsForm.pie_palette)
				.map((c) => String(c || "").trim())
				.filter(isHexColor);
			if (piePalette.length < 2) {
				throw new Error("Pie palette must include at least 2 valid hex colors.");
			}

			let cmsWeeklyTrend = [];
			try {
				const parsed = JSON.parse(adminUiSettingsForm.cms_weekly_trend_json || "[]");
				if (!Array.isArray(parsed)) {
					throw new Error("cms weekly trend must be a JSON array.");
				}
				cmsWeeklyTrend = parsed
					.map((row) => {
						const name = String(row?.name || row?.day || row?.label || "").trim();
						const value = Number(row?.value ?? row?.count ?? row?.users ?? 0);
						if (!(name && Number.isFinite(value))) {
							return null;
						}
						return { name, value };
					})
					.filter(Boolean);
			} catch (err) {
				throw new Error(`Invalid CMS weekly trend JSON: ${err.message || "parse error"}`);
			}
			if (cmsWeeklyTrend.length === 0) {
				throw new Error("CMS weekly trend fallback cannot be empty.");
			}

			let ultraMiniPoints = [];
			try {
				const parsed = JSON.parse(adminUiSettingsForm.ultra_mini_points_json || "[]");
				if (!Array.isArray(parsed)) {
					throw new Error("ultra mini chart points must be a JSON array.");
				}
				ultraMiniPoints = parsed.map((n) => Number(n)).filter((n) => Number.isFinite(n));
			} catch (err) {
				throw new Error(`Invalid Ultra mini-chart points JSON: ${err.message || "parse error"}`);
			}
			if (ultraMiniPoints.length < 3) {
				throw new Error("Ultra mini-chart points must include at least 3 numbers.");
			}

			let ultraMiniKpis = [];
			try {
				const parsed = JSON.parse(adminUiSettingsForm.ultra_mini_kpis_json || "[]");
				if (!Array.isArray(parsed)) {
					throw new Error("ultra mini chart KPIs must be a JSON array.");
				}
				ultraMiniKpis = parsed
					.map((row) => {
						const label = String(row?.label || "").trim();
						const value = String(row?.value || "").trim();
						if (!(label && value)) {
							return null;
						}
						return { label, value };
					})
					.filter(Boolean);
			} catch (err) {
				throw new Error(`Invalid Ultra mini-chart KPIs JSON: ${err.message || "parse error"}`);
			}
			if (ultraMiniKpis.length === 0) {
				throw new Error("Ultra mini-chart KPIs cannot be empty.");
			}

			const ultraCapabilities = textareaToList(adminUiSettingsForm.ultra_capabilities)
				.map((v) => String(v || "").trim())
				.filter(Boolean);
			if (ultraCapabilities.length === 0) {
				throw new Error("Ultra Security capabilities cannot be empty.");
			}

			const contractNoDataLabel =
				String(adminUiSettingsForm.contract_no_data_label || "").trim() ||
				DEFAULT_CONTRACT_NO_DATA_LABEL;

			let emptyStates = {};
			try {
				const parsed = JSON.parse(adminUiSettingsForm.empty_states_json || "{}");
				if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
					throw new Error("empty_states must be a JSON object.");
				}
				emptyStates = Object.fromEntries(
					Object.entries(parsed)
						.map(([k, v]) => [String(k || "").trim(), String(v || "").trim()])
						.filter(([k, v]) => k && v),
				);
			} catch (err) {
				throw new Error(`Invalid empty-state copy JSON: ${err.message || "parse error"}`);
			}

			const patch = {
				ui: {
					admin_panel: {
						allowed_roles: roles,
						fallback_inventory: inventory,
						theme: {
							pie_palette: piePalette.slice(0, 12),
						},
						fallbacks: {
							cms: {
								weekly_trend: cmsWeeklyTrend.slice(0, 31),
							},
							ultra_security: {
								mini_chart_points: ultraMiniPoints.slice(0, 60),
								mini_chart_kpis: ultraMiniKpis.slice(0, 6),
								capabilities: ultraCapabilities.slice(0, 30),
							},
							contract_status: {
								no_data_label: contractNoDataLabel,
							},
						},
						copy: {
							empty_states: emptyStates,
						},
					},
				},
			};

			const updated = await apiRequest("/admin/config", {
				method: "PATCH",
				token,
				headers: buildAdminHeaders({ stepUp: true }),
				body: patch,
			});

			setMaster((prev) => (prev ? { ...prev, config: updated } : prev));
			setAdminUiSettingsDirty(false);
			setAdminUiSettingsNotice("Admin UI settings saved.");
		} catch (err) {
			setAdminUiSettingsError(err.message || "Unable to save Admin UI settings.");
		} finally {
			setAdminUiSettingsBusy(false);
		}
	}

	async function runOpenSearchAction(action, payload = {}) {
		const token = getToken();
		if (!token) {
			return;
		}
		const safeAction = String(action || "").trim();
		if (!safeAction) {
			return;
		}
		setOpenSearchActionBusy(safeAction);
		setOpenSearchNotice("");
		setOpenSearchError("");
		try {
			const result = await apiRequest("/admin/integrations/actions", {
				method: "POST",
				token,
				headers: buildAdminHeaders({ stepUp: true }),
				body: {
					action: safeAction,
					payload,
				},
			});
			if (!result?.ok) {
				throw new Error(result?.error || result?.result?.error || "OpenSearch action failed.");
			}

			const detail = result?.result || result?.status || null;
			const suffix =
				detail?.products !== undefined || detail?.requirements !== undefined
					? ` (${detail?.products ?? 0} products, ${detail?.requirements ?? 0} requirements)`
					: "";
			setOpenSearchNotice(
				`${safeAction.replace("opensearch.", "").replace(/_/g, " ")} ok${suffix}`,
			);
			await refreshIntegrationStatus();
			await refreshOpenSearchStatus();
		} catch (err) {
			setOpenSearchError(err.message || "OpenSearch action failed.");
		} finally {
			setOpenSearchActionBusy("");
		}
	}

	async function sendEmailTest() {
		const token = getToken();
		if (!token) {
			return;
		}
		const recipient = String(emailConfig.test_recipient || "").trim();
		if (!isValidEmail(recipient)) {
			setEmailConfigError("Enter a valid test recipient email first.");
			return;
		}
		setEmailConfigNotice("");
		setEmailConfigError("");
		try {
			const result = await apiRequest("/admin/actions", {
				method: "POST",
				token,
				headers: buildAdminHeaders({ stepUp: true }),
				body: {
					action: "email.test_send",
					to: emailConfig.test_recipient,
				},
			});
			const outcome = describeEmailTestOutcome(result);
			setEmailConfigNotice(outcome.notice);
			setEmailConfigError(outcome.error);
		} catch (err) {
			setEmailConfigError(err.message || "Unable to send test email.");
		}
	}

	async function resolveReportAdmin(reportId, action = "reviewed") {
		setResolutionReportTarget({ reportId, action });
		setResolutionNote("");
	}

	async function confirmResolveReport() {
		const target = resolutionReportTarget;
		if (!target) {
			return;
		}
		const { reportId, action } = target;
		const token = getToken();
		if (!(token && reportId)) {
			return;
		}
		const headers = buildAdminHeaders({ stepUp: true });
		await apiRequest(`/admin/reports/${encodeURIComponent(reportId)}/resolve`, {
			method: "POST",
			token,
			headers,
			body: { action, note: resolutionNote },
		});
		setResolutionReportTarget(null);
		setResolutionNote("");
		await refreshReportQueues();
		await refreshAudit();
	}

	async function assignSupportTicketAdmin(ticketId) {
		setAssignTicketTarget(ticketId);
		setAssigneeIdValue("");
	}

	async function confirmAssignTicket() {
		const ticketId = assignTicketTarget;
		if (!ticketId) {
			return;
		}
		const token = getToken();
		if (!token) {
			return;
		}
		const headers = buildAdminHeaders({ stepUp: true });
		await apiRequest("/admin/support/assign", {
			method: "POST",
			token,
			headers,
			body: { ticket_id: ticketId, assignee_id: assigneeIdValue },
		});
		setAssignTicketTarget(null);
		setAssigneeIdValue("");
		await refreshSupportTickets();
		await refreshAudit();
	}

	async function updateSupportTicketAdmin(ticketId, patch = {}) {
		const token = getToken();
		if (!(token && ticketId)) {
			return;
		}
		const headers = buildAdminHeaders({ stepUp: true });
		await apiRequest(`/admin/support/${encodeURIComponent(ticketId)}`, {
			method: "PATCH",
			token,
			headers,
			body: patch,
		});
		await refreshSupportTickets();
		await refreshAudit();
	}

	async function refreshPartnerRequests() {
		const token = getToken();
		if (!token) {
			return;
		}
		const headers = buildAdminHeaders();
		const data = await apiRequest("/admin/partner-requests", {
			token,
			headers,
		});
		setPartnerRequests(Array.isArray(data?.items) ? data.items : []);
	}

	async function refreshInfraState() {
		const token = getToken();
		if (!token) {
			return;
		}
		const headers = buildAdminHeaders();
		const data = await apiRequest("/infra/state", { token, headers });
		setInfraState(data || null);
	}

	async function refreshInfraAll() {
		const token = getToken();
		if (!token) {
			return;
		}
		const headers = buildAdminHeaders();
		const [overviewData, stateData] = await Promise.all([
			apiRequest("/infra/overview", { token, headers }),
			apiRequest("/infra/state", { token, headers }),
		]);
		setInfra(overviewData || null);
		setInfraState(stateData || null);
	}

	async function refreshNetworkInventory() {
		const token = getToken();
		if (!token) {
			return;
		}
		const headers = buildAdminHeaders();
		const data = await apiRequest("/network/inventory", { token, headers });
		setNetworkInventory(data || null);
	}

	async function refreshCatalog() {
		const token = getToken();
		if (!token) {
			return;
		}
		const headers = buildAdminHeaders();
		const [catalogData, couponData] = await Promise.all([
			apiRequest("/admin/catalog", { token, headers }),
			apiRequest("/admin/coupons/report", { token, headers }),
		]);
		setCatalog(catalogData || null);
		setCouponReport(couponData || null);
	}

	async function refreshServerAdminState() {
		const token = getToken();
		if (!token) {
			return;
		}
		const headers = buildAdminHeaders();
		const data = await apiRequest("/admin/server-admin/state", {
			token,
			headers,
		});
		setServerAdminState(data || null);
	}

	async function refreshCmsState() {
		const token = getToken();
		if (!token) {
			return;
		}
		const headers = buildAdminHeaders();
		const data = await apiRequest("/admin/cms/state", { token, headers });
		setCmsState(data || null);
	}

	async function refreshSecurityState() {
		const token = getToken();
		if (!token) {
			return;
		}
		const headers = buildAdminHeaders();
		const data = await apiRequest("/admin/security/state", { token, headers });
		setSecurityState(data || null);
	}

	async function refreshIntegrationStatus() {
		const token = getToken();
		if (!token) {
			return;
		}
		const headers = buildAdminHeaders();
		const data = await apiRequest("/admin/integrations/status", {
			token,
			headers,
		});
		setIntegrationStatus(data || null);
	}

	const refreshOpenSearchStatus = useCallback(async () => {
		const token = getToken();
		if (!token) {
			return;
		}
		const headers = buildAdminHeaders();
		const data = await apiRequest("/admin/integrations/opensearch/status", {
			token,
			headers,
		});
		setOpenSearchStatus(data || null);
	}, [buildAdminHeaders]);

	useEffect(() => {
		if (activeCategory !== "platform") {
			return;
		}
		// eslint-disable-next-line react-hooks/set-state-in-effect
		refreshSupportTickets();
		refreshModerationQueues();
		refreshReportQueues();
		refreshMessagePolicyOps();
	}, [
		activeCategory,
		refreshSupportTickets,
		refreshModerationQueues,
		refreshReportQueues,
		refreshMessagePolicyOps,
	]);

	useEffect(() => {
		if (activeCategory !== "server-admin") {
			return;
		}
		if (!isAllowedAdminViewer) {
			return;
		}
		refreshOpenSearchStatus();
	}, [activeCategory, isAllowedAdminViewer, refreshOpenSearchStatus]);

	useEffect(() => {
		if (activeCategory !== "media-review") {
			return;
		}
		// eslint-disable-next-line react-hooks/set-state-in-effect
		refreshModerationQueues();
	}, [activeCategory, refreshModerationQueues]);

	useEffect(() => {
		if (activeCategory !== "config") {
			return;
		}
		async function fetchConfigData() {
			setConfigEditorLoading(true);
			setConfigEditorNotice("");
			setConfigEditorError("");
			try {
				const token = getToken();
				const [inventory, actions, ui] = await Promise.all([
					apiRequest("/admin/config/inventory", { method: "GET", token }),
					apiRequest("/admin/config/actions/groups", { method: "GET", token }),
					apiRequest("/admin/config/ui", { method: "GET", token }),
				]);
				setConfigEditorData({
					inventory: inventory || [],
					actions: actions || [],
					ui: ui || {},
				});
			} catch (err) {
				setConfigEditorError(`Failed to load config: ${err.message}`);
			} finally {
				setConfigEditorLoading(false);
			}
		}
		fetchConfigData();
	}, [activeCategory]);

	async function refreshSignups() {
		const token = getToken();
		if (!token) {
			return;
		}
		const headers = buildAdminHeaders();
		const data = await apiRequest("/admin/signups", { token, headers });
		setSignups(Array.isArray(data?.items) ? data.items : []);
	}

	async function refreshStrikeHistory() {
		const token = getToken();
		if (!token) {
			return;
		}
		const headers = buildAdminHeaders();
		const data = await apiRequest("/admin/strikes", { token, headers });
		setStrikeHistory(Array.isArray(data?.items) ? data.items : []);
	}

	async function refreshFraudReview() {
		const token = getToken();
		if (!token) {
			return;
		}
		const headers = buildAdminHeaders();
		const data = await apiRequest("/admin/fraud/verification", {
			token,
			headers,
		});
		setFraudReview({
			items: Array.isArray(data?.items) ? data.items : [],
			duplicates: Array.isArray(data?.duplicates) ? data.duplicates : [],
		});
	}

	async function refreshDuplicateDisputes() {
		const token = getToken();
		if (!token) {
			return;
		}
		const headers = buildAdminHeaders();
		const data = await apiRequest("/join-requests/disputes/all", { token, headers });
		setDuplicateDisputes(Array.isArray(data?.items) ? data.items : []);
	}

	async function resolveDuplicateDispute(disputeId, action, reason) {
		const token = getToken();
		if (!token) {
			return;
		}
		const headers = buildAdminHeaders();
		await apiRequest(`/join-requests/disputes/${disputeId}/resolve`, {
			method: "POST",
			token,
			headers,
			body: { action, reason },
		});
		await refreshDuplicateDisputes();
	}

	async function refreshOrgOwnership() {
		const token = getToken();
		if (!token) {
			return;
		}
		const headers = buildAdminHeaders();
		const data = await apiRequest("/admin/orgs/ownership", { token, headers });
		setOrgOwnership(data || { orgs: [], staff_list: [] });
	}

	async function refreshWalletLedger() {
		const token = getToken();
		if (!token) {
			return;
		}
		const headers = buildAdminHeaders();
		const data = await apiRequest("/admin/wallet/ledger", { token, headers });
		setWalletLedger(Array.isArray(data?.items) ? data.items : []);
	}

	async function downloadCsv(path, filename) {
		const token = getToken();
		if (!token) {
			return;
		}
		const headers = buildAdminHeaders();
		const res = await fetch(`/api${path}`, {
			headers: {
				Authorization: `Bearer ${token}`,
				...headers,
			},
		});
		if (!res.ok) {
			const text = await res.text();
			throw new Error(text || "Export failed");
		}
		const blob = await res.blob();
		const url = window.URL.createObjectURL(blob);
		const link = document.createElement("a");
		link.href = url;
		link.download = filename;
		document.body.appendChild(link);
		link.click();
		link.remove();
		window.URL.revokeObjectURL(url);
	}

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

	async function runInfraAction(action, payload = {}) {
		const token = getToken();
		if (!token) {
			return;
		}
		const headers = buildAdminHeaders({ stepUp: true });
		try {
			await apiRequest("/infra/actions", {
				method: "POST",
				token,
				headers,
				body: { action, payload },
			});
			await refreshInfraState();
			await refreshAudit();
		} catch (err) {
			setError(err.message || "Failed to run infra action");
		}
	}

	async function runNetworkAction(action, payload = {}) {
		const token = getToken();
		if (!token) {
			return;
		}
		const headers = buildAdminHeaders({ stepUp: true });
		try {
			await apiRequest("/network/actions", {
				method: "POST",
				token,
				headers,
				body: { action, payload },
			});
			await refreshNetworkInventory();
			await refreshAudit();
		} catch (err) {
			setError(err.message || "Failed to run network action");
		}
	}

	async function runSecurityAction(action, payload = {}) {
		const token = getToken();
		if (!token) {
			return;
		}
		const headers = buildAdminHeaders({ stepUp: true });
		try {
			await apiRequest("/admin/security/actions", {
				method: "POST",
				token,
				headers,
				body: { action, payload },
			});
			await refreshSecurityState();
			await refreshAudit();
		} catch (err) {
			setError(err.message || "Failed to run security action");
		}
	}

	async function handleSecurityUnlock() {
		await loadAdminData();
	}

	async function handleGatePasskeyAuth() {
		const current = getCurrentUser();
		const identifier = current?.email || current?.member_id;
		if (!identifier) {
			setSecurityGateNotice("Unable to resolve current account for passkey verification.");
			return;
		}
		setPasskeyBusy(true);
		setSecurityGateNotice("");
		try {
			const optionsRes = await apiRequest("/auth/passkey/login/options", {
				method: "POST",
				body: { identifier, purpose: "admin_security" },
			});
			const assertion = await startAuthentication(optionsRes.options);
			const verify = await apiRequest("/auth/passkey/login/verify", {
				method: "POST",
				body: { identifier, credential: assertion, purpose: "admin_security" },
			});
			saveSession(verify.user, verify.token);
			setSecurityGateNotice("Passkey verified. Reloading admin panel…");
			await loadAdminData();
		} catch (err) {
			setSecurityGateNotice(err?.message || "Passkey verification failed.");
		} finally {
			setPasskeyBusy(false);
		}
	}

	function handleSecurityDecline() {
		setSecurityGateOpen(false);
		setSecurityGateMessage("");
		setSecurityGateNotice("");
	}

	const themeStyles = useMemo(
		() =>
			adminDark
				? {
						shell: "bg-slate-950 text-slate-100",
						background:
							"bg-[radial-gradient(ellipse_at_top,_rgba(51,122,176,0.22),_transparent_45%),linear-gradient(to_bottom_right,_#020617,_#07111f_55%,_#081221)]",
						panel: "bg-white/5 border-white/10 backdrop-blur-xl",
						muted: "text-slate-400",
						soft: "text-slate-300",
						item: "hover:bg-white/6 hover:border-cyan-400/20",
						itemActive: "bg-gradient-to-r from-cyan-500/18 to-sky-500/12 border-cyan-300/20",
						glow: "shadow-[0_0_32px_rgba(109,171,223,0.14)]",
						chip: "bg-cyan-400/10 text-cyan-200 border-cyan-300/15",
						accentText: "text-cyan-200",
					}
				: {
						shell: "bg-slate-50 text-slate-900",
						background:
							"bg-[radial-gradient(ellipse_at_top,_rgba(109,171,223,0.16),_transparent_45%),linear-gradient(to_bottom_right,_#f8fbff,_#eef6ff_55%,_#f7fbff)]",
						panel: "bg-white border-slate-200",
						muted: "text-slate-500",
						soft: "text-slate-600",
						item: "hover:bg-sky-50 hover:border-sky-200",
						itemActive: "bg-gradient-to-r from-sky-100 to-cyan-50 border-sky-200",
						glow: "shadow-[0_0_24px_rgba(55,115,168,0.10)]",
						chip: "bg-sky-100 text-sky-700 border-sky-200",
						accentText: "text-sky-700",
					},
		[adminDark],
	);

	const sidebarItems = useMemo(() => {
		const uiById = new Map(uiFallbackInventory.map((row) => [row.id, row]));
		const items = [
			{
				id: "home",
				label: "HomeCore",
				icon: LayoutDashboard,
				sub: "Platform & Business Control",
				accent: true,
			},
		];

		inventory.forEach((item) => {
			let sub = "Management";
			const ui = uiById.get(item.id);
			const label = ui?.label || item.label;
			const iconName = ui?.icon_name || item.icon_name || "";
			let icon = getIconComponent(iconName, ShieldCheck);
			const accent = false;

			if (item.id === "platform") {
				return;
			}
			if (item.id === "infra") {
				sub = "Management";
				icon = getIconComponent(iconName, Server);
			} else if (item.id === "network") {
				sub = "Enterprise Level";
				icon = getIconComponent(iconName, Network);
			} else if (item.id === "server-admin") {
				sub = "Full Stack";
				icon = getIconComponent(iconName, MonitorCog);
			} else if (item.id === "cms") {
				sub = "Powerful publishing flow";
				icon = getIconComponent(iconName, Database);
			} else if (item.id === "ultra-security") {
				sub = "Advanced";
				icon = getIconComponent(iconName, Shield);
			}

			items.push({ ...item, label, icon, sub, accent });
		});

		items.push({
			id: "ai",
			label: "AI Assistant",
			icon: Bot,
			sub: "Configure AI rules & behavior",
			accent: true,
		});

		items.push({
			id: "files",
			label: "File Explorer",
			icon: FolderOpen,
			sub: "Browse server uploads",
			accent: false,
		});

		items.push({
			id: "media-review",
			label: "Media Review",
			icon: ShieldCheck,
			sub: "Approve uploads",
			accent: false,
		});

		items.push({
			id: "finance",
			label: "Finance",
			icon: Wallet,
			sub: "Revenue, subscriptions & ledger",
			accent: false,
		});

		return items;
	}, [inventory, uiFallbackInventory]);

	const activeData = useMemo(() => {
		if (activeCategory === "home") {
			return {
				label: "HomeCore",
				sub: "Platform & Business Control",
				sections: [],
			};
		}
		if (activeCategory === "ai") {
			return {
				id: "ai",
				label: "AI Assistant",
				sub: "Configure AI rules & behavior",
				sections: [],
			};
		}
		if (activeCategory === "files") {
			return {
				id: "files",
				label: "File Explorer",
				sub: "Browse server uploads",
				sections: [],
			};
		}
		if (activeCategory === "media-review") {
			return {
				id: "media-review",
				label: "Media Review",
				sub: "Approve uploads",
				sections: [],
			};
		}
		if (activeCategory === "finance") {
			return {
				id: "finance",
				label: "Finance",
				sub: "Revenue, subscriptions & ledger",
				sections: [],
			};
		}
		const cat = inventory.find((row) => row.id === activeCategory) || inventory[0];
		if (!cat) {
			return { label: "Admin", sub: "", sections: [] };
		}
		const ui = uiFallbackInventory.find((row) => row.id === cat.id);
		return { ...cat, label: ui?.label || cat.label };
	}, [activeCategory, inventory, uiFallbackInventory]);

	const CategoryIcon = useMemo(() => {
		const item = sidebarItems.find((i) => i.id === activeCategory);
		return item?.icon || ShieldCheck;
	}, [activeCategory, sidebarItems]);

	const infraInputClass = adminDark
		? "w-full rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-sky-400/60"
		: "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-sky-400/60";

	const infraFieldPanel = adminDark
		? "rounded-2xl border border-slate-800 bg-slate-900/60 p-4"
		: "rounded-2xl border border-slate-200 bg-slate-50 p-4";

	if (pageLoading) {
		return <NeonAtom fill={true} timeout={10_000} />;
	}

	if (!isAllowedAdminViewer) {
		const roles = adminPanelAllowedRoles.join(", ");
		return (
			<AccessDeniedState
				message={`Admin panel access is limited to: ${roles || "owner, admin"}.`}
			/>
		);
	}

	return (
		<>
			<AdminSecurityGate
				open={securityGateOpen}
				message={securityGateMessage}
				mfaCode={mfaCode}
				setMfaCode={setMfaCode}
				stepUpCode={stepUpCode}
				setStepUpCode={setStepUpCode}
				passkeyBusy={passkeyBusy}
				notice={securityGateNotice}
				onPasskeyAuth={handleGatePasskeyAuth}
				onUnlock={handleSecurityUnlock}
				onDecline={handleSecurityDecline}
			/>
			<div
				class={`admin-shell min-h-dvh w-full flex-1 ${themeStyles.shell} ${themeStyles.background} flex overflow-hidden transition-colors`}
			>
				<div class="admin-plasma" />
				<div class="admin-current" />
				<div class="admin-noise" />

				<aside
					class={`fixed left-0 top-0 z-20 h-full w-[320px] overflow-hidden border-r border-slate-200/80 dark:border-white/10 bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl transition-transform duration-300 ${
						sidebarOpen ? "translate-x-0" : "-translate-x-full"
					} lg:translate-x-0`}
				>
					<div class="absolute inset-0 pointer-events-none">
						<div
							class={`absolute -top-20 -right-20 h-56 w-56 rounded-full blur-3xl ${adminDark ? "bg-cyan-500/18" : "bg-sky-300/35"}`}
						/>
						<div
							class={`absolute -bottom-24 -left-16 h-56 w-56 rounded-full blur-3xl ${adminDark ? "bg-blue-500/12" : "bg-cyan-300/25"}`}
						/>
					</div>

					<div class="relative flex h-full flex-col p-5">
						{/* Header */}
						<div class="flex items-start justify-between gap-4">
							<div class="flex items-center gap-3">
								<div
									class={`grid h-12 w-12 place-items-center rounded-2xl ${adminDark ? "bg-gradient-to-br from-cyan-400 via-sky-500 to-blue-600" : "bg-gradient-to-br from-sky-400 via-cyan-400 to-blue-500"} shadow-[0_0_24px_rgba(109,171,223,0.25)]`}
								>
									<span class="text-lg font-black tracking-tight text-white">G</span>
								</div>
								<div>
									<div class={`text-lg font-semibold tracking-tight ${themeStyles.soft}`}>
										GarTexHub
									</div>
									<div
										class={`mt-0.5 inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium ${themeStyles.chip}`}
									>
										<Crown class="h-3.5 w-3.5" />
										Admin Matrix
									</div>
									<div class="mt-3 flex gap-2">
										<button
											type="button"
											onClick={toggleNav}
											aria-expanded={navCollapsed ? "false" : "true"}
											class="rounded-full border border-slate-200/80 px-3 py-1 text-[11px] font-medium dark:border-white/10"
										>
											{navCollapsed ? "Show nav" : "Hide nav"}
										</button>
										<button
											type="button"
											onClick={toggleFooter}
											aria-expanded={footerCollapsed ? "false" : "true"}
											class="rounded-full border border-slate-200/80 px-3 py-1 text-[11px] font-medium dark:border-white/10"
										>
											{footerCollapsed ? "Show footer" : "Hide footer"}
										</button>
									</div>
								</div>
							</div>

							<button
								onClick={toggleTheme}
								class={`inline-flex h-11 w-11 items-center justify-center rounded-2xl border transition-all duration-300 ${
									adminDark
										? "border-white/10 bg-white/5 hover:bg-white/10"
										: "border-slate-200 bg-white hover:bg-slate-50"
								}`}
							>
								{adminDark ? (
									<SunMedium class="h-5 w-5 text-cyan-200" />
								) : (
									<Moon class="h-5 w-5 text-sky-700" />
								)}
							</button>
						</div>

						{/* Navigation */}
						<nav
							data-lenis-prevent={true}
							class="mt-6 space-y-2 overflow-y-auto overflow-x-hidden pr-1"
						>
							{sidebarItems.map((item) => {
								const Icon = item.icon;
								const isActive = activeCategory === item.id;
								return (
									<button
										key={item.id}
										type="button"
										onClick={() => setActiveCategory(item.id)}
										class={`group relative flex w-full items-center gap-3 rounded-[16px] border px-4 py-3 text-left transition-all duration-300 ${
											isActive ? themeStyles.itemActive : themeStyles.item
										} ${isActive ? "border-cyan-300/20" : "border-transparent"}`}
									>
										<div
											class={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border transition-all duration-300 ${
												isActive
													? adminDark
														? "border-cyan-300/20 bg-cyan-400/12"
														: "border-sky-200 bg-sky-100"
													: adminDark
														? "border-white/10 bg-white/5 group-hover:border-cyan-300/15"
														: "border-slate-200 bg-slate-50 group-hover:border-sky-200"
											}`}
										>
											<Icon
												class={`h-5 w-5 ${isActive ? themeStyles.accentText : themeStyles.soft}`}
											/>
										</div>

										{/* Tooltip */}
										<div class="absolute left-[70px] z-50 whitespace-nowrap opacity-0 group-hover:opacity-100 translate-x-[-5px] group-hover:translate-x-0 transition-all duration-200 pointer-events-none">
											<div
												class={`px-3 py-1.5 rounded-lg text-xs font-medium shadow-lg ${adminDark ? "bg-slate-900 text-white border border-white/10" : "bg-white text-slate-900 border border-slate-200"}`}
											>
												{item.label}
											</div>
										</div>

										<div class="min-w-0 flex-1">
											<div class="flex items-center gap-2">
												<span
													class={`truncate text-sm font-medium ${adminDark ? "text-white" : "text-slate-900"}`}
												>
													{item.label}
												</span>
												{item.accent && (
													<span
														class={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] ${themeStyles.chip}`}
													>
														Core
													</span>
												)}
											</div>
											<p class={`mt-0.5 truncate text-xs ${themeStyles.muted}`}>{item.sub}</p>
										</div>

										<ChevronRight
											class={`h-4 w-4 transition-transform group-hover:translate-x-0.5 ${isActive ? themeStyles.accentText : themeStyles.muted}`}
										/>
									</button>
								);
							})}
						</nav>
					</div>
				</aside>

				<main
					class={`relative z-10 flex min-w-0 flex-1 flex-col overflow-hidden pr-4 py-4 sm:pr-6 sm:py-6 ${sidebarOpen ? "pl-[320px]" : "pl-0"} lg:pl-[320px]`}
				>
					<div class="flex flex-wrap items-center justify-between gap-3 pb-4">
						<button
							type="button"
							onClick={() => setSidebarOpen(!sidebarOpen)}
							class="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white p-2 text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 lg:hidden"
						>
							<Menu class="h-5 w-5" />
						</button>
						<div class="admin-panel admin-sweep flex min-w-[220px] flex-1 items-center gap-2 rounded-full px-4 py-2 text-xs text-slate-200 md:max-w-md">
							<Search class="h-4 w-4 text-sky-200/80" />
							<input
								class="w-full bg-transparent text-xs text-slate-200 placeholder:text-slate-400 focus:outline-none"
								placeholder="Search accounts, contracts, proofs..."
							/>
						</div>
						<button
							type="button"
							onClick={() => setAdminDark((prev) => !prev)}
							class="admin-panel flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold text-white/90"
						>
							{adminDark ? (
								<Sun class="h-4 w-4 text-yellow-300" />
							) : (
								<Moon class="h-4 w-4 text-slate-700" />
							)}
							{adminDark ? "Light" : "Dark"}
						</button>
					</div>

					{/* Mobile backdrop */}
					{sidebarOpen && (
						<div
							class="fixed inset-0 z-40 bg-black/50 lg:hidden"
							onClick={() => setSidebarOpen(false)}
						/>
					)}

					<div data-lenis-prevent={true} class="flex-1 overflow-y-auto pb-6 pr-2">
						<div class="space-y-8">
							{error ? (
								<div class="admin-panel admin-sweep rounded-2xl shadow-borderless dark:shadow-borderlessDark bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
									{error}
								</div>
							) : null}

							{activeCategory === "home" ? (
								<AdminHomeSection
									activeCategory={activeCategory}
									adminDark={adminDark}
									loading={loading}
									error={error}
									summary={summary}
									network={network}
									infra={infra}
									premiumUsers={premiumUsers}
									formatNumber={formatNumber}
									formatCurrency={formatCurrency}
									toggleTheme={toggleTheme}
									downloadCsv={downloadCsv}
									setError={setError}
									actionGroups={actionGroups}
									activeUsersTrend={activeUsersTrend}
									contractStatusData={contractStatusData}
									buyerRequestTrend={buyerRequestTrend}
									buyerBenefits={buyerBenefits}
									factoryBenefits={factoryBenefits}
									buyingHouseBenefits={buyingHouseBenefits}
								/>
							) : null}
							{activeCategory === "home" ? null : (
								<>
									{activeCategory === "files" && <FileExplorerSection adminDark={adminDark} />}
									{activeCategory === "media-review" && (
										<AdminMediaReviewSection
											adminDark={adminDark}
											moderationPending={moderationPending}
											loadingModeration={loadingModeration}
											setModerationPending={setModerationPending}
											setAiModalDoc={setAiModalDoc}
											setRejectionModalOpen={setRejectionModalOpen}
											setRejectionItem={setRejectionItem}
										/>
									)}
									<div class="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
										<section class="space-y-4">
											<div class="admin-card admin-sweep rounded-3xl p-6">
												<div class="flex flex-wrap items-center justify-between gap-3">
													<div class="flex items-center gap-2">
														<CategoryIcon class="h-5 w-5 text-orange-200/80" />
														<div>
															<p class="text-sm font-bold">{activeData?.label || "Module"}</p>
															<p class="text-xs text-slate-500">
																{activeData?.sections?.length || 0} sections
															</p>
														</div>
													</div>
													<span
														class={`rounded-full px-2 py-0.5 text-[10px] font-semibold${statusBadge("live")}`}
													>
														live
													</span>
												</div>
											</div>

											{activeCategory === "finance" ? (
												<AdminFinanceSection
													adminDark={adminDark}
													catalog={catalog}
													walletLedger={walletLedger}
													users={users}
													formatNumber={formatNumber}
													formatCurrency={formatCurrency}
													error={error}
													setError={setError}
												/>
											) : null}
											{activeCategory === "platform" ? (
												<AdminPlatformSection
													activeCategory={activeCategory}
													adminDark={adminDark}
													catalog={catalog}
													users={users}
													verificationQueue={verificationQueue}
													contractsVault={contractsVault}
													disputes={disputes}
													supportTickets={supportTickets}
													partnerRequests={partnerRequests}
													paymentProofs={paymentProofs}
													userQuery={userQuery}
													setUserQuery={setUserQuery}
													roleFilter={roleFilter}
													setRoleFilter={setRoleFilter}
													statusFilter={statusFilter}
													setStatusFilter={setStatusFilter}
													regionFilter={regionFilter}
													setRegionFilter={setRegionFilter}
													verificationFilter={verificationFilter}
													setVerificationFilter={setVerificationFilter}
													premiumFilter={premiumFilter}
													setPremiumFilter={setPremiumFilter}
													userDrafts={userDrafts}
													featuredForm={featuredForm}
													walletLedger={walletLedger}
													couponReport={couponReport}
													signups={signups}
													strikeHistory={strikeHistory}
													fraudReview={fraudReview}
													orgOwnership={orgOwnership}
													duplicateDisputes={duplicateDisputes}
													setDuplicateDisputes={setDuplicateDisputes}
													refreshDuplicateDisputes={refreshDuplicateDisputes}
													resolveDuplicateDispute={resolveDuplicateDispute}
													policyQueueItems={policyQueueItems}
													policyReviewRows={policyReviewRows}
													policyMetrics={policyMetrics}
													reputationSenderId={reputationSenderId}
													reputationDelta={reputationDelta}
													clothingRulesForm={clothingRulesForm}
													clothingRulesBusy={clothingRulesBusy}
													clothingRulesNotice={clothingRulesNotice}
													clothingRulesError={clothingRulesError}
													error={error}
													setError={setError}
													audit={audit}
													refreshAudit={refreshAudit}
													refreshReportQueues={refreshReportQueues}
													refreshPartnerRequests={refreshPartnerRequests}
													refreshSupportTickets={refreshSupportTickets}
													formatNumber={formatNumber}
													formatCurrency={formatCurrency}
													confirmForceLogout={confirmForceLogout}
													lockMessaging={lockMessaging}
													passwordResetTarget={passwordResetTarget}
													setPasswordResetTarget={setPasswordResetTarget}
													passwordResetValue={passwordResetValue}
													setPasswordResetValue={setPasswordResetValue}
													confirmResetPassword={confirmResetPassword}
												/>
											) : null}
											{activeCategory === "infra" ? (
												<AdminInfraSection
													adminDark={adminDark}
													infra={infra}
													infraState={infraState}
													infraSearch={infraSearch}
													setInfraSearch={setInfraSearch}
													audit={audit}
													verificationQueue={verificationQueue}
													disputes={disputes}
													firewallForm={firewallForm}
													setFirewallForm={setFirewallForm}
													packageForm={packageForm}
													setPackageForm={setPackageForm}
													cronForm={cronForm}
													setCronForm={setCronForm}
													osUserForm={osUserForm}
													setOsUserForm={setOsUserForm}
													sshKeyForm={sshKeyForm}
													setSshKeyForm={setSshKeyForm}
													sslForm={sslForm}
													setSslForm={setSslForm}
													infraBackupForm={infraBackupForm}
													setInfraBackupForm={setInfraBackupForm}
													timeForm={timeForm}
													setTimeForm={setTimeForm}
													formatNumber={formatNumber}
													toggleTheme={toggleTheme}
													refreshInfraAll={refreshInfraAll}
													refreshInfraState={refreshInfraState}
													refreshVerificationQueue={refreshVerificationQueue}
													refreshDisputes={refreshDisputes}
													refreshAudit={refreshAudit}
													runInfraAction={runInfraAction}
												/>
											) : null}
											{activeCategory === "network" ? (
												<AdminNetworkSection
													adminDark={adminDark}
													catalog={catalog}
													network={network}
													setNetwork={setNetwork}
													networkInventory={networkInventory}
													setNetworkInventory={setNetworkInventory}
													networkQuery={networkQuery}
													setNetworkQuery={setNetworkQuery}
													networkAuditQuery={networkAuditQuery}
													setNetworkAuditQuery={setNetworkAuditQuery}
													networkNav={networkNav}
													setNetworkNav={setNetworkNav}
													vlanForm={vlanForm}
													setVlanForm={setVlanForm}
													ipamForm={ipamForm}
													setIpamForm={setIpamForm}
													integrationStatus={integrationStatus}
													setIntegrationStatus={setIntegrationStatus}
													backupForm={backupForm}
													setBackupForm={setBackupForm}
													buildAdminHeaders={buildAdminHeaders}
													apiRequest={apiRequest}
													getToken={getToken}
													formatNumber={formatNumber}
													error={error}
													setError={setError}
													toggleTheme={toggleTheme}
													audit={audit}
													verificationQueue={verificationQueue}
													disputes={disputes}
													refreshNetworkInventory={refreshNetworkInventory}
													refreshVerificationQueue={refreshVerificationQueue}
													refreshDisputes={refreshDisputes}
													refreshAudit={refreshAudit}
													runNetworkAction={runNetworkAction}
													networkCapabilities={_networkCapabilities}
												/>
											) : null}

											{activeCategory === "server-admin" ? (
												<AdminServerSection
													adminDark={adminDark}
													catalog={catalog}
													serverAdminState={serverAdminState}
													setServerAdminState={setServerAdminState}
													serverAdminAuditQuery={serverAdminAuditQuery}
													setServerAdminAuditQuery={setServerAdminAuditQuery}
													packageForm={packageForm}
													setPackageForm={setPackageForm}
													cronForm={cronForm}
													setCronForm={setCronForm}
													osUserForm={osUserForm}
													setOsUserForm={setOsUserForm}
													sshKeyForm={sshKeyForm}
													setSshKeyForm={setSshKeyForm}
													sslForm={sslForm}
													setSslForm={setSslForm}
													timeForm={timeForm}
													setTimeForm={setTimeForm}
													buildAdminHeaders={buildAdminHeaders}
													apiRequest={apiRequest}
													getToken={getToken}
													formatNumber={formatNumber}
													error={error}
													setError={setError}
													toggleTheme={toggleTheme}
													loading={loading}
													users={users}
													verificationQueue={verificationQueue}
													infraState={infraState}
													supportTickets={supportTickets}
													refreshServerAdminState={refreshServerAdminState}
													integrationStatus={integrationStatus}
													refreshIntegrationStatus={refreshIntegrationStatus}
													securityContext={securityContext}
													openSearchConfig={openSearchConfig}
													setOpenSearchConfig={setOpenSearchConfig}
													openSearchStatus={openSearchStatus}
													refreshOpenSearchStatus={refreshOpenSearchStatus}
													openSearchNotice={openSearchNotice}
													openSearchError={openSearchError}
													openSearchConfigBusy={openSearchConfigBusy}
													openSearchActionBusy={openSearchActionBusy}
													openSearchReset={openSearchReset}
													setOpenSearchReset={setOpenSearchReset}
													openSearchOrgId={openSearchOrgId}
													setOpenSearchOrgId={setOpenSearchOrgId}
													saveOpenSearchConfig={saveOpenSearchConfig}
													runOpenSearchAction={runOpenSearchAction}
													emailConfig={emailConfig}
													setEmailConfig={setEmailConfig}
													emailConfigNotice={emailConfigNotice}
													emailConfigError={emailConfigError}
													emailConfigBusy={emailConfigBusy}
													saveEmailConfig={saveEmailConfig}
													sendEmailTest={sendEmailTest}
													adminUiSettingsForm={adminUiSettingsForm}
													setAdminUiSettingsForm={setAdminUiSettingsForm}
													adminUiSettingsDirty={adminUiSettingsDirty}
													setAdminUiSettingsDirty={setAdminUiSettingsDirty}
													adminUiSettingsNotice={adminUiSettingsNotice}
													adminUiSettingsError={adminUiSettingsError}
													adminUiSettingsBusy={adminUiSettingsBusy}
													saveAdminUiSettings={saveAdminUiSettings}
													audit={audit}
													filteredServerAdminAuditRows={filteredServerAdminAuditRows}
													filteredNetworkAuditRows={filteredNetworkAuditRows}
													refreshAudit={refreshAudit}
													downloadJson={downloadJson}
												/>
											) : null}

											{activeCategory === "cms" ? (
												<AdminCMSSection
													adminDark={adminDark}
													catalog={catalog}
													cmsState={cmsState}
													setCmsState={setCmsState}
													cmsTab={cmsTab}
													setCmsTab={setCmsTab}
													cmsAuditQuery={cmsAuditQuery}
													setCmsAuditQuery={setCmsAuditQuery}
													buildAdminHeaders={buildAdminHeaders}
													apiRequest={apiRequest}
													getToken={getToken}
													formatNumber={formatNumber}
													error={error}
													setError={setError}
													filteredCmsAuditRows={filteredCmsAuditRows}
													cmsTrendData={cmsTrendData}
													verificationQueue={verificationQueue}
													disputes={disputes}
													emptyCopy={emptyCopy}
													refreshCmsState={refreshCmsState}
													refreshAudit={refreshAudit}
													refreshVerificationQueue={refreshVerificationQueue}
													refreshDisputes={refreshDisputes}
													toggleTheme={toggleTheme}
												/>
											) : null}

											{activeCategory === "ultra-security" ? (
												<AdminSecuritySection
													adminDark={adminDark}
													catalog={catalog}
													securityState={securityState}
													setSecurityState={setSecurityState}
													ultraAuditQuery={ultraAuditQuery}
													setUltraAuditQuery={setUltraAuditQuery}
													buildAdminHeaders={buildAdminHeaders}
													apiRequest={apiRequest}
													getToken={getToken}
													formatNumber={formatNumber}
													error={error}
													setError={setError}
													audit={audit}
													filteredUltraAuditRows={filteredUltraAuditRows}
													toggleTheme={toggleTheme}
													verificationQueue={verificationQueue}
													disputes={disputes}
													ultraMiniChartPoints={ultraMiniChartPoints}
													ultraMiniChartKpis={ultraMiniChartKpis}
													emptyCopy={emptyCopy}
												/>
											) : null}
										</section>

										{activeCategory === "ultra-security" ||
										activeCategory === "files" ||
										activeCategory === "media-review" ||
										activeCategory === "finance" ? null : (
											<aside class="space-y-4">
												{activeCategory === "config" ? (
													<AdminConfigSection
														configEditorTab={configEditorTab}
														setConfigEditorTab={setConfigEditorTab}
														configEditorLoading={configEditorLoading}
														configEditorError={configEditorError}
														configEditorData={configEditorData}
														configEditorSaving={configEditorSaving}
														setConfigEditorSaving={setConfigEditorSaving}
														configEditorNotice={configEditorNotice}
														setConfigEditorNotice={setConfigEditorNotice}
														setConfigEditorError={setConfigEditorError}
													/>
												) : null}

												{activeCategory === "ai" ? (
													<AdminAISection activeCategory={activeCategory} adminDark={adminDark} />
												) : null}
											</aside>
										)}
									</div>
								</>
							)}
						</div>
					</div>
				</main>
				{(navCollapsed || footerCollapsed) && (
					<div class="fixed bottom-4 right-4 z-40 flex gap-2">
						{navCollapsed && (
							<button
								type="button"
								onClick={toggleNav}
								class="rounded-full bg-sky-500 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-sky-500/25 transition hover:-translate-y-0.5"
							>
								Show nav
							</button>
						)}
						{footerCollapsed && (
							<button
								type="button"
								onClick={toggleFooter}
								class="rounded-full bg-sky-500 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-sky-500/25 transition hover:-translate-y-0.5"
							>
								Show footer
							</button>
						)}
					</div>
				)}
			</div>

			<RejectionReasonModal
				open={rejectionModalOpen}
				onClose={() => {
					setRejectionModalOpen(false);
					setRejectionItem(null);
				}}
				onConfirm={async (reason) => {
					if (!rejectionItem) {
						return;
					}
					const docId = rejectionItem.id;
					await apiRequest(`/admin/media/${encodeURIComponent(docId)}/reject`, {
						method: "PATCH",
						token: getToken(),
						headers: buildAdminHeaders({ stepUp: true }),
						body: { reason },
					});
					setRejectionModalOpen(false);
					setRejectionItem(null);
					setModerationPending((prev) => prev.filter((d) => d.id !== docId));
				}}
				itemTitle={rejectionItem?.title || "media"}
			/>

			{aiModalDoc && (
				<div class="fixed inset-0 z-50 flex items-center justify-center">
					<button onClick={() => setAiModalDoc(null)} class="absolute inset-0 bg-black/50" />
					<div
						data-lenis-prevent={true}
						class="relative w-[92vw] max-w-2xl max-h-[85vh] overflow-auto rounded-2xl bg-white dark:bg-slate-900 shadow-2xl"
					>
						<div class="sticky top-0 bg-white dark:bg-slate-900 px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
							<div>
								<p class="font-semibold text-slate-900 dark:text-white">AI Analysis Details</p>
								<p class="text-xs text-slate-500">{aiModalDoc.file_path || aiModalDoc.entity_id}</p>
							</div>
							<button
								onClick={() => setAiModalDoc(null)}
								class="rounded-full p-2 hover:bg-slate-100 dark:hover:bg-slate-800"
							>
								<X class="h-5 w-5" />
							</button>
						</div>
						<div class="p-6 space-y-5">
							{aiModalDoc.public_url && (
								<div class="rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800">
									{aiModalDoc.type === "video" ? (
										<video src={aiModalDoc.public_url} controls={true} class="w-full max-h-64" />
									) : (
										<LazyImage
											src={aiModalDoc.public_url}
											alt="Preview"
											width={600}
											height={400}
											class="w-full max-h-64 object-contain"
										/>
									)}
								</div>
							)}
							<div class="grid grid-cols-5 gap-3">
								<div class="rounded-xl bg-slate-50 dark:bg-slate-800 p-4 text-center">
									<p class="text-xs text-slate-500 mb-1">Label</p>
									<p
										class={`text-lg font-bold ${
											aiModalDoc.ai_label === "HIGH RISK"
												? "text-red-600"
												: aiModalDoc.ai_label === "HARAM"
													? "text-orange-500"
													: aiModalDoc.ai_label === "QUESTIONABLE"
														? "text-yellow-500"
														: "text-emerald-600"
										}`}
									>
										{aiModalDoc.ai_label || "PENDING"}
									</p>
								</div>
								<div class="rounded-xl bg-slate-50 dark:bg-slate-800 p-4 text-center">
									<p class="text-xs text-slate-500 mb-1">Score</p>
									<p class="text-lg font-bold text-slate-900 dark:text-white">
										{aiModalDoc.ai_score ?? "—"}
									</p>
								</div>
								<div class="rounded-xl bg-slate-50 dark:bg-slate-800 p-4 text-center">
									<p class="text-xs text-slate-500 mb-1">Confidence</p>
									<p class="text-lg font-bold text-slate-900 dark:text-white">
										{aiModalDoc.ai_confidence || "—"}
									</p>
								</div>
								<div class="rounded-xl bg-slate-50 dark:bg-slate-800 p-4 text-center">
									<p class="text-xs text-slate-500 mb-1">Severity</p>
									<p
										class={`text-lg font-bold ${
											aiModalDoc.ai_severity === "high"
												? "text-red-600"
												: aiModalDoc.ai_severity === "medium"
													? "text-amber-500"
													: aiModalDoc.ai_severity === "low"
														? "text-emerald-600"
														: "text-slate-400"
										}`}
									>
										{aiModalDoc.ai_severity || "—"}
									</p>
								</div>
								<div class="rounded-xl bg-slate-50 dark:bg-slate-800 p-4 text-center">
									<p class="text-xs text-slate-500 mb-1">Early Exit</p>
									<p
										class={`text-lg font-bold ${aiModalDoc.ai_early_exit ? "text-cyan-500" : "text-slate-400"}`}
									>
										{aiModalDoc.ai_early_exit ? "Yes" : "No"}
									</p>
								</div>
							</div>
							{aiModalDoc.ai_signals && aiModalDoc.ai_signals.length > 0 && (
								<div>
									<p class="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2 uppercase">
										Signals
									</p>
									<div class="space-y-1.5">
										{aiModalDoc.ai_signals.slice(0, 15).map((sig, i) => (
											<div
												key={i}
												class={`rounded-lg px-3 py-2 text-sm ${
													sig.risk === "high"
														? "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300"
														: sig.risk === "medium"
															? "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300"
															: "bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
												}`}
											>
												<span class="font-medium capitalize">[{sig.risk}]</span> {sig.message}
											</div>
										))}
									</div>
								</div>
							)}
							{aiModalDoc.ai_details && (
								<div>
									<p class="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2 uppercase">
										Score Breakdown
									</p>
									<div class="grid grid-cols-4 gap-2">
										{[
											{ key: "ocr_score", label: "OCR" },
											{ key: "detection_score", label: "YOLO" },
											{ key: "nsfw_score", label: "NSFW" },
											{ key: "vision_score", label: "Vision" },
										].map(
											({ key, label }) =>
												aiModalDoc.ai_details[key] !== null && (
													<div
														key={key}
														class="rounded-lg bg-slate-50 dark:bg-slate-800 p-2 text-center"
													>
														<p class="text-[10px] text-slate-500 mb-0.5">{label}</p>
														<p class="text-sm font-bold text-slate-900 dark:text-white">
															{aiModalDoc.ai_details[key]}
														</p>
													</div>
												),
										)}
									</div>
									{aiModalDoc.ai_details.weights && (
										<div class="mt-2 text-xs text-slate-400">
											Weights: OCR {((aiModalDoc.ai_details.weights.ocr || 0) * 100).toFixed(0)}% |
											YOLO {((aiModalDoc.ai_details.weights.yolo || 0) * 100).toFixed(0)}% | NSFW{" "}
											{((aiModalDoc.ai_details.weights.nsfw || 0) * 100).toFixed(0)}% | Vision{" "}
											{((aiModalDoc.ai_details.weights.moondream || 0) * 100).toFixed(0)}%
										</div>
									)}
								</div>
							)}
							{aiModalDoc.ai_timing && (
								<div class="text-xs text-slate-400 text-center">
									Timing:{" "}
									{Object.entries(aiModalDoc.ai_timing)
										.map(([k, v]) => `${k}: ${typeof v === "number" ? `${v.toFixed(2)}s` : v}`)
										.join(" | ")}
								</div>
							)}
							{aiModalDoc.ai_analyzed_at && (
								<p class="text-xs text-slate-400 text-center">
									Analyzed: {new Date(aiModalDoc.ai_analyzed_at).toLocaleString()}
								</p>
							)}
							<div class="flex gap-3 pt-2">
								<button
									onClick={async () => {
										await apiRequest(`/admin/media/${aiModalDoc.id}/approve`, {
											method: "PATCH",
											token: getToken(),
										});
										setAiModalDoc(null);
										setModerationPending((prev) => prev.filter((d) => d.id !== aiModalDoc.id));
									}}
									class="flex-1 bg-emerald-500 text-white py-2 rounded-xl font-medium hover:bg-emerald-600"
								>
									Approve
								</button>
								<button
									onClick={async () => {
										setReanalyzingId(aiModalDoc.id);
										try {
											const token = getToken();
											await apiRequest(`/admin/media/${aiModalDoc.id}/reanalyze`, {
												method: "POST",
												token,
											});
											for (let i = 0; i < 30; i++) {
												await new Promise((r) => setTimeout(r, 2000));
												const updated = await apiRequest("/admin/media/pending", { token });
												const found = (updated.items || []).find((d) => d.id === aiModalDoc.id);
												if (found && found.ai_label !== "PENDING") {
													setAiModalDoc(found);
													setModerationPending(updated.items || []);
													break;
												}
											}
										} catch (err) {
											toast.error(`Reanalysis failed: ${err.message || "Unknown error"}`);
										} finally {
											setReanalyzingId(null);
										}
									}}
									disabled={reanalyzingId === aiModalDoc.id}
									class="flex-1 bg-sky-500 text-white py-2 rounded-xl font-medium hover:bg-sky-600 disabled:opacity-50 flex items-center justify-center gap-2"
								>
									{reanalyzingId === aiModalDoc.id ? (
										<ThreeDot variant="bounce" color="#337ab0" size="small" text="" textColor="" />
									) : (
										<>
											<RefreshCw class="h-4 w-4" />
											Reanalyze
										</>
									)}
								</button>
								<button
									onClick={() => {
										setAiModalDoc(null);
										setRejectionModalOpen(true);
										setRejectionItem(aiModalDoc);
									}}
									class="flex-1 bg-red-500 text-white py-2 rounded-xl font-medium hover:bg-red-600"
								>
									Reject
								</button>
							</div>
						</div>
					</div>
				</div>
			)}

			<ConfirmDialog
				open={Boolean(forceLogoutTarget)}
				onClose={() => setForceLogoutTarget(null)}
				onConfirm={() => forceLogout(forceLogoutTarget)}
				title="Force logout"
				message="Force logout this user? They will be signed out immediately."
				confirmLabel="Force logout"
				destructive={true}
			/>

			{passwordResetTarget && (
				<div class="fixed inset-0 z-50 flex items-center justify-center">
					<button
						onClick={() => setPasswordResetTarget(null)}
						class="absolute inset-0 bg-black/50"
					/>
					<div class="relative w-[92vw] max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900">
						<h3 class="mb-4 text-lg font-semibold text-slate-900 dark:text-white">
							Reset Password
						</h3>
						<input
							type="password"
							value={passwordResetValue}
							onChange={(e) => setPasswordResetValue(e.target.value)}
							placeholder="Enter new password (min 8 characters)"
							class="mb-4 w-full rounded-xl border border-slate-200 px-4 py-2 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
						/>
						<div class="flex gap-3">
							<button
								onClick={() => setPasswordResetTarget(null)}
								class="flex-1 rounded-xl bg-slate-100 py-2 font-medium text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
							>
								Cancel
							</button>
							<button
								onClick={confirmResetPassword}
								class="flex-1 rounded-xl bg-sky-500 py-2 font-medium text-white hover:bg-sky-600"
							>
								Confirm
							</button>
						</div>
					</div>
				</div>
			)}

			{resolutionReportTarget && (
				<div class="fixed inset-0 z-50 flex items-center justify-center">
					<button
						onClick={() => setResolutionReportTarget(null)}
						class="absolute inset-0 bg-black/50"
					/>
					<div class="relative w-[92vw] max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900">
						<h3 class="mb-4 text-lg font-semibold text-slate-900 dark:text-white">
							Resolution Note
						</h3>
						<input
							type="text"
							value={resolutionNote}
							onChange={(e) => setResolutionNote(e.target.value)}
							placeholder="Resolution note (optional)"
							class="mb-4 w-full rounded-xl border border-slate-200 px-4 py-2 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
						/>
						<div class="flex gap-3">
							<button
								onClick={() => setResolutionReportTarget(null)}
								class="flex-1 rounded-xl bg-slate-100 py-2 font-medium text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
							>
								Cancel
							</button>
							<button
								onClick={confirmResolveReport}
								class="flex-1 rounded-xl bg-sky-500 py-2 font-medium text-white hover:bg-sky-600"
							>
								Confirm
							</button>
						</div>
					</div>
				</div>
			)}

			{assignTicketTarget && (
				<div class="fixed inset-0 z-50 flex items-center justify-center">
					<button
						onClick={() => setAssignTicketTarget(null)}
						class="absolute inset-0 bg-black/50"
					/>
					<div class="relative w-[92vw] max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900">
						<h3 class="mb-4 text-lg font-semibold text-slate-900 dark:text-white">
							Assign Support Ticket
						</h3>
						<input
							type="text"
							value={assigneeIdValue}
							onChange={(e) => setAssigneeIdValue(e.target.value)}
							placeholder="User ID (leave blank to clear)"
							class="mb-4 w-full rounded-xl border border-slate-200 px-4 py-2 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
						/>
						<div class="flex gap-3">
							<button
								onClick={() => setAssignTicketTarget(null)}
								class="flex-1 rounded-xl bg-slate-100 py-2 font-medium text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
							>
								Cancel
							</button>
							<button
								onClick={confirmAssignTicket}
								class="flex-1 rounded-xl bg-sky-500 py-2 font-medium text-white hover:bg-sky-600"
							>
								Confirm
							</button>
						</div>
					</div>
				</div>
			)}
		</>
	);
}
