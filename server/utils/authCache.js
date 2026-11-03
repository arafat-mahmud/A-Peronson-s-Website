// A very short-lived cache for the two lookups every authenticated request
// makes: the user row and the session row.
//
// Production's database is on another continent from the API (one query is a
// ~250 ms round trip) and the pool has three connections, so these two reads
// were the most expensive part of most requests. Entries live up to 30 seconds
// and every write to `user` / `userSession` made by this process clears them
// (see the query extension in utils/prisma.js), so a logout, revoke, lock or
// role change still takes effect on the next request.

import { deepClone } from "./clone.js";

const MAX_ENTRIES = 5000;

function ttlMs() {
	const raw = Number(process.env.AUTH_CACHE_TTL_MS);
	if (Number.isFinite(raw) && raw >= 0) return raw;
	return process.env.NODE_ENV === "test" ? 0 : 30_000;
}

function makeStore() {
	const map = new Map();
	return {
		get(key) {
			const hit = map.get(key);
			if (!hit) return undefined;
			if (hit.expires <= Date.now()) {
				map.delete(key);
				return undefined;
			}
			return hit.value;
		},
		set(key, value) {
			const ttl = ttlMs();
			if (!ttl) return;
			if (map.size >= MAX_ENTRIES) {
				map.delete(map.keys().next().value);
			}
			map.set(key, { value, expires: Date.now() + ttl });
		},
		delete(key) {
			map.delete(key);
		},
		clear() {
			map.clear();
		},
	};
}

const users = makeStore();
const sessions = makeStore();
const inflight = new Map();
// Bumped by every invalidation: a read that started before a write must not
// put its (possibly old) row back into the cache after the write cleared it.
let generation = 0;

/** Caches the result of `load` under `key`; concurrent misses share one query. */
// Callers get their own copy: a handler that edits the row it was handed
// must not change what the next request sees.
const copy = (value) => (value && typeof value === "object" ? deepClone(value) : value);

async function cached(store, prefix, key, load) {
	const hit = store.get(key);
	if (hit !== undefined) return copy(hit);
	const flightKey = `${prefix}:${key}`;
	if (inflight.has(flightKey)) return inflight.get(flightKey).then(copy);
	const startedAt = generation;
	const promise = Promise.resolve()
		.then(load)
		.then((value) => {
			// A miss (null) is not cached: a row created a moment later must be seen.
			if (value && startedAt === generation) store.set(key, value);
			return value;
		})
		.finally(() => {
			if (inflight.get(flightKey) === promise) inflight.delete(flightKey);
		});
	inflight.set(flightKey, promise);
	return promise.then(copy);
}

export function cachedUser(id, load) {
	return cached(users, "u", String(id), load);
}

export function cachedSession(id, load) {
	return cached(sessions, "s", String(id), load);
}

export function invalidateUser(id) {
	generation++;
	inflight.clear();
	if (id === undefined || id === null) users.clear();
	else users.delete(String(id));
}

export function invalidateSessions() {
	generation++;
	inflight.clear();
	sessions.clear();
}

export function clearAuthCache() {
	generation++;
	inflight.clear();
	users.clear();
	sessions.clear();
}
