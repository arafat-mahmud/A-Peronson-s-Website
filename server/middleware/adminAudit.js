import crypto from "node:crypto";
import { appendAuditLog, sanitizeAuditPayload } from "../utils/auditStore.js";

function buildAction(req) {
	const bodyAction = req.body?.action || req.body?.type;
	if (bodyAction) {
		return String(bodyAction);
	}
	return `${req.method} ${req.originalUrl}`;
}

export function adminAuditLogger({ actionResolver } = {}) {
	return (req, res, next) => {
		const startedAt = Date.now();
		res.on("finish", () => {
			const action = actionResolver ? actionResolver(req, res) : buildAction(req);
			const payload = sanitizeAuditPayload(req.body || {});
			appendAuditLog({
				id: crypto.randomUUID(),
				at: new Date().toISOString(),
				duration_ms: Math.max(0, Date.now() - startedAt),
				actor_id: req.user?.id || null,
				actor_role: req.user?.role || null,
				ip: req.ip,
				device_id: req.adminDeviceId || req.headers["x-admin-device"] || null,
				method: req.method,
				path: req.originalUrl,
				status: res.statusCode,
				action,
				payload,
			}).catch(() => null);
		});
		next();
	};
}
