import blessed from "blessed";
import { COLORS, tag } from "./theme.js";

const DIM = "#64748B";
const SCRUB_BACK = -10_000;
const SCRUB_FORWARD = 60_000;

function plain(s) {
	return String(s).replace(/\{[^}]*\}/g, "");
}

function fmtOffset(ms) {
	if (!ms) {
		return "[live]";
	}
	const sign = ms < 0 ? "-" : "+";
	const abs = Math.abs(ms);
	if (abs >= 60_000) {
		return `[${sign}${Math.floor(abs / 60_000)}m]`;
	}
	return `[${sign}${Math.floor(abs / 1000)}s]`;
}

export class HubTabs extends blessed.box {
	constructor(options) {
		const baseHeight = options.height ?? 1;
		super({
			...options,
			height: baseHeight,
			tags: true,
			mouse: true,
			style: { bg: COLORS.panel },
		});
		this._baseHeight = baseHeight;
		this.servers = new Map();
		this.active = null;
		this.onSelectTab = null;
		this.onScrub = null;
		this.showTravel = false;
		this._offset = 0;
		this._tabHit = [];
		this._scrubHit = { minus: null, plus: null };

		this.on("click", (data) => {
			const col = Math.floor(data.x - this.left - (this.border ? 1 : 0));
			const row = Math.floor(data.y - this.top - (this.border ? 1 : 0));
			this._handleClick(row, col);
		});
	}

	addServer({ name, url, online = true }) {
		this.servers.set(name, { url: url ?? "", online: !!online });
		if (this.active === null) {
			this.active = name;
		}
		this.draw();
	}

	setServer(name, { url, online } = {}) {
		const s = this.servers.get(name);
		if (!s) {
			return;
		}
		if (url !== undefined) {
			s.url = url;
		}
		if (online !== undefined) {
			s.online = !!online;
		}
		this.draw();
	}

	removeServer(name) {
		this.servers.delete(name);
		if (this.active === name) {
			this.active = this.servers.keys().next().value ?? null;
		}
		this.draw();
	}

	setActive(name) {
		if (name === null || this.servers.has(name)) {
			this.active = name;
			this.draw();
		}
	}

	setTravelOffset(ms) {
		this._offset = Number(ms) || 0;
		this.draw();
		return this._offset;
	}

	shiftTime(ms) {
		this._offset = Math.min(0, this._offset + (Number(ms) || 0));
		this.draw();
		return this._offset;
	}

	toggle() {
		this.showTravel = !this.showTravel;
		this.height = this._baseHeight + (this.showTravel ? 1 : 0);
		this.draw();
		return this.showTravel;
	}

	get offset() {
		return this._offset;
	}

	_handleClick(row, col) {
		if (row === 0) {
			for (const t of this._tabHit) {
				if (col >= t.col && col < t.col + t.width) {
					this.onSelectTab?.(t.name);
					return;
				}
			}
			return;
		}
		if (row === 1 && this.showTravel) {
			for (const [key, hit] of Object.entries(this._scrubHit)) {
				if (hit && col >= hit.col && col < hit.col + hit.width) {
					if (key === "minus") {
						this.onScrub?.(SCRUB_BACK);
					} else {
						this.onScrub?.(SCRUB_FORWARD);
					}
					return;
				}
			}
		}
	}

	_renderTabs() {
		this._tabHit = [];
		let line = "";
		for (const [name, s] of this.servers) {
			const dot = s.online ? "{#34D399-fg}●{/}" : "{#64748B-fg}○{/}";
			const active = name === this.active;
			let part;
			if (active) {
				part = ` {cyan-bg}{black-fg} ${name} ${s.online ? "●" : "○"}{/black-fg}{/cyan-bg} `;
			} else {
				part = ` ${tag("#94A3B8", name)} ${dot} `;
			}
			this._tabHit.push({ name, col: plain(line).length, width: plain(part).length });
			line += part;
			if (this.servers.size > 1) {
				line += " ";
			}
		}
		if (line === "") {
			line = tag(DIM, "  no servers");
		}
		return line;
	}

	_renderScrub() {
		this._scrubHit = { minus: null, plus: null };
		const time = new Date(Date.now() + this._offset).toTimeString().slice(0, 8);
		const pieces = [
			["label", tag(DIM, " ← scrub: ")],
			["text", tag(DIM, "[<")],
			["minus", tag("#FBBF24", " [ -10s] ")],
			["plus", tag("#34D399", "[+10s] ")],
			["text", tag(DIM, ">]")],
			["time", tag("#38BDF8", ` t:${time}`)],
			["text", tag(DIM, ` offset:${fmtOffset(this._offset)}`)],
		];
		let line = "";
		for (const [key, text] of pieces) {
			if (key === "minus" || key === "plus") {
				this._scrubHit[key] = { col: plain(line).length, width: plain(text).length };
			}
			line += text;
		}
		return line;
	}

	draw() {
		const rows = [this._renderTabs()];
		if (this.showTravel) {
			rows.push(this._renderScrub());
		}
		this.setContent(rows.join("\n"));
		this.screen?.render();
	}
}
