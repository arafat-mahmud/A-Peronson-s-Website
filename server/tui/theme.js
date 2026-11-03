export const COLORS = {
	bg: "#090B13",
	panel: "#111827",
	card: "#171E2F",
	border: "#2A365C",
	accent: "#38BDF8",
	text: "#E2E8F0",
	textDim: "#64748B",
	selected: "#38BDF8",
	glow: "#0EA5E9",
	level: {
		info: "#38BDF8",
		debug: "#22D3EE",
		success: "#34D399",
		warn: "#FBBF24",
		error: "#FB7185",
		critical: "#C084FC",
	},
	category: {
		requests: "#38BDF8",
		assistant: "#A855F7",
		image_queue: "#F472B6",
		redis: "#EF4444",
		prisma: "#38BDF8",
		syslog: "#34D399",
		audit: "#FB923C",
		analytics: "#22D3EE",
		workers: "#A3E635",
		auth: "#FBBF24",
		frontend: "#818CF8",
	},
};

// Runtime theme selection + glow intensity control.
export const THEMES = {
	subzero: {
		bg: "#090B13",
		panel: "#111827",
		card: "#171E2F",
		border: "#2A365C",
		accent: "#38BDF8",
		selected: "#38BDF8",
		glow: "#0EA5E9",
		level: {
			info: "#38BDF8",
			debug: "#22D3EE",
			success: "#34D399",
			warn: "#FBBF24",
			error: "#FB7185",
			critical: "#C084FC",
		},
	},
	amber: {
		bg: "#0B0A13",
		panel: "#17151F",
		card: "#1E1B26",
		border: "#4B3A2A",
		accent: "#FBBF24",
		selected: "#FBBF24",
		glow: "#F59E0B",
		level: {
			info: "#FBBF24",
			debug: "#FDE68A",
			success: "#34D399",
			warn: "#F97316",
			error: "#F43F5E",
			critical: "#C084FC",
		},
	},
	magenta: {
		bg: "#0B0813",
		panel: "#15101F",
		card: "#1C152A",
		border: "#3A2A5C",
		accent: "#C084FC",
		selected: "#C084FC",
		glow: "#A855F7",
		level: {
			info: "#C084FC",
			debug: "#D8B4FE",
			success: "#34D399",
			warn: "#FBBF24",
			error: "#FB7185",
			critical: "#F0ABFC",
		},
	},
	emerald: {
		bg: "#071412",
		panel: "#0F201C",
		card: "#142A25",
		border: "#1F4A40",
		accent: "#34D399",
		selected: "#34D399",
		glow: "#10B981",
		level: {
			info: "#34D399",
			debug: "#6EE7B7",
			success: "#4ADE80",
			warn: "#FBBF24",
			error: "#FB7185",
			critical: "#C084FC",
		},
	},
};

const GLOW_MIN = 18;
const GLOW_MAX = 80;
let currentTheme = "subzero";
let glowLevel = 60;

export function setTheme(name) {
	const t = THEMES[name] || THEMES.subzero;
	currentTheme = name;
	if (t.level) {
		COLORS.level = { ...COLORS.level, ...t.level };
	}
	for (const k of ["bg", "panel", "card", "border", "accent", "selected", "glow"]) {
		COLORS[k] = t[k] ?? COLORS[k];
	}
}

export function setGlowIntensity(level) {
	glowLevel = Math.max(GLOW_MIN, Math.min(GLOW_MAX, Number(level) || GLOW_MIN));
}

export function getGlowIntensity() {
	return glowLevel;
}

export function themeNames() {
	return Object.keys(THEMES);
}

export function currentThemeName() {
	return currentTheme;
}

export const LEVEL_ICONS = {
	info: "ℹ",
	debug: "🐞",
	success: "✔",
	warn: "⚠",
	error: "✖",
	critical: "⛔",
};

export const CATEGORY_ICONS = {
	overview: "🏠",
	live: "📜",
	errors: "❌",
	warnings: "⚠",
	info: "ℹ",
	requests: "🌐",
	assistant: "🧠",
	image_queue: "🖼",
	redis: "🗄",
	prisma: "🧱",
	syslog: "📡",
	audit: "👤",
	analytics: "📈",
	workers: "⚙",
	auth: "🔐",
	frontend: "🌐",
	favorites: "⭐",
};

