#!/usr/bin/env node
/**
 * NEON TEST LAB — Allure report finalizer.
 *
 * What it does: runs `allure generate` for the configured result dirs, then
 * completes the documented output layout if the CLI stops before its final
 * file moves (observed on Windows: EPERM renaming `awesome/*` up one level
 * even though nothing else holds the files — a manual rename seconds later
 * always succeeds).
 *
 * What it does NOT do: patch installed packages, fabricate results, or touch
 * anything outside the given output directory. Every byte still comes from
 * the Allure generator itself.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const RESULTS_JEST = path.join(ROOT, "reports", "allure-results-jest");
const RESULTS_E2E = path.join(ROOT, "reports", "allure-results-e2e");
const OUTPUT = path.join(ROOT, "reports", "allure-report");
const CONFIG = path.join(ROOT, "allurerc.mjs");

function existingResultDirs() {
	return [RESULTS_JEST, RESULTS_E2E].filter(
		(dir) => fs.existsSync(dir) && fs.readdirSync(dir).length > 0,
	);
}

function sleepSync(ms) {
	const end = Date.now() + ms;
	while (Date.now() < end) {
		// intentional busy-wait: keeps this small script dependency-free
	}
}

function renameWithRetry(from, to, budgetMs = 600_000) {
	const started = Date.now();
	let lastError = null;
	let logged = 0;
	for (;;) {
		try {
			fs.rmSync(to, { recursive: true, force: true });
			fs.renameSync(from, to);
			return;
		} catch (error) {
			lastError = error;
			if (Date.now() - started > budgetMs) {
				throw lastError;
			}
			if (Date.now() - logged > 15_000) {
				logged = Date.now();
				const reason = error instanceof Error ? error.code || error.message : String(error);
				console.warn(`neon-allure: waiting on locked path ${path.basename(from)} (${reason})…`);
			}
			sleepSync(2000);
		}
	}
}

function finalize(outputDir) {
	const staging = path.join(outputDir, "awesome");
	if (!fs.existsSync(staging)) {
		return true;
	}
	for (const entry of fs.readdirSync(staging)) {
		renameWithRetry(path.join(staging, entry), path.join(outputDir, entry));
	}
	fs.rmdirSync(staging);
	return !fs.existsSync(staging);
}

function smokeCheck(outputDir) {
	const index = path.join(outputDir, "index.html");
	const statistic = path.join(outputDir, "widgets", "statistic.json");
	const complete = fs.existsSync(index) && fs.existsSync(statistic);
	if (!complete) {
		return null;
	}
	try {
		return JSON.parse(fs.readFileSync(statistic, "utf8"));
	} catch {
		return null;
	}
}

const dirs = existingResultDirs();
if (dirs.length === 0) {
	console.error(
		"neon-allure: no Allure results found in reports/allure-results-jest or reports/allure-results-e2e.\n" +
			"Run the test suites first (npm run test:report) or point the runners at those dirs.",
	);
	process.exit(2);
}

const gen = spawnSync(
	"npx",
	["allure", "generate", ...dirs, "--output", OUTPUT, "--config", CONFIG],
	{ stdio: "inherit", shell: process.platform === "win32" },
);
if (gen.status !== 0) {
	console.warn("neon-allure: `allure generate` exited non-zero; attempting layout finalization.");
}

try {
	finalize(OUTPUT);
} catch (error) {
	console.error(`neon-allure: finalization failed: ${error?.message || error}`);
	process.exit(1);
}

const stats = smokeCheck(OUTPUT);
if (!stats) {
	console.error("neon-allure: report incomplete (missing index.html or widgets/statistic.json).");
	process.exit(1);
}
console.log(
	`neon-allure: report ready at reports/allure-report/index.html (total=${stats.total} passed=${stats.passed ?? 0} failed=${stats.failed ?? 0} broken=${stats.broken ?? 0} skipped=${stats.skipped ?? 0})`,
);
