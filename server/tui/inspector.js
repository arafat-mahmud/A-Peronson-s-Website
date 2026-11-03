import blessed from "blessed";
import { highlight } from "cli-highlight";
import { roundedBorder } from "./effects.js";
import { COLORS, levelColor, levelIcon, tag, tagBold } from "./theme.js";

export const TABS = ["metadata", "json", "stack", "raw", "flow", "diff"];

function truncate(s, max) {
	const str = String(s || "");
	return str.length <= max ? str : `${str.slice(0, Math.max(0, max - 1))}…`;
}

function kv(label, value) {
	return `  {#64748B-fg}${label.padEnd(12)}{/}{#E2E8F0-fg}${truncate(String(value ?? "—"), 40)}{/}`;
}

export class Inspector extends blessed.box {
	constructor(options) {
		super({
			...options,
			width: 50,
			tags: true,
			mouse: true,
			style: {
				bg: COLORS.panel,
				border: { type: "line", fg: COLORS.border },
			},
			border: roundedBorder(COLORS.border),
			label: " 🔎 inspector ",
		});
		this.activeTab = "metadata";
		this.entry = null;
		this.expanded = new Set();
		this.onTabChange = null;
		this.onEntry = null;
		this.flow = [];
		this.diff = null;
		this.stackExpanded = false;
		this.jsonSearch = "";
		this.pendingCopyPath = null;
		this._jsonSearchBox = null;
		this._stackFoldRow = -1;
		this._linePaths = new Map();

		this.on("click", (data) => {
			const x = Math.floor(data.x - this.left - 1);
			const y = Math.floor(data.y - this.top - 1);
			if (y < 0) {
				return;
			}
			// tab row
			if (y === 0) {
				let offset = 2;
				for (const tab of TABS) {
					const label = tab.toUpperCase();
					if (x >= offset && x < offset + label.length) {
						this.setTab(tab);
						return;
					}
					offset += label.length + 2;
				}
				return;
			}
			// stack fold row
			if (this.activeTab === "stack" && this.entry?.stack) {
				const lineIdx = y - 2 + this.scrollTop;
				if (lineIdx === this._stackFoldRow) {
					this.stackExpanded = !this.stackExpanded;
					this.draw();
					return;
				}
			}
			// json toggle rows / copy field
			if (this.activeTab === "json" && this.entry) {
				const lineIdx = y - 2 + this.scrollTop;
				const path = this._jsonPathAtLine(lineIdx);
				if (path !== null) {
					const copied = this.copyFieldAtLine(lineIdx);
					if (copied) {
						this.pendingCopyPath = copied.path;
						this.emit("copy_path", copied);
						this.onCopyField?.(copied.path, copied.value);
					}
					this._togglePath(path);
				}
			}
			if (this.activeTab === "flow" && this.flow.length) {
				const idx = y - 2;
				if (idx >= 0 && idx < this.flow.length) {
					this.onEntry?.(this.flow[idx]);
				}
			}
		});
		this.on("wheelup", () => this.scroll(-1));
		this.on("wheeldown", () => this.scroll(1));
		this.key(["?"], () => {
			if (this.activeTab === "json") {
				this.focusJsonSearch();
			}
		});
	}

	setEntry(entry) {
		this.entry = entry;
		this.flow = [];
		this.diff = null;
		this.draw();
	}

	setFlow(flow) {
		this.flow = flow || [];
		this.draw();
	}

	setDiff(diff) {
		this.diff = diff || null;
		this.setTab("diff");
	}

	setTab(tab) {
		if (!TABS.includes(tab)) {
			return;
		}
		this.activeTab = tab;
		this.onTabChange?.(tab);
		this.draw();
	}

	_jsonPathAtLine(line) {
		if (!this.entry) {
			return null;
		}
		const data = this.entry.data;
		if (!data || typeof data !== "object") {
			return null;
		}
		// approximate: we keep a flat map built during render
		return this._linePaths?.get(line) ?? null;
	}

	_togglePath(path) {
		if (this.expanded.has(path)) {
			this.expanded.delete(path);
		} else {
			this.expanded.add(path);
		}
		this.draw();
	}

