import blessed from "blessed";
import { highlightTerms } from "../log/search.js";
import { pulseColor, roundedBorder } from "./effects.js";
import { store } from "./state.js";
import { COLORS, getGlowIntensity, levelColor, levelIcon, tag, tagBold } from "./theme.js";

const PULSE_MS = 800;
const LINES_PER_ROW = 2;

function formatTime(iso) {
	return String(iso || "").slice(11, 23);
}

function duration(ms) {
	if (ms === null || ms === undefined || Number.isNaN(Number(ms))) {
		return "";
	}
	const n = Number(ms);
	return n < 1000 ? `${Math.round(n)}ms` : `${(n / 1000).toFixed(1)}s`;
}

function truncate(s, max) {
	const str = String(s || "");
	return str.length <= max ? str : `${str.slice(0, max - 1)}…`;
}

function stripTags(s) {
	return String(s || "").replace(/\{[^}]*\}/g, "");
}

function padVisual(tagged, width) {
	const len = stripTags(tagged).length;
	const pad = Math.max(0, width - len);
	return tagged + " ".repeat(pad);
}

function sourceOf(entry) {
	return entry.meta?.source || entry.data?.source || entry.source || "";
}

function tagsOf(entry) {
	const tags = [];
	const cat = String(entry.category || "live")
		.toUpperCase()
		.slice(0, 9);
	if (cat) {
		tags.push(cat);
	}
	if (entry.meta?.request_id || entry.data?.request_id) {
		tags.push("REQ");
	}
	if (entry.meta?.user_id || entry.data?.user_id) {
		tags.push(`u:${entry.meta?.user_id || entry.data?.user_id}`);
	}
	return tags;
}

function renderRow(entry, { width, selected, hover, searchHighlight } = {}) {
	const color = levelColor(entry.level);
	const icon = levelIcon(entry.level);
	const time = formatTime(entry.ts);

	const dur = duration(entry.meta?.duration_ms ?? entry.data?.duration_ms);

	// ── line 1: time · LEVEL ······ tags (right) ─────────────────────────────
	const tags = tagsOf(entry);
	if (dur) {
		tags.push(`{cyan-fg}${dur}{/}`);
	}
	if (entry.groupCount && entry.groupCount > 1) {
		const gkey = `${entry.level}|${entry.category}|${entry.message}`;
		const collapsed = store.isCollapsed(gkey);
		tags.push(
			collapsed ? `{cyan-fg}▶ ×${entry.groupCount}{/}` : `{cyan-fg}▼ ×${entry.groupCount}{/}`,
		);
	}
	if (entry.bookmarked) {
		tags.push("{yellow-fg}★{/}");
	}
	if (entry.pinned) {
		tags.push("{blue-fg}📌{/}");
	}
	const right1 = tags.map((t) => tag("#94A3B8", `[${stripTags(t)}]`)).join(" ");
	const left1 = `{gray-fg}${time}{/}  ${tagBold(color, `${icon} ${String(entry.level).toUpperCase()}`)}`;
	const line1 = padVisual(left1, Math.max(4, width - stripTags(right1).length - 2)) + "  " + right1;

	// ── line 2: message · source ······ (subtext) ─────────────────────────────
	const src = truncate(sourceOf(entry), Math.max(6, Math.floor(width * 0.45)));
	const msgMax = Math.max(10, width - (src ? stripTags(src).length + 2 : 0) - 2);
	const line2 = `${tagBold(color, truncate(entry.message, msgMax))}${src ? ` {gray-fg}${src}{/}` : ""}`;

	const lines = [line1, line2];

	// search highlight across both lines
	if (searchHighlight && searchHighlight.length > 1) {
		const hl = highlightTerms(searchHighlight);
		if (hl) {
			const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
			let reSource = "";
			if (hl.words.length) {
				reSource = hl.words.map(esc).join("|");
			} else if (hl.regex) {
				reSource = hl.regex;
			}
			if (reSource) {
				try {
					const re = new RegExp(`(${reSource})`, "gi");
					for (let i = 0; i < lines.length; i++) {
						lines[i] = lines[i].replace(re, "{yellow-bg}{black-fg}$1{/black-fg}{/yellow-bg}");
					}
				} catch {
					// ignore
				}
			}
		}
	}

	return { lines, color };
}

