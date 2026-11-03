import prisma from "../utils/prisma.js";
import { getFeedGeneration } from "./feedGenerationService.js";

// HyperCache Phase 3 — sync protocol service.
// Head: lightweight version vector the client caches.
// Delta: ordered ledger rows since the client's cursor.

export const SYNC_SCHEMA_VERSION = 1;
export const DELTA_LIMIT_DEFAULT = 200;
export const DELTA_LIMIT_MAX = 1000;
// If the client is more than this many seq behind the head, or asks
// for a `since` older than the oldest retained row, force a full
// resync instead of streaming a huge/partial delta.
export const DELTA_GAP_RESET_THRESHOLD = 5000;

function toSeqNumber(value) {
	if (value == null) {
		return 0;
	}
	const n = Number(value);
	return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

export async function getHead({ user = null, filters = {} } = {}) {
	// Every page asks for the head. The ledger aggregate and the stored feed
	// generation are independent, so they run together (one round trip, not
	// three - the generation's fallback used to repeat the same aggregate).
	const ledger = prisma.syncChange
		.aggregate({ _max: { seq: true } })
		.then((agg) => toSeqNumber(agg?._max?.seq))
		.catch(() => 0);
	const [serverSequence, gen] = await Promise.all([
		ledger,
		getFeedGeneration({ user, filters, ledgerHead: ledger }).catch(() => null),
	]);
	const feedGeneration = Number(gen?.generation ?? serverSequence) || 0;
	return {
		serverSequence,
		feedGeneration,
		appBuild: process.env.BUILD_ID || "dev",
		schemaVersion: SYNC_SCHEMA_VERSION,
	};
}

export function parseDeltaParams(query = {}) {
	const rawSince = query.since ?? query.cursor ?? "0";
	const since = toSeqNumber(rawSince);
	const rawLimit = Number(query.limit ?? DELTA_LIMIT_DEFAULT);
	const limit = Number.isFinite(rawLimit)
		? Math.min(DELTA_LIMIT_MAX, Math.max(1, Math.floor(rawLimit)))
		: DELTA_LIMIT_DEFAULT;
	return { since, limit };
}

export async function getDelta(since = 0, limit = DELTA_LIMIT_DEFAULT) {
	const cursor = toSeqNumber(since);
	const take = Math.min(
		DELTA_LIMIT_MAX,
		Math.max(1, Math.floor(Number(limit) || DELTA_LIMIT_DEFAULT)),
	);
	let rows = [];
	try {
		rows = await prisma.syncChange.findMany({
			where: { seq: { gt: cursor } },
			orderBy: { seq: "asc" },
			take: take + 1,
		});
	} catch {
		rows = [];
	}
	const hasMore = rows.length > take;
	if (hasMore) {
		rows = rows.slice(0, take);
	}
	const changes = rows.map((row) => ({
		seq: String(row.seq),
		seqNumber: Number(row.seq),
		scope: row.scope ?? null,
		entity_type: row.entity_type,
		entity_id: row.entity_id,
		operation: row.operation,
		entity_version: row.entity_version,
		content_hash: row.content_hash ?? null,
		occurred_at: row.occurred_at,
	}));
	const headSeq = changes.length > 0 ? changes[changes.length - 1].seqNumber : cursor;

	// Gap detection: if the client is too far behind, or `since` predates
	// the oldest retained row (retention prune), require a full resync.
	let resetRequired = false;
	let oldestSeq = null;
	try {
		const oldest = await prisma.syncChange.findFirst({
			orderBy: { seq: "asc" },
			select: { seq: true },
		});
		oldestSeq = oldest?.seq == null ? null : Number(oldest.seq);
	} catch {
		oldestSeq = null;
	}
	if (oldestSeq != null && cursor < oldestSeq - 1) {
		resetRequired = true;
	}
	try {
		const agg = await prisma.syncChange.aggregate({ _max: { seq: true } });
		const maxSeq = toSeqNumber(agg?._max?.seq);
		if (maxSeq - cursor > DELTA_GAP_RESET_THRESHOLD) {
			resetRequired = true;
		}
	} catch {
		// keep current verdict
	}
	return {
		changes,
		headSeq,
		hasMore,
		resetRequired,
		resetReason: resetRequired ? "RESET_REQUIRED" : null,
	};
}

// Whitelisted entity hydration for delta application.
// Only these entity types may be fetched by id through sync.
const HYDRATABLE = {
	feed_post: { delegate: "feedPost" },
	product: { delegate: "product" },
	requirement: { delegate: "requirement" },
	notification: { delegate: "notification" },
};

export function hydratableTypes() {
	return Object.keys(HYDRATABLE);
}

export async function fetchEntitiesByIds(entityType, ids = []) {
	const entry = HYDRATABLE[String(entityType || "")];
	if (!entry) {
		const err = new Error(`Cannot hydrate entity type ${entityType}`);
		err.status = 400;
		throw err;
	}
	const uniqueIds = [
		...new Set((Array.isArray(ids) ? ids : []).map((id) => String(id)).filter(Boolean)),
	];
	if (uniqueIds.length === 0) {
		return [];
	}
	const delegate = prisma[entry.delegate];
	if (!delegate?.findMany) {
		return [];
	}
	return delegate.findMany({ where: { id: { in: uniqueIds.slice(0, 100) } } });
}
