/*
  Route: /search
  Access: Protected (login required)
  Allowed roles: buyer, buying_house, factory, owner, admin, agent

  Public Pages:
    /, /pricing, /about, /terms, /privacy, /help, /login, /signup, /access-denied
  Protected Pages (login required):
    /feed, /search, /buyer/:id, /factory/:id, /buying-house/:id, /contracts,
    /notifications, /chat, /call, /verification, /verification-center

  Primary responsibilities:
    - Run marketplace search across Buyer Requests and Companies/Products.
    - Provide basic filters for free tier and advanced filters for premium tier.
    - Support quick view modals and recent views rail.

  Key API endpoints:
    - GET /api/requirements/search?... (buyer requests)
    - GET /api/products/search?... (companies/products)
    - GET /api/ratings/search?profile_keys=...
    - GET /api/products/views/me?cursor=...
    - POST /api/search/alerts (save alerts)

  Major UI/UX patterns:
    - Glass + glow search bar with shortcut hint (Ctrl/Cmd + K).
    - layoutId animated tabs for "All / Buyer Requests / Companies".
    - Skeleton shimmer while loading.
    - Optional premium-locked overlays for advanced filters.
*/
import DOMPurify from "dompurify";
import { AnimatePresence, motion } from "framer-motion";
import {
	ArrowLeftRight,
	ArrowUpDown,
	ArrowUpRight,
	BarChart3,
	Bell,
	Camera,
	Check,
	ChevronDown,
	ChevronUp,
	ClipboardList,
	Clock,
	Crown,
	Download,
	Eye,
	Factory,
	FileSpreadsheet,
	FileText,
	Globe2,
	ImagePlus,
	Languages,
	LocateFixed,
	MapPinned,
	MessageSquareMore,
	Moon,
	PackageCheck,
	PackageSearch,
	Save,
	ScanSearch,
	Search,
	SearchX,
	Share2,
	Shirt,
	SlidersHorizontal,
	Sparkles,
	Star,
	Sun,
	TrendingUp,
	UserSearch,
	WandSparkles,
	Wrench,
	X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Mosaic, ThreeDot } from "react-loading-indicators";
import { Link, useSearchParams } from "react-router-dom";
import MasonryGrid from "../components/MasonryGrid.jsx";
import LazyImage from "../components/ui/LazyImage.jsx";
import NeonAtom from "../components/ui/NeonAtom.jsx";
import UploadProgressBar from "../components/ui/UploadProgressBar.jsx";
import { apiRequest, getCurrentUser, getToken } from "../lib/auth.js";
import { SEASON_OPTIONS, SORT_OPTIONS } from "../lib/constants.js";
import { logger } from "../lib/logger.js";
import { useTheme } from "../lib/ThemeProvider.jsx";
import { uploadFile } from "../lib/upload.js";
import usePageMeta from "../lib/usePageMeta.js";
import {
	ADVANCED_FILTER_KEYS,
	DEFAULT_CORE_FILTER_KEYS,
	validateCoreFilterRenderKeys,
} from "./searchFiltersConfig.js";

const STOCK_STATUS_OPTIONS = [
	{ key: "", label: "Any availability" },
	{ key: "in_stock", label: "In stock" },
	{ key: "made_to_order", label: "Made to order" },
	{ key: "sample_only", label: "Sample only" },
];

const CERTIFICATION_OPTIONS = [
	"ISO 9001",
	"ISO 14001",
	"OEKO-TEX",
	"GOTS",
	"BSCI",
	"SEDEX",
	"GRS",
	"RCS",
];

const CATEGORY_OPTIONS = [
	{ key: "all", label: "All categories" },
	{ key: "wovens", label: "Wovens" },
	{ key: "knits", label: "Knits" },
	{ key: "accessories", label: "Accessories" },
	{ key: "services", label: "Services" },
	{ key: "home-textiles", label: "Home Textiles" },
	{ key: "dyes", label: "Dyes & Chemicals" },
];

const DEFAULT_FILTERS = {
	industries: ["Any", "Apparel", "Textile", "Accessories", "Home Textiles"],
	incoterms: ["FOB", "CIF", "EXW", "CFR", "DAP", "DDP"],
	companyTypes: ["Factory", "Trading Company", "Agent", "Buying House"],
	exportMarkets: ["EU", "USA", "Canada", "UK", "Japan", "Middle East"],
	certifications: ["ISO 9001", "SA8000", "BSCI", "WRAP", "OEKO-TEX", "GOTS"],
	paymentTerms: ["LC", "TT", "DP", "Advance", "Credit 30 days"],
	customization: ["OEM", "ODM", "Private Label", "Design Service", "Sample Making"],
	currencies: ["USD", "EUR", "GBP", "BDT", "INR"],
	locations: [
		{ name: "Dhaka, Bangladesh", lat: 23.8103, lng: 90.4125 },
		{ name: "Chattogram, Bangladesh", lat: 22.3569, lng: 91.7832 },
		{ name: "Hanoi, Vietnam", lat: 21.0278, lng: 105.8342 },
		{ name: "Istanbul, Turkey", lat: 41.0082, lng: 28.9784 },
		{ name: "Lahore, Pakistan", lat: 31.5204, lng: 74.3587 },
		{ name: "Karachi, Pakistan", lat: 24.8607, lng: 67.0011 },
		{ name: "Guangzhou, China", lat: 23.1291, lng: 113.2644 },
		{ name: "Delhi, India", lat: 28.6139, lng: 77.209 },
	],
};

function fmtNumber(n) {
	return new Intl.NumberFormat().format(n);
}

const initialFilters = {
	industry: "Any",
	moqBucket: "Any",
	moqMin: 0,
	moqMax: 5000,
	currency: "USD",
	priceMin: 0,
	priceMax: 100_000,
	incoterms: ["FOB"],
	companyType: [],
	productionMin: 0,
	productionMax: 500_000,
	workersMin: 0,
	workersMax: 5000,
	exportMarkets: [],
	roles: [],
	location: "",
	locationCoords: null,
	colorPants: [],
	customization: [],
	sampleAvailable: false,
	sampleLeadTime: 30,
	certifications: [],
	auditDate: "",
	paymentTerms: [],
	country: "",
	verifiedOnly: false,
	requestType: "all",
	allCategories: true,
	selectedCategories: [],
	season: "Any season",
	machinery: "",
	stockStatus: "",
	minRating: "",
	language: "",
	postedAfter: "",
	postedBefore: "",
	distanceKm: "",
};

function highlightText(text, query) {
	if (!(text && query?.trim())) {
		return text;
	}
	const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const safe = DOMPurify.sanitize(text, { ALLOWED_TAGS: [] });
	return safe.replace(
		new RegExp(`(${escaped})`, "gi"),
		'<strong className="text-sky-600 dark:text-sky-400">$1</strong>',
	);
}

function pillClass(active) {
	return active
		? "bg-sky-600 text-white shadow-lg shadow-sky-500/20 border-sky-500/30"
		: "bg-white/70 dark:bg-slate-900/60 border-slate-200/70 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:border-sky-300 dark:hover:border-sky-700";
}

function SectionCard({ title, icon: Icon, children, className = "" }) {
	return (
		<div
			className={`rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-950/60 backdrop-blur-xl shadow-[0_20px_60px_-30px_rgba(15,23,42,0.35)] ${className}`}
		>
			<div className="flex items-center gap-3 border-b border-slate-200/70 dark:border-slate-800 px-5 py-4">
				<div className="rounded-2xl bg-sky-500/10 text-sky-600 dark:text-sky-400 p-2">
					<Icon className="h-4 w-4" />
				</div>
				<h3 className="font-semibold text-slate-900 dark:text-white">{title}</h3>
			</div>
			<div className="p-5">{children}</div>
		</div>
	);
}

function PlanGate({ premium, children }) {
	if (premium) {
		return children;
	}
	return (
		<div className="group relative">
			<div className="pointer-events-none opacity-40 blur-[0.5px]">{children}</div>
			<div className="invisible group-hover:visible absolute inset-0 flex items-center justify-center">
				<div className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-lg shadow-sky-500/25">
					<Crown className="h-3.5 w-3.5" /> Premium feature
				</div>
			</div>
		</div>
	);
}

function Badge({ children, tone = "default" }) {
	const tones = {
		default: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
		blue: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
		green: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
		amber: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
		red: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
		violet: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
	};
	return (
		<span
			className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${tones[tone]}`}
		>
			{children}
		</span>
	);
}

function ToastStack({ toasts, onDismiss }) {
	return (
		<div className="fixed right-4 top-4 z-50 flex w-[min(100vw-2rem,420px)] flex-col gap-3 pointer-events-none">
			{toasts.map((t) => (
				<div
					key={t.id}
					className="pointer-events-auto rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-950/90 backdrop-blur-xl p-4 shadow-xl"
				>
					<div className="flex items-start gap-3">
						<div
							className={`mt-0.5 rounded-xl p-2 ${t.kind === "error" ? "bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-300" : "bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300"}`}
						>
							{t.kind === "error" ? <X className="h-4 w-4" /> : <Check className="h-4 w-4" />}
						</div>
						<div className="flex-1">
							<p className="font-medium text-slate-900 dark:text-white">{t.title}</p>
							<p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{t.message}</p>
						</div>
						<button
							onClick={() => onDismiss(t.id)}
							className="rounded-xl p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
						>
							<X className="h-4 w-4" />
						</button>
					</div>
				</div>
			))}
		</div>
	);
}

function SearchModal({ open, searchInputRef, query, onQueryChange, onClose, executeSearchRef }) {
	if (!open) {
		return null;
	}
	const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform);
	return (
		<div className="fixed inset-0 z-40 flex items-start justify-center bg-slate-950/40 px-4 pt-24 backdrop-blur-sm">
			<div className="w-full max-w-2xl overflow-hidden rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-2xl">
				<div className="flex items-center gap-3 border-b border-slate-200/70 dark:border-slate-800 p-4">
					<Search className="h-5 w-5 text-sky-500" />
					<input
						ref={searchInputRef}
						value={query}
						onChange={(e) => onQueryChange(e.target.value)}
						placeholder="Search requests, factories, products..."
						className="w-full bg-transparent text-slate-900 dark:text-white outline-none placeholder:text-slate-400"
					/>
					<span className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-2.5 py-1 text-xs text-slate-500">
						{isMac ? "\u2318K" : "Ctrl K"}
					</span>
				</div>
				<div className="grid gap-3 p-4 sm:grid-cols-2">
					{["Buyer requests", "Factories", "Products", "Verified suppliers"].map((item) => (
						<button
							key={item}
							onClick={() => {
								onQueryChange(item);
								onClose();
								executeSearchRef.current?.();
							}}
							className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/60 p-4 text-left hover:border-sky-300 dark:hover:border-sky-700"
						>
							<div className="text-sm font-medium text-slate-900 dark:text-white">{item}</div>
							<div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
								Jump straight to this search theme.
							</div>
						</button>
					))}
				</div>
			</div>
		</div>
	);
}

function ResultTabs({ estimatedCounts, activeTab, onTabChange }) {
	return (
		<div className="inline-flex gap-1 overflow-x-auto scrollbar-invisible rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-950/60 p-1 shadow-sm">
			{[
				{ key: "all", label: `All (${estimatedCounts.total})` },
				{
					key: "requests",
					label: `Buyer Requests (${estimatedCounts.buyerRequests})`,
				},
				{ key: "companies", label: `Companies (${estimatedCounts.companies})` },
				{ key: "feed", label: `Feed Posts (${estimatedCounts.feedPosts})` },
				{ key: "users", label: `Users (${estimatedCounts.users})` },
			].map((tab) => (
				<button
					key={tab.key}
					onClick={() => onTabChange(tab.key)}
					className={`whitespace-nowrap rounded-xl px-3 py-2 text-xs font-medium transition sm:px-4 sm:text-sm ${activeTab === tab.key ? "bg-sky-600 text-white shadow-lg shadow-sky-500/20" : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"}`}
				>
					{tab.label}
				</button>
			))}
		</div>
	);
}