	draw() {
		const e = this.entry;
		const tabs = TABS.map((t) => {
			const label = t.toUpperCase();
			const active = t === this.activeTab;
			return active
				? `{blue-bg}{black-fg} ${label} {/black-fg}{/blue-bg}`
				: tag("#64748B", ` ${label} `);
		}).join(" ");

		const header = ` ${tabs}${this.activeTab === "json" ? "  {gray-fg}[y:copy field]{/}" : ""}`;
		let body = [];

		if (!e) {
			body.push("");
			body.push("  {gray-fg}Select a log entry to inspect it{/}");
		} else if (this.activeTab === "metadata") {
			body = this._renderMetadata(e);
		} else if (this.activeTab === "json") {
			body = this._renderJson(e);
		} else if (this.activeTab === "stack") {
			body = this._renderStack(e);
		} else if (this.activeTab === "raw") {
			body = this._renderRaw(e);
		} else if (this.activeTab === "flow") {
			body = this._renderFlow();
		} else if (this.activeTab === "diff") {
			body = this._renderDiff();
		}

		this.setContent([header, "{gray-fg}─".repeat(this.width - 2) + "{/}", ...body].join("\n"));
		this.screen?.render();
	}

	_renderMetadata(e) {
		const rows = [];
		const color = levelColor(e.level);
		const src = e.meta?.source || e.data?.source || e.source || "";
		// title row: LEVEL · Event Inspector ......... #id
		rows.push(
			`${tagBold(color, `${levelIcon(e.level)} ${e.level.toUpperCase()} · Event Inspector`)}${" ".repeat(Math.max(1, this.width - 30 - String(e.id || "").length))}{#38BDF8-fg}#${e.id}{/}`,
		);
		rows.push("{gray-fg}─".repeat(this.width - 2) + "{/}");
		// kv metadata grid (HTML .kv)
		rows.push(kv("Timestamp", e.ts));
		rows.push(kv("Source", src));
		rows.push(kv("Message", truncate(e.message, this.width - 22)));
		rows.push(kv("Subsystem", String(e.category || "").toUpperCase()));
		if (e.request_id) {
			rows.push(kv("Request ID", e.request_id));
		}
		rows.push("{gray-fg}─".repeat(this.width - 2) + "{/}");
		// Request Flow waterfall
		rows.push("{bold}{#38BDF8-fg}Request Flow{/bold}{/}");
		if (this.flow.length) {
			rows.push(...this._flowCards());
		} else {
			rows.push("  {gray-fg}no flow captured for this event{/}");
		}
		rows.push("{gray-fg}─".repeat(this.width - 2) + "{/}");
		// Payload JSON block (HTML .json)
		rows.push("{bold}{#38BDF8-fg}Payload{/bold}{/}");
		const data = e.data ?? e.meta;
		if (data && typeof data === "object") {
			const block = this._jsonRows(data, { depth: 0, maxDepth: 6 }).slice(0, 18);
			for (const r of block) {
				rows.push(`  ${r.text}`);
			}
			if (block.length >= 18) {
				rows.push("  {gray-fg}… truncated{/}");
			}
		} else {
			rows.push("  {gray-fg}—{/}");
		}
		return rows;
	}

	_flowCards() {
		const steps = this.flow.slice(0, 6);
		const lines = [];
		for (const s of steps) {
			const dur = s.meta?.duration_ms ?? s.data?.duration_ms ?? s.duration_ms;
			const label = String(s.message || "…").slice(0, this.width - 20);
			const durTxt = Number.isFinite(Number(dur))
				? ` {cyan-fg}${Math.round(Number(dur))}ms{/}`
				: "";
			lines.push(`  › {#E2E8F0-fg}${label}{/}${durTxt}`);
		}
		return lines;
	}

	_renderJson(e) {
		const data = e.data;
		if (data === null || data === undefined) {
			return ["", "  {gray-fg}No JSON payload{/}"];
		}
		const rows = this._jsonRows(data);
		const term = String(this.jsonSearch || "")
			.trim()
			.toLowerCase();
		this._linePaths = new Map();
		const out = [];
		for (const row of rows) {
			if (term && !row.plain.toLowerCase().includes(term)) {
				continue;
			}
			const text = term ? this._highlightMatches(row.plain, term) : row.text;
			this._linePaths.set(out.length + 2, row.path);
			out.push(`  ${text}`);
		}
		return ["", "  {yellow-fg}{bold}? search json{/bold}{/}", ...out];
	}

