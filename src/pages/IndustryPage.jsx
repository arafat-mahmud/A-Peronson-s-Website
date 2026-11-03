/*
  Route: /industry/:slug
  Access: Protected (login required)
  Allowed roles: buyer, buying_house, factory, owner, admin, agent

  Purpose:
    - Category landing page with pre-filtered results (project.md).
    - AI auto-reply widget for quick outreach using industry stats.
*/

import {
	ArrowUpRight,
	Clock3,
	Globe2,
	Package,
	PackageOpen,
	ShoppingCart,
	Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Mosaic } from "react-loading-indicators";
import { Link, useParams } from "react-router-dom";
import CountUp from "../components/CountUp.jsx";
import { apiRequest, getToken } from "../lib/auth.js";
import { trackClientEvent } from "../lib/events.js";
import usePageMeta from "../lib/usePageMeta.js";

function StatCard({ icon: Icon, label, value, caption }) {
	const isNumeric = typeof value === "number" && !Number.isNaN(value);
	return (
		<div className="rounded-2xl border border-slate-200/70 bg-slate-50/80 p-4 transition hover:-translate-y-0.5 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900/50">
			<div className="flex items-center gap-2 text-sky-600 dark:text-sky-400">
				{Icon ? <Icon className="h-4 w-4" /> : null}
				<span className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
					{label}
				</span>
			</div>
			<div className="mt-3 text-lg font-semibold text-slate-900 dark:text-slate-100">
				{isNumeric ? <CountUp value={value} /> : value}
			</div>
			{caption ? (
				<div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{caption}</div>
			) : null}
		</div>
	);
}

