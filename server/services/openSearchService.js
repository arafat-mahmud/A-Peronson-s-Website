import { logInfo, logWarn } from "../utils/logger.js";
import prisma from "../utils/prisma.js";
import { getAdminConfig } from "./adminConfigService.js";
import { getBaseCurrency, normalizeMoney } from "./currencyService.js";

const CONFIG_TTL_MS = 15_000;
const RESPONSE_CACHE_TTL_MS = 10 * 60 * 1000;
const DEFAULT_PREFIX = "gartexhub_";

let cachedConfig = { at: 0, value: null };
let clientState = { key: "", client: null };
let lastStatus = { last_ok_at: "", last_error_at: "", last_error: "" };
let responseCache = { at: 0, map: new Map() };

function now() {
	return Date.now();
}

function safeString(value) {
	return String(value || "").trim();
}

function normalizeKeyword(value) {
	return safeString(value).toLowerCase();
}

function normalizeKeywordList(values = []) {
	const rows = Array.isArray(values) ? values : [];
	return rows.map((value) => normalizeKeyword(value)).filter(Boolean);
}

function parseNumberLike(value) {
	if (value === undefined || value === null) {
		return null;
	}
	const raw = safeString(value);
	if (!raw) {
		return null;
	}
	const n = Number(raw.replace(/[^\d.]/g, ""));
	return Number.isFinite(n) ? n : null;
}

function parseRangeValue(value) {
	const raw = safeString(value);
	if (!raw) {
		return { min: null, max: null };
	}
	const [minRaw, maxRaw] = raw.split("-");
	const min = minRaw ? Number(String(minRaw).replace(/[^\d.]/g, "")) : null;
	const max = maxRaw ? Number(String(maxRaw).replace(/[^\d.]/g, "")) : null;
	return {
		min: Number.isFinite(min) ? min : null,
		max: Number.isFinite(max) ? max : null,
	};
}

function normalizePrefix(value) {
	const prefix = safeString(value) || DEFAULT_PREFIX;
	return prefix.endsWith("_") ? prefix : `${prefix}_`;
}

function buildGeoPoint(lat, lng) {
	const latNum = Number(lat);
	const lngNum = Number(lng);
	if (!(Number.isFinite(latNum) && Number.isFinite(lngNum))) {
		return null;
	}
	return { lat: latNum, lon: lngNum };
}

function splitTokens(value) {
	const raw = safeString(value).toLowerCase();
	if (!raw) {
		return [];
	}
	return raw
		.split(/[,/;|]+/g)
		.map((entry) => entry.trim())
		.filter(Boolean);
}

function parsePantoneCodes(value) {
	const raw = safeString(value).toUpperCase();
	if (!raw) {
		return [];
	}
	return raw
		.split(/[,;|]+/g)
		.map((entry) => entry.trim())
		.filter(Boolean);
}

function mapTotalHits(total) {
	if (typeof total === "number") {
		return total;
	}
	const value = Number(total?.value);
	return Number.isFinite(value) ? value : 0;
}

async function loadConfig() {
	if (cachedConfig.value && now() - cachedConfig.at < CONFIG_TTL_MS) {
		return cachedConfig.value;
	}
	const admin = await getAdminConfig();
	const raw = admin?.integrations?.opensearch || {};

	const envUrl = safeString(process.env.OPENSEARCH_URL || "");
	const envUser = safeString(process.env.OPENSEARCH_USERNAME || "");
	const envPass = safeString(process.env.OPENSEARCH_PASSWORD || "");

	const cfg = {
		enabled: Boolean(raw.enabled) || Boolean(envUrl),
		url: safeString(raw.url) || envUrl,
		username: safeString(raw.username) || envUser,
		password: safeString(raw.password) || envPass,
		index_prefix: normalizePrefix(raw.index_prefix),
		timeout_ms: Math.max(500, Math.min(60_000, Number(raw.timeout_ms || 3000))),
		verify_tls: raw.verify_tls !== false,
	};
	cachedConfig = { at: now(), value: cfg };
	return cfg;
}

function buildClientKey(cfg) {
	return JSON.stringify({
		url: cfg.url,
		username: cfg.username,
		password: cfg.password,
		timeout_ms: cfg.timeout_ms,
		verify_tls: cfg.verify_tls,
	});
}

async function getClient() {
	const cfg = await loadConfig();
	if (!(cfg.enabled && cfg.url)) {
		return { cfg, client: null };
	}
	const key = buildClientKey(cfg);
	if (!clientState.client || clientState.key !== key) {
		const { Client } = await import("@opensearch-project/opensearch");
		clientState = {
			key,
			client: new Client({
				node: cfg.url,
				auth: cfg.username ? { username: cfg.username, password: cfg.password } : undefined,
				requestTimeout: cfg.timeout_ms,
				ssl: { rejectUnauthorized: Boolean(cfg.verify_tls) },
			}),
		};
	}
	return { cfg, client: clientState.client };
}

