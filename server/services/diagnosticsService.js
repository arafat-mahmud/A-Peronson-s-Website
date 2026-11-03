import { getDbStatus } from "../utils/db.js";
import { logError } from "../utils/logger.js";
import { isRedisConnected } from "../utils/redis.js";
import { getFxHealth } from "./currencyService.js";
import { getOpenSearchStatus } from "./openSearchService.js";
import { getQdrantStatus } from "./qdrantService.js";

const startedAt = Date.now();

function getUptime() {
	return Math.floor((Date.now() - startedAt) / 1000);
}

function getMemory() {
	const usage = process.memoryUsage();
	return {
		rss_mb: +(usage.rss / 1024 / 1024).toFixed(2),
		heap_total_mb: +(usage.heapTotal / 1024 / 1024).toFixed(2),
		heap_used_mb: +(usage.heapUsed / 1024 / 1024).toFixed(2),
		external_mb: +(usage.external / 1024 / 1024).toFixed(2),
	};
}

function getCpu() {
	const cpus = require("node:os").cpus();
	return {
		cores: cpus.length,
		model: cpus[0]?.model || "unknown",
		load_avg: require("node:os").loadavg(),
	};
}

function getNodeInfo() {
	return {
		version: process.version,
		platform: process.platform,
		arch: process.arch,
		env: process.env.NODE_ENV || "development",
	};
}

export async function runLightDiagnostics() {
	const db = getDbStatus();
	const fx = getFxHealth();
	const redis = { connected: isRedisConnected() };
	let os = null;
	try {
		os = await getOpenSearchStatus();
	} catch (err) {
		os = { configured: false, error: err.message };
	}
	let qdrant = null;
	try {
		qdrant = await getQdrantStatus();
	} catch (err) {
		qdrant = { configured: false, error: err.message };
	}
	return {
		ok: db.connected,
		uptime_s: getUptime(),
		db,
		redis,
		opensearch: {
			configured: os.configured,
			reachable: os.reachable ?? false,
			index_prefix: os.index_prefix ?? "",
		},
		qdrant: {
			configured: qdrant.configured,
			reachable: qdrant.reachable ?? false,
		},
		fx: {
			ok: Boolean(fx.last_refresh_ok_at),
			last_ok_at: fx.last_refresh_ok_at,
			last_error: fx.last_refresh_error,
		},
		memory: getMemory(),
	};
}

export async function runDeepDiagnostics() {
	const light = await runLightDiagnostics();
	const os = await getOpenSearchStatus().catch((err) => ({
		configured: false,
		error: err.message,
	}));
	const qdrant = await getQdrantStatus().catch((err) => ({
		configured: false,
		error: err.message,
	}));
	return {
		...light,
		node: getNodeInfo(),
		cpu: getCpu(),
		opensearch: os,
		qdrant,
		fx: getFxHealth(),
		env_sample: {
			port: process.env.PORT,
			serve_dist: process.env.SERVE_DIST,
			db_set: Boolean(process.env.DATABASE_URL),
			os_set: Boolean(process.env.OPENSEARCH_URL),
			redis_set: Boolean(process.env.REDIS_URL),
			ai_search_enabled: process.env.AI_SEARCH_ENABLED,
		},
	};
}

export function reportHealth() {
	const db = getDbStatus();
	const fx = getFxHealth();
	const redis = isRedisConnected();
	const mem = getMemory();
	const allOk = db.connected && !mem.heap_used_mb > 512;
	return {
		status: allOk ? "healthy" : "degraded",
		uptime_s: getUptime(),
		db: db.connected ? "ok" : "error",
		redis: redis ? "ok" : "disabled",
		fx: fx.last_refresh_ok_at ? "ok" : "stale",
		memory_warning: mem.heap_used_mb > 512 ? `heap at ${mem.heap_used_mb}mb` : null,
	};
}

export function getStartTime() {
	return startedAt;
}
