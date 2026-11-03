import { requestLogWriter } from "../log/requestLogWriter.js";

const MAX_BODY_BYTES = 1024 * 100;
const SENSITIVE_HEADERS = new Set(["authorization", "cookie", "set-cookie", "x-api-key"]);

function redactHeaders(headers) {
	const out = {};
	for (const [key, value] of Object.entries(headers)) {
		if (SENSITIVE_HEADERS.has(key.toLowerCase())) {
			out[key] = "[redacted]";
		} else {
			out[key] = value;
		}
	}
	return out;
}

function parseUrl(url) {
	try {
		const u = new URL(url, "http://localhost");
		const parts = u.hostname.split(".");
		const subdomain = parts.length > 2 ? parts.slice(0, -2).join(".") : "";
		return {
			scheme: u.protocol.replace(":", ""),
			subdomain,
			domain: parts.length >= 2 ? parts.slice(-2).join(".") : u.hostname,
			port: u.port || (u.protocol === "https:" ? "443" : "80"),
			path: u.pathname,
			query: Object.fromEntries(u.searchParams),
			fragment: u.hash.replace("#", "") || null,
		};
	} catch {
		return {
			scheme: "http",
			subdomain: "",
			domain: "unknown",
			port: "80",
			path: url,
			query: {},
			fragment: null,
		};
	}
}

function getClientIp(req) {
	const xff = req.headers["x-forwarded-for"];
	if (xff) return String(xff).split(",")[0].trim();
	const real = req.headers["x-real-ip"];
	if (real) return String(real);
	return req.socket?.remoteAddress || req.ip || "unknown";
}

export function requestCapture() {
	return (req, res, next) => {
		if (req.method === "GET" && req.headers.upgrade === "websocket") {
			return next();
		}

		const startTime = Date.now();
		const parsedUrl = parseUrl(req.originalUrl || req.url);

		const chunks = [];
		let bodyBytes = 0;
		let bodyTruncated = false;
		const origPush = req.push.bind(req);

		req.push = function (chunk, encoding) {
			if (chunk && !bodyTruncated) {
				if (Buffer.isBuffer(chunk)) {
					bodyBytes += chunk.length;
					if (bodyBytes <= MAX_BODY_BYTES) {
						chunks.push(chunk);
					} else {
						bodyTruncated = true;
					}
				} else if (typeof chunk === "string") {
					const buf = Buffer.from(chunk, encoding);
					bodyBytes += buf.length;
					if (bodyBytes <= MAX_BODY_BYTES) {
						chunks.push(buf);
					} else {
						bodyTruncated = true;
					}
				}
			}
			return origPush(chunk, encoding);
		};

		res.on("finish", () => {
			const duration = Date.now() - startTime;
			let body = null;
			if (chunks.length > 0) {
				try {
					const raw = Buffer.concat(chunks).toString("utf-8");
					body = JSON.parse(raw);
				} catch {
					body = Buffer.concat(chunks).toString("utf-8").slice(0, 2000);
				}
			}

			const entry = {
				ts: new Date(startTime).toISOString(),
				request: {
					method: req.method,
					uri: req.originalUrl || req.url,
					httpVersion: `HTTP/${req.httpVersion || "1.1"}`,
					path: parsedUrl.path,
					query: Object.keys(parsedUrl.query).length > 0 ? parsedUrl.query : undefined,
					fragment: parsedUrl.fragment || undefined,
					url: {
						scheme: parsedUrl.scheme,
						subdomain: parsedUrl.subdomain || undefined,
						domain: parsedUrl.domain,
						port: parsedUrl.port,
						path: parsedUrl.path,
						query: Object.keys(parsedUrl.query).length > 0 ? parsedUrl.query : undefined,
						fragment: parsedUrl.fragment || undefined,
					},
					headers: redactHeaders(req.headers),
					body: bodyTruncated ? "[truncated]" : body,
					bodyBytes,
					bodyTruncated: bodyTruncated || undefined,
					ip: getClientIp(req),
				},
				response: {
					status: res.statusCode,
					duration_ms: duration,
					contentLength: Number(res.getHeader("content-length")) || undefined,
				},
			};

			requestLogWriter.append(entry);
		});

		next();
	};
}
