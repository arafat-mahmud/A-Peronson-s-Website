import { logError, logWarn } from "../utils/logger.js";

// Services signal expected failures (bad input, wrong password, conflicts) by
// throwing an Error with a 4xx `status`. Those are answered with that status
// and their own message; only genuine failures become a generic 500.
function clientErrorStatus(err) {
	if (err?.type === "entity.parse.failed") return 400;
	if (err?.type === "entity.too.large") return 413;
	const status = Number(err?.status || err?.statusCode);
	return Number.isInteger(status) && status >= 400 && status < 500 ? status : 0;
}

// The database is unreachable, overloaded or the pool is exhausted: a
// temporary condition the client should retry, not a server bug.
const DB_UNAVAILABLE_CODES = new Set(["P1001", "P1002", "P1008", "P1017", "P2024"]);

export function isDatabaseUnavailable(err) {
	return (
		DB_UNAVAILABLE_CODES.has(err?.code) ||
		err?.name === "PrismaClientInitializationError" ||
		err?.name === "PrismaClientRustPanicError"
	);
}

/** Prisma messages are many lines; the cause is the last non-empty one. */
function errorSummary(err, req) {
	const lines = String(err?.message || "")
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean);
	return {
		name: err?.name,
		code: err?.code,
		path: req?.originalUrl?.split("?")[0] || req?.path,
		method: req?.method,
		model: err?.meta?.modelName,
		cause: (lines.at(-1) || "").slice(0, 300),
	};
}

export function errorHandler(err, req, res, next) {
	if (res.headersSent) {
		return next(err);
	}
	const status = clientErrorStatus(err);
	if (status) {
		logWarn("API request rejected", { status, path: req?.path, message: err?.message });
		const message =
			err?.type === "entity.parse.failed"
				? "Invalid JSON body"
				: err?.type === "entity.too.large"
					? "Request body too large"
					: err?.message || "Request failed";
		return res.status(status).json({ error: message, ...(err?.code ? { code: err.code } : {}) });
	}
	if (isDatabaseUnavailable(err)) {
		logWarn("API database unavailable", errorSummary(err, req));
		res.set("Retry-After", "3");
		return res.status(503).json({
			error: "Service temporarily unavailable. Please try again.",
			code: "DATABASE_UNAVAILABLE",
		});
	}
	logError("Unhandled API error", { ...errorSummary(err, req), stack: err?.stack });
	return res.status(500).json({ error: "Internal server error" });
}