function Pill({ children, tone = "default" }) {
	const tones = {
		default: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
		success: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
		info: "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300",
		warning: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
	};
	return (
		<span
			className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${tones[tone] || tones.default}`}
		>
			{children}
		</span>
	);
}

export default function IndustryPage() {
	const { slug } = useParams();
	usePageMeta({
		title: slug
			? `${slug.charAt(0).toUpperCase() + slug.slice(1).replace(/-/g, " ")} — GarTexHub`
			: "Industry — GarTexHub",
		description: slug
			? `Explore ${slug.replace(/-/g, " ")} products, buyer requests, and suppliers on GarTexHub — the global textile and garment marketplace.`
			: "Explore textile and garment industry categories on GarTexHub.",
		canonical: slug ? `https://gartexhub.onrender.com/industry/${slug}` : "https://gartexhub.onrender.com/industry",
		robots: "noindex,nofollow",
		url: slug ? `/industry/${slug}` : "/industry",
	});

	const token = useMemo(() => getToken(), []);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [summary, setSummary] = useState(null);
	const [requests, setRequests] = useState([]);
	const [products, setProducts] = useState([]);
	const [aiReply, setAiReply] = useState("");
	const [aiLoading, setAiLoading] = useState(false);
	const [aiError, setAiError] = useState("");
	const [copyStatus, setCopyStatus] = useState("");

	useEffect(() => {
		if (!slug) {
			return;
		}
		// eslint-disable-next-line react-hooks/set-state-in-effect
		setLoading(true);
		setError("");
		apiRequest(`/industry/${encodeURIComponent(slug)}`, { token })
			.then((data) => {
				setSummary(data || null);
				if (data?.category) {
					trackClientEvent("industry_page_view", {
						entityType: "industry",
						entityId: slug,
						metadata: { category: data.category },
					});
				}
			})
			.catch((err) => {
				setError(err.message || "Unable to load industry page");
				setSummary(null);
			})
			.finally(() => setLoading(false));
	}, [slug, token]);

	useEffect(() => {
		if (!summary?.category) {
			return;
		}
		const category = summary.category;
		const qs = `category=${encodeURIComponent(category)}`;

		Promise.all([
			apiRequest(`/requirements/search?${qs}`, { token }),
			apiRequest(`/products/search?${qs}`, { token }),
		])
			.then(([reqRes, prodRes]) => {
				setRequests(Array.isArray(reqRes?.items) ? reqRes.items : []);
				setProducts(Array.isArray(prodRes?.items) ? prodRes.items : []);
			})
			.catch(() => {
				setRequests([]);
				setProducts([]);
			});
	}, [summary?.category, token]);

	async function generateAutoReply() {
		if (!slug) {
			return;
		}
		setAiLoading(true);
		setAiError("");
		try {
			const res = await apiRequest(`/industry/${encodeURIComponent(slug)}/auto-reply`, {
				method: "POST",
				token,
			});
			const reply = String(res?.reply || "").trim();
			if (reply) {
				setAiReply(reply);
				setCopyStatus("");
				trackClientEvent("industry_auto_reply", {
					entityType: "industry",
					entityId: slug,
					metadata: { category: summary?.category || "" },
				});
			} else {
				setAiError("Unable to generate a reply yet.");
				setAiReply("");
			}
		} catch (err) {
			setAiError(err.message || "Auto-reply failed");
		} finally {
			setAiLoading(false);
		}
	}

	async function copyReply() {
		if (!aiReply) {
			return;
		}
		try {
			await navigator.clipboard.writeText(aiReply);
			setCopyStatus("Copied to clipboard");
		} catch {
			setCopyStatus("Copy failed");
		}
	}

	if (loading) {
		return (
			<div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(109,171,223,0.22),transparent_30%),radial-gradient(circle_at_top_right,rgba(51,122,176,0.16),transparent_32%),linear-gradient(180deg,rgba(248,250,252,1),rgba(239,246,253,1),rgba(248,250,252,1))] dark:bg-[radial-gradient(circle_at_top_left,rgba(109,171,223,0.16),transparent_26%),radial-gradient(circle_at_top_right,rgba(51,122,176,0.12),transparent_28%),linear-gradient(180deg,rgba(2,6,23,1),rgba(3,7,18,1),rgba(2,6,23,1))] p-6 text-slate-600 dark:text-slate-200 flex items-center justify-center">
				<Mosaic color="#337ab0" size="large" style={{ fontSize: "40px" }} text="" textColor="" />
			</div>
		);
	}

	if (error) {
		return (
			<div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(109,171,223,0.22),transparent_30%),radial-gradient(circle_at_top_right,rgba(51,122,176,0.16),transparent_32%),linear-gradient(180deg,rgba(248,250,252,1),rgba(239,246,253,1),rgba(248,250,252,1))] dark:bg-[radial-gradient(circle_at_top_left,rgba(109,171,223,0.16),transparent_26%),radial-gradient(circle_at_top_right,rgba(51,122,176,0.12),transparent_28%),linear-gradient(180deg,rgba(2,6,23,1),rgba(3,7,18,1),rgba(2,6,23,1))] p-6 text-rose-700 dark:text-rose-200">
				{error}
			</div>
		);
	}

	const stats = summary?.stats || {};
	const topCountries = Array.isArray(stats.top_countries) ? stats.top_countries : [];
	const displayCategory = summary?.category || slug;

	return (
		<div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(109,171,223,0.22),transparent_30%),radial-gradient(circle_at_top_right,rgba(51,122,176,0.16),transparent_32%),linear-gradient(180deg,rgba(248,250,252,1),rgba(239,246,253,1),rgba(248,250,252,1))] text-slate-900 dark:bg-[radial-gradient(circle_at_top_left,rgba(109,171,223,0.16),transparent_26%),radial-gradient(circle_at_top_right,rgba(51,122,176,0.12),transparent_28%),linear-gradient(180deg,rgba(2,6,23,1),rgba(3,7,18,1),rgba(2,6,23,1))] dark:text-slate-100">
			<div className="mx-auto max-w-7xl px-4 py-6 space-y-6">
				<div className="rounded-3xl border border-slate-200/70 bg-white/80 p-5 shadow-[0_20px_70px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/70">
					<div className="flex flex-wrap items-center justify-between gap-4">
						<div>
							<div className="flex items-center gap-2 text-sky-600 dark:text-sky-400">
								<Globe2 className="h-4 w-4" />
								<span className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
									Industry page
								</span>
							</div>
							<h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
								{displayCategory}
							</h1>
							<p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
								Live marketplace snapshot for {displayCategory}. Pre-filtered search results below.
							</p>
						</div>
						<Link
							to={`/search?category=${encodeURIComponent(displayCategory)}`}
							className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-sky-300 hover:text-sky-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
						>
							Open full search
							<ArrowUpRight size={14} />
						</Link>
					</div>

					<div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
						<StatCard
							icon={ShoppingCart}
							label="Buyer requests"
							value={summary?.counts?.requests ?? 0}
						/>
						<StatCard
							icon={Package}
							label="Products listed"
							value={summary?.counts?.products ?? 0}
						/>
						<StatCard
							icon={Clock3}
							label="Avg lead time (days)"
							value={stats.average_lead_time_days ?? "--"}
						/>
					</div>

					<div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
						<StatCard icon={PackageOpen} label="Avg MOQ" value={stats.average_moq ?? "--"} />
						<div className="rounded-2xl border border-slate-200/70 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/50">
							<div className="flex items-center gap-2 text-sky-600 dark:text-sky-400">
								<Globe2 className="h-4 w-4" />
								<span className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
									Top buyer regions
								</span>
							</div>
							<div className="mt-3 text-sm font-semibold text-slate-900 dark:text-slate-100">
								{topCountries.length > 0 ? topCountries.map((c) => c.country).join(", ") : "--"}
							</div>
						</div>
					</div>
				</div>

				<div className="rounded-3xl border border-slate-200/70 bg-white/80 p-5 shadow-[0_20px_70px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/70">
					<div className="flex items-center justify-between gap-3">
						<div>
							<div className="flex items-center gap-2">
								<Sparkles className="h-4 w-4 text-sky-500" />
								<h3 className="text-sm font-semibold tracking-wide text-slate-900 dark:text-slate-100">
									AI auto-reply
								</h3>
							</div>
							<p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
								Generate a quick outreach message using live industry stats.
							</p>
						</div>
						<button
							type="button"
							onClick={generateAutoReply}
							disabled={aiLoading}
							className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-slate-900"
						>
							<Sparkles size={14} />
							{aiLoading ? "Thinking..." : "Generate"}
						</button>
					</div>
					{aiError ? (
						<div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200">
							{aiError}
						</div>
					) : null}
					{aiReply ? (
						<div className="mt-4 rounded-2xl border border-slate-200/70 bg-slate-50/80 p-4 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-100">
							<p className="whitespace-pre-wrap">{aiReply}</p>
							<div className="mt-3 flex items-center gap-3 text-xs text-slate-500">
								<button
									type="button"
									onClick={copyReply}
									className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-sky-300 hover:text-sky-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
								>
									Copy
								</button>
								{copyStatus ? <span className="text-sky-600">{copyStatus}</span> : null}
							</div>
						</div>
					) : null}
				</div>

				<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
					<div className="rounded-3xl border border-slate-200/70 bg-white/80 p-5 shadow-[0_20px_70px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/70">
						<div className="flex items-center gap-2 mb-3">
							<ShoppingCart className="h-4 w-4 text-sky-500" />
							<h3 className="text-sm font-semibold tracking-wide text-slate-900 dark:text-slate-100">
								Latest buyer requests
							</h3>
						</div>
						<div className="space-y-3">
							{(requests || []).slice(0, 6).map((req) => (
								<div
									key={req.id}
									className="rounded-2xl border border-slate-200/70 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/60"
								>
									<p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
										{req.title || req.category || "Buyer request"}
									</p>
									<p className="mt-1 text-xs text-slate-500">
										{req.category || "--"} - MOQ {req.moq || "--"} - Price {req.price_range || "--"}
									</p>
									<p className="mt-2 text-xs text-slate-500">
										Buyer: {req.author?.name || req.buyer_name || "Buyer"}
									</p>
								</div>
							))}
							{requests.length > 0 ? null : (
								<div className="text-sm text-slate-500 dark:text-slate-400">No requests yet.</div>
							)}
						</div>
					</div>

					<div className="rounded-3xl border border-slate-200/70 bg-white/80 p-5 shadow-[0_20px_70px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/70">
						<div className="flex items-center gap-2 mb-3">
							<Package className="h-4 w-4 text-sky-500" />
							<h3 className="text-sm font-semibold tracking-wide text-slate-900 dark:text-slate-100">
								Top products
							</h3>
						</div>
						<div className="space-y-3">
							{(products || []).slice(0, 6).map((product) => (
								<div
									key={product.id}
									className="rounded-2xl border border-slate-200/70 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/60"
								>
									<p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
										{product.title || "Product"}
									</p>
									<p className="mt-1 text-xs text-slate-500">
										{product.category || "--"} - MOQ {product.moq || "--"} - Lead time{" "}
										{product.lead_time_days || "--"}
									</p>
									<p className="mt-2 text-xs text-slate-500">
										Company: {product.author?.name || product.company_name || "Company"}
									</p>
								</div>
							))}
							{products.length > 0 ? null : (
								<div className="text-sm text-slate-500 dark:text-slate-400">No products yet.</div>
							)}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
