#!/usr/bin/env node

const args = process.argv.slice(2);
const BLESSED_FLAGS = ["--blessed", "--tui", "-b"];

if (args.some((a) => BLESSED_FLAGS.includes(a))) {
	const { LogDashboardApp } = await import("./app.js");
	const app = new LogDashboardApp({});
	app.start();
} else {
	const { startInk } = await import("./ink/index.js");
	await startInk();
}
