import blessed from "blessed";
import { roundedBorder } from "./effects.js";
import {
	COLORS,
	currentThemeName,
	getGlowIntensity,
	setGlowIntensity,
	setTheme,
	tag,
	tagBold,
	themeNames,
} from "./theme.js";

export class Notifications extends blessed.box {
	constructor(options) {
		super({
			...options,
			hidden: true,
			width: 46,
			height: 8,
			tags: true,
			style: {
				bg: COLORS.card,
				border: { type: "line", fg: "#A855F7" },
			},
			border: { type: "line", fg: "#A855F7" },
			label: " 🚨 notifications ",
		});
		this.items = [];
		this.onClick = null;
		this.on("click", () => {
			if (this.items.length) {
				this.onClick?.(this.items[0]);
			}
		});
	}

	push(entry, message) {
		this.items.unshift({ entry, message, at: Date.now() });
		if (this.items.length > 4) {
			this.items.pop();
		}
		this.draw();
		this.show();
		this.screen?.render();
		// slide-in from the right — animate `right` a few px over ~160ms
		const baseRight = this.right;
		this.right = baseRight + 8;
		this.screen?.render();
		let frames = 0;
		const step = () => {
			if (this.hidden) {
				return;
			}
			frames += 1;
			this.right = Math.max(baseRight, baseRight + 8 - frames * 2);
			this.screen?.render();
			if (frames < 4 && this.right > baseRight) {
				setTimeout(step, 40);
			} else {
				this.right = baseRight;
				this.screen?.render();
			}
		};
		step();
		const timer = setTimeout(() => {
			this.hide();
			this.screen?.render();
		}, 6000);
		if (this._hideto) {
			clearTimeout(this._hideto);
		}
		this._hideto = timer;
	}

	draw() {
		const lines = [];
		for (const item of this.items) {
			const age = Math.floor((Date.now() - item.at) / 1000);
			lines.push(`  {#A855F7-fg}🚨{/} {#E2E8F0-fg}${item.message}{/} {gray-fg}${age}s ago{/}`);
		}
		this.setContent(lines.join("\n"));
	}
}

export class DiffOverlay extends blessed.box {
	constructor(options) {
		super({
			...options,
			hidden: true,
			width: 70,
			height: 20,
			tags: true,
			style: {
				bg: COLORS.card,
				border: { type: "line", fg: "#34D399" },
			},
			border: { type: "line", fg: "#34D399" },
			label: " ⇄ diff viewer ",
		});
		this.oldEntry = null;
		this.nextEntry = null;
		this.on("click", () => this.hide());
	}

	showDiff(a, b) {
		this.oldEntry = a;
		this.nextEntry = b;
		this.draw();
		this.show();
		this.focus();
		this.screen?.render();
	}

	draw() {
		if (!(this.oldEntry && this.nextEntry)) {
			return;
		}
		const lines = [];
		lines.push(`  {bold}{#FB7185-fg}OLD{/bold}{/}  ${this.oldEntry.message}`);
		lines.push(`  {bold}{#34D399-fg}NEW{/bold}{/}  ${this.nextEntry.message}`);
		lines.push("");
		const oldData = JSON.stringify(this.oldEntry.data || null, null, 2).split("\n");
		const nextData = JSON.stringify(this.nextEntry.data || null, null, 2).split("\n");
		const max = Math.max(oldData.length, nextData.length);
		for (let i = 0; i < max; i++) {
			const o = oldData[i];
			const n = nextData[i];
			if (o !== undefined && n !== undefined && o === n) {
				lines.push(`  {#475569-fg}${o}{/}`);
			} else {
				if (o !== undefined) {
					lines.push(`  {#FB7185-fg}- ${o}{/}`);
				}
				if (n !== undefined) {
					lines.push(`  {#34D399-fg}+ ${n}{/}`);
				}
			}
		}
		this.setContent(lines.join("\n"));
	}
}

export class RegexTester extends blessed.box {
	constructor(options) {
		super({
			...options,
			hidden: true,
			width: 70,
			height: 12,
			tags: true,
			keys: true,
			style: {
				bg: COLORS.card,
				border: { type: "line", fg: "#22D3EE" },
			},
			border: { type: "line", fg: "#22D3EE" },
			label: " 🧪 regex tester ",
		});
		this.input = blessed.textbox({
			parent: this,
			top: 0,
			left: 1,
			right: 1,
			height: 1,
			tags: false,
			inputOnFocus: true,
			style: { bg: COLORS.panel, fg: "#E2E8F0" },
		});
		this.result = blessed.box({
			parent: this,
			top: 2,
			left: 1,
			right: 1,
			bottom: 1,
			tags: true,
			scrollable: true,
			style: { bg: COLORS.panel },
		});
		this.target = "";
		this.onStreamScan = null;
		this.input.on("submit", () => this.test());
	}

	open(target) {
		this.target = target || "";
		this.draw();
		this.show();
		this.input.focus();
		this.screen?.render();
	}