	_jsonRows(value, { prefix = "", expanded = this.expanded, depth = 0, maxDepth = 12 } = {}) {
		const rows = [];
		const indent = "  ".repeat(depth);
		const isExpandable = (v) => v !== null && typeof v === "object";
		if (!isExpandable(value)) {
			rows.push({
				path: prefix,
				plain: this._primitivePlain(value),
				text: `${indent}${this._primitiveTag(value)}`,
			});
			return rows;
		}
		const isArr = Array.isArray(value);
		const keys = isArr ? value.map((_, i) => i) : Object.keys(value);
		if (keys.length === 0) {
			rows.push({
				path: prefix,
				plain: isArr ? "[]" : "{}",
				text: `${indent}{gray-fg}${isArr ? "[]" : "{}"}{/}`,
			});
			return rows;
		}
		const path = prefix;
		const isOpen = expanded.has(path) || depth < 2;
		const label = isArr ? `Array(${keys.length})` : `{${Object.keys(value).length}}`;
		const toggle = isOpen ? "{cyan-fg}▼{/}" : "{cyan-fg}▶{/}";
		const openBrace = isArr ? "{gray-fg}[{/}" : "{gray-fg}{{/}";
		if (depth > maxDepth) {
			rows.push({
				path,
				plain: `${label} …`,
				text: `${indent}${toggle} ${label} ${openBrace}{gray-fg}…{/}`,
			});
			return rows;
		}
		rows.push({ path, plain: label, text: `${indent}${toggle} {blue-fg}${label}{/} ${openBrace}` });
		if (isOpen) {
			for (const key of keys.slice(0, 200)) {
				const child = value[key];
				const childPath = `${path}/${String(key)}`;
				if (isExpandable(child)) {
					rows.push(
						...this._jsonRows(child, { prefix: childPath, expanded, depth: depth + 1, maxDepth }),
					);
				} else {
					rows.push({
						path: childPath,
						plain: `${key}: ${this._primitivePlain(child)}`,
						text: `${indent}  {gray-fg}${key}{/}: ${this._primitiveTag(child)}`,
					});
				}
			}
			if (keys.length > 200) {
				rows.push({
					path,
					plain: `… ${keys.length - 200} more keys`,
					text: `${indent}  {gray-fg}… ${keys.length - 200} more keys{/}`,
				});
			}
		}
		rows.push({ path, plain: "", text: `${indent}${isArr ? "{gray-fg}]{/}" : "{gray-fg}}{/}"}` });
		return rows;
	}

	_primitiveTag(value) {
		if (value === null) {
			return "{gray-fg}null{/}";
		}
		if (value === undefined) {
			return "{gray-fg}undefined{/}";
		}
		if (typeof value === "boolean") {
			return `{magenta-fg}${value}{/}`;
		}
		if (typeof value === "number") {
			return `{cyan-fg}${value}{/}`;
		}
		if (typeof value === "string") {
			const str = String(value).slice(0, 60);
			return `{white-fg}"${str}"{/}`;
		}
		return `{white-fg}${String(value).slice(0, 60)}{/}`;
	}

	_primitivePlain(value) {
		if (value === null || value === undefined) {
			return String(value);
		}
		if (typeof value === "string") {
			return `"${String(value).slice(0, 60)}"`;
		}
		return String(value).slice(0, 60);
	}

	_highlightMatches(text, term) {
		if (!term) {
			return text;
		}
		const lower = text.toLowerCase();
		let out = "";
		let i = 0;
		while (i < text.length) {
			const idx = lower.indexOf(term, i);
			if (idx === -1) {
				out += text.slice(i);
				break;
			}
			out +=
				text.slice(i, idx) +
				"{yellow-bg}{black-fg}" +
				text.slice(idx, idx + term.length) +
				"{/}{/}";
			i = idx + term.length;
		}
		return out;
	}

	copyFieldAtLine(lineIdx) {
		const path = this._linePaths?.get(lineIdx) ?? null;
		if (!path) {
			return null;
		}
		return { path, value: this._valueAtPath(path) };
	}

	_valueAtPath(path) {
		const segs = String(path).split("/").filter(Boolean).slice(1);
		let node = this.entry?.data;
		for (const seg of segs) {
			if (node === null || node === undefined) {
				return;
			}
			node = Array.isArray(node) ? node[Number(seg)] : node[seg];
		}
		return node;
	}

	focusJsonSearch() {
		if (!this._jsonSearchBox) {
			this._jsonSearchBox = blessed.textbox({
				parent: this.screen,
				top: this.top + 1,
				left: this.left + 1,
				width: Math.max(12, this.width - 4),
				height: 1,
				tags: false,
				inputOnFocus: true,
				style: { bg: COLORS.card, fg: "#E2E8F0" },
				border: { type: "line", fg: COLORS.accent },
			});
			this._jsonSearchBox.on("submit", (v) => this.setJsonSearch(String(v || "")));
			this._jsonSearchBox.on("cancel", () => {
				this._jsonSearchBox.hide();
				this.screen?.focus();
				this.screen?.render();
			});
		}
		this._jsonSearchBox.setValue(this.jsonSearch);
		this._jsonSearchBox.show();
		this._jsonSearchBox.focus();
		this.screen?.render();
	}

	setJsonSearch(term) {
		this.jsonSearch = String(term || "");
		this._jsonSearchBox?.hide();
		this.draw();
		this.screen?.focus();
	}

	_renderStack(e) {
		if (!e.stack) {
			return ["", "  {gray-fg}No stack trace{/}"];
		}
		return this._stackLines(e);
	}