export async function isOpenSearchConfigured() {
	const cfg = await loadConfig();
	return Boolean(cfg.enabled && cfg.url);
}

function productMappings() {
	return {
		properties: {
			id: { type: "keyword" },
			title: { type: "text" },
			category: { type: "keyword" },
			industry: { type: "keyword" },
			material: {
				type: "text",
				fields: { keyword: { type: "keyword", ignore_above: 256 } },
			},
			size_range: { type: "keyword" },
			color_pantone_codes: { type: "keyword" },
			customization: { type: "keyword" },
			sample_available: { type: "boolean" },
			sample_lead_time_days: { type: "double" },
			moq_value: { type: "double" },
			price_base_min: { type: "double" },
			price_base_max: { type: "double" },
			base_currency: { type: "keyword" },
			lead_time_days: { type: "double" },
			fabric_gsm: { type: "double" },
			created_at: { type: "date" },
			verified: { type: "boolean" },
			org_type: { type: "keyword" },
			country: { type: "keyword" },
			certifications: { type: "keyword" },
			incoterms: { type: "keyword" },
			payment_terms: { type: "keyword" },
			document_ready: { type: "keyword" },
			language_support: { type: "keyword" },
			processes: { type: "keyword" },
			export_ports: { type: "keyword" },
			monthly_capacity: { type: "double" },
			years_in_business: { type: "double" },
			team_seats: { type: "double" },
			handles_multiple_factories: { type: "boolean" },
			avg_response_hours: { type: "double" },
			audit_date: { type: "keyword" },
			role_seats: { type: "object" },
			location: { type: "geo_point" },
		},
	};
}

function requirementMappings() {
	return {
		properties: {
			id: { type: "keyword" },
			title: { type: "text" },
			category: { type: "keyword" },
			industry: { type: "keyword" },
			material: {
				type: "text",
				fields: { keyword: { type: "keyword", ignore_above: 256 } },
			},
			size_range: { type: "keyword" },
			color_pantone_codes: { type: "keyword" },
			customization: { type: "keyword" },
			sample_available: { type: "boolean" },
			sample_lead_time_days: { type: "double" },
			capacity_min: { type: "double" },
			moq_value: { type: "double" },
			price_base_min: { type: "double" },
			price_base_max: { type: "double" },
			base_currency: { type: "keyword" },
			lead_time_days: { type: "double" },
			fabric_gsm: { type: "double" },
			created_at: { type: "date" },
			certifications: { type: "keyword" },
			incoterms: { type: "keyword" },
			payment_terms: { type: "keyword" },
			document_ready: { type: "keyword" },
			audit_date: { type: "keyword" },
			language_support: { type: "keyword" },
			verified: { type: "boolean" },
			org_type: { type: "keyword" },
			country: { type: "keyword" },
			processes: { type: "keyword" },
			export_ports: { type: "keyword" },
			years_in_business: { type: "double" },
			team_seats: { type: "double" },
			handles_multiple_factories: { type: "boolean" },
			avg_response_hours: { type: "double" },
			role_seats: { type: "object" },
			location: { type: "geo_point" },
		},
	};
}

async function ensureIndex(indexName, mappings) {
	const { client } = await getClient();
	if (!client) {
		return { ok: false, reason: "not_configured" };
	}
	const exists = await client.indices.exists({ index: indexName });
	if (exists?.body === true) {
		return { ok: true, created: false };
	}
	await client.indices.create({
		index: indexName,
		body: {
			settings: {
				number_of_shards: 1,
				number_of_replicas: 0,
			},
			mappings,
		},
	});
	return { ok: true, created: true };
}

async function deleteIndexIfExists(indexName) {
	const { client } = await getClient();
	if (!client) {
		return;
	}
	try {
		await client.indices.delete({ index: indexName });
	} catch {
		// ignore
	}
}

