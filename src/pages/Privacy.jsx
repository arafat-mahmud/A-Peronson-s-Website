import {
	BadgeCheck,
	ChevronRight,
	ClipboardCheck,
	Database,
	FileText,
	Fingerprint,
	Lock,
	Mail,
	Menu,
	MessagesSquare,
	Moon,
	ScrollText,
	ShieldCheck,
	Sun,
	Users,
	X,
} from "lucide-react";
import { useMemo, useState } from "react";
import usePageMeta from "../lib/usePageMeta.js";

const sections = [
	{
		id: "information-we-collect",
		title: "Information We Collect",
		icon: Database,
		items: [
			{
				label: "Account Data",
				details: [
					"Full Name",
					"Organization Name",
					"Email Address",
					"Phone Number",
					"Country",
					"Verification Docs",
					"Account Type",
				],
			},
			{
				label: "Business Data",
				details: [
					"Product Specifications",
					"Design Requirements",
					"Order Documents",
					"Digital Signature Records",
				],
			},
			{
				label: "Communications",
				details: ["Chat messages", "Video/Audio logs", "Call recordings"],
			},
			{
				label: "Technical Information",
				details: ["IP address", "Device/Browser type", "Usage activity", "Search history"],
			},
		],
	},
	{
		id: "how-we-use-your-information",
		title: "How We Use Your Information",
		icon: ClipboardCheck,
		pills: [
			"Account Management",
			"Order Matching",
			"Secure Communications",
			"Digital Contracts",
			"Fraud Prevention",
			"Personalized Alerts",
		],
	},
	{
		id: "fraud-prevention-measures",
		title: "Fraud Prevention Measures",
		icon: ShieldCheck,
		bullets: [
			"We take fraud prevention seriously. All calls are recorded and contracts are digitally signed for your security.",
			"Identity verification process",
			"Secure digital contracts",
			"Recorded calls for disputes",
			"Verified user visibility",
			"Role-based access control",
			"Suspicious activity monitoring",
			"Secure reference exchange",
		],
	},
	{
		id: "data-sharing-policy",
		title: "Data Sharing Policy",
		icon: Users,
		bullets: [
			"We do not sell personal data to third parties.",
			"Information may be shared only between involved business partners, when legally required, or to prevent fraud.",
		],
	},
	{
		id: "call-recording-chat-storage",
		title: "Call Recording & Chat Storage",
		icon: MessagesSquare,
		bullets: [
			"All communications within the platform are stored securely for your protection. Your data will never be sold to third parties.",
			"Call recordings are retained strictly for legal protection and dispute resolution.",
		],
	},
	{
		id: "digital-contracts-signatures",
		title: "Digital Contracts & Signatures",
		icon: ScrollText,
		bullets: [
			"Digital signatures executed through the platform are legally binding.",
			"PDF copies are provided and securely stored for legal record integrity.",
		],
	},
	{
		id: "data-security",
		title: "Data Security",
		icon: Lock,
		pills: [
			"Encrypted transmission",
			"Secure server infrastructure",
			"Multi-level authentication",
			"Granular role-based permissions",
		],
	},
	{
		id: "user-rights",
		title: "User Rights",
		icon: BadgeCheck,
		bullets: [
			"Update info",
			"Request deletion",
			"Obtain a copy of your data",
			"Manage notification preferences",
		],
	},
	{
		id: "contact-information",
		title: "Contact Information",
		icon: Mail,
		contact: "gartexhubsupport@gmail.com",
	},
];

