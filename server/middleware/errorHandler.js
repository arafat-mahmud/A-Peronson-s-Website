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
	logError("Unhandled API error", err);
	return res.status(500).json({ error: "Internal server error" });
}