async function buildResponseTimeByOwner() {
	if (responseCache.map.size > 0 && now() - responseCache.at < RESPONSE_CACHE_TTL_MS) {
		return responseCache.map;
	}
	const [msgRows, userRows] = await Promise.all([
		prisma.message.findMany(),
		prisma.user.findMany(),
	]);

	const ownerByMember = new Map();
	for (const user of userRows) {
		const userId = String(user?.id || "");
		if (!userId) {
			continue;
		}
		const role = String(user?.role || "").toLowerCase();
		const ownerId = role === "agent" && user?.org_owner_id ? String(user.org_owner_id) : userId;
		ownerByMember.set(userId, ownerId);
	}

	const messagesByMatch = new Map();
	for (const msg of msgRows) {
		const matchId = String(msg?.match_id || "");
		if (!matchId || matchId.startsWith("friend:")) {
			continue;
		}
		if (!messagesByMatch.has(matchId)) {
			messagesByMatch.set(matchId, []);
		}
		messagesByMatch.get(matchId).push(msg);
	}

	const responseTimes = new Map();

	for (const msgs of messagesByMatch.values()) {
		const sorted = msgs
			.slice()
			.sort((a, b) => String(a.timestamp || "").localeCompare(String(b.timestamp || "")));
		const ownersInMatch = new Set(
			sorted
				.map((m) => ownerByMember.get(String(m.sender_id || "")) || String(m.sender_id || ""))
				.filter(Boolean),
		);

		for (const ownerId of ownersInMatch) {
			let inboundAt = null;
			for (const message of sorted) {
				const senderOwner =
					ownerByMember.get(String(message.sender_id || "")) || String(message.sender_id || "");
				if (!senderOwner || senderOwner === ownerId) {
					continue;
				}
				const ts = new Date(message.timestamp || "").getTime();
				if (!Number.isFinite(ts)) {
					continue;
				}
				inboundAt = ts;
				break;
			}
			if (!inboundAt) {
				continue;
			}

			let outboundAt = null;
			for (const message of sorted) {
				const senderOwner =
					ownerByMember.get(String(message.sender_id || "")) || String(message.sender_id || "");
				if (!senderOwner || senderOwner !== ownerId) {
					continue;
				}
				const ts = new Date(message.timestamp || "").getTime();
				if (!Number.isFinite(ts) || ts < inboundAt) {
					continue;
				}
				outboundAt = ts;
				break;
			}
			if (!outboundAt) {
				continue;
			}

			const hours = (outboundAt - inboundAt) / (1000 * 60 * 60);
			if (!responseTimes.has(ownerId)) {
				responseTimes.set(ownerId, []);
			}
			responseTimes.get(ownerId).push(hours);
		}
	}

	const averages = new Map();
	for (const [ownerId, times] of responseTimes.entries()) {
		const avg = times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0;
		averages.set(ownerId, Math.round(avg * 10) / 10);
	}

	responseCache = { at: now(), map: averages };
	return averages;
}

async function buildProductDoc(product, author = {}, responseMap = null) {
	const baseCurrency = await getBaseCurrency();
	const priceRange = parseRangeValue(product.price_range || "");
	const originalCurrency = normalizeKeyword(
		product.currency || product.currencyOriginal || baseCurrency,
	).toUpperCase();
	const priceBaseMin = Number.isFinite(Number(product.priceBaseMin))
		? Number(product.priceBaseMin)
		: priceRange.min === null
			? Number(product.priceNormalizedBase) || null
			: (await normalizeMoney(priceRange.min, originalCurrency, baseCurrency)).amount;
	const priceBaseMax = Number.isFinite(Number(product.priceBaseMax))
		? Number(product.priceBaseMax)
		: priceRange.max === null
			? Number(product.priceNormalizedBase) || null
			: (await normalizeMoney(priceRange.max, originalCurrency, baseCurrency)).amount;
	const moqValue = parseNumberLike(product.moq);
	const leadTime = parseNumberLike(product.lead_time_days || author.lead_time_days);
	const fabricGsm = parseNumberLike(product.fabric_gsm);
	const sampleLead = parseNumberLike(product.sample_lead_time_days);
	const sampleAvailable = (() => {
		const raw = safeString(product.sample_available).toLowerCase();
		if (raw === "true" || raw === "yes") {
			return true;
		}
		return Boolean(sampleLead);
	})();
	const responseTimes = responseMap || (await buildResponseTimeByOwner());
	const ownerId = String(author.id || "");
	const avgResponse = responseTimes.has(ownerId) ? responseTimes.get(ownerId) : null;
	return {
		id: product.id,
		title: product.title || "",
		category: normalizeKeyword(product.category),
		industry: normalizeKeyword(product.industry || author.industry),
		material: normalizeKeyword(product.material),
		size_range: normalizeKeyword(product.size_range),
		color_pantone_codes: parsePantoneCodes(product.color_pantone),
		customization: splitTokens(product.customization_capabilities),
		sample_available: sampleAvailable,
		sample_lead_time_days: sampleLead,
		moq_value: moqValue,
		price_base_min: priceBaseMin,
		price_base_max: priceBaseMax,
		base_currency: baseCurrency,
		lead_time_days: leadTime,
		fabric_gsm: fabricGsm,
		created_at: product.created_at || new Date().toISOString(),
		verified: Boolean(author.verified),
		org_type: normalizeKeyword(author.role),
		country: normalizeKeyword(author.country),
		certifications: normalizeKeywordList(author.certifications),
		incoterms: splitTokens(author.incoterms),
		payment_terms: splitTokens(author.payment_terms),
		document_ready: splitTokens(author.document_ready),
		language_support: splitTokens(author.language_support),
		processes: normalizeKeywordList(author.main_processes),
		export_ports: normalizeKeywordList(author.export_ports),
		monthly_capacity: parseNumberLike(author.monthly_capacity),
		years_in_business: parseNumberLike(author.years_in_business),
		team_seats: parseNumberLike(author.team_seats),
		handles_multiple_factories: Boolean(author.handles_multiple_factories),
		avg_response_hours: avgResponse,
		audit_date: normalizeKeyword(author.audit_date),
		// normalize role seats (flatten keys to lowercase numbers when possible)
		role_seats: (() => {
			const raw =
				author.role_seats || author.roleSeats || author.permission_matrix?.members?.seats || null;
			if (!raw || typeof raw !== "object") {
				return null;
			}
			const mapped = {};
			Object.entries(raw).forEach(([k, v]) => {
				const key = String(k || "").toLowerCase();
				const n = parseNumberLike(v);
				mapped[key] = n === null ? v : n;
			});
			return mapped;
		})(),
		location: buildGeoPoint(author.location_lat, author.location_lng),
	};
}

