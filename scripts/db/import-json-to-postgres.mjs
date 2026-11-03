/**
 * JSON → PostgreSQL importer scaffold (project.md)
 *
 * This script is intentionally a placeholder so we can implement a safe, module-by-module migration.
 * MVP workflow:
 *  1) Create Prisma schema + migrations
 *  2) Implement import for a small module first (users + requirements)
 *  3) Add feature flags to switch reads → writes gradually
 *
 * Usage (after configuring DATABASE_URL):
 *   node scripts/db/import-json-to-postgres.mjs
 */

import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const DB_DIR = path.join(ROOT, "server", "database");

async function readJsonFile(file) {
	const full = path.join(DB_DIR, file);
	const raw = await fs.readFile(full, "utf-8").catch(() => "[]");
	return JSON.parse(raw || "[]");
}

async function main() {
	const users = await readJsonFile("users.json");
	const requirements = await readJsonFile("requirements.json");
}

main().catch((_err) => {
	process.exitCode = 1;
});
