/*
  Route: /pricing
  Access: Public

  Public Pages:
    /, /pricing, /about, /terms, /privacy, /help, /login, /signup, /access-denied
  Protected Pages (login required):
    /feed, /search, /buyer/:id, /factory/:id, /buying-house/:id, /contracts,
    /notifications, /chat, /call, /verification, /verification-center

  Primary responsibilities:
    - Present pricing tiers for Buyer, Factory, Buying House (Free vs Premium).
    - Present enterprise-style analytics preview tiles (dynamic, public).
    - Feature comparison table (icons, row hover, no vertical lines).
    - Theme: New sky-blue theme while preserving all functionality.

  Key API endpoints:
    - GET /api/system/pricing  (via `apiRequest('/system/pricing')`)
*/

import {
	motion,
	useMotionValue,
	useReducedMotion,
	useScroll,
	useSpring,
	useTransform,
} from "framer-motion";
import { Check, Tag, X } from "lucide-react";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Atom, Mosaic } from "react-loading-indicators";
import { Link, useLocation } from "react-router-dom";
import FlipCard from "../components/FlipCard.jsx";
import HoverCard from "../components/HoverCard.jsx";
import ScrollReveal from "../components/ScrollReveal.jsx";
import StickySection from "../components/StickySection.jsx";
import TextColorReveal from "../components/TextColorReveal.jsx";
import NeonAtom from "../components/ui/NeonAtom.jsx";
import StructuredData from "../components/ui/StructuredData.jsx";
import { useSecureUser } from "../hooks/useSecureUser.js";
import { apiRequest, getCurrentUser, getToken } from "../lib/auth.js";
import usePageMeta from "../lib/usePageMeta.js";

function planKeyForUserRole(role) {
	const normalized = String(role || "").toLowerCase();
	if (normalized === "buyer") {
		return "buyer";
	}
	if (normalized === "factory") {
		return "factory";
	}
	if (normalized === "buying_house") {
		return "buying_house";
	}
	return "buying_house";
}

