import { EventEmitter } from "node:events";

export class LogWsClient extends EventEmitter {
	constructor({ url } = {}) {
		super();
		this.url = url;
		this.ws = null;
		this.reconnectDelay = 1500;
		this.closed = false;
		this.stats = null;
		this.entries = [];
		this.maxEntries = Number.parseInt(process.env.TUI_BUFFER || "20000", 10);
	}

	get connected() {
		return !!this.ws && this.ws.readyState === 1;
	}

	connect() {
		this.closed = false;
		const WebSocket = globalThis.WebSocket;
		if (!WebSocket) {
			throw new Error(
				"No global WebSocket — run with Node 22+ (--experimental-websocket) or provide a ws polyfill",
			);
		}
		try {
			this.ws = new WebSocket(this.url);
		} catch (err) {
			this.emit("error", err);
			this._scheduleReconnect();
			return;
		}
		this.ws.onopen = () => {
			this.reconnectDelay = 1500;
			this.emit("connected");
			this.ws.send(JSON.stringify({ type: "snapshot" }));
		};
		this.ws.onmessage = (event) => {
			let msg;
			try {
				msg = JSON.parse(String(event.data || ""));
			} catch {
				return;
			}
			this._handle(msg);
		};
		this.ws.onerror = (err) => {
			this.emit("error", err);
		};
		this.ws.onclose = () => {
			this.emit("disconnected");
			this._scheduleReconnect();
		};
	}

	_scheduleReconnect() {
		if (this.closed) {
			return;
		}
		setTimeout(() => this.connect(), this.reconnectDelay);
		this.reconnectDelay = Math.min(this.reconnectDelay * 1.6, 15_000);
	}

	_handle(msg) {
		if (msg.type === "entry") {
			this.entries.push(msg.entry);
			if (this.entries.length > this.maxEntries) {
				this.entries.splice(0, this.entries.length - this.maxEntries);
			}
			this.emit("entry", msg.entry);
			return;
		}
		if (msg.type === "group") {
			this.entries.push(msg.entry);
			if (this.entries.length > this.maxEntries) {
				this.entries.splice(0, this.entries.length - this.maxEntries);
			}
			this.emit("entry", msg.entry);
			return;
		}
		if (msg.type === "stats") {
			this.stats = msg.stats;
			this.emit("stats", msg.stats);
			return;
		}
		if (msg.type === "snapshot") {
			this.entries = msg.entries || this.entries;
			this.stats = msg.stats || this.stats;
			this.emit("snapshot", msg);
			return;
		}
		if (msg.type === "hello") {
			this.emit("hello", msg);
			return;
		}
		if (msg.type === "bookmark_ok") {
			this.emit("bookmark_ok", msg);
			return;
		}
		if (msg.type === "request_flow_ok") {
			this.emit("request_flow", msg);
			return;
		}
		if (msg.type === "burst") {
			this.emit("burst", msg);
			return;
		}
		if (msg.type === "query_result") {
			this.emit("query_result", msg);
			return;
		}
		if (msg.type === "heatmap") {
			this.emit("heatmap", msg);
			return;
		}
		if (msg.type === "recorder") {
			this.emit("recorder", msg);
			return;
		}
		if (msg.type === "record_stop_ok") {
			this.emit("record_stop", msg);
			return;
		}
		if (msg.type === "clear_ok") {
			this.emit("clear_ok", msg);
			return;
		}
		this.emit("message", msg);
	}

	send(type, payload = {}) {
		if (!this.ws || this.ws.readyState !== 1) {
			return;
		}
		try {
			this.ws.send(JSON.stringify({ type, ...payload }));
		} catch {
			// ignore
		}
	}

	query(query = {}) {
		this.send("query", { query });
	}

	bookmark(id) {
		this.send("bookmark", { id });
	}

	pin(id) {
		this.send("pin", { id });
	}

	requestFlow(requestId) {
		this.send("request_flow", { requestId });
	}

	heatmap() {
		this.send("heatmap");
	}

	recordStart(payload = {}) {
		this.send("record_start", payload);
	}

	recordStop() {
		this.send("record_stop");
	}

	clear() {
		this.send("clear");
	}

	close() {
		this.closed = true;
		if (this.ws) {
			const ws = this.ws;
			ws.onopen = null;
			ws.onmessage = null;
			ws.onerror = null;
			ws.onclose = null;
			try {
				ws.close();
			} catch {
				// ignore
			}
		}
	}
}
