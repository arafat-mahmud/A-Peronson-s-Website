import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const FILE = path.join(os.homedir(), ".tcs-hub", "ws.json");
const MAX_HISTORY = 5;

function read() {
	try {
		return JSON.parse(fs.readFileSync(FILE, "utf8"));
	} catch {
		return { states: {}, history: [] };
	}
}

function write(data) {
	try {
		fs.mkdirSync(path.dirname(FILE), { recursive: true });
		fs.writeFileSync(FILE, JSON.stringify(data, null, 2), "utf8");
	} catch {
		// ignore
	}
}

function sanitize(name) {
	const clean = String(name || "default")
		.replace(/[^\w-]/g, "")
		.toLowerCase();
	return clean || "default";
}

export function saveState(state = {}, name = "default") {
	const key = sanitize(name);
	const data = read();
	data.states[key] = {
		savedAt: Date.now(),
		sidebar: state.sidebar ?? null,
		inspector: state.inspector ?? null,
		server: state.server ?? null,
		category: state.category ?? "live",
	};
	data.history = [key, ...data.history.filter((h) => h !== key)].slice(0, MAX_HISTORY);
	write(data);
	return true;
}

export function loadState(name = "default") {
	const data = read();
	return data.states[sanitize(name)] || { server: null, category: "live" };
}

export function listStates() {
	const data = read();
	const names = data.history?.length ? data.history : Object.keys(data.states);
	return names.slice(0, MAX_HISTORY);
}
