import {
	getAnalyticsSummary,
	getCompanyAnalytics,
	getCoreMetrics,
	getDashboardAnalytics,
	getPlatformAnalyticsAdmin,
	getPlatformAnalyticsSegment,
	getPlatformAnalyticsSummary,
	getPlatformOverview,
	getPlatformTrends,
	getPremiumInsights,
} from "../services/analyticsService.js";
import { ACTIONS, authorize } from "../services/authorizationService.js";
import { ensureEntitlement } from "../services/entitlementService.js";
import { findUserById } from "../services/userService.js";
import { handleControllerError } from "../utils/permissions.js";
import prisma from "../utils/prisma.js";
import { sanitizeString } from "../utils/validators.js";

function isOwnerOrAdmin(user) {
	return ["owner", "admin"].includes(String(user?.role || "").toLowerCase());
}

function handleError(res, error) {
	return handleControllerError(res, error);
}

export async function analyticsSummary(req, res) {
	try {
		const summary = await getAnalyticsSummary(req.user);
		return res.json(summary);
	} catch (error) {
		return handleError(res, error);
	}
}

export async function analyticsDashboard(req, res) {
	try {
		// Agents need permission_matrix to be evaluated; token payload is minimal, so load the full user record.
		const actor = req.user?.role === "agent" ? await findUserById(req.user.id) : req.user;
		const dashboard = await getDashboardAnalytics(actor);
		return res.json(dashboard);
	} catch (error) {
		return handleError(res, error);
	}
}

export async function analyticsCompany(req, res) {
	try {
		const actor = req.user?.role === "agent" ? await findUserById(req.user.id) : req.user;
		await authorize(actor, ACTIONS.ANALYTICS_VIEW_ORG, { scope: "company" });
		const report = await getCompanyAnalytics(actor);
		return res.json(report);
	} catch (error) {
		return handleError(res, error);
	}
}

export async function analyticsPlatformSummary(req, res) {
	try {
		await authorize(req.user, ACTIONS.ANALYTICS_VIEW_ORG, {
			scope: "platform_summary",
		});
		const report = await getPlatformAnalyticsSummary(req.user);
		return res.json(report);
	} catch (error) {
		return handleError(res, error);
	}
}

export async function analyticsPlatformOverview(req, res) {
	try {
		// overview is available to all authenticated roles but must be anonymized
		const report = await getPlatformOverview(req.user);
		return res.json(report);
	} catch (error) {
		return handleError(res, error);
	}
}

export async function analyticsPlatformTrends(req, res) {
	try {
		const dims = String(req.query?.dimensions || "")
			.split(",")
			.map((v) => v.trim())
			.filter(Boolean);
		const report = await getPlatformTrends(req.user, { dimensions: dims });
		return res.json(report);
	} catch (error) {
		return handleError(res, error);
	}
}

export async function analyticsPlatformSegment(req, res) {
	try {
		await authorize(req.user, ACTIONS.ANALYTICS_VIEW_ORG, {
			scope: "platform_segment",
		});
		const dimensions = String(req.query?.dimensions || "")
			.split(",")
			.map((value) => value.trim())
			.filter(Boolean);
		const report = await getPlatformAnalyticsSegment(req.user, { dimensions });
		return res.json(report);
	} catch (error) {
		return handleError(res, error);
	}
}

export async function analyticsPlatformAdmin(req, res) {
	try {
		await authorize(req.user, ACTIONS.ANALYTICS_VIEW_ORG, {
			scope: "platform_admin",
		});
		const report = await getPlatformAnalyticsAdmin(req.user, {
			export: req.query?.export === "true",
		});
		return res.json(report);
	} catch (error) {
		return handleError(res, error);
	}
}

export async function analyticsPremium(req, res) {
	try {
		const actor = await findUserById(req.user.id);
		await authorize(actor, ACTIONS.ANALYTICS_VIEW_AGENT, { scope: "premium" });
		const insights = await getPremiumInsights(actor);
		return res.json(insights);
	} catch (error) {
		return handleError(res, error);
	}
}

