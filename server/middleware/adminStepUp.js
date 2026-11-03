const DEFAULT_STEPUP_WINDOW_MINUTES = 10;

function withinWindow(timestamp, maxMinutes) {
	const time = new Date(String(timestamp || "")).getTime();
	if (!Number.isFinite(time)) {
		return false;
	}
	const windowMs = Math.max(1, Number(maxMinutes || DEFAULT_STEPUP_WINDOW_MINUTES)) * 60 * 1000;
	return Date.now() - time <= windowMs;
}

export function requireAdminStepUp(req, res, next) {
	const required = String(process.env.ADMIN_STEPUP_CODE || "").trim();
	if (!required) {
		return next();
	}

	const provided = String(req.headers["x-admin-stepup"] || "").trim();
	if (!provided || provided !== required) {
		return res.status(403).json({ error: "Admin step-up confirmation required." });
	}

	const timestamp = req.headers["x-admin-stepup-at"];
	if (timestamp) {
		const maxMinutes = Number(
			process.env.ADMIN_STEPUP_MAX_MINUTES || DEFAULT_STEPUP_WINDOW_MINUTES,
		);
		if (!withinWindow(timestamp, maxMinutes)) {
			return res.status(403).json({ error: "Admin step-up window expired." });
		}
	}

	return next();
}