const defaultPricing = {
	ok: true,
	analytics: {
		tiles: [
			{
				label: "Order completion",
				value: "72%",
				sublabel: "last 30 days",
				accent: "teal",
			},
			{
				label: "Avg. cycle",
				value: "18d",
				sublabel: "request → contract",
				accent: "blue",
			},
			{
				label: "Active orgs",
				value: "24",
				sublabel: "buyers + factories",
				accent: "gold",
			},
			{
				label: "Response SLA",
				value: "1h 10m",
				sublabel: "median",
				accent: "blue",
			},
		],
	},
	comparisonRows: [
		["Buyer requests or product posts", "", ""],
		["Agent IDs / sub-accounts", "Up to 3", "Unlimited"],
		["Contract Vault storage", "Basic", "Extended"],
		["Exportable reports", "", ""],
		["AI auto-reply customization", "", ""],
		["Analytics page", "Basic", ""],
		["Search filtering priority", "Standard", "Advanced"],
		["Priority request placement", "", ""],
		["Support level", "Standard", "Dedicated"],
		["Buying pattern analysis", "", ""],
		["Order Completion Certification", "", ""],
		["Profile / product boost", "", ""],
	],
	buyerFree: [
		"Post structured buyer requests",
		"Search factories & suppliers (basic)",
		"Chat & call access",
		"Contract Vault (basic)",
		"Saved searches (limited)",
	],
	buyerPremium: [
		"Advanced Search Filters",
		"Priority Buyer Request Placement",
		"Dedicated Support",
		"Contract History & Audit Trail",
		"Early Access to New Verified Factories",
		"Buying Pattern Analysis",
		"Order Completion Certification",
		"AI Auto-reply Customization",
		"Smart Supplier Matching",
		"Request Performance Insights",
		"Profile & product boost with increased reach",
	],
	factoryFree: [
		"Product management",
		"Video gallery (approved media)",
		"Receive buyer requests",
		"Chat & call access",
		"Contract Vault (basic)",
		"Agent IDs / sub-accounts (limit 3)",
	],
	factoryPremium: [
		"Profile & product boost with increased reach",
		"Advanced analytics (who viewed, inquiry rate)",
		"Priority in search results and filter",
		"AI auto-reply customization",
		"Dedicated account manager",
		"Custom branding on profile",
		"Enterprise analytics dashboard",
		"Unlimited agent/sub-ID creation",
		"Buying Pattern Analysis",
		"Order Completion Certification",
		"Dedicated Support",
		"Contract history & audit trail",
		"Multi-agent management",
		"Multiple team/agent access management",
		"Request factory Performance Insights",
		"Buyer interest analytics",
		"Agent performance analytics and reporting",
		"More product/video posting capacity",
		"Lead distribution across agents",
		"Buyer communication insights",
		"Buyer Request Priority Access",
		"Buyer Conversion Insights",
		"Unlimited Partner Network request accept",
	],
	houseFree: [
		"Lead workflow basics",
		"Buyer request queue access",
		"Partner Network (Buying House only)",
		"Chat & call access",
		"Contract Vault (basic)",
		"Agent IDs / sub-accounts (limit 3)",
	],
	housePremium: [
		"Profile & product boost with increased reach",
		"Advanced analytics (who viewed, inquiry rate)",
		"Priority in search results and filter",
		"AI auto-reply customization",
		"Dedicated account manager",
		"Custom branding on profile",
		"Enterprise analytics dashboard",
		"Unlimited agent/sub-ID creation",
		"Buying Pattern Analysis",
		"Order Completion Certification",
		"Dedicated Support",
		"Contract history & audit trail",
		"Multi-agent management",
		"Multiple team/agent access management",
		"Request Buying House Performance Insights",
		"Buyer interest analytics",
		"Agent performance analytics and reporting",
		"More product/video posting capacity",
		"Lead distribution across agents",
		"Buyer communication insights",
		"Buyer Request Priority Access",
		"Buyer Conversion Insights",
		"Unlimited Partner Network Access",
	],
	faqs: [
		{ q: "Can I upgrade anytime?", a: "Yes — your data stays intact." },
		{ q: "Can I downgrade?", a: "Yes — plan limits apply immediately." },
		{
			q: "Does GarTexHub handle payments?",
			a: "Not yet. The platform focuses on workflow + coordination. Premium can be activated via promo coupon without a card when eligible.",
		},
		{ q: "Are calls recorded?", a: "Yes — for documentation and compliance." },
	],
	sectionTitles: {
		plans: {
			eyebrow: "Simple, transparent pricing",
			title: "Choose the surface you need today — upgrade when your team scales.",
			subtitle:
				"Role-specific plans keep workflows clean for buyers, factories, and buying houses. Start free, then move into premium when you need analytics, priority placement, export-ready reporting, and secure contract history.",
		},
		enterprise: {
			eyebrow: "Why enterprise matters",
			title: "When your team scales, structure beats noise.",
			subtitle: "Premium keeps workflows conflict-free and audit-ready.",
			items: [
				"Team scale without limits",
				"Decision-ready visibility",
				"Secure contract trail",
				"Verified trust signals",
			],
		},
		premiumFeatures: {
			eyebrow: "Premium feature deep dive",
			title: "A role-specific roundup of what the Premium plan unlocks.",
			subtitle:
				"Buyer, Factory, and Buying House teams all get the right controls, analytics, and trust signals — without bloated UI or confusing add-ons.",
		},
		analytics: {
			eyebrow: "Analytics snapshot",
			title: "Decision-ready metrics without spreadsheet UI.",
			subtitle:
				"Auto-sorted, calm, and clean — the data feels like part of the product instead of a separate dashboard.",
		},
		comparison: {
			eyebrow: "Comparison",
			title: "Feature comparison",
			subtitle: "A clear line-by-line look at the Free and Premium surfaces.",
		},
		faq: {
			eyebrow: "FAQ",
			title: "Short answers, no sales noise.",
			subtitle: "Everything important, kept simple.",
		},
		cta: {
			eyebrow: "Ready for serious sourcing",
			title: "Build a structured textile network today",
			subtitle:
				"Start free, upgrade when your org needs analytics, export, and secure contract management.",
		},
	},
};

function SectionTitle({ eyebrow, title, subtitle }) {
	const reduceMotion = useReducedMotion();
	const words = String(title || "").split(" ");
	return (
		<div class="mx-auto max-w-3xl text-center">
			<div class="mb-3 inline-flex items-center gap-2 rounded-full border border-sky-500/20 bg-sky-500/10 px-4 py-2 text-sm font-medium text-sky-700 shadow-sm backdrop-blur dark:text-sky-200">
				<span>✨</span>
				<TextColorReveal>{eyebrow}</TextColorReveal>
			</div>
			<h2 class="text-3xl font-semibold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
				{reduceMotion ? (
					<TextColorReveal as="span">{title}</TextColorReveal>
				) : (
					<TextColorReveal as="span" class="inline-flex flex-wrap justify-center gap-x-[0.25em]">
						{words.map((word, i) => (
							<motion.span
								key={i}
								class="inline-block"
								initial={{ opacity: 0, y: 12 }}
								whileInView={{ opacity: 1, y: 0 }}
								viewport={{ once: true, margin: "-60px" }}
								transition={{
									duration: 0.4,
									delay: i * 0.06,
									ease: [0.16, 1, 0.3, 1],
								}}
							>
								{word}
							</motion.span>
						))}
					</TextColorReveal>
				)}
			</h2>
			<p class="mt-4 text-base leading-7 text-slate-600 dark:text-slate-300 sm:text-lg">
				{subtitle}
			</p>
		</div>
	);
}

