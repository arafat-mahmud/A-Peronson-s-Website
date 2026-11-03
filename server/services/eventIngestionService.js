import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { logInfo, logWarn } from "../utils/logger.js";
import { sanitizeString } from "../utils/validators.js";
import { trackEvent as persistEvent } from "./analyticsService.js";

const TAXONOMY_PATH = path.join(process.cwd(), "shared", "event-taxonomy.json");
const DEFAULT_SCHEMA_VERSION = "1.0.0";
const DEFAULT_SOURCE_MODULE = "backend";
const IDEMPOTENCY_TTL_MS = 15 * 60 * 1000;
const NOISY_EVENTS = new Set(["page_view", "click", "search_filters_changed"]);

const qualityState = {
	unknown_types: {},
	missing_required_fields: {},
	dropped_events: 0,
	ingested_events: 0,
	deduped_events: 0,
};

const recentIdempotency = new Map();
let taxonomyPromise = null;

function touchMetric(bucket, key) {
	bucket[key] = (bucket[key] || 0) + 1;
}

function compactDedupCache() {
	const now = Date.now();
	for (const [key, expiresAt] of recentIdempotency.entries()) {
		if (expiresAt <= now) {
			recentIdempotency.delete(key);
		}
	}
}

async function loadTaxonomy() {
	if (!taxonomyPromise) {
		taxonomyPromise = fs
			.readFile(TAXONOMY_PATH, "utf8")
			.then((raw) => JSON.parse(raw))
			.catch(() => ({
				version: DEFAULT_SCHEMA_VERSION,
				canonical_events: [],
				required_context_dimensions: [],
				required_fields: ["type"],
				event_requirements: {},
			}));
	}
	return taxonomyPromise;
}

function normalizeEventType(type) {
	return sanitizeString(String(type || ""), 80)
		.toLowerCase()
		.replace(/\s+/g, "_");
}

function normalizeContext(context = {}, base = {}) {
	return {
		actorType:
			sanitizeString(String(context.actorType || base.actorType || "unknown"), 60) || "unknown",
		orgOwnerId:
			sanitizeString(String(context.orgOwnerId || base.orgOwnerId || "unknown"), 120) || "unknown",
		entityType:
			sanitizeString(String(context.entityType || base.entityType || "unknown"), 80) || "unknown",
		entityId:
			sanitizeString(String(context.entityId || base.entityId || "unknown"), 160) || "unknown",
		sourceModule:
			sanitizeString(
				String(context.sourceModule || base.sourceModule || DEFAULT_SOURCE_MODULE),
				80,
			) || DEFAULT_SOURCE_MODULE,
		sessionId:
			sanitizeString(String(context.sessionId || base.sessionId || "server"), 180) || "server",
	};
}

function buildIdempotencyKey({ providedKey, type, actorId, entityId, sessionId }) {
	const provided = sanitizeString(String(providedKey || ""), 200);
	if (provided) {
		return provided;
	}
	if (!NOISY_EVENTS.has(type)) {
		return "";
	}

	const minuteBucket = Math.floor(Date.now() / 15_000);
	const stable = `${type}|${actorId || "unknown"}|${entityId || "unknown"}|${sessionId || "server"}|${minuteBucket}`;
	return crypto.createHash("sha256").update(stable).digest("hex");
}

function validateRequiredMetadata(metadata, requiredKeys = [], eventType = "") {
	const missing = [];
	for (const key of requiredKeys) {
		const value = metadata?.[key];
		if (value === undefined || value === null || String(value).trim() === "") {
			missing.push(key);
		}
	}
	if (missing.length > 0) {
		touchMetric(qualityState.missing_required_fields, `${eventType}:${missing.join(",")}`);
	}
	return missing;
}

export async function ingestEvent(payload = {}, options = {}) {
	compactDedupCache();
	const taxonomy = await loadTaxonomy();

	const type = normalizeEventType(payload.type);
	const actorId = sanitizeString(String(payload.actor_id || ""), 160);
	const entityId = sanitizeString(String(payload.entity_id || ""), 180);
	const metadata = payload.metadata && typeof payload.metadata === "object" ? payload.metadata : {};

	const context = normalizeContext(payload.context, {
		entityId,
		sourceModule: options.sourceModule,
		actorType: options.actorType,
		orgOwnerId: options.orgOwnerId,
		entityType: options.entityType,
		sessionId: options.sessionId,
	});

	if (!(type && actorId && entityId)) {
		qualityState.dropped_events += 1;
		touchMetric(qualityState.missing_required_fields, "base_required_fields");
		return { accepted: false, reason: "missing_required_fields" };
	}

	const canonicalEvents = new Set(
		Array.isArray(taxonomy.canonical_events) ? taxonomy.canonical_events : [],
	);
	const allowUnknownTypes = options.allowUnknownTypes === true;
	if (!(canonicalEvents.has(type) || allowUnknownTypes)) {
		qualityState.dropped_events += 1;
		touchMetric(qualityState.unknown_types, type);
		return { accepted: false, reason: "unknown_event_type", type };
	}

	const metadataRequirements = taxonomy?.event_requirements?.[type] || [];
	const missingMetadata = validateRequiredMetadata(metadata, metadataRequirements, type);
	if (missingMetadata.length > 0) {
		qualityState.dropped_events += 1;
		return {
			accepted: false,
			reason: "missing_required_metadata",
			missing: missingMetadata,
		};
	}

	const idempotencyKey = buildIdempotencyKey({
		providedKey: payload.idempotency_key || metadata.idempotency_key || options.idempotencyKey,
		type,
		actorId,
		entityId,
		sessionId: context.sessionId,
	});

	if (idempotencyKey) {
		if (recentIdempotency.has(idempotencyKey)) {
			qualityState.deduped_events += 1;
			return {
				accepted: false,
				reason: "duplicate_event",
				idempotency_key: idempotencyKey,
			};
		}

		recentIdempotency.set(idempotencyKey, Date.now() + IDEMPOTENCY_TTL_MS);
	}

	const enrichedMetadata = {
		...metadata,
		context,
		schema_version: sanitizeString(
			String(payload.schema_version || taxonomy.version || DEFAULT_SCHEMA_VERSION),
			20,
		),
		idempotency_key: idempotencyKey,
		received_at: new Date().toISOString(),
	};

	await persistEvent({
		type,
		actor_id: actorId,
		entity_id: entityId,
		metadata: enrichedMetadata,
	});

	qualityState.ingested_events += 1;
	return {
		accepted: true,
		type,
		idempotency_key: idempotencyKey,
		schema_version: enrichedMetadata.schema_version,
	};
}

export function startEventQualityReporter() {
	const intervalMs = Math.max(
		60_000,
		Number(process.env.EVENT_QUALITY_REPORT_INTERVAL_MS || 15 * 60 * 1000),
	);
	setInterval(() => {
		logInfo("event-quality-report", {
			ingested_events: qualityState.ingested_events,
			dropped_events: qualityState.dropped_events,
			deduped_events: qualityState.deduped_events,
			unknown_types: qualityState.unknown_types,
			missing_required_fields: qualityState.missing_required_fields,
		});
	}, intervalMs).unref();

	logWarn("event-quality-report-enabled", { interval_ms: intervalMs });
}

export async function isKnownEventType(type) {
	const taxonomy = await loadTaxonomy();
	return new Set(taxonomy.canonical_events || []).has(normalizeEventType(type));
}