function SectionCard({ section, index, dark }) {
	const Icon = section.icon;

	return (
		<section
			id={section.id}
			className={`scroll-mt-24 rounded-3xl border p-6 md:p-8 shadow-sm transition-all ${
				dark
					? "border-slate-800 bg-slate-950/70 shadow-sky-950/10"
					: "border-slate-200 bg-white shadow-sky-100/70"
			}`}
		>
			<div className="flex items-start gap-4">
				<div
					className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border ${
						dark
							? "border-sky-500/30 bg-sky-500/10 text-sky-300"
							: "border-sky-200 bg-sky-50 text-sky-700"
					}`}
				>
					<Icon className="h-5 w-5" />
				</div>
				<div className="min-w-0 flex-1">
					<div className="mb-2 flex flex-wrap items-center gap-2">
						<span
							className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium tracking-wide ${
								dark
									? "bg-sky-500/10 text-sky-300 ring-1 ring-inset ring-sky-400/20"
									: "bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-200"
							}`}
						>
							Section {String(index).padStart(2, "0")}
						</span>
						<span
							className={`text-xs font-medium uppercase tracking-[0.18em] ${
								dark ? "text-slate-400" : "text-slate-500"
							}`}
						>
							Legal Documentation
						</span>
					</div>
					<h2
						className={`text-2xl font-semibold tracking-tight md:text-3xl ${
							dark ? "text-white" : "text-slate-950"
						}`}
					>
						{section.title}
					</h2>
				</div>
			</div>

			{section.items && (
				<div className="mt-6 grid gap-4 lg:grid-cols-2">
					{section.items.map((item) => (
						<div
							key={item.label}
							className={`rounded-2xl border p-4 ${
								dark ? "border-slate-800 bg-slate-900/70" : "border-slate-200 bg-slate-50/80"
							}`}
						>
							<h3
								className={`text-sm font-semibold uppercase tracking-[0.18em] ${dark ? "text-sky-300" : "text-sky-700"}`}
							>
								{item.label}
							</h3>
							<div className="mt-3 flex flex-wrap gap-2">
								{item.details.map((d) => (
									<span
										key={d}
										className={`inline-flex items-center rounded-full px-3 py-1 text-sm ${
											dark ? "bg-slate-800 text-slate-200" : "bg-white text-slate-700 shadow-sm"
										}`}
									>
										{d}
									</span>
								))}
							</div>
						</div>
					))}
				</div>
			)}

			{section.pills && (
				<div className="mt-6 flex flex-wrap gap-2">
					{section.pills.map((p) => (
						<span
							key={p}
							className={`inline-flex items-center rounded-full px-3 py-1.5 text-sm font-medium ${
								dark
									? "bg-slate-900 text-sky-100 ring-1 ring-inset ring-sky-500/15"
									: "bg-sky-50 text-sky-800 ring-1 ring-inset ring-sky-200"
							}`}
						>
							{p}
						</span>
					))}
				</div>
			)}

			{section.bullets && (
				<ul className="mt-6 space-y-3">
					{section.bullets.map((b) => (
						<li
							key={b}
							className={`flex gap-3 rounded-2xl border p-4 text-sm leading-6 ${
								dark
									? "border-slate-800 bg-slate-900/60 text-slate-200"
									: "border-slate-200 bg-slate-50 text-slate-700"
							}`}
						>
							<ChevronRight
								className={`mt-0.5 h-4 w-4 shrink-0 ${dark ? "text-sky-300" : "text-sky-600"}`}
							/>
							<span>{b}</span>
						</li>
					))}
				</ul>
			)}

			{section.contact && (
				<div
					className={`mt-6 rounded-2xl border p-5 ${
						dark ? "border-sky-500/20 bg-sky-500/10" : "border-sky-200 bg-sky-50"
					}`}
				>
					<div className="flex items-center gap-3">
						<Mail className={`h-5 w-5 ${dark ? "text-sky-300" : "text-sky-700"}`} />
						<div>
							<p className={`text-sm font-medium ${dark ? "text-sky-100" : "text-sky-900"}`}>
								Direct Support
							</p>
							<a
								href={`mailto:${section.contact}`}
								className={`text-sm underline-offset-4 hover:underline ${dark ? "text-white" : "text-slate-950"}`}
							>
								{section.contact}
							</a>
						</div>
					</div>
				</div>
			)}
		</section>
	);
}

