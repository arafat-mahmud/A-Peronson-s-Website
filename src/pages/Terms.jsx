import {
	BadgeInfo,
	ChevronRight,
	CircleAlert,
	FileSignature,
	LockKeyhole,
	MessageSquareQuote,
	RadioTower,
	Scale,
	ShieldCheck,
	Sparkles,
	Star,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import usePageMeta from "../lib/usePageMeta.js";

const sections = [
	{
		id: "purpose",
		index: "01",
		icon: Scale,
		title: "Purpose of the Platform",
		bullets: [
			"To establish direct and professional connections between international buyers and Garments/Textile Factories",
			"To ensure business matching based on Buyer Request and Company Product",
			"To manage digital contracts, communication and verification processes in a controlled manner",
			"The platform will be operated as a controlled business environment.",
		],
	},
	{
		id: "account-policy",
		index: "02",
		icon: ShieldCheck,
		title: "Account Policy",
		bullets: [
			"It is mandatory to open an account only for legitimate business purposes.",
			"Accurate, true and up-to-date information must be provided.",
			"Providing incorrect, false or misleading information will result in administrative action.",
			"The owner will create and manage a certain number of IDs in the Buying House Enterprise account.",
			"Each user is responsible for the security of their login information.",
		],
	},
	{
		id: "conduct",
		index: "03",
		icon: CircleAlert,
		title: "User Conduct",
		bullets: [
			"Posting fake orders or misleading Buyer Requests",
			"Fraudulent or misleading communications",
			"Inducing unsafe transactions outside the platform",
			"Uploading copyright-infringing content",
			"Promoting illegal or prohibited products",
			"Posting obscene, immoral, or offensive content",
			"Uploading videos with excessive musical instruments",
			"Using copyrighted music",
			"All media content must be published in a professional and business-like manner.",
		],
		alert:
			"Sharing any external contact information (phone, email, WhatsApp, Telegram, Facebook, Instagram, or similar) is strictly forbidden on GarTexHub. Violations will result in account restrictions and may lead to permanent termination.",
	},
	{
		id: "communication",
		index: "04",
		icon: MessageSquareQuote,
		title: "Buyer Request and Communication Policy",
		bullets: [
			"Buyer Requests must be clear, specific, and business-like.",
			"Messages from verified users will be displayed on a priority basis.",
			"Other messages will be stored as requests and displayed in a controlled manner.",
			"Spam and irrelevant communications will be controlled.",
			"The platform will monitor and control communications.",
		],
	},
	{
		id: "contracts",
		index: "05",
		icon: FileSignature,
		title: "Digital Agreements and Signatures",
		bullets: [
			"Digital signatures executed on the platform will be considered legally binding.",
			"A PDF copy of each agreement will be provided to both parties.",
			"A copy will be stored in the company system as legal evidence if necessary.",
		],
		signatureMark: true,
	},
	{
		id: "calls",
		index: "06",
		icon: RadioTower,
		title: "Call and Chat Policy",
		bullets: [
			"Video and audio calls made through the platform will be recorded.",
			"All recordings will be stored only with the company.",
			"Recordings will not be provided directly to any party, except as required by law.",
			"Records will only be used for dispute resolution, security and legal purposes.",
		],
	},
	{
		id: "ratings",
		index: "07",
		icon: Star,
		title: "Ratings and Transparency",
		bullets: [
			"Ratings will be provided by the platform upon successful order completion.",
			"User performance and behavior will directly impact visibility.",
			"Providing artificial or manipulated ratings will result in administrative action.",
		],
	},
	{
		id: "subscription",
		index: "08",
		icon: Sparkles,
		title: "Subscription and Enterprise Benefits",
		bullets: [
			"Buying House and Enterprise accounts will have enhanced management benefits.",
			"Certain advanced features will be enabled through upgrades.",
			"Subscription policies will apply where applicable.",
		],
	},
	{
		id: "liability",
		index: "09",
		icon: LockKeyhole,
		title: "Liability",
		bullets: [
			"The platform provides connectivity between Buyers and Sellers.",
			"Strong and effective security measures have been implemented to prevent fraud.",
			"If the user violates policies, verification processes or security instructions and suffers losses, the user will bear the responsibility himself.",
		],
	},
	{
		id: "suspension",
		index: "10",
		icon: CircleAlert,
		title: "Account Suspension or Cancellation",
		bullets: [
			"Violation of terms.",
			"Fraudulent activity.",
			"Providing false information.",
			"Behavior that damages reputation.",
		],
		process: [
			"The user will be notified before closing the account.",
			"A warning will be given if necessary.",
			"In case of repeated or serious violations, the account will be permanently closed.",
		],
	},
	{
		id: "change-policy",
		index: "11",
		icon: BadgeInfo,
		title: "Change Policy",
		bullets: [
			"These Terms will be updated as needed.",
			"Users will be notified of any significant changes via notification.",
		],
	},
	{
		id: "consent",
		index: "12",
		icon: ShieldCheck,
		title: "Consent",
		bullets: [
			"By creating an account or using the Platform, you agree to be bound by all provisions of these Terms and Conditions.",
		],
	},
];

function SignatureMark() {
	return (
		<svg
			viewBox="0 0 420 180"
			class="absolute inset-0 h-full w-full opacity-20"
			aria-hidden="true"
			fill="none"
		>
			<path
				d="M18 116c28-34 44-54 62-58 16-4 28 2 39 16 10 14 14 31 26 39 16 10 31-2 47-21 20-24 36-55 63-55 21 0 34 15 41 37 7 21 5 50 18 55 14 5 27-15 41-43 13-27 24-48 45-48 17 0 29 11 39 24"
				class="stroke-sky-500"
				strokeWidth="6"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
			<path
				d="M41 139c37-7 58-19 83-39 18-15 40-38 62-39 18-1 27 10 34 27 7 16 9 35 25 40 18 6 37-11 56-33 16-18 31-36 51-39 18-3 29 4 43 19"
				class="stroke-cyan-300"
				strokeWidth="4"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
			<circle cx="362" cy="38" r="9" class="fill-sky-400" />
		</svg>
	);
}

function SectionCard({ section, index, visible }) {
	const Icon = section.icon;

	return (
		<article
			id={section.id}
			class={[
				"group relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white/85 p-6 shadow-[0_20px_80px_-40px_rgba(32,101,152,0.35)] backdrop-blur-xl transition-all duration-700 ease-out dark:border-slate-800/80 dark:bg-slate-950/70",
				visible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0",
			].join(" ")}
			style={{ transitionDelay: `${Math.min(index * 90, 720)}ms` }}
		>
			<div class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(109,171,223,0.14),transparent_42%),radial-gradient(circle_at_bottom_left,rgba(51,122,176,0.10),transparent_38%)]" />
			<div class="relative flex items-start gap-4">
				<div class="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-500 to-cyan-400 text-white shadow-lg shadow-sky-500/20 dark:border-sky-900/50">
					<Icon class="h-7 w-7" />
				</div>

				<div class="min-w-0 flex-1">
					<div class="mb-3 flex items-center gap-3">
						<span class="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold tracking-[0.18em] text-sky-700 dark:border-sky-900/60 dark:bg-sky-950/70 dark:text-sky-300">
							{section.index}
						</span>
						<span class="text-xs font-medium uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
							Legal Section
						</span>
					</div>

					<h2 class="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
						{section.title}
					</h2>

					<div class="mt-5 space-y-3 text-[15px] leading-7 text-slate-600 dark:text-slate-300">
						{section.bullets.map((bullet) => (
							<div
								key={bullet}
								class="flex gap-3 rounded-2xl border border-slate-200/70 bg-white/70 px-4 py-3 dark:border-slate-800/70 dark:bg-slate-900/50"
							>
								<ChevronRight class="mt-1 h-4 w-4 shrink-0 text-sky-500" />
								<p>{bullet}</p>
							</div>
						))}
					</div>

					{section.alert ? (
						<div class="mt-5 rounded-2xl border border-amber-300/70 bg-amber-50 px-4 py-4 text-[15px] leading-7 text-amber-950 shadow-sm dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-100">
							<strong class="block text-amber-900 dark:text-amber-200">
								Strict policy: No third-party contact sharing
							</strong>
							{section.alert}
						</div>
					) : null}

					{section.process ? (
						<div class="mt-5 rounded-2xl border border-sky-200 bg-sky-50/80 p-4 dark:border-sky-900/60 dark:bg-sky-950/20">
							<div class="mb-2 text-sm font-semibold uppercase tracking-[0.18em] text-sky-700 dark:text-sky-300">
								Process
							</div>
							<div class="space-y-2 text-[15px] leading-7 text-slate-700 dark:text-slate-200">
								{section.process.map((line) => (
									<div key={line} class="flex gap-3">
										<span class="mt-2 h-2 w-2 rounded-full bg-sky-500" />
										<p>{line}</p>
									</div>
								))}
							</div>
						</div>
					) : null}
				</div>
			</div>

			{section.signatureMark ? (
				<div class="relative mt-6 overflow-hidden rounded-3xl border border-sky-200/80 bg-gradient-to-br from-sky-50 via-cyan-50 to-white p-5 dark:border-sky-900/60 dark:from-sky-950/50 dark:via-cyan-950/30 dark:to-slate-950">
					<SignatureMark />
				</div>
			) : null}
		</article>
	);
}

