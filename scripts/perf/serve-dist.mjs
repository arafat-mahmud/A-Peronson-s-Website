#!/usr/bin/env node
// Lab server for performance and browser checks of a production build:
// serves <dist> with Brotli (as the production CDN does) and proxies /api,
// /uploads, /ws and /health to the API on API_PORT (default 4000).
// Usage: node scripts/perf/serve-dist.mjs <distDir> [port]
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import zlib from "node:zlib";

const root = path.resolve(process.argv[2] || "dist");
const port = Number(process.argv[3] || 4173);
const apiPort = Number(process.env.API_PORT || 4000);
const TYPES = {
	".js": "application/javascript",
	".css": "text/css",
	".html": "text/html; charset=utf-8",
	".svg": "image/svg+xml",
	".png": "image/png",
	".webp": "image/webp",
	".woff2": "font/woff2",
	".json": "application/json",
	".ico": "image/x-icon",
};
const cache = new Map();
const isApi = (p) =>
	p.startsWith("/api") || p.startsWith("/uploads") || p.startsWith("/ws") || p === "/health";
process.on("uncaughtException", (error) =>
	console.error("serve-dist:", error.code || error.message),
);

const server = http.createServer((req, res) => {
	req.on("error", () => {});
	res.on("error", () => {});
	const url = new URL(req.url, "http://localhost");
	if (isApi(url.pathname)) {
		const upstream = http.request(
			{ host: "127.0.0.1", port: apiPort, path: req.url, method: req.method, headers: req.headers },
			(r) => {
				res.writeHead(r.statusCode, r.headers);
				r.pipe(res);
			},
		);
		upstream.on("error", () => {
			if (!res.headersSent) res.writeHead(502);
			res.end();
		});
		req.pipe(upstream);
		return;
	}
	let file = path.join(root, decodeURIComponent(url.pathname));
	if (!(file.startsWith(root) && fs.existsSync(file)) || fs.statSync(file).isDirectory()) {
		if (path.extname(url.pathname)) {
			res.writeHead(404);
			return res.end();
		}
		file = path.join(root, "index.html");
	}
	const type = TYPES[path.extname(file)] || "application/octet-stream";
	let body = cache.get(file) || fs.readFileSync(file);
	cache.set(file, body);
	const headers = {
		"Content-Type": type,
		"Cache-Control": url.pathname.startsWith("/assets/")
			? "public, max-age=31536000, immutable"
			: "no-cache",
	};
	if (
		/text|javascript|json|svg/u.test(type) &&
		String(req.headers["accept-encoding"] || "").includes("br")
	) {
		const key = `${file}:br`;
		if (!cache.has(key)) {
			cache.set(
				key,
				zlib.brotliCompressSync(body, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 5 } }),
			);
		}
		body = cache.get(key);
		headers["Content-Encoding"] = "br";
	}
	res.writeHead(200, headers);
	res.end(body);
});

server.on("upgrade", (req, socket, head) => {
	socket.on("error", () => {});
	const upstream = net.connect(apiPort, "127.0.0.1", () => {
		const lines = Object.entries(req.headers).map(([k, v]) => `${k}: ${v}`);
		upstream.write(`${req.method} ${req.url} HTTP/1.1\r\n${lines.join("\r\n")}\r\n\r\n`);
		upstream.write(head);
		socket.pipe(upstream).pipe(socket);
	});
	upstream.on("error", () => socket.destroy());
});

server.listen(port, () => console.log(`serving ${root} on http://localhost:${port}`));