	test() {
		const pattern = this.input.getValue();
		const lines = [];
		lines.push(`{gray-fg}pattern:{/} {#22D3EE-fg}/${pattern}/{/}`);
		lines.push("");
		try {
			const re = new RegExp(pattern);
			const matches = [];
			let m;
			const reG = new RegExp(pattern, "g");
			while ((m = reG.exec(this.target))) {
				matches.push(m[0]);
				if (matches.length > 40) {
					break;
				}
			}
			lines.push(`{gray-fg}matches:{/} {#E2E8F0-fg}${matches.length}{/}`);
			for (const mm of matches.slice(0, 20)) {
				lines.push(`  {#34D399-fg}✓{/} ${mm}`);
			}
			if (this.target.length > 4000) {
				lines.push("{gray-fg}… target truncated{/}");
			}
		} catch (err) {
			lines.push(`{#FB7185-fg}✖ invalid regex: ${err.message}{/}`);
		}
		// offload full-stream scan to a worker thread (does not block the UI)
		if (this.onStreamScan) {
			lines.push("");
			lines.push("{gray-fg}stream scan: running…{/}");
			this.result.setContent(lines.join("\n"));
			this.screen?.render();
			this.onStreamScan(pattern).then((n) => {
				const body = lines.slice(0, -1);
				body.push(`{gray-fg}stream scan:{/} {#38BDF8-fg}${n} entries match{/}`);
				this.result.setContent(body.join("\n"));
				this.screen?.render();
			});
		} else {
			this.result.setContent(lines.join("\n"));
		}
		this.screen?.render();
	}

	draw() {
		if (this.target) {
			this.result.setContent(`{gray-fg}target:{/} {#94A3B8-fg}${this.target.slice(0, 4000)}{/}`);
		}
	}
}

export class SessionRecorderOverlay extends blessed.box {
	constructor(options) {
		super({
			...options,
			hidden: true,
			width: 56,
			height: 12,
			tags: true,
			mouse: true,
			keys: true,
			style: { bg: COLORS.card, border: { type: "line", fg: "#F43F5E" } },
			border: { type: "line", fg: "#F43F5E" },
			label: " 🎙 session recorder ",
		});
		this.items = [
			{ key: "recent", label: "Last 30 min", windowMs: 30 * 60_000 },
			{ key: "hour", label: "Last hour", windowMs: 60 * 60_000 },
			{ key: "session", label: "Entire session", windowMs: 0 },
		];
		this.recording = false;
		this.onChoose = null;
		this.onStop = null;
		this.onReplay = null;
		this.selectedIndex = 0;
		this.on("click", (data) => {
			const y = Math.floor(data.y - this.top - 1);
			if (y >= 0 && y < this.items.length) {
				this.choose(y);
			}
			// stop/replay control row
			const x = Math.floor(data.x - this.top - 1);
			if (y === this.items.length + 1 && x >= 2 && x < 8) {
				this.stop();
			}
			if (y === this.items.length + 1 && x >= 10 && x < 16) {
				this.replay();
			}
		});
		this.on("mouse", (data) => {
			if (data.action === "wheelup") {
				this.move(-1);
			}
			if (data.action === "wheeldown") {
				this.move(1);
			}
		});
	}

	stop() {
		this.onStop?.();
	}

	replay() {
		this.hide();
		this.onReplay?.();
		this.screen?.render();
	}

	setRecording(active) {
		this.recording = !!active;
		this.draw();
		if (this.recording) {
			this.hide();
		}
		this.screen?.render();
	}

	open() {
		this.selectedIndex = 0;
		this.draw();
		this.show();
		this.focus();
		this.screen?.render();
	}

	move(delta) {
		this.selectedIndex = (this.selectedIndex + delta + this.items.length) % this.items.length;
		this.draw();
		this.screen?.render();
	}

	choose(idx) {
		const item = this.items[idx];
		if (item) {
			this.hide();
			this.onChoose?.(item);
			this.screen?.render();
		}
	}

	draw() {
		const lines = [];
		lines.push("  {gray-fg}Choose a recording window:{/}");
		lines.push("");
		this.items.forEach((item, i) => {
			const sel = i === this.selectedIndex;
			const line = sel
				? `  {blue-bg}{black-fg}▶ ${item.label} ⏺{/black-fg}{/blue-bg}`
				: `  {#94A3B8-fg}  ${item.label}{/}`;
			lines.push(line);
		});
		lines.push("");
		if (this.recording) {
			lines.push("  {bold}{#F43F5E-fg}● RECORDING…{/bold}{/}");
			lines.push("  {#38BDF8-fg}[Stop]{/}   {#34D399-fg}[Replay]{/}");
		} else {
			lines.push("  {gray-fg}Enter=record  ↓=select  Esc=cancel{/}");
		}
		lines.push(`  {gray-fg}status: ${this.recording ? "recording" : "idle"}{/}`);
		this.setContent(lines.join("\n"));
	}

	handleKey(name) {
		if (name === "up") {
			this.move(-1);
		} else if (name === "down") {
			this.move(1);
		} else if (name === "enter") {
			this.choose(this.selectedIndex);
		} else if (name === "escape") {
			if (this.recording) {
				this.stop();
			} else {
				this.hide();
			}
			this.screen?.render();
		}
	}
}

