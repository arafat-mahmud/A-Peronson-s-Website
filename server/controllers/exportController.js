import { getAdminConfig } from "../services/adminConfigService.js";
import {
	checkAnalyticsAccessPolicy,
	getAnalyticsGovernanceConfig,
	sanitizePlatformAnalytics,
} from "../services/analyticsGovernanceService.js";
import { appendAuditLog } from "../utils/auditStore.js";
import prisma from "../utils/prisma.js";

export async function exportAnalytics(req, res) {
	try {
		const config = await getAnalyticsGovernanceConfig();
		const decision = checkAnalyticsAccessPolicy(req.user, config, {
			mode: "export",
		});
		if (!decision.allowed) {
			return res.status(403).json({ error: "Export not allowed", reason: decision.reason });
		}

		// Read raw analytics payload and apply governance sanitization
		const raw = await prisma.analyticsEvent.findMany();

		const adminConfig = await getAdminConfig();
		const sanitized = sanitizePlatformAnalytics(
			{
				monthly_demand_trend: raw || [],
				price_range_demand: [],
				top_categories_global: [],
			},
			adminConfig?.analytics,
		);

		// Audit the export
		await appendAuditLog({
			actor_id: req.user.id,
			action: "analytics_export",
			meta: {
				config: decision.governance || config,
				export_summary: { raw_length: Array.isArray(raw) ? raw.length : 0 },
			},
			created_at: new Date().toISOString(),
		});

		return res.json({
			ok: true,
			governance: decision.governance || config,
			report: sanitized.report,
			suppression: sanitized.suppression,
		});
	} catch (err) {
		return res.status(500).json({ error: "export_failed", message: String(err?.message || err) });
	}
}

export default { exportAnalytics };
