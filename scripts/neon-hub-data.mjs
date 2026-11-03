#!/usr/bin/env node
/**
 * NEON TEST LAB — hub data builder.
 *
 * Reads only real, generated artifacts and summarizes them into
 * reports/neon-hub/data.json. Anything missing is reported as missing —
 * never synthesized. The static hub page (scripts/neon-hub-template.html,
 * copied to reports/neon-hub/index.html) renders this file.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const HUB_DIR = path.join(ROOT, "reports", "neon-hub");

function readJson(file) {
	try {
		return JSON.parse(fs.readFileSync(file, "utf8"));
	} catch {
		return null;
	}
}

function layerForTestFile(filePath = "") {
	const p = String(filePath).replace(/\\/g, "/");
	if (p.includes("tests/e2e/")) {
		return "End-to-end";
	}
	if (p.includes("tests/integration/")) {
		return "API integration";
	}
	if (p.includes("db-schema")) {
		return "Database";
	}
	if (p.includes("verification-upsert")) {
		return "Regression";
	}
	if (p.includes("server-") || p.includes("server/")) {
		return "Backend & services";
	}
	if (p.includes("frontend-") || p.includes("component-")) {
		return "Frontend & React";
	}
	return "Other";
}

function summarizeJest(doc) {
	if (!doc?.testResults) {
		return null;
	}
	const layers = {};
	let tests = 0;
	let passed = 0;
	let failed = 0;
	for (const file of doc.testResults) {
		const layer = layerForTestFile(file.name);
		layers[layer] = layers[layer] || { suites: 0, tests: 0, passed: 0, failed: 0 };
		layers[layer].suites += 1;
		for (const assertion of file.assertionResults || []) {
			tests += 1;
			layers[layer].tests += 1;
			if (assertion.status === "passed") {
				passed += 1;
				layers[layer].passed += 1;
			} else {
				failed += 1;
				layers[layer].failed += 1;
			}
		}
	}
	return {
		suites: doc.numTotalTestSuites ?? Object.keys(doc.testResults).length,
		tests,
		passed,
		failed,
		skipped: doc.numPendingTests ?? 0,
		timeMs: doc.testExecTime ?? null,
		success: Boolean(doc.success),
		layers,
	};
}

function summarizePlaywright(doc) {
	if (!doc?.stats) {
		return null;
	}
	const s = doc.stats;
	return {
		suites: (doc.suites || []).length,
		tests: (s.expected ?? 0) + (s.unexpected ?? 0) + (s.skipped ?? 0) + (s.flaky ?? 0),
		passed: s.expected ?? 0,
		failed: s.unexpected ?? 0,
		flaky: s.flaky ?? 0,
		skipped: s.skipped ?? 0,
		timeMs: s.duration ?? null,
		success: (s.unexpected ?? 0) === 0,
	};
}

const jestDoc = readJson(path.join(ROOT, "reports", "jest-results.json"));
const pwDoc = readJson(path.join(ROOT, "reports", "playwright-results.json"));
const coverageDoc = readJson(path.join(ROOT, "coverage", "coverage-summary.json"));
const allureSummary = readJson(path.join(ROOT, "reports", "allure-report", "summary.json"));

const data = {
	generatedAt: new Date().toISOString(),
	environment: {
		node: process.version,
		platform: `${process.platform} ${process.arch}`,
	},
	jest: jestDoc
		? { present: true, ...summarizeJest(jestDoc) }
		: { present: false, note: "reports/jest-results.json not found — run npm run test:report" },
	playwright: pwDoc
		? { present: true, ...summarizePlaywright(pwDoc) }
		: {
				present: false,
				note: "reports/playwright-results.json not found — run npm run test:report",
			},
	coverage: coverageDoc?.total
		? {
				present: true,
				lines: coverageDoc.total.lines?.pct ?? null,
				statements: coverageDoc.total.statements?.pct ?? null,
				functions: coverageDoc.total.functions?.pct ?? null,
				branches: coverageDoc.total.branches?.pct ?? null,
			}
		: {
				present: false,
				note: "coverage/coverage-summary.json not found — run npm run test:coverage",
			},
	allure: allureSummary?.stats
		? {
				present: true,
				name: allureSummary.name ?? null,
				...allureSummary.stats,
				status: allureSummary.status ?? null,
			}
		: {
				present: false,
				note: "reports/allure-report/summary.json not found — run npm run test:allure",
			},
};

fs.mkdirSync(HUB_DIR, { recursive: true });
fs.copyFileSync(
	path.join(ROOT, "scripts", "neon-hub-template.html"),
	path.join(HUB_DIR, "index.html"),
);
fs.writeFileSync(path.join(HUB_DIR, "data.json"), `${JSON.stringify(data, null, 2)}\n`);
console.log("neon-hub: wrote reports/neon-hub/index.html + data.json");