export function levelColor(level) {
	return COLORS.level[level] || COLORS.accent;
}

export function levelIcon(level) {
	return LEVEL_ICONS[level] || "ℹ";
}

export function categoryColor(category) {
	return COLORS.category[category] || COLORS.accent;
}

export function categoryIcon(category) {
	return CATEGORY_ICONS[category] || "•";
}

export function tag(color, text) {
	return `{${color}-fg}${text}{/}`;
}

export function tagBold(color, text) {
	return `{${color}-fg}{bold}${text}{/bold}{/}`;
}

export function glowBorder(color = COLORS.accent) {
	return {
		type: "line",
		fg: color,
		style: { border: { fg: color } },
	};
}

// "Electric blue glow" selected border
export function selectedBorder() {
	return {
		type: "line",
		fg: COLORS.selected,
		style: {
			border: { fg: COLORS.selected },
		},
	};
}

export function sparkline(data, { height = 3, width = 40 } = {}) {
	const chars = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"];
	if (!data || data.length === 0) {
		return new Array(height).fill(" ".repeat(width)).join("\n");
	}
	const max = Math.max(...data, 1);
	const step = Math.max(1, Math.ceil(data.length / width));
	const sampled = [];
	for (let i = 0; i < data.length; i += step) {
		sampled.push(data[i]);
	}
	const rows = [];
	for (let h = height - 1; h >= 0; h--) {
		let line = "";
		const threshold = ((h + 1) / height) * max;
		for (const v of sampled) {
			const idx = Math.min(chars.length - 1, Math.floor((v / max) * chars.length));
			line += v >= threshold ? chars[idx] : " ";
		}
		rows.push(line);
	}
	return rows.join("\n");
}

export function barline(values, width = 40) {
	if (!values || values.length === 0) {
		return " ".repeat(width);
	}
	const max = Math.max(...values, 1);
	const step = Math.max(1, Math.ceil(values.length / width));
	let line = "";
	for (let i = 0; i < values.length; i += step) {
		const frac = values[i] / max;
		if (frac >= 0.9) {
			line += "█";
		} else if (frac >= 0.6) {
			line += "▓";
		} else if (frac >= 0.3) {
			line += "▒";
		} else if (frac > 0) {
			line += "░";
		} else {
			line += " ";
		}
	}
	return line.padEnd(width, " ").slice(0, width);
}

export function heatmapRows(buckets, { max = 1 } = {}) {
	const labels = [
		"00",
		"01",
		"02",
		"03",
		"04",
		"05",
		"06",
		"07",
		"08",
		"09",
		"10",
		"11",
		"12",
		"13",
		"14",
		"15",
		"16",
		"17",
		"18",
		"19",
		"20",
		"21",
		"22",
		"23",
	];
	const lines = [];
	for (let h = 0; h < 24; h += 2) {
		const v1 = buckets[h] || 0;
		const v2 = buckets[h + 1] || 0;
		const frac1 = v1 / max;
		const frac2 = v2 / max;
		const c1 =
			frac1 >= 0.8 ? "█" : frac1 >= 0.5 ? "▓" : frac1 >= 0.25 ? "▒" : frac1 > 0 ? "░" : " ";
		const c2 =
			frac2 >= 0.8 ? "█" : frac2 >= 0.5 ? "▓" : frac2 >= 0.25 ? "▒" : frac2 > 0 ? "░" : " ";
		lines.push(`${labels[h]}: ${c1}${c2}  ${labels[h + 1]}: ${c1}${c2}`);
	}
	return lines.join("\n");
}

export function formatBytes(n) {
	if (n === null || n === undefined || Number.isNaN(Number(n))) {
		return "";
	}
	const v = Number(n);
	if (v < 1024) {
		return `${Math.round(v)}B`;
	}
	if (v < 1024 * 1024) {
		return `${(v / 1024).toFixed(1)}KB`;
	}
	return `${(v / 1024 / 1024).toFixed(1)}MB`;
}
