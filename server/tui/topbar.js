import blessed from "blessed";
import { COLORS, tag } from "./theme.js";

function plain(s) {
	return String(s).replace(/\{[^}]*\}/g, "");
}

const BTN_DEFS = [
	{ key: "record", color: "#F43F5E", label: "REC" },
	{ key: "pause", color: "#FBBF24", label: "Pause" },
	{ key: "follow", color: "#38BDF8", label: "Follow" },
	{ key: "glow", color: "#A855F7", label: "Glow" },
];

export class TopBar extends blessed.box {
	constructor(options) {
		super({
			...options,
			height: 1,
			tags: true,
			mouse: true,
			style: { bg: COLORS.panel },
		});
		this.rec = false;
		this.paused = false;
		this.follow = true;
		this.glow = true;
		this.online = true;
		this.cool = false;
		this._zones = [];
		this._pulse = 0;
		this.onAction = null;
		this._anim = setInterval(() => this._breathe(), options.animMs || 400);

		this.on("click", (data) => {
			const col = Math.floor(data.x - this.left);
			for (const z of this._zones) {
				if (col >= z.col && col < z.col + z.width) {
					this.onAction?.(z.key);
					return;
				}
			}
		});
	}

	_breathe() {
		if (this.hidden || !this.screen) {
			return;
		}
		this._pulse += 0.35;
		this.draw();
	}

	setOnline(v) {
		this.online = !!v;
		this.draw();
	}

	setRec(v) {
		this.rec = !!v;
		this.draw();
	}

	setPaused(v) {
		this.paused = !!v;
		this.draw();
	}

	setFollow(v) {
		this.follow = !!v;
		this.draw();
	}

	setGlow(v) {
		this.glow = !!v;
		this.draw();
	}

	setCool(v) {
		this.cool = !!v;
		this.draw();
	}

	draw() {
		const w = Math.max(20, this.width - 2);
		const brand = "{#8B5CF6-fg}{bold}NEON//OBSERVE{/bold}{/}";
		const sub = tag("#7F8AA8", " SERVER LOG OBSERVATORY");
		const dot = this.online ? "{#34D399-fg}●{/}" : "{#F43F5E-fg}○{/}";
		const pill = this.online
			? ` ${dot} {bold}{#34D399-fg}SERVER ONLINE{/bold}{/}`
			: ` ${dot} {bold}{#F43F5E-fg}SERVER OFFLINE{/bold}{/}`;
		const pillDim = tag("#65738F", " · backend/");
		const coolBadge = this.cool ? tag("#22D3EE", " ✦ COOL") : "";
		const left = `${brand}${sub}${pill}${pillDim}${coolBadge}`;
		const leftLen = plain(left).length;

		const zones = [];
		let btnTag = "";
		let btnPlain = 0;
		for (const b of BTN_DEFS) {
			const active =
				(b.key === "record" && this.rec) ||
				(b.key === "pause" && this.paused) ||
				(b.key === "follow" && !this.follow) ||
				(b.key === "glow" && !this.glow);
			let txt;
			if (b.key === "record") {
				txt = this.rec ? "● REC ON" : "● REC";
			} else if (b.key === "pause") {
				txt = this.paused ? "▶ Resume" : "⏸ Pause";
			} else if (b.key === "follow") {
				txt = this.follow ? "⌄ Follow" : "⌃ Unfollow";
			} else {
				txt = this.glow ? "◐ Glow" : "◑ Glow";
			}
			const styled = active
				? ` {${b.color}-bg}{black-fg} ${txt} {/black-fg}{/${b.color}-bg} `
				: tag(b.color, ` ${txt} `);
			zones.push({ key: b.key, col: leftLen + btnPlain, width: plain(styled).length });
			btnTag += styled;
			btnPlain += plain(styled).length;
		}
		const pad = Math.max(1, w - leftLen - btnPlain);
		this._zones = zones.map((z) => ({ ...z, col: z.col + pad }));
		this.setContent(left + " ".repeat(pad) + btnTag);
		this.screen?.render();
	}

	destroy() {
		clearInterval(this._anim);
		super.destroy();
	}
}
