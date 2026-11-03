import blessed from "blessed";
import { COLORS, tag } from "./theme.js";

const LEVEL_CHIPS = [
	{ key: "info", label: "INFO", color: "#38BDF8" },
	{ key: "debug", label: "DEBUG", color: "#22D3EE" },
	{ key: "success", label: "SUCCESS", color: "#34D399" },
	{ key: "warn", label: "WARN", color: "#FBBF24" },
	{ key: "error", label: "ERROR", color: "#FB7185" },
	{ key: "critical", label: "CRITICAL", color: "#C084FC" },
];

const CATEGORY_CHIPS = [
	{ key: "requests", label: "REQ", color: "#38BDF8" },
	{ key: "syslog", label: "SYSLOG", color: "#34D399" },
	{ key: "redis", label: "REDIS", color: "#EF4444" },
	{ key: "workers", label: "WORKER", color: "#A3E635" },
	{ key: "auth", label: "AUTH", color: "#FBBF24" },
	{ key: "assistant", label: "ASSISTANT", color: "#A855F7" },
	{ key: "image_queue", label: "IMAGE", color: "#F472B6" },
	{ key: "prisma", label: "PRISMA", color: "#38BDF8" },
];

// strip blessed tags to compute visual width
function stripTag(s) {
	return String(s || "").replace(/\{\/?[a-z0-9#-]+\}/g, "");
}

const ACTIONS = [
	{ key: "filter", label: "Filter", icon: "☷", color: "#38BDF8" },
	{ key: "export", label: "Export", icon: "⇩", color: "#34D399" },
	{ key: "regex", label: "Regex", icon: "🧪", color: "#22D3EE" },
	{ key: "time", label: "Time", icon: "🕘", color: "#FBBF24" },
	{ key: "pause", label: "Pause", icon: "⏸", color: "#F43F5E" },
	{ key: "follow", label: "Follow", icon: "🎯", color: "#38BDF8" },
	{ key: "bookmarks", label: "Bkmk", icon: "★", color: "#FBBF24" },
];

export class FilterBar extends blessed.box {
	constructor(options) {
		super({
			...options,
			height: 1,
			tags: true,
			mouse: true,
			style: { bg: COLORS.panel },
		});
		this.levelFilters = new Set();
		this.categoryFilters = new Set();
		this.paused = false;
		this.searchText = "";
		this.onToggleLevel = null;
		this.onToggleCategory = null;
		this.onSearch = null;
		this.onFocusSearch = null;
		this.onAction = null;
		this._actionHit = [];

		this.on("click", (data) => {
			const x = Math.floor(data.x - this.left - 1);
			const y = Math.floor(data.y - this.top - 1);
			if (y !== 0) {
				return;
			}
			this._handleClickAt(x);
		});
	}

	// Track a monotonically advancing x as we "render" to compute hit zones.
	_handleClickAt(x) {
		let cursor = 0;

		const zone = (len, kind, key) => {
			const start = cursor;
			cursor += len + 1;
			if (x >= start && x < start + len) {
				return { kind, key };
			}
			return null;
		};

		// search
		const searchLabel = this.searchText ? this.searchText : "⌕ / search…";
		const searchW = stripTag(searchLabel).length + 2;
		if (x < searchW) {
			this.onFocusSearch?.();
			return;
		}
		cursor = searchW;

		for (const c of LEVEL_CHIPS) {
			const hit = zone(`[${c.label}]`.length, "level", c.key);
			if (hit) {
				this.onToggleLevel?.(c.key);
				return;
			}
		}
		for (const c of CATEGORY_CHIPS) {
			const hit = zone(`[${c.label}]`.length, "category", c.key);
			if (hit) {
				this.onToggleCategory?.(c.key);
				return;
			}
		}
		for (const a of ACTIONS) {
			const hit = zone(` ${a.icon}${a.label} `.length, "action", a.key);
			if (hit) {
				this.onAction?.(a.key);
				return;
			}
		}
		// fallback: match against positions captured during the last draw()
		for (const h of this._actionHit || []) {
			if (x >= h.col && x < h.col + h.width) {
				this.onAction?.(h.key);
				return;
			}
		}
	}

	toggleLevel(level) {
		if (this.levelFilters.has(level)) {
			this.levelFilters.delete(level);
		} else {
			this.levelFilters.add(level);
		}
		this.draw();
	}

	toggleCategory(cat) {
		if (this.categoryFilters.has(cat)) {
			this.categoryFilters.delete(cat);
		} else {
			this.categoryFilters.add(cat);
		}
		this.draw();
	}

	setPaused(paused) {
		this.paused = paused;
		this.draw();
	}

	setSearch(text) {
		this.searchText = text;
		this.draw();
	}

	_levelChip(c, active) {
		if (active) {
			return ` {${c.color}-bg}{black-fg}[${c.label}]{/black-fg}{/}`;
		}
		return tag("#475569", ` [${c.label}]`);
	}

	_catChip(c, active) {
		if (active) {
			return ` {${c.color}-bg}{black-fg}{bold}[${c.label}]{/bold}{/black-fg}{/}`;
		}
		return tag("#475569", ` [${c.label}]`);
	}

	draw() {
		const parts = [];
		parts.push(tag("#64748B", "│ "));
		parts.push(tag("#38BDF8", this.searchText ? this.searchText : "⌕ / search…"));
		parts.push(tag("#64748B", " │ "));
		for (const c of LEVEL_CHIPS) {
			parts.push(this._levelChip(c, this.levelFilters.has(c.key)));
		}
		parts.push(tag("#64748B", "│ "));
		for (const c of CATEGORY_CHIPS) {
			parts.push(this._catChip(c, this.categoryFilters.has(c.key)));
		}
		parts.push(tag("#64748B", "│ "));
		parts.push(this.paused ? tag("#F43F5E", "● PAUSED") : tag("#34D399", "● LIVE"));
		this._actionHit = [];
		parts.push(tag("#64748B", " │ "));
		for (const a of ACTIONS) {
			const btn = ` {${a.color}-fg}${a.icon}${a.label}{/}`;
			this._actionHit.push({ key: a.key, col: parts.join("").length, width: btn.length });
			parts.push(btn);
		}
		this.setContent(parts.join(""));
		this.screen?.render();
	}
}