export default function Privacy() {
	usePageMeta({
		title: "Privacy Policy — GarTexHub",
		description:
			"Understand how GarTexHub collects, uses, and protects your personal data and privacy.",
		canonical: "https://gartexhub.onrender.com/privacy",
		url: "/privacy",
	});

	const [dark, setDark] = useState(true);
	const [menuOpen, setMenuOpen] = useState(false);
	const lastUpdated = "16 March 2026";

	const toc = useMemo(
		() =>
			sections.map((s, idx) => ({
				id: s.id,
				label: `${idx + 1}. ${s.title}`,
			})),
		[],
	);

	return (
		<div className={dark ? "dark" : ""}>
			<div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-blue-50 text-slate-900 transition-colors dark:from-slate-950 dark:via-slate-950 dark:to-sky-950 dark:text-slate-100">
				<div className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-10">
					<header
						className={`sticky top-4 z-40 mb-6 rounded-3xl border backdrop-blur-xl ${
							dark
								? "border-slate-800/80 bg-slate-950/80 shadow-2xl shadow-sky-950/20"
								: "border-white/70 bg-white/80 shadow-xl shadow-sky-100/70"
						}`}
					>
						<div className="flex flex-wrap items-center justify-between gap-4 px-4 py-4 md:px-6">
							<div className="flex items-center gap-4">
								<div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-cyan-300 text-white shadow-lg shadow-sky-400/30">
									<ShieldCheck className="h-6 w-6" />
								</div>
								<div>
									<div className="flex flex-wrap items-center gap-2">
										<span className="inline-flex items-center rounded-full bg-sky-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-sky-700 ring-1 ring-inset ring-sky-200 dark:text-sky-300 dark:ring-sky-400/20">
											Legal Documentation
										</span>
										<span
											className={`text-xs font-medium ${dark ? "text-slate-400" : "text-slate-500"}`}
										>
											Last Updated: {lastUpdated}
										</span>
									</div>
									<h1
										className={`mt-2 text-2xl font-semibold tracking-tight md:text-4xl ${dark ? "text-white" : "text-slate-950"}`}
									>
										Privacy Policy
									</h1>
								</div>
							</div>

							<div className="flex items-center gap-2">
								<button
									type="button"
									onClick={() => setMenuOpen((v) => !v)}
									className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-medium transition hover:-translate-y-0.5 md:hidden ${
										dark
											? "border-slate-800 bg-slate-900 text-slate-100"
											: "border-slate-200 bg-white text-slate-700"
									}`}
								>
									{menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
									Menu
								</button>

								<button
									type="button"
									onClick={() => setDark((v) => !v)}
									className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-medium transition hover:-translate-y-0.5 ${
										dark
											? "border-slate-800 bg-slate-900 text-slate-100"
											: "border-slate-200 bg-white text-slate-700"
									}`}
									aria-label="Toggle theme"
								>
									{dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
									{dark ? "Light" : "Dark"}
								</button>
							</div>
						</div>
					</header>

					<div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
						<aside
							className={`lg:sticky lg:top-28 h-fit rounded-3xl border p-5 shadow-sm ${
								dark ? "border-slate-800 bg-slate-950/70" : "border-slate-200 bg-white"
							} ${menuOpen ? "block" : "hidden lg:block"}`}
						>
							<div className="flex items-center gap-3">
								<div
									className={`flex h-10 w-10 items-center justify-center rounded-2xl ${dark ? "bg-sky-500/10 text-sky-300" : "bg-sky-50 text-sky-700"}`}
								>
									<FileText className="h-5 w-5" />
								</div>
								<div>
									<p className={`text-sm font-semibold ${dark ? "text-white" : "text-slate-950"}`}>
										Quick Navigation
									</p>
									<p className={`text-xs ${dark ? "text-slate-400" : "text-slate-500"}`}>
										Jump to any policy section
									</p>
								</div>
							</div>

							<nav className="mt-5 space-y-2">
								{toc.map((item) => (
									<a
										key={item.id}
										href={`#${item.id}`}
										onClick={() => setMenuOpen(false)}
										className={`group flex items-center justify-between rounded-2xl border px-4 py-3 text-sm font-medium transition hover:-translate-y-0.5 ${
											dark
												? "border-slate-800 bg-slate-900/70 text-slate-200 hover:border-sky-500/30 hover:bg-sky-500/10"
												: "border-slate-200 bg-slate-50 text-slate-700 hover:border-sky-200 hover:bg-sky-50"
										}`}
									>
										<span className="pr-3 leading-5">{item.label}</span>
										<ChevronRight className="h-4 w-4 shrink-0 opacity-60 transition group-hover:translate-x-1 group-hover:opacity-100" />
									</a>
								))}
							</nav>

							<div
								className={`mt-5 rounded-2xl border p-4 ${dark ? "border-slate-800 bg-slate-900/60" : "border-slate-200 bg-slate-50"}`}
							>
								<div className="flex items-center gap-2 text-sm font-semibold">
									<Fingerprint className={`h-4 w-4 ${dark ? "text-sky-300" : "text-sky-700"}`} />
									Secure Business Platform
								</div>
								<p
									className={`mt-2 text-sm leading-6 ${dark ? "text-slate-300" : "text-slate-600"}`}
								>
									GarTexHub connects Buyers, Factories, and Buying Houses in a secure and
									professional environment.
								</p>
							</div>
						</aside>

						<main className="space-y-6">
							<section
								className={`rounded-3xl border p-6 md:p-8 ${dark ? "border-slate-800 bg-slate-950/70" : "border-slate-200 bg-white"}`}
							>
								<div className="flex flex-wrap items-center gap-3">
									<span className="inline-flex items-center rounded-full bg-gradient-to-r from-sky-500/15 to-cyan-300/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-sky-700 ring-1 ring-inset ring-sky-200 dark:text-sky-300 dark:ring-sky-400/20">
										Legal Documentation
									</span>
									<span
										className={`text-xs font-medium ${dark ? "text-slate-400" : "text-slate-500"}`}
									>
										Route: /privacy &middot; Access: Public
									</span>
								</div>

								<p
									className={`mt-5 max-w-4xl text-base leading-8 md:text-lg ${dark ? "text-slate-300" : "text-slate-600"}`}
								>
									This Privacy Policy explains how our B2B Garments and Textile Marketplace platform
									collects, uses, protects, and manages your information. Our platform connects
									international Buyers, Factories, and Buying Houses in a secure and professional
									environment. By creating an account or using our services, you agree to the
									practices described in this policy.
								</p>

								<div className="mt-6 grid gap-4 md:grid-cols-3">
									<div
										className={`rounded-2xl border p-4 ${dark ? "border-slate-800 bg-slate-900/60" : "border-slate-200 bg-slate-50"}`}
									>
										<p
											className={`text-xs uppercase tracking-[0.2em] ${dark ? "text-slate-400" : "text-slate-500"}`}
										>
											Platform
										</p>
										<p className={`mt-2 font-semibold ${dark ? "text-white" : "text-slate-950"}`}>
											GarTexHub
										</p>
									</div>
									<div
										className={`rounded-2xl border p-4 ${dark ? "border-slate-800 bg-slate-900/60" : "border-slate-200 bg-slate-50"}`}
									>
										<p
											className={`text-xs uppercase tracking-[0.2em] ${dark ? "text-slate-400" : "text-slate-500"}`}
										>
											Category
										</p>
										<p className={`mt-2 font-semibold ${dark ? "text-white" : "text-slate-950"}`}>
											Legal Documentation
										</p>
									</div>
									<div
										className={`rounded-2xl border p-4 ${dark ? "border-slate-800 bg-slate-900/60" : "border-slate-200 bg-slate-50"}`}
									>
										<p
											className={`text-xs uppercase tracking-[0.2em] ${dark ? "text-slate-400" : "text-slate-500"}`}
										>
											Policy Style
										</p>
										<p className={`mt-2 font-semibold ${dark ? "text-white" : "text-slate-950"}`}>
											Static JSX Page
										</p>
									</div>
								</div>
							</section>

							{sections.map((section, idx) => (
								<SectionCard key={section.id} section={section} index={idx + 1} dark={dark} />
							))}

							<footer
								className={`rounded-3xl border p-6 text-center text-sm tracking-wide ${
									dark
										? "border-slate-800 bg-slate-950/80 text-slate-300"
										: "border-slate-200 bg-white text-slate-600"
								}`}
							>
								&copy; 2026 GARTEXHUB PROFESSIONAL NETWORK. ALL RIGHTS RESERVE
							</footer>
						</main>
					</div>
				</div>
			</div>
		</div>
	);
}