function FeatureList({ items, accent = false }) {
	return (
		<ul class="space-y-3">
			{items.map((item) => (
				<li key={item} class="flex items-start gap-3 text-sm text-slate-700 dark:text-slate-200">
					<span
						class={
							accent
								? "mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sky-500/15 text-sky-700 ring-1 ring-sky-500/20 dark:text-sky-200"
								: "mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 ring-1 ring-slate-200 dark:bg-white/10 dark:text-slate-200 dark:ring-white/10"
						}
					>
						<Check class="h-3.5 w-3.5" />
					</span>
					<span class="leading-6">{item}</span>
				</li>
			))}
		</ul>
	);
}

function CouponInput() {
	const [code, setCode] = useState("");
	const [status, setStatus] = useState(null);
	const [loading, setLoading] = useState(false);

	const validate = useCallback(async () => {
		const trimmed = code.trim().toUpperCase();
		if (!trimmed) {
			return;
		}
		setLoading(true);
		setStatus(null);
		try {
			const token = getToken();
			const res = await apiRequest("/wallet/validate-coupon", {
				method: "POST",
				token,
				body: { code: trimmed },
			});
			if (res?.valid) {
				setStatus({
					ok: true,
					msg: `Code "${res.code}" is valid — $${Number(res.amount_usd || 0).toFixed(2)} credit${res.verification_free_months ? ` + ${res.verification_free_months} free months` : ""}.`,
				});
			} else {
				setStatus({ ok: false, msg: res?.error || "Invalid coupon code" });
			}
		} catch (err) {
			setStatus({ ok: false, msg: err.message || "Failed to validate coupon" });
		} finally {
			setLoading(false);
		}
	}, [code]);

	const apply = useCallback(async () => {
		const trimmed = code.trim().toUpperCase();
		if (!trimmed) {
			return;
		}
		setLoading(true);
		setStatus(null);
		try {
			const token = getToken();
			const res = await apiRequest("/wallet/redeem", {
				method: "POST",
				token,
				body: { code: trimmed },
			});
			setStatus({
				ok: true,
				msg: `Coupon applied! $${Number(res?.wallet?.restricted_balance_usd || 0).toFixed(2)} credit added to your account.`,
			});
			setCode("");
		} catch (err) {
			setStatus({ ok: false, msg: err.message || "Failed to apply coupon" });
		} finally {
			setLoading(false);
		}
	}, [code]);

	return (
		<ScrollReveal as="section" class="mt-20">
			<div class="mx-auto max-w-lg rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/5">
				<div class="flex items-center gap-3 mb-4">
					<div class="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-2">
						<Tag class="h-5 w-5 text-emerald-600 dark:text-emerald-300" />
					</div>
					<div>
						<h3 class="text-sm font-semibold text-slate-900 dark:text-white">Have a promo code?</h3>
						<p class="text-xs text-slate-500 dark:text-slate-400">
							Enter an early adopter or campaign coupon.
						</p>
					</div>
				</div>
				<div class="flex gap-2">
					<input
						type="text"
						value={code}
						onChange={(e) => {
							setCode(e.target.value);
							setStatus(null);
						}}
						onKeyDown={(e) => {
							if (e.key === "Enter") validate();
						}}
						placeholder="Enter coupon code"
						class="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-slate-500"
					/>
					<button
						onClick={validate}
						disabled={!code.trim() || loading}
						class="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-sky-400 hover:text-sky-700 disabled:opacity-40 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:border-sky-400"
					>
						{loading ? "Checking..." : "Validate"}
					</button>
					{status?.ok && (
						<button
							onClick={apply}
							disabled={loading}
							class="rounded-xl bg-sky-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-400 disabled:opacity-40"
						>
							Apply
						</button>
					)}
				</div>
				{status && (
					<div
						class={`mt-3 flex items-center gap-2 text-xs ${status.ok ? "text-emerald-600 dark:text-emerald-300" : "text-red-500 dark:text-red-400"}`}
					>
						{status.ok ? <Check class="h-3.5 w-3.5" /> : <X class="h-3.5 w-3.5" />}
						{status.msg}
					</div>
				)}
			</div>
		</ScrollReveal>
	);
}

