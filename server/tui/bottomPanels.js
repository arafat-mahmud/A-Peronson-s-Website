import blessed from "blessed";
import { roundedBorder } from "./effects.js";
import { COLORS, heatmapRows, sparkline, tag, tagBold } from "./theme.js";

function plain(s) {
	return String(s).replace(/\{[^}]*\}/g, "");
}

const MAX_SAMPLES = 60;

// Bottom telemetry row: LIVE TELEMETRY sparkline | TRAFFIC HEATMAP | SESSION RECORDER
export class BottomPanels extends blessed.box {
	constructor(options) {
		super({
			...options,
			height: 8,
			tags: true,
			mouse: true,
			style: {
				bg: COLORS.panel,
				border: { type: "line", fg: COLORS.border },
			},
			border: roundedBorder(COLORS.border),
			label: " 📡 telemetry ",
		});
		this.stats = null;
		this.heatmap = null;
		this.recState = "IDLE";
		this.samples = { req: [], rate: [] };
		this._zones = [];
		this.onChoose = null;

		this.on("click", (data) => {
			const x = Math.floor(data.x - this.left - 1);
			const y = Math.floor(data.y - this.top - 1);
			for (const z of this._zones) {
				if (y >= z.y && y <= z.y + z.h && x >= z.col && x < z.col + z.width) {
					this.onChoose?.(z.key);
					return;
				}
			}
		});
	}

	setStats(stats) {
		this.stats = stats;
		const req = Number(stats?.reqRate || 0);
		const rate = Number(stats?.rate || 0);
		this.samples.req.push(req);
		this.samples.rate.push(rate);
		if (this.samples.req.length > MAX_SAMPLES) {
			this.samples.req.shift();
		}
		if (this.samples.rate.length > MAX_SAMPLES) {
			this.samples.rate.shift();
		}
		this.draw();
	}

	setHeatmap(hm) {
		this.heatmap = hm;
		this.draw();
	}

	setRecState(state) {
		this.recState = state;
		this.draw();
	}

	_cardWidth(total, i) {
		const telemetryW = Math.floor(total * 0.4);
		const heatmapW = Math.floor(total * 0.34);
		if (i === 0) return telemetryW;
		if (i === 1) return heatmapW;
		return total - telemetryW - heatmapW;
	}

	_telemetryLines(width) {
		const w = Math.max(8, width);
		const rows = [];
		rows.push(
			padVisual(tagBold("#E8EDFF", "LIVE TELEMETRY") + tag("#64748B", " · last 60 sec"), w),
		);
		const spark = sparkline(this.samples.req, { height: 3, width: w }).split("\n");
		for (const line of spark) {
			rows.push(padVisual(tag("#22D3EE", line), w));
		}
		const peak = Math.max(...this.samples.req, 0);
		rows.push(padVisual(tag("#94A3B8", `peak ${peak} req/s`), w));
		rows.push("");
		return rows;
	}

	_heatmapLines(width) {
		const w = Math.max(8, width);
		const rows = [];
		rows.push(
			padVisual(tagBold("#E8EDFF", "TRAFFIC HEATMAP") + tag("#64748B", " · hour density"), w),
		);
		const buckets = this.heatmap?.buckets || [];
		const max = this.heatmap?.max || Math.max(...buckets, 1);
		// 24 buckets → 2 rows of 12 (like HTML .heat grid)
		const cells = [];
		for (let h = 0; h < 24; h++) {
			const v = buckets[h] || 0;
			const frac = v / max;
			cells.push(frac >= 0.8 ? "█" : frac >= 0.5 ? "▓" : frac >= 0.25 ? "▒" : frac > 0 ? "░" : "·");
		}
		const row1 = cells.slice(0, 12).join("");
		const row2 = cells.slice(12, 24).join("");
		rows.push(padVisual(tag("#38BDF8", row1), w));
		rows.push(padVisual(tag("#38BDF8", row2), w));
		rows.push(padVisual(tag("#64748B", "00 02 04 06 08 10 12 14 16 18 20 22"), w));
		rows.push("");
		return rows;
	}

	_recorderLines(width, xOffset) {
		const w = Math.max(8, width);
		const recording = this.recState === "RECORDING";
		const rows = [
			padVisual(tagBold("#E8EDFF", "SESSION RECORDER"), w),
			padVisual(tag("#64748B", "recording state"), w),
			padVisual(tag(recording ? "#FB7185" : "#64748B", this.recState), w),
			padVisual(tag("#38BDF8", " [Last 30 min] "), w),
			padVisual(tag("#38BDF8", " [Last hour] "), w),
			padVisual(tag("#64748B", "──────────────"), w),
		];
		this._zones.push({ key: "record_30", col: xOffset + 1, y: 3, h: 1, width: 14 });
		this._zones.push({ key: "record_60", col: xOffset + 1, y: 4, h: 1, width: 13 });
		return rows;
	}

	draw() {
		this._zones = [];
		const total = Math.max(20, this.width - 2);
		const cols = [this._cardWidth(total, 0), this._cardWidth(total, 1), this._cardWidth(total, 2)];
		const recX = cols[0] + 1 + cols[1] + 1;

		const blocks = [
			this._telemetryLines(cols[0]),
			this._heatmapLines(cols[1]),
			this._recorderLines(cols[2], recX),
		];
		const height = Math.max(3, this.height - 2);
		const rows = [];
		for (let i = 0; i < height; i++) {
			let line = "";
			let cursor = 0;
			for (let c = 0; c < 3; c++) {
				const cell = blocks[c][i] || "";
				line += cell;
				cursor += cols[c];
				if (c < 2) {
					line += "│";
					cursor += 1;
				}
			}
			rows.push(line);
		}
		this.setContent(rows.join("\n"));
		this.screen?.render();
	}
}

function padVisual(tagged, width) {
	const len = plain(tagged).length;
	const pad = Math.max(0, width - len);
	return tagged + " ".repeat(pad);
}

export { padVisual as _padVisual };
