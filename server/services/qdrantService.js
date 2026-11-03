import { logError } from "../utils/logger.js";
import prisma from "../utils/prisma.js";
import { getAdminConfig } from "./adminConfigService.js";
import {
	generateEmbedding,
	generateEmbeddingWithRetry,
	isEmbeddingConfigured,
} from "./embeddingService.js";

const CONFIG_TTL_MS = 15_000;
let cachedConfig = { at: 0, value: null };
let clientState = { key: "", client: null };

async function loadConfig() {
	if (cachedConfig.value && Date.now() - cachedConfig.at < CONFIG_TTL_MS) {
		return cachedConfig.value;
	}

	const admin = await getAdminConfig();
	const raw = admin?.integrations?.qdrant || {};

	const envUrl = process.env.QDRANT_URL || "";
	const envApiKey = process.env.QDRANT_API_KEY || "";

	const cfg = {
		enabled: Boolean(raw.enabled) || Boolean(envUrl),
		url: raw.url || envUrl || "http://127.0.0.1:6333",
		apiKey: raw.apiKey || envApiKey || "",
		collection_prefix: raw.collection_prefix || "gartexhub_",
		timeout_ms: Math.max(500, Math.min(60_000, Number(raw.timeout_ms || 10_000))),
	};
	cachedConfig = { at: Date.now(), value: cfg };
	return cfg;
}

function buildClientKey(cfg) {
	return JSON.stringify({
		url: cfg.url,
		apiKey: cfg.apiKey,
		timeout_ms: cfg.timeout_ms,
	});
}

async function getClient() {
	const cfg = await loadConfig();
	if (!(cfg.enabled && cfg.url)) {
		return { cfg, client: null };
	}
	const key = buildClientKey(cfg);
	if (!clientState.client || clientState.key !== key) {
		// Loaded on first use only (AI search is off on most deployments).
		const { QdrantClient } = await import("@qdrant/qdrant-js");
		clientState = {
			key,
			client: new QdrantClient({
				url: cfg.url,
				apiKey: cfg.apiKey || undefined,
				timeout: cfg.timeout_ms,
			}),
		};
	}
	return { cfg, client: clientState.client };
}

export async function isQdrantConfigured() {
	if (!(await isEmbeddingConfigured())) {
		return false;
	}
	const cfg = await loadConfig();
	return Boolean(cfg.enabled && cfg.url);
}

function collectionName(type, cfg) {
	const prefix = cfg.collection_prefix || "gartexhub_";
	return `${prefix}${type}`;
}

export async function ensureQdrantCollections() {
	const { cfg, client } = await getClient();
	if (!client) {
		return { ok: false, reason: "not_configured" };
	}

	try {
		for (const type of ["products", "requirements"]) {
			const name = collectionName(type, cfg);
			const exists = await client
				.getCollection(name)
				.then(() => true)
				.catch(() => false);
			if (!exists) {
				await client.createCollection(name, {
					vectors: { distance: "Cosine", size: 1024 },
					optimizers_config: { default_segment_number: 2 },
					replication_factor: 1,
				});
			}
		}
		return { ok: true };
	} catch (err) {
		return { ok: false, reason: err.message };
	}
}

async function getOrCreateCollection(type) {
	const { cfg, client } = await getClient();
	if (!client) {
		return null;
	}
	const name = collectionName(type, cfg);
	const exists = await client
		.getCollection(name)
		.then(() => true)
		.catch(() => false);
	if (!exists) {
		await client.createCollection(name, {
			vectors: { distance: "Cosine", size: 1024 },
			optimizers_config: { default_segment_number: 2 },
			replication_factor: 1,
		});
	}
	return { client, name };
}

function buildPayloadForProduct(product, author) {
	const profile = author?.profile || {};
	return {
		id: product.id,
		title: product.title || "",
		category: product.category || "",
		industry: product.industry || profile?.industry || "",
		material: product.material || "",
		country: profile?.country || author?.country || "",
		description: product.description || "",
		company_id: product.company_id || "",
		created_at: product.created_at?.toISOString?.() || product.created_at || "",
	};
}

function buildPayloadForRequirement(req, author) {
	const profile = author?.profile || {};
	return {
		id: req.id,
		title: req.title || "",
		category: req.category || "",
		industry: req.industry || "",
		material: req.material || "",
		country: profile?.country || author?.country || "",
		description: req.description || req.custom_description || "",
		buyer_id: req.buyer_id || "",
		created_at: req.created_at?.toISOString?.() || req.created_at || "",
	};
}

export async function indexProduct(product, author) {
	const coll = await getOrCreateCollection("products");
	if (!coll) {
		return;
	}
	const { client, name } = coll;
	const payload = buildPayloadForProduct(product, author);
	const text =
		`${payload.title} ${payload.category} ${payload.industry} ${payload.material} ${payload.country} ${payload.description || ""}`.trim();
	const embedding = await generateEmbeddingWithRetry(text);
	if (!embedding) {
		return;
	}
	await client
		.upsert(name, {
			points: [{ id: product.id, vector: embedding, payload }],
		})
		.catch((err) => logError("qdrantService: upsert product index failed", err));
}

export async function indexRequirement(req, author) {
	const coll = await getOrCreateCollection("requirements");
	if (!coll) {
		return;
	}
	const { client, name } = coll;
	const payload = buildPayloadForRequirement(req, author);
	const text =
		`${payload.title} ${payload.category} ${payload.industry} ${payload.material} ${payload.country} ${payload.description || ""}`.trim();
	const embedding = await generateEmbeddingWithRetry(text);
	if (!embedding) {
		return;
	}
	await client
		.upsert(name, {
			points: [{ id: req.id, vector: embedding, payload }],
		})
		.catch((err) => logError("qdrantService: upsert requirement index failed", err));
}

