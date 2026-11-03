import blessed from "blessed";
import {
	barline,
	COLORS,
	heatmapRows,
	levelColor,
	levelIcon,
	sparkline,
	tag,
	tagBold,
} from "./theme.js";

export class MetricsPanel extends blessed.box {
	constructor(options) {
		super({
			...options,
			tags: true,
			style: { bg: COLORS.panel },
		});
		this.stats = null;
		this.interval = setInterval(() => this.draw(), 1000);
	}

	setStats(stats) {
		this.stats = stats;
		this.draw();
	}

	draw() {
		const s = this.stats || { byLevel: {}, total: 0, rate: 0, reqRate: 0, byCategory: {} };
		const lines = [];
		lines.push("{bold}{#38BDF8-fg}📊 METRICS{/bold}{/}");
		lines.push("");
		lines.push(
			`  ℹ {#38BDF8-fg}INFO{/}       {#E2E8F0-fg}${(s.byLevel.info || 0).toLocaleString()}{/}`,
		);
		lines.push(
			`  🐞 {#22D3EE-fg}DEBUG{/}      {#E2E8F0-fg}${(s.byLevel.debug || 0).toLocaleString()}{/}`,
		);
		lines.push(
			`  ✔ {#34D399-fg}SUCCESS{/}    {#E2E8F0-fg}${(s.byLevel.success || 0).toLocaleString()}{/}`,
		);
		lines.push(
			`  ⚠ {#FBBF24-fg}WARN{/}       {#E2E8F0-fg}${(s.byLevel.warn || 0).toLocaleString()}{/}`,
		);
		lines.push(
			`  ✖ {#FB7185-fg}ERROR{/}      {#E2E8F0-fg}${(s.byLevel.error || 0).toLocaleString()}{/}`,
		);
		lines.push(
			`  ⛔ {#C084FC-fg}CRITICAL{/}   {#E2E8F0-fg}${(s.byLevel.critical || 0).toLocaleString()}{/}`,
		);
		lines.push("");
		lines.push(`  {#22D3EE-fg}REQ/s{/}   {#E2E8F0-fg}${s.reqRate || 0}{/}`);
		lines.push(`  {#38BDF8-fg}Rate{/}    {#E2E8F0-fg}${s.rate || 0} logs/s{/}`);
		lines.push(`  {#94A3B8-fg}Total{/}   {#E2E8F0-fg}${(s.total || 0).toLocaleString()}{/}`);
		lines.push("");
		lines.push(
			`  {#F472B6-fg}Redis{/}    {#E2E8F0-fg}${s.redis === "connected" ? "Connected ●" : s.redis || "…"}{/}`,
		);
		lines.push(`  {#38BDF8-fg}Workers{/}  {#E2E8F0-fg}${s.workers || 0}{/}`);
		lines.push(`  {#FBBF24-fg}Queue{/}    {#E2E8F0-fg}${s.workQ || 0}{/}`);
		lines.push("");
		lines.push(`  {#FB7185-fg}Dropped{/} {#E2E8F0-fg}${s.dropped || 0}{/}`);
		lines.push(`  {#94A3B8-fg}Filtered{/}{#E2E8F0-fg} ${s.filtered || 0}{/}`);
		lines.push(`  {#22D3EE-fg}Regex{/}   {#E2E8F0-fg}${s.regexHits || 0}{/}`);
		lines.push("");
		lines.push("  {#A3E635-fg}req spark{/}");
		const spark = sparkline(s.lastReqs || [0], { height: 3, width: 34 });
		for (const line of spark.split("\n")) {
			lines.push(`  {#22D3EE-fg}${line}{/}`);
		}
		lines.push("");
		lines.push("  {#38BDF8-fg}rate spark{/}");
		const rateSpark = sparkline(s.lastRates || [0], { height: 3, width: 34 });
		for (const line of rateSpark.split("\n")) {
			lines.push(`  {#38BDF8-fg}${line}{/}`);
		}
		this.setContent(lines.join("\n"));
		this.screen?.render();
	}

	destroy() {
		clearInterval(this.interval);
		super.destroy();
	}
}

export class TimelinePanel extends blessed.box {
	constructor(options) {
		super({
			...options,
			tags: true,
			style: { bg: COLORS.panel },
		});
		this.stats = null;
		this._renderedRows = [];
		this.on("click", (data) => {
			const row = Math.floor(data.y - this.top - 1) - 2;
			if (row >= 0 && row < this._renderedRows.length) {
				this.onSpike?.(this._renderedRows[row]);
			}
		});
	}

	setStats(stats) {
		this.stats = stats;
		this.draw();
	}

