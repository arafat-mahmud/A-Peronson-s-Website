import crypto from "node:crypto";
import prisma from "../utils/prisma.js";

// HyperCache Phase 3 — per-viewer feed generation stub.
// A feed generation identifies the exact rendered feed for a
// (viewer segment + filter set) pair. Clients send it in the
// sync head to detect server-side feed recomputation.
// Backed by AppState so it survives restarts; falls back to the
// ledger head when AppState is unavailable.

const APP_STATE_KEY = "hypercache:feed_generation";

export function feedFilterHash(filters = {}) {
	const canonical = JSON.stringify(filters ?? {}, Object.keys(filters ?? {}).sort());
	return crypto.createHash("sha256").update(canonical, "utf8").digest("hex").slice(0, 16);
}

export function viewerSegment(user) {
	if (!user) {
		return "anon";
	}
	return String(user.role || "user");
}

/**
 * `ledgerHead` (a number or a promise of one) is the sync ledger's max seq
 * when the caller already has it - the sync head does - so the fallback does
 * not query the same aggregate a second time.
 */
export async function getFeedGeneration({ user = null, filters = {}, ledgerHead } = {}) {
	const segment = viewerSegment(user);
	const filterHash = feedFilterHash(filters);
	const key = `${APP_STATE_KEY}:${segment}:${filterHash}`;
	try {
		const record = await prisma.appState.findUnique({ where: { key } });
		const stored = record?.data?.generation;
		if (Number.isInteger(stored) && stored >= 0) {
			return { key, generation: stored, segment, filterHash };
		}
	} catch {
		// fall through to ledger fallback
	}
	let fallback = 0;
	try {
		if (ledgerHead !== undefined) {
			fallback = Number(await ledgerHead) || 0;
		} else {
			const head = await prisma.syncChange.aggregate({ _max: { seq: true } });
			const max = head?._max?.seq;
			fallback = max == null ? 0 : Number(max);
		}
	} catch {
		fallback = 0;
	}
	return { key, generation: fallback, segment, filterHash };
}

export async function bumpFeedGeneration({ user = null, filters = {} } = {}) {
	const { key, generation } = await getFeedGeneration({ user, filters });
	const next = generation + 1;
	try {
		await prisma.appState.upsert({
			where: { key },
			update: { data: { generation: next }, updated_at: new Date() },
			create: { key, data: { generation: next } },
		});
	} catch {
		// best-effort: AppState write failure must not break mutations
	}
	return next;
}