function shouldIndexProduct(product) {
	const status = safeString(product?.status || "published").toLowerCase();
	if (status && status !== "published") {
		return false;
	}
	const reviewStatus = safeString(
		product?.content_review_status || product?.contentReviewStatus || "approved",
	).toLowerCase();
	return !reviewStatus || reviewStatus === "approved";
}

async function buildRequirementDoc(req, author = {}, responseMap = null) {
	const baseCurrency = await getBaseCurrency();
	const priceRange = parseRangeValue(req.price_range || req.target_price || "");
	const originalCurrency = normalizeKeyword(
		req.currency || req.currencyOriginal || baseCurrency,
	).toUpperCase();
	const priceBaseMin = Number.isFinite(Number(req.priceBaseMin))
		? Number(req.priceBaseMin)
		: priceRange.min === null
			? Number(req.priceNormalizedBase) || null
			: (await normalizeMoney(priceRange.min, originalCurrency, baseCurrency)).amount;
	const priceBaseMax = Number.isFinite(Number(req.priceBaseMax))
		? Number(req.priceBaseMax)
		: priceRange.max === null
			? Number(req.priceNormalizedBase) || null
			: (await normalizeMoney(priceRange.max, originalCurrency, baseCurrency)).amount;
	const moqValue = parseNumberLike(req.moq || req.quantity);
	const leadTime = parseNumberLike(req.timeline_days || req.delivery_timeline || "");
	const fabricGsm = parseNumberLike(req.fabric_gsm);
	const sampleLead = parseNumberLike(req.sample_lead_time_days || req.sample_timeline);
	const sampleAvailable = (() => {
		const raw = safeString(req.sample_available).toLowerCase();
		if (raw === "true" || raw === "yes") {
			return true;
		}
		return Boolean(sampleLead);
	})();
	const capacityMin = parseNumberLike(req.capacity_min);
	const responseTimes = responseMap || (await buildResponseTimeByOwner());
	const ownerId = String(author.id || "");
	const avgResponse = responseTimes.has(ownerId) ? responseTimes.get(ownerId) : null;
	return {
		id: req.id,
		title: req.title || "",
		category: normalizeKeyword(req.category),
		industry: normalizeKeyword(req.industry),
		material: normalizeKeyword(req.material),
		size_range: normalizeKeyword(req.size_range),
		color_pantone_codes: parsePantoneCodes(req.color_pantone),
		customization: splitTokens(req.customization_capabilities),
		sample_available: sampleAvailable,
		sample_lead_time_days: sampleLead,
		capacity_min: capacityMin,
		moq_value: moqValue,
		price_base_min: priceBaseMin,
		price_base_max: priceBaseMax,
		base_currency: baseCurrency,
		lead_time_days: leadTime,
		fabric_gsm: fabricGsm,
		created_at: req.created_at || new Date().toISOString(),
		certifications: normalizeKeywordList(req.certifications_required),
		incoterms: splitTokens(req.incoterms),
		payment_terms: splitTokens(req.payment_terms),
		document_ready: splitTokens(req.document_ready),
		audit_date: normalizeKeyword(req.audit_date),
		language_support: splitTokens(req.language_support),
		verified: Boolean(author.verified),
		org_type: normalizeKeyword(author.role),
		country: normalizeKeyword(author.country),
		processes: normalizeKeywordList(author.main_processes),
		export_ports: normalizeKeywordList(author.export_ports),
		years_in_business: parseNumberLike(author.years_in_business),
		team_seats: parseNumberLike(author.team_seats),
		handles_multiple_factories: Boolean(author.handles_multiple_factories),
		avg_response_hours: avgResponse,
		// normalize role seats (flatten keys to lowercase numbers when possible)
		role_seats: (() => {
			const raw =
				author.role_seats || author.roleSeats || author.permission_matrix?.members?.seats || null;
			if (!raw || typeof raw !== "object") {
				return null;
			}
			const mapped = {};
			Object.entries(raw).forEach(([k, v]) => {
				const key = String(k || "").toLowerCase();
				const n = parseNumberLike(v);
				mapped[key] = n === null ? v : n;
			});
			return mapped;
		})(),
		location: buildGeoPoint(author.location_lat, author.location_lng),
	};
}