	draw() {
		const s = this.stats;
		const lines = [];
		lines.push("{bold}{#38BDF8-fg}📈 TIMELINE{/bold}{/}");
		lines.push("");
		this._renderedRows = [];
		if (s && s.recent) {
			const order = ["info", "success", "debug", "warn", "error", "critical"];
			for (const level of order) {
				const item = s.recent.find((r) => r.level === level);
				if (!item) {
					continue;
				}
				this._renderedRows.push(level);
				const count = item.count || 0;
				const color = levelColor(level);
				const width = 30;
				const bars = Math.min(
					width,
					Math.max(1, Math.round((count / Math.max(s.rate, 1)) * width) + (count > 0 ? 1 : 0)),
				);
				const bar = "█".repeat(Math.min(width, bars));
				lines.push(
					`  ${levelIcon(level)} {#64748B-fg}${level.toUpperCase().padEnd(8)}{/} {${color}-fg}${bar}{/} {#94A3B8-fg}${count}{/}`,
				);
			}
		} else {
			lines.push("  {gray-fg}collecting…{/}");
		}
		this.setContent(lines.join("\n"));
		this.screen?.render();
	}
}

export class LatencyHistogramPanel extends blessed.box {
	constructor(options) {
		super({
			...options,
			tags: true,
			style: { bg: COLORS.panel },
		});
		this.buckets = [];
		this.stats = null;
		this._labels = [1, 5, 10, 50, 100, 500, 1000, 2000, 9999];
		this.on("click", (data) => {
			const row = Math.floor(data.y - this.top - 1) - 5;
			if (row >= 0 && row < this.buckets.length) {
				this.onSpike?.({ bucket: this.buckets[row].ms, count: this.buckets[row].count });
			}
		});
	}

	setLatencies(buckets) {
		this.buckets = this._toBuckets(buckets);
		this.draw();
	}

	setStats(stats) {
		this.stats = stats;
		if (Array.isArray(stats?.histogram)) {
			this.buckets = stats.histogram.map((h, i) => {
				const label = this._labels[i] ?? h?.ms ?? i;
				return {
					ms: typeof h === "object" ? (label ?? i) : label,
					count: typeof h === "object" ? h.count || 0 : Number(h) || 0,
				};
			});
		} else {
			this.buckets = this._toBuckets(stats?.latencies);
		}
		this.draw();
	}

	_toBuckets(buckets) {
		if (!buckets) {
			return [];
		}
		if (Array.isArray(buckets)) {
			return buckets.map((h, i) => ({ ms: h.ms ?? this._labels[i] ?? i, count: h.count || 0 }));
		}
		return Object.entries(buckets).map(([k, v]) => {
			const ms = Number(k);
			return { ms: Number.isFinite(ms) ? ms : 0, count: Number(v) || 0 };
		});
	}

	_labelFor(ms) {
		if (ms < 1) return "<1ms";
		if (ms < 5) return "<5ms";
		if (ms < 10) return "<10ms";
		if (ms < 50) return "<50ms";
		if (ms < 100) return "<100ms";
		if (ms < 500) return "<500ms";
		if (ms < 1000) return "<1000ms";
		if (ms < 2000) return "<2000ms";
		return ">2s";
	}

	draw() {
		const s = this.stats || {};
		const lines = [];
		lines.push("{bold}{#38BDF8-fg}📊 LATENCY HISTOGRAM{/bold}{/}");
		lines.push("");
		lines.push(
			`  {#A3E635-fg}p50: ${s.p50 ?? "-"}{/}   {#FBBF24-fg}p95: ${s.p95 ?? "-"}{/}   {#FB7185-fg}p99: ${s.p99 ?? "-"}{/}`,
		);
		lines.push("");
		if (!this.buckets.length) {
			lines.push("  {gray-fg}collecting…{/}");
			this.setContent(lines.join("\n"));
			this.screen?.render();
			return;
		}
		const max = Math.max(...this.buckets.map((b) => b.count), 1);
		const barWidth = Math.max(4, Math.min(30, this.width - 26));
		for (const b of this.buckets) {
			const frac = b.count / max;
			const bar = "█".repeat(Math.max(1, Math.round(frac * barWidth)));
			lines.push(
				`  {#64748B-fg}${this._labelFor(b.ms).padEnd(8)}{/} {#38BDF8-fg}${bar.padEnd(barWidth)}{/} {#94A3B8-fg}${b.count}{/}`,
			);
		}
		this.setContent(lines.join("\n"));
		this.screen?.render();
	}
}

export class HeatmapPanel extends blessed.box {
	constructor(options) {
		super({
			...options,
			tags: true,
			style: { bg: COLORS.panel },
		});
		this.heatmap = null;
	}

	setHeatmap(hm) {
		this.heatmap = hm;
		this.draw();
	}

	draw() {
		const lines = [];
		lines.push("{bold}{#38BDF8-fg}🌡 HEATMAP{/bold}{/}");
		lines.push("");
		if (this.heatmap) {
			const rows = heatmapRows(this.heatmap.buckets, { max: this.heatmap.max });
			for (const row of rows.split("\n")) {
				lines.push(`  {#38BDF8-fg}${row}{/}`);
			}
		} else {
			lines.push("  {gray-fg}collecting…{/}");
		}
		this.setContent(lines.join("\n"));
		this.screen?.render();
	}
}
