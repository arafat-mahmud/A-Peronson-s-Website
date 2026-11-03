import chalk from "chalk";
import gradient from "gradient-string";
import { redact } from "../utils/crashReporter.js";
import { LEVELS } from "./levels.js";

const neonBlue = gradient(["#0EA5E9", "#38BDF8", "#818CF8"]);
const neonGreen = gradient(["#10B981", "#34D399", "#A7F3D0"]);
const neonRed = gradient(["#F43F5E", "#FB7185", "#FCA5A5"]);
const neonAmber = gradient(["#F59E0B", "#FBBF24", "#FDE68A"]);
const neonPurple = gradient(["#A855F7", "#C084FC", "#E9D5FF"]);
const neonCyan = gradient(["#06B6D4", "#22D3EE", "#67E8F9"]);

export function levelColorFor(level) {
	return LEVELS[level]?.color ?? "#38BDF8";
}

export function levelIconFor(level) {
	return LEVELS[level]?.icon ?? "ℹ";
}

const LEVEL_GRADIENT = {
	debug: neonCyan,
	info: neonBlue,
	success: neonGreen,
	warn: neonAmber,
	error: neonRed,
	critical: neonPurple,
};

export function gradientForLevel(level) {
	return LEVEL_GRADIENT[level] || neonBlue;
}

export function formatTime(iso) {
	return String(iso || "").slice(11, 23);
}

export function formatDuration(ms) {
	if (ms === null || ms === undefined || Number.isNaN(Number(ms))) {
		return "";
	}
	const n = Number(ms);
	if (n < 1000) {
		return `${Math.round(n)}ms`;
	}
	return `${(n / 1000).toFixed(1)}s`;
}

function truncate(s, max) {
	const str = String(s || "");
	if (str.length <= max) {
		return str;
	}
	return `${str.slice(0, max - 1)}…`;
}

export function formatConsoleEntry(entry, { width = 120, detailed = false } = {}) {
	if (!entry) {
		return "";
	}
	const level = entry.level;
	const lvl = LEVELS[level] || LEVELS.info;
	const time = chalk.gray(formatTime(entry.ts));
	const icon = chalk.hex(lvl.color)(lvl.icon);
	const label = chalk.hex(lvl.color).bold(lvl.label.padEnd(6));

	const head = `${icon} ${label} ${time}`;

	const path = entry.meta?.path || entry.data?.path || "";
	const user = entry.meta?.user_id || entry.data?.user_id || "";
	const dur = formatDuration(entry.meta?.duration_ms ?? entry.data?.duration_ms);

	const lineParts = [head];

	if (detailed) {
		lineParts.push("\n");
		lineParts.push(chalk.hex(lvl.color)(truncate(entry.message, width - 14)));
		if (path) {
			lineParts.push(chalk.blue(`\n    ${path}`));
		}
		if (user) {
			lineParts.push(chalk.gray(`  user:${user}`));
		}
		if (dur) {
			lineParts.push(chalk.cyan(`  ${dur}`));
		}
		if (entry.request_id) {
			lineParts.push(chalk.gray(`  ${entry.request_id.slice(0, 8)}`));
		}
		if (entry.data && typeof entry.data === "object") {
			const dataStr = truncate(JSON.stringify(entry.data), width - 16);
			lineParts.push(chalk.gray(`\n    ${dataStr}`));
		}
	} else {
		lineParts.push(` ${gradientForLevel(level)(truncate(entry.message, width - 22))}`);
		const extras = [];
		if (path) {
			extras.push(chalk.blue(truncate(path, 30)));
		}
		if (user) {
			extras.push(chalk.gray(`u:${user}`));
		}
		if (dur) {
			extras.push(chalk.cyan(dur));
		}
		if (entry.request_id) {
			extras.push(chalk.gray(entry.request_id.slice(0, 8)));
		}
		if (entry.groupCount > 1) {
			extras.push(chalk.magenta(`×${entry.groupCount}`));
		}
		if (extras.length) {
			lineParts.push(` ${extras.join(" ")}`);
		}
		// Warnings and errors keep their details on the console line: on Render
		// stdout is the only log there is, and "Unhandled API error" with no
		// code or cause cannot be diagnosed.
		if (
			(level === "warn" || level === "error" || level === "critical") &&
			entry.data &&
			typeof entry.data === "object"
		) {
			let details = "";
			try {
				details = redact(JSON.stringify(entry.data));
			} catch {
				details = "";
			}
			if (details && details !== "{}") {
				lineParts.push(chalk.gray(` ${truncate(details, 600)}`));
			}
		}
	}

	const line = lineParts.join("");

	if (level === "error" || level === "critical") {
		const border = chalk.hex(lvl.color).dim("·".repeat(Math.max(8, Math.min(width, 40))));
		const stackLine = entry.stack
			? `\n${chalk.hex(lvl.color).dim(truncate(entry.stack.split("\n").slice(0, 3).join(" → "), width))}`
			: "";
		return `${border}\n${line}${stackLine}`;
	}
	return line;
}

export function formatStatsLine(stats) {
	if (!stats) {
		return "";
	}
	const rate = chalk.cyan(`${stats.rate} logs/s`);
	const total = chalk.blue(`${stats.total.toLocaleString()} logs`);
	const errs = chalk.red(`${stats.byLevel.error || 0} err`);
	const warns = chalk.yellow(`${stats.byLevel.warn || 0} warn`);
	const criticals = chalk.magenta(`${stats.byLevel.critical || 0} crit`);
	return ` ${chalk.gray("│")} ${rate} ${chalk.gray("│")} ${total} ${chalk.gray("│")} ${errs} ${chalk.gray("│")} ${warns} ${chalk.gray("│")} ${criticals}`;
}

export function box(lines, { border = chalk.hex("#38BDF8"), padding = 1 } = {}) {
	const maxLen = Math.max(...lines.map((l) => chalk.stripColor(l).length));
	const top = `╭${border("─".repeat(maxLen + padding * 2))}╮`;
	const bottom = `╰${border("─".repeat(maxLen + padding * 2))}╯`;
	const body = lines.map(
		(l) => `${border("│")}${" ".repeat(padding)}${l}${" ".repeat(padding)}${border("│")}`,
	);
	return [top, ...body, bottom].join("\n");
}

export function gradientHeader(text) {
	const grad = gradient(["#38BDF8", "#818CF8", "#C084FC"]);
	return grad(text);
}
