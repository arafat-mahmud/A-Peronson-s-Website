#!/usr/bin/env node
// Local development supervisor for the API (`pnpm run server:supervised`).
//
// Restarts server/server.js after a crash with exponential backoff
// (2s, 4s, 8s, ... capped), stops restarting during a crash loop, and never
// restarts after an intentional stop (exit 0, Ctrl+C, SIGTERM).
//
// Not for Render: there the platform restarts the process, and a parent that
// swallowed child crashes would hide them from it. The script refuses to run
// when RENDER is set.

import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildCrashRecord, writeCrashSync } from "../server/utils/crashReporter.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function envNumber(name, fallback) {
	const value = Number(process.env[name]);
	return Number.isFinite(value) && value > 0 ? value : fallback;
}

const config = {
	enabled: !["0", "false", "no", "off"].includes(String(process.env.CRASH_RESTART_ENABLED || "").toLowerCase()),
	maxAttempts: Math.floor(envNumber("CRASH_RESTART_MAX_ATTEMPTS", 5)),
	baseDelayMs: envNumber("CRASH_RESTART_BASE_DELAY_MS", 2000),
	maxDelayMs: envNumber("CRASH_RESTART_MAX_DELAY_MS", 60_000),
	// A child that stayed up this long counts as healthy: the backoff resets.
	stableAfterMs: envNumber("CRASH_RESTART_STABLE_MS", 60_000),
	entry: process.env.SUPERVISED_ENTRY || "server/server.js",
};

export function restartDelay(attempt, { baseDelayMs, maxDelayMs }) {
	return Math.min(maxDelayMs, baseDelayMs * 2 ** Math.max(0, attempt - 1));
}

function log(message, data = {}) {
	process.stdout.write(`[supervisor] ${message}${Object.keys(data).length ? ` ${JSON.stringify(data)}` : ""}\n`);
}

function main() {
	if (process.env.RENDER) {
		log("RENDER is set: run `node server/server.js` directly; Render restarts crashed processes itself.");
		process.exit(2);
	}

	let child = null;
	let stopping = false;
	let attempts = 0;
	let restartTimer = null;

	const stop = (signal) => {
		stopping = true;
		if (restartTimer) clearTimeout(restartTimer);
		if (child && child.exitCode === null) {
			child.kill(signal);
		} else {
			process.exit(0);
		}
	};
	process.on("SIGINT", () => stop("SIGINT"));
	process.on("SIGTERM", () => stop("SIGTERM"));

	const launch = () => {
		const startedAt = Date.now();
		child = spawn(process.execPath, [config.entry], { cwd: root, stdio: "inherit", env: process.env });
		log("started", { pid: child.pid, attempt: attempts });

		child.on("exit", (code, signal) => {
			const upMs = Date.now() - startedAt;
			if (stopping || code === 0) {
				log("stopped", { code, signal });
				process.exit(0);
			}
			if (upMs >= config.stableAfterMs) attempts = 0;
			attempts += 1;

			// The child writes its own crash record when it can; this one also
			// covers deaths it cannot report (SIGKILL, OOM, native aborts).
			writeCrashSync(
				buildCrashRecord({
					type: "childExit",
					error: new Error(`API process exited (code=${code}, signal=${signal}) after ${Math.round(upMs / 1000)}s`),
					fatal: true,
					exitCode: code,
					signal,
				}),
			);

			if (!config.enabled) {
				log("restart disabled (CRASH_RESTART_ENABLED=false)", { code, signal });
				process.exit(code || 1);
			}
			if (attempts > config.maxAttempts) {
				log("crash loop: giving up after repeated failures - fix the error and start again", {
					attempts: attempts - 1,
				});
				process.exit(code || 1);
			}
			const delay = restartDelay(attempts, config);
			log("crashed - restarting", { code, signal, attempt: attempts, delay_ms: delay });
			restartTimer = setTimeout(launch, delay);
		});
	};

	launch();
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	main();
}
