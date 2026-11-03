import { getAdminConfig } from "./adminConfigService.js";

const CONFIG_TTL_MS = 15_000;
let cachedConfig = { at: 0, value: null };

async function loadConfig() {
	if (cachedConfig.value && Date.now() - cachedConfig.at < CONFIG_TTL_MS) {
		return cachedConfig.value;
	}

	const admin = await getAdminConfig();
	const raw = admin?.integrations?.embeddings || {};

	const envProvider = process.env.EMBEDDING_PROVIDER || "";
	const envUrl = process.env.EMBEDDING_URL || "";
	const envApiKey = process.env.EMBEDDING_API_KEY || "";
	const envModel = process.env.EMBEDDING_MODEL || "";
	const envDim = Number.parseInt(process.env.EMBEDDING_DIMENSION || "1024", 10);
	const aiSearchEnabled = process.env.AI_SEARCH_ENABLED !== "false";

	const cfg = {
		provider: raw.provider || envProvider || "huggingface",
		url: raw.url || envUrl || "",
		apiKey: raw.apiKey || envApiKey || "",
		model: raw.model || envModel || "BAAI/bge-m3",
		dimension: Number.isFinite(envDim) ? envDim : 1024,
		timeout_ms: Math.max(1000, Math.min(120_000, Number(raw.timeout_ms || 30_000))),
		enabled: aiSearchEnabled && (Boolean(raw.enabled) || Boolean(envUrl)),
	};
	cachedConfig = { at: Date.now(), value: cfg };
	return cfg;
}

async function _refreshConfig() {
	cachedConfig = { at: 0, value: null };
	return loadConfig();
}

export async function isEmbeddingConfigured() {
	try {
		const cfg = await loadConfig();
		return Boolean(cfg.enabled && cfg.provider && cfg.url);
	} catch {
		return false;
	}
}

export async function generateEmbedding(text) {
	if (!text?.trim()) {
		return null;
	}
	const cfg = await loadConfig();
	const provider = cfg.provider.toLowerCase();
	const start = Date.now();

	if (provider === "ollama") {
		return embeddingViaOllama(cfg, text, start);
	}
	if (provider === "huggingface") {
		return embeddingViaHuggingFace(cfg, text, start);
	}
	if (provider === "opencode") {
		return embeddingViaOpencode(cfg, text, start);
	}
	throw new Error(`Unknown embedding provider: ${provider}`);
}

async function embeddingViaOllama(cfg, text, _start) {
	const url = `${cfg.url.replace(/\/+$/, "")}/api/embeddings`;
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), cfg.timeout_ms);

	try {
		const resp = await fetch(url, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ model: cfg.model, prompt: text }),
			signal: controller.signal,
		});
		if (!resp.ok) {
			const _errText = await resp.text().catch(() => "");
			return null;
		}
		const data = await resp.json();
		return data.embedding || null;
	} catch {
		return null;
	} finally {
		clearTimeout(timer);
	}
}

async function embeddingViaHuggingFace(cfg, text, _start) {
	const model = cfg.model || "BAAI/bge-m3";
	const url = `https://api-inference.huggingface.co/models/${model}`;
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
			body: JSON.stringify({ inputs: text }),
			signal: controller.signal,
		});
		if (!resp.ok) {
			const _errText = await resp.text().catch(() => "");
			return null;
		}
		const data = await resp.json();
		if (Array.isArray(data)) {
			return data[0] || null;
		}
		if (data.embedding) {
			return data.embedding;
		}
		return null;
	} catch {
		return null;
	} finally {
		clearTimeout(timer);
	}
}

async function embeddingViaOpencode(cfg, text, _start) {
	const url = `${cfg.url.replace(/\/+$/, "")}/v1/embeddings`;
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
			body: JSON.stringify({ model: cfg.model, input: text }),
			signal: controller.signal,
		});
		if (!resp.ok) {
			const _errText = await resp.text().catch(() => "");
			return null;
		}
		const data = await resp.json();
		if (data.data?.[0]?.embedding) {
			return data.data[0].embedding;
		}
		if (data.embedding) {
			return data.embedding;
		}
		return null;
	} catch {
		return null;
	} finally {
		clearTimeout(timer);
	}
}

export async function generateEmbeddingWithRetry(text, maxRetries = 1) {
	for (let attempt = 0; attempt <= maxRetries; attempt++) {
		try {
			const emb = await generateEmbedding(text);
			if (emb) {
				return emb;
			}
		} catch {
			if (attempt === maxRetries) {
				return null;
			}
			await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
		}
	}
	return null;
}
