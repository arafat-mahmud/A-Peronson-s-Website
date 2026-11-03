const LEVEL_SEV = { error: 1, critical: 2, warn: 0 };
const FILE_RE =
	/[a-zA-Z0-9_./-]+Controller\.js:\d+|[a-zA-Z0-9_./-]+Service\.js:\d+|([a-zA-Z0-9_./-]+)\.js:\d+/;
const MSG_LEN = 60;

function extractFile(stack) {
	const match = String(stack || "").match(FILE_RE);
	if (!match) {
		return null;
	}
	return match[1] || match[0];
}

function bump(map, key, n = 1) {
	map[key] = (map[key] || 0) + n;
}

function analyzeEntries(entries, cutoff) {
	const acc = {
		bySource: {},
		byFile: {},
		byCategory: {},
		byMessage: {},
		criticalCount: 0,
		errorCount: 0,
		total: 0,
	};
	for (const e of entries) {
		if (e.t < cutoff || !LEVEL_SEV[e.level]) {
			continue;
		}
		// repeated messages are grouped in the hub; weight by the live count
		const n = e.groupCount || 1;
		acc.total += n;
		if (e.level === "critical") {
			acc.criticalCount += n;
		} else if (e.level === "error") {
			acc.errorCount += n;
		}
		bump(acc.bySource, e.source || "unknown", n);
		const file = extractFile(e.stack);
		if (file) {
			bump(acc.byFile, file, n);
		}
		bump(acc.byCategory, e.category, n);
		bump(acc.byMessage, String(e.message || "").slice(0, MSG_LEN), n);
	}
	return acc;
}

function topN(map, n = 3) {
	return Object.entries(map)
		.sort((a, b) => b[1] - a[1])
		.slice(0, n);
}

function emptyResult(windowMs, minEvents, total) {
	return {
		windowMs,
		minEvents,
		events: total,
		summary: null,
		topSources: [],
		topFiles: [],
		topCategories: [],
		topMessages: [],
	};
}

function buildSummary({ total, criticalCount, errorCount, topFiles, topCategories, topMessages }) {
	const pct = (n) => Math.round((n / total) * 100);
	const parts = [];
	if (criticalCount > 0) {
		parts.push(`${criticalCount} critical events (${pct(criticalCount)}%)`);
	}
	if (errorCount > 0) {
		parts.push(`${errorCount} errors (${pct(errorCount)}%)`);
	}
	if (topFiles.length) {
		parts.push(`${pct(topFiles[0][1])}% originate from ${topFiles[0][0]}`);
	}
	if (topCategories.length) {
		parts.push(`top category: ${topCategories[0][0]}`);
	}
	if (topMessages.length) {
		parts.push(`most repeated: "${topMessages[0][0]}" ×${topMessages[0][1]}`);
	}
	return parts.join(" · ");
}

export function summarizeBurst({ windowMs = 60_000, minEvents = 5, entries = [] } = {}) {
	const now = Date.now();
	const cutoff = now - windowMs;
	const acc = analyzeEntries(entries, cutoff);

	if (acc.total < minEvents) {
		return emptyResult(windowMs, minEvents, acc.total);
	}

	const topSources = topN(acc.bySource);
	const topFiles = topN(acc.byFile);
	const topCategories = topN(acc.byCategory);
	const topMessages = topN(acc.byMessage);

	return {
		windowMs,
		minEvents,
		events: acc.total,
		criticalCount: acc.criticalCount,
		errorCount: acc.errorCount,
		summary: buildSummary({ ...acc, topFiles, topCategories, topMessages }),
		topSources,
		topFiles,
		topCategories,
		topMessages,
	};
}
