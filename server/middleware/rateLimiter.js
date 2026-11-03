import { getRedisClient, isRedisConnected } from "../utils/redis.js";

// ---------- memory store ----------
const ipHits = new Map();
// The unit budgets keep their own map: they are keyed by a DIFFERENT thing
// (a counter of paths, not a counter of requests), and sharing one map with
// the request limiters would let a request and a path spend each other's
// budget.
const unitHits = new Map();
let memoryCleanupStarted = false;

function ensureMemoryCleanup() {
	if (memoryCleanupStarted) {
		return;
	}
	memoryCleanupStarted = true;
	const timer = setInterval(() => {
		const cutoff = Date.now() - 3_600_000;
		for (const [ip, hits] of ipHits) {
			const recent = hits.filter((t) => t > cutoff);
			if (recent.length === 0) {
				ipHits.delete(ip);
			} else {
				ipHits.set(ip, recent);
			}
		}
		for (const [key, entries] of unitHits) {
			const recent = entries.filter((entry) => entry.at > cutoff);
			if (recent.length === 0) {
				unitHits.delete(key);
			} else {
				unitHits.set(key, recent);
			}
		}
	}, 300_000);
	// Node returns a Timeout with unref(); a browser-style environment (jsdom,
	// which the frontend suites run in) returns a number, and a number has no
	// unref. The timer is only a memory sweep, so it must not keep the process
	// alive where unref is unavailable.
	if (typeof timer?.unref === "function") {
		timer.unref();
	}
}

// ---------- createRateLimiter ----------
//
// keyResolver lets a route limit by something other than the caller's IP: a
// route that sits behind requireAuth can count per USER, which is the only
// meaningful key for a bearer-token API (many users behind one NAT share an
// address, and one address behind many users is not a user).
export function createRateLimiter({
	windowMs = 15 * 60 * 1000,
	max = 20,
	store = "memory",
	prefix = "global",
	keyResolver = null,
} = {}) {
	if (store === "redis") {
		return createRedisLimiter(windowMs, max, prefix, keyResolver);
	}
	return createMemoryLimiter(windowMs, max, keyResolver);
}

function limiterKey(req, keyResolver) {
	if (typeof keyResolver === "function") {
		const key = keyResolver(req);
		if (key !== undefined && key !== null && String(key) !== "") {
			return String(key);
		}
	}
	return req.ip || req.connection?.remoteAddress || "unknown";
}

// ---------- in-memory limiter ----------
function createMemoryLimiter(windowMs, max, keyResolver) {
	ensureMemoryCleanup();

	return (req, res, next) => {
		const key = limiterKey(req, keyResolver);
		const now = Date.now();
		const windowStart = now - windowMs;

		if (!ipHits.has(key)) {
			ipHits.set(key, []);
		}

		const hits = ipHits.get(key).filter((t) => t > windowStart);
		hits.push(now);
		ipHits.set(key, hits);

		if (hits.length > max) {
			return res.status(429).json({ error: "Too many requests, please try again later." });
		}

		next();
	};
}

// ---------- Redis limiter ----------
function createRedisLimiter(windowMs, max, prefix, keyResolver) {
	const windowSeconds = Math.ceil(windowMs / 1000);

	return (req, res, next) => {
		const key = `ratelimit:${prefix}:${limiterKey(req, keyResolver)}`;

		if (!isRedisConnected()) {
			return createMemoryLimiter(windowMs, max, keyResolver)(req, res, next);
		}

		const client = getRedisClient();

		client
			.incr(key)
			.then((count) => {
				if (count === 1) {
					return client.expire(key, windowSeconds).then(() => count);
				}
				return count;
			})
			.then((count) => {
				if (count > max) {
					return res.status(429).json({ error: "Too many requests, please try again later." });
				}
				next();
			})
			.catch(() => {
				next();
			});
	};
}

// ---------- unit budget ----------
//
// A request counter bounds how often a caller may ASK. It does not bound how
// much the server does per ask: /sign accepts up to 50 paths, and every path
// costs a database round trip inside the authorization resolver. So the sign
// route carries two budgets — one on requests, one on the paths those
// requests carry — and the PATH budget is the one that bounds the work.
//
// The two are separate on purpose. Giving a real client room (it signs one
// path per request, and spends another request per preview modal it opens)
// means raising the request cap, and a raised request cap multiplies the work
// by the same factor unless the paths are counted too.
//
// Fail closed: over budget is a refusal, never an allow-through.
export function createUnitBudget({
	windowMs = 60_000,
	max = 1000,
	store = "memory",
	prefix = "units",
	keyResolver = null,
} = {}) {
	if (store === "redis") {
		return createRedisUnitBudget(windowMs, max, prefix, keyResolver);
	}
	return createMemoryUnitBudget(windowMs, max, prefix, keyResolver);
}

function createMemoryUnitBudget(windowMs, max, prefix, keyResolver) {
	ensureMemoryCleanup();

	return (req, units = 1) => {
		const key = `${prefix}:${limiterKey(req, keyResolver)}`;
		const now = Date.now();
		const windowStart = now - windowMs;

		const entries = (unitHits.get(key) || []).filter((entry) => entry.at > windowStart);
		const spent = entries.reduce((total, entry) => total + entry.units, 0);
		if (spent + units > max) {
			// The spent units stay on the books: a refused request still spent
			// the caller's attention, and forgetting it would let a caller keep
			// probing past the budget one request at a time.
			unitHits.set(key, entries);
			return false;
		}
		entries.push({ at: now, units });
		unitHits.set(key, entries);
		return true;
	};
}

function createRedisUnitBudget(windowMs, max, prefix, keyResolver) {
	const windowSeconds = Math.ceil(windowMs / 1000);
	const fallback = createMemoryUnitBudget(windowMs, max, prefix, keyResolver);

	return async (req, units = 1) => {
		if (!isRedisConnected()) {
			return fallback(req, units);
		}
		const client = getRedisClient();
		if (typeof client?.incrBy !== "function") {
			return fallback(req, units);
		}
		const key = `ratelimit:${prefix}:${limiterKey(req, keyResolver)}`;
		try {
			const count = await client.incrBy(key, units);
			if (count <= units) {
				await client.expire(key, windowSeconds);
			}
			return count <= max;
		} catch {
			// A redis hiccup must not open the budget: the in-process counter
			// is the same accounting the non-redis path does.
			return fallback(req, units);
		}
	};
}

// ---------- named limiters ----------
const authLimiter = createRateLimiter({
	windowMs: 15 * 60 * 1000,
	max: 20,
	prefix: "auth",
});
const passkeyLimiter = createRateLimiter({
	windowMs: 15 * 60 * 1000,
	max: 10,
	prefix: "passkey",
});

const adminLimiter = createRateLimiter({
	windowMs: 60 * 1000,
	max: 60,
	prefix: "admin",
});

const generalLimiter = createRateLimiter({
	windowMs: 60 * 1000,
	max: 100,
	prefix: "general",
});

export { adminLimiter, authLimiter, generalLimiter, passkeyLimiter };

/**
 * Forget every counted hit.
 *
 * The counters live in module state, so a suite that exercises a limiter has
 * to be able to start from an empty budget - otherwise the first test that
 * spends the budget decides what every later test sees. The same shape as
 * `resetClarificationProvider` in the case conversation service.
 *
 * @returns {void}
 */
export function resetRateLimitCounters() {
	ipHits.clear();
	unitHits.clear();
}
