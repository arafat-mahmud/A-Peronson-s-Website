export const LEVELS = {
	debug: { key: "debug", label: "DEBUG", icon: "🐞", color: "#22D3EE", index: 0 },
	info: { key: "info", label: "INFO", icon: "ℹ", color: "#38BDF8", index: 1 },
	success: { key: "success", label: "OK", icon: "✔", color: "#34D399", index: 2 },
	warn: { key: "warn", label: "WARN", icon: "⚠", color: "#FBBF24", index: 3 },
	error: { key: "error", label: "ERROR", icon: "✖", color: "#FB7185", index: 4 },
	critical: { key: "critical", label: "CRIT", icon: "⛔", color: "#C084FC", index: 5 },
};

export const LEVEL_ORDER = ["debug", "info", "success", "warn", "error", "critical"];

export function isLevel(key) {
	return key in LEVELS;
}

export function normalizeLevel(value, fallback = "info") {
	const v = String(value || "").toLowerCase();
	if (v === "log") {
		return "info";
	}
	if (isLevel(v)) {
		return v;
	}
	if (v === "ok" || v === "done") {
		return "success";
	}
	if (v === "warning") {
		return "warn";
	}
	if (v === "err" || v === "fatal") {
		return "critical";
	}
	return fallback;
}

export function levelSeverity(level) {
	return LEVELS[normalizeLevel(level)]?.index ?? 1;
}

export function isAtLeast(level, threshold) {
	return levelSeverity(level) >= levelSeverity(threshold);
}

export function levelColorFor(level) {
	return LEVELS[normalizeLevel(level)]?.color ?? "#38BDF8";
}

export function levelIconFor(level) {
	return LEVELS[normalizeLevel(level)]?.icon ?? "ℹ";
}
