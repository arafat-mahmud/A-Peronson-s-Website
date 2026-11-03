import crypto from "node:crypto";
import { EventEmitter } from "node:events";
import os from "node:os";
import { registerBuiltinParsers } from "./builtinParsers.js";
import { detectCategory } from "./categories.js";
import { levelColorFor, levelIconFor, normalizeLevel } from "./levels.js";
import { logFileWriter } from "./logFileWriter.js";
import { runParsers } from "./parsers.js";
import { matchQuery } from "./search.js";

registerBuiltinParsers();

const MAX_BUFFER = Number.parseInt(process.env.LOG_BUFFER_SIZE || "50000", 10);
const RATE_WINDOW_MS = 60_000;
const SPARK_SLOTS = 60;

function safeClone(value) {
	if (value === undefined) {
		return null;
	}
	if (
		typeof value === "string" ||
		typeof value === "number" ||
		typeof value === "boolean" ||
		value === null
	) {
		return value;
	}
	try {
		return JSON.parse(JSON.stringify(value));
	} catch {
		try {
			return String(value);
		} catch {
			return null;
		}
	}
}

class LogHub extends EventEmitter {
	constructor() {
		super();
		this.setMaxListeners(0);
		this.entries = [];
		this.byLevel = Object.fromEntries(
			["debug", "info", "success", "warn", "error", "critical"].map((k) => [k, 0]),
		);
		this.byCategory = new Map();
		this.byRequest = new Map();
		this.rateBuckets = [];
		this.sparklines = Object.fromEntries(
			["debug", "info", "success", "warn", "error", "critical"].map((k) => [
				k,
				new Array(SPARK_SLOTS).fill(0),
			]),
		);
		this.metrics = {
			rate: 0,
			reqRate: 0,
			dropped: 0,
			filtered: 0,
			latencyP50: 0,
			latencyP95: 0,
			avgLatency: 0,
			workers: 0,
			workQ: 0,
			redis: null,
			regexHits: 0,
			startedAt: Date.now(),
			lastRates: [],
			lastReqs: [],
			lastLatency: [],
			host: os.hostname(),
			pid: process.pid,
		};
		this.bookmarks = new Set();
		this.pinned = new Set();
		this.groups = new Map();
		this.settings = {
			maxGroupSize: Number.parseInt(process.env.LOG_GROUP_SIZE || "20", 10),
			ignorePatterns: [],
		};
		this.sessionRecorder = null;
		this._lastRateTick = Date.now();
		this._rateAccum = 0;
		this._reqAccum = 0;
		this._setupRateTimer();
		this._setupFileWriter();
	}

	_setupFileWriter() {
		logFileWriter.init();
		this.on("all", (entry) => {
			logFileWriter.append(entry);
		});
	}

	_setupRateTimer() {
		this._rateTimer = setInterval(() => {
			const now = Date.now();
			this.rateBuckets = this.rateBuckets.filter((b) => now - b.t < RATE_WINDOW_MS);
			this.metrics.rate = this._rateAccum;
			this.metrics.reqRate = this._reqAccum;
			this.metrics.lastRates.push(this._rateAccum);
			this.metrics.lastReqs.push(this._reqAccum);
			if (this.metrics.lastRates.length > SPARK_SLOTS) {
				this.metrics.lastRates.shift();
			}
			if (this.metrics.lastReqs.length > SPARK_SLOTS) {
				this.metrics.lastReqs.shift();
			}
			for (const lvl of Object.keys(this.sparklines)) {
				this.sparklines[lvl].shift();
				this.sparklines[lvl].push(0);
			}
			this._rateAccum = 0;
			this._reqAccum = 0;
			this._lastRateTick = now;
			this.emitEvent("stats", this.getStats());
		}, 1000);
		if (this._rateTimer.unref) {
			this._rateTimer.unref();
		}
	}

	createEntry({
		level = "info",
		message = "",
		data = null,
		stack = null,
		source = "server",
		meta = null,
		category = null,
		id = null,
		ts = null,
	}) {
		const time = ts ? new Date(ts) : new Date();
		const norm = normalizeLevel(level);
		const entry = {
			id: id || crypto.randomUUID(),
			ts: time.toISOString(),
			t: time.getTime(),
			level: norm,
			levelIcon: levelIconFor(norm),
			levelColor: levelColorFor(norm),
			category: category || detectCategory(message, data),
			source,
			message: String(message || ""),
			data: safeClone(data),
			stack: stack ? String(stack) : null,
			meta: meta && typeof meta === "object" ? safeClone(meta) : null,
			host: os.hostname(),
			pid: process.pid,
			bookmarked: false,
			pinned: false,
			request_id: meta?.request_id || data?.request_id || null,
			groupCount: 1,
		};
		return entry;
	}

