import { getAdminConfig } from "./adminConfigService.js";

const CONFIG_TTL_MS = 15_000;
let cachedConfig = { at: 0, value: null };

async function loadConfig() {
	if (cachedConfig.value && Date.now() - cachedConfig.at < CONFIG_TTL_MS) {
		return cachedConfig.value;
	}

	const admin = await getAdminConfig();
	const raw = admin?.integrations?.reranker || {};

	const envProvider = process.env.RERANKER_PROVIDER || "";
	const envUrl = process.env.RERANKER_URL || "";
	const envApiKey = process.env.RERANKER_API_KEY || "";
	const envModel = process.env.RERANKER_MODEL || "";

	const cfg = {
		provider: raw.provider || envProvider || "ollama",
		url: raw.url || envUrl || "http://127.0.0.1:11434",
		apiKey: raw.apiKey || envApiKey || "",
		model: raw.model || envModel || "bge-reranker-v2-m3",
		timeout_ms: Math.max(1000, Math.min(120_000, Number(raw.timeout_ms || 30_000))),
	};
	cachedConfig = { at: Date.now(), value: cfg };
	return cfg;
}

export async function isRerankerConfigured() {
	try {
		const cfg = await loadConfig();
		return Boolean(cfg.provider && cfg.url);
	} catch {
		return false;
	}
}

export async function rerank({ query, documents, model } = {}) {
	if (!(query && documents?.length > 0)) {
		return [];
	}

	const cfg = await loadConfig();
	const provider = cfg.provider.toLowerCase();

	if (provider === "ollama") {
		return rerankViaOllama(cfg, query, documents, model);
	}
	if (provider === "huggingface") {
		return rerankViaHuggingFace(cfg, query, documents, model);
	}

	return fallbackRerank(query, documents);
}

async function rerankViaOllama(cfg, query, documents, model) {
	const url = `${cfg.url.replace(/\/+$/, "")}/api/rerank`;
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), cfg.timeout_ms);

	try {
		const resp = await fetch(url, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ model: model || cfg.model, query, documents }),
			signal: controller.signal,
		});
		if (!resp.ok) {
			const _errText = await resp.text().catch(() => "");
			return fallbackRerank(query, documents);
		}
		const data = await resp.json();
		return data.results || [];
	} catch {
		return fallbackRerank(query, documents);
	} finally {
		clearTimeout(timer);
	}
}

async function rerankViaHuggingFace(cfg, query, documents, model) {
	const modelName = model || cfg.model || "BAAI/bge-reranker-v2-m3";
	const url = `https://api-inference.huggingface.co/models/${modelName}`;
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), cfg.timeout_ms);

	try {
		const headers = { "Content-Type": "application/json" };
		if (cfg.apiKey) {
			headers.Authorization = `Bearer ${cfg.apiKey}`;
		}

		const resp = await fetch(url, {
			method: "POST",
			headers,
			body: JSON.stringify({
				inputs: query,
				parameters: { candidates: documents },
			}),
			signal: controller.signal,
		});
		if (!resp.ok) {
			const _errText = await resp.text().catch(() => "");
			return fallbackRerank(query, documents);
		}
		const data = await resp.json();
		if (Array.isArray(data)) {
			return data.map((item, idx) => ({
				index: item.index ?? idx,
				relevance_score: item.score ?? item.relevance_score ?? 0,
			}));
		}
		if (data.results) {
			return data.results;
		}
		return [];
	} catch {
		return fallbackRerank(query, documents);
	} finally {
		clearTimeout(timer);
	}
}

function fallbackRerank(query, documents) {
	const queryLower = query.toLowerCase();
	const queryTokens = queryLower.split(/\s+/).filter(Boolean);

	return documents
		.map((doc, index) => {
			const docText = typeof doc === "string" ? doc : doc.title || doc.text || String(doc);
			const docLower = docText.toLowerCase();

			let score = 0;
			if (docLower === queryLower) {
				score = 1;
			} else if (docLower.includes(queryLower)) {
				score = 0.9;
			} else {
				const matchCount = queryTokens.filter((t) => docLower.includes(t)).length;
				const totalTerms = queryTokens.length || 1;
				const tokenScore = (matchCount / totalTerms) * 0.8;

				const titleBoost = doc.title?.toLowerCase().includes(queryLower) ? 0.2 : 0;
				score = Math.min(1, tokenScore + titleBoost);
			}

			return { index, relevance_score: score };
		})
		.sort((a, b) => b.relevance_score - a.relevance_score);
}

export async function rerankIds(query, items, _idField = "id") {
	if (!(query && items?.length > 0)) {
		return items;
	}

	const useReranker = await isRerankerConfigured();
	if (!useReranker) {
		return items;
	}

	const documents = items.map(
		(item) =>
			`${item.title || ""} ${item.category || ""} ${item.material || ""} ${item.description || ""}`,
	);

	const maxDocs = 50;
	const batch = documents.slice(0, maxDocs);
	const batchItems = items.slice(0, maxDocs);

	try {
		const results = await rerank({ query, documents: batch });
		const scoreMap = new Map();
		results.forEach((r) => scoreMap.set(r.index, r.relevance_score));

		const ranked = [...batchItems].sort((a, b) => {
			const aScore = scoreMap.get(batchItems.indexOf(a)) ?? 0;
			const bScore = scoreMap.get(batchItems.indexOf(b)) ?? 0;
			return bScore - aScore;
		});

		if (items.length > maxDocs) {
			ranked.push(...items.slice(maxDocs));
		}
		return ranked;
	} catch {
		return items;
	}
}
