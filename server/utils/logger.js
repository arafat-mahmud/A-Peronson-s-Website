import chalk from "chalk";
import { formatConsoleEntry, formatStatsLine, gradientHeader } from "../log/format.js";
import { normalizeLevel } from "../log/levels.js";
import { logHub } from "../log/logHub.js";

let consolePretty = process.env.LOG_PRETTY !== "false" && !process.env.LOG_QUIET;

export function setLogPretty(value) {
	consolePretty = value;
}

function captureStack() {
	const err = new Error();
	const lines = String(err.stack || "").split("\n");
	return lines.slice(2, 6).join("\n").trim();
}

function emit(level, message, data = null, stack = null) {
	// Structured payloads may carry a pre-rendered colored line for the pretty
	// console while still storing real meta (request_id, duration_ms, ...) in
	// the hub. `_console` is stripped before the entry is stored.
	let consoleLine = null;
	let cleanData = data;
	if (data && typeof data === "object" && !Array.isArray(data) && data._console !== undefined) {
		consoleLine = String(data._console);
		cleanData = { ...data };
		delete cleanData._console;
	}

	const entry = logHub.createEntry({
		level,
		message,
		data: cleanData,
		stack,
		source: "server",
		meta: typeof cleanData === "object" && cleanData !== null ? extractMeta(cleanData) : null,
	});
	logHub.emit(entry);

	if (!consolePretty || process.env.LOG_QUIET) {
		return;
	}

	if (consoleLine !== null) {
		process.stdout.write(
			`${chalk.gray(`[${entry.ts.slice(11, 23)}]`)} ${message} ${consoleLine}\n`,
		);
		return;
	}

	if (typeof data === "string") {
		// Pre-formatted payloads (e.g. requestLogger) keep their own colors.
		process.stdout.write(`${chalk.gray(`[${entry.ts.slice(11, 23)}]`)} ${message} ${data}\n`);
		return;
	}

	process.stdout.write(`${formatConsoleEntry(entry)}\n`);
}

function extractMeta(data) {
	const keys = [
		"request_id",
		"method",
		"path",
		"status",
		"duration_ms",
		"response_bytes",
		"user_id",
		"role",
		"ip",
		"event",
		"type",
		"entity_id",
		"client_id",
		"session_id",
	];
	const meta = {};
	for (const k of keys) {
		if (data[k] !== undefined) {
			meta[k] = data[k];
		}
	}
	return Object.keys(meta).length ? meta : null;
}

export function logDebug(message, data = null) {
	emit("debug", message, data, captureStack());
}

export function logInfo(message, data = null) {
	emit("info", message, data, captureStack());
}

export function logSuccess(message, data = null) {
	emit("success", message, data, captureStack());
}

export function logWarn(message, data = null) {
	emit("warn", message, data, captureStack());
}

export function logError(message, error = null) {
	const stack =
		error instanceof Error
			? error.stack || error.message
			: typeof error === "string"
				? error
				: null;
	emit("error", message, error instanceof Error ? { message: error.message } : error, stack);
}

export function logCritical(message, error = null) {
	const stack =
		error instanceof Error
			? error.stack || error.message
			: typeof error === "string"
				? error
				: null;
	emit("critical", message, error instanceof Error ? { message: error.message } : error, stack);
}

export function logEvent(level, entry) {
	const e = logHub.createEntry({ level, source: "server", ...entry });
	logHub.emit(e);
	if (consolePretty && !process.env.LOG_QUIET) {
		process.stdout.write(`${formatConsoleEntry(e)}\n`);
	}
	return e;
}

export const logger = {
	debug: logDebug,
	info: logInfo,
	success: logSuccess,
	warn: logWarn,
	error: logError,
	critical: logCritical,
	event: logEvent,
};

export function printStartupBanner(appName = "GARTEX HUB") {
	if (consolePretty) {
		const line = gradientHeader(`${appName} — LOG STREAM`);
		process.stdout.write(`${line}\n`);
	}
}

export function printStats() {
	if (consolePretty) {
		process.stdout.write(`${formatStatsLine(logHub.getStats())}\n`);
	}
}

export function getLevel() {
	return normalizeLevel("info");
}