	emit(entry) {
		if (!entry || typeof entry !== "object") {
			return null;
		}
		const parsed = runParsers(entry);
		if (parsed) {
			entry = parsed;
		}
		this._rateAccum += 1;
		if (entry.category === "requests") {
			this._reqAccum += 1;
		}
		this.byLevel[entry.level] = (this.byLevel[entry.level] || 0) + 1;
		this.byCategory.set(entry.category, (this.byCategory.get(entry.category) || 0) + 1);

		const spark = this.sparklines[entry.level];
		if (spark) {
			spark[spark.length - 1] += 1;
		}

		if (entry.request_id) {
			if (!this.byRequest.has(entry.request_id)) {
				this.byRequest.set(entry.request_id, []);
			}
			const reqList = this.byRequest.get(entry.request_id);
			reqList.push(entry);
			if (reqList.length > 100) {
				reqList.shift();
			}
		}

		const grouped = this._maybeGroup(entry);
		if (grouped) {
			this.emitEvent("group", grouped);
			this.emitEvent("entry", grouped);
			this.emitEvent("all", grouped);
			return grouped;
		}

		this.entries.push(entry);
		if (this.entries.length > MAX_BUFFER) {
			const removed = this.entries.splice(0, this.entries.length - MAX_BUFFER);
			this.metrics.dropped += removed.length;
		}

		this.emitEvent("entry", entry);
		this.emitEvent("all", entry);

		if (this.sessionRecorder && this.sessionRecorder.active) {
			this._record(entry);
		}

		return entry;
	}

	emitEvent(name, payload) {
		super.emit(name, payload);
	}

	_maybeGroup(entry) {
		const patterns = this.settings.ignorePatterns || [];
		for (const p of patterns) {
			try {
				if (new RegExp(p).test(entry.message)) {
					this.metrics.filtered += 1;
					return null;
				}
			} catch {
				// bad regex -> ignore rule
			}
		}

		const key = `${entry.level}|${entry.category}|${entry.message}`;
		if (this.groups.has(key)) {
			const g = this.groups.get(key);
			g.count += 1;
			g.last = entry.ts;
			g.groupCount = g.count;
			g.t = entry.t;
			g.latest = entry;
			// keep the canonical buffer entry's count live so snapshots/query/burst
			// reflect real repeat counts instead of deduped 1s
			if (g.entry) {
				g.entry.groupCount = g.count;
			}
			if (!g.entryIds.includes(entry.id)) {
				g.entryIds.push(entry.id);
				if (g.entryIds.length > 500) {
					g.entryIds.shift();
				}
			}
			return {
				...entry,
				groupKey: key,
				groupCount: g.count,
				firstTs: g.first,
				isGroupUpdate: true,
				stack: g.stack || entry.stack,
			};
		}
		this.groups.set(key, {
			key,
			count: 1,
			first: entry.ts,
			last: entry.ts,
			entryIds: [entry.id],
			stack: entry.stack || null,
			entry,
		});
		return null;
	}

	bookmark(id) {
		const entry = this.entries.find((e) => e.id === id) || this._groupEntry(id);
		if (!entry) {
			return null;
		}
		entry.bookmarked = !entry.bookmarked;
		if (entry.bookmarked) {
			this.bookmarks.add(id);
		} else {
			this.bookmarks.delete(id);
		}
		this.emitEvent("bookmarks", this.getBookmarks());
		return entry.bookmarked;
	}

	_groupEntry(id) {
		for (const g of this.groups.values()) {
			if (g.entryIds.includes(id)) {
				return { ...g.latest, id, bookmarked: false };
			}
		}
		return null;
	}

	pin(id) {
		const entry = this.entries.find((e) => e.id === id);
		if (!entry) {
			return;
		}
		entry.pinned = !entry.pinned;
		if (entry.pinned) {
			this.pinned.add(id);
		} else {
			this.pinned.delete(id);
		}
	}

	getBookmarks() {
		return this.entries
			.filter((e) => e.bookmarked)
			.map((e) => ({
				id: e.id,
				level: e.level,
				message: e.message,
				ts: e.ts,
				category: e.category,
			}));
	}

	query({
		level,
		category,
		q,
		requestId,
		from,
		to,
		limit = 500,
		skip = 0,
		pinnedOnly = false,
		bookmarkedOnly = false,
	} = {}) {
		let list = this.entries;
		if (level) {
			list = list.filter((e) => e.level === level);
		}
		if (category && category !== "overview" && category !== "live") {
			list = list.filter((e) => e.category === category);
		}
		if (requestId) {
			list = list.filter((e) => e.request_id === requestId);
		}
		if (from) {
			const f = parseTime(from);
			list = list.filter((e) => e.t >= f);
		}
		if (to) {
			const t = parseTime(to);
			list = list.filter((e) => e.t <= t);
		}
		if (bookmarkedOnly) {
			list = list.filter((e) => e.bookmarked);
		}
		if (pinnedOnly) {
			list = list.filter((e) => e.pinned);
		}
		if (q) {
			const matcher = matchQuery(q);
			list = list.filter((e) => matcher(e));
		}
		return list
			.slice(-(skip + limit))
			.slice(0, limit)
			.reverse();
	}

	requestFlow(requestId) {
		return this.byRequest.get(requestId) || [];
	}

