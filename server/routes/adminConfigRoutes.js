import express from "express";
import { requireAdminSecurity } from "../middleware/adminSecurity.js";
import { requireAuth } from "../middleware/auth.js";
import { readConfig, writeConfig } from "../services/adminConfigService.js";

import {
	getActionsAsGroups,
	getActionsWithFallback,
	getAllConfig,
	getBrandingConfigWithFallback,
	getCapabilitiesWithFallback,
	getConfigHistory,
	getGovernanceConfigWithFallback,
	getInventoryByModule,
	getInventoryWithFallback,
	getMockDataWithFallback,
	getRoleConfigWithFallback,
	getSecurityPurposesWithFallback,
	getUiConfigWithFallback,
	updateActionsConfig,
	updateBrandingConfig,
	updateCapabilities,
	updateGovernanceConfig,
	updateInventoryConfig,
	updateMockData,
	updateRoleConfig,
	updateSecurityPurposes,
	updateUiConfig,
} from "../services/adminDynamicConfigService.js";
import prisma from "../utils/prisma.js";

const router = express.Router();

router.get("/config", requireAuth, requireAdminSecurity, async (_req, res) => {
	try {
		const config = await getAllConfig();
		res.json(config);
	} catch {
		res.status(500).json({ error: "Failed to fetch config" });
	}
});

router.get("/config/inventory", requireAuth, requireAdminSecurity, async (_req, res) => {
	try {
		const inventory = await getInventoryWithFallback();
		res.json(inventory);
	} catch {
		res.status(500).json({ error: "Failed to fetch inventory" });
	}
});

router.get("/config/inventory/:moduleId", requireAuth, requireAdminSecurity, async (req, res) => {
	try {
		const { moduleId } = req.params;
		const module = await getInventoryByModule(moduleId);
		if (!module) {
			return res.status(404).json({ error: "Module not found" });
		}
		res.json(module);
	} catch {
		res.status(500).json({ error: "Failed to fetch module" });
	}
});

router.put("/config/inventory", requireAuth, requireAdminSecurity, async (req, res) => {
	try {
		const { data } = req.body;
		const actorId = req.user?.id || "admin";
		const result = await updateInventoryConfig(data, actorId);
		res.json(result);
	} catch {
		res.status(500).json({ error: "Failed to update inventory" });
	}
});

router.get("/config/actions", requireAuth, requireAdminSecurity, async (_req, res) => {
	try {
		const actions = await getActionsWithFallback();
		res.json(actions);
	} catch {
		res.status(500).json({ error: "Failed to fetch actions" });
	}
});

router.get("/config/actions/groups", requireAuth, requireAdminSecurity, async (_req, res) => {
	try {
		const groups = await getActionsAsGroups();
		res.json(groups);
	} catch {
		res.status(500).json({ error: "Failed to fetch action groups" });
	}
});

router.put("/config/actions", requireAuth, requireAdminSecurity, async (req, res) => {
	try {
		const { data } = req.body;
		const actorId = req.user?.id || "admin";
		const result = await updateActionsConfig(data, actorId);
		res.json(result);
	} catch {
		res.status(500).json({ error: "Failed to update actions" });
	}
});

router.get("/config/capabilities", requireAuth, requireAdminSecurity, async (req, res) => {
	try {
		const { moduleId } = req.query;
		const capabilities = await getCapabilitiesWithFallback(moduleId);
		res.json(capabilities);
	} catch {
		res.status(500).json({ error: "Failed to fetch capabilities" });
	}
});

router.put("/config/capabilities", requireAuth, requireAdminSecurity, async (req, res) => {
	try {
		const { data } = req.body;
		const actorId = req.user?.id || "admin";
		const result = await updateCapabilities(data, actorId);
		res.json(result);
	} catch {
		res.status(500).json({ error: "Failed to update capabilities" });
	}
});

router.get("/config/ui", requireAuth, requireAdminSecurity, async (_req, res) => {
	try {
		const uiConfig = await getUiConfigWithFallback();
		res.json(uiConfig);
	} catch {
		res.status(500).json({ error: "Failed to fetch UI config" });
	}
});

router.put("/config/ui", requireAuth, requireAdminSecurity, async (req, res) => {
	try {
		const { data } = req.body;
		const actorId = req.user?.id || "admin";
		const result = await updateUiConfig(data, actorId);
		res.json(result);
	} catch {
		res.status(500).json({ error: "Failed to update UI config" });
	}
});

router.get("/config/mock", requireAuth, requireAdminSecurity, async (req, res) => {
	try {
		const { type } = req.query;
		const mockData = await getMockDataWithFallback(type);
		res.json(mockData);
	} catch {
		res.status(500).json({ error: "Failed to fetch mock data" });
	}
});

router.put("/config/mock", requireAuth, requireAdminSecurity, async (req, res) => {
	try {
		const { dataKey, payload } = req.body;
		const actorId = req.user?.id || "admin";
		const result = await updateMockData(dataKey, payload, actorId);
		res.json(result);
	} catch {
		res.status(500).json({ error: "Failed to update mock data" });
	}
});

