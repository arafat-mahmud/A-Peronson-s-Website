import crypto from "node:crypto";
import chalk from "chalk";
import jwt from "jsonwebtoken";
import { logInfo } from "../utils/logger.js";

const SENSITIVE_KEYS = new Set(["password", "token", "authorization", "secret", "otp", "passkey"]);

// AI routes wait for a model turn, and a turn on a free model can take far
// longer than the default request budget. That mismatch was invisible while
// the assistant never reached the model: the probe failed in twenty seconds
// and the route answered from its fallback almost at once. Once the assistant
// really does reach the model, the 45-second default cuts the answer off and
// the client gets a 504 for a turn that was about to succeed.
const AI_ROUTE_PREFIXES = ["/api/assistant/", "/api/ai/"];
const DEFAULT_AI_TIMEOUT_MS = 180_000;

/**
 * How long this request is allowed to run.
 *
 * The default budget is the ceiling for ordinary routes. An AI route only
 * ever gets a LONGER budget, never a shorter one, so a deliberately small
 * REQUEST_TIMEOUT_MS is still honoured. Override with AI_REQUEST_TIMEOUT_MS.
 */
export function resolveRequestTimeoutMs(originalUrl, defaultMs) {
	const isAiRoute = AI_ROUTE_PREFIXES.some((prefix) =>
		String(originalUrl || "").startsWith(prefix),
	);
	if (!isAiRoute) {
		return defaultMs;
	}
	const raw = Number(process.env.AI_REQUEST_TIMEOUT_MS);
	const configured = Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_AI_TIMEOUT_MS;
	return Math.max(defaultMs, configured);
}

function redactValue(value) {
	if (Array.isArray(value)) {
		return value.map((entry) => redactValue(entry));
	}
	if (value && typeof value === "object") {
		const out = {};
		for (const [key, entry] of Object.entries(value)) {
			if (SENSITIVE_KEYS.has(String(key).toLowerCase())) {
				out[key] = "[redacted]";
			} else {
				out[key] = redactValue(entry);
			}
		}
		return out;
	}
	return value;
}

function decodeAuthSubject(authHeader = "") {
	const header = String(authHeader || "");
	if (!header.startsWith("Bearer ")) {
		return {};
	}
	const token = header.slice(7).trim();
	if (!token) {
		return {};
	}
	const decoded = jwt.decode(token) || {};
	return {
		user_id: decoded.id || decoded.sub || "",
		role: decoded.role || "",
	};
}

function getMethodColor(method) {
	switch (method) {
		case "GET":
			return chalk.green;
		case "POST":
			return chalk.magenta;
		case "PUT":
		case "PATCH":
			return chalk.yellow;
		case "DELETE":
			return chalk.red;
		default:
			return chalk.white;
	}
}

function getStatusColor(status) {
	if (status >= 500) {
		return chalk.red.bold;
	}
	if (status >= 400) {
		return chalk.yellow;
	}
	if (status >= 300) {
		return chalk.cyan;
	}
	if (status >= 200) {
		return chalk.green;
	}
	return chalk.white;
}

function getDurationColor(ms) {
	if (ms < 200) {
		return chalk.green;
	}
	if (ms <= 1000) {
		return chalk.yellow;
	}
	return chalk.red;
}

function getPathColor(path) {
	if (path.startsWith("/api/admin")) {
		return chalk.magenta;
	}
	if (path.startsWith("/api/network")) {
		return chalk.cyan;
	}
	if (path.startsWith("/api/events")) {
		return chalk.yellow;
	}
	if (path.startsWith("/api/infra")) {
		return chalk.hex("#FF69B4");
	}
	if (path.startsWith("/api/verification")) {
		return chalk.cyan;
	}
	return chalk.blue;
}

function formatEventLog(payload, isStart = false) {
	const {
		request_id,
		method,
		path,
		status,
		duration_ms,
		response_bytes,
		user_id,
		role,
		ip,
		event,
	} = payload;

	const parts = [];

	parts.push(chalk.cyan(`[${event}]`));

	if (isStart) {
		parts.push(chalk.cyan("START"));
	} else {
		parts.push(getStatusColor(status)(status));
	}

	const methodColor = getMethodColor(method);
	parts.push(methodColor(method));

	parts.push(getPathColor(path)(path));

	if (!isStart && status !== undefined) {
		const durColor = getDurationColor(duration_ms);
		parts.push(durColor(`${duration_ms}ms`));
		if (response_bytes) {
			parts.push(chalk.gray(`${(response_bytes / 1024).toFixed(1)}KB`));
		}
	}

	if (user_id) {
		parts.push(chalk.bold.white(`user:${user_id}`));
	}

	if (role) {
		parts.push(chalk.gray(`[${role}]`));
	}

	if (ip) {
		parts.push(chalk.gray(ip));
	}

	parts.push(chalk.gray(request_id.slice(0, 8)));

	return parts.join(" ");
}