export async function analyticsViewers(req, res) {
	try {
		const entity = sanitizeString(String(req.query?.entity || ""), 40).toLowerCase();
		const id = sanitizeString(String(req.query?.id || ""), 120);
		const limit = Math.min(50, Math.max(1, Number(req.query?.limit || 10)));

		if (!(entity && id)) {
			return res.status(400).json({ error: "entity and id are required" });
		}

		if (!isOwnerOrAdmin(req.user)) {
			await ensureEntitlement(
				req.user,
				"advanced_analytics",
				"Premium plan required for viewer analytics.",
			);
		}

		const actor = req.user?.role === "agent" ? await findUserById(req.user.id) : req.user;
		const actorOrgId =
			actor?.role === "agent" ? String(actor?.org_owner_id || "") : String(actor?.id || "");

		if (entity === "profile") {
			if (!isOwnerOrAdmin(actor) && actorOrgId !== id) {
				return res.status(403).json({ error: "Forbidden" });
			}

			const [events, users] = await Promise.all([
				prisma.analyticsEvent.findMany({
					where: { type: "profile_view", entity_id: id },
				}),
				prisma.user.findMany(),
			]);
			const rows = Array.isArray(events) ? events : [];
			const viewers = rows
				.map((e) => ({
					viewer_id: String(e.actor_id || ""),
					viewed_at: e.created_at,
				}))
				.filter((e) => e.viewer_id && !String(e.viewer_id).startsWith("anon:"))
				.sort((a, b) => String(b.viewed_at || "").localeCompare(String(a.viewed_at || "")));

			const unique = new Map();
			viewers.forEach((row) => {
				if (!unique.has(row.viewer_id)) {
					unique.set(row.viewer_id, row);
				}
			});

			const usersById = new Map((Array.isArray(users) ? users : []).map((u) => [String(u.id), u]));
			const items = [...unique.values()]
				.slice(0, limit)
				.map((row) => {
					const user = usersById.get(String(row.viewer_id));
					return {
						viewer_id: row.viewer_id,
						viewed_at: row.viewed_at,
						viewer: user
							? {
									id: user.id,
									name: user.name || "",
									role: user.role || "",
									verified: Boolean(user.verified),
								}
							: null,
					};
				})
				.filter((row) => row.viewer);

			return res.json({ entity, id, items });
		}

		if (entity === "product") {
			const [views, product, users] = await Promise.all([
				prisma.productView.findMany(),
				prisma.product.findUnique({ where: { id } }),
				prisma.user.findMany(),
			]);
			if (!product) {
				return res.status(404).json({ error: "Product not found" });
			}

			if (!isOwnerOrAdmin(actor) && actorOrgId !== String(product.company_id || "")) {
				return res.status(403).json({ error: "Forbidden" });
			}

			const viewers = (Array.isArray(views) ? views : []).sort((a, b) =>
				String(b.viewed_at || "").localeCompare(String(a.viewed_at || "")),
			);

			const usersById = new Map((Array.isArray(users) ? users : []).map((u) => [String(u.id), u]));
			const seen = new Set();
			const items = [];
			for (const row of viewers) {
				const viewerId = String(row.user_id || "");
				if (!viewerId || seen.has(viewerId)) {
					continue;
				}
				const user = usersById.get(viewerId);
				if (!user) {
					continue;
				}
				seen.add(viewerId);
				items.push({
					viewer_id: viewerId,
					viewed_at: row.viewed_at,
					viewer: {
						id: user.id,
						name: user.name || "",
						role: user.role || "",
						verified: Boolean(user.verified),
					},
				});
				if (items.length >= limit) {
					break;
				}
			}

			return res.json({ entity, id, items });
		}

		return res.status(400).json({ error: "Unsupported entity type" });
	} catch (error) {
		return handleError(res, error);
	}
}

export async function analyticsCoreMetrics(req, res) {
	try {
		const result = await getCoreMetrics(req.user);
		return res.json(result);
	} catch (error) {
		return handleError(res, error);
	}
}
