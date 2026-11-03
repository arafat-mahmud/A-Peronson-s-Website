import http from "node:http";
import { WebSocketServer } from "ws";
import { logInfo, logWarn } from "../utils/logger.js";
import { summarizeBurst } from "./burst.js";
import { formatConsoleEntry, formatStatsLine } from "./format.js";
import { logHub } from "./logHub.js";

const LOG_WS_PATH = "/ws/logs";
const LOG_API_PREFIX = "/api/logs";

let wsServer = null;
let httpServer = null;
let heartbeat = null;
const clients = new Set();

function send(socket, payload) {
	if (socket.readyState === socket.OPEN) {
		socket.send(JSON.stringify(payload));
	}
}

function broadcast(payload) {
	for (const client of clients) {
		try {
			send(client, payload);
		} catch {
			// drop
		}
	}
}

function handleMessage(socket, raw) {
	let payload;
	try {
		payload = JSON.parse(String(raw || ""));
	} catch {
		return;
	}
	const type = payload?.type;
	if (type === "snapshot") {
		send(socket, { type: "snapshot", ...logHub.snapshot() });
		return;
	}
	if (type === "query") {
		const entries = logHub.query(payload?.query || {});
		send(socket, { type: "query_result", query: payload?.query || {}, entries });
		return;
	}
	if (type === "stats") {
		send(socket, { type: "stats", stats: logHub.getStats() });
		return;
	}
	if (type === "bookmark") {
		const ok = logHub.bookmark(payload?.id);
		send(socket, { type: "bookmark_ok", id: payload?.id, bookmarked: ok });
		return;
	}
	if (type === "pin") {
		logHub.pin(payload?.id);
		send(socket, { type: "pin_ok", id: payload?.id });
		return;
	}
	if (type === "ignore") {
		logHub.addIgnore(payload?.pattern);
		send(socket, { type: "ignore_ok", pattern: payload?.pattern });
		return;
	}
	if (type === "record_start") {
		logHub.startRecording(payload || {});
		send(socket, { type: "recorder", active: true });
		return;
	}
	if (type === "record_stop") {
		const result = logHub.stopRecording();
		send(socket, { type: "record_stop_ok", ...result });
		return;
	}
	if (type === "request_flow") {
		const flow = logHub.requestFlow(payload?.requestId);
		send(socket, { type: "request_flow_ok", requestId: payload?.requestId, entries: flow });
		return;
	}
	if (type === "heatmap") {
		send(socket, { type: "heatmap", ...logHub.getHeatmap() });
		return;
	}
	if (type === "burst") {
		send(socket, {
			type: "burst",
			...summarizeBurst({ ...(payload || {}), entries: logHub.entries }),
		});
		return;
	}
	if (type === "clear") {
		logHub.clear();
		send(socket, { type: "clear_ok" });
	}
}

function onConnection(socket) {
	clients.add(socket);
	send(socket, { type: "hello", message: "log-stream-connected" });
	send(socket, { type: "snapshot", ...logHub.snapshot() });

	socket.on("message", (raw) => handleMessage(socket, raw));
	socket.on("close", () => clients.delete(socket));
	socket.on("error", () => clients.delete(socket));
}

export function startLogTransport(server) {
	if (httpServer) {
		return wsServer;
	}
	httpServer = server;

	wsServer = new WebSocketServer({ noServer: true });

	server.prependListener("upgrade", (req, socket, head) => {
		let pathname = "";
		try {
			pathname = new URL(req.url || "/", "http://localhost").pathname;
		} catch {
			return;
		}
		if (pathname === LOG_WS_PATH) {
			wsServer.handleUpgrade(req, socket, head, (ws) => {
				wsServer.emit("connection", ws, req);
			});
		}
	});

	wsServer.on("connection", onConnection);

	heartbeat = setInterval(() => {
		broadcast({ type: "stats", stats: logHub.getStats() });
	}, 1000);
	if (heartbeat.unref) {
		heartbeat.unref();
	}

	logHub.on("entry", (entry) => {
		broadcast({ type: "entry", entry });
	});
	logHub.on("group", (entry) => {
		broadcast({ type: "group", entry });
	});

	logInfo(`Log transport listening on ${LOG_WS_PATH} (${clients.size} clients)`);
	return wsServer;
}

export function registerLogHttp(app) {
	app.get(`${LOG_API_PREFIX}/live`, (req, res) => {
		const entries = logHub.query({ limit: Number(req.query.limit || 200) });
		res.json({ ok: true, entries, stats: logHub.getStats() });
	});

	app.get(`${LOG_API_PREFIX}/stats`, (req, res) => {
		res.json({ ok: true, stats: logHub.getStats() });
	});

	app.get(`${LOG_API_PREFIX}/query`, (req, res) => {
		const query = {
			level: req.query.level,
			category: req.query.category,
			q: req.query.q,
			requestId: req.query.request_id,
			from: req.query.from,
			to: req.query.to,
			limit: Number(req.query.limit || 500),
		};
		res.json({ ok: true, entries: logHub.query(query) });
	});

	app.get(`${LOG_API_PREFIX}/heatmap`, (req, res) => {
		res.json({ ok: true, ...logHub.getHeatmap() });
	});

	app.get(`${LOG_API_PREFIX}/burst`, (req, res) => {
		res.json({
			ok: true,
			...summarizeBurst({
				windowMs: Number(req.query.window || 60_000),
				minEvents: Number(req.query.min || 3),
				entries: logHub.entries,
			}),
		});
	});

	app.get(`${LOG_API_PREFIX}/export`, (req, res) => {
		const entries = logHub.query({ limit: 10_000 });
		const lines = entries.map(
			(e) =>
				`[${e.ts}] [${e.level.toUpperCase()}] [${e.category}] ${e.message}${e.data ? ` ${JSON.stringify(e.data)}` : ""}`,
		);
		res.type("text/plain").send(lines.join("\n"));
	});

	app.get(`${LOG_API_PREFIX}/bookmarks`, (req, res) => {
		res.json({ ok: true, bookmarks: logHub.getBookmarks() });
	});

	app.post(`${LOG_API_PREFIX}/bookmark`, (req, res) => {
		const ok = logHub.bookmark(req.body?.id);
		res.json({ ok: true, bookmarked: ok });
	});

	app.get(`${LOG_API_PREFIX}/session/start`, (req, res) => {
		logHub.startRecording({ windowMs: Number(req.query.window || 0) });
		res.json({ ok: true, active: true });
	});

	app.get(`${LOG_API_PREFIX}/session/stop`, (req, res) => {
		const result = logHub.stopRecording();
		res.json({ ok: true, ...result });
	});
}

export function stopLogTransport() {
	if (heartbeat) {
		clearInterval(heartbeat);
		heartbeat = null;
	}
	for (const client of clients) {
		try {
			client.close();
		} catch {
			// ignore
		}
	}
	clients.clear();
	if (wsServer) {
		try {
			wsServer.close();
		} catch {
			// ignore
		}
		wsServer = null;
	}
	if (httpServer) {
		httpServer = null;
	}
}
