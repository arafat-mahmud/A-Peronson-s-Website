#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { transformSync } from "@babel/core/lib/index.js";

const CACHE_DIR = path.dirname(fileURLToPath(import.meta.url));
const CACHE_FILE = path.join(CACHE_DIR, "app.mjs");

async function loadAppModule() {
	const src = readFileSync(new URL("./app.jsx", import.meta.url), "utf8");
	const { code } = transformSync(src, {
		// JSX only. Without these the repository's babel.config.cjs (preset-env,
		// CommonJS output for Jest) applied too, and the ES module written below
		// failed with "exports is not defined" - the TUI could not start.
		configFile: false,
		babelrc: false,
		presets: [["@babel/preset-react", { runtime: "automatic" }]],
		filename: "app.jsx",
	});
	mkdirSync(CACHE_DIR, { recursive: true });
	writeFileSync(CACHE_FILE, code);
	return import(pathToFileURL(CACHE_FILE).href);
}

export async function startInk() {
	const [{ NeonObserveApp }, { render }, { createElement, Component }] = await Promise.all([
		loadAppModule(),
		import("ink"),
		import("react"),
	]);
	const port = process.env.PORT || "4000";
	const url = process.env.LOG_WS_URL || `ws://localhost:${port}/ws/logs`;
	const apiPort = url.match(/localhost:(\d+)/)?.[1] || port;
	const probe = (m) => process.stderr.write(`[probe] ${m}\n`);
	// biome-ignore lint/correctness/noComponentHookFactories: created once at TUI start-up, never re-rendered as a new type
	class ErrorBoundary extends Component {
		componentDidCatch(err) {
			probe(`RENDER ERROR: ${err?.stack || err}`);
		}
		render() {
			return this.props.children;
		}
	}
	render(
		createElement(ErrorBoundary, null, createElement(NeonObserveApp, { url, port: apiPort })),
		{ exitOnCtrlC: true },
	);
	process.once("beforeExit", () => probe("beforeExit"));
	process.once("exit", (code) => probe(`exit code=${code}`));
	process.on("unhandledRejection", (r) => probe(`unhandledRejection ${String(r)}`));
}
