#!/usr/bin/env node
// Lab Web Vitals for one or more running builds, under the same conditions:
// Pixel 7 emulation, 4x CPU slowdown, 1.6 Mbps down / 750 Kbps up, 150 ms RTT,
// cold cache, service worker blocked; median of RUNS. Lab numbers, not field data.
// Usage: node scripts/perf/lab-benchmark.mjs name=http://localhost:4173 [name2=url2 ...]
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium, devices } = require("@playwright/test");
const targets = Object.fromEntries(process.argv.slice(2).map((arg) => arg.split("=")));
const pages = (process.env.PAGES || "/,/signup,/about").split(",");
const RUNS = Number(process.env.RUNS || 3);
const median = (values) => values.slice().sort((a, b) => a - b)[Math.floor(values.length / 2)];

const browser = await chromium.launch({ channel: process.env.E2E_BROWSER_CHANNEL || "chrome" });
async function measure(url) {
	const ctx = await browser.newContext({ ...devices["Pixel 7"], serviceWorkers: "block" });
	const page = await ctx.newPage();
	const cdp = await ctx.newCDPSession(page);
	await cdp.send("Network.enable");
	await cdp.send("Network.emulateNetworkConditions", {
		offline: false,
		latency: 150,
		downloadThroughput: (1.6 * 1024 * 1024) / 8,
		uploadThroughput: (750 * 1024) / 8,
	});
	await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
	await page.addInitScript(() => {
		window.__m = { lcp: 0, cls: 0, tbt: 0 };
		new PerformanceObserver((l) => {
			for (const e of l.getEntries()) window.__m.lcp = e.startTime;
		}).observe({ type: "largest-contentful-paint", buffered: true });
		new PerformanceObserver((l) => {
			for (const e of l.getEntries()) if (!e.hadRecentInput) window.__m.cls += e.value;
		}).observe({ type: "layout-shift", buffered: true });
		new PerformanceObserver((l) => {
			for (const e of l.getEntries()) window.__m.tbt += Math.max(0, e.duration - 50);
		}).observe({ type: "longtask", buffered: true });
	});
	await page.goto(url, { waitUntil: "load", timeout: 120_000 });
	await page.waitForTimeout(3000);
	const result = await page.evaluate(() => {
		const resources = performance.getEntriesByType("resource");
		const sum = (list) => list.reduce((a, e) => a + e.transferSize, 0);
		return {
			fcp: performance.getEntriesByName("first-contentful-paint")[0]?.startTime || 0,
			lcp: window.__m.lcp,
			cls: window.__m.cls,
			tbt: window.__m.tbt,
			js: sum(resources.filter((e) => e.name.endsWith(".js"))) / 1024,
			css: sum(resources.filter((e) => e.name.endsWith(".css"))) / 1024,
			total:
				(sum(resources) + (performance.getEntriesByType("navigation")[0]?.transferSize || 0)) /
				1024,
		};
	});
	await ctx.close();
	return result;
}

const rows = {};
for (const path of pages) {
	for (const [name, base] of Object.entries(targets)) {
		const runs = [];
		for (let i = 0; i < RUNS; i += 1) runs.push(await measure(base + path));
		const m = (key) => median(runs.map((r) => r[key]));
		rows[`${path} ${name}`] = {
			FCP_ms: Math.round(m("fcp")),
			LCP_ms: Math.round(m("lcp")),
			CLS: Number(m("cls").toFixed(3)),
			TBT_ms: Math.round(m("tbt")),
			JS_KB: Math.round(m("js")),
			CSS_KB: Math.round(m("css")),
			total_KB: Math.round(m("total")),
		};
	}
}
console.table(rows);
await browser.close();