function ResultCards({
	totalResults,
	query,
	loading,
	trendingSearches,
	activeTab,
	filteredRequests,
	filteredCompanies,
	filteredFeedPosts,
	filteredUsers,
	setFilters,
	setQuery,
	toggleShortlist,
	isShortlisted,
	highlightText,
	saveSearch,
	fmtNumber,
}) {
	if (totalResults === 0 && query && !loading) {
		return (
			<div className="space-y-4">
				<div className="rounded-3xl border border-slate-200/80 dark:border-slate-800 p-6 text-center">
					<p className="text-lg font-medium">No results for &ldquo;{query}&rdquo;</p>
					<p className="mt-1 text-sm text-slate-500">Try these categories instead:</p>
					<div className="mt-4 flex flex-wrap justify-center gap-2">
						{["Fabrics", "Yarn", "Garments", "Accessories", "Home Textile"].map((cat) => (
							<button
								key={cat}
								onClick={() =>
									setFilters((f) => ({
										...f,
										selectedCategories: [cat],
										allCategories: false,
									}))
								}
								className="rounded-full border border-slate-200/80 dark:border-slate-700 px-4 py-2 text-sm hover:bg-sky-50 dark:hover:bg-sky-500/10"
							>
								{cat}
							</button>
						))}
					</div>
					{trendingSearches.length > 0 && (
						<>
							<p className="mt-6 text-sm text-slate-500">Trending searches:</p>
							<div className="mt-2 flex flex-wrap justify-center gap-2">
								{trendingSearches.slice(0, 5).map((t) => (
									<button
										key={t}
										onClick={() => setQuery(t)}
										className="rounded-full bg-slate-100 px-4 py-2 text-sm hover:bg-slate-200 dark:bg-slate-800"
									>
										{t}
									</button>
								))}
							</div>
						</>
					)}
				</div>
			</div>
		);
	}
	if (activeTab === "requests") {
		const items = filteredRequests;
		if (items.length === 0 && !loading) {
			return (
				<div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
					<PackageSearch className="h-12 w-12 text-slate-300 dark:text-slate-600" />
					<p className="text-lg font-medium text-slate-900 dark:text-white">
						No buyer requests found
					</p>
					<p className="text-sm text-slate-500 dark:text-slate-400">Try adjusting your filters</p>
					{query && (
						<div className="mt-2 rounded-2xl bg-gtBlue/10 p-4 ring-1 ring-gtBlue/20 dark:bg-gtBlue/5">
							<p className="text-sm font-semibold text-gtBlue dark:text-sky-300">
								Similar Requests Alert
							</p>
							<p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
								Be the first to know when buyers post matching requests. Save a search alert now.
							</p>
							<button
								onClick={() => saveSearch?.()}
								className="mt-2 rounded-full bg-gtBlue px-4 py-2 text-xs font-semibold text-white hover:bg-gtBlueHover"
							>
								Save Alert
							</button>
						</div>
					)}
				</div>
			);
		}
		return (
			<div className="space-y-4">
				<AnimatePresence mode="popLayout">
					<MasonryGrid columnCount={2} gap={4}>
						{items.map((item) => (
							<motion.article
								key={item.id}
								layout={true}
								initial={{ opacity: 0, scale: 0.95 }}
								animate={{ opacity: 1, scale: 1 }}
								exit={{ opacity: 0, scale: 0.95 }}
								className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-950/60 p-5 shadow-[0_18px_50px_-30px_rgba(15,23,42,0.35)]"
							>
								<div className="flex items-start justify-between gap-3">
									<div className="flex items-start gap-2">
										<button
											onClick={() => toggleShortlist(item.id, "buyer")}
											className={`mt-1 shrink-0 rounded-lg border p-1.5 ${isShortlisted(item.id, "buyer") ? "border-sky-400 bg-sky-50 text-sky-600 dark:bg-sky-500/10" : "border-slate-200 dark:border-slate-700 text-slate-300 dark:text-slate-600"} hover:border-sky-300`}
										>
											<ArrowLeftRight className="h-3.5 w-3.5" />
										</button>
										<Link
											to={`/buyer/${item.buyer_id}`}
											className="text-lg font-semibold text-slate-900 hover:text-sky-600 dark:text-white dark:hover:text-sky-400"
											dangerouslySetInnerHTML={{
												__html: highlightText(item.title || item.name || "Untitled Request", query),
											}}
										/>
										<div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
											<span>{item.location || item.country || "N/A"}</span>
											{item.category && (
												<>
													<span>&bull;</span>
													<span
														dangerouslySetInnerHTML={{
															__html: highlightText(item.category, query),
														}}
													/>
												</>
											)}
										</div>
									</div>
									<div className="flex flex-wrap justify-end gap-2">
										{item.status === "verified" && <Badge tone="green">verified</Badge>}
										{item.isPriority && <Badge tone="violet">priority</Badge>}
										{item.status === "active" && <Badge tone="blue">active</Badge>}
									</div>
								</div>

								{(item.gender || item.season || item.material) && (
									<div className="mt-4 flex flex-wrap gap-2">
										{item.gender && <Badge tone="default">Gender: {item.gender}</Badge>}
										{item.season && <Badge tone="default">Season: {item.season}</Badge>}
										{item.material && <Badge tone="default">Material: {item.material}</Badge>}
										{item.quoteDate && <Badge tone="amber">Quote by {item.quoteDate}</Badge>}
										{item.expiryDate && <Badge tone="red">Expires {item.expiryDate}</Badge>}
										{item.maxSuppliers && (
											<Badge tone="default">Max suppliers: {item.maxSuppliers}</Badge>
										)}
									</div>
								)}

								{item.description && (
									<p
										className="mt-4 line-clamp-3 text-sm leading-6 text-slate-600 dark:text-slate-300"
										dangerouslySetInnerHTML={{
											__html: highlightText(item.description, query),
										}}
									/>
								)}

								{(item.quantity || item.targetPrice) && (
									<div className="mt-4 grid gap-3 sm:grid-cols-3">
										{item.quantity && (
											<div className="rounded-2xl bg-slate-50 dark:bg-slate-900/70 p-3">
												<div className="text-xs text-slate-500 dark:text-slate-400">Quantity</div>
												<div className="mt-1 font-semibold text-slate-900 dark:text-white">
													{item.quantity}
												</div>
											</div>
										)}
										{item.targetPrice && (
											<div className="rounded-2xl bg-slate-50 dark:bg-slate-900/70 p-3">
												<div className="text-xs text-slate-500 dark:text-slate-400">
													Target price
												</div>
												<div className="mt-1 font-semibold text-slate-900 dark:text-white">
													{item.targetPrice}
												</div>
											</div>
										)}
										<div className="rounded-2xl bg-slate-50 dark:bg-slate-900/70 p-3">
											<div className="text-xs text-slate-500 dark:text-slate-400">Discussion</div>
											<div className="mt-1 font-semibold text-slate-900 dark:text-white">
												{item.discussions?.length > 0 ? "Active" : "None"}
											</div>
										</div>
									</div>
								)}

								<div className="mt-5 flex flex-wrap gap-2">
									<button className="inline-flex items-center gap-2 rounded-2xl bg-sky-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-sky-500/20 hover:bg-sky-500">
										<Eye className="h-4 w-4" /> Quick View
									</button>
									<button className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:border-sky-300 dark:hover:border-sky-700">
										<Share2 className="h-4 w-4" /> Share
									</button>
									<button className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:border-sky-300 dark:hover:border-sky-700">
										<MessageSquareMore className="h-4 w-4" /> Discuss
									</button>
								</div>
							</motion.article>
						))}
					</MasonryGrid>
				</AnimatePresence>
			</div>
		);
	}

	if (activeTab === "all") {
		const hasAny =
			filteredRequests.length > 0 ||
			filteredCompanies.length > 0 ||
			filteredFeedPosts.length > 0 ||
			filteredUsers.length > 0;
		if (!(hasAny || loading)) {
			return (
				<div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
					<SearchX className="h-12 w-12 text-slate-300 dark:text-slate-600" />
					<p className="text-lg font-medium text-slate-900 dark:text-white">No results found</p>
					<p className="text-sm text-slate-500 dark:text-slate-400">
						Try adjusting your search or filters
					</p>
				</div>
			);
		}
		return (
			<div className="space-y-8">
				{filteredRequests.length > 0 && (
					<section>
						<h3 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">
							Buyer Requests ({filteredRequests.length})
						</h3>
						<AnimatePresence mode="popLayout">
							<MasonryGrid columnCount={2} gap={4}>
								{filteredRequests.map((item) => (
									<motion.article
										key={item.id}
										layout={true}
										initial={{ opacity: 0, scale: 0.95 }}
										animate={{ opacity: 1, scale: 1 }}
										exit={{ opacity: 0, scale: 0.95 }}
										className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-950/60 p-5 shadow-[0_18px_50px_-30px_rgba(15,23,42,0.35)]"
									>
										<div className="flex items-start justify-between gap-3">
											<div className="flex items-start gap-2">
												<button
													onClick={() => toggleShortlist(item.id, "buyer")}
													className={`mt-1 shrink-0 rounded-lg border p-1.5 ${isShortlisted(item.id, "buyer") ? "border-sky-400 bg-sky-50 text-sky-600 dark:bg-sky-500/10" : "border-slate-200 dark:border-slate-700 text-slate-300 dark:text-slate-600"} hover:border-sky-300`}
												>
													<ArrowLeftRight className="h-3.5 w-3.5" />
												</button>
												<Link
													to={`/buyer/${item.buyer_id}`}
													className="text-lg font-semibold text-slate-900 hover:text-sky-600 dark:text-white dark:hover:text-sky-400"
													dangerouslySetInnerHTML={{
														__html: highlightText(
															item.title || item.name || "Untitled Request",
															query,
														),
													}}
												/>
												<div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
													<span>{item.location || item.country || "N/A"}</span>
													{item.category && (
														<>
															<span>&bull;</span>
															<span
																dangerouslySetInnerHTML={{
																	__html: highlightText(item.category, query),
																}}
															/>
														</>
													)}
												</div>
											</div>
										</div>
										{item.description && (
											<p
												className="mt-4 line-clamp-2 text-sm leading-6 text-slate-600 dark:text-slate-300"
												dangerouslySetInnerHTML={{
													__html: highlightText(item.description, query),
												}}
											/>
										)}
									</motion.article>
								))}
							</MasonryGrid>
						</AnimatePresence>
					</section>
				)}

				{filteredCompanies.length > 0 && (
					<section>
						<h3 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">
							Companies ({filteredCompanies.length})
						</h3>
						<MasonryGrid columnCount={2} gap={4}>
							{filteredCompanies.map((item) => (
								<motion.article
									key={item.id}
									initial={{ opacity: 0, scale: 0.95 }}
									animate={{ opacity: 1, scale: 1 }}
									className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-950/60 p-5"
								>
									<div className="flex items-start gap-2">
										<Link
											to={`/factory/${item.company_id}`}
											className="text-lg font-semibold text-slate-900 hover:text-sky-600 dark:text-white dark:hover:text-sky-400"
											dangerouslySetInnerHTML={{
												__html: highlightText(item.name || item.title || "Untitled Company", query),
											}}
										/>
										<div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
											<span>{item.location || item.country || "N/A"}</span>
										</div>
									</div>
								</motion.article>
							))}
						</MasonryGrid>
					</section>
				)}

				{filteredFeedPosts.length > 0 && (
					<section>
						<h3 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">
							Feed Posts ({filteredFeedPosts.length})
						</h3>
						<MasonryGrid columnCount={2} gap={4}>
							{filteredFeedPosts.map((item) => (
								<motion.article
									key={item.id}
									initial={{ opacity: 0, scale: 0.95 }}
									animate={{ opacity: 1, scale: 1 }}
									className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-950/60 p-5"
								>
									<div
										className="text-lg font-semibold text-slate-900 dark:text-white"
										dangerouslySetInnerHTML={{
											__html: highlightText(item.title || "Untitled Post", query),
										}}
									/>
									<div className="mt-2 flex flex-wrap gap-2">
										{item.category && <Badge tone="default">{item.category}</Badge>}
										{item.type && <Badge tone="default">{item.type}</Badge>}
									</div>
									{item.caption && (
										<p
											className="mt-3 text-sm text-slate-600 dark:text-slate-300"
											dangerouslySetInnerHTML={{
												__html: highlightText(item.caption, query),
											}}
										/>
									)}
									<div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
										<UserSearch className="h-3 w-3" /> {item.author?.name || "Unknown"}
										<Clock className="h-3 w-3" />{" "}
										{item.created_at ? new Date(item.created_at).toLocaleDateString() : ""}
									</div>
								</motion.article>
							))}
						</MasonryGrid>
					</section>
				)}

				{filteredUsers.length > 0 && (
					<section>
						<h3 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">
							Users ({filteredUsers.length})
						</h3>
						<MasonryGrid columnCount={2} gap={4}>
							{filteredUsers.map((item) => (
								<motion.article
									key={item.id}
									initial={{ opacity: 0, scale: 0.95 }}
									animate={{ opacity: 1, scale: 1 }}
									className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-950/60 p-5"
								>
									<div className="flex items-start gap-3">
										<div className="h-10 w-10 rounded-full bg-slate-200 dark:bg-slate-700" />
										<div>
											<Link
												to={`/user/${item.id}`}
												className="text-lg font-semibold text-slate-900 hover:text-sky-600 dark:text-white dark:hover:text-sky-400"
												dangerouslySetInnerHTML={{
													__html: highlightText(item.name || "Untitled User", query),
												}}
											/>
											<div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
												{item.role || "Member"}
											</div>
										</div>
									</div>
									<div className="mt-3 flex flex-wrap gap-2">
										{item.verified && <Badge tone="green">verified</Badge>}
										{item.country && <span>{item.country}</span>}
										{item.company && <span className="truncate">{item.company}</span>}
									</div>
								</motion.article>
							))}
						</MasonryGrid>
					</section>
				)}
			</div>
		);
	}

	if (activeTab === "companies") {
		const items = filteredCompanies;
		if (items.length === 0 && !loading) {
			return (
				<div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
					<Factory className="h-12 w-12 text-slate-300 dark:text-slate-600" />
					<p className="text-lg font-medium text-slate-900 dark:text-white">No companies found</p>
					<p className="text-sm text-slate-500 dark:text-slate-400">Try adjusting your filters</p>
				</div>
			);
		}
		return (
			<div className="space-y-4">
				<AnimatePresence mode="popLayout">
					<MasonryGrid columnCount={2} gap={4}>
						{items.map((item) => (
							<motion.article
								key={item.id}
								layout={true}
								initial={{ opacity: 0, scale: 0.95 }}
								animate={{ opacity: 1, scale: 1 }}
								exit={{ opacity: 0, scale: 0.95 }}
								className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-950/60 p-5 shadow-[0_18px_50px_-30px_rgba(15,23,42,0.35)]"
							>
								<div className="flex items-start gap-2">
									<button
										onClick={() => toggleShortlist(item.id, "company")}
										className={`mt-1 shrink-0 rounded-lg border p-1.5 ${isShortlisted(item.id, "company") ? "border-sky-400 bg-sky-50 text-sky-600 dark:bg-sky-500/10" : "border-slate-200 dark:border-slate-700 text-slate-300 dark:text-slate-600"} hover:border-sky-300`}
									>
										<ArrowLeftRight className="h-3.5 w-3.5" />
									</button>
									<div>
										<Link
											to={`/factory/${item.company_id}`}
											className="text-lg font-semibold text-slate-900 hover:text-sky-600 dark:text-white dark:hover:text-sky-400"
											dangerouslySetInnerHTML={{
												__html: highlightText(item.name || item.title || "Untitled Company", query),
											}}
										/>
										<div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
											{item.type && (
												<span
													dangerouslySetInnerHTML={{
														__html: highlightText(item.type, query),
													}}
												/>
											)}
										</div>
									</div>
								</div>
							</motion.article>
						))}
					</MasonryGrid>
				</AnimatePresence>
			</div>
		);
	}

	if (activeTab === "feed") {
		const items = filteredFeedPosts;
		if (items.length === 0 && !loading) {
			return (
				<div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
					<FileText className="h-12 w-12 text-slate-300 dark:text-slate-600" />
					<p className="text-lg font-medium text-slate-900 dark:text-white">No feed posts found</p>
					<p className="text-sm text-slate-500 dark:text-slate-400">Try adjusting your filters</p>
				</div>
			);
		}
		return (
			<div className="space-y-4">
				<AnimatePresence mode="popLayout">
					<MasonryGrid columnCount={2} gap={4}>
						{items.map((item) => (
							<motion.article
								key={item.id}
								layout={true}
								initial={{ opacity: 0, scale: 0.95 }}
								animate={{ opacity: 1, scale: 1 }}
								exit={{ opacity: 0, scale: 0.95 }}
								className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-950/60 p-5"
							>
								<div
									className="text-lg font-semibold text-slate-900 dark:text-white"
									dangerouslySetInnerHTML={{
										__html: highlightText(item.title || "Untitled Post", query),
									}}
								/>
								<div className="mt-2 flex flex-wrap gap-2">
									{item.category && <Badge tone="default">{item.category}</Badge>}
									{item.type && <Badge tone="default">{item.type}</Badge>}
								</div>
								{item.caption && (
									<p
										className="mt-3 text-sm text-slate-600 dark:text-slate-300"
										dangerouslySetInnerHTML={{
											__html: highlightText(item.caption, query),
										}}
									/>
								)}
								<div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
									<UserSearch className="h-3 w-3" /> {item.author?.name || "Unknown"}
									<Clock className="h-3 w-3" />{" "}
									{item.created_at ? new Date(item.created_at).toLocaleDateString() : ""}
								</div>
							</motion.article>
						))}
					</MasonryGrid>
				</AnimatePresence>
			</div>
		);
	}

	if (activeTab === "users") {
		const items = filteredUsers;
		if (items.length === 0 && !loading) {
			return (
				<div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
					<UserSearch className="h-12 w-12 text-slate-300 dark:text-slate-600" />
					<p className="text-lg font-medium text-slate-900 dark:text-white">No users found</p>
					<p className="text-sm text-slate-500 dark:text-slate-400">Try adjusting your filters</p>
				</div>
			);
		}
		return (
			<div className="space-y-4">
				<AnimatePresence mode="popLayout">
					<MasonryGrid columnCount={2} gap={4}>
						{items.map((item) => (
							<motion.article
								key={item.id}
								layout={true}
								initial={{ opacity: 0, scale: 0.95 }}
								animate={{ opacity: 1, scale: 1 }}
								exit={{ opacity: 0, scale: 0.95 }}
								className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-950/60 p-5 shadow-[0_18px_50px_-30px_rgba(15,23,42,0.35)]"
							>
								<div className="flex items-start gap-3">
									<div className="h-10 w-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-sm font-semibold text-slate-500 dark:text-slate-300">
										{(item.name || "U").charAt(0).toUpperCase()}
									</div>
									<div>
										<Link
											to={`/user/${item.id}`}
											className="text-lg font-semibold text-slate-900 hover:text-sky-600 dark:text-white dark:hover:text-sky-400"
											dangerouslySetInnerHTML={{
												__html: highlightText(item.name || "Untitled User", query),
											}}
										/>
										<div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
											{item.role || "Member"}
										</div>
									</div>
								</div>
								<div className="mt-3 flex flex-wrap gap-2">
									{item.verified && <Badge tone="green">verified</Badge>}
									{item.country && <span>{item.country}</span>}
									{item.company && <span className="truncate">{item.company}</span>}
								</div>
							</motion.article>
						))}
					</MasonryGrid>
				</AnimatePresence>
			</div>
		);
	}

	return null;
}