export async function ensureOpenSearchIndices() {
	const cfg = await loadConfig();
	if (!(cfg.enabled && cfg.url)) {
		return { ok: false, reason: "not_configured" };
	}
	const productsIndex = `${cfg.index_prefix}products`;
	const requirementsIndex = `${cfg.index_prefix}requirements`;
	await ensureIndex(productsIndex, productMappings());
	await ensureIndex(requirementsIndex, requirementMappings());
	return { ok: true };
}

export async function indexProduct(product, author) {
	if (!shouldIndexProduct(product)) {
		await deleteProductIndex(String(product?.id || ""));
		return;
	}
	const { cfg, client } = await getClient();
	if (!client) {
		return;
	}
	const indexName = `${cfg.index_prefix}products`;
	await ensureIndex(indexName, productMappings());
	const responseMap = await buildResponseTimeByOwner();
	const doc = await buildProductDoc(product, author, responseMap);
	await client.index({
		index: indexName,
		id: doc.id,
		body: doc,
		refresh: true,
	});
}

export async function indexRequirement(req, author) {
	const { cfg, client } = await getClient();
	if (!client) {
		return;
	}
	const indexName = `${cfg.index_prefix}requirements`;
	await ensureIndex(indexName, requirementMappings());
	const responseMap = await buildResponseTimeByOwner();
	const doc = await buildRequirementDoc(req, author, responseMap);
	await client.index({
		index: indexName,
		id: doc.id,
		body: doc,
		refresh: true,
	});
}

export async function deleteProductIndex(id) {
	const { cfg, client } = await getClient();
	if (!client) {
		return;
	}
	const indexName = `${cfg.index_prefix}products`;
	try {
		await client.delete({ index: indexName, id, refresh: true });
	} catch {
		// ignore
	}
}

export async function deleteRequirementIndex(id) {
	const { cfg, client } = await getClient();
	if (!client) {
		return;
	}
	const indexName = `${cfg.index_prefix}requirements`;
	try {
		await client.delete({ index: indexName, id, refresh: true });
	} catch {
		// ignore
	}
}

function buildFacetAggs() {
	return {
		category: { terms: { field: "category", size: 12 } },
		certifications: { terms: { field: "certifications", size: 12 } },
		processes: { terms: { field: "processes", size: 12 } },
		languageSupport: { terms: { field: "language_support", size: 12 } },
		incoterms: { terms: { field: "incoterms", size: 12 } },
		paymentTerms: { terms: { field: "payment_terms", size: 12 } },
		documentReady: { terms: { field: "document_ready", size: 12 } },
		exportPort: { terms: { field: "export_ports", size: 12 } },
		fabricType: { terms: { field: "material.keyword", size: 12 } },
	};
}

function aggsToFacets(aggs = {}) {
	const out = {};
	Object.entries(aggs || {}).forEach(([key, value]) => {
		const buckets = value?.buckets || [];
		out[key] = Object.fromEntries(
			buckets.map((bucket) => [String(bucket.key), Number(bucket.doc_count || 0)]),
		);
	});
	return out;
}

function buildRangeFilter(field, range) {
	const filter = {};
	if (range.min !== null) {
		filter.gte = range.min;
	}
	if (range.max !== null) {
		filter.lte = range.max;
	}
	return Object.keys(filter).length > 0 ? { range: { [field]: filter } } : null;
}

function addTermFilter(filters, field, value) {
	if (!value) {
		return;
	}
	filters.push({ term: { [field]: value } });
}

function addTermsFilter(filters, field, values = []) {
	if (values?.length === 0) {
		return;
	}
	filters.push({ terms: { [field]: values } });
}

