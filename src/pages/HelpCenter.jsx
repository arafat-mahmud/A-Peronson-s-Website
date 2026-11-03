/*
  Route: /help
  Access: Public

  Public Pages:
    /, /pricing, /about, /terms, /privacy, /help, /login, /signup, /access-denied
  Protected Pages (login required):
    /feed, /search, /buyer/:id, /factory/:id, /buying-house/:id, /contracts,
    /notifications, /chat, /call, /verification, /verification-center

  Primary responsibilities:
    - Help Center documentation + admin FAQ management UI (if user has permissions).
    - Keep the existing 2-column layout: main content + sticky sidebar.
    - Provide a bento-grid navigation hub for quick jumping to sections.

  Key API endpoints:
    - GET /api/assistant/knowledge (FAQ list)
    - POST/DELETE endpoints for FAQ management (depending on existing server implementation)

  Major UI/UX patterns:
    - "Modern Industrialist" palette:
      light = slate-50 studio; dark = deep slate (#0B0F1A).
    - Glassmorphism cards, spotlight hover, staggered entry motion.
    - Role glows in dark mode (Buyer/Factory/Buying House).
    - Verified shimmer badge styling (trust indicator).

  Special:
    - FloatingAssistant switches to "Orb" styling only on this route.
*/

import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import {
	ArrowUpRight,
	BadgeCheck,
	Bot,
	BriefcaseBusiness,
	Building2,
	ChevronRight,
	CircleDot,
	Factory,
	FileCheck2,
	FileSignature,
	FileText,
	Globe2,
	Headphones,
	Info,
	LifeBuoy,
	Lock,
	MessageSquareMore,
	MessagesSquare,
	Mic,
	Moon,
	PhoneCall,
	PlayCircle,
	RadioTower,
	ScanSearch,
	Search,
	Shield,
	ShieldCheck,
	Sparkles,
	Sun,
	TerminalSquare,
	Users,
	Video,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import AnimatedAccordion from "../components/AnimatedAccordion.jsx";
import ScrollReveal from "../components/ScrollReveal.jsx";
import NeonAtom from "../components/ui/NeonAtom.jsx";
import StructuredData from "../components/ui/StructuredData.jsx";
import { useSecureUser } from "../hooks/useSecureUser.js";
import { apiRequest, getCurrentUser, getToken } from "../lib/auth.js";
import { useTheme } from "../lib/ThemeProvider.jsx";
import usePageMeta from "../lib/usePageMeta.js";

const quickLinks = [
	{ id: "quick-start", label: "Quick Start Guide", icon: Sparkles },
	{ id: "account-types", label: "Account Types", icon: Users },
	{ id: "verification", label: "Verification Process", icon: BadgeCheck },
	{
		id: "messaging",
		label: "Messaging & Conversation Rules",
		icon: MessagesSquare,
	},
	{ id: "subscription", label: "Subscription Plans", icon: ShieldCheck },
	{ id: "calls", label: "Video & Audio Calls", icon: Video },
	{ id: "contracts", label: "Contracts & Legal Vault", icon: FileSignature },
	{ id: "security", label: "Security & Data Protection", icon: Lock },
	{ id: "assistant", label: "Floating AI Assistant", icon: Bot },
	{ id: "faq", label: "FAQ", icon: Info },
];

const faqSeed = [
	{
		q: "Can I buy verification without documents?",
		a: "No. Verification requires mandatory document submission and backend approval.",
		keywords: "verification documents approval",
	},
	{
		q: "Can I create multiple sub-accounts?",
		a: "Yes. Buying Houses and Factories can create limited sub-accounts under Free plans.",
		keywords: "sub-accounts agents factory buying house",
	},
	{
		q: "Does GarTexHub handle payments?",
		a: "No. The platform facilitates communication and contracts only.",
		keywords: "payments financial transactions contracts",
	},
	{
		q: "Can I increase my visibility?",
		a: "Premium plans may provide improved reach, stronger visibility, and advanced analytics for eligible accounts.",
		keywords: "premium visibility analytics reach",
	},
	{
		q: "Who can use the messaging lock?",
		a: "Buying House and Factory teams can use the lock to prevent parallel conversations when ownership of a thread is already assigned.",
		keywords: "messages lock agents conversation",
	},
	{
		q: "Are calls recorded?",
		a: "Calls may be recorded for security and compliance, and users are notified before recording begins.",
		keywords: "calls recording compliance audio video",
	},
];

const featurePills = [
	"Industrial reliability",
	"Tech-forward SaaS guidance",
	"Document-based trust",
	"Conflict-free messaging",
	"Audit-ready records",
	"Premium visibility",
];

function HelpSection({
	id,
	icon: Icon,
	title,
	subtitle,
	children,
	accent = "from-sky-500/20 to-blue-500/10",
}) {
	return (
		<section
			id={id}
			className="relative rounded-3xl border border-slate-200/70 bg-white/80 p-6 shadow-[0_20px_80px_rgba(15,23,42,0.08)] backdrop-blur-xl transition-all duration-300 dark:border-slate-800/80 dark:bg-slate-950/70"
		>
			<div
				className={`pointer-events-none absolute inset-0 overflow-hidden rounded-3xl bg-gradient-to-br ${accent} opacity-100`}
			/>
			<div className="relative">
				<div className="mb-5 flex items-start gap-4">
					<div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/20 bg-slate-900 text-white shadow-lg shadow-sky-500/20 dark:bg-sky-400 dark:text-slate-950">
						<Icon className="h-6 w-6" />
					</div>
					<div>
						<h2 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
							{title}
						</h2>
						<p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
							{subtitle}
						</p>
					</div>
				</div>
				{children}
			</div>
		</section>
	);
}

function StatCard({ icon: Icon, title, text }) {
	return (
		<div className="rounded-2xl border border-slate-200/70 bg-white/70 p-4 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-950/60">
			<div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-600 dark:bg-sky-400/15 dark:text-sky-300">
				<Icon className="h-5 w-5" />
			</div>
			<h3 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h3>
			<p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">{text}</p>
		</div>
	);
}

export default function HelpCenterPage() {
	usePageMeta({
		title: "Help Center | Garment Sourcing FAQs for Buyers & Apparel Manufacturers — GarTexHub",
		type: "website",
		description:
			"Garment sourcing help and FAQs for buyers, factories and buying houses — verification, messaging, contracts and plans.",
		canonical: "https://gartexhub.onrender.com/help",
		siteName: "GarTexHub",
		locale: "en_US",
	});
	const { theme, toggleTheme } = useTheme();
	const [search, setSearch] = useState("");
	const [faqQuery, setFaqQuery] = useState("");
	const [faqs, setFaqs] = useState([]);
	const [loading, setLoading] = useState(false);
	const [pageLoading, setPageLoading] = useState(true);
	const user = getCurrentUser();
	const { user: secureUser, loading: secureLoading } = useSecureUser();
	const token = getToken();
	const userRole = secureUser?.role || user?.role;
	const reduceMotion = useReducedMotion();
	const { scrollY } = useScroll();
	const headerGradientY = useTransform(scrollY, [0, 400], [0, -20]);

	useEffect(() => {
		async function fetchFaqs() {
			setLoading(true);
			try {
				const data = await apiRequest("/assistant/knowledge", { token });
				// The API answers { entries: [...] }; keep the seed FAQs when empty.
				const list = Array.isArray(data) ? data : data?.entries;
				if (Array.isArray(list) && list.length > 0) {
					setFaqs(list);
				}
			} catch {
				// Fall back to seed data
			} finally {
				setLoading(false);
			}
		}
		if (token) {
			fetchFaqs();
		}
	}, [token]);

	useEffect(() => {
		if (pageLoading && !loading && !secureLoading) {
			// eslint-disable-next-line react-hooks/set-state-in-effect
			setPageLoading(false);
		}
	}, [pageLoading, loading, secureLoading]);

	const filteredFaq = useMemo(() => {
		const query = faqQuery.trim().toLowerCase();
		const source = faqs.length > 0 ? faqs : faqSeed;
		if (!query) {
			return source;
		}
		return source.filter(
			(item) =>
				item.q?.toLowerCase().includes(query) ||
				item.question?.toLowerCase().includes(query) ||
				item.a?.toLowerCase().includes(query) ||
				item.answer?.toLowerCase().includes(query) ||
				item.keywords?.toLowerCase().includes(query),
		);
	}, [faqQuery, faqs]);

	const searchableSections = useMemo(() => {
		const corpus = [
			{
				id: "quick-start",
				text: "quick start guide create account profile setup main feed search post buyer requests products premium visibility analytics",
			},
			{
				id: "account-types",
				text: "buyer factory buying house roles permissions messages calls requests products agents",
			},
			{
				id: "verification",
				text: "verification document approval company registration trade license tin nid bank proof erc vat ein eori",
			},
			{
				id: "messaging",
				text: "message requests inbox lock permission agent conversation conflict internal control",
			},
			{
				id: "subscription",
				text: "free premium visibility analytics management capabilities plan",
			},
			{
				id: "calls",
				text: "video audio calls chat scheduling recording compliance notify",
			},
			{
				id: "contracts",
				text: "contracts legal vault pdf secure history financial transactions",
			},
			{
				id: "security",
				text: "documents protection backend approval expired licenses encrypted systems",
			},
			{
				id: "assistant",
				text: "floating assistant orb help articles support navigate settings dashboards",
			},
			{
				id: "faq",
				text: "faq search users terms workflows admin knowledge base support ticket live chat",
			},
		];
		const q = search.trim().toLowerCase();
		if (!q) {
			return corpus;
		}
		return corpus.filter((item) => item.text.includes(q));
	}, [search]);

	const jumpTo = (id) => {
		const el = document.getElementById(id);
		if (el) {
			el.scrollIntoView({ behavior: "smooth", block: "start" });
		}
	};

	const isAdmin = userRole === "admin" || userRole === "owner";
	const [activeSection, setActiveSection] = useState("quick-start");
	const sectionIds = quickLinks.map((l) => l.id);
	const observerRef = useRef(null);

	useEffect(() => {
		observerRef.current = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) {
						setActiveSection(entry.target.id);
					}
				}
			},
			{ rootMargin: "-80px 0px -70% 0px" },
		);

		const els = sectionIds.map((id) => document.getElementById(id)).filter(Boolean);
		els.forEach((el) => observerRef.current.observe(el));
		return () => observerRef.current.disconnect();
	}, [sectionIds]);

	const faqItems = (faqs.length > 0 ? faqs : faqSeed).map((item) => ({
		"@type": "Question",
		name: item.q || item.question || "",
		acceptedAnswer: {
			"@type": "Answer",
			text: item.a || item.answer || "",
		},
	}));

	if (pageLoading) {
		return <NeonAtom fill={true} timeout={10000} />;
	}

	return (
		<div className="min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_top,rgba(109,171,223,0.24),transparent_34%),linear-gradient(180deg,#eff8ff_0%,#f8fbff_35%,#ffffff_100%)] text-slate-900 transition-colors duration-300 dark:bg-[radial-gradient(circle_at_top,rgba(51,122,176,0.18),transparent_30%),linear-gradient(180deg,#020617_0%,#07111f_52%,#020617_100%)] dark:text-slate-100">
			<StructuredData
				data={{
					"@context": "https://schema.org",
					"@type": "FAQPage",
					mainEntity: faqItems,
				}}
			/>
			<div className="mx-auto max-w-7xl overflow-x-hidden px-4 py-6 sm:px-6 lg:px-8">
				<header className="mb-6 overflow-hidden rounded-[2rem] border border-slate-200/70 bg-white/70 shadow-[0_24px_120px_rgba(15,23,42,0.1)] backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/70">
					<div className="relative px-6 py-6 sm:px-8 sm:py-8">
						<motion.div
							style={{ y: reduceMotion ? 0 : headerGradientY }}
							className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(51,122,176,0.16),transparent_40%,rgba(55,115,168,0.08))]"
						/>
						<div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
							<div className="max-w-3xl">
								<div className="mb-4 inline-flex items-center gap-2 rounded-full border border-sky-200/70 bg-sky-500/10 px-4 py-2 text-xs font-semibold tracking-[0.24em] text-sky-700 uppercase dark:border-sky-400/20 dark:text-sky-200">
									<LifeBuoy className="h-4 w-4" />
									Help Center
								</div>
								<h1 className="text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl dark:text-white">
									<span className="sr-only">Garment Sourcing Help &amp; FAQs — </span>
									Industrial reliability, tech-forward SaaS guidance.
								</h1>
								<p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-300">
									A premium help experience for buyers, factories, and buying houses — built to
									guide onboarding, trust, messaging, contracts, and support in one place.
								</p>
								<div className="mt-5 flex flex-wrap gap-2">
									{featurePills.map((pill) => (
										<span
											key={pill}
											className="rounded-full border border-slate-200/80 bg-white/80 px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200"
										>
											{pill}
										</span>
									))}
								</div>
							</div>

							<div className="flex flex-col gap-3 sm:flex-row lg:flex-col lg:items-end">
								<div className="rounded-2xl border border-slate-200/70 bg-white/75 p-2 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-950/60">
									<button
										onClick={toggleTheme}
										className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-900"
									>
										{theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
										{theme === "dark" ? "Light mode" : "Dark mode"}
									</button>
								</div>
							</div>
						</div>
					</div>
				</header>

				<div className="grid min-w-0 gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
					<aside className="min-w-0 space-y-6 lg:sticky lg:top-6 lg:h-fit">
						<div className="rounded-3xl border border-slate-200/70 bg-white/80 p-5 shadow-[0_20px_70px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/70">
							<div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
								<ScanSearch className="h-4 w-4 text-sky-500" />
								Search
							</div>
							<div className="relative">
								<Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
								<input
									value={search}
									onChange={(e) => {
										setSearch(e.target.value);
										setFaqQuery(e.target.value);
									}}
									onKeyDown={(e) => {
										if (e.key === "Enter") jumpTo("faq");
									}}
									placeholder="Search users, terms, workflows..."
									className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-4 focus:ring-sky-500/10 dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-500"
								/>
							</div>
							<div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-600 dark:text-slate-300">
								{["verification", "contracts", "messages", "premium", "sub-accounts"].map((tag) => (
									<button
										key={tag}
										onClick={() => {
											setSearch(tag);
											setFaqQuery(tag);
											jumpTo("faq");
										}}
										className="rounded-full border border-slate-200 px-3 py-1.5 transition hover:border-sky-300 hover:bg-sky-500/10 dark:border-slate-800 dark:hover:border-sky-500/30"
									>
										{tag}
									</button>
								))}
							</div>
						</div>

						<nav className="rounded-3xl border border-slate-200/70 bg-white/80 p-5 shadow-[0_20px_70px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/70">
							<div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
								<TerminalSquare className="h-4 w-4 text-sky-500" />
								Quick navigation
							</div>
							<motion.div
								className="space-y-1.5"
								variants={{
									hidden: { opacity: 0 },
									visible: {
										opacity: 1,
										transition: { staggerChildren: 0.04, delayChildren: 0.1 },
									},
								}}
								initial="hidden"
								whileInView="visible"
								viewport={{ once: true, margin: "-40px" }}
							>
								{quickLinks.map(({ id, label, icon: Icon }) => (
									<motion.button
										key={id}
										variants={{
											hidden: { opacity: 0, x: -12 },
											visible: {
												opacity: 1,
												x: 0,
												transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] },
											},
										}}
										onClick={() => jumpTo(id)}
										className={`group flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm transition ${
											activeSection === id
												? "bg-sky-500/15 text-sky-700 dark:text-sky-200"
												: "text-slate-700 hover:bg-sky-500/10 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white"
										}`}
									>
										<Icon
											className={`h-4 w-4 transition group-hover:scale-110 ${
												activeSection === id ? "text-sky-600" : "text-sky-500"
											}`}
										/>
										<span className="flex-1">{label}</span>
										<ChevronRight
											className={`h-4 w-4 transition ${
												activeSection === id ? "translate-x-0.5 text-sky-500" : "text-slate-400"
											}`}
										/>
									</motion.button>
								))}
							</motion.div>
						</nav>
					</aside>

					<main className="space-y-6">
						{search && (
							<div className="rounded-3xl border border-sky-200/70 bg-sky-500/10 p-4 text-sm text-slate-700 dark:border-sky-500/20 dark:text-slate-200">
								Showing matching sections for <span className="font-semibold">{search}</span>. Found{" "}
								{searchableSections.length} section
								{searchableSections.length === 1 ? "" : "s"}.
							</div>
						)}

						<ScrollReveal>
							<HelpSection
								id="quick-start"
								icon={Sparkles}
								title="1. Quick Start Guide"
								subtitle="Fast setup for buyers, factories, and buying houses."
								accent="from-sky-400/18 to-cyan-400/10"
							>
								<div className="overflow-x-hidden">
									<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
										{[
											{
												n: "Step 1",
												title: "Create an account",
												text: "Choose Buyer, Factory, or Buying House.",
												icon: Users,
											},
											{
												n: "Step 2",
												title: "Complete basic profile setup",
												text: "Add Organization Name, Category, and Profile Image.",
												icon: Building2,
											},
											{
												n: "Step 3",
												title: "Explore the feed",
												text: "Use the Main Feed or Search to find relevant posts.",
												icon: ScanSearch,
											},
											{
												n: "Step 4",
												title: "Start conversations",
												text: "Message users or post Buyer Requests / Products.",
												icon: MessageSquareMore,
											},
											{
												n: "Step 5",
												title: "Upgrade when needed",
												text: "Premium unlocks advanced visibility and analytics.",
												icon: ArrowUpRight,
											},
										].map((item) => (
											<div
												key={item.n}
												className="min-w-0 rounded-2xl border border-slate-200/70 bg-white/75 p-4 dark:border-slate-800 dark:bg-slate-950/60"
											>
												<div className="mb-3 flex items-center gap-3">
													<div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-600 dark:bg-sky-400/15 dark:text-sky-300">
														<item.icon className="h-5 w-5" />
													</div>
													<div>
														<div className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600 dark:text-sky-300">
															{item.n}
														</div>
														<div className="text-sm font-semibold text-slate-900 dark:text-white">
															{item.title}
														</div>
													</div>
												</div>
												<p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
													{item.text}
												</p>
											</div>
										))}
									</div>
								</div>
							</HelpSection>
						</ScrollReveal>

						<ScrollReveal>
							<HelpSection
								id="account-types"
								icon={Users}
								title="2. Account Types"
								subtitle="Clear roles, clear permissions."
								accent="from-blue-400/18 to-sky-400/10"
							>
								<div className="grid gap-4 xl:grid-cols-3">
									<div className="rounded-2xl border border-slate-200/70 bg-white/75 p-5 dark:border-slate-800 dark:bg-slate-950/60">
										<div className="mb-4 flex items-center gap-3">
											<div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-600 dark:bg-sky-400/15 dark:text-sky-300">
												<Building2 className="h-5 w-5" />
											</div>
											<div>
												<h3 className="font-semibold text-slate-900 dark:text-white">
													Buyer Account
												</h3>
												<p className="text-sm text-slate-500 dark:text-slate-400">
													For sourcing and requests
												</p>
											</div>
										</div>
										<ul className="space-y-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
											<li>Post detailed Buyer Requests</li>
											<li>Search and filter factories</li>
											<li>Send direct messages</li>
											<li>Schedule calls</li>
										</ul>
									</div>

									<div className="rounded-2xl border border-slate-200/70 bg-white/75 p-5 dark:border-slate-800 dark:bg-slate-950/60">
										<div className="mb-4 flex items-center gap-3">
											<div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-600 dark:bg-sky-400/15 dark:text-sky-300">
												<Factory className="h-5 w-5" />
											</div>
											<div>
												<h3 className="font-semibold text-slate-900 dark:text-white">
													Factory Account
												</h3>
												<p className="text-sm text-slate-500 dark:text-slate-400">
													For production and product posts
												</p>
											</div>
										</div>
										<ul className="space-y-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
											<li>Upload product posts and videos</li>
											<li>Respond to Buyer Requests</li>
											<li>Accept connection requests from Buying Houses</li>
											<li>Manage sub-accounts (Agents)</li>
										</ul>
									</div>

									<div className="rounded-2xl border border-slate-200/70 bg-white/75 p-5 dark:border-slate-800 dark:bg-slate-950/60">
										<div className="mb-4 flex items-center gap-3">
											<div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-600 dark:bg-sky-400/15 dark:text-sky-300">
												<BriefcaseBusiness className="h-5 w-5" />
											</div>
											<div>
												<h3 className="font-semibold text-slate-900 dark:text-white">
													Buying House Account
												</h3>
												<p className="text-sm text-slate-500 dark:text-slate-400">
													For multi-agent deal flow
												</p>
											</div>
										</div>
										<ul className="space-y-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
											<li>Manage multiple agents</li>
											<li>Connect with multiple factories</li>
											<li>Assign Buyer Requests to specific agents</li>
											<li>Monitor deals and analytics (Premium)</li>
										</ul>
									</div>
								</div>
							</HelpSection>
						</ScrollReveal>

						<ScrollReveal>
							<HelpSection
								id="verification"
								icon={BadgeCheck}
								title="3. Verification Process"
								subtitle="Verified status is document-based and requires backend approval. It is subscription-based and renewed monthly."
								accent="from-cyan-400/18 to-sky-400/10"
							>
								<div className="grid gap-4 xl:grid-cols-3">
									<StatCard
										icon={FileCheck2}
										title="Factories must submit"
										text="Company Registration, Trade License, TIN, Authorized Person NID, Company Bank Proof, ERC (Export Registration Certificate)."
									/>
									<StatCard
										icon={FileCheck2}
										title="Buying Houses must submit"
										text="Company Registration, Trade License, TIN, Authorized Person NID, Company Bank Proof."
									/>
									<StatCard
										icon={Globe2}
										title="International Buyers (EU / USA)"
										text="Business Registration, VAT (EU) or EIN (USA), EORI (EU) or IOR (USA), Bank Proof."
									/>
								</div>
								<div className="mt-4 rounded-2xl border border-sky-200/70 bg-sky-500/10 p-4 text-sm leading-6 text-slate-700 dark:border-sky-500/20 dark:text-slate-200">
									The more verified documentation a company provides, the stronger its credibility.
								</div>
							</HelpSection>
						</ScrollReveal>

						<ScrollReveal>
							<HelpSection
								id="messaging"
								icon={MessagesSquare}
								title="4. Messaging & Conversation Rules"
								subtitle="Conflict-free team conversations with verification-aware routing and a buying-house conversation lock."
								accent="from-sky-400/18 to-blue-400/10"
							>
								<div className="grid gap-4 xl:grid-cols-3">
									<div className="rounded-2xl border border-slate-200/70 bg-white/75 p-5 dark:border-slate-800 dark:bg-slate-950/60">
										<div className="flex items-center gap-3">
											<div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-600 dark:bg-sky-400/15 dark:text-sky-300">
												<BadgeCheck className="h-5 w-5" />
											</div>
											<div>
												<h3 className="font-semibold text-slate-900 dark:text-white">
													Verified Users
												</h3>
												<p className="text-sm text-slate-500 dark:text-slate-400">
													Direct inbox delivery
												</p>
											</div>
										</div>
										<p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
											Messages go directly to inbox.
										</p>
									</div>
									<div className="rounded-2xl border border-slate-200/70 bg-white/75 p-5 dark:border-slate-800 dark:bg-slate-950/60">
										<div className="flex items-center gap-3">
											<div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-600 dark:bg-sky-400/15 dark:text-sky-300">
												<MessageSquareMore className="h-5 w-5" />
											</div>
											<div>
												<h3 className="font-semibold text-slate-900 dark:text-white">
													Unverified Users
												</h3>
												<p className="text-sm text-slate-500 dark:text-slate-400">
													Message Requests first
												</p>
											</div>
										</div>
										<p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
											Messages appear in "Message Requests."
										</p>
									</div>
									<div className="rounded-2xl border border-slate-200/70 bg-white/75 p-5 dark:border-slate-800 dark:bg-slate-950/60">
										<div className="flex items-center gap-3">
											<div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-600 dark:bg-sky-400/15 dark:text-sky-300">
												<Lock className="h-5 w-5" />
											</div>
											<div>
												<h3 className="font-semibold text-slate-900 dark:text-white">
													Buying House Conversation Lock
												</h3>
												<p className="text-sm text-slate-500 dark:text-slate-400">
													Agent ownership control
												</p>
											</div>
										</div>
										<p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
											When an Agent starts a conversation, it is assigned to that Agent. Other
											Agents cannot message unless permission is granted. This prevents internal
											conflict.
										</p>
									</div>
								</div>
								<div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200/70 bg-white/75 p-4 dark:border-slate-800 dark:bg-slate-950/60">
									<div className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-2 text-xs font-semibold text-white dark:bg-sky-400 dark:text-slate-950">
										<Lock className="h-3.5 w-3.5" />
										Locked
									</div>
									<span className="text-sm text-slate-600 dark:text-slate-300">
										Teammates need permission.
									</span>
									<button className="ml-auto rounded-full border border-sky-200 bg-sky-500/10 px-4 py-2 text-sm font-medium text-sky-700 transition hover:bg-sky-500/15 dark:border-sky-500/20 dark:text-sky-200">
										Grant permission
									</button>
								</div>
							</HelpSection>
						</ScrollReveal>

						<ScrollReveal>
							<HelpSection
								id="subscription"
								icon={ShieldCheck}
								title="5. Subscription Plans"
								subtitle="Two plans available: Free and Premium. Feature visibility varies by account type."
								accent="from-blue-400/18 to-cyan-400/10"
							>
								<div className="grid gap-4 md:grid-cols-2">
									<div className="rounded-3xl border border-slate-200/70 bg-white/75 p-6 dark:border-slate-800 dark:bg-slate-950/60">
										<div className="text-sm font-semibold text-slate-500 dark:text-slate-400">
											Free
										</div>
										<div className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">
											Core access
										</div>
										<p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
											Essential profile, messaging, and basic discovery.
										</p>
									</div>
									<div className="rounded-3xl border border-sky-200/70 bg-gradient-to-br from-sky-500/12 to-blue-500/10 p-6 shadow-[0_12px_60px_rgba(51,122,176,0.12)] dark:border-sky-500/20 dark:from-sky-500/12 dark:to-slate-900/20">
										<div className="text-sm font-semibold text-sky-700 dark:text-sky-200">
											Premium
										</div>
										<div className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">
											Advanced access
										</div>
										<p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
											Increased profile visibility, advanced analytics for eligible accounts, and
											extended management capabilities.
										</p>
									</div>
								</div>
							</HelpSection>
						</ScrollReveal>

						<ScrollReveal>
							<HelpSection
								id="calls"
								icon={PhoneCall}
								title="6. Video & Audio Calls"
								subtitle="Calls can be started from chat, scheduled, and recorded with prior user notification."
								accent="from-cyan-400/18 to-sky-400/10"
							>
								<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
									<StatCard
										icon={Video}
										title="Direct from chat"
										text="Initiate calls without leaving the conversation."
									/>
									<StatCard
										icon={PlayCircle}
										title="Optional scheduling"
										text="Plan meetings ahead of time for better coordination."
									/>
									<StatCard
										icon={Mic}
										title="Audio support"
										text="Use audio-only or video-enabled communication."
									/>
									<StatCard
										icon={RadioTower}
										title="Recording notice"
										text="Calls may be recorded for security and compliance, and users are notified before recording begins."
									/>
								</div>
							</HelpSection>
						</ScrollReveal>

						<ScrollReveal>
							<HelpSection
								id="contracts"
								icon={FileText}
								title="7. Contracts & Legal Vault"
								subtitle="Secure digital contracts with audit-ready history. GarTexHub does not process direct financial transactions."
								accent="from-blue-400/18 to-sky-400/10"
							>
								<div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
									<div className="rounded-3xl border border-slate-200/70 bg-white/75 p-6 dark:border-slate-800 dark:bg-slate-950/60">
										<ul className="space-y-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
											<li>Digital contracts can be signed through the platform.</li>
											<li>PDF copies are stored securely in the Legal Vault.</li>
											<li>Both parties can access their contract history.</li>
											<li className="font-medium text-slate-800 dark:text-slate-200">
												GarTexHub does not process direct financial transactions.
											</li>
										</ul>
									</div>
									<div className="rounded-3xl border border-sky-200/70 bg-sky-500/10 p-6 dark:border-sky-500/20 dark:bg-sky-500/10">
										<div className="flex items-center gap-3">
											<FileSignature className="h-6 w-6 text-sky-600 dark:text-sky-300" />
											<div>
												<div className="text-sm font-semibold text-slate-900 dark:text-white">
													Legal Vault
												</div>
												<div className="text-sm text-slate-600 dark:text-slate-300">
													Contracts · history · records
												</div>
											</div>
										</div>
										<p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-300">
											Store and review signed PDFs in one secure place with a clean audit trail.
										</p>
									</div>
								</div>
							</HelpSection>
						</ScrollReveal>

						<ScrollReveal>
							<HelpSection
								id="security"
								icon={Shield}
								title="8. Security & Data Protection"
								subtitle="Documents are securely stored, approval is backend-driven, and expired licenses may remove verified status."
								accent="from-sky-400/18 to-blue-400/10"
							>
								<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
									<StatCard
										icon={FileCheck2}
										title="Documents stored securely"
										text="Uploaded documents are protected with secure storage controls."
									/>
									<StatCard
										icon={BadgeCheck}
										title="Backend approval"
										text="Verification status requires backend approval before activation."
									/>
									<StatCard
										icon={CircleDot}
										title="Expiry handling"
										text="Expired licenses may remove verified status."
									/>
									<StatCard
										icon={Lock}
										title="Encrypted systems"
										text="Financial details are protected through encrypted systems."
									/>
								</div>
							</HelpSection>
						</ScrollReveal>

						<ScrollReveal>
							<HelpSection
								id="assistant"
								icon={Bot}
								title="9. Floating AI Assistant"
								subtitle="The assistant helps users understand settings, navigate dashboards, access help articles, and connect to support. It does not handle negotiations."
								accent="from-cyan-400/18 to-sky-400/10"
							/>
						</ScrollReveal>

						<ScrollReveal>
							<HelpSection
								id="faq"
								icon={Info}
								title="10. Frequently Asked Questions (FAQ)"
								subtitle="Searchable answers, no fluff."
								accent="from-sky-400/18 to-blue-400/10"
							>
								<div className="mb-5 rounded-3xl border border-slate-200/70 bg-white/75 p-4 dark:border-slate-800 dark:bg-slate-950/60">
									<div className="relative">
										<Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
										<input
											value={faqQuery}
											onChange={(e) => setFaqQuery(e.target.value)}
											placeholder="Search FAQs..."
											className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-4 focus:ring-sky-500/10 dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-500"
										/>
									</div>
								</div>
								<div className="space-y-3">
									{filteredFaq.length > 0 ? (
										<motion.div
											variants={{
												hidden: { opacity: 0 },
												visible: {
													opacity: 1,
													transition: {
														staggerChildren: 0.05,
														delayChildren: 0.1,
													},
												},
											}}
											initial="hidden"
											whileInView="visible"
											viewport={{ once: true, margin: "-40px" }}
										>
											<AnimatedAccordion
												items={filteredFaq.map((item, idx) => ({
													id: item.q || item.question || String(idx),
													title: `Q: ${item.q || item.question}`,
													content: (
														<>
															<div className="text-sm leading-6 text-slate-600 dark:text-slate-300">
																A: {item.a || item.answer}
															</div>
															{item.keywords && (
																<div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
																	Keywords: {item.keywords}
																</div>
															)}
														</>
													),
												}))}
											/>
										</motion.div>
									) : (
										<div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-6 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950/50 dark:text-slate-400">
											No FAQ matches found.
										</div>
									)}
								</div>

								{isAdmin && (
									<div className="mt-5 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
										<div className="rounded-3xl border border-slate-200/70 bg-white/75 p-5 dark:border-slate-800 dark:bg-slate-950/60">
											<div className="text-sm font-semibold text-slate-900 dark:text-white">
												Admin: Manage Knowledge Base FAQ
											</div>
											<div className="mt-2 text-sm text-slate-600 dark:text-slate-300">
												Owner/Admin · Question · Answer · Keywords (comma separated) · Add FAQ
											</div>
										</div>
										<div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
											<a
												href="/support"
												className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/10 transition hover:-translate-y-0.5 hover:bg-slate-800 dark:bg-sky-400 dark:text-slate-950 dark:hover:bg-sky-300"
											>
												<LifeBuoy className="h-4 w-4" />
												Open support ticket
											</a>
											<button className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-sky-300 hover:bg-sky-500/10 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-sky-500/30">
												<MessagesSquare className="h-4 w-4" />
												Live chat
											</button>
										</div>
									</div>
								)}
							</HelpSection>
						</ScrollReveal>

						<ScrollReveal>
							<section className="rounded-3xl border border-slate-200/70 bg-white/80 p-6 shadow-[0_20px_80px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/70">
								<div className="grid gap-4 lg:grid-cols-2">
									<div className="flex flex-wrap gap-3 lg:justify-end lg:self-center">
										<a
											href="mailto:gartexhubsupport@gmail.com"
											className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-sky-300 hover:bg-sky-500/10 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-sky-500/30"
										>
											<Headphones className="h-4 w-4" />
											Contact support team
										</a>
									</div>
								</div>
							</section>
						</ScrollReveal>
					</main>
				</div>
			</div>
		</div>
	);
}
