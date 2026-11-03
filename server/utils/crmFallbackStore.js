import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const LEGACY_DB_DIR = path.join(ROOT, "server", "database");

function normalizeFlag(raw, fallback = true) {
	if (raw === undefined || raw === null || raw === "") {
		return fallback;
	}
	const value = String(raw).toLowerCase().trim();
	return !["0", "false", "no", "off"].includes(value);
}

// Temporary rollout flag.
// Prefer USE_SQL_CRM, but preserve backward compatibility with CRM_SQL_ENABLED.
export function isCrmSqlEnabled() {
	// During tests prefer the legacy JSON path to avoid requiring a database.
	if (process.env.NODE_ENV === "test") {
		return false;
	}
	if (process.env.USE_SQL_CRM !== undefined) {
		return normalizeFlag(process.env.USE_SQL_CRM, true);
	}
	return normalizeFlag(process.env.CRM_SQL_ENABLED, true);
}

export async function readLegacyJson(fileName) {
	const filePath = path.join(LEGACY_DB_DIR, fileName);
	const raw = await fs.readFile(filePath, "utf8").catch(() => null);
	if (!raw) {
		return [];
	}
	try {
		const parsed = JSON.parse(raw);
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}
