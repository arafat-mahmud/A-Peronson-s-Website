// Memoize an async function for a while: for global, slow-changing data that
// many requests ask for (marketing counters, trending searches). Concurrent
// callers share one in-flight call; a rejected call is not cached.

export function memoizeAsync(fn, { ttlMs, key = () => "", maxEntries = 200 } = {}) {
	const entries = new Map();
	return function memoized(...args) {
		const k = String(key(...args));
		const hit = entries.get(k);
		if (hit && (hit.pending || hit.expires > Date.now())) {
			return hit.promise;
		}
		if (entries.size >= maxEntries) {
			entries.delete(entries.keys().next().value);
		}
		const entry = { pending: true, expires: 0, promise: null };
		entry.promise = Promise.resolve()
			.then(() => fn(...args))
			.then(
				(value) => {
					entry.pending = false;
					entry.expires = Date.now() + ttlMs;
					return value;
				},
				(error) => {
					entries.delete(k);
					throw error;
				},
			);
		entries.set(k, entry);
		return entry.promise;
	};
}