export default function Terms() {
	usePageMeta({
		title: "Terms of Service — GarTexHub",
		description:
			"Review the terms and conditions governing the use of GarTexHub's textile and garment marketplace platform.",
		canonical: "https://gartexhub.onrender.com/terms",
		url: "/terms",
	});

	const [visible, setVisible] = useState(() => sections.map((_, i) => i < 2));
	const refs = useRef([]);

	const lastUpdated = useMemo(() => {
		const d = new Date();
		return d.toLocaleDateString("en-GB", {
			day: "numeric",
			month: "long",
			year: "numeric",
		});
	}, []);

	useEffect(() => {
		const observer = new IntersectionObserver(
			(entries) => {
				setVisible((prev) => {
					const next = [...prev];
					for (const entry of entries) {
						const index = refs.current.indexOf(entry.target);
						if (index !== -1 && entry.isIntersecting) {
							next[index] = true;
						}
					}
					return next;
				});
			},
			{
				root: null,
				threshold: 0.08,
				rootMargin: "-80px 0px -10% 0px",
			},
		);

		refs.current.forEach((node) => node && observer.observe(node));
		return () => observer.disconnect();
	}, []);

	return (
		<main class="min-h-screen bg-[var(--theme-custom-f3f9ff)] text-slate-900 dark:bg-[var(--theme-custom-07111f)] dark:text-white">
			<div class="absolute inset-x-0 top-0 -z-0 h-[520px] bg-[radial-gradient(circle_at_top_left,rgba(51,122,176,0.22),transparent_40%),radial-gradient(circle_at_top_right,rgba(109,171,223,0.20),transparent_36%),linear-gradient(to_bottom,rgba(255,255,255,0.8),transparent)] dark:bg-[radial-gradient(circle_at_top_left,rgba(51,122,176,0.24),transparent_38%),radial-gradient(circle_at_top_right,rgba(94,196,195,0.18),transparent_34%),linear-gradient(to_bottom,rgba(7,17,31,1),rgba(7,17,31,0))]" />

			<div class="relative mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
				<section class="relative overflow-hidden rounded-[2rem] border border-sky-200/70 bg-white/75 px-6 py-8 shadow-[0_30px_100px_-50px_rgba(32,101,152,0.5)] backdrop-blur-xl dark:border-sky-900/60 dark:bg-slate-950/70 sm:px-8 lg:px-10">
					<div class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(51,122,176,0.16),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(155,202,242,0.16),transparent_28%)]" />

					<div class="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
						<div class="max-w-3xl">
							<div class="mb-4 inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-700 dark:border-sky-900/60 dark:bg-sky-950/70 dark:text-sky-300">
								<Scale class="h-4 w-4" />
								Legal Agreement
							</div>

							<h1 class="text-4xl font-semibold tracking-tight text-slate-900 dark:text-white sm:text-5xl lg:text-6xl">
								Terms & Conditions
							</h1>

							<p class="mt-5 max-w-3xl text-base leading-8 text-slate-600 dark:text-slate-300 sm:text-lg">
								This platform is an international B2B Garments and Textiles Marketplace, where
								Buyer, Factory and Buying House connect for professional business purposes. By
								creating or using an account on the platform, you agree to the following terms and
								conditions.
							</p>
						</div>

						<div class="grid gap-3 sm:grid-cols-2 lg:w-[410px] lg:grid-cols-1">
							<div class="rounded-2xl border border-sky-200/70 bg-white/80 p-5 shadow-sm dark:border-sky-900/60 dark:bg-slate-900/50">
								<div class="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
									Platform
								</div>
								<div class="mt-2 text-lg font-semibold text-slate-900 dark:text-white">
									GarTexHub Professional Network
								</div>
								<div class="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
									Public route: /terms
								</div>
							</div>

							<div class="rounded-2xl border border-sky-200/70 bg-gradient-to-br from-sky-50 to-cyan-50 p-5 shadow-sm dark:border-sky-900/60 dark:from-sky-950/40 dark:to-cyan-950/20">
								<div class="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
									Last Updated
								</div>
								<div class="mt-2 text-lg font-semibold text-slate-900 dark:text-white">
									{lastUpdated}
								</div>
								<div class="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
									Dynamically generated on render.
								</div>
							</div>
						</div>
					</div>
				</section>

				<section class="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
					{[
						["Public Access", "No authentication required"],
						["Business Use", "Legitimate B2B activity only"],
						["Security", "Encrypted and controlled environment"],
						["Evidence", "PDF copies and recordings retained"],
					].map(([label, value]) => (
						<div
							key={label}
							class="rounded-3xl border border-slate-200/80 bg-white/75 p-5 shadow-sm backdrop-blur dark:border-slate-800/80 dark:bg-slate-950/60"
						>
							<div class="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
								{label}
							</div>
							<div class="mt-2 text-base font-medium text-slate-800 dark:text-slate-100">
								{value}
							</div>
						</div>
					))}
				</section>

				<section class="mt-10 space-y-5">
					{sections.map((section, index) => (
						<div
							key={section.id}
							ref={(node) => {
								refs.current[index] = node;
							}}
						>
							<SectionCard section={section} index={index} visible={visible[index] ?? false} />
						</div>
					))}
				</section>

				<footer class="mt-10 rounded-[2rem] border border-sky-200/70 bg-white/75 px-6 py-6 text-center shadow-sm backdrop-blur dark:border-sky-900/60 dark:bg-slate-950/60 sm:px-8">
					<p class="text-sm leading-7 text-slate-600 dark:text-slate-300">
						&copy; 2026 GarTexHub Professional Network. All Rights Reserved.
					</p>
				</footer>
			</div>
		</main>
	);
}