	_stackLines(e) {
		const frames = String(e.stack).split("\n");
		const visible = this.stackExpanded ? frames.slice(0, 40) : frames.slice(0, 3);
		const lines = [];
		this._stackFoldRow = -1;
		for (let i = 0; i < visible.length; i++) {
			const color = i === 0 ? "#FB7185" : "#94A3B8";
			lines.push(`  {cyan-fg}#${i}{/} {${color}-fg}${visible[i].trim()}{/}`);
		}
		if (!this.stackExpanded && frames.length > 3) {
			const n = frames.length - 3;
			this._stackFoldRow = lines.length;
			lines.push(`{gray-fg}  ▼ ${n} more frames (click to expand){/}`);
		}
		return ["", ...lines];
	}

	_renderRaw(e) {
		try {
			const json = highlight(JSON.stringify({ ...e, data: e.data }, null, 2), {
				language: "json",
				ignoreIllegals: true,
			});
			return ["", ...json.split("\n").map((l) => `  {#9CA3AF-fg}${l}{/}`)];
		} catch {
			return ["", "  {gray-fg}unserializable{/}"];
		}
	}

	_renderFlow() {
		if (!this.flow.length) {
			return ["", "  {gray-fg}No request flow captured{/}"];
		}
		// Chrome-DevTools-style waterfall: each step is a bar proportional to its
		// duration, offset by elapsed time since the request started.
		const steps = this.flow.map((s) => {
			const rawDur = s.meta?.duration_ms ?? s.data?.duration_ms ?? s.duration_ms;
			const dur = Number.isFinite(Number(rawDur)) ? Number(rawDur) : 0;
			return {
				...s,
				elapsed: s.t === undefined ? 0 : Math.max(0, s.t - (this.flow[0].t ?? s.t)),
				dur,
			};
		});
		const maxDur = Math.max(...steps.map((s) => s.dur || 0), 1);
		const barW = Math.max(6, Math.min(26, this.width - 34));
		const scale = barW / maxDur;
		const lines = [];
		const t0 = new Date(this.flow[0]?.t ?? Date.now()).toTimeString().slice(0, 8);
		lines.push(`  {gray-fg}request started {#38BDF8-fg}${t0}{/}`);
		lines.push("");
		for (const step of steps) {
			const color = levelColor(step.level);
			const dur = Number(step.dur) || 0;
			const pad = Math.max(0, Math.round(step.elapsed * 0.05));
			const bar = "█".repeat(
				Math.min(barW, Math.max(1, Math.round(dur * scale) || (dur > 0 ? 1 : 0))),
			);
			const label = String(step.message || "…")
				.slice(0, 24)
				.padEnd(24);
			const durTxt = dur > 0 ? `{cyan-fg}${Math.round(dur)}ms{/}` : "";
			lines.push(
				`  {#64748B-fg}${label}{/} {gray-fg}${" ".repeat(pad)}{/}{${color}-fg}${bar}{/} ${durTxt}`,
			);
		}
		lines.push("");
		lines.push(
			`  {gray-fg}→ completed {#38BDF8-fg}${Math.round(steps.reduce((a, s) => a + (s.dur || 0), 0))}ms total{/}`,
		);
		return lines;
	}

	_renderDiff() {
		if (!this.diff) {
			return ["", "  {gray-fg}Select two logs and use 'd' to diff{/}"];
		}
		const { old: oldEntry, next: nextEntry } = this.diff;
		const lines = [];
		lines.push("  {bold}{#FB7185-fg}OLD{/bold}{/}  {bold}{#34D399-fg}NEW{/bold}{/}");
		lines.push(`  {gray-fg}${oldEntry?.ts}{/} vs {gray-fg}${nextEntry?.ts}{/}`);
		lines.push("");
		const oldData = JSON.stringify(oldEntry?.data || null, null, 2).split("\n");
		const nextData = JSON.stringify(nextEntry?.data || null, null, 2).split("\n");
		const max = Math.max(oldData.length, nextData.length);
		for (let i = 0; i < max; i++) {
			const o = oldData[i];
			const n = nextData[i];
			if (o !== undefined && n !== undefined) {
				if (o === n) {
					lines.push(`  {#475569-fg}${o}{/}`);
				} else {
					lines.push(`  {#FB7185-fg}- ${o}{/}`);
					lines.push(`  {#34D399-fg}+ ${n}{/}`);
				}
			} else if (o !== undefined) {
				lines.push(`  {#FB7185-fg}- ${o}{/}`);
			} else if (n !== undefined) {
				lines.push(`  {#34D399-fg}+ ${n}{/}`);
			}
		}
		return lines;
	}
}
