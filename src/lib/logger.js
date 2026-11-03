const IS_DEV = import.meta.env.DEV;
const API_BASE = import.meta.env.VITE_API_URL || "/api";

const LEVELS = ["debug", "info", "success", "warn", "error", "critical"];

function getUserContext() {
	try {
		const raw = localStorage.getItem("user");
		if (!raw) {
			return { label: "", id: null, role: null };
		}
		const user = JSON.parse(raw);
		return {
			label: user?.name || user?.email || user?.id || "",
			id: user?.id || null,
			role: user?.role || user?.roles?.[0] || null,
		};
	} catch {
		return { label: "", id: null, role: null };
	}
}

function getToken() {
	return localStorage.getItem("jwt") || sessionStorage.getItem("jwt") || "";
}

function stringifyArg(arg) {
	if (typeof arg === "string") {
		return arg;
	}
	if (arg instanceof Error) {
		return arg.stack || arg.message;
	}
	try {
		const serialized = JSON.stringify(arg);
		return serialized === undefined ? String(arg) : serialized;
	} catch {
		return String(arg);
	}
}

function buildMessage(args) {
	return args.map((arg) => stringifyArg(arg)).join(" ");
}

const queue = [];
let flushing = false;

function flush() {
	flushing = true;
	const batch = queue.splice(0, queue.length);
	try {
		const token = getToken();
		fetch(`${API_BASE}/logs`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				...(token ? { Authorization: `Bearer ${token}` } : {}),
			},
			body: JSON.stringify({ batch }),
			keepalive: true,
		}).catch(() => {});
	} catch {
		// Logging must never break the app.
	}
	setTimeout(() => {
		flushing = false;
		if (queue.length > 0) {
			flush();
		}
	}, 600);
}

function forward(entry) {
	try {
		queue.push(entry);
		if (queue.length >= 20) {
			flush();
		} else if (!flushing) {
			setTimeout(flush, 800);
		}
	} catch {
		// noop
	}
}

function makeEntry(level, args, data) {
	const { label, id, role } = getUserContext();
	return {
		level,
		message: buildMessage(args),
		data: data === undefined ? null : safeClone(data),
		scope: "frontend",
		ts: new Date().toISOString(),
		url: (() => {
			try {
				return window.location.pathname;
			} catch {
				return "";
			}
		})(),
		user: { label, id, role },
		performance: {
			timing: (() => {
				try {
					return window.performance?.timeOrigin ? Date.now() - window.performance.timeOrigin : null;
				} catch {
					return null;
				}
			})(),
		},
	};
}

function safeClone(value) {
	if (value === null || typeof value !== "object") {
		return value;
	}
	try {
		return JSON.parse(JSON.stringify(value));
	} catch {
		return String(value);
	}
}

function emit(level, args, data) {
	const entry = makeEntry(level, args, data);
	if (IS_DEV) {
		const fn = {
			debug: "log",
			info: "info",
			success: "info",
			warn: "warn",
			error: "error",
			critical: "error",
		}[level];
		// biome-ignore lint/suspicious/noConsole: logger file (project convention)
		console[fn]?.(`[${level.toUpperCase()}]`, ...args);
	}
	forward(entry);
}

/**
 * Application logger. Emits to the browser console (dev only) and forwards
 * structured entries to the backend, where they appear in the log hub.
 * @namespace logger
 */
export const logger = {
	debug: (...args) => emit("debug", args),
	info: (...args) => emit("info", args),
	success: (...args) => emit("success", args),
	log: (...args) => emit("info", args),
	warn: (...args) => emit("warn", args),
	error: (...args) => emit("error", args),
	critical: (...args) => emit("critical", args),
	withData: (level, data, ...args) => emit(level, args, data),
	trace: (label, ...args) => emit("debug", [`${label} →`, ...args]),
};

export const LOG_LEVELS = LEVELS;
