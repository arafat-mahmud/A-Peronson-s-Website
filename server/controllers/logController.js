import { logHub } from "../log/logHub.js";
import { extractClientIp } from "../services/geoService.js";
import { sanitizeString } from "../utils/validators.js";

const MAX_MESSAGE_LEN = 4000;

function sanitizeLogText(value, max = MAX_MESSAGE_LEN) {
	return String(value ?? "")
		.trim()
		.replace(/[\r\n]+/g, " ")
		.replace(/\s+/g, " ")
		.slice(0, max);
}

function sanitizeText(value, max = MAX_MESSAGE_LEN) {
	return sanitizeString(String(value ?? ""), max);
}

function formatUserLabel(user, clientProvided = "") {
	const fromBody = sanitizeText(clientProvided, 80);
	if (user?.id) {
		const name = sanitizeText(user.name || user.email || "", 60) || "user";
		return `${name}:${user.id}`;
	}
	return fromBody || "anonymous";
}

export function postLog(req, res) {
	const body = req.body || {};
	const pubip = extractClientIp(req) || req.ip || "unknown";
	const userLabel = formatUserLabel(req.user, body.user);

	const batch = Array.isArray(body.batch) && body.batch.length > 0 ? body.batch : [body];

	let count = 0;
	for (const item of batch) {
		if (typeof item !== "object" || item === null) {
			continue;
		}
		const level = sanitizeLogText(item.level, 10).toLowerCase();
		const rawMessage =
			typeof item.message === "string" ? item.message : JSON.stringify(item.message ?? "");
		const message = sanitizeLogText(rawMessage);
		const clientUser =
			typeof item.user === "string"
				? item.user
				: item.user?.label || (item.user?.id ? `user:${item.user.id}` : "");

		const data = {
			...(item.data && typeof item.data === "object" ? item.data : null),
			pubip,
			user: clientUser || userLabel,
			user_id: item.user?.id || req.user?.id || null,
			role: item.user?.role || req.user?.role || null,
			url: sanitizeLogText(item.url, 300) || null,
			ts: sanitizeLogText(item.ts, 40) || null,
			perf: item.performance || null,
		};

		const entry = logHub.createEntry({
			level,
			message,
			data,
			source: "frontend",
			stack: sanitizeLogText(item.stack, 4000) || null,
			meta: {
				path: data.url,
				user_id: data.user_id,
				role: data.role,
				ip: pubip,
			},
		});
		logHub.emit(entry);
		count += 1;
	}

	return res.status(202).json({ ok: true, accepted: count });
}