function PlanCard({
	title,
	role,
	price,
	description,
	features,
	buttonLabel,
	highlighted,
	icon,
	isLoggedIn,
	userRole,
	flip = false,
}) {
	const IconComponent = icon;
	const reduceMotion = useReducedMotion();
	const shouldFlip = flip && !reduceMotion;

	const baseCardClasses =
		"relative overflow-hidden rounded-3xl border shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:shadow-[0_20px_60px_rgba(2,8,23,0.4)] " +
		(highlighted
			? "border-sky-500/30 bg-gradient-to-b from-sky-50 via-white to-white dark:from-sky-950/60 dark:via-slate-950 dark:to-slate-950"
			: "border-slate-200/80 bg-white/85 dark:border-white/10 dark:bg-white/5");

	const cardClasses = shouldFlip ? `${baseCardClasses}` : `${baseCardClasses} p-6`;

	const headerSection = (
		<>
			<div class="flex items-start justify-between gap-4">
				<div>
					<div class="inline-flex items-center gap-2 rounded-full border border-sky-500/20 bg-sky-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-sky-700 dark:text-sky-200">
						{role}
					</div>
					<h3 class="mt-4 text-2xl font-semibold text-slate-900 dark:text-white">{title}</h3>
					<p class="mt-2 max-w-md text-sm leading-6 text-slate-600 dark:text-slate-300">
						{description}
					</p>
				</div>
				<div class="rounded-2xl border border-sky-500/10 bg-sky-500/10 p-3 text-sky-700 dark:text-sky-200">
					<span class="text-2xl">{IconComponent}</span>
				</div>
			</div>
			<div class="mt-6 flex items-end gap-2">
				<div class="text-5xl font-semibold tracking-tight text-slate-900 dark:text-white">
					{price}
				</div>
				<div class="pb-2 text-sm text-slate-500 dark:text-slate-400">per month</div>
			</div>
			{price !== "$0" && (
				<div class="mt-1 text-sm text-slate-500 dark:text-slate-400">or $300/year (save 14%)</div>
			)}
		</>
	);

	const featuresSection = (
		<div class="rounded-2xl border border-slate-200/80 bg-white/80 p-4 dark:border-white/10 dark:bg-white/5">
			<FeatureList items={features} accent={highlighted} />
		</div>
	);

	const buttonSection = (
		<Link
			to={isLoggedIn ? "/feed" : "/signup"}
			class={
				"group inline-flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold transition-all duration-300 " +
				(highlighted
					? "bg-slate-900 text-white shadow-lg shadow-slate-950/15 hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100"
					: "border border-slate-200 bg-white text-slate-900 shadow-sm hover:border-sky-400 hover:text-sky-700 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:border-sky-400 dark:hover:text-sky-200")
			}
		>
			{isLoggedIn ? "Go to Dashboard" : buttonLabel}
			<span class="h-4 w-4 transition-transform group-hover:translate-x-0.5">→</span>
		</Link>
	);

	return (
		<HoverCard class={cardClasses}>
			{highlighted && (
				<div class="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-sky-400/20 blur-3xl" />
			)}
			{shouldFlip ? (
				<div class="grid h-full" style={{ gridTemplateColumns: "1fr", gridTemplateRows: "1fr" }}>
					<div class="invisible grid" style={{ gridArea: "1 / 1" }}>
						<div class="flex flex-col p-6" style={{ gridArea: "1 / 1" }}>
							{headerSection}
						</div>
						<div class="flex flex-col justify-between p-6" style={{ gridArea: "1 / 1" }}>
							{featuresSection}
							<div class="mt-6">{buttonSection}</div>
						</div>
					</div>
					<div style={{ gridArea: "1 / 1" }}>
						<FlipCard
							class="h-full"
							front={<div class="flex h-full flex-col p-6">{headerSection}</div>}
							back={
								<div class="flex h-full flex-col justify-between p-6">
									{featuresSection}
									<div class="mt-6">{buttonSection}</div>
								</div>
							}
							flipOn="hover"
						/>
					</div>
				</div>
			) : (
				<div class="relative z-10 flex h-full flex-col p-0">
					{headerSection}
					<div class="mt-6">{featuresSection}</div>
					<div class="mt-6">{buttonSection}</div>
				</div>
			)}
		</HoverCard>
	);
}

function AnalyticsCard({ tiles = [], loading = false, loadError = "" }) {
	const metrics = useMemo(
		() => [
			{ label: "Order completion", value: "72%" },
			{ label: "Avg. cycle", value: "18d" },
			{ label: "Active orgs", value: "24" },
			{ label: "Response SLA", value: "1h 10m" },
		],
		[],
	);

	const displayMetrics = tiles.length > 0 ? tiles : metrics;

	return (
		<div class="relative overflow-hidden rounded-3xl border border-sky-500/15 bg-gradient-to-br from-sky-50 via-white to-cyan-50 p-6 shadow-[0_24px_80px_rgba(51,122,176,0.12)] dark:border-sky-400/20 dark:from-sky-950/60 dark:via-slate-950 dark:to-slate-900">
			<div class="absolute right-0 top-0 h-40 w-40 rounded-full bg-sky-400/20 blur-3xl" />
			<div class="relative z-10">
				<div class="mb-4 flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300">
					<div class="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_0_6px_rgba(34,197,94,0.12)]" />
					Live
				</div>

				<div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
					{loading ? (
						<div class="flex h-64 items-center justify-center">
							<Atom
								color="#337ab0"
								size="large"
								style={{ fontSize: "40px" }}
								text=""
								textColor=""
							/>
						</div>
					) : (
						displayMetrics.slice(0, 4).map((m) => (
							<div
								key={m.label}
								class="rounded-2xl border border-white/60 bg-white/80 p-4 backdrop-blur dark:border-white/10 dark:bg-white/5"
							>
								<div class="text-sm text-slate-500 dark:text-slate-400">{m.label}</div>
								<div class="mt-2 text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">
									{m.value}
								</div>
							</div>
						))
					)}
				</div>
				{loadError && (
					<div class="flex h-64 items-center justify-center">
						<Mosaic
							color="#337ab0"
							size="large"
							style={{ fontSize: "40px" }}
							text=""
							textColor=""
						/>
					</div>
				)}
			</div>
		</div>
	);
}

