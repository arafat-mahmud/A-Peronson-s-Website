// Built-in parser plugins demonstrating the plugin architecture in server/log/parsers.js.
// Each parser receives an entry and may return a partial object merged into it
// (or null/undefined to leave it untouched). Register additional parsers via
// registerParser() from your own code without touching the core pipeline.

import { registerParser } from "./parsers.js";

const AUTH_RE = /jwt|bearer|login|logout|passkey|session expired|token/i;
const FAST_MS = 100;
const SLOW_MS = 1000;
const SYSLOG_PRIORITY_INDEX = 1;

function latencyBucket(ms) {
	if (ms < FAST_MS) {
		return "fast";
	}
	if (ms < SLOW_MS) {
		return "ok";
	}
	return "slow";
}

function authAnnotator(entry) {
	if (!AUTH_RE.test(entry.message || "")) {
		return null;
	}
	return {
		meta: { ...(entry.meta || {}), auth: true, sensitive: true },
	};
}

function latencyAnnotator(entry) {
	const raw = entry.meta?.duration_ms ?? entry.data?.duration_ms;
	if (!Number.isFinite(Number(raw))) {
		return null;
	}
	const ms = Number(raw);
	return {
		meta: {
			...(entry.meta || {}),
			latencyBucket: latencyBucket(ms),
			slow: ms >= SLOW_MS,
		},
	};
}

function syslogNormalizer(entry) {
	if (entry.source !== "syslog") {
		return null;
	}
	const msg = String(entry.message || "").slice(0, 120);
	const pri = /^<(\d+)>/.exec(msg);
	return {
		message: pri ? msg.slice(pri[0].length) : msg,
		meta: {
			...(entry.meta || {}),
			syslogPriority: pri ? Number(pri[SYSLOG_PRIORITY_INDEX]) : null,
			protocol: "syslog",
		},
	};
}

export function registerBuiltinParsers() {
	registerParser(authAnnotator);
	registerParser(latencyAnnotator);
	registerParser(syslogNormalizer);
}