function MapPreview({ selectedLocation, filtersLocation }) {
	return (
		<div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-gradient-to-br from-sky-50 to-slate-100 dark:from-slate-900 dark:to-slate-950">
			<div className="flex items-center justify-between border-b border-slate-200/70 dark:border-slate-800 px-4 py-3">
				<div className="flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-white">
					<MapPinned className="h-4 w-4 text-sky-500" />
					Map preview
				</div>
				<span className="text-xs text-slate-500 dark:text-slate-400">
					OpenStreetMap / Leaflet ready
				</span>
			</div>
			<div className="relative h-44 overflow-hidden">
				<div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(51,122,176,0.18),transparent_25%),radial-gradient(circle_at_80%_30%,rgba(55,115,168,0.16),transparent_22%),linear-gradient(135deg,rgba(255,255,255,0.2),rgba(255,255,255,0.02))]" />
				<div className="absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(15,23,42,.18)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,.18)_1px,transparent_1px)] [background-size:24px_24px]" />
				<div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center">
					<div className="rounded-full bg-sky-600 p-3 text-white shadow-lg shadow-sky-500/30">
						<MapPinned className="h-5 w-5" />
					</div>
					<div className="mt-2 rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-slate-700 shadow-sm dark:bg-slate-900/90 dark:text-slate-200">
						{selectedLocation?.name || filtersLocation || "No location selected"}
					</div>
				</div>
			</div>
		</div>
	);
}

