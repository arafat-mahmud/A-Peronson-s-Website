import os from "node:os";
import blessed from "blessed";
import { pulseColor } from "./effects.js";
import { COLORS, tag } from "./theme.js";

// ── Animated two-layer status bar ───────────────────────────────────────────
// Row 0: LIVE ● rate | total | err warn crit | req/s | cpu ram | redis | queue
//        | workers | latency | dropped | filtered | regex | clock
// Row 1 (animated): neon sparklines for cpu / mem / requests / latency.

const MAX_SAMPLES = 60;

let lastCpuTimes = null;
function systemSample() {
	const cpus = os.cpus?.();
	let cpu = 0;
	if (cpus && cpus.length) {
		const now = cpus.map((c) => c.times);
		if (lastCpuTimes) {
			let idle = 0;
			let total = 0;
			for (let i = 0; i < now.length; i++) {
				const prev = lastCpuTimes[i];
				if (!prev) {
					continue;
				}
				const dIdle = (now[i].idle || 0) - (prev.idle || 0);
				const dTotal =
					(now[i].user || 0) -
					(prev.user || 0) +
					((now[i].nice || 0) - (prev.nice || 0)) +
					((now[i].sys || 0) - (prev.sys || 0)) +
					dIdle +
					((now[i].irq || 0) - (prev.irq || 0));
				idle += Math.max(0, dIdle);
				total += Math.max(0, dTotal);
			}
			cpu = total > 0 ? (1 - idle / total) * 100 : 0;
		}
		lastCpuTimes = now;
	} else {
		const load = os.loadavg?.[0] ?? 0;
		const cores = Math.max(os.cpus()?.length || 1, 1);
		cpu = Math.max(0, Math.min(100, (load / cores) * 100));
	}
	const total = Number(os.totalmem?.() || 0);
	const free = Number(os.freemem?.() || 0);
	const mem = total > 0 ? ((total - free) / total) * 100 : 0;
	return { cpu: Math.min(100, cpu), mem };
}

function fmtLatency(ms) {
	if (ms === null || ms === undefined || Number.isNaN(Number(ms))) {
		return "-";
	}
	const n = Number(ms);
	return n < 1000 ? `${n.toFixed(0)}ms` : `${(n / 1000).toFixed(1)}s`;
}

function stripTags(s) {
	return String(s || "")
		.replace(/\{\/?[#\w-]+\}/g, "")
		.replace(/\{bold\}|\{\/bold\}/g, "");
}

export class StatusBar extends blessed.box {
	constructor(options) {
		super({
			...options,
			height: 1,
			tags: true,
			style: { bg: COLORS.panel },
		});
		this.lastStats = null;
		this.samples = { cpu: [], mem: [], req: [], lat: [] };
		this._tick = 0;
		this._pulse = 0;
		this._sampling = setInterval(() => this._sample(), 1000);
		this._clock = setInterval(() => this.draw(), 1000);
		this._anim = setInterval(() => this._animate(), options.animMs || 400);
	}

	setStats(stats) {
		this.lastStats = stats;
		this.draw();
	}

	_sample() {
		const sys = systemSample();
		this.samples.cpu.push(Math.round(sys.cpu));
		this.samples.mem.push(Math.round(sys.mem));
		this.samples.req.push(this.lastStats?.reqRate || 0);
		this.samples.lat.push(this.lastStats?.avgLatency ?? this.lastStats?.p95 ?? 0);
		for (const k of Object.keys(this.samples)) {
			if (this.samples[k].length > MAX_SAMPLES) {
				this.samples[k].shift();
			}
		}
		this._tick += 1;
		this.draw();
	}

	// Animate the LIVE dot (breathing pulse) independently of the 1s stat clock.
	_animate() {
		if (this.hidden || !this.screen) {
			return;
		}
		this._pulse = (this._pulse + 0.35) % (Math.PI * 2);
		const live = this.lastStats?.paused ? "#F43F5E" : pulseColor("#34D399", this._pulse, 46);
		this._liveTag = `{${live}-fg}●{/} {bold}{${live}-fg}${
			this.lastStats?.paused ? "PAUSED" : "LIVE"
		}{/bold}{/}`;
		this.draw();
	}

	draw() {
		const s = this.lastStats || {
			rate: 0,
			reqRate: 0,
			total: 0,
			byLevel: {},
			dropped: 0,
			filtered: 0,
			workQ: 0,
			workers: 0,
			redis: "?",
			activeRecorder: false,
			uptime: 0,
		};
		const parts = [];
		parts.push(this._liveTag ?? tag("#34D399", "● LIVE"));
		parts.push(tag("#38BDF8", `${s.rate} logs/s`));
		parts.push(tag("#E2E8F0", `total ${(s.total || 0).toLocaleString()}`));
		parts.push(tag("#64748B", "│"));
		parts.push(tag("#FB7185", `err ${s.byLevel.error || 0}`));
		parts.push(tag("#FBBF24", `warn ${s.byLevel.warn || 0}`));
		parts.push(tag("#C084FC", `crit ${s.byLevel.critical || 0}`));
		parts.push(tag("#64748B", "│"));
		const cpu = this.samples.cpu.at(-1) ?? 0;
		const mem = this.samples.mem.at(-1) ?? 0;
		parts.push(tag("#A3E635", `cpu ${cpu.toFixed(0)}%`));
		parts.push(tag("#34D399", `ram ${mem.toFixed(0)}%`));
		parts.push(tag("#F472B6", `redis ${s.redis === "connected" ? "● Connected" : s.redis || "?"}`));
		parts.push(tag("#FBBF24", `q ${s.workQ ?? 0}`));
		parts.push(tag("#38BDF8", `w ${s.workers ?? 0}`));
		parts.push(tag("#94A3B8", `lat ${fmtLatency(s.avgLatency)}`));
		parts.push(tag("#FB7185", `drop ${s.dropped ?? 0}`));
		parts.push(tag("#64748B", `filt ${s.filtered ?? 0}`));
		parts.push(tag("#22D3EE", `re ${s.regexHits ?? 0}`));
		if (s.activeRecorder) {
			parts.push(tag("#F43F5E", "● REC"));
		}
		parts.push(tag("#94A3B8", new Date().toTimeString().slice(0, 8)));

		const maxW = Math.max(20, this.width - 2);
		let line = "";
		for (const p of parts) {
			const candidate = line === "" ? p : `${line} │ ${p}`;
			if (stripTags(candidate).length > maxW) {
				break;
			}
			line = candidate;
		}
		// right-aligned shortcut hints (HTML .status spacer)
		const hints =
			" / search · space pause · f follow · j/k nav · enter expand · tab panels · ? help";
		const hintTag = tag("#596580", hints);
		const hintLen = stripTags(hintTag).length;
		const gap = Math.max(1, maxW - stripTags(line).length - hintLen);
		line += " ".repeat(gap) + hintTag;

		this.setContent(line);
		this.screen?.render();
	}

	destroy() {
		clearInterval(this._sampling);
		clearInterval(this._clock);
		clearInterval(this._anim);
		super.destroy();
	}
}

export function fmtLatencyExported(ms) {
	return fmtLatency(ms);
}
