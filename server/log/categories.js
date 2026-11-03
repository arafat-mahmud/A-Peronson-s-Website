import { LEVELS } from "./levels.js";

export const CATEGORIES = [
	{ key: "overview", icon: "🏠", label: "Overview" },
	{ key: "live", icon: "📜", label: "Live" },
	{ key: "errors", icon: "❌", label: "Errors" },
	{ key: "warnings", icon: "⚠", label: "Warnings" },
	{ key: "info", icon: "ℹ", label: "Info" },
	{ key: "requests", icon: "🌐", label: "Requests" },
	{ key: "assistant", icon: "🧠", label: "Assistant" },
	{ key: "image_queue", icon: "🖼", label: "Image Queue" },
	{ key: "redis", icon: "🗄", label: "Redis" },
	{ key: "prisma", icon: "🧱", label: "Prisma" },
	{ key: "syslog", icon: "📡", label: "Syslog" },
	{ key: "audit", icon: "👤", label: "Audit" },
	{ key: "analytics", icon: "📈", label: "Analytics" },
	{ key: "workers", icon: "⚙", label: "Workers" },
	{ key: "auth", icon: "🔐", label: "Auth" },
	{ key: "frontend", icon: "🌐", label: "Frontend" },
	{ key: "favorites", icon: "⭐", label: "Favorites" },
];

export const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map((c) => [c.key, c]));

const PREFIX_RULES = [
	{
		re: /^(request start|request end|request timeout|request aborted|request event|request_event|request_aborted)/i,
		key: "requests",
	},
	{ re: /^assistant|openai|opencode|chatgpt|gpt/i, key: "assistant" },
	{ re: /^image queue|image_queued|img_queue|thumbnail/i, key: "image_queue" },
	{ re: /^redis|redis_/i, key: "redis" },
	{ re: /prisma/i, key: "prisma" },
	{ re: /^syslog/i, key: "syslog" },
	{ re: /^audit|security|permission|forbidden/i, key: "audit" },
	{ re: /^event |^\[event\]|page_view|page_duration|session_start|session_end/i, key: "analytics" },
	{ re: /^worker|job |cron|sweep/i, key: "workers" },
	{ re: /jwt|login|logout|signup|token|session|passkey/i, key: "auth" },
	{ re: /^frontend:/i, key: "frontend" },
];

export function detectCategory(message = "", data = null) {
	const m = String(message || "");
	const lower = m.toLowerCase();

	if (data && typeof data === "object" && data.__category) {
		const c = String(data.__category).toLowerCase();
		if (CATEGORY_MAP[c]) {
			return c;
		}
	}

	if (lower.includes("prisma") || lower.includes("database error")) {
		return "prisma";
	}
	if (lower.includes("redis")) {
		return "redis";
	}
	if (lower.includes("worker")) {
		return "workers";
	}

	for (const rule of PREFIX_RULES) {
		if (rule.re.test(m)) {
			return rule.key;
		}
	}

	return "live";
}

export const CATEGORY_LEVELS = {
	errors: ["error", "critical"],
	warnings: ["warn"],
	info: ["info", "debug", "success"],
	requests: ["info", "success", "warn", "error"],
	assistant: ["info", "debug", "warn", "error"],
	image_queue: ["info", "warn", "error"],
	redis: ["info", "warn", "error", "critical"],
	prisma: ["info", "warn", "error", "critical"],
	syslog: ["info", "warn", "error"],
	audit: ["info", "warn", "error"],
	analytics: ["info", "debug"],
	workers: ["info", "warn", "error"],
	auth: ["info", "warn", "error", "critical"],
	frontend: ["info", "debug", "warn", "error", "critical"],
	live: Object.keys(LEVELS),
	overview: Object.keys(LEVELS),
	favorites: Object.keys(LEVELS),
};
