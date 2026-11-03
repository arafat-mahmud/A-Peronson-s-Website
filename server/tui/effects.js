import gradient from "gradient-string";
import { COLORS } from "./theme.js";

// ── Neon effect helpers ─────────────────────────────────────────────────────
// Terminal-rendered gradients, glow/pulse animation, and rounded box drawing.

export const ROUNDED = {
	type: "line",
	chars: {
		topLeft: "╭",
		topRight: "╮",
		bottomLeft: "╰",
		bottomRight: "╯",
		vertical: "│",
		horizontal: "─",
		leftT: "├",
		rightT: "┤",
		cross: "┼",
	},
};

export function roundedBorder(color = COLORS.accent) {
	return {
		...ROUNDED,
		fg: color,
		style: { border: { fg: color } },
	};
}

export function gradientForLevel(level) {
	const map = {
		info: ["#0EA5E9", "#38BDF8"],
		debug: ["#22D3EE", "#67E8F9"],
		success: ["#10B981", "#34D399"],
		warn: ["#F59E0B", "#FBBF24"],
		error: ["#F43F5E", "#FB7185"],
		critical: ["#A855F7", "#C084FC"],
	};
	const pair = map[level] || ["#38BDF8", "#22D3EE"];
	return gradient(pair[0], pair[1]);
}

export function headerGradient(text) {
	return gradient(["#22D3EE", "#38BDF8", "#818CF8"])(text);
}

export function badgeGradient(text) {
	return gradient(["#34D399", "#22D3EE"])(text);
}

// Shift a hex color's RGB by `amt` (positive brighten, negative darken).
export function shiftColor(base, amt) {
	let hex = String(base || "#38BDF8").replace("#", "");
	if (hex.length === 3) {
		hex = hex.replace(/./g, (c) => c + c);
	}
	let out = "#";
	for (let i = 0; i < 6; i += 2) {
		const c = Number.parseInt(hex.slice(i, i + 2), 16);
		const v = Math.max(0, Math.min(255, c + amt));
		out += v.toString(16).padStart(2, "0");
	}
	return out;
}

// Sine-cycle a base color by an amount.
export function pulseColor(base, phase, amt = 24) {
	let hex = base.replace("#", "");
	if (hex.length === 3) {
		hex = hex.replace(/./g, (c) => c + c);
	}
	let out = "#";
	for (let i = 0; i < 6; i += 2) {
		const c = Number.parseInt(hex.slice(i, i + 2), 16);
		const v = Math.max(0, Math.min(255, c + Math.round(Math.sin(phase) * amt)));
		out += v.toString(16).padStart(2, "0");
	}
	return out;
}

// Full cycle of glow frames for an animated neon border.
export function glowFrames(base = COLORS.selected, frames = 16, amt = 40) {
	return Array.from({ length: frames }, (_, i) =>
		pulseColor(base, (i / frames) * Math.PI * 2, amt),
	);
}

// Small block-pixel bar (sparkline-ish) for status/metrics.
export function blockBar(values, { width = 36 } = {}) {
	if (!values || values.length === 0) {
		return " ".repeat(width);
	}
	const max = Math.max(...values, 1);
	const step = Math.max(1, Math.ceil(values.length / width));
	const bars = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"];
	const line = [];
	for (let i = 0; i < values.length; i += step) {
		const frac = values[i] / max;
		line.push(bars[Math.min(bars.length - 1, Math.floor(frac * bars.length))]);
	}
	return line.join("").padEnd(width, " ").slice(0, width);
}