	getStats() {
		const total = this.entries.length;
		const byLevel = { ...this.byLevel };
		const byCategory = Object.fromEntries(this.byCategory);
		const recent = [];
		const now = Date.now();
		for (const lvl of Object.keys(this.sparklines)) {
			const arr = this.sparklines[lvl];
			let sum = 0;
			for (const v of arr.slice(-10)) {
				sum += v;
			}
			recent.push({ level: lvl, count: sum });
		}
		// latency percentile stats from recent request durations
		const durs = [];
		const cutoff = now - 60_000;
		for (const e of this.entries) {
			if (e.t < cutoff) {
				continue;
			}
			const ms = e.meta?.duration_ms ?? e.data?.duration_ms;
			if (Number.isFinite(Number(ms))) {
				durs.push(Number(ms));
			}
		}
		let p50 = null;
		let p95 = null;
		let p99 = null;
		if (durs.length) {
			const sorted = durs.sort((a, b) => a - b);
			p50 = sorted[Math.floor(sorted.length * 0.5)];
			p95 = sorted[Math.floor(sorted.length * 0.95)];
			p99 = sorted[Math.floor(sorted.length * 0.99)];
		}
		const avgLatency = durs.length ? durs.reduce((a, b) => a + b, 0) / durs.length : 0;
		// numeric latency histogram buckets (<1, <5, <10, <50, <100, <500, <1s, <2s, >2s)
		const edges = [1, 5, 10, 50, 100, 500, 1000, 2000];
		const histogram = new Array(edges.length + 1).fill(0);
		for (const ms of durs) {
			let b = edges.length;
			for (let i = 0; i < edges.length; i++) {
				if (ms < edges[i]) {
					b = i;
					break;
				}
			}
			histogram[b] += 1;
		}
		return {
			total,
			byLevel,
			byCategory,
			rate: this.metrics.rate,
			reqRate: this.metrics.reqRate,
			dropped: this.metrics.dropped,
			filtered: this.metrics.filtered,
			avgLatency,
			p50,
			p95,
			p99,
			histogram,
			latencies: durs.slice(-200),
			workers: this.metrics.workers,
			workQ: this.metrics.workQ,
			redis: this.metrics.redis,
			regexHits: this.metrics.regexHits,
			lastRates: this.metrics.lastRates,
			lastReqs: this.metrics.lastReqs,
			recent,
			uptime: Math.round((now - this.metrics.startedAt) / 1000),
			host: this.metrics.host,
			pid: this.metrics.pid,
			startedAt: this.metrics.startedAt,
			groups: this.groups.size,
			activeRecorder: this.sessionRecorder?.active,
		};
	}

	getHeatmap() {
		const buckets = new Array(24).fill(0);
		for (const e of this.entries) {
			const hour = new Date(e.t).getHours();
			buckets[hour] += 1;
		}
		const max = Math.max(...buckets, 1);
		return { buckets, max, now: Date.now() };
	}

	clear() {
		this.entries = [];
		this.emitEvent("clear");
	}

	setRuntimeMetrics({ workers, workQ, redis, regexHits } = {}) {
		if (workers !== undefined) {
			this.metrics.workers = workers;
		}
		if (workQ !== undefined) {
			this.metrics.workQ = workQ;
		}
		if (redis !== undefined) {
			this.metrics.redis = redis;
		}
		if (regexHits !== undefined) {
			this.metrics.regexHits = regexHits;
		}
	}

	startRecording({ windowMs = 0 } = {}) {
		this.sessionRecorder = {
			active: true,
			startedAt: Date.now(),
			windowMs,
			entries: [],
			offset: this.entries.length,
		};
		this.emitEvent("recorder", { active: true });
		return true;
	}

	stopRecording() {
		if (!this.sessionRecorder) {
			return null;
		}
		const rec = this.sessionRecorder;
		const snapshot = this.entries.slice(rec.offset);
		rec.active = false;
		rec.snapshot = snapshot;
		this.sessionRecorder = null;
		this.emitEvent("recorder", { active: false });
		return { entries: snapshot, startedAt: rec.startedAt, endedAt: Date.now() };
	}

	_record(entry) {
		const rec = this.sessionRecorder;
		rec.entries.push(entry);
		if (rec.windowMs && rec.entries.length > 5000) {
			rec.entries.splice(0, rec.entries.length - 5000);
		}
	}

	addIgnore(pattern) {
		this.settings.ignorePatterns.push(pattern);
		this.emitEvent("settings", this.settings);
	}

	removeIgnore(pattern) {
		this.settings.ignorePatterns = this.settings.ignorePatterns.filter((p) => p !== pattern);
		this.emitEvent("settings", this.settings);
	}

	snapshot() {
		return {
			entries: this.entries.slice(-1000),
			stats: this.getStats(),
			bookmarks: this.getBookmarks(),
			heatmap: this.getHeatmap(),
		};
	}
}

function parseTime(v) {
	if (typeof v === "number") {
		return v;
	}
	const s = String(v);
	if (/^\d+$/.test(s)) {
		return Number.parseInt(s, 10);
	}
	const m = s.match(/^(\d+)([smhd])$/);
	if (m) {
		const mult = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[m[2]];
		return Date.now() - Number.parseInt(m[1], 10) * mult;
	}
	return Number.NaN;
}

export const logHub = new LogHub();