function formatEventLogPayload(payload) {
	const { type, entity_id, client_id, session_id, duration_ms } = payload;

	const parts = [];

	parts.push(chalk.cyan("[event]"));

	if (type === "page_view") {
		parts.push(chalk.green("page_view"));
	} else if (type === "page_duration") {
		parts.push(chalk.blue("page_duration"));
	} else if (type === "session_end") {
		parts.push(chalk.magenta("session_end"));
	} else if (type === "session_start") {
		parts.push(chalk.cyan("session_start"));
	} else if (type === "click") {
		parts.push(chalk.yellow("click"));
	} else {
		parts.push(chalk.white(type || "unknown"));
	}

	if (entity_id) {
		parts.push(chalk.blue(entity_id));
	}

	if (duration_ms !== undefined) {
		const durColor = getDurationColor(duration_ms);
		parts.push(durColor(`${duration_ms}ms`));
	}

	if (session_id) {
		parts.push(chalk.cyan(session_id.slice(0, 8)));
	}

	if (client_id) {
		parts.push(chalk.gray(client_id.slice(0, 8)));
	}

	return parts.join(" ");
}

export function requestLogger({ timeoutMs = 45_000 } = {}) {
	return (req, res, next) => {
		// Frontend log forwarding already emits its own line in logController.
		const isLogEndpoint = req.originalUrl?.startsWith("/api/logs");
		if (isLogEndpoint) {
			return next();
		}

		const requestId = crypto.randomUUID();
		const startedAt = Date.now();
		const requestTimeoutMs = resolveRequestTimeoutMs(req.originalUrl, timeoutMs);
		const authInfo = decodeAuthSubject(req.headers.authorization);
		const body = redactValue(req.body || {});

		const isEventEndpoint = req.originalUrl?.startsWith("/api/events");

		// Structured request context: stored in entry.meta by logger.extractMeta,
		// which feeds the request-flow tracker + latency histogram/percentiles.
		const requestContext = {
			request_id: requestId,
			method: req.method,
			path: req.originalUrl || req.url,
			user_id: authInfo.user_id || "",
			role: authInfo.role || "",
			ip: req.ip,
		};

		if (isEventEndpoint && req.method === "POST" && body?.type) {
			logInfo("request event", { ...body, _console: formatEventLogPayload(req.body) });
		} else {
			logInfo("request start", {
				...requestContext,
				event: "request_start",
				_console: formatEventLog({ ...requestContext, event: "request_start" }, true),
			});
		}

		let responseBytes = 0;
		const originalWrite = res.write.bind(res);
		const originalEnd = res.end.bind(res);

		res.write = (chunk, encoding, cb) => {
			if (chunk) {
				responseBytes += Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(chunk, encoding);
			}
			return originalWrite(chunk, encoding, cb);
		};

		res.end = (chunk, encoding, cb) => {
			if (chunk) {
				responseBytes += Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(chunk, encoding);
			}
			return originalEnd(chunk, encoding, cb);
		};

		const timer = setTimeout(() => {
			if (res.headersSent) {
				return;
			}
			res.status(504).json({ error: "Request timeout" });
			req.destroy();
			const duration = Date.now() - startedAt;
			logInfo("request timeout", {
				...requestContext,
				event: "timeout",
				status: 504,
				duration_ms: duration,
				response_bytes: responseBytes,
				_console: formatEventLog({
					...requestContext,
					status: 504,
					duration_ms: duration,
					response_bytes: responseBytes,
					event: "timeout",
				}),
			});
		}, requestTimeoutMs);

		function finalize(eventName = "request_end") {
			clearTimeout(timer);
			const duration = Date.now() - startedAt;
			const status = res.statusCode;

			logInfo("request end", {
				...requestContext,
				event: eventName,
				status,
				duration_ms: duration,
				response_bytes: responseBytes,
				_console: formatEventLog({
					...requestContext,
					status,
					duration_ms: duration,
					response_bytes: responseBytes,
					event: eventName,
				}),
			});
		}

		res.on("finish", () => finalize("request_end"));
		res.on("close", () => {
			if (!res.writableEnded) {
				finalize("request_aborted");
			}
		});

		return next();
	};
}