export default function SearchResults() {
	usePageMeta({
		title: "Search — GarTexHub",
		description:
			"Search GarTexHub for textile products, buyer requests, companies, and suppliers across the global textile marketplace.",
		url: "/search",
		robots: "noindex,nofollow",
	});

	const [, setSearchParams] = useSearchParams();
	const token = useMemo(() => getToken(), []);
	const currentUser = useMemo(() => getCurrentUser(), []);
	const isPremium = String(currentUser?.subscription_status || "").toLowerCase() === "premium";

	const { theme, toggleTheme } = useTheme();
	const dark = theme === "dark";
	const [query, setQuery] = useState("");
	const isFirstRender = useRef(true);
	const debounceTimer = useRef(null);
	useEffect(() => {
		if (isFirstRender.current) {
			isFirstRender.current = false;
			return;
		}
		if (!query.trim()) {
			return;
		}
		if (debounceTimer.current) {
			clearTimeout(debounceTimer.current);
		}
		debounceTimer.current = setTimeout(() => {
			executeSearchRef.current?.();
		}, 350);
		return () => {
			if (debounceTimer.current) {
				clearTimeout(debounceTimer.current);
			}
		};
	}, [query]);
	const [filtersOpen, setFiltersOpen] = useState(false);
	const [loading, setLoading] = useState(false);
	const [activeTab, setActiveTab] = useState("all");
	const [viewMode, setViewMode] = useState("all");
	useEffect(() => {
		if (filtersOpen && filterPanelRef.current) {
			setTimeout(() => {
				filterPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
			}, 100);
		}
	}, [filtersOpen]);
	useEffect(() => {
		// eslint-disable-next-line react-hooks/set-state-in-effect
		if (viewMode === "requests") {
			setActiveTab("requests");
		} else if (viewMode === "companies") {
			setActiveTab("companies");
		} else {
			setActiveTab("all");
		}
	}, [viewMode]);
	const [searchFocused, setSearchFocused] = useState(false);
	const [filters, setFilters] = useState(initialFilters);
	const [locationSuggestions, setLocationSuggestions] = useState([]);
	const [roleSeatText, setRoleSeatText] = useState("");
	const [colorText, setColorText] = useState("PMS 185C");
	const [searchModalOpen, setSearchModalOpen] = useState(false);
	const [alertsQuota, setAlertsQuota] = useState(null);
	const [sortBy, setSortBy] = useState("relevance");
	const [cursor, setCursor] = useState(0);
	const [nextCursor, setNextCursor] = useState(null);
	const [totalResults, setTotalResults] = useState(0);
	const [loadingMore, setLoadingMore] = useState(false);
	const [suggestions, setSuggestions] = useState([]);
	const [suggestionsOpen, setSuggestionsOpen] = useState(false);
	const [refineQuery, setRefineQuery] = useState("");
	const [searchField, setSearchField] = useState("all");
	const [imageSearchFile, setImageSearchFile] = useState(null);
	const [imagePreview, setImagePreview] = useState(null);
	const [searchImageUploadProgress, setSearchImageUploadProgress] = useState(0);
	const [shortlist, setShortlist] = useState([]);
	const [exportingCsv, setExportingCsv] = useState(false);
	const [showShortlist, setShowShortlist] = useState(false);
	const [trendingSearches, setTrendingSearches] = useState([]);
	const [relatedSearches, setRelatedSearches] = useState([]);
	const [facetCounts, setFacetCounts] = useState({
		countries: [],
		categories: [],
	});
	const [analytics, setAnalytics] = useState(null);
	const [batchOpen, setBatchOpen] = useState(false);
	const [batchTerms, setBatchTerms] = useState("");
	const [batchResults, setBatchResults] = useState(null);
	const [history, setHistory] = useState(() => {
		try {
			return JSON.parse(localStorage.getItem("search_history") || "[]");
		} catch {
			return [];
		}
	});
	const [spellingSuggestion, setSpellingSuggestion] = useState(null);
	const [savedSearchAlerts, setSavedSearchAlerts] = useState([]);
	const [toasts, setToasts] = useState([]);
	const [recentViews, setRecentViews] = useState([]);
	const [expandedMore, setExpandedMore] = useState(false);
	const [estimatedCounts, setEstimatedCounts] = useState({
		buyerRequests: 0,
		companies: 0,
		feedPosts: 0,
		users: 0,
		total: 0,
	});
	const [selectedLocation, setSelectedLocation] = useState(null);
	const [requests, setRequests] = useState([]);
	const [companies, setCompanies] = useState([]);
	const [feedPosts, setFeedPosts] = useState([]);
	const [users, setUsers] = useState([]);
	// Recent views, the alert quota and the filter options all have usable
	// defaults, so the page no longer hides behind a full-screen spinner until
	// all three have answered; each fills in when it arrives.
	const [pageLoading, setPageLoading] = useState(false);
	const pageLoadCountRef = useRef(0);
	const [filterOptions, setFilterOptions] = useState({
		industries: DEFAULT_FILTERS.industries,
		incoterms: DEFAULT_FILTERS.incoterms,
		companyTypes: DEFAULT_FILTERS.companyTypes,
		exportMarkets: DEFAULT_FILTERS.exportMarkets,
		certifications: DEFAULT_FILTERS.certifications,
		paymentTerms: DEFAULT_FILTERS.paymentTerms,
		customization: DEFAULT_FILTERS.customization,
		currencies: DEFAULT_FILTERS.currencies,
		locations: DEFAULT_FILTERS.locations,
	});
	const locationInputRef = useRef(null);
	const searchInputRef = useRef(null);
	const locationDebounceRef = useRef(null);
	const executeSearchRef = useRef(null);

	const renderedDefaultCoreFilterKeys = useMemo(() => [...DEFAULT_CORE_FILTER_KEYS], []);
	validateCoreFilterRenderKeys(renderedDefaultCoreFilterKeys);

	const INDUSTRIES = filterOptions.industries;
	const INCOTERMS = filterOptions.incoterms;
	const COMPANY_TYPES = filterOptions.companyTypes;
	const EXPORT_MARKETS = filterOptions.exportMarkets;
	const CERTIFICATIONS = filterOptions.certifications;
	const PAYMENT_TERMS = filterOptions.paymentTerms;
	const CUSTOMIZATION = filterOptions.customization;
	const CURRENCIES = filterOptions.currencies;
	const SAMPLE_LOCATIONS = filterOptions.locations;

	useEffect(() => {
		const params = new URLSearchParams(window.location.search);
		const q = params.get("q");
		if (q) {
			// eslint-disable-next-line react-hooks/set-state-in-effect
			setQuery(q);
		}
		if (q) {
			setTimeout(() => executeSearchRef.current?.(), 100);
		}
		const sortParam = params.get("sort");
		if (sortParam) {
			setSortBy(sortParam);
		}
		const cursorParam = params.get("cursor");
		if (cursorParam) {
			setCursor(Number(cursorParam));
		}
		const country = params.get("country");
		if (country) {
			setFilters((f) => ({ ...f, country }));
		}
		const season = params.get("season");
		if (season) {
			setFilters((f) => ({ ...f, season }));
		}
		const machinery = params.get("machinery");
		if (machinery) {
			setFilters((f) => ({ ...f, machinery }));
		}
		const stockStatus = params.get("stockStatus");
		if (stockStatus) {
			setFilters((f) => ({ ...f, stockStatus }));
		}
		const minRating = params.get("minRating");
		if (minRating) {
			setFilters((f) => ({ ...f, minRating }));
		}
		const language = params.get("language");
		if (language) {
			setFilters((f) => ({ ...f, language }));
		}
		const field = params.get("field");
		if (field) {
			setSearchField(field);
		}
		const verifiedOnly = params.get("verifiedOnly");
		if (verifiedOnly === "true") {
			setFilters((f) => ({ ...f, verifiedOnly: true }));
		}
	}, []);

	const suggestionDebounce = useRef(null);
	const filterPanelRef = useRef(null);
	useEffect(() => {
		if (suggestionDebounce.current) {
			clearTimeout(suggestionDebounce.current);
		}
		if (!query.trim() || query.trim().length < 2) {
			// eslint-disable-next-line react-hooks/set-state-in-effect
			setSuggestions([]);
			setSuggestionsOpen(false);
			return;
		}
		suggestionDebounce.current = setTimeout(async () => {
			try {
				const data = await apiRequest(`/search/suggestions?q=${encodeURIComponent(query.trim())}`, {
					token,
				});
				if (Array.isArray(data?.suggestions) && data.suggestions.length > 0) {
					setSuggestions(data.suggestions);
				} else {
					const filtered = trendingSearches.filter((t) =>
						t.toLowerCase().includes(query.toLowerCase()),
					);
					setSuggestions(filtered.slice(0, 5));
				}
				setSuggestionsOpen(true);
			} catch {
				const filtered = trendingSearches.filter((t) =>
					t.toLowerCase().includes(query.toLowerCase()),
				);
				setSuggestions(filtered.slice(0, 5));
				setSuggestionsOpen(true);
			}
		}, 250);
	}, [query, token, trendingSearches]);

	useEffect(() => {
		const onKeyDown = (e) => {
			const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform);
			const shortcut = (isMac ? e.metaKey : e.ctrlKey) && e.key.toLowerCase() === "k";
			if (shortcut) {
				e.preventDefault();
				setSearchModalOpen((v) => !v);
				setTimeout(() => searchInputRef.current?.focus(), 50);
			}
			if (e.key === "Escape") {
				setSearchModalOpen(false);
			}
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, []);

	useEffect(() => {
		if (!searchModalOpen) {
			return;
		}
		const onKey = (e) => {
			if (e.key === "Enter") {
				e.preventDefault();
				executeSearchRef.current?.();
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [searchModalOpen]);

	useEffect(() => {
		async function fetchRecentViews() {
			try {
				if (!token) {
					return;
				}
				const data = await apiRequest("/products/views/me?limit=5", { token });
				if (Array.isArray(data?.items)) {
					setRecentViews(data.items.slice(0, 5));
				}
			} catch (err) {
				logger.warn("Unable to load recent views", err);
			} finally {
				pageLoadCountRef.current += 1;
				if (pageLoadCountRef.current >= 3) {
					setPageLoading(false);
				}
			}
		}
		fetchRecentViews();
	}, [token]);

	useEffect(() => {
		async function fetchTrending() {
			try {
				if (!token) {
					return;
				}
				const data = await apiRequest("/search/trending", { token });
				if (Array.isArray(data?.trending)) {
					setTrendingSearches(data.trending.slice(0, 8));
				}
			} catch (err) {
				logger.warn("fetchTrending failed:", err);
			}
		}
		fetchTrending();
	}, [token]);

	useEffect(() => {
		async function fetchAnalytics() {
			try {
				if (!token) {
					return;
				}
				const data = await apiRequest("/search/analytics", { token });
				if (data) {
					setAnalytics(data);
				}
			} catch (err) {
				logger.warn("fetchAnalytics failed:", err);
			}
		}
		fetchAnalytics();
	}, [token]);

	useEffect(() => {
		async function fetchQuota() {
			try {
				if (!token) {
					return;
				}
				const data = await apiRequest("/search/alerts/quota", { token });
				if (data?.quota?.remaining !== undefined) {
					setAlertsQuota(Number(data.quota.remaining) || 0);
				} else if (data?.remaining !== undefined) {
					setAlertsQuota(Number(data.remaining) || 0);
				}
			} catch (err) {
				logger.warn("Unable to load quota", err);
			} finally {
				pageLoadCountRef.current += 1;
				if (pageLoadCountRef.current >= 3) {
					setPageLoading(false);
				}
			}
		}
		fetchQuota();
	}, [token]);

	useEffect(() => {
		async function fetchFilterOptions() {
			try {
				if (!token) {
					return;
				}
				const data = await apiRequest("/filters/options", { token });
				if (data) {
					setFilterOptions((prev) => ({
						industries:
							Array.isArray(data.industries) && data.industries.length > 0
								? data.industries
								: prev.industries,
						incoterms:
							Array.isArray(data.incoterms) && data.incoterms.length > 0
								? data.incoterms
								: prev.incoterms,
						companyTypes:
							Array.isArray(data.companyTypes) && data.companyTypes.length > 0
								? data.companyTypes
								: prev.companyTypes,
						exportMarkets:
							Array.isArray(data.exportMarkets) && data.exportMarkets.length > 0
								? data.exportMarkets
								: prev.exportMarkets,
						certifications:
							Array.isArray(data.certifications) && data.certifications.length > 0
								? data.certifications
								: prev.certifications,
						paymentTerms:
							Array.isArray(data.paymentTerms) && data.paymentTerms.length > 0
								? data.paymentTerms
								: prev.paymentTerms,
						customization:
							Array.isArray(data.customization) && data.customization.length > 0
								? data.customization
								: prev.customization,
						currencies:
							Array.isArray(data.currencies) && data.currencies.length > 0
								? data.currencies
								: prev.currencies,
						locations:
							Array.isArray(data.locations) && data.locations.length > 0
								? data.locations
								: prev.locations,
					}));
				}
			} catch (err) {
				logger.warn("Unable to load filter options", err);
			} finally {
				pageLoadCountRef.current += 1;
				if (pageLoadCountRef.current >= 3) {
					setPageLoading(false);
				}
			}
		}
		fetchFilterOptions();
	}, [token]);

	const fetchSavedAlerts = useCallback(async () => {
		try {
			if (!token) {
				return;
			}
			const data = await apiRequest("/search/alerts", { token });
			if (Array.isArray(data?.alerts)) {
				setSavedSearchAlerts(data.alerts);
			}
		} catch (err) {
			logger.warn("fetchSavedAlerts failed:", err);
		}
	}, [token]);

	useEffect(() => {
		// eslint-disable-next-line react-hooks/set-state-in-effect
		fetchSavedAlerts();
	}, [fetchSavedAlerts]);

	const filteredRequests = useMemo(() => {
		if (!refineQuery.trim()) {
			return requests;
		}
		const q = refineQuery.toLowerCase();
		return requests.filter(
			(r) =>
				(r.title || "").toLowerCase().includes(q) ||
				(r.description || "").toLowerCase().includes(q) ||
				(r.category || "").toLowerCase().includes(q) ||
				(r.material || "").toLowerCase().includes(q),
		);
	}, [requests, refineQuery]);

	const filteredCompanies = useMemo(() => {
		if (!refineQuery.trim()) {
			return companies;
		}
		const q = refineQuery.toLowerCase();
		return companies.filter(
			(c) =>
				(c.name || "").toLowerCase().includes(q) ||
				(c.title || "").toLowerCase().includes(q) ||
				(c.description || "").toLowerCase().includes(q) ||
				(c.category || "").toLowerCase().includes(q),
		);
	}, [companies, refineQuery]);

	const isSearchAlreadySaved = useMemo(() => {
		const q = query.trim();
		return savedSearchAlerts.some((alert) => alert.query === q);
	}, [savedSearchAlerts, query]);

	const filteredFeedPosts = useMemo(() => {
		if (!refineQuery.trim()) {
			return feedPosts;
		}
		const q = refineQuery.toLowerCase();
		return feedPosts.filter(
			(p) =>
				(p.title || "").toLowerCase().includes(q) ||
				(p.description_markdown || "").toLowerCase().includes(q) ||
				(p.caption || "").toLowerCase().includes(q),
		);
	}, [feedPosts, refineQuery]);

	const filteredUsers = useMemo(() => {
		if (!refineQuery.trim()) {
			return users;
		}
		const q = refineQuery.toLowerCase();
		return users.filter(
			(u) =>
				(u.name || "").toLowerCase().includes(q) ||
				(u.email || "").toLowerCase().includes(q) ||
				(u.role || "").toLowerCase().includes(q) ||
				(u.company || "").toLowerCase().includes(q) ||
				(u.country || "").toLowerCase().includes(q),
		);
	}, [users, refineQuery]);

	function toggleShortlist(id, type) {
		const key = `${type}:${id}`;
		setShortlist((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
	}

	function isShortlisted(id, type) {
		return shortlist.includes(`${type}:${id}`);
	}

	function exportCSV() {
		// Try server-side enriched export first
		const token = getToken();
		if (token) {
			setExportingCsv(true);
			const ids =
				shortlist.length > 0
					? [
							...filteredRequests.map((r) => `req:${r.id}`),
							...filteredCompanies.map((c) => `prod:${c.id}`),
						]
					: undefined;
			apiRequest("/search/export", {
				method: "POST",
				token,
				body: {
					query: searchParams.get("q") || "",
					type: ids ? "all" : activeTab === 1 ? "requests" : activeTab === 2 ? "companies" : "all",
					ids,
				},
			})
				.then((data) => {
					const rows = Array.isArray(data?.rows) ? data.rows : [];
					if (rows.length === 0) {
						addToast("No data", "No results to export", "info");
						return;
					}
					const headers = Object.keys(rows[0]);
					const t = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
					const csv = [
						headers.join(","),
						...rows.map((row) => headers.map((h) => t(row[h])).join(",")),
					].join("\n");
					const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
					const url = URL.createObjectURL(blob);
					const a = document.createElement("a");
					a.href = url;
					a.download = `search_results_${new Date().toISOString().slice(0, 10)}.csv`;
					a.click();
					URL.revokeObjectURL(url);
					addToast("Exported", `Downloaded ${rows.length} results as CSV`, "success");
				})
				.catch(() => {
					// Fall back to client-side export
					exportCSVLocal();
				})
				.finally(() => setExportingCsv(false));
			return;
		}
		exportCSVLocal();
	}

	function exportCSVLocal() {
		const allItems = [
			...filteredRequests.map((r) => ({
				type: "Buyer Request",
				title: r.title || r.name || "Untitled",
				category: r.category || "",
				country: r.author?.country || r.country || "",
				material: r.material || "",
				moq: r.moq || r.quantity || "",
				price: r.price_range || "",
			})),
			...filteredCompanies.map((c) => ({
				type: "Company",
				title: c.name || c.title || "Untitled",
				category: c.category || "",
				country: c.author?.country || c.country || "",
				material: c.material || "",
				moq: c.moq || "",
				price: c.price_range || "",
			})),
		];
		const headers = Object.keys(allItems[0] || {});
		const csv = [
			headers.join(","),
			...allItems.map((row) =>
				headers.map((h) => `"${String(row[h] || "").replace(/"/g, '""')}"`).join(","),
			),
		].join("\n");
		const blob = new Blob([csv], { type: "text/csv" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `search_results_${new Date().toISOString().slice(0, 10)}.csv`;
		a.click();
		URL.revokeObjectURL(url);
		addToast("Exported", `Downloaded ${allItems.length} results as CSV`, "success");
	}

	function handleImageSearch(e) {
		const file = e.target.files?.[0];
		if (!file) {
			return;
		}
		setImageSearchFile(file);
		const reader = new FileReader();
		reader.onload = (ev) => setImagePreview(ev.target?.result);
		reader.readAsDataURL(file);
		addToast(
			"Image selected",
			`${file.name} ready for visual search. Click search to find similar items.`,
			"success",
		);
	}

	const addToast = useCallback((title, message, kind = "success") => {
		const id = Math.random().toString(36).slice(2, 10);
		setToasts((prev) => [...prev, { id, title, message, kind }]);
		setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3800);
	}, []);

	const removeToast = useCallback((id) => setToasts((prev) => prev.filter((t) => t.id !== id)), []);

	const activeFilterChips = useMemo(() => {
		const chips = [];
		if (query.trim()) {
			chips.push({
				label: `Query: ${query.trim()}`,
				onRemove: () => setQuery(""),
			});
		}
		if (filters.industry !== "Any") {
			chips.push({
				label: `Industry: ${filters.industry}`,
				onRemove: () => setFilters((f) => ({ ...f, industry: "Any" })),
			});
		}
		if (filters.moqBucket !== "Any") {
			chips.push({
				label: `MOQ: ${filters.moqBucket}`,
				onRemove: () =>
					setFilters((f) => ({
						...f,
						moqBucket: "Any",
						moqMin: 0,
						moqMax: 5000,
					})),
			});
		}
		if (filters.location) {
			chips.push({
				label: `Location: ${filters.location}`,
				onRemove: () => setFilters((f) => ({ ...f, location: "", locationCoords: null })),
			});
		}
		if (filters.country) {
			chips.push({
				label: `Country: ${filters.country}`,
				onRemove: () => setFilters((f) => ({ ...f, country: "" })),
			});
		}
		if (filters.verifiedOnly) {
			chips.push({
				label: "Verified only",
				onRemove: () => setFilters((f) => ({ ...f, verifiedOnly: false })),
			});
		}
		filters.companyType.forEach((v) =>
			chips.push({
				label: `Type: ${v}`,
				onRemove: () => toggleArrayFilter("companyType", v),
			}),
		);
		filters.incoterms.forEach((v) =>
			chips.push({
				label: `Incoterm: ${v}`,
				onRemove: () => toggleArrayFilter("incoterms", v),
			}),
		);
		filters.customization.forEach((v) =>
			chips.push({
				label: v,
				onRemove: () => toggleArrayFilter("customization", v),
			}),
		);
		filters.certifications.forEach((v) =>
			chips.push({
				label: v,
				onRemove: () => toggleArrayFilter("certifications", v),
			}),
		);
		filters.paymentTerms.forEach((v) =>
			chips.push({
				label: v,
				onRemove: () => toggleArrayFilter("paymentTerms", v),
			}),
		);
		filters.selectedCategories.forEach((v) =>
			chips.push({
				label: `Category: ${v}`,
				onRemove: () => toggleCategory(v),
			}),
		);
		if (!filters.allCategories) {
			chips.push({
				label: "Filtered categories",
				onRemove: () =>
					setFilters((f) => ({
						...f,
						allCategories: true,
						selectedCategories: [],
					})),
			});
		}
		if (filters.sampleAvailable) {
			chips.push({
				label: "Sample available",
				onRemove: () => setFilters((f) => ({ ...f, sampleAvailable: false })),
			});
		}
		return chips;
	}, [query, filters, toggleCategory, toggleArrayFilter]);

	function toggleArrayFilter(key, value) {
		setFilters((prev) => {
			const arr = prev[key] || [];
			const has = arr.includes(value);
			return {
				...prev,
				[key]: has ? arr.filter((v) => v !== value) : [...arr, value],
			};
		});
	}

	function toggleCategory(value) {
		if (value === "all") {
			setFilters((prev) => ({
				...prev,
				allCategories: true,
				selectedCategories: [],
			}));
			return;
		}
		setFilters((prev) => {
			const exists = prev.selectedCategories.includes(value);
			const next = exists
				? prev.selectedCategories.filter((v) => v !== value)
				: [...prev.selectedCategories, value];
			return {
				...prev,
				allCategories: next.length === 0,
				selectedCategories: next,
			};
		});
	}

	const buildSearchParams = useCallback(
		(cursorVal = 0) => {
			const params = new URLSearchParams();
			if (query.trim()) {
				params.set("q", query.trim());
			}
			if (!filters.allCategories) {
				params.set("category", filters.selectedCategories.join(","));
			}
			if (filters.industry !== "Any") {
				params.set("industry", filters.industry);
			}
			if (filters.country) {
				params.set("country", filters.country);
			}
			if (filters.incoterms.length > 0) {
				params.set("incoterms", filters.incoterms.join(","));
			}
			if (filters.companyType.length > 0) {
				params.set("orgType", filters.companyType.join(","));
			}
			if (filters.location) {
				params.set("location", filters.location);
			}
			if (filters.verifiedOnly) {
				params.set("verifiedOnly", "true");
			}
			if (sortBy !== "relevance") {
				params.set("sort", sortBy);
			}
			if (cursorVal > 0) {
				params.set("cursor", String(cursorVal));
			}
			if (isPremium) {
				if (filters.season && filters.season !== "Any season") {
					params.set("season", filters.season);
				}
				if (filters.machinery) {
					params.set("machinery", filters.machinery);
				}
				if (filters.stockStatus) {
					params.set("stockStatus", filters.stockStatus);
				}
				if (filters.minRating) {
					params.set("minRating", filters.minRating);
				}
				if (filters.language) {
					params.set("language", filters.language);
				}
			} else {
				ADVANCED_FILTER_KEYS.forEach((key) => params.delete(key));
			}
			if (searchField === "buyer") {
				params.set("field", "buyer");
			}
			if (searchField === "company") {
				params.set("field", "company");
			}
			if (filters.postedAfter) {
				params.set("postedAfter", filters.postedAfter);
			}
			if (filters.postedBefore) {
				params.set("postedBefore", filters.postedBefore);
			}
			if (filters.distanceKm) {
				params.set("distanceKm", filters.distanceKm);
			}
			if (filters.locationCoords) {
				params.set("locationLat", filters.locationCoords.lat);
				params.set("locationLng", filters.locationCoords.lng);
			}
			if (filters.certifications?.length > 0) {
				params.set("certifications", filters.certifications.join(","));
			}
			if (filters.roles?.length > 0) {
				params.set("roles", filters.roles.join(","));
			}
			if (filters.colorPants?.length > 0) {
				params.set("color_pantones", filters.colorPants.join(","));
			}
			if (filters.exportMarkets?.length > 0) {
				params.set("export_markets", filters.exportMarkets.join(","));
			}
			if (filters.paymentTerms?.length > 0) {
				params.set("payment_terms", filters.paymentTerms.join(","));
			}
			return params;
		},
		[query, filters, sortBy, searchField, isPremium],
	);

	const executeSearch = useCallback(async () => {
		setLoading(true);
		setCursor(0);
		setNextCursor(null);
		setSpellingSuggestion(null);
		setRelatedSearches([]);
		addToast("Searching", "Applying your query and selected filters...", "success");

		try {
			const params = buildSearchParams(0);

			if (imageSearchFile) {
				try {
					setSearchImageUploadProgress(0);
					const imgRes = await uploadFile("/search/image", {
						file: imageSearchFile,
						token,
						onProgress: setSearchImageUploadProgress,
					});
					if (imgRes?.file?.url) {
						params.set("imageUrl", imgRes.file.url);
						addToast(
							"Visual search",
							`Image uploaded: ${imgRes.file.originalname}. Matching by tags and colors.`,
							"success",
						);
					}
				} catch {
					addToast("Image upload failed", "Continuing with text search only", "error");
				}
				setImageSearchFile(null);
				setImagePreview(null);
				setSearchImageUploadProgress(0);
			}

			const [reqRes, prodRes, feedRes, userRes] = await Promise.all([
				apiRequest(`/requirements/search?${params.toString()}`, { token }),
				apiRequest(`/products/search?${params.toString()}`, { token }),
				apiRequest(`/feed/search?${params.toString()}`, { token }),
				apiRequest(`/users/search?${params.toString()}`, { token }),
			]);

			setRequests(Array.isArray(reqRes?.items) ? reqRes.items : []);
			setCompanies(Array.isArray(prodRes?.items) ? prodRes.items : []);
			setFeedPosts(Array.isArray(feedRes?.items) ? feedRes.items : []);
			setUsers(Array.isArray(userRes?.items) ? userRes.items : []);
			setNextCursor(
				reqRes?.next_cursor ||
					prodRes?.next_cursor ||
					feedRes?.next_cursor ||
					userRes?.next_cursor ||
					null,
			);
			setFacetCounts(
				reqRes?.facetCounts || prodRes?.facetCounts || { countries: [], categories: [] },
			);

			const reqTotal = Number.isFinite(Number(reqRes?.total))
				? Number(reqRes.total)
				: reqRes?.items?.length || 0;
			const prodTotal = Number.isFinite(Number(prodRes?.total))
				? Number(prodRes.total)
				: prodRes?.items?.length || 0;
			const feedTotal = Number.isFinite(Number(feedRes?.total))
				? Number(feedRes.total)
				: feedRes?.items?.length || 0;
			const userTotal = Number.isFinite(Number(userRes?.total))
				? Number(userRes.total)
				: userRes?.items?.length || 0;
			const total = reqTotal + prodTotal + feedTotal + userTotal;
			setTotalResults(total);
			setEstimatedCounts({
				buyerRequests: reqTotal,
				companies: prodTotal,
				feedPosts: feedTotal,
				users: userTotal,
				total,
			});

			const nextParams = new URLSearchParams(params);
			nextParams.set("tab", activeTab);
			setSearchParams(nextParams, { replace: true });

			if (query.trim()) {
				const newHistory = [
					{ query: query.trim(), timestamp: Date.now() },
					...history.filter((h) => h.query !== query.trim()),
				].slice(0, 20);
				localStorage.setItem("search_history", JSON.stringify(newHistory));
				setHistory(newHistory);
			}

			setSpellingSuggestion(null);
			if (total === 0 && query.trim()) {
				try {
					const spRes = await apiRequest(`/search/spelling?q=${encodeURIComponent(query.trim())}`, {
						token,
					});
					if (spRes?.suggestion && spRes.suggestion.toLowerCase() !== query.trim().toLowerCase()) {
						setSpellingSuggestion(spRes.suggestion);
					}
				} catch (err) {
					logger.warn("Spelling suggestion failed:", err);
				}
			}

			try {
				const trendRes = await apiRequest(
					`/search/trending?q=${encodeURIComponent(query.trim())}`,
					{ token },
				);
				if (Array.isArray(trendRes?.related)) {
					setRelatedSearches(trendRes.related.slice(0, 8));
				}
			} catch (err) {
				logger.warn("Related searches failed:", err);
			}
		} catch (err) {
			addToast("Search failed", err.message || "Unable to complete search", "error");
		} finally {
			setLoading(false);
		}
	}, [
		query,
		token,
		activeTab,
		setSearchParams,
		addToast,
		buildSearchParams,
		imageSearchFile,
		history,
	]);

	const loadMore = useCallback(async () => {
		if (loadingMore || nextCursor === null) {
			return;
		}
		setLoadingMore(true);
		try {
			const params = buildSearchParams(nextCursor);
			const [reqRes, prodRes, feedRes, userRes] = await Promise.all([
				apiRequest(`/requirements/search?${params.toString()}`, { token }),
				apiRequest(`/products/search?${params.toString()}`, { token }),
				apiRequest(`/feed/search?${params.toString()}`, { token }),
				apiRequest(`/users/search?${params.toString()}`, { token }),
			]);
			setRequests((prev) => [...prev, ...(Array.isArray(reqRes?.items) ? reqRes.items : [])]);
			setCompanies((prev) => [...prev, ...(Array.isArray(prodRes?.items) ? prodRes.items : [])]);
			setFeedPosts((prev) => [...prev, ...(Array.isArray(feedRes?.items) ? feedRes.items : [])]);
			setUsers((prev) => [...prev, ...(Array.isArray(userRes?.items) ? userRes.items : [])]);
			setNextCursor(
				reqRes?.next_cursor ||
					prodRes?.next_cursor ||
					feedRes?.next_cursor ||
					userRes?.next_cursor ||
					null,
			);
			setCursor(nextCursor);
		} catch {
			addToast("Load more failed", "Unable to load additional results", "error");
		} finally {
			setLoadingMore(false);
		}
	}, [loadingMore, nextCursor, buildSearchParams, token, addToast]);

	useEffect(() => {
		// eslint-disable-next-line react-hooks/immutability
		executeSearchRef.current = executeSearch;
	}, [executeSearch]);

	async function saveSearch() {
		if (alertsQuota !== null && alertsQuota <= 0) {
			addToast("Alert limit reached", "You have reached your alert limit.", "error");
			return;
		}
		const hasFilters =
			query.trim() ||
			filters.industry !== "Any" ||
			filters.country ||
			filters.companyType.length > 0 ||
			filters.incoterms.length > 0;
		if (!hasFilters) {
			addToast("Nothing to save", "Enter a query or select filters before saving.", "error");
			return;
		}
		try {
			const payload = {
				query: query || "saved-search",
				filters: {
					category: filters.selectedCategories,
					industry: filters.industry,
					country: filters.country,
					companyType: filters.companyType,
					incoterms: filters.incoterms,
					location: filters.location,
					verifiedOnly: filters.verifiedOnly,
				},
			};
			await apiRequest("/search/alerts", {
				method: "POST",
				token,
				body: payload,
			});
			const remaining = Math.max(0, alertsQuota - 1);
			setAlertsQuota(remaining);
			addToast("Alert saved", "You'll be notified when new matches appear", "success");
			await fetchSavedAlerts();
		} catch {
			addToast("Failed", "Could not save alert", "error");
		}
	}

	async function shareSearch() {
		const params = new URLSearchParams();
		if (query.trim()) {
			params.set("q", query.trim());
		}
		if (!filters.allCategories) {
			params.set("cats", filters.selectedCategories.join(","));
		}
		if (filters.industry !== "Any") {
			params.set("industry", filters.industry);
		}
		if (filters.location) {
			params.set("loc", filters.location);
		}
		if (filters.country) {
			params.set("country", filters.country);
		}
		if (filters.incoterms.length > 0) {
			params.set("incoterms", filters.incoterms.join(","));
		}
		if (filters.companyType.length > 0) {
			params.set("types", filters.companyType.join(","));
		}
		if (filters.certifications.length > 0) {
			params.set("certs", filters.certifications.join(","));
		}
		const url = `${window.location.origin}/search?${params.toString()}`;
		try {
			await navigator.clipboard.writeText(url);
		} catch {
			// silently fail
		}
		addToast("Share link copied", "Share link copied to clipboard.", "success");
	}

	function clearAll() {
		setQuery("");
		setFilters({ ...initialFilters });
		setSelectedLocation(null);
		setLocationSuggestions([]);
		setRoleSeatText("");
		setColorText("PMS 185C");
		setRefineQuery("");
		setSortBy("relevance");
		setCursor(0);
		setNextCursor(null);
		setImageSearchFile(null);
		setImagePreview(null);
	}

	function setLocationFromSuggestion(item) {
		setFilters((prev) => ({
			...prev,
			location: item.name,
			locationCoords: { lat: item.lat, lng: item.lng },
		}));
		setSelectedLocation(item);
		setLocationSuggestions([]);
	}

	function onLocationChange(value) {
		setFilters((prev) => ({ ...prev, location: value }));
		if (locationDebounceRef.current) {
			clearTimeout(locationDebounceRef.current);
		}
		if (!value.trim()) {
			setLocationSuggestions([]);
			return;
		}
		locationDebounceRef.current = setTimeout(() => {
			const v = value.toLowerCase();
			setLocationSuggestions(
				SAMPLE_LOCATIONS.filter((item) => item.name.toLowerCase().includes(v)).slice(0, 5),
			);
		}, 180);
	}

	function applyCurrentLocation() {
		if (!navigator.geolocation) {
			addToast("Location unavailable", "Geolocation is not supported in this browser.", "error");
			return;
		}
		navigator.geolocation.getCurrentPosition(
			(pos) => {
				const loc = {
					name: "Current location",
					lat: pos.coords.latitude,
					lng: pos.coords.longitude,
				};
				setFilters((prev) => ({
					...prev,
					location: "Current location",
					locationCoords: { lat: loc.lat, lng: loc.lng },
				}));
				setSelectedLocation(loc);
				addToast("Location set", "Current GPS coordinates applied.", "success");
			},
			() => addToast("Location error", "Unable to read your current location.", "error"),
			{ enableHighAccuracy: true, timeout: 8000 },
		);
	}

	function addColorChip() {
		const chip = colorText.trim();
		if (!chip) {
			return;
		}
		setFilters((prev) => ({
			...prev,
			colorPants: prev.colorPants.includes(chip) ? prev.colorPants : [...prev.colorPants, chip],
		}));
		setColorText("");
	}

	function addRoleSeat() {
		const txt = roleSeatText.trim();
		if (!txt) {
			return;
		}
		setFilters((prev) => ({ ...prev, roles: [...prev.roles, txt] }));
		setRoleSeatText("");
	}

	const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/.test(navigator.platform);

	if (pageLoading) {
		return <NeonAtom fill={true} timeout={10000} />;
	}

	return (
		<div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(109,171,223,0.18),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.95),rgba(248,250,252,0.95))] dark:bg-[radial-gradient(circle_at_top,rgba(51,122,176,0.18),transparent_34%),linear-gradient(180deg,rgba(2,6,23,0.98),rgba(15,23,42,0.96))] text-slate-900 dark:text-white transition-colors">
			<ToastStack toasts={toasts} onDismiss={removeToast} />
			<SearchModal
				open={searchModalOpen}
				searchInputRef={searchInputRef}
				query={query}
				onQueryChange={setQuery}
				onClose={() => setSearchModalOpen(false)}
				executeSearchRef={executeSearchRef}
			/>
			{batchOpen && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
					<div className="w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-2xl">
						<h3 className="text-lg font-semibold">Batch Search</h3>
						<textarea
							value={batchTerms}
							onChange={(e) => setBatchTerms(e.target.value)}
							placeholder="Paste terms, one per line..."
							className="w-full mt-3 rounded-2xl border p-3 h-32"
						/>
						<input
							type="file"
							accept=".csv"
							onChange={(e) => {
								const reader = new FileReader();
								reader.onload = () => {
									const text = reader.result;
									const lines = text
										.split("\n")
										.map((l) => l.split(",")[0].trim())
										.filter(Boolean);
									setBatchTerms(lines.join("\n"));
								};
								reader.readAsText(e.target.files[0]);
							}}
							className="mt-2"
						/>
						<div className="mt-4 flex gap-2">
							<button
								onClick={async () => {
									const terms = batchTerms
										.split("\n")
										.map((t) => t.trim())
										.filter(Boolean);
									if (terms.length === 0) {
										addToast("No terms", "Add at least one search term", "error");
										return;
									}
									try {
										const res = await apiRequest("/search/batch", {
											method: "POST",
											token,
											body: { terms },
										});
										setBatchResults(res);
										addToast(
											"Batch search",
											`Found ${(res?.requirements?.length || 0) + (res?.products?.length || 0)} matches`,
											"success",
										);
									} catch {
										addToast("Batch search failed", "Unable to run batch search", "error");
									}
								}}
								className="rounded-2xl bg-sky-600 px-6 py-2 text-white"
							>
								Search All
							</button>
							<button
								onClick={() => {
									setBatchOpen(false);
									setBatchResults(null);
									setBatchTerms("");
								}}
								className="rounded-2xl border px-6 py-2"
							>
								Close
							</button>
						</div>
						{batchResults && (
							<div className="mt-4 text-sm space-y-1">
								<p>Requirements: {batchResults.requirements?.length || 0} matches</p>
								<p>Products: {batchResults.products?.length || 0} matches</p>
							</div>
						)}
					</div>
				</div>
			)}

			<div className="mx-auto max-w-[1700px] px-4 py-5 sm:px-6 lg:px-8">
				<div className="grid gap-5 xl:grid-cols-1">
					<main className="space-y-5">
						<section className="rounded-[2rem] border border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-950/55 p-5 shadow-[0_20px_70px_-35px_rgba(15,23,42,0.45)] backdrop-blur-xl sm:p-6">
							<div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
								<div className="flex items-start gap-4">
									<div className="rounded-3xl bg-gradient-to-br from-sky-500 via-blue-500 to-cyan-400 p-4 text-white shadow-xl shadow-sky-500/25">
										<Search className="h-7 w-7" />
									</div>
									<div>
										<div className="flex flex-wrap items-center gap-3">
											<h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Search</h1>
											<Badge tone="blue">
												<Sparkles className="h-3.5 w-3.5" /> Premium discovery
											</Badge>
										</div>
										<p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
											Garments & Textile marketplace
										</p>
										<div className="mt-4 flex flex-wrap gap-2">
											<button
												onClick={() => setFiltersOpen((v) => !v)}
												className={`inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs font-medium transition sm:px-4 sm:py-2.5 sm:text-sm ${
													filtersOpen
														? "border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-300"
														: "border-slate-200 bg-white/70 text-slate-600 hover:border-sky-300 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300 dark:hover:border-sky-700"
												}`}
											>
												<SlidersHorizontal className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Filters{" "}
												{filtersOpen ? (
													<ChevronUp className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
												) : (
													<ChevronDown className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
												)}
											</button>
											<button
												onClick={saveSearch}
												disabled={isSearchAlreadySaved}
												className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 px-3 py-2 text-xs font-medium hover:border-sky-300 dark:hover:border-sky-700 disabled:cursor-not-allowed disabled:opacity-50 sm:px-4 sm:py-2.5 sm:text-sm"
											>
												<Save className="h-3.5 w-3.5 sm:h-4 sm:w-4" />{" "}
												{isSearchAlreadySaved ? "Saved" : "Save"}
											</button>
											<button
												onClick={shareSearch}
												className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 px-3 py-2 text-xs font-medium hover:border-sky-300 dark:hover:border-sky-700 sm:px-4 sm:py-2.5 sm:text-sm"
											>
												<Share2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Share
											</button>
											<Link
												to="/notifications"
												className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 px-4 py-2.5 text-sm font-medium hover:border-sky-300 dark:hover:border-sky-700"
											>
												<Bell className="h-4 w-4" /> Alerts
											</Link>
											<button
												onClick={toggleTheme}
												className="ml-auto inline-flex items-center gap-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 px-4 py-2.5 text-sm font-medium hover:border-sky-300 dark:hover:border-sky-700 lg:ml-0"
											>
												{dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
												{dark ? "Light" : "Dark"} mode
											</button>
										</div>
									</div>
								</div>

								<div className="grid gap-3 rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/60 p-4 sm:grid-cols-3 lg:w-[420px]">
									<div className="rounded-2xl bg-white/90 dark:bg-slate-950/60 p-3">
										<div className="text-xs text-slate-500 dark:text-slate-400">Requests</div>
										<div className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">
											{fmtNumber(estimatedCounts.buyerRequests)}
										</div>
									</div>
									<div className="rounded-2xl bg-white/90 dark:bg-slate-950/60 p-3">
										<div className="text-xs text-slate-500 dark:text-slate-400">Companies</div>
										<div className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">
											{fmtNumber(estimatedCounts.companies)}
										</div>
									</div>
									<div className="rounded-2xl bg-white/90 dark:bg-slate-950/60 p-3">
										<div className="text-xs text-slate-500 dark:text-slate-400">Feed</div>
										<div className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">
											{fmtNumber(estimatedCounts.feedPosts)}
										</div>
									</div>
									<div className="rounded-2xl bg-white/90 dark:bg-slate-950/60 p-3">
										<div className="text-xs text-slate-500 dark:text-slate-400">Alerts left</div>
										<div className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">
											{alertsQuota === null ? "—" : alertsQuota}
										</div>
									</div>
								</div>
							</div>

							<div className="mt-5 grid gap-3 sm:gap-4 sm:grid-cols-[1fr_auto_auto]">
								<motion.div
									className="relative"
									animate={{ width: searchFocused ? "104%" : "100%" }}
									transition={{ type: "spring", stiffness: 300, damping: 25 }}
								>
									<div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
										{searchField === "all" ? (
											<Search className="h-5 w-5" />
										) : (
											<UserSearch className="h-5 w-5" />
										)}
									</div>
									<input
										value={query}
										onChange={(e) => setQuery(e.target.value)}
										onFocus={() => {
											setSearchFocused(true);
											setSuggestionsOpen(true);
										}}
										onBlur={() => {
											setTimeout(() => {
												setSuggestionsOpen(false);
												setSearchFocused(false);
											}, 200);
										}}
										placeholder={
											searchField === "buyer"
												? "Search by buyer name..."
												: searchField === "company"
													? "Search by company name..."
													: "Search requests, factories, products..."
										}
										className="w-full rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-950/60 py-4 pl-12 pr-4 text-base outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-4 focus:ring-sky-500/10 sm:pr-36"
									/>
									{suggestionsOpen && suggestions.length > 0 && (
										<div className="absolute z-20 mt-2 w-full overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-2xl">
											{suggestions.map((s) => (
												<button
													key={s}
													onMouseDown={() => {
														setQuery(s);
														setSuggestionsOpen(false);
													}}
													className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-900"
												>
													<Search className="h-4 w-4 text-slate-400 shrink-0" />
													<span className="text-slate-700 dark:text-slate-200">{s}</span>
												</button>
											))}
										</div>
									)}
									{searchFocused && !query.trim() && history.length > 0 && (
										<div className="absolute z-20 mt-2 w-full overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-2xl">
											<div className="px-4 py-2 text-xs font-medium text-slate-500 dark:text-slate-400 border-b border-slate-200/70 dark:border-slate-800">
												Recent searches
											</div>
											{history.map((h) => (
												<button
													key={h.timestamp}
													onMouseDown={() => {
														setQuery(h.query);
														setSuggestionsOpen(false);
													}}
													className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-900"
												>
													<Clock className="h-4 w-4 text-slate-400 shrink-0" />
													<span className="text-slate-700 dark:text-slate-200">{h.query}</span>
												</button>
											))}
										</div>
									)}
									<div className="absolute right-2 top-1/2 flex -translate-y-1/2 gap-1">
										<button
											onClick={() =>
												setSearchField((f) =>
													f === "all" ? "buyer" : f === "buyer" ? "company" : "all",
												)
											}
											className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 px-2 py-1.5 text-xs font-medium text-slate-500 dark:bg-slate-900 dark:text-slate-300 hover:border-sky-300"
											title={`Search: ${searchField === "all" ? "All fields" : searchField === "buyer" ? "Buyer names" : "Company names"}`}
										>
											<UserSearch className="h-3.5 w-3.5 inline mr-1" />
											{searchField === "all"
												? "All"
												: searchField === "buyer"
													? "Buyer"
													: "Company"}
										</button>
										<button
											onClick={() => setSearchModalOpen(true)}
											className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 px-2 py-1.5 text-xs font-medium text-slate-500 dark:bg-slate-900 dark:text-slate-300"
										>
											{isMac ? "⌘K" : "Ctrl K"}
										</button>
									</div>
								</motion.div>
								<div className="flex items-center gap-2">
									<label className="cursor-pointer rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 px-2 py-3 text-sm text-slate-500 hover:border-sky-300 dark:hover:border-sky-700 sm:px-3 sm:py-4">
										{imagePreview ? (
											<div className="relative">
												<img
													src={imagePreview}
													alt="search"
													className="h-8 w-8 rounded-lg object-cover"
												/>
												<button
													onClick={(e) => {
														e.preventDefault();
														setImageSearchFile(null);
														setImagePreview(null);
													}}
													className="absolute -right-1.5 -top-1.5 rounded-full bg-red-500 p-0.5 text-white"
												>
													<X className="h-3 w-3" />
												</button>
											</div>
										) : (
											<ImagePlus className="h-5 w-5" />
										)}
										<input
											type="file"
											accept=".jpg,.jpeg,.png,.webp,.avif,.gif,.apng,.bmp,.tiff,.tif,.heic,.heif,.dcm,.tga,.svg,.eps,.pdf,.dng,.cr2,.cr3,.nef,.arw,.sr2,.orf,.raf,.psd,.ai,.xcf,.cdr"
											onChange={handleImageSearch}
											className="hidden"
										/>
									</label>
									{searchImageUploadProgress > 0 && (
										<UploadProgressBar progress={searchImageUploadProgress} className="w-16" />
									)}
									<button
										onClick={() => setBatchOpen(true)}
										className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 px-2 py-3 text-sm text-slate-500 hover:border-sky-300 dark:hover:border-sky-700 sm:px-3 sm:py-4"
										title="Batch search"
									>
										<FileSpreadsheet className="h-4 w-4 sm:h-5 sm:w-5" />
									</button>
									<button
										onClick={executeSearch}
										disabled={loading}
										className="inline-flex items-center justify-center gap-2 rounded-3xl bg-gradient-to-r from-sky-600 to-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-xl shadow-sky-500/25 transition hover:from-sky-500 hover:to-blue-500 disabled:cursor-not-allowed disabled:opacity-70 sm:px-6 sm:py-4 sm:text-base"
									>
										<Search className="h-4 w-4 sm:h-5 sm:w-5" />{" "}
										{loading ? (
											<ThreeDot
												variant="bounce"
												color="#337ab0"
												size="small"
												text=""
												textColor=""
											/>
										) : (
											"Search"
										)}
									</button>
								</div>
							</div>

							<div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
								<ResultTabs
									estimatedCounts={estimatedCounts}
									activeTab={activeTab}
									onTabChange={setActiveTab}
								/>
								<div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 sm:text-sm">
									<Badge tone="blue">
										{loading ? (
											<ThreeDot
												variant="bounce"
												color="#337ab0"
												size="small"
												text=""
												textColor=""
											/>
										) : (
											`Estimated: ${fmtNumber(estimatedCounts.buyerRequests)} buyer requests · ${fmtNumber(estimatedCounts.companies)} companies · ${fmtNumber(estimatedCounts.feedPosts)} feed posts (${fmtNumber(estimatedCounts.total)} total)`
										)}
									</Badge>
								</div>
							</div>

							<div className="mt-4 flex flex-wrap gap-2">
								{CATEGORY_OPTIONS.map((cat) => {
									const active =
										cat.key === "all"
											? filters.allCategories
											: filters.selectedCategories.includes(cat.key);
									return (
										<motion.div
											layout={true}
											transition={{
												type: "spring",
												stiffness: 500,
												damping: 30,
											}}
										>
											<button
												key={cat.key}
												onClick={() => toggleCategory(cat.key)}
												className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition sm:px-4 sm:py-2 sm:text-sm ${pillClass(active)}`}
											>
												{cat.label}
											</button>
										</motion.div>
									);
								})}
							</div>

							<div className="mt-4 flex flex-wrap items-center gap-2">
								{activeFilterChips.length > 0 ? (
									activeFilterChips.map((chip) => (
										<button
											key={chip.label}
											onClick={chip.onRemove}
											className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-700 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-300 sm:gap-2 sm:px-3 sm:py-1.5 sm:text-sm"
										>
											{chip.label} <X className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
										</button>
									))
								) : (
									<span className="text-xs text-slate-500 dark:text-slate-400 sm:text-sm">
										No filters active.
									</span>
								)}
								<button
									onClick={clearAll}
									className="ml-auto inline-flex items-center gap-2 rounded-full border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 px-3 py-1.5 text-xs font-medium hover:border-sky-300 dark:hover:border-sky-700 sm:px-4 sm:py-2 sm:text-sm"
								>
									Clear all
								</button>
							</div>
						</section>

						{facetCounts.countries.length > 0 && (
							<section className="rounded-[2rem] border border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-950/55 p-4 shadow-[0_20px_70px_-35px_rgba(15,23,42,0.45)] backdrop-blur-xl">
								<div className="flex flex-wrap items-center gap-2">
									<span className="text-sm font-medium text-slate-500 dark:text-slate-400 mr-1">
										Filter by country:
									</span>
									{facetCounts.countries.slice(0, 8).map((c) => (
										<button
											key={c.value}
											onClick={() => setFilters((f) => ({ ...f, country: c.value }))}
											className={`rounded-full border px-3 py-1 text-xs font-medium transition ${filters.country === c.value ? "bg-sky-600 text-white border-sky-500" : "hover:bg-sky-50 dark:hover:bg-sky-500/10 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-800"}`}
										>
											{c.value} ({c.count})
										</button>
									))}
								</div>
							</section>
						)}

						{filtersOpen && (
							<section ref={filterPanelRef} className="grid gap-5 xl:grid-cols-3">
								<SectionCard title="Product Filters" icon={ClipboardList}>
									<div className="space-y-5">
										<div>
											<label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
												Industry
											</label>
											<select
												value={filters.industry}
												onChange={(e) =>
													setFilters((f) => ({
														...f,
														industry: e.target.value,
													}))
												}
												className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/60 px-4 py-3 outline-none focus:border-sky-400"
											>
												{INDUSTRIES.map((i) => (
													<option key={i}>{i}</option>
												))}
											</select>
										</div>

										<div>
											<div className="mb-2 flex items-center justify-between text-sm font-medium text-slate-700 dark:text-slate-300">
												<span>MOQ range</span>
												<span>
													{fmtNumber(filters.moqMin)} - {fmtNumber(filters.moqMax)} pcs
												</span>
											</div>
											<div className="flex flex-wrap gap-2">
												{["Any", "0-500", "500-1K", "1K-5K", "5K+"].map((b) => (
													<button
														key={b}
														onClick={() => setFilters((f) => ({ ...f, moqBucket: b }))}
														className={`rounded-full border px-3 py-1.5 text-sm ${pillClass(filters.moqBucket === b)}`}
													>
														{b}
													</button>
												))}
											</div>
											<div className="mt-4 space-y-3">
												<input
													type="range"
													min="0"
													max="100000"
													step="100"
													value={filters.moqMin}
													onChange={(e) =>
														setFilters((f) => ({
															...f,
															moqMin: Math.min(Number(e.target.value), f.moqMax),
														}))
													}
													className="w-full"
												/>
												<input
													type="range"
													min="0"
													max="100000"
													step="100"
													value={filters.moqMax}
													onChange={(e) =>
														setFilters((f) => ({
															...f,
															moqMax: Math.max(Number(e.target.value), f.moqMin),
														}))
													}
													className="w-full"
												/>
											</div>
										</div>

										<div>
											<div className="mb-2 flex items-center justify-between text-sm font-medium text-slate-700 dark:text-slate-300">
												<span>Price per unit</span>
												<span>
													${filters.priceMin} - ${filters.priceMax}
												</span>
											</div>
											<div className="grid grid-cols-[110px_1fr] gap-3">
												<select
													value={filters.currency}
													onChange={(e) =>
														setFilters((f) => ({
															...f,
															currency: e.target.value,
														}))
													}
													className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/60 px-3 py-3 outline-none focus:border-sky-400"
												>
													{CURRENCIES.map((i) => (
														<option key={i}>{i}</option>
													))}
												</select>
												<div className="space-y-3 pt-1">
													<input
														type="range"
														min="0"
														max="100"
														step="1"
														value={filters.priceMin}
														onChange={(e) =>
															setFilters((f) => ({
																...f,
																priceMin: Math.min(Number(e.target.value), f.priceMax),
															}))
														}
														className="w-full"
													/>
													<input
														type="range"
														min="0"
														max="100"
														step="1"
														value={filters.priceMax}
														onChange={(e) =>
															setFilters((f) => ({
																...f,
																priceMax: Math.max(Number(e.target.value), f.priceMin),
															}))
														}
														className="w-full"
													/>
												</div>
											</div>
										</div>

										<div>
											<div className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
												Incoterms
											</div>
											<div className="flex flex-wrap gap-2">
												{INCOTERMS.map((i) => (
													<button
														key={i}
														onClick={() => toggleArrayFilter("incoterms", i)}
														className={`rounded-full border px-3 py-1.5 text-sm ${pillClass(filters.incoterms.includes(i))}`}
													>
														{i}
													</button>
												))}
											</div>
										</div>

										<button
											onClick={() => setExpandedMore((v) => !v)}
											className="inline-flex items-center gap-2 text-sm font-medium text-sky-600 dark:text-sky-400"
										>
											More filters{" "}
											{expandedMore ? (
												<ChevronUp className="h-4 w-4" />
											) : (
												<ChevronDown className="h-4 w-4" />
											)}
										</button>

										{expandedMore && (
											<div className="space-y-4 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-4">
												<div>
													<label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
														Country
													</label>
													<input
														value={filters.country}
														onChange={(e) =>
															setFilters((f) => ({
																...f,
																country: e.target.value,
															}))
														}
														placeholder="Bangladesh, Vietnam, Turkey"
														className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/60 px-4 py-3 outline-none focus:border-sky-400"
													/>
												</div>
												<PlanGate premium={isPremium}>
													<div>
														<label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
															<Shirt className="h-4 w-4 inline mr-1" /> Season / Collection
														</label>
														<select
															value={filters.season}
															onChange={(e) =>
																setFilters((f) => ({
																	...f,
																	season: e.target.value,
																}))
															}
															className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/60 px-4 py-3 outline-none focus:border-sky-400"
														>
															{SEASON_OPTIONS.map((s) => (
																<option key={s} value={s}>
																	{s}
																</option>
															))}
														</select>
													</div>
												</PlanGate>
												<PlanGate premium={isPremium}>
													<div>
														<label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
															<Wrench className="h-4 w-4 inline mr-1" /> Machinery / Equipment
														</label>
														<input
															value={filters.machinery}
															onChange={(e) =>
																setFilters((f) => ({
																	...f,
																	machinery: e.target.value,
																}))
															}
															placeholder="e.g. Dyeing, Spinning, Cutting"
															className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/60 px-4 py-3 outline-none focus:border-sky-400"
														/>
													</div>
												</PlanGate>
												<PlanGate premium={isPremium}>
													<div>
														<label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
															<PackageCheck className="h-4 w-4 inline mr-1" /> Availability
														</label>
														<select
															value={filters.stockStatus}
															onChange={(e) =>
																setFilters((f) => ({
																	...f,
																	stockStatus: e.target.value,
																}))
															}
															className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/60 px-4 py-3 outline-none focus:border-sky-400"
														>
															{STOCK_STATUS_OPTIONS.map((opt) => (
																<option key={opt.key} value={opt.key}>
																	{opt.label}
																</option>
															))}
														</select>
													</div>
												</PlanGate>
												<PlanGate premium={isPremium}>
													<div>
														<label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
															Posted after
														</label>
														<input
															type="date"
															value={filters.postedAfter}
															onChange={(e) =>
																setFilters((f) => ({
																	...f,
																	postedAfter: e.target.value,
																}))
															}
															className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/60 px-4 py-3 outline-none focus:border-sky-400"
														/>
													</div>
												</PlanGate>
												<PlanGate premium={isPremium}>
													<div>
														<label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
															Posted before
														</label>
														<input
															type="date"
															value={filters.postedBefore}
															onChange={(e) =>
																setFilters((f) => ({
																	...f,
																	postedBefore: e.target.value,
																}))
															}
															className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/60 px-4 py-3 outline-none focus:border-sky-400"
														/>
													</div>
												</PlanGate>
												<PlanGate premium={isPremium}>
													<div>
														<label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
															Certifications
														</label>
														<div className="flex flex-wrap gap-2">
															{CERTIFICATION_OPTIONS.map((cert) => (
																<button
																	key={cert}
																	onClick={() => toggleArrayFilter("certifications", cert)}
																	className={`rounded-full border px-3 py-1.5 text-sm ${pillClass(filters.certifications.includes(cert))}`}
																>
																	{cert}
																</button>
															))}
														</div>
													</div>
												</PlanGate>
												<PlanGate premium={isPremium}>
													<div>
														<label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
															<Star className="h-4 w-4 inline mr-1" /> Minimum Rating
														</label>
														<select
															value={filters.minRating}
															onChange={(e) =>
																setFilters((f) => ({
																	...f,
																	minRating: e.target.value,
																}))
															}
															className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/60 px-4 py-3 outline-none focus:border-sky-400"
														>
															<option value="">Any</option>
															<option value="3">3+</option>
															<option value="4">4+</option>
															<option value="4.5">4.5+</option>
														</select>
													</div>
												</PlanGate>
												<PlanGate premium={isPremium}>
													<div>
														<label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
															<Languages className="h-4 w-4 inline mr-1" /> Language
														</label>
														<select
															value={filters.language}
															onChange={(e) =>
																setFilters((f) => ({
																	...f,
																	language: e.target.value,
																}))
															}
															className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/60 px-4 py-3 outline-none focus:border-sky-400"
														>
															<option value="">Any</option>
															<option value="en">English</option>
															<option value="bn">Bengali</option>
															<option value="tr">Turkish</option>
															<option value="zh">Chinese</option>
														</select>
													</div>
												</PlanGate>
												<label className="inline-flex items-center gap-3 rounded-2xl border border-slate-200 dark:border-slate-800 px-4 py-3 text-sm text-slate-700 dark:text-slate-300">
													<input
														type="checkbox"
														checked={filters.verifiedOnly}
														onChange={(e) =>
															setFilters((f) => ({
																...f,
																verifiedOnly: e.target.checked,
															}))
														}
													/>{" "}
													Verified only
												</label>
											</div>
										)}
									</div>
								</SectionCard>

								<SectionCard title="Supplier Filters" icon={Factory}>
									<div className="space-y-5">
										<div>
											<div className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
												Company type
											</div>
											<div className="flex flex-wrap gap-2">
												{COMPANY_TYPES.map((i) => (
													<button
														key={i}
														onClick={() => toggleArrayFilter("companyType", i)}
														className={`rounded-full border px-3 py-1.5 text-sm ${pillClass(filters.companyType.includes(i))}`}
													>
														{i}
													</button>
												))}
											</div>
										</div>

										<div>
											<div className="mb-2 flex items-center justify-between text-sm font-medium text-slate-700 dark:text-slate-300">
												<span>Production capacity</span>
												<span>
													{fmtNumber(filters.productionMin)} - {fmtNumber(filters.productionMax)} /
													month
												</span>
											</div>
											<input
												type="range"
												min="0"
												max="500000"
												value={filters.productionMax}
												onChange={(e) =>
													setFilters((f) => ({
														...f,
														productionMax: Number(e.target.value),
													}))
												}
												className="w-full"
											/>
										</div>

										<div>
											<div className="mb-2 flex items-center justify-between text-sm font-medium text-slate-700 dark:text-slate-300">
												<span>Worker count</span>
												<span>
													{fmtNumber(filters.workersMin)} - {fmtNumber(filters.workersMax)}
												</span>
											</div>
											<input
												type="range"
												min="0"
												max="5000"
												value={filters.workersMax}
												onChange={(e) =>
													setFilters((f) => ({
														...f,
														workersMax: Number(e.target.value),
													}))
												}
												className="w-full"
											/>
										</div>

										<div>
											<div className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
												Export markets
											</div>
											<div className="flex flex-wrap gap-2">
												{EXPORT_MARKETS.map((i) => (
													<button
														key={i}
														onClick={() => toggleArrayFilter("exportMarkets", i)}
														className={`rounded-full border px-3 py-1.5 text-sm ${pillClass(filters.exportMarkets.includes(i))}`}
													>
														{i}
													</button>
												))}
											</div>
										</div>

										<div>
											<div className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
												Role seats
											</div>
											<div className="flex gap-2">
												<input
													value={roleSeatText}
													onChange={(e) => setRoleSeatText(e.target.value)}
													placeholder="e.g. Merchandiser: 2"
													className="min-w-0 flex-1 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/60 px-4 py-3 outline-none focus:border-sky-400"
												/>
												<button
													onClick={addRoleSeat}
													className="rounded-2xl bg-sky-600 px-4 py-3 text-sm font-medium text-white hover:bg-sky-500"
												>
													Add
												</button>
											</div>
											<div className="mt-3 flex flex-wrap gap-2">
												{filters.roles.map((r) => (
													<button
														key={r}
														onClick={() =>
															setFilters((f) => ({
																...f,
																roles: f.roles.filter((x) => x !== r),
															}))
														}
														className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-sm text-sky-700 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-300"
													>
														{r} <X className="h-3.5 w-3.5" />
													</button>
												))}
											</div>
										</div>
									</div>
								</SectionCard>

								<SectionCard title="Location & Advanced" icon={Globe2}>
									<div className="space-y-5">
										<div className="relative">
											<label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
												Location search
											</label>
											<input
												ref={locationInputRef}
												value={filters.location}
												onChange={(e) => onLocationChange(e.target.value)}
												placeholder="Search geo location..."
												className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/60 px-4 py-3 outline-none focus:border-sky-400"
											/>
											{locationSuggestions.length > 0 && (
												<div className="absolute z-10 mt-2 w-full overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-xl">
													{locationSuggestions.map((item) => (
														<button
															key={item.name}
															onClick={() => setLocationFromSuggestion(item)}
															className="flex w-full items-center justify-between px-4 py-3 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-900"
														>
															<span>{item.name}</span>
															<span className="text-xs text-slate-500">Set location</span>
														</button>
													))}
												</div>
											)}
										</div>

										<MapPreview
											selectedLocation={selectedLocation}
											filtersLocation={filters.location}
										/>

										<button
											onClick={applyCurrentLocation}
											className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 px-4 py-3 text-sm font-medium hover:border-sky-300 dark:hover:border-sky-700"
										>
											<LocateFixed className="h-4 w-4" /> Use current location
										</button>

										<div>
											<label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
												Distance radius (km)
											</label>
											<input
												type="number"
												min="1"
												max="500"
												step="1"
												value={filters.distanceKm}
												onChange={(e) =>
													setFilters((f) => ({
														...f,
														distanceKm: e.target.value,
													}))
												}
												placeholder="Radius in km"
												className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/60 px-4 py-3 outline-none focus:border-sky-400"
											/>
										</div>

										<div>
											<div className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
												Pantone colors
											</div>
											<div className="flex gap-2">
												<input
													value={colorText}
													onChange={(e) => setColorText(e.target.value)}
													placeholder="PMS 185C"
													className="min-w-0 flex-1 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/60 px-4 py-3 outline-none focus:border-sky-400"
												/>
												<button
													onClick={addColorChip}
													className="rounded-2xl bg-sky-600 px-4 py-3 text-sm font-medium text-white hover:bg-sky-500"
												>
													Add
												</button>
											</div>
											<div className="mt-3 flex flex-wrap gap-2">
												{filters.colorPants.map((c) => (
													<button
														key={c}
														onClick={() =>
															setFilters((f) => ({
																...f,
																colorPants: f.colorPants.filter((x) => x !== c),
															}))
														}
														className="inline-flex items-center gap-2 rounded-full border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/60 px-3 py-1.5 text-sm"
													>
														{c} <X className="h-3.5 w-3.5" />
													</button>
												))}
											</div>
										</div>

										<div>
											<div className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
												Customization
											</div>
											<div className="flex flex-wrap gap-2">
												{CUSTOMIZATION.map((i) => (
													<button
														key={i}
														onClick={() => toggleArrayFilter("customization", i)}
														className={`rounded-full border px-3 py-1.5 text-sm ${pillClass(filters.customization.includes(i))}`}
													>
														{i}
													</button>
												))}
											</div>
										</div>

										<label className="inline-flex items-center gap-3 rounded-2xl border border-slate-200 dark:border-slate-800 px-4 py-3 text-sm text-slate-700 dark:text-slate-300">
											<input
												type="checkbox"
												checked={filters.sampleAvailable}
												onChange={(e) =>
													setFilters((f) => ({
														...f,
														sampleAvailable: e.target.checked,
													}))
												}
											/>{" "}
											Sample available
										</label>

										<div>
											<div className="mb-2 flex items-center justify-between text-sm font-medium text-slate-700 dark:text-slate-300">
												<span>Sample lead time</span>
												<span>{filters.sampleLeadTime} days</span>
											</div>
											<input
												type="range"
												min="1"
												max="90"
												value={filters.sampleLeadTime}
												onChange={(e) =>
													setFilters((f) => ({
														...f,
														sampleLeadTime: Number(e.target.value),
													}))
												}
												className="w-full"
											/>
										</div>

										<div>
											<div className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
												Certifications
											</div>
											<div className="flex flex-wrap gap-2">
												{CERTIFICATIONS.map((i) => (
													<button
														key={i}
														onClick={() => toggleArrayFilter("certifications", i)}
														className={`rounded-full border px-3 py-1.5 text-sm ${pillClass(filters.certifications.includes(i))}`}
													>
														{i}
													</button>
												))}
											</div>
										</div>

										<div>
											<label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
												Audit date
											</label>
											<input
												type="date"
												value={filters.auditDate}
												onChange={(e) =>
													setFilters((f) => ({
														...f,
														auditDate: e.target.value,
													}))
												}
												className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/60 px-4 py-3 outline-none focus:border-sky-400"
											/>
										</div>

										<div>
											<div className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
												Payment terms
											</div>
											<div className="flex flex-wrap gap-2">
												{PAYMENT_TERMS.map((i) => (
													<button
														key={i}
														onClick={() => toggleArrayFilter("paymentTerms", i)}
														className={`rounded-full border px-3 py-1.5 text-sm ${pillClass(filters.paymentTerms.includes(i))}`}
													>
														{i}
													</button>
												))}
											</div>
										</div>
									</div>
								</SectionCard>
							</section>
						)}

						<section className="rounded-[2rem] border border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-950/55 p-5 shadow-[0_20px_70px_-35px_rgba(15,23,42,0.45)] backdrop-blur-xl sm:p-6">
							<div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:flex-wrap lg:justify-between">
								<div>
									<h2 className="text-xl font-semibold text-slate-900 dark:text-white">Results</h2>
									<p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
										{totalResults > 0
											? `${totalResults} total results`
											: "Buyer requests, companies, and marketplace data."}
									</p>
								</div>
								<div className="flex flex-wrap items-center gap-2">
									<div className="flex items-center gap-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 px-3 py-2">
										<ArrowUpDown className="h-4 w-4 text-slate-400" />
										<select
											value={sortBy}
											onChange={(e) => setSortBy(e.target.value)}
											className="bg-transparent text-sm outline-none text-slate-700 dark:text-slate-200"
										>
											{SORT_OPTIONS.map((opt) => (
												<option key={opt.key} value={opt.key}>
													{opt.label}
												</option>
											))}
										</select>
									</div>
									<div className="relative flex items-center">
										<ScanSearch className="absolute left-3 h-4 w-4 text-slate-400" />
										<input
											value={refineQuery}
											onChange={(e) => setRefineQuery(e.target.value)}
											placeholder="Refine results..."
											className="w-40 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 py-2 pl-9 pr-3 text-sm outline-none placeholder:text-slate-400 focus:border-sky-400"
										/>
										{refineQuery && (
											<button
												onClick={() => setRefineQuery("")}
												className="absolute right-2 text-slate-400 hover:text-slate-600"
											>
												<X className="h-3.5 w-3.5" />
											</button>
										)}
									</div>
									<button
										onClick={exportCSV}
										disabled={exportingCsv}
										className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 px-3 py-2 text-sm font-medium hover:border-sky-300 dark:hover:border-sky-700 disabled:opacity-50"
									>
										<Download className="h-4 w-4" /> CSV
									</button>
									<button
										onClick={() => setShowShortlist((v) => !v)}
										className={`inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-medium ${shortlist.length > 0 ? "border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-300" : "border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 text-slate-700 dark:text-slate-200"} hover:border-sky-300 dark:hover:border-sky-700`}
									>
										<ArrowLeftRight className="h-4 w-4" /> Compare ({shortlist.length})
									</button>
									<button
										onClick={() => setViewMode("all")}
										className={`rounded-full border px-3 py-1.5 text-sm font-medium ${pillClass(viewMode === "all")}`}
									>
										All
									</button>
									<button
										onClick={() => setViewMode("requests")}
										className={`rounded-full border px-3 py-1.5 text-sm font-medium ${pillClass(viewMode === "requests")}`}
									>
										Buyer Requests
									</button>
									<button
										onClick={() => setViewMode("companies")}
										className={`rounded-full border px-3 py-1.5 text-sm font-medium ${pillClass(viewMode === "companies")}`}
									>
										Companies
									</button>
								</div>
							</div>

							{spellingSuggestion && !loading && (
								<div className="mt-4 rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-5 py-3 text-sm">
									<span className="text-slate-700 dark:text-slate-300">
										Did you mean{" "}
										<button
											onClick={() => {
												setQuery(spellingSuggestion);
												setSpellingSuggestion(null);
											}}
											className="font-semibold text-sky-600 dark:text-sky-400 underline hover:no-underline"
										>
											{spellingSuggestion}
										</button>
										?
									</span>
								</div>
							)}

							<div className="mt-5">
								<AnimatePresence mode="wait">
									{loading ? (
										<motion.div
											key="loading"
											initial={{ clipPath: "inset(0 100% 0 0)" }}
											animate={{ clipPath: "inset(0 0 0 0)" }}
											exit={{ clipPath: "inset(0 0 0 100%)" }}
											transition={{ duration: 0.3, ease: "easeInOut" }}
										>
											<Mosaic
												color="#337ab0"
												size="large"
												style={{ fontSize: "40px" }}
												text=""
												textColor=""
											/>
										</motion.div>
									) : (
										<motion.div
											key={activeTab}
											initial={{ clipPath: "inset(0 100% 0 0)" }}
											animate={{ clipPath: "inset(0 0 0 0)" }}
											exit={{ clipPath: "inset(0 0 0 100%)" }}
											transition={{ duration: 0.3, ease: "easeInOut" }}
										>
											<ResultCards
												totalResults={totalResults}
												query={query}
												loading={loading}
												trendingSearches={trendingSearches}
												activeTab={activeTab}
												filteredRequests={filteredRequests}
												filteredCompanies={filteredCompanies}
												filteredFeedPosts={filteredFeedPosts}
												filteredUsers={filteredUsers}
												setFilters={setFilters}
												setQuery={setQuery}
												toggleShortlist={toggleShortlist}
												isShortlisted={isShortlisted}
												highlightText={highlightText}
												saveSearch={saveSearch}
											/>
											{!loading && nextCursor !== null && !refineQuery && (
												<div className="mt-6 flex justify-center">
													<button
														onClick={loadMore}
														disabled={loadingMore}
														className="inline-flex items-center gap-2 rounded-2xl bg-sky-600 px-8 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-500/20 hover:bg-sky-500 disabled:opacity-60"
													>
														{loadingMore ? (
															<ThreeDot
																variant="bounce"
																color="#337ab0"
																size="small"
																text=""
																textColor=""
															/>
														) : (
															<ChevronDown className="h-4 w-4" />
														)}
														{loadingMore
															? "Loading..."
															: `Load more (${Math.max(0, totalResults - cursor - (activeTab === "companies" ? filteredCompanies.length : filteredRequests.length))} remaining)`}
													</button>
												</div>
											)}
										</motion.div>
									)}
								</AnimatePresence>
							</div>
						</section>

						{showShortlist && shortlist.length > 0 && (
							<section className="rounded-[2rem] border border-sky-200/80 dark:border-sky-800 bg-white/80 dark:bg-slate-950/55 p-5 shadow-[0_20px_70px_-35px_rgba(15,23,42,0.45)] backdrop-blur-xl sm:p-6">
								<div className="flex items-center justify-between mb-4">
									<h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
										<ArrowLeftRight className="h-5 w-5 text-sky-500" /> Compare ({shortlist.length})
									</h2>
									<button
										onClick={() => setShowShortlist(false)}
										className="text-slate-400 hover:text-slate-600"
									>
										<X className="h-5 w-5" />
									</button>
								</div>
								<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
									{shortlist.map((key) => {
										const [type, id] = key.split(":");
										const item =
											type === "buyer"
												? filteredRequests.find((r) => String(r.id) === id)
												: filteredCompanies.find((c) => String(c.id) === id);
										if (!item) {
											return null;
										}
										return (
											<div
												key={key}
												className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 p-4"
											>
												<div className="flex items-start justify-between">
													<div>
														<div className="text-xs text-sky-500 font-medium uppercase">
															{type === "buyer" ? "Buyer Request" : "Company"}
														</div>
														<div
															className="mt-1 font-medium text-slate-900 dark:text-white"
															dangerouslySetInnerHTML={{
																__html: highlightText(item.title || item.name || "Untitled", query),
															}}
														/>
													</div>
													<button
														onClick={() => toggleShortlist(id, type)}
														className="text-slate-400 hover:text-red-400"
													>
														<X className="h-4 w-4" />
													</button>
												</div>
												{item.category && (
													<div
														className="mt-2 text-xs text-slate-500"
														dangerouslySetInnerHTML={{
															__html: highlightText(item.category, query),
														}}
													/>
												)}
												{item.country && (
													<div className="text-xs text-slate-500">Country: {item.country}</div>
												)}
												{item.moq && <div className="text-xs text-slate-500">MOQ: {item.moq}</div>}
											</div>
										);
									})}
								</div>
								<div className="mt-4 flex gap-2">
									<button
										onClick={exportCSV}
										disabled={exportingCsv}
										className="inline-flex items-center gap-2 rounded-2xl bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
									>
										<Download className="h-4 w-4" /> Export compared
									</button>
									<button
										onClick={() => setShortlist([])}
										className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 dark:border-slate-800 px-4 py-2 text-sm font-medium hover:border-red-300"
									>
										Clear all
									</button>
								</div>
							</section>
						)}
					</main>

					<aside className="space-y-5">
						<SectionCard title="Recent Views" icon={Eye}>
							<div className="space-y-3">
								{recentViews.length > 0 ? (
									recentViews.slice(0, 5).map((item) => (
										<Link
											key={item.id}
											to={`/product/${item.id}`}
											className="flex items-center gap-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 p-3 hover:border-sky-300 dark:hover:border-sky-700"
										>
											<div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-lg shadow-sky-500/20">
												<Camera className="h-5 w-5" />
											</div>
											<div className="min-w-0 flex-1">
												<div
													className="truncate text-sm font-medium text-slate-900 dark:text-white"
													dangerouslySetInnerHTML={{
														__html: highlightText(item.title || item.name, query),
													}}
												/>
												<div
													className="truncate text-xs text-slate-500 dark:text-slate-400"
													dangerouslySetInnerHTML={{
														__html: highlightText(item.subtitle || item.description, query),
													}}
												/>
											</div>
											<ArrowUpRight className="h-4 w-4 text-slate-400" />
										</Link>
									))
								) : (
									<div className="text-sm text-slate-500 dark:text-slate-400">No recent views</div>
								)}
							</div>
						</SectionCard>

						{trendingSearches.length > 0 && (
							<SectionCard title="Trending Now" icon={TrendingUp}>
								<div className="flex flex-wrap gap-2">
									{trendingSearches.map((term) => (
										<button
											key={term}
											onClick={() => {
												setQuery(term);
												executeSearchRef.current?.();
											}}
											className="rounded-full border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 px-3 py-1.5 text-sm hover:border-sky-300 dark:hover:border-sky-700 hover:bg-sky-50 dark:hover:bg-sky-500/10"
										>
											{term}
										</button>
									))}
								</div>
							</SectionCard>
						)}
						{analytics && (
							<SectionCard title="Search Stats" icon={BarChart3}>
								<div className="text-sm space-y-2">
									<div className="flex justify-between">
										<span>Searches (30d)</span>
										<span className="font-semibold">{analytics?.totalSearches || "—"}</span>
									</div>
									<div className="flex justify-between">
										<span>Zero-result rate</span>
										<span className="font-semibold">{analytics?.zeroResultRate || "—"}%</span>
									</div>
								</div>
							</SectionCard>
						)}
						{relatedSearches.length > 0 && (
							<SectionCard title="Related Searches" icon={Search}>
								<div className="flex flex-wrap gap-2">
									{relatedSearches.map((term) => (
										<button
											key={term}
											onClick={() => {
												setQuery(term);
												executeSearchRef.current?.();
											}}
											className="rounded-full border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 px-3 py-1.5 text-sm hover:border-sky-300 dark:hover:border-sky-700 hover:bg-sky-50 dark:hover:bg-sky-500/10"
										>
											{term}
										</button>
									))}
								</div>
							</SectionCard>
						)}

						<SectionCard title="Shortcuts & Actions" icon={WandSparkles}>
							<div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
								<div className="flex items-center justify-between rounded-2xl bg-slate-50 dark:bg-slate-900/60 px-4 py-3">
									<span>Open search modal</span>
									<Badge tone="blue">Ctrl K / ⌘K</Badge>
								</div>
								<div className="flex items-center justify-between rounded-2xl bg-slate-50 dark:bg-slate-900/60 px-4 py-3">
									<span>Save search</span>
									<Badge tone="blue">Click Save</Badge>
								</div>
								<div className="flex items-center justify-between rounded-2xl bg-slate-50 dark:bg-slate-900/60 px-4 py-3">
									<span>Share search</span>
									<Badge tone="blue">Click Share</Badge>
								</div>
								<div className="flex items-center justify-between rounded-2xl bg-slate-50 dark:bg-slate-900/60 px-4 py-3">
									<span>Toggle dark mode</span>
									<Badge tone="blue">Click icon</Badge>
								</div>
							</div>
						</SectionCard>
					</aside>
				</div>
			</div>
		</div>
	);
}