export async function searchOpenSearch({
	index,
	query,
	filters = {},
	cursor = 0,
	limit = 20,
	estimateOnly = false,
} = {}) {
	const cfg = await loadConfig();
	if (!(cfg.enabled && cfg.url)) {
		return {
			engine: "database",
			error_code: "not_configured",
			ids: [],
			facets: null,
			total: 0,
		};
	}

	const { client } = await getClient();
	if (!client) {
		return {
			engine: "database",
			error_code: "not_configured",
			ids: [],
			facets: null,
			total: 0,
		};
	}

	const indexName = `${cfg.index_prefix}${index}`;
	const must = [];
	const filter = [];

	if (query) {
		must.push({
			multi_match: {
				query,
				fields: ["title^2", "category", "material", "industry"],
			},
		});
	}

	addTermFilter(filter, "industry", filters.industry);
	addTermFilter(filter, "country", filters.country);
	addTermFilter(filter, "org_type", filters.orgType);
	if (filters.verifiedOnly) {
		addTermFilter(filter, "verified", true);
	}
	if (filters.category?.length > 0) {
		addTermsFilter(filter, "category", filters.category);
	}
	if (filters.fabricType?.length > 0) {
		addTermsFilter(filter, "material.keyword", filters.fabricType);
	}
	if (filters.certifications?.length > 0) {
		addTermsFilter(filter, "certifications", filters.certifications);
	}
	if (filters.processes?.length > 0) {
		addTermsFilter(filter, "processes", filters.processes);
	}
	if (filters.languageSupport?.length > 0) {
		addTermsFilter(filter, "language_support", filters.languageSupport);
	}
	if (filters.incoterms?.length > 0) {
		addTermsFilter(filter, "incoterms", filters.incoterms);
	}
	if (filters.paymentTerms?.length > 0) {
		addTermsFilter(filter, "payment_terms", filters.paymentTerms);
	}
	if (filters.documentReady?.length > 0) {
		addTermsFilter(filter, "document_ready", filters.documentReady);
	}
	if (filters.exportPort?.length > 0) {
		addTermsFilter(filter, "export_ports", filters.exportPort);
	}

	const moqRange = parseRangeValue(filters.moqRange);
	const moqFilter = buildRangeFilter("moq_value", moqRange);
	if (moqFilter) {
		filter.push(moqFilter);
	}

	const priceRange = parseRangeValue(filters.priceRangeBase || filters.priceRange);
	const priceMinFilter = buildRangeFilter("price_base_min", priceRange);
	const priceMaxFilter = buildRangeFilter("price_base_max", priceRange);
	if (priceMinFilter) {
		filter.push(priceMinFilter);
	}
	if (priceMaxFilter) {
		filter.push(priceMaxFilter);
	}

	if (filters.leadTimeMax) {
		filter.push({
			range: { lead_time_days: { lte: Number(filters.leadTimeMax) } },
		});
	}
	if (filters.gsmMin) {
		filter.push({ range: { fabric_gsm: { gte: Number(filters.gsmMin) } } });
	}
	if (filters.gsmMax) {
		filter.push({ range: { fabric_gsm: { lte: Number(filters.gsmMax) } } });
	}
	if (
		filters.capacityMin !== undefined &&
		filters.capacityMin !== null &&
		String(filters.capacityMin).trim() !== ""
	) {
		const capacityField = index === "requirements" ? "capacity_min" : "monthly_capacity";
		filter.push({
			range: { [capacityField]: { gte: Number(filters.capacityMin) } },
		});
	}
	if (filters.yearsInBusinessMin) {
		filter.push({
			range: { years_in_business: { gte: Number(filters.yearsInBusinessMin) } },
		});
	}
	if (filters.teamSeatsMin) {
		filter.push({
			range: { team_seats: { gte: Number(filters.teamSeatsMin) } },
		});
	}
	if (filters.responseTimeMax) {
		filter.push({
			range: { avg_response_hours: { lte: Number(filters.responseTimeMax) } },
		});
	}
	if (filters.handlesMultipleFactories !== undefined && filters.handlesMultipleFactories !== null) {
		addTermFilter(filter, "handles_multiple_factories", Boolean(filters.handlesMultipleFactories));
	}

	// roleSeats filter: accepts a comma-separated list like "manager:2,admin:1"
	if (filters.roleSeats) {
		const raw = String(filters.roleSeats || "").trim();
		if (raw) {
			for (const part of raw.split(",")) {
				const [roleRaw, seatsRaw] = String(part || "")
					.split(":")
					.map((s) => (s || "").trim());
				if (!roleRaw) {
					continue;
				}
				const roleKey = String(roleRaw || "").toLowerCase();
				const minSeats = parseNumberLike(seatsRaw);
				if (minSeats === null) {
					continue;
				}
				// Match documents where role_seats.<roleKey> >= minSeats OR team_seats >= minSeats
				filter.push({
					bool: {
						should: [
							{ range: { [`role_seats.${roleKey}`]: { gte: minSeats } } },
							{ range: { team_seats: { gte: minSeats } } },
						],
					},
				});
			}
		}
	}
	if (filters.sampleAvailable) {
		addTermFilter(filter, "sample_available", true);
	}
	if (
		filters.sampleLeadTimeMax !== undefined &&
		filters.sampleLeadTimeMax !== null &&
		String(filters.sampleLeadTimeMax).trim() !== ""
	) {
		filter.push({
			range: {
				sample_lead_time_days: { lte: Number(filters.sampleLeadTimeMax) },
			},
		});
	}
	if (filters.auditDate) {
		addTermFilter(filter, "audit_date", String(filters.auditDate));
	}

	if (filters.sizeRange) {
		addTermFilter(filter, "size_range", String(filters.sizeRange));
	}
	if (filters.colorPantone?.length > 0) {
		addTermsFilter(
			filter,
			"color_pantone_codes",
			filters.colorPantone.map((c) => String(c).toUpperCase()),
		);
	}
	if (filters.customization?.length > 0) {
		addTermsFilter(
			filter,
			"customization",
			filters.customization.map((c) => String(c).toLowerCase()),
		);
	}

	if (
		filters.locationLat !== undefined &&
		filters.locationLat !== null &&
		filters.locationLng !== undefined &&
		filters.locationLng !== null &&
		filters.distanceKm
	) {
		filter.push({
			geo_distance: {
				distance: `${filters.distanceKm}km`,
				location: {
					lat: Number(filters.locationLat),
					lon: Number(filters.locationLng),
				},
			},
		});
	}

	const from = Math.max(0, Number(cursor || 0));
	const size = estimateOnly ? 0 : Math.min(50, Math.max(1, Number(limit || 20)));

	const body = {
		from,
		size,
		track_total_hits: true,
		query: { bool: { must: must.length > 0 ? must : [{ match_all: {} }], filter } },
		aggs: buildFacetAggs(),
		...(query ? {} : { sort: [{ created_at: "desc" }] }),
	};

	try {
		const response = await client.search({ index: indexName, body });
		const hits = response?.body?.hits?.hits || [];
		const ids = hits.map((hit) => hit._id);
		const facets = aggsToFacets(response?.body?.aggregations || {});
		const total = mapTotalHits(response?.body?.hits?.total);
		lastStatus = {
			...lastStatus,
			last_ok_at: new Date().toISOString(),
			last_error: "",
		};
		return { engine: "opensearch", ids, facets, total };
	} catch (error) {
		lastStatus = {
			last_ok_at: lastStatus.last_ok_at,
			last_error_at: new Date().toISOString(),
			last_error: error?.message || "opensearch_error",
		};
		return {
			engine: "database",
			error_code: "opensearch_error",
			ids: [],
			facets: null,
			total: 0,
		};
	}
}