router.get("/config/roles", requireAuth, requireAdminSecurity, async (_req, res) => {
	try {
		const roleConfig = await getRoleConfigWithFallback();
		res.json(roleConfig);
	} catch {
		res.status(500).json({ error: "Failed to fetch role config" });
	}
});

router.put("/config/roles", requireAuth, requireAdminSecurity, async (req, res) => {
	try {
		const { data } = req.body;
		const actorId = req.user?.id || "admin";
		const result = await updateRoleConfig(data, actorId);
		res.json(result);
	} catch {
		res.status(500).json({ error: "Failed to update role config" });
	}
});

router.get("/config/governance", requireAuth, requireAdminSecurity, async (_req, res) => {
	try {
		const governanceConfig = await getGovernanceConfigWithFallback();
		res.json(governanceConfig);
	} catch {
		res.status(500).json({ error: "Failed to fetch governance config" });
	}
});

router.put("/config/governance", requireAuth, requireAdminSecurity, async (req, res) => {
	try {
		const { data } = req.body;
		const actorId = req.user?.id || "admin";
		const result = await updateGovernanceConfig(data, actorId);
		res.json(result);
	} catch {
		res.status(500).json({ error: "Failed to update governance config" });
	}
});

router.get("/config/branding", requireAuth, requireAdminSecurity, async (_req, res) => {
	try {
		const branding = await getBrandingConfigWithFallback();
		res.json(branding);
	} catch {
		res.status(500).json({ error: "Failed to fetch branding" });
	}
});

router.put("/config/branding", requireAuth, requireAdminSecurity, async (req, res) => {
	try {
		const { data } = req.body;
		const actorId = req.user?.id || "admin";
		const result = await updateBrandingConfig(data, actorId);
		res.json(result);
	} catch {
		res.status(500).json({ error: "Failed to update branding" });
	}
});

router.get("/config/security", requireAuth, requireAdminSecurity, async (_req, res) => {
	try {
		const security = await getSecurityPurposesWithFallback();
		res.json(security);
	} catch {
		res.status(500).json({ error: "Failed to fetch security purposes" });
	}
});

router.put("/config/security", requireAuth, requireAdminSecurity, async (req, res) => {
	try {
		const { data } = req.body;
		const actorId = req.user?.id || "admin";
		const result = await updateSecurityPurposes(data, actorId);
		res.json(result);
	} catch {
		res.status(500).json({ error: "Failed to update security purposes" });
	}
});

router.get("/config/history", requireAuth, requireAdminSecurity, async (req, res) => {
	try {
		const { type, limit } = req.query;
		const history = await getConfigHistory(type, Number.parseInt(limit, 10) || 20);
		res.json(history);
	} catch {
		res.status(500).json({ error: "Failed to fetch config history" });
	}
});

router.get("/config/roles-list", requireAuth, requireAdminSecurity, async (_req, res) => {
	try {
		const roles = await prisma.adminRoleConfig.findMany({
			where: { active: true },
		});
		res.json(
			roles.map((r) => ({
				role_key: r.role_key,
				label: r.label,
				is_admin_role: r.is_admin_role,
				benefits: r.benefits,
			})),
		);
	} catch {
		res.status(500).json({ error: "Failed to fetch roles" });
	}
});

router.get("/config/infra-capabilities", requireAuth, requireAdminSecurity, async (_req, res) => {
	try {
		const caps = await prisma.adminCapability.findMany({
			where: { module_id: "infra", active: true },
			orderBy: { sort_order: "asc" },
		});
		res.json(
			caps.map((c) => ({
				capability_id: c.capability_id,
				title: c.title,
				count: c.count,
				icon_name: c.icon_name,
				subtitle: c.subtitle,
			})),
		);
	} catch {
		res.status(500).json({ error: "Failed to fetch capabilities" });
	}
});

router.get("/config/network-capabilities", requireAuth, requireAdminSecurity, async (_req, res) => {
	try {
		const caps = await prisma.adminCapability.findMany({
			where: { module_id: "network", active: true },
			orderBy: { sort_order: "asc" },
		});
		res.json(
			caps.map((c) => ({
				capability_id: c.capability_id,
				title: c.title,
				count: c.count,
				icon_name: c.icon_name,
				subtitle: c.subtitle,
			})),
		);
	} catch {
		res.status(500).json({ error: "Failed to fetch capabilities" });
	}
});

router.get("/config/ultra-capabilities", requireAuth, requireAdminSecurity, async (_req, res) => {
	try {
		const caps = await prisma.adminCapability.findMany({
			where: { module_id: "ultra-security", active: true },
			orderBy: { sort_order: "asc" },
		});
		res.json(
			caps.map((c) => ({
				capability_id: c.capability_id,
				title: c.title,
				count: c.count,
				icon_name: c.icon_name,
				subtitle: c.subtitle,
			})),
		);
	} catch {
		res.status(500).json({ error: "Failed to fetch capabilities" });
	}
});

