import prisma from "../utils/prisma.js";
import { sanitizeString } from "../utils/validators.js";

function slugify(value = "") {
	return String(value || "")
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/(^-|-$)/g, "");
}

function parseNumber(value) {
	const raw = String(value || "");
	const match = raw.match(/[\d.]+/);
	if (!match) {
		return null;
	}
	const parsed = Number(match[0]);
	return Number.isFinite(parsed) ? parsed : null;
}

function average(values = []) {
	const filtered = values.filter((v) => Number.isFinite(v));
	if (filtered.length === 0) {
		return null;
	}
	const sum = filtered.reduce((acc, v) => acc + v, 0);
	return Math.round((sum / filtered.length) * 10) / 10;
}

function normalizeCategory(value) {
	return sanitizeString(String(value || ""), 120);
}

function collectCategories(users = [], products = []) {
	const counts = new Map();

	(Array.isArray(users) ? users : []).forEach((user) => {
		const categories = Array.isArray(user?.profile?.categories) ? user.profile.categories : [];
		categories.forEach((cat) => {
			const cleaned = normalizeCategory(cat);
			if (!cleaned) {
				return;
			}
			counts.set(cleaned, (counts.get(cleaned) || 0) + 1);
		});
	});
	(Array.isArray(products) ? products : []).forEach((product) => {
		const cat = normalizeCategory(product?.category || product?.industry);
		if (!cat) {
			return;
		}
		counts.set(cat, (counts.get(cat) || 0) + 1);
	});

	return [...counts.entries()]
		.sort((a, b) => b[1] - a[1])
		.map(([label, count]) => ({ label, slug: slugify(label), count }));
}

function matchesCategory(value, targetSlug, targetLabel) {
	const raw = normalizeCategory(value);
	if (!raw) {
		return false;
	}
	if (targetLabel && raw.toLowerCase() === targetLabel.toLowerCase()) {
		return true;
	}
	const s = slugify(raw);
	return s === targetSlug;
}

export async function getIndustrySummary(slug) {
	const safeSlug = slugify(slug || "");
	if (!safeSlug) {
		return null;
	}

	const [users, products, requirements] = await Promise.all([
		prisma.user.findMany(),
		prisma.product.findMany(),
		prisma.requirement.findMany(),
	]);

	const categories = collectCategories(users, products);
	const match = categories.find((c) => c.slug === safeSlug);
	const label = match?.label || sanitizeString(safeSlug.replace(/-/g, " "), 120) || safeSlug;

	const productsForCategory = (Array.isArray(products) ? products : []).filter((p) =>
		matchesCategory(p?.category || p?.industry, safeSlug, label),
	);

	const requirementsForCategory = (Array.isArray(requirements) ? requirements : []).filter((r) =>
		matchesCategory(r?.category || r?.industry || r?.product, safeSlug, label),
	);

	const usersById = new Map((Array.isArray(users) ? users : []).map((u) => [String(u.id), u]));

	const avgMoq = average([
		...productsForCategory.map((p) => parseNumber(p?.moq)),
		...requirementsForCategory.map((r) => parseNumber(r?.moq || r?.quantity)),
	]);

	const avgLeadTime = average([
		...productsForCategory.map((p) => parseNumber(p?.lead_time_days)),
		...requirementsForCategory.map((r) => parseNumber(r?.timeline_days || r?.delivery_timeline)),
	]);

	const topCountries = requirementsForCategory.reduce((acc, req) => {
		const buyer = usersById.get(String(req?.buyer_id || ""));
		const country = sanitizeString(buyer?.profile?.country || "Unknown", 80) || "Unknown";
		acc[country] = (acc[country] || 0) + 1;
		return acc;
	}, {});

	const topCountryList = Object.entries(topCountries)
		.sort((a, b) => b[1] - a[1])
		.slice(0, 5)
		.map(([country, count]) => ({ country, count }));

	const topProducts = productsForCategory
		.slice()
		.sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")))
		.slice(0, 6)
		.map((p) => {
			const company = usersById.get(String(p?.company_id || ""));
			return {
				id: p.id,
				title: p.title || "Product",
				category: p.category || "",
				moq: p.moq || "",
				lead_time_days: p.lead_time_days || "",
				company_id: p.company_id,
				company_name: company?.name || "",
				verified: Boolean(company?.verified),
			};
		});

	const latestRequests = requirementsForCategory
		.slice()
		.sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")))
		.slice(0, 6)
		.map((r) => {
			const buyer = usersById.get(String(r?.buyer_id || ""));
			return {
				id: r.id,
				title: r.title || r.category || "Buyer request",
				category: r.category || "",
				quantity: r.quantity || "",
				moq: r.moq || "",
				price_range: r.price_range || "",
				buyer_id: r.buyer_id,
				buyer_name: buyer?.name || "",
				buyer_verified: Boolean(buyer?.verified),
				created_at: r.created_at,
			};
		});

	return {
		slug: safeSlug,
		category: label,
		counts: {
			products: productsForCategory.length,
			requests: requirementsForCategory.length,
		},
		stats: {
			average_moq: avgMoq,
			average_lead_time_days: avgLeadTime,
			top_countries: topCountryList,
		},
		top_products: topProducts,
		latest_requests: latestRequests,
		categories,
	};
}