export async function reindexAll({ reset = false } = {}) {
	const cfg = await loadConfig();
	if (!(cfg.enabled && cfg.url)) {
		return { ok: false, reason: "not_configured" };
	}
	const { client } = await getClient();
	if (!client) {
		return { ok: false, reason: "not_configured" };
	}

	const productsIndex = `${cfg.index_prefix}products`;
	const requirementsIndex = `${cfg.index_prefix}requirements`;

	if (reset) {
		await deleteIndexIfExists(productsIndex);
		await deleteIndexIfExists(requirementsIndex);
	}

	await ensureIndex(productsIndex, productMappings());
	await ensureIndex(requirementsIndex, requirementMappings());

	const [productRows, requirements, users] = await Promise.all([
		prisma.product.findMany(),
		prisma.requirement.findMany(),
		prisma.user.findMany(),
	]);

	const usersById = new Map(users.map((u) => [String(u.id), u]));
	const responseMap = await buildResponseTimeByOwner();
	if (productRows.length > 0) {
		const ops = [];
		for (const p of productRows) {
			if (!shouldIndexProduct(p)) {
				continue;
			}
			const owner = usersById.get(String(p.company_id)) || null;
			const author = owner?.profile ? { ...owner, ...owner.profile } : owner || {};
			const doc = await buildProductDoc(p, author, responseMap);
			ops.push({ index: { _index: productsIndex, _id: doc.id } }, doc);
		}
		await client.bulk({ refresh: true, body: ops });
	}

	const reqRows = Array.isArray(requirements) ? requirements : [];
	if (reqRows.length > 0) {
		const ops = [];
		for (const r of reqRows) {
			const owner = usersById.get(String(r.buyer_id)) || null;
			const author = owner?.profile ? { ...owner, ...owner.profile } : owner || {};
			const doc = await buildRequirementDoc(r, author, responseMap);
			ops.push({ index: { _index: requirementsIndex, _id: doc.id } }, doc);
		}
		await client.bulk({ refresh: true, body: ops });
	}

	return { ok: true };
}

