import blessed from "blessed";
import { roundedBorder } from "./effects.js";
import { COLORS, tag, tagBold } from "./theme.js";

function plain(s) {
	return String(s).replace(/\{[^}]*\}/g, "");
}

function padVisual(tagged, width) {
	const len = plain(tagged).length;
	const pad = Math.max(0, width - len);
	return tagged + " ".repeat(pad);
}

function truncatePlain(s, max) {
	const str = String(s || "");
	return str.length <= max ? str : `${str.slice(0, Math.max(0, max - 1))}…`;
}

// Hero + INFO / WARN / ERROR / REQ-SEC metric cards, one horizontal strip.
export class Overview extends blessed.box {
	constructor(options) {
		super({
			...options,
			height: 5,
			tags: true,
			style: {
				bg: COLORS.panel,
				border: { type: "line", fg: COLORS.border },
			},
			border: roundedBorder(COLORS.border),
			label: " 📊 overview ",
		});
		this.stats = null;
	}

	setStats(stats) {
		this.stats = stats;
		this.draw();
	}

	_metricLines(card, width) {
		return [
			padVisual(tag("#64748B", card.label), width),
			padVisual(tagBold(card.color, card.value), width),
			padVisual(tag("#34D399", card.em), width),
		];
	}

	_heroLines(width) {
		return [
			padVisual(tag("#22D3EE", "LIVE OBSERVABILITY"), width),
			padVisual(tagBold("#E8EDFF", "Backend / server logs"), width),
			padVisual(
				tag(
					"#7F8AA8",
					truncatePlain("canonical logger · requests · audit · syslog · workers", width),
				),
				width,
			),
		];
	}

	draw() {
		const s = this.stats || { byLevel: {}, reqRate: 0 };
		const byLevel = s.byLevel || {};
		const fmt = (n) => Number(n || 0).toLocaleString();

		const totalWidth = Math.max(20, this.width - 2);
		// hero ~1.6x, then 4 metrics
		const heroW = Math.floor(totalWidth * 0.32);
		const each = Math.max(6, Math.floor((totalWidth - heroW) / 4));

		const hero = this._heroLines(heroW);
		const cards = [
			this._metricLines(
				{ label: "INFO", value: fmt(byLevel.info ?? 0), em: "live", color: "#38BDF8" },
				each,
			),
			this._metricLines(
				{ label: "WARN", value: fmt(byLevel.warn ?? 0), em: "stable", color: "#FBBF24" },
				each,
			),
			this._metricLines(
				{ label: "ERROR", value: fmt(byLevel.error ?? 0), em: "live", color: "#FB7185" },
				each,
			),
			this._metricLines(
				{ label: "REQ / SEC", value: String(s.reqRate || 0), em: "live", color: "#22D3EE" },
				each,
			),
		];

		const join = " │ ";
		const rows = [];
		for (let i = 0; i < 3; i++) {
			let line = hero[i];
			for (const c of cards) {
				line += join + c[i];
			}
			rows.push(line);
		}
		this.setContent(rows.join("\n"));
		this.screen?.render();
	}
}

export { padVisual, plain as _plain };
