import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SESSIONS_DIR = path.join(__dirname, "../../sessions");

const OPENCODE_CONFIG_FILE = "opencode_config.json";
const SESSION_META_FILE = "session_meta.json";

async function ensureSessionsDir() {
	try {
		await fs.access(SESSIONS_DIR);
	} catch {
		await fs.mkdir(SESSIONS_DIR, { recursive: true });
	}
}

export async function saveOpencodeConfig(config) {
	await ensureSessionsDir();
	const configPath = path.join(SESSIONS_DIR, OPENCODE_CONFIG_FILE);
	await fs.writeFile(configPath, JSON.stringify(config, null, 2));
	return config;
}

export async function loadOpencodeConfig() {
	try {
		const configPath = path.join(SESSIONS_DIR, OPENCODE_CONFIG_FILE);
		const data = await fs.readFile(configPath, "utf8");
		return JSON.parse(data);
	} catch {
		return null;
	}
}

export async function saveSessionMeta(userId, sessionData) {
	await ensureSessionsDir();
	const metaPath = path.join(SESSIONS_DIR, SESSION_META_FILE);
	let meta = {};
	try {
		const existing = await fs.readFile(metaPath, "utf8");
		meta = JSON.parse(existing);
	} catch {
		void 0;
	}
	meta[userId] = {
		...sessionData,
		lastActive: new Date().toISOString(),
	};
	await fs.writeFile(metaPath, JSON.stringify(meta, null, 2));
	return meta;
}

export async function loadSessionMeta(userId) {
	try {
		const metaPath = path.join(SESSIONS_DIR, SESSION_META_FILE);
		const data = await fs.readFile(metaPath, "utf8");
		const meta = JSON.parse(data);
		return meta[userId] || null;
	} catch {
		return null;
	}
}

export async function deleteSessionMeta(userId) {
	try {
		const metaPath = path.join(SESSIONS_DIR, SESSION_META_FILE);
		const data = await fs.readFile(metaPath, "utf8");
		const meta = JSON.parse(data);
		delete meta[userId];
		await fs.writeFile(metaPath, JSON.stringify(meta, null, 2));
		return true;
	} catch {
		return false;
	}
}

export async function listAllSessions() {
	try {
		const metaPath = path.join(SESSIONS_DIR, SESSION_META_FILE);
		const data = await fs.readFile(metaPath, "utf8");
		return JSON.parse(data);
	} catch {
		return {};
	}
}
