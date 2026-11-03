#!/usr/bin/env node
/**
 * NEON TEST LAB — aggregate reporting workflow (`npm run test:report`).
 *
 * 1. Clears ONLY the dedicated generated-result dirs (never source, never /).
 * 2. Runs the full Jest suite (Allure results via allure-jest env + JSON + coverage).
 * 3. Runs the Playwright suite (HTML + JSON + Allure results, single execution).
 * 4. Generates + finalizes the aggregated Allure report.
 * 5. Builds the Neon hub data file.
 *
 * Exit status: 0 only if every executed test passed AND every artifact was
 * produced. A report is still generated from partial results on failure, but
 * the command reports failure — a red suite can never look green.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SHELL = process.platform === "win32";

function cleanDir(rel) {
	const dir = path.join(ROOT, rel);
	fs.rmSync(dir, { recursive: true, force: true });
	fs.mkdirSync(dir, { recursive: true });
}

function cleanFile(rel) {
	fs.rmSync(path.join(ROOT, rel), { force: true });
}

function run(label, command, args) {
	console.log(`\n===== neon-report: ${label} =====`);
	const res = spawnSync(command, args, { stdio: "inherit", shell: SHELL, cwd: ROOT });
	return res.status ?? 1;
}

function runNode(script, extraArgs = []) {
	return run(script, "node", [path.join(ROOT, "scripts", script), ...extraArgs]);
}

// 1. Result isolation: dedicated generated dirs/files only.
for (const dir of [
	"reports/allure-results-jest",
	"reports/allure-results-e2e",
	"reports/playwright-report",
	"reports/neon-hub",
]) {
	cleanDir(dir);
}
for (const file of ["reports/jest-results.json", "reports/playwright-results.json"]) {
	cleanFile(file);
}
// (coverage/ is intentionally NOT wiped: it is keyed by run and read by the hub.)

// 2. Jest: full suite, JSON summary + coverage summary for the hub.
// (Allure per-test results are emitted by the allure-jest environment.)
const jestCode = run("jest suite", "node", [
	"--experimental-vm-modules",
	"node_modules/jest/bin/jest.js",
	"--runInBand",
	"--json",
	"--outputFile=reports/jest-results.json",
	"--coverage",
	"--coverageReporters=json-summary",
	"--coverageReporters=lcov",
	"--coverageReporters=text",
	"--coverageDirectory=coverage",
]);

// 3. Playwright: single execution, three parallel reporter outputs.
const e2eCode = run("playwright suite", "npx", ["playwright", "test"]);

// 4 + 5. Report generation and hub data (always attempted so failures stay visible).
const allureCode = runNode("neon-allure.mjs");
const hubCode = runNode("neon-hub-data.mjs");

const failed = [jestCode, e2eCode, allureCode, hubCode].some((code) => code !== 0);
console.log(
	`\nneon-report: jest=${jestCode} e2e=${e2eCode} allure=${allureCode} hub=${hubCode} -> exit ${failed ? 1 : 0}`,
);
process.exit(failed ? 1 : 0);
