import crypto from "node:crypto";
import prisma from "../utils/prisma.js";
import { sanitizeString } from "../utils/validators.js";
import {
	checkAnalyticsAccessPolicy,
	getAnalyticsGovernanceConfig,
	sanitizePlatformAnalytics,
} from "./analyticsGovernanceService.js";

export async function exportAnalytics(user = {}, rawPayload = {}) {
	const governance = await getAnalyticsGovernanceConfig();
	// Check access policy for exports
	const policy = checkAnalyticsAccessPolicy(user, governance, {
		mode: "export",
	});

	const auditId = crypto.randomUUID();
	const now = new Date();

	// Record an audit entry regardless of outcome
	try {
		await prisma.eventLog.create({
			data: {
				id: auditId,
				org_owner_id: sanitizeString(String(user?.id || ""), 120) || "system",
				actor_id: sanitizeString(String(user?.id || ""), 120) || null,
				event_type: "analytics_export",
				entity_type: null,
				entity_id: null,
				payload: {
					type: "analytics_export",
					actor_role: String(user?.role || "").toLowerCase() || null,
					requested_at: now.toISOString(),
					allowed: Boolean(policy.allowed),
					governance,
					payload: policy.allowed ? rawPayload || {} : undefined,
				},
				occurred_at: now,
				created_at: now,
			},
		});
	} catch {}

	if (!policy.allowed) {
		const err = new Error("Analytics export denied by governance policy");
		err.status = 403;
		err.code = "ANALYTICS_EXPORT_DENIED";
		throw err;
	}

	// Sanitize payload according to governance
	const sanitized = sanitizePlatformAnalytics(rawPayload || {}, governance);

	// Update audit record to include sanitized result and timestamp
	try {
		const completedAt = new Date();
		await prisma.eventLog.update({
			where: { id: auditId },
			data: {
				payload: {
					type: "analytics_export",
					actor_role: String(user?.role || "").toLowerCase() || null,
					requested_at: now.toISOString(),
					allowed: true,
					governance,
					completed_at: completedAt.toISOString(),
					exported_at: completedAt.toISOString(),
					result: sanitized.report || sanitized,
				},
				occurred_at: completedAt,
			},
		});
	} catch {}

	return { export_id: auditId, sanitized };
}

export default { exportAnalytics };