export class BookmarksOverlay extends blessed.box {
	constructor(options) {
		super({
			...options,
			hidden: true,
			width: 56,
			height: 16,
			tags: true,
			mouse: true,
			style: { bg: COLORS.card, border: { type: "line", fg: "#FBBF24" } },
			border: { type: "line", fg: "#FBBF24" },
			label: " ★ bookmarks ",
		});
		this.items = [];
		this.onPick = null;
		this.on("click", (data) => {
			const y = Math.floor(data.y - this.top - 1);
			if (this.items[y]) {
				this.hide();
				this.onPick?.(this.items[y]);
				this.screen?.render();
			}
		});
	}

	setItems(items) {
		this.items = items || [];
		this.draw();
		this.show();
		this.screen?.render();
	}

	draw() {
		const lines = [];
		if (!this.items.length) {
			lines.push("  {gray-fg}No bookmarks yet. Press 'b' to star a log.{/}");
		}
		for (const it of this.items) {
			lines.push(`  {yellow-fg}★{/} {#E2E8F0-fg}${String(it.message).slice(0, 46)}{/}`);
		}
		this.setContent(lines.join("\n"));
	}
}

export class WorkspacesOverlay extends blessed.box {
	constructor(options) {
		super({
			...options,
			hidden: true,
			width: 46,
			height: 14,
			tags: true,
			mouse: true,
			style: { bg: COLORS.card, border: { type: "line", fg: COLORS.accent } },
			border: { type: "line", fg: COLORS.accent },
			label: " 🗂 workspaces ",
		});
		this.names = [];
		this.onPick = null;
		this.on("click", (data) => {
			const y = Math.floor(data.y - this.top - 1);
			if (this.names[y]) {
				this.onPick?.(this.names[y]);
			}
		});
	}

	setNames(names) {
		this.names = names || [];
		this.draw();
		this.show();
		this.screen?.render();
	}

	draw() {
		const lines = [];
		if (!this.names.length) {
			lines.push("  {gray-fg}No saved workspaces.{/}");
			lines.push("  {gray-fg}Press 's' to save current layout.{/}");
		}
		this.names.forEach((n, i) => {
			lines.push(`  {#38BDF8-fg}${i + 1}•{/} {#E2E8F0-fg}${n}{/}`);
		});
		this.setContent(lines.join("\n"));
	}
}

export class ThemePickerOverlay extends blessed.box {
	constructor(options) {
		super({
			...options,
			hidden: true,
			width: 52,
			height: 16,
			tags: true,
			mouse: true,
			style: { bg: COLORS.card, border: { type: "line", fg: COLORS.accent } },
			border: { type: "line", fg: COLORS.accent },
			label: " 🎨 theme & glow ",
		});
		this.onChoose = null;
		this.onGlow = null;
		this.on("click", (data) => {
			const x = Math.floor(data.x - this.top - 1);
			const y = Math.floor(data.y - this.top - 2);
			if (y === 0) {
				this.cycleTheme(x);
			}
			if (y === 7 && x >= 2 && x <= 12) {
				this.changeGlow(x - 2);
			}
		});
		this.on("mouse", (data) => {
			if (data.action === "wheelup") {
				this.changeGlow(1);
			} else if (data.action === "wheeldown") {
				this.changeGlow(-1);
			}
		});
	}

	cycleTheme(x) {
		const names = themeNames();
		let idx = names.indexOf(currentThemeName());
		idx = (idx + 1 + names.length) % names.length;
		setTheme(names[idx]);
		this.onChoose?.(names[idx]);
		this.draw();
		this.screen?.render();
	}

	changeGlow(delta) {
		setGlowIntensity(getGlowIntensity() + delta * 8);
		this.onGlow?.(getGlowIntensity());
		this.draw();
		this.screen?.render();
	}

	open() {
		this.draw();
		this.show();
		this.focus();
		this.screen?.render();
	}

	draw() {
		const names = themeNames();
		const cur = currentThemeName();
		const glow = getGlowIntensity();
		const blocks = Math.round((glow / 80) * 10);
		const lines = [];
		lines.push(
			`  theme: {cyan-bg}{black-fg} ${cur.toUpperCase()} }{/black-fg}{/cyan-bg}  {gray-fg}←click to cycle{/}`,
		);
		lines.push("");
		lines.push(
			"  " +
				names
					.map((n) =>
						n === cur ? `{blue-bg}{black-fg} ${n} {/black-fg}{/blue-bg}` : ` {#94A3B8-fg}${n}{/}`,
					)
					.join(" "),
		);
		lines.push("");
		lines.push(`  glow: {#38BDF8-fg}${"█".repeat(glow)}{/}`);
		lines.push("");
		lines.push("  wheel ↑/↓ to change glow intensity");
		lines.push("");
		lines.push("  {gray-fg}Esc to close{/}");
		this.setContent(lines.join("\n"));
	}
}
