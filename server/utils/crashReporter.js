// Crash capture for the API process.
//
// A fatal error is written SYNCHRONOUSLY - to a rotated file under
// CRASH_LOG_DIR and as one JSON line on stderr (Render's log stream, the only
// record that survives on the ephemeral Render Free disk) - before anything
// asynchronous is attempted. Persisting the record to PostgreSQL is a bounded,
// best-effort extra that can never delay the exit.
//
// Expected API errors (400/401/403/404...) are answered by the error handler
// and never reach this module.

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const MB = 1024 * 1024;

function envFlag(name, fallback) {
	const raw = String(process.env[name] ?? "")
		.trim()
		.toLowerCase();
	if (!raw) return fallback;
	return !["0", "false", "no", "off"].includes(raw);
}

function envNumber(name, fallback) {
	const value = Number(process.env[name]);
	return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function crashConfig() {
	return {
		enabled: envFlag("CRASH_LOG_ENABLED", true),
		dir: path.resolve(process.cwd(), process.env.CRASH_LOG_DIR || "logs/crashes"),
		maxFileBytes: envNumber("CRASH_LOG_MAX_SIZE_MB", 5) * MB,
		maxFiles: Math.floor(envNumber("CRASH_LOG_MAX_FILES", 10)),
		databaseEnabled: envFlag("CRASH_LOG_DATABASE_ENABLED", true),
		persistTimeoutMs: envNumber("CRASH_PERSIST_TIMEOUT_MS", 1500),
		// "log" records an unhandled rejection and keeps serving; "fatal"
		// treats it like an uncaught exception (Node's own default).
		rejectionMode:
			String(process.env.CRASH_UNHANDLED_REJECTION || "log").toLowerCase() === "fatal"
				? "fatal"
				: "log",
	};
}

// --- secret redaction -------------------------------------------------------

const SECRET_ENV_NAME = /(SECRET|PASSWORD|TOKEN|API_KEY|PRIVATE|DATABASE_URL|_CODE|CREDENTIAL)/i;

function secretValues() {
	const values = [];
	for (const [name, value] of Object.entries(process.env)) {
		if (SECRET_ENV_NAME.test(name) && typeof value === "string" && value.length >= 6) {
			values.push(value);
		}
	}
	// Longest first so a value that contains another is replaced whole.
	return values.sort((a, b) => b.length - a.length);
}

export function redact(text) {
	let out = String(text ?? "");
	for (const value of secretValues()) {
		out = out.split(value).join("[REDACTED]");
	}
	return out
		.replace(/([a-z][a-z0-9+.-]*:\/\/)[^\s/@:]+:[^\s/@]+@/gi, "$1[REDACTED]@")
		.replace(/(bearer\s+)[a-z0-9._~+/-]+=*/gi, "$1[REDACTED]")
		.replace(/\beyJ[a-zA-Z0-9_-]{8,}\.[a-zA-Z0-9_-]{8,}\.[a-zA-Z0-9_-]+/g, "[REDACTED_JWT]")
		.replace(/((?:password|passwd|secret|token|api[_-]?key)["'\s:=]+)[^\s"',;]+/gi, "$1[REDACTED]");
}

// --- record -----------------------------------------------------------------

let appVersion = "";
let gitCommit = "";
const subsystemState = { startup: "booting" };

function readVersion() {
	if (appVersion) return appVersion;
	try {
		const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8"));
		appVersion = String(pkg.version || "0.0.0");
	} catch {
		appVersion = "unknown";
	}
	return appVersion;
}

function readCommit() {
	if (gitCommit) return gitCommit;
	gitCommit = process.env.RENDER_GIT_COMMIT || process.env.GIT_COMMIT || "";
	if (!gitCommit) {
		try {
			const head = fs.readFileSync(path.join(process.cwd(), ".git", "HEAD"), "utf8").trim();
			const ref = head.startsWith("ref: ") ? head.slice(5) : "";
			gitCommit = ref
				? fs.readFileSync(path.join(process.cwd(), ".git", ref), "utf8").trim()
				: head;
		} catch {
			gitCommit = "unknown";
		}
	}
	return gitCommit;
}

/** Lets the server describe what was running when it died (no secrets). */
export function setSubsystemState(name, state) {
	subsystemState[String(name)] = String(state);
}

export function buildCrashRecord({
	type,
	error,
	fatal = true,
	exitCode = null,
	signal = null,
	origin = null,
}) {
	const err = error instanceof Error ? error : new Error(String(error ?? "unknown error"));
	const memory = process.memoryUsage();
	let resource = null;
	try {
		const usage = process.resourceUsage();
		resource = {
			user_cpu_ms: Math.round(usage.userCPUTime / 1000),
			system_cpu_ms: Math.round(usage.systemCPUTime / 1000),
			max_rss_kb: usage.maxRSS,
		};
	} catch {
		resource = null;
	}
	return {
		crash_id: crypto.randomUUID(),
		timestamp: new Date().toISOString(),
		app: "gartexhub-api",
		environment: process.env.NODE_ENV || "development",
		version: readVersion(),
		commit: readCommit(),
		node: process.version,
		pid: process.pid,
		uptime_s: Math.round(process.uptime()),
		type,
		fatal: Boolean(fatal),
		exit_code: exitCode,
		signal,
		origin,
		error: {
			name: redact(err.name || "Error"),
			message: redact(err.message || ""),
			code: err.code ? redact(String(err.code)) : null,
			stack: redact(err.stack || ""),
		},
		os: { platform: process.platform, release: os.release(), arch: process.arch },
		memory: {
			rss_mb: +(memory.rss / MB).toFixed(1),
			heap_used_mb: +(memory.heapUsed / MB).toFixed(1),
			heap_total_mb: +(memory.heapTotal / MB).toFixed(1),
			external_mb: +(memory.external / MB).toFixed(1),
			array_buffers_mb: +((memory.arrayBuffers || 0) / MB).toFixed(1),
		},
		resource,
		subsystems: { ...subsystemState },
	};
}

// --- synchronous file sink --------------------------------------------------

function pruneOldFiles(dir, prefix, keep) {
	try {
		const files = fs
			.readdirSync(dir)
			.filter((name) => name.startsWith(prefix))
			.map((name) => ({ name, mtime: fs.statSync(path.join(dir, name)).mtimeMs }))
			.sort((a, b) => b.mtime - a.mtime);
		for (const file of files.slice(keep)) {
			fs.unlinkSync(path.join(dir, file.name));
		}
	} catch {
		// pruning is housekeeping; a failure must not mask the crash itself
	}
}

function rotateIfLarge(filePath, maxBytes) {
	try {
		if (fs.statSync(filePath).size < maxBytes) return;
		const stamp = new Date().toISOString().replace(/[:.]/g, "-");
		const ext = path.extname(filePath);
		fs.renameSync(filePath, `${filePath.slice(0, -ext.length)}.${stamp}${ext}`);
	} catch {
		// missing file: nothing to rotate
	}
}

function appendSync(filePath, text) {
	const fd = fs.openSync(filePath, "a", 0o600);
	try {
		fs.writeSync(fd, text);
	} finally {
		fs.closeSync(fd);
	}
}

function humanBlock(record) {
	return [
		`=== ${record.timestamp} ${record.type} ${record.fatal ? "FATAL" : "non-fatal"} [${record.crash_id}]`,
		`app=${record.app} env=${record.environment} version=${record.version} commit=${record.commit} node=${record.node} pid=${record.pid} uptime=${record.uptime_s}s`,
		`exit_code=${record.exit_code ?? "-"} signal=${record.signal ?? "-"} origin=${record.origin ?? "-"}`,
		`memory rss=${record.memory.rss_mb}MB heap=${record.memory.heap_used_mb}/${record.memory.heap_total_mb}MB external=${record.memory.external_mb}MB`,
		`subsystems ${JSON.stringify(record.subsystems)}`,
		record.error.stack || `${record.error.name}: ${record.error.message}`,
		"",
	].join("\n");
}

/**
 * Writes the record to disk and stderr synchronously. Never throws: a broken
 * log directory degrades to stderr only.
 */
export function writeCrashSync(record, config = crashConfig()) {
	const result = { file: null, stderr: false };
	try {
		fs.writeSync(
			2,
			`${JSON.stringify({ level: record.fatal ? "fatal" : "error", event: "crash", ...record })}\n`,
		);
		result.stderr = true;
	} catch {
		// stderr closed: the file below is the remaining record
	}
	if (!config.enabled) return result;
	try {
		fs.mkdirSync(config.dir, { recursive: true, mode: 0o700 });
		const day = record.timestamp.slice(0, 10);
		const dailyFile = path.join(config.dir, `crash-${day}.log`);
		const historyFile = path.join(config.dir, "crash-history.jsonl");
		rotateIfLarge(dailyFile, config.maxFileBytes);
		rotateIfLarge(historyFile, config.maxFileBytes);
		appendSync(dailyFile, humanBlock(record));
		appendSync(historyFile, `${JSON.stringify(record)}\n`);
		pruneOldFiles(config.dir, "crash-2", config.maxFiles);
		pruneOldFiles(config.dir, "crash-history.", config.maxFiles);
		result.file = dailyFile;
	} catch (error) {
		try {
			fs.writeSync(
				2,
				`${JSON.stringify({ level: "error", event: "crash_log_write_failed", message: redact(error?.message) })}\n`,
			);
		} catch {
			// nothing left to report to
		}
	}
	return result;
}

// --- bounded database persistence -------------------------------------------

export async function persistCrashRecord(record, config = crashConfig()) {
	if (!config.databaseEnabled || process.env.NODE_ENV === "test") return false;
	let timer = null;
	try {
		const { default: prisma } = await import("./prisma.js");
		if (!prisma?.crashEvent?.create) return false;
		const write = prisma.crashEvent.create({
			data: {
				id: record.crash_id,
				type: record.type,
				fatal: record.fatal,
				error_name: record.error.name.slice(0, 200),
				error_message: record.error.message.slice(0, 2000),
				stack: record.error.stack.slice(0, 20000),
				exit_code: record.exit_code,
				signal: record.signal,
				environment: record.environment,
				version: record.version,
				commit: record.commit.slice(0, 64),
				node_version: record.node,
				pid: record.pid,
				uptime_s: record.uptime_s,
				details: {
					memory: record.memory,
					resource: record.resource,
					subsystems: record.subsystems,
					origin: record.origin,
				},
			},
		});
		const timeout = new Promise((resolve) => {
			timer = setTimeout(() => resolve("timeout"), config.persistTimeoutMs);
		});
		const outcome = await Promise.race([write.then(() => "saved"), timeout]);
		return outcome === "saved";
	} catch {
		return false;
	} finally {
		if (timer) clearTimeout(timer);
	}
}

// --- process handlers -------------------------------------------------------

const recorded = new WeakSet();
let fatalInProgress = false;

function recordOnce(error, details) {
	if (error && typeof error === "object") {
		if (recorded.has(error)) return null;
		recorded.add(error);
	}
	const record = buildCrashRecord({ error, ...details });
	writeCrashSync(record);
	return record;
}

/**
 * Installs the process-level handlers. `shutdown(reason, exitCode)` performs
 * the application's graceful shutdown and exits; it is awaited with a hard
 * deadline so a hung cleanup cannot keep a corrupted process alive.
 */
export function installCrashHandlers({ shutdown, logWarn = () => {}, hardExitMs = 8000 } = {}) {
	const config = crashConfig();

	const fatal = (error, details) => {
		const record = recordOnce(error, { fatal: true, exitCode: 1, ...details });
		if (fatalInProgress) return;
		fatalInProgress = true;
		const deadline = setTimeout(() => process.exit(1), hardExitMs);
		deadline.unref?.();
		Promise.resolve()
			.then(() => (record ? persistCrashRecord(record, config) : false))
			.catch(() => false)
			.then(() => (typeof shutdown === "function" ? shutdown(`fatal:${details.type}`, 1) : null))
			.catch(() => null)
			.finally(() => process.exit(1));
	};

	// The monitor sees the error first and writes the record; the handler
	// below then only has to shut down (recordOnce prevents a second entry).
	process.on("uncaughtExceptionMonitor", (error, origin) => {
		recordOnce(error, { type: "uncaughtException", fatal: true, exitCode: 1, origin });
	});
	process.on("uncaughtException", (error, origin) => {
		fatal(error, { type: "uncaughtException", origin });
	});

	process.on("unhandledRejection", (reason) => {
		const error = reason instanceof Error ? reason : new Error(String(reason));
		if (config.rejectionMode === "fatal") {
			fatal(error, { type: "unhandledRejection" });
			return;
		}
		const record = recordOnce(error, { type: "unhandledRejection", fatal: false });
		if (record) void persistCrashRecord(record, config);
	});

	process.on("warning", (warning) => {
		logWarn("process_warning", { name: warning?.name, message: redact(warning?.message) });
	});

	return { fatal };
}

/** For startup failures caught by start().catch: record, persist, exit. */
export async function recordFatalAndExit(error, type = "startupFailure") {
	const record = recordOnce(error, { type, fatal: true, exitCode: 1 });
	if (record) await persistCrashRecord(record);
	process.exit(1);
}

// --- memory monitor ---------------------------------------------------------

/**
 * Logs a warning when RSS crosses MEMORY_WARN_RSS_MB (default 420 MB, below
 * Render Free's 512 MB) and again when it recovers. One cheap sample per
 * interval; the event-loop histogram is the built-in perf_hooks one.
 */
export async function startMemoryMonitor({ logWarn = () => {}, logInfo = () => {} } = {}) {
	const thresholdBytes = envNumber("MEMORY_WARN_RSS_MB", 420) * MB;
	const intervalMs = envNumber("MEMORY_CHECK_INTERVAL_MS", 60_000);
	let histogram = null;
	try {
		const { monitorEventLoopDelay } = await import("node:perf_hooks");
		histogram = monitorEventLoopDelay({ resolution: 50 });
		histogram.enable();
	} catch {
		histogram = null;
	}
	let warned = false;
	const timer = setInterval(() => {
		const memory = process.memoryUsage();
		const sample = {
			rss_mb: +(memory.rss / MB).toFixed(1),
			heap_used_mb: +(memory.heapUsed / MB).toFixed(1),
			heap_total_mb: +(memory.heapTotal / MB).toFixed(1),
			external_mb: +(memory.external / MB).toFixed(1),
			event_loop_p99_ms: histogram ? +(histogram.percentile(99) / 1e6).toFixed(1) : null,
		};
		histogram?.reset();
		if (!warned && memory.rss >= thresholdBytes) {
			warned = true;
			logWarn("memory_high", sample);
		} else if (warned && memory.rss < thresholdBytes * 0.9) {
			warned = false;
			logInfo("memory_recovered", sample);
		}
	}, intervalMs);
	timer.unref?.();
	return () => {
		clearInterval(timer);
		histogram?.disable();
	};
}

export function __resetCrashReporterForTests() {
	fatalInProgress = false;
}