export async function deleteProduct(id) {
	const { cfg, client } = await getClient();
	if (!client) {
		return;
	}
	try {
		await client.delete(collectionName("products", cfg), { points: [id] });
	} catch {
		void 0;
	}
}

export async function deleteRequirement(id) {
	const { cfg, client } = await getClient();
	if (!client) {
		return;
	}
	try {
		await client.delete(collectionName("requirements", cfg), { points: [id] });
	} catch {
		void 0;
	}
}

export async function searchQdrant({ type, query, filters = {}, cursor = 0, limit = 50 } = {}) {
	if (!query?.trim()) {
		return { ids: [], scores: [], total: 0 };
	}

	const embEnabled = await isEmbeddingConfigured();
	if (!embEnabled) {
		return {
			ids: [],
			scores: [],
			total: 0,
			engine: "embedding_not_configured",
		};
	}

	const { cfg, client } = await getClient();
	if (!client) {
		return { ids: [], scores: [], total: 0, engine: "qdrant_not_configured" };
	}

	const name = collectionName(type, cfg);
	const colExists = await client
		.getCollection(name)
		.then(() => true)
		.catch(() => false);
	if (!colExists) {
		return { ids: [], scores: [], total: 0, engine: "collection_not_found" };
	}

	const embedding = await generateEmbedding(query);
	if (!embedding) {
		return { ids: [], scores: [], total: 0, engine: "embedding_failed" };
	}

	const actualLimit = Math.min(100, Math.max(1, Number(limit || 50)));
	const offset = Math.max(0, Number(cursor || 0));

	try {
		const mustFilters = [];

		if (filters.country) {
			mustFilters.push({
				key: "country",
				match: { value: String(filters.country).toLowerCase() },
			});
		}
		if (filters.category) {
			const cats = Array.isArray(filters.category) ? filters.category : [filters.category];
			if (cats.length === 1) {
				mustFilters.push({
					key: "category",
					match: { value: String(cats[0]).toLowerCase() },
				});
			} else {
				mustFilters.push({
					key: "category",
					match: { any: cats.map((c) => String(c).toLowerCase()) },
				});
			}
		}
		if (filters.industry) {
			mustFilters.push({
				key: "industry",
				match: { value: String(filters.industry).toLowerCase() },
			});
		}

		const filter = mustFilters.length > 0 ? { must: mustFilters } : undefined;

		const result = await client.search(name, {
			vector: embedding,
			limit: actualLimit,
			offset,
			with_payload: false,
			score_threshold: 0.5,
			filter,
		});

		const ids = result.map((p) => String(p.id));
		const scores = result.map((p) => p.score || 0);
		return { ids, scores, total: ids.length, engine: "qdrant" };
	} catch (err) {
		return {
			ids: [],
			scores: [],
			total: 0,
			engine: "qdrant_error",
			error: err.message,
		};
	}
}

export async function reindexAll({ reset = false } = {}) {
	if (!(await isQdrantConfigured())) {
		return { ok: false, reason: "not_configured" };
	}

	if (reset) {
		const { cfg, client } = await getClient();
		if (client) {
			for (const type of ["products", "requirements"]) {
				try {
					await client.deleteCollection(collectionName(type, cfg));
				} catch {
					void 0;
				}
			}
		}
	}

	await ensureQdrantCollections();

	const [products, requirements, users] = await Promise.all([
		prisma.product.findMany(),
		prisma.requirement.findMany(),
		prisma.user.findMany(),
	]);
	const usersById = new Map(users.map((u) => [String(u.id), u]));

	let productsIndexed = 0;
	for (const p of products) {
		const author = usersById.get(String(p.company_id)) || {};
		try {
			await indexProduct(p, author);
			productsIndexed++;
		} catch {
			void 0;
		}
	}

	let requirementsIndexed = 0;
	for (const r of requirements) {
		const author = usersById.get(String(r.buyer_id)) || {};
		try {
			await indexRequirement(r, author);
			requirementsIndexed++;
		} catch {
			void 0;
		}
	}

	return {
		ok: true,
		products: productsIndexed,
		requirements: requirementsIndexed,
	};
}

export async function getQdrantStatus() {
	const cfg = await loadConfig();
	const configured = Boolean(cfg.enabled && cfg.url);

	if (!configured) {
		return {
			configured: false,
			enabled: Boolean(cfg.enabled),
			url_set: Boolean(cfg.url),
		};
	}

	const { client } = await getClient();
	if (!client) {
		return {
			configured: false,
			enabled: Boolean(cfg.enabled),
			url_set: Boolean(cfg.url),
		};
	}

	let reachable = false;
	let error = "";
	let collections = {};

	try {
		await client.getCollections();
		reachable = true;
		const productName = collectionName("products", cfg);
		const reqName = collectionName("requirements", cfg);
		const prodInfo = await client.getCollection(productName).catch(() => null);
		const reqInfo = await client.getCollection(reqName).catch(() => null);
		collections = {
			products: {
				name: productName,
				exists: Boolean(prodInfo),
				points_count: prodInfo?.points_count || 0,
			},
			requirements: {
				name: reqName,
				exists: Boolean(reqInfo),
				points_count: reqInfo?.points_count || 0,
			},
		};
	} catch (err) {
		error = err.message;
	}

	return {
		configured: true,
		enabled: Boolean(cfg.enabled),
		reachable,
		url: cfg.url,
		collections,
		error,
	};
}