// dynamic selected row bg: electric-blue glow that pulses
function glowColor(phase) {
	const amt = getGlowIntensity();
	const r = 56 + Math.round(Math.sin(phase * 3) * amt);
	const g = 188;
	const b = 248;
	const toHex = (n) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, "0");
	return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export class LogList extends blessed.box {
	constructor(options) {
		super({
			...options,
			scrollable: true,
			alwaysScroll: true,
			mouse: true,
			tags: true,
			border: roundedBorder(COLORS.border),
			label: " 📜 live logs ",
			style: {
				bg: COLORS.bg,
				border: { fg: COLORS.border },
				scrollbar: { bg: COLORS.border },
			},
		});
		this.entries = [];
		this.selectedIndex = -1;
		this.hoverIndex = -1;
		this.topIndex = 0;
		this.horizontal = 0;
		this.onClickRow = null;
		this.onDoubleClickRow = null;
		this.onContextMenu = null;
		this.onNavigate = null;
		this.onToggleGroup = null;
		this.searchHighlight = "";
		this.forceRefresh = 0;
		this.freshAnimations = new Map(); // id -> arrival ms (fade-in + neon pulse)
		this._lastClickAt = 0;
		this._lastClickIndex = -1;
		this._phase = 0;

		this.on("click", (data) => {
			if (data.button === "right") {
				return;
			}
			this._handleClick(data.x, data.y, data.button);
		});
		this.on("wheelup", () => this.scroll(-1));
		this.on("wheeldown", () => this.scroll(1));
		this.on("mousemove", (data) => this._handleHover(data.x, data.y));
		this.on("mouseout", () => {
			if (this.hoverIndex !== -1) {
				this.hoverIndex = -1;
				this.refresh();
			}
		});
		// shift+wheel = horizontal scroll; plain wheel = vertical
		this.on("mouse", (data) => {
			if (data.action === "wheelup" || data.action === "wheeldown") {
				if (data.shift) {
					this.scrollHorizontal(data.action === "wheelup" ? -2 : 2);
				} else {
					this.scroll(data.action === "wheelup" ? -2 : 2);
				}
				return;
			}
			if (data.action === "mousedown" && data.button === "right") {
				const idx = this._indexAt(data.x, data.y);
				this.selectedIndex = idx;
				this.onContextMenu?.(data.x, data.y, idx);
				this.refresh();
			}
		});

		// animation loop: drives the pulsing neon selected-glow border
		this._anim = setInterval(() => {
			this._phase += 0.75;
			if (this.selectedIndex >= 0) {
				this.screen?.render();
			}
		}, options.animMs || 250);
	}

	_handleClick(x, y, button) {
		const idx = this._indexAt(x, y);
		if (idx === -1) {
			return;
		}
		const now = Date.now();
		if (now - this._lastClickAt < 300 && this._lastClickIndex === idx) {
			this.onDoubleClickRow?.(idx);
		}
		this._lastClickAt = now;
		this._lastClickIndex = idx;
		const entry = this.entries[idx];
		// left-click on a grouped row toggles its collapse/expand (▲/▼) before selecting
		if (entry?.groupCount && entry.groupCount > 1 && button === "left") {
			this.onToggleGroup?.(this._groupKey(entry));
		}
		this.selectIndex(idx);
	}

	_groupKey(entry) {
		return `${entry.level}|${entry.category}|${entry.message}`;
	}

	_handleHover(x, y) {
		const idx = this._indexAt(x, y);
		if (idx !== this.hoverIndex) {
			this.hoverIndex = idx;
			this.refresh();
		}
	}

	_indexAt(x, y) {
		const col = Math.floor(x - this.left - 1);
		if (col < 0 || col >= this.width - 2) {
			return -1;
		}
		const row = Math.floor((y - this.top - 1) / LINES_PER_ROW);
		if (row < 0) {
			return -1;
		}
		return this.topIndex + row;
	}

	setEntries(entries) {
		this.entries = entries;
		this.forceRefresh += 1;
		if (this.selectedIndex >= entries.length) {
			this.selectedIndex = Math.max(0, entries.length - 1);
		}
		if (entries.length > 0) {
			const last = entries[entries.length - 1];
			if (last?.id && !this.freshAnimations.has(last.id)) {
				this.freshAnimations.set(last.id, Date.now());
				setTimeout(() => {
					this.freshAnimations.delete(last.id);
					if (this.screen && this.freshAnimations.size === 0) this.screen.render();
				}, PULSE_MS + 200);
			}
		}
		this.refresh();
	}

	selectIndex(idx) {
		if (idx < 0 || idx >= this.entries.length) {
			return;
		}
		this.selectedIndex = idx;
		this.onClickRow?.(idx, this.entries[idx]);
		this.refresh();
	}

	navigate(delta) {
		if (this.entries.length === 0) {
			return;
		}
		let idx =
			this.selectedIndex === -1
				? delta > 0
					? 0
					: this.entries.length - 1
				: this.selectedIndex + delta;
		idx = Math.max(0, Math.min(this.entries.length - 1, idx));
		this.selectIndex(idx);
	}

	scroll(delta) {
		const target = Math.max(
			0,
			Math.min(Math.max(0, this.entries.length - this._visibleRows()), this.topIndex + delta),
		);
		this._animateScrollTo(target);
	}

	// Ease toward a target scroll position (smooth wheel momentum instead of
	// discrete jumps) — ~120ms, ~7 frames.
	_animateScrollTo(target) {
		if (this._scrollTo) {
			clearInterval(this._scrollTo);
			this._scrollTo = null;
		}
		const start = this.topIndex;
		const dist = target - start;
		if (dist === 0) {
			return;
		}
		let f = 0;
		const frames = 7;
		this._scrollTo = setInterval(() => {
			f += 1;
			const t = f / frames;
			this.topIndex = Math.round(start + dist * (1 - (1 - t) * (1 - t)));
			this.refresh();
			if (f >= frames) {
				clearInterval(this._scrollTo);
				this._scrollTo = null;
			}
		}, 16);
	}

	scrollHorizontal(delta) {
		const max = this._maxHorizontal();
		this.horizontal = Math.max(0, Math.min(max, this.horizontal + delta));
		this.refresh();
	}

	_maxHorizontal() {
		let w = 0;
		for (const e of this.entries) {
			const len = String(e.message || "").length + 46;
			if (len > w) {
				w = len;
			}
		}
		return Math.max(0, w - (this.width - 2) + 8);
	}

	_visibleRows() {
		return Math.max(1, Math.floor((this.height - 2) / LINES_PER_ROW));
	}

	follow() {
		if (this.entries.length === 0) {
			return;
		}
		const vis = this._visibleRows();
		this.topIndex = Math.max(0, this.entries.length - vis);
		this.refresh();
	}

	refresh() {
		if (!this.screen) {
			return;
		}
		const vis = this._visibleRows();
		const width = Math.max(10, this.width - 2);
		const lines = [];

		for (let i = 0; i < vis; i++) {
			const idx = this.topIndex + i;
			if (idx >= this.entries.length) {
				lines.push("");
				lines.push("");
				continue;
			}
			const entry = this.entries[idx];
			const isSelected = idx === this.selectedIndex;
			const isHover = idx === this.hoverIndex;
			const arrival = this.freshAnimations.get(entry.id);

			const { lines: cardLines } = renderRow(entry, {
				width,
				selected: isSelected,
				hover: isHover,
				searchHighlight: this.searchHighlight,
			});
			let [line1, line2] = cardLines;

			if (this.horizontal > 0) {
				line1 = line1.length > this.horizontal ? line1.slice(this.horizontal) : "";
				line2 = line2.length > this.horizontal ? line2.slice(this.horizontal) : "";
			}

			if (arrival !== undefined) {
				const t = (Date.now() - arrival) / PULSE_MS;
				if (t >= 0 && t <= 1) {
					const col = pulseColor(levelColor(entry.level), t * Math.PI, 60);
					line1 = `{${col}-fg}{bold}${line1}{/bold}{/${col}-fg}`;
					line2 = `{${col}-fg}{bold}${line2}{/bold}{/${col}-fg}`;
				}
			}

			if (isSelected) {
				const g = glowColor(this._phase);
				line1 = `{${g}-bg}{black-fg}${padVisual(line1, width)}{/black-fg}{/${g}-bg}`;
				line2 = `{${g}-bg}{black-fg}${padVisual(line2, width)}{/black-fg}{/${g}-bg}`;
			} else if (isHover) {
				line1 = `{#1E293B-bg}${padVisual(line1, width)}{/}`;
				line2 = `{#1E293B-bg}${padVisual(line2, width)}{/}`;
			}
			lines.push(line1);
			lines.push(line2);
		}

		this.setContent(lines.join("\n"));
		this.screen.render();
	}

	destroy() {
		clearInterval(this._anim);
		if (this._scrollTo) {
			clearInterval(this._scrollTo);
		}
		super.destroy();
	}
}

export { renderRow };