function ComparisonTable({ comparisonRows = [] }) {
	return (
		<div class="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-white/5 dark:shadow-[0_20px_60px_rgba(2,8,23,0.4)]">
			<div class="border-b border-slate-200/80 px-6 py-4 dark:border-white/10">
				<h3 class="text-xl font-semibold text-slate-900 dark:text-white">
					<TextColorReveal>Feature comparison</TextColorReveal>
				</h3>
				<p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
					Horizontal lines only. Clear, audit-ready differences.
				</p>
			</div>
			<div class="overflow-x-auto">
				<table class="min-w-full text-left text-sm">
					<StickySection
						as="thead"
						top={100}
						parallaxSpeed={16}
						class="bg-slate-50/80 text-slate-600 dark:bg-white/5 dark:text-slate-300"
					>
						<tr>
							<th class="px-6 py-4 font-medium">Feature</th>
							<th class="px-6 py-4 font-medium">Free</th>
							<th class="px-6 py-4 font-medium">Premium</th>
						</tr>
					</StickySection>
					<tbody class="divide-y divide-slate-200/80 dark:divide-white/10">
						{comparisonRows.map(([feature, free, premium]) => (
							<motion.tr
								key={feature}
								layout={true}
								class="text-slate-700 dark:text-slate-200"
								transition={{ type: "spring", stiffness: 200, damping: 25 }}
							>
								<td class="px-6 py-4 font-medium text-slate-900 dark:text-white">{feature}</td>
								<td class="px-6 py-4">
									{free || (
										<span
											class="inline-flex h-2.5 w-2.5 rounded-full bg-sky-500/80"
											aria-label="Included"
										/>
									)}
								</td>
								<td class="px-6 py-4">
									{premium || (
										<span
											class="inline-flex h-2.5 w-2.5 rounded-full bg-sky-500/80"
											aria-label="Included"
										/>
									)}
								</td>
							</motion.tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}

function FAQItem({ q, a }) {
	const [open, setOpen] = useState(false);
	return (
		<button
			onClick={() => setOpen(!open)}
			class="w-full rounded-2xl border border-slate-200/80 bg-white p-5 text-left shadow-sm transition hover:border-sky-400/40 hover:shadow-md dark:border-white/10 dark:bg-white/5"
		>
			<div class="flex items-center justify-between gap-4">
				<span class="text-base font-semibold text-slate-900 dark:text-white">{q}</span>
				<span
					class={
						"h-5 w-5 shrink-0 text-slate-500 transition-transform dark:text-slate-300 " +
						(open ? "rotate-180" : "")
					}
				>
					⌄
				</span>
			</div>
			{open && <p class="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{a}</p>}
		</button>
	);
}

export default function PricingPage() {
	usePageMeta({
		title: "Garment Sourcing Plans & Pricing for Buyers, Factories & Buying Houses — GarTexHub",
		type: "website",
		description:
			"Compare GarTexHub sourcing plans and pricing for buyers, factories and buying houses — free and premium tiers.",
		canonical: "https://gartexhub.onrender.com/pricing",
		siteName: "GarTexHub",
		locale: "en_US",
	});
	const location = useLocation();
	const [pricing, setPricing] = useState(null);
	const [pricingLoading, setPricingLoading] = useState(true);
	const [pricingError, setPricingError] = useState(null);

	const sessionUser = getCurrentUser();
	const { user: secureUser } = useSecureUser();
	const token = getToken();
	const isLoggedIn = Boolean(token && sessionUser);
	const userRole = secureUser?.role || sessionUser?.role;
	const activePlanKey = isLoggedIn ? planKeyForUserRole(userRole) : "neutral";

	useEffect(() => {
		if (typeof window !== "undefined" && location?.hash) {
			const id = String(location.hash || "").replace(/^#/, "");
			if (id) {
				const timer = setTimeout(() => {
					const el = document.getElementById(id);
					if (el) {
						el.scrollIntoView({ behavior: "smooth", block: "start" });
					}
				}, 80);
				return () => clearTimeout(timer);
			}
		}
	}, [location.hash]);

	useEffect(() => {
		let alive = true;
		const controller = new AbortController();

		apiRequest("/system/pricing", { signal: controller.signal })
			.then((data) => {
				if (!alive) {
					return;
				}
				if (data?.ok && data?.analytics?.tiles) {
					setPricing(data);
				}
			})
			.catch((err) => {
				if (!alive) {
					return;
				}
				if (err?.name === "AbortError") {
					return;
				}
				setPricingError(String(err?.message || "Failed to load pricing data"));
			})
			.finally(() => {
				if (!alive) {
					return;
				}
				setPricingLoading(false);
			});

		return () => {
			alive = false;
			controller.abort();
		};
	}, []);

	const plansByRole = useMemo(
		() => ({
			buyer: {
				Free: pricing?.buyerFree || defaultPricing.buyerFree,
				Premium: pricing?.buyerPremium || defaultPricing.buyerPremium,
			},
			factory: {
				Free: pricing?.factoryFree || defaultPricing.factoryFree,
				Premium: pricing?.factoryPremium || defaultPricing.factoryPremium,
			},
			buying_house: {
				Free: pricing?.houseFree || defaultPricing.houseFree,
				Premium: pricing?.housePremium || defaultPricing.housePremium,
			},
			neutral: {
				Free: [
					"Structured buyer requests or product posts",
					"Basic search and messaging access",
					"Contract Vault (basic)",
					"Saved searches (limited)",
				],
				Premium: pricing?.buyerPremium || defaultPricing.buyerPremium,
			},
		}),
		[pricing],
	);

	const comparisonRows = pricing?.comparisonRows || defaultPricing.comparisonRows;
	const faqs = pricing?.faqs || defaultPricing.faqs;
	const _sectionTitles = pricing?.sectionTitles || defaultPricing.sectionTitles;

	const premiumFeatures = [
		{
			title: "Buyer (Premium)",
			items: pricing?.buyerPremium || defaultPricing.buyerPremium,
		},
		{
			title: "Factory (Premium)",
			items: pricing?.factoryPremium || defaultPricing.factoryPremium,
		},
		{
			title: "Buying House (Premium)",
			items: pricing?.housePremium || defaultPricing.housePremium,
		},
	];

	const roleSections = [
		{
			key: "buyer",
			title: "Buyer",
			subtitle: "For direct buyers sourcing verified factories.",
		},
		{
			key: "factory",
			title: "Factory",
			subtitle: "For factories managing products and inbound buyer requests.",
		},
		{
			key: "buying_house",
			title: "Buying House",
			subtitle: "For buying houses coordinating teams and partners.",
		},
	];

	const visibleSections = isLoggedIn
		? roleSections.filter((section) => section.key === activePlanKey)
		: roleSections;

	const reduceMotion = useReducedMotion();
	const [isTouchDevice] = useState(
		() =>
			typeof window !== "undefined" && ("ontouchstart" in window || navigator.maxTouchPoints > 0),
	);
	const { scrollY } = useScroll();
	const bg1Y = useSpring(useTransform(scrollY, [0, 600], [0, -30]), {
		stiffness: 80,
		damping: 20,
		restDelta: 0.001,
	});
	const bg2Y = useSpring(useTransform(scrollY, [0, 600], [0, -50]), {
		stiffness: 80,
		damping: 20,
		restDelta: 0.001,
	});
	const bg3Y = useSpring(useTransform(scrollY, [0, 600], [0, -20]), {
		stiffness: 80,
		damping: 20,
		restDelta: 0.001,
	});
	const gradientAngle = useMotionValue(135);
	const gradientBg = useTransform(
		gradientAngle,
		(angle) =>
			`linear-gradient(${angle.toFixed(1)}deg, rgba(51,122,176,0.12), rgba(255,255,255,0.9), rgba(29,153,153,0.08))`,
	);
	useEffect(() => {
		if (reduceMotion || isTouchDevice) {
			return;
		}
		let running = true;
		const id = setInterval(() => {
			if (running) {
				gradientAngle.set((gradientAngle.get() + 0.4) % 360);
			}
		}, 300);
		return () => {
			running = false;
			clearInterval(id);
		};
	}, [reduceMotion, gradientAngle, isTouchDevice]);

	if (pricingLoading) {
		return (
			<div class="flex min-h-screen items-center justify-center bg-[var(--theme-custom-f5f9ff)] dark:bg-[var(--theme-custom-07111f)]">
				<NeonAtom />
			</div>
		);
	}

	if (pricingError) {
		return (
			<div class="flex min-h-screen flex-col items-center justify-center gap-6 bg-[var(--theme-custom-f5f9ff)] px-4 dark:bg-[var(--theme-custom-07111f)]">
				<div class="mx-auto max-w-md rounded-2xl border border-red-200/80 bg-red-50 p-8 text-center shadow-sm dark:border-red-800/40 dark:bg-red-950/30">
					<div class="mb-4 text-4xl" aria-hidden="true">
						⚠️
					</div>
					<h2 class="mb-2 text-xl font-semibold text-red-800 dark:text-red-200">
						Unable to load pricing
					</h2>
					<p class="mb-6 text-sm leading-relaxed text-red-600 dark:text-red-300">{pricingError}</p>
					<button
						onClick={() => window.location.reload()}
						class="inline-flex items-center gap-2 rounded-xl bg-red-800 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600"
					>
						Retry
					</button>
				</div>
			</div>
		);
	}

	return (
		<div
			class="min-h-screen bg-[var(--theme-custom-f5f9ff)] text-slate-900 dark:bg-[var(--theme-custom-07111f)] dark:text-white"
			data-lenis-prevent={true}
		>
			<StructuredData
				data={{
					"@context": "https://schema.org",
					"@type": "FAQPage",
					mainEntity: faqs.map((item) => ({
						"@type": "Question",
						name: item.q,
						acceptedAnswer: {
							"@type": "Answer",
							text: item.a,
						},
					})),
				}}
			/>
			<div class="fixed inset-0 -z-10 pointer-events-none overflow-hidden">
				<motion.div
					style={{ y: reduceMotion ? 0 : bg1Y }}
					class="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(109,171,223,0.18),transparent_34%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(109,171,223,0.14),transparent_34%)]"
				/>
				<motion.div
					style={{ y: reduceMotion ? 0 : bg2Y }}
					class="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(55,115,168,0.16),transparent_30%)] dark:bg-[radial-gradient(circle_at_top_right,rgba(55,115,168,0.12),transparent_30%)]"
				/>
				<motion.div
					style={{ y: reduceMotion ? 0 : bg3Y }}
					class="absolute inset-0 bg-[radial-gradient(circle_at_bottom,rgba(51,122,176,0.12),transparent_28%)] dark:bg-[radial-gradient(circle_at_bottom,rgba(51,122,176,0.1),transparent_28%)]"
				/>
			</div>

			<main class="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
				<ScrollReveal as="section" class="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
					<div>
						<div class="mb-5 inline-flex items-center gap-2 rounded-full border border-sky-500/20 bg-sky-500/10 px-4 py-2 text-sm font-medium text-sky-700 dark:text-sky-200">
							<span>✔</span>
							Pricing
						</div>
						<h1 class="max-w-4xl text-4xl font-semibold tracking-tight text-slate-900 dark:text-white sm:text-5xl lg:text-6xl">
							Clear plans for serious garment sourcing teams
						</h1>
						<p class="mt-6 max-w-3xl text-lg leading-8 text-slate-600 dark:text-slate-300">
							Borderless surfaces, verified signals, and export-ready reporting — built for buying
							houses and factories.
						</p>

						<div class="mt-8 flex flex-wrap gap-3">
							{isLoggedIn ? (
								<>
									<Link
										to="/feed"
										class="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-slate-950/15 transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100"
									>
										Go to Dashboard
										<span>→</span>
									</Link>
									<Link
										to="#plans"
										class="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-sky-400 hover:text-sky-700 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:border-sky-400 dark:hover:text-sky-200"
									>
										<span>🔍</span>
										View plans
									</Link>
								</>
							) : (
								<>
									<Link
										to="/signup"
										class="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-slate-950/15 transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100"
									>
										Create your organization
										<span>→</span>
									</Link>
									<Link
										to="#plans"
										class="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-sky-400 hover:text-sky-700 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:border-sky-400 dark:hover:text-sky-200"
									>
										<span>🔍</span>
										View plans
									</Link>
								</>
							)}
						</div>
					</div>

					<AnalyticsCard
						tiles={pricing?.analytics?.tiles || []}
						loading={pricingLoading}
						loadError={pricingError}
					/>
				</ScrollReveal>

				<ScrollReveal as="section" id="plans" class="mt-20 scroll-mt-24">
					<SectionTitle
						eyebrow="Simple, transparent pricing"
						title="Choose the surface you need today — upgrade when your team scales."
						subtitle="Role-specific plans keep workflows clean for buyers, factories, and buying houses. Start free, then move into premium when you need analytics, priority placement, export-ready reporting, and secure contract history."
					/>

					<div class="mt-10 grid gap-6 xl:grid-cols-3">
						{visibleSections.map((section) => {
							const rolePlan = plansByRole[section.key] || plansByRole.neutral;
							return (
								<React.Fragment key={section.key}>
									<PlanCard
										title={section.title}
										role={
											section.key === "buyer"
												? "For direct buyers sourcing verified factories"
												: section.key === "factory"
													? "For factories managing products and inbound buyer requests"
													: "For buying houses coordinating teams and partners"
										}
										price="$0"
										description="Start with essential workflow."
										features={rolePlan.Free}
										buttonLabel="Get started"
										icon={section.key === "buyer" ? "🏢" : section.key === "factory" ? "🏭" : "👥"}
										isLoggedIn={isLoggedIn}
										flip={!isTouchDevice}
									/>
									<PlanCard
										title={`${section.title} Premium`}
										price="$29"
										description="Built for buying houses & enterprise teams."
										features={rolePlan.Premium}
										buttonLabel="Choose premium"
										highlighted={true}
										icon="✨"
										isLoggedIn={isLoggedIn}
										flip={!isTouchDevice}
									/>
								</React.Fragment>
							);
						})}
					</div>
				</ScrollReveal>

				<ScrollReveal
					as="section"
					class="mt-20 grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-stretch"
				>
					<div class="rounded-3xl border border-slate-200/80 bg-white p-8 shadow-[0_20px_60px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-white/5 dark:shadow-[0_20px_60px_rgba(2,8,23,0.4)]">
						<h3 class="text-2xl font-semibold text-slate-900 dark:text-white">
							Why enterprise matters
						</h3>
						<p class="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">
							When your team scales, structure beats noise. Premium keeps workflows conflict-free
							and audit-ready.
						</p>
						<div class="mt-6 grid gap-3 sm:grid-cols-2">
							{[
								"Team scale without limits",
								"Decision-ready visibility",
								"Secure contract trail",
								"Verified trust signals",
							].map((item) => (
								<div
									key={item}
									class="rounded-2xl border border-slate-200/80 bg-slate-50 px-4 py-4 text-sm font-medium text-slate-800 dark:border-white/10 dark:bg-white/5 dark:text-white"
								>
									{item}
								</div>
							))}
						</div>
					</div>
					<AnalyticsCard
						tiles={pricing?.analytics?.tiles || []}
						loading={pricingLoading}
						loadError={pricingError}
					/>
				</ScrollReveal>

				<ScrollReveal as="section" class="mt-20">
					<SectionTitle
						eyebrow="Premium feature deep dive"
						title="A role-specific roundup of what the Premium plan unlocks."
						subtitle="Buyer, Factory, and Buying House teams all get the right controls, analytics, and trust signals — without bloated UI or confusing add-ons."
					/>
					<div class="mt-10 grid gap-6 lg:grid-cols-3">
						{premiumFeatures.map((bundle) => (
							<div
								key={bundle.title}
								class="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/5"
							>
								<div class="mb-4 text-xl font-semibold text-slate-900 dark:text-white">
									{bundle.title}
								</div>
								<FeatureList items={bundle.items} accent={true} />
							</div>
						))}
					</div>
				</ScrollReveal>

				<ScrollReveal as="section" class="mt-20">
					<SectionTitle
						eyebrow="Analytics snapshot"
						title="Decision-ready metrics without spreadsheet UI."
						subtitle="Auto-sorted, calm, and clean — the data feels like part of the product instead of a separate dashboard."
					/>
					<div class="mt-10">
						<AnalyticsCard
							tiles={pricing?.analytics?.tiles || []}
							loading={pricingLoading}
							loadError={pricingError}
						/>
					</div>
				</ScrollReveal>

				<ScrollReveal as="section" class="mt-20">
					<SectionTitle
						eyebrow="Comparison"
						title="Feature comparison"
						subtitle="A clear line-by-line look at the Free and Premium surfaces."
					/>
					<div class="mt-10">
						<ComparisonTable comparisonRows={comparisonRows} />
					</div>
				</ScrollReveal>

				<ScrollReveal as="section" class="mt-20">
					<SectionTitle
						eyebrow="FAQ"
						title="Short answers, no sales noise."
						subtitle="Everything important, kept simple."
					/>
					<div class="mt-10 grid gap-4 lg:grid-cols-2">
						{faqs.map((item) => (
							<FAQItem key={item.q} q={item.q} a={item.a} />
						))}
					</div>
				</ScrollReveal>

				{isLoggedIn ? <CouponInput /> : null}

				<ScrollReveal
					as="section"
					class="relative overflow-hidden mt-20 rounded-[2rem] border border-sky-500/15 bg-gradient-to-br from-sky-500/10 via-white to-cyan-500/10 p-8 shadow-[0_24px_80px_rgba(51,122,176,0.12)] dark:from-sky-500/10 dark:via-slate-950 dark:to-cyan-500/10"
				>
					<motion.div
						class="pointer-events-none absolute inset-0"
						style={{ background: reduceMotion ? undefined : gradientBg }}
					/>
					<div class="relative z-10 grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
						<div>
							<div class="inline-flex items-center gap-2 rounded-full border border-sky-500/20 bg-sky-500/10 px-4 py-2 text-sm font-medium text-sky-700 dark:text-sky-200">
								<span>🛡️</span>
								Ready for serious sourcing
							</div>
							<h3 class="mt-5 text-3xl font-semibold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
								Build a structured textile network today
							</h3>
							<p class="mt-4 max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-300">
								Start free, upgrade when your org needs analytics, export, and secure contract
								management.
							</p>
						</div>
						<div class="flex flex-col gap-3 sm:flex-row lg:justify-end">
							{isLoggedIn ? (
								<>
									<Link
										to="/feed"
										class="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-slate-950/15 transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100"
									>
										Go to Dashboard
										<span>→</span>
									</Link>
									<Link
										to="#plans"
										class="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-sky-400 hover:text-sky-700 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:border-sky-400 dark:hover:text-sky-200"
									>
										View plans
									</Link>
								</>
							) : (
								<>
									<Link
										to="/signup"
										class="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-slate-950/15 transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100"
									>
										Create your organization
										<span>→</span>
									</Link>
									<Link
										to="#plans"
										class="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-sky-400 hover:text-sky-700 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:border-sky-400 dark:hover:text-sky-200"
									>
										Choose premium
									</Link>
								</>
							)}
						</div>
					</div>
				</ScrollReveal>
			</main>
		</div>
	);
}