export async function reindexOrg(orgId) {
	const cfg = await loadConfig();
	if (!(cfg.enabled && cfg.url)) {
		return { ok: false, reason: "not_configured" };
	}
	const safeOrgId = safeString(orgId);
	if (!safeOrgId) {
		return { ok: false, reason: "org_id_required" };
	}

	const { client } = await getClient();
	if (!client) {
		return { ok: false, reason: "not_configured" };
	}

	await ensureOpenSearchIndices();

	const [products, requirements, userRows] = await Promise.all([
		prisma.product.findMany(),
		prisma.requirement.findMany(),
		prisma.user.findMany(),
	]);
	const usersById = new Map(userRows.map((u) => [String(u.id), u]));
	const owner = usersById.get(String(safeOrgId)) || null;
	const author = owner?.profile ? { ...owner, ...owner.profile } : owner || {};
	const responseMap = await buildResponseTimeByOwner();

	const productsIndex = `${cfg.index_prefix}products`;
	const requirementsIndex = `${cfg.index_prefix}requirements`;

	const productRows = (Array.isArray(products) ? products : [])
		.filter((p) => String(p.company_id || "") === safeOrgId)
		.filter((p) => shouldIndexProduct(p));
	if (productRows.length > 0) {
		const ops = [];
		for (const p of productRows) {
			const doc = await buildProductDoc(p, author, responseMap);
			ops.push({ index: { _index: productsIndex, _id: doc.id } }, doc);
		}
		await client.bulk({ refresh: true, body: ops });
	}

	const reqRows = (Array.isArray(requirements) ? requirements : []).filter(
		(r) => String(r.buyer_id || "") === safeOrgId,
	);
	if (reqRows.length > 0) {
		const ops = [];
		for (const r of reqRows) {
			const doc = await buildRequirementDoc(r, author, responseMap);
			ops.push({ index: { _index: requirementsIndex, _id: doc.id } }, doc);
		}
		await client.bulk({ refresh: true, body: ops });
	}

	return {
		ok: true,
		org_id: safeOrgId,
		products: productRows.length,
		requirements: reqRows.length,
	};
}

export async function getOpenSearchStatus() {
	const cfg = await loadConfig();
	const configured = Boolean(cfg.enabled && cfg.url);
	if (!configured) {
		return {
			configured: false,
			enabled: Boolean(cfg.enabled),
			url_set: Boolean(cfg.url),
			index_prefix: cfg.index_prefix,
			last_ok_at: lastStatus.last_ok_at,
			last_error_at: lastStatus.last_error_at,
			last_error: lastStatus.last_error,
		};
	}

	const { client } = await getClient();
	if (!client) {
		return {
			configured: false,
			enabled: Boolean(cfg.enabled),
			url_set: Boolean(cfg.url),
			index_prefix: cfg.index_prefix,
			last_ok_at: lastStatus.last_ok_at,
			last_error_at: lastStatus.last_error_at,
			last_error: lastStatus.last_error,
		};
	}

	const productsIndex = `${cfg.index_prefix}products`;
	const requirementsIndex = `${cfg.index_prefix}requirements`;

	let reachable = false;
	let products_exists = false;
	let requirements_exists = false;
	let products_count = 0;
	let requirements_count = 0;
	let error = "";

	try {
		await client.ping();
		reachable = true;
		products_exists = (await client.indices.exists({ index: productsIndex }))?.body === true;
		requirements_exists =
			(await client.indices.exists({ index: requirementsIndex }))?.body === true;
		if (products_exists) {
			const res = await client.count({ index: productsIndex });
			products_count = Number(res?.body?.count || 0);
		}
		if (requirements_exists) {
			const res = await client.count({ index: requirementsIndex });
			requirements_count = Number(res?.body?.count || 0);
		}
		lastStatus = {
			...lastStatus,
			last_ok_at: new Date().toISOString(),
			last_error: "",
		};
	} catch (err) {
		error = err?.message || "opensearch_unreachable";
		lastStatus = {
			last_ok_at: lastStatus.last_ok_at,
			last_error_at: new Date().toISOString(),
			last_error: error,
		};
	}

	return {
		configured: true,
		enabled: Boolean(cfg.enabled),
		reachable,
		url: cfg.url,
		index_prefix: cfg.index_prefix,
		indices: {
			products: {
				name: productsIndex,
				exists: products_exists,
				count: products_count,
			},
			requirements: {
				name: requirementsIndex,
				exists: requirements_exists,
				count: requirements_count,
			},
		},
		last_ok_at: lastStatus.last_ok_at,
		last_error_at: lastStatus.last_error_at,
		last_error: error || lastStatus.last_error,
	};
}

export function startOpenSearchHeartbeat() {
	async function beat() {
		try {
			const { client } = await getClient();
			if (!client) {
				logWarn("opensearch No client available, will retry in 30s...");
				return;
			}
			await client.ping();
			logInfo("opensearch Heartbeat OK");
		} catch (err) {
			if (err?.code === "P1001" || err?.message?.includes("Can't reach database server")) {
			} else {
				clientState.client = null;
			}
		}
	}
	setInterval(beat, 30_000).unref();
	beat();
}
