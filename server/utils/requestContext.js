// Per-request database accounting.
//
// Every Prisma query made while a request is being handled is counted against
// that request, and the total is sent back as a `Server-Timing` header
// (`db;dur=<ms>;desc="<n> queries"`). With the database a ~250 ms round trip
// away from the API, the NUMBER of sequential queries is what makes a page
// slow, and this makes it visible in the browser's network panel.

import { AsyncLocalStorage } from "node:async_hooks";

const storage = new AsyncLocalStorage();

export function currentRequestStats() {
	return storage.getStore();
}

export function recordQuery(durationMs) {
	const stats = storage.getStore();
	if (!stats) return;
	stats.queries += 1;
	stats.dbMs += durationMs;
}

export function requestStatsMiddleware(_req, res, next) {
	const stats = { queries: 0, dbMs: 0, startedAt: performance.now() };
	const writeHead = res.writeHead;
	res.writeHead = function patchedWriteHead(...args) {
		if (!res.headersSent) {
			const total = performance.now() - stats.startedAt;
			res.setHeader(
				"Server-Timing",
				`db;dur=${stats.dbMs.toFixed(0)};desc="${stats.queries} queries", app;dur=${total.toFixed(0)}`,
			);
		}
		return writeHead.apply(this, args);
	};
	storage.run(stats, next);
}
