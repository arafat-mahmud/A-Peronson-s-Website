import blessed from "blessed";
import { CATEGORIES } from "../log/categories.js";
import { roundedBorder } from "./effects.js";
import { COLORS, categoryIcon } from "./theme.js";

// group key → category keys, mirroring the HTML sidebar's two sections
const WORKSPACE_KEYS = ["overview", "live", "errors", "warnings", "info"];
const SERVICES_KEYS = [
	"requests",
	"assistant",
	"image_queue",
	"redis",
	"prisma",
	"syslog",
	"audit",
	"analytics",
	"workers",
	"auth",
	"frontend",
	"favorites",
];

export class Sidebar extends blessed.box {
	constructor(options) {
		super({
			...options,
			width: 22,
			tags: true,
			mouse: true,
			scrollable: true,
			alwaysScroll: true,
			style: {
				bg: COLORS.panel,
				border: { type: "line", fg: COLORS.border },
			},
			border: roundedBorder(COLORS.border),
			label: " 📂 sections ",
		});
		this.activeCategory = "live";
		this.unread = new Map();
		this.burstSummary = null;
		this.onSelect = null;
		this.onClick = null;
		this._rowMap = [];
		this.liveInfo = { sources: 1, parsers: 0, live: 0 };
		this._flatCategories = [
			...CATEGORIES.filter((c) => WORKSPACE_KEYS.includes(c.key)),
			...CATEGORIES.filter((c) => SERVICES_KEYS.includes(c.key)),
		];

		this.on("click", (data) => {
			const idx = this._indexAt(data.x, data.y);
			if (idx === -1) {
				return;
			}
			const cat = this._flatCategories[idx];
			if (cat) {
				this.onSelect?.(cat.key);
				this.onClick?.(cat.key);
			}
		});
		this.on("mouse", (data) => {
			if (data.action === "wheelup") {
				this.scroll(-1);
			}
			if (data.action === "wheeldown") {
				this.scroll(1);
			}
		});
	}

	_indexAt(x, y) {
		const contentRow = Math.floor(y - this.top - 1);
		if (contentRow < 0 || contentRow >= this._rowMap.length) {
			return -1;
		}
		return this._rowMap[contentRow];
	}

	setActive(cat) {
		this.activeCategory = cat;
		this.draw();
	}

	bumpUnread(category) {
		if (category === this.activeCategory) {
			return;
		}
		this.unread.set(category, (this.unread.get(category) || 0) + 1);
		this.draw();
	}

	clearUnread(category) {
		this.unread.delete(category);
		this.draw();
	}

	setBurst(summary) {
		this.burstSummary = summary && summary.events >= (summary.minEvents ?? 3) ? summary : null;
		this.draw();
	}

	setLiveInfo({ sources, parsers, live }) {
		if (sources !== undefined) {
			this.liveInfo.sources = sources;
		}
		if (parsers !== undefined) {
			this.liveInfo.parsers = parsers;
		}
		if (live !== undefined) {
			this.liveInfo.live = live;
		}
		this.draw();
	}

	_cat(cat, active) {
		const icon = categoryIcon(cat.key);
		const label = cat.label.padEnd(10);
		const unread = this.unread.get(cat.key) || 0;
		let line;
		if (active) {
			line = `{blue-bg}{black-fg}  ${icon} ${label}{/black-fg}{/blue-bg}`;
		} else {
			line = `  ${icon} {#94A3B8-fg}${label}{/}`;
		}
		if (unread > 0) {
			line += ` {red-fg}●${unread > 99 ? "99+" : unread}{/}`;
		}
		return line;
	}

	draw() {
		const lines = [];
		const rowMap = [];
		const catIdx = (row) => this._flatCategories.findIndex((c) => c.key === row);
		lines.push("{bold}{#38BDF8-fg}  NEON//OBSERVE{/bold}{/}");
		lines.push("{gray-fg}  server log observatory{/}");
		lines.push("");

		lines.push("{bold}{#64748B-fg}  WORKSPACE{/bold}{/}");
		for (const cat of CATEGORIES.filter((c) => WORKSPACE_KEYS.includes(c.key))) {
			rowMap.push(catIdx(cat.key));
			lines.push(this._cat(cat, cat.key === this.activeCategory));
		}
		lines.push("");
		rowMap.push(-1);
		lines.push("{bold}{#64748B-fg}  SERVICES{/bold}{/}");
		for (const cat of CATEGORIES.filter((c) => SERVICES_KEYS.includes(c.key))) {
			rowMap.push(catIdx(cat.key));
			lines.push(this._cat(cat, cat.key === this.activeCategory));
		}
		lines.push("");
		rowMap.push(-1);

		if (this.burstSummary) {
			const s = this.burstSummary;
			lines.push("{bold}{#F97316-fg}  ⚠ BURST DETECTED{/bold}{/}");
			lines.push(
				`  {red-fg}${s.criticalCount} critical{/} · {#F97316-fg}${s.errorCount} errors{/} in ${Math.round(s.windowMs / 1000)}s`,
			);
			if (s.topFiles?.length) {
				lines.push(`  {#E2E8F0-fg}  → {/#E2E8F0-fg}{#F472B6-fg}${s.topFiles[0][0]}{/}`);
			}
			lines.push("");
		}

		lines.push("{bold}{#E8EDFF-fg}  WORKSPACE · production{/bold}{/}");
		lines.push(
			`{gray-fg}  ${this.liveInfo.sources} source${this.liveInfo.sources === 1 ? "" : "s"} · ${this.liveInfo.parsers} parser${this.liveInfo.parsers === 1 ? "" : "s"} · ${this.liveInfo.live ? "1 live stream" : "offline"}{/}`,
		);
		lines.push("{#8B5CF6-fg}  ────────────────{/}");
		lines.push("{gray-fg}  ⌘ help: ?{/}");
		this._rowMap = rowMap;
		this.setContent(lines.join("\n"));
		this.screen?.render();
	}
}
