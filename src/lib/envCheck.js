const isDev = () => import.meta.env.DEV;

const REQUIRED_VARS = [{ key: "VITE_API_URL", label: "API base URL" }];

const OPTIONAL_VARS = [
	{ key: "VITE_OPENSEARCH_URL", label: "OpenSearch URL" },
	{ key: "VITE_QDRANT_URL", label: "Qdrant URL" },
	{ key: "VITE_AI_ENABLED", label: "AI feature toggle" },
	{ key: "VITE_AI_PRIMARY_PROVIDER", label: "Primary AI provider" },
	{ key: "VITE_AI_FALLBACK_PROVIDER", label: "Fallback AI provider" },
	{ key: "VITE_OLLAMA_HOST", label: "Ollama host" },
	{ key: "VITE_OLLAMA_PORT", label: "Ollama port" },
	{ key: "VITE_OPENROUTER_API_KEY", label: "OpenRouter API key" },
	{ key: "VITE_ESIGN_PROVIDER_TYPE", label: "E-sign provider type" },
	{ key: "VITE_ESIGN_PROVIDER_URL", label: "E-sign provider URL" },
	{ key: "VITE_EMBEDDING_PROVIDER", label: "Embedding provider" },
	{ key: "VITE_EMBEDDING_URL", label: "Embedding service URL" },
	{ key: "VITE_RERANKER_PROVIDER", label: "Reranker provider" },
];

export function checkEnvVars() {
	const issues = [];

	for (const { key, label } of REQUIRED_VARS) {
		if (!import.meta.env[key]) {
			issues.push(`Missing required env var: ${key} (${label})`);
		}
	}

	for (const { key, label } of OPTIONAL_VARS) {
		if (import.meta.env[key]) {
			continue;
		}
		if (isDev()) {
			issues.push(`Missing optional env var: ${key} (${label}) — using default`);
		}
	}

	return issues;
}

export function logEnvStatus() {
	const issues = checkEnvVars();
	if (issues.length === 0) {
		return;
	}
	for (const _msg of issues) {
	}
}