router.get("/config/total-config", requireAuth, requireAdminSecurity, async (_req, res) => {
	try {
		const [inventory, ui, roles, infraCaps, networkCaps, ultraCaps, actions] = await Promise.all([
			getInventoryWithFallback(),
			getUiConfigWithFallback(),
			getRoleConfigWithFallback(),
			prisma.adminCapability.findMany({
				where: { module_id: "infra", active: true },
				orderBy: { sort_order: "asc" },
			}),
			prisma.adminCapability.findMany({
				where: { module_id: "network", active: true },
				orderBy: { sort_order: "asc" },
			}),
			prisma.adminCapability.findMany({
				where: { module_id: "ultra-security", active: true },
				orderBy: { sort_order: "asc" },
			}),
			getActionsWithFallback(),
		]);

		res.json({
			inventory,
			ui_config: ui,
			roles,
			infra_capabilities: infraCaps.map((c) => ({
				capability_id: c.capability_id,
				title: c.title,
				count: c.count,
				icon_name: c.icon_name,
				subtitle: c.subtitle,
			})),
			network_capabilities: networkCaps.map((c) => ({
				capability_id: c.capability_id,
				title: c.title,
				count: c.count,
				icon_name: c.icon_name,
				subtitle: c.subtitle,
			})),
			ultra_capabilities: ultraCaps.map((c) => ({
				capability_id: c.capability_id,
				title: c.title,
				count: c.count,
				icon_name: c.icon_name,
				subtitle: c.subtitle,
			})),
			actions: actions || [],
		});
	} catch {
		res.status(500).json({ error: "Failed to fetch config" });
	}
});

export default router;

// Feed Page Config Routes
router.get("/config/feed-page", requireAuth, requireAdminSecurity, async (_req, res) => {
	try {
		const config = await readConfig();
		res.json(config.feed_page || {});
	} catch {
		res.status(500).json({ error: "Failed to fetch feed page config" });
	}
});

router.patch("/config/feed-page", requireAuth, requireAdminSecurity, async (req, res) => {
	try {
		const config = await readConfig();
		config.feed_page = { ...config.feed_page, ...req.body };
		await writeConfig(config);
		res.json(config.feed_page);
	} catch {
		res.status(500).json({ error: "Failed to update feed page config" });
	}
});

// Admin actions for Feed Page config management
router.post("/actions", requireAuth, requireAdminSecurity, async (req, res) => {
	try {
		const { action, payload } = req.body || {};

		if (action === "feed_page_config.update") {
			const config = await readConfig();
			const updates = payload || {};

			if (updates.feed_center) {
				config.feed_page.labels.feed_center = updates.feed_center;
			}
			if (updates.premium_badge) {
				config.feed_page.labels.premium_badge = updates.premium_badge;
			}
			if (updates.quick_actions) {
				config.feed_page.labels.quick_actions = updates.quick_actions;
			}
			if (updates.live_status) {
				config.feed_page.labels.live_status = updates.live_status;
			}
			if (updates.search) {
				config.feed_page.labels.search = updates.search;
			}
			if (updates.search_placeholder) {
				config.feed_page.labels.search_placeholder = updates.search_placeholder;
			}
			if (updates.categories) {
				config.feed_page.labels.categories = updates.categories;
			}
			if (updates.premium_experience) {
				config.feed_page.labels.premium_experience = updates.premium_experience;
			}
			if (updates.hero_title) {
				config.feed_page.labels.hero_title = updates.hero_title;
			}
			if (updates.hero_description) {
				config.feed_page.labels.hero_description = updates.hero_description;
			}
			if (updates.stats_buyer_requests) {
				config.feed_page.labels.stats.buyer_requests = updates.stats_buyer_requests;
			}
			if (updates.stats_company_products) {
				config.feed_page.labels.stats.company_products = updates.stats_company_products;
			}
			if (updates.stats_feed_posts) {
				config.feed_page.labels.stats.feed_posts = updates.stats_feed_posts;
			}
			if (updates.tabs) {
				config.feed_page.tabs = updates.tabs
					.split(",")
					.map((t) => t.trim())
					.filter(Boolean);
			}
			if (updates.messages_share_copied) {
				config.feed_page.messages.share_copied = updates.messages_share_copied;
			}
			if (updates.messages_report_submitted) {
				config.feed_page.messages.report_submitted = updates.messages_report_submitted;
			}
			if (updates.messages_interest_expressed) {
				config.feed_page.messages.interest_expressed = updates.messages_interest_expressed;
			}
			if (updates.messages_rate_limited) {
				config.feed_page.messages.rate_limited = updates.messages_rate_limited;
			}
			if (updates.messages_all_caught_up) {
				config.feed_page.messages.all_caught_up = updates.messages_all_caught_up;
			}
			if (updates.messages_no_results) {
				config.feed_page.messages.no_results = updates.messages_no_results;
			}
			if (updates.messages_load_failed) {
				config.feed_page.messages.load_failed = updates.messages_load_failed;
			}

			await writeConfig(config);
			return res.json({ ok: true, feed_page: config.feed_page });
		}

		if (action === "feed_page_config.get") {
			const config = await readConfig();
			return res.json({ ok: true, feed_page: config.feed_page });
		}

		res.status(400).json({ error: "Unknown action" });
	} catch {
		res.status(500).json({ error: "Action failed" });
	}
});
