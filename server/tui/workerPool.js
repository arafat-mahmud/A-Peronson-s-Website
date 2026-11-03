import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Worker } from "node:worker_threads";

// ── Worker-thread pool ──────────────────────────────────────────────────────
// Offloads expensive parse/colorize work (e.g. JSON syntax-highlighting large
// payloads, regex scanning) off the TUI's main render thread so the UI stays
// responsive during high-volume streams.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKER_SRC = path.join(__dirname, "parseWorker.js");

export class WorkerPool {
	constructor({
		size = Math.min(4, Math.max(2, os.availableParallelism?.() ?? 2)),
		modulePath = WORKER_SRC,
	} = {}) {
		this.size = size;
		this.workers = [];
		this.idle = [];
		this.queue = [];
		this._nextId = 0;
		this._tasks = new Map();
		this._terminated = false;
		this._init();
	}

	_init() {
		for (let i = 0; i < this.size; i++) {
			this._spawn();
		}
	}

	_spawn() {
		const w = new Worker(WORKER_SRC, { workerData: { id: this._nextId++ } });
		w.on("message", (msg) => {
			const task = this._tasks.get(msg.id);
			this._tasks.delete(msg.id);
			this.idle.push(w);
			if (task) {
				task.resolve(msg.result);
			}
			this._pump();
		});
		w.on("error", () => {
			w.removeAllListeners();
			if (!this._terminated) {
				this._spawn();
			}
		});
		this.idle.push(w);
		this.workers.push(w);
	}

	run(job, payload) {
		return new Promise((resolve, reject) => {
			const id = this._nextId++;
			this._tasks.set(id, { resolve, reject });
			this.queue.push({ id, job, payload });
			this._pump();
		});
	}

	_pump() {
		if (this.queue.length === 0 || this.idle.length === 0) {
			return;
		}
		const w = this.idle.shift();
		const { id, job, payload } = this.queue.shift();
		w.postMessage({ id, job, payload });
	}

	close() {
		this._terminated = true;
		for (const w of this.workers) {
			try {
				w.terminate();
			} catch {
				// ignore
			}
		}
		this.workers = [];
		this.idle = [];
	}
}

// Cached singleton used by the app.
let _pool = null;
export function getWorkerPool() {
	if (!_pool) {
		_pool = new WorkerPool();
	}
	return _pool;
}

export function colorizeJsonAsync(text) {
	const pool = getWorkerPool();
	return pool.run("colorize", { text });
}

export function scanMessagesAsync(entries, pattern) {
	const pool = getWorkerPool();
	return pool.run("scan", { entries, pattern });
}
