import fs from "node:fs";
import path from "node:path";

function stripQuotes(value = "") {
	const trimmed = String(value).trim();
	if (
		(trimmed.startsWith('"') && trimmed.endsWith('"')) ||
		(trimmed.startsWith("'") && trimmed.endsWith("'"))
	) {
		return trimmed.slice(1, -1);
	}
	return trimmed;
}

export function loadDotEnv() {
	const envPath = path.join(process.cwd(), ".env");
	if (!fs.existsSync(envPath)) {
		return;
	}

	const content = fs.readFileSync(envPath, "utf8");
	const lines = content.split(/\r?\n/);

	lines.forEach((line) => {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) {
			return;
		}
		const match = trimmed.match(/^([A-Za-z0-9_.-]+)\s*=\s*(.*)$/);
		if (!match) {
			return;
		}
		const key = match[1];
		const rawValue = stripQuotes(match[2] || "");
		if (process.env[key] === undefined) {
			process.env[key] = rawValue;
		}
	});
}

loadDotEnv();
