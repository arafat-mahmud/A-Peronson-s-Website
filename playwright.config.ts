import { defineConfig } from "@playwright/test";

const enableWebServer = String(process.env.E2E_WEB_SERVER || "").toLowerCase() === "true";

export default defineConfig({
	testDir: "tests/e2e",
	timeout: 30_000,
	// Keep the native HTML report while also emitting Allure results and a
	// machine-readable JSON summary (used by the Neon hub). No test runs twice:
	// reporters are parallel outputs of a single execution.
	reporter: [
		["list"],
		["html", { outputFolder: "reports/playwright-report", open: "never" }],
		["json", { outputFile: "reports/playwright-results.json" }],
		[
			"allure-playwright",
			{
				resultsDir: "reports/allure-results-e2e",
				detail: true,
				suiteTitle: true,
			},
		],
	],
	use: {
		baseURL: process.env.E2E_BASE_URL || "http://localhost:4000",
	},
	...(enableWebServer
		? {
				webServer: {
					command: "node server/server.js",
					url: process.env.E2E_BASE_URL || "http://localhost:4000",
					reuseExistingServer: true,
					timeout: 120_000,
					env: {
						...process.env,
						NODE_ENV: process.env.NODE_ENV || "test",
						ALLOW_DB_OFFLINE: process.env.ALLOW_DB_OFFLINE || "true",
					},
				},
			}
		: {}),
});
