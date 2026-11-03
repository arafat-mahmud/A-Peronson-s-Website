// Read-through cache for the `app_state` JSON rows (admin config, order
// certifications, policy state...). They are read on hot paths - the feed
// reads two of them per request - and every read was a database round trip.
//
// Every write to AppState made by this process clears the entry (see the query
// extension in utils/prisma.js), and the entry is cleared once more a moment
// later so a write inside a transaction that commits after the call is not
// shadowed by a read that raced it. Readers get a copy, never the cached object.

import { deepClone } from "./clone.js";

const entries = new Map();
let generation = 0;

function ttlMs() {
	const raw = Number(process.env.APP_STATE_CACHE_TTL_MS);
	if (Number.isFinite(raw) && raw >= 0) return raw;
	return 15_000;
}

export function appStateGeneration() {
	return generation;
}

export function getCachedAppState(key) {
	const hit = entries.get(key);
	if (!hit) return undefined;
	if (hit.expires <= Date.now()) {
		entries.delete(key);
		return undefined;
	}
	return deepClone(hit.data);
}

/** Stores `data` unless a write happened since the read started (`startedAt`). */
export function setCachedAppState(key, data, startedAt) {
	const ttl = ttlMs();
	if (!ttl || startedAt !== generation) return;
	entries.set(key, { data: deepClone(data), expires: Date.now() + ttl });
}

export function invalidateAppState(key) {
	generation++;
	if (typeof key === "string") entries.delete(key);
	else entries.clear();
}
