import prisma from "../utils/prisma.js";

const DEFAULT_ADMIN_PANEL_FALLBACK_INVENTORY = [
	{
		id: "platform",
		label: "Core Platform & Business Control",
		icon_name: "ShieldCheck",
		sections: [],
	},
	{
		id: "infra",
		label: "Server / System / Infrastructure Management",
		icon_name: "Server",
		sections: [],
	},
	{
		id: "network",
		label: "Network Monitoring & Management",
		icon_name: "Network",
		sections: [],
	},
	{
		id: "server-admin",
		label: "Server Admin + App Management",
		icon_name: "Database",
		sections: [],
	},
	{
		id: "cms",
		label: "CMS + Content Management",
		icon_name: "Settings",
		sections: [],
	},
	{
		id: "ultra-security",
		label: "Ultra Security Layer",
		icon_name: "Lock",
		sections: [],
	},
];

const DEFAULT_PIE_PALETTE = ["#38bdf8", "#60a5fa", "#0f172a"];

const DEFAULT_CMS_WEEKLY_TREND = [
	{ name: "Mon", value: 24 },
	{ name: "Tue", value: 38 },
	{ name: "Wed", value: 29 },
	{ name: "Thu", value: 57 },
	{ name: "Fri", value: 44 },
	{ name: "Sat", value: 66 },
	{ name: "Sun", value: 52 },
];

const DEFAULT_ULTRA_MINI_CHART_POINTS = [22, 28, 24, 34, 30, 46, 40, 54, 50, 66, 58, 72];

const DEFAULT_ULTRA_MINI_CHART_KPIS = [
	{ label: "Requests", value: "12.8k" },
	{ label: "Integrity", value: "99.98%" },
	{ label: "Latency", value: "148ms" },
];

const DEFAULT_EMPTY_STATE_COPY = {
	"verification.pending.short": "No pending verifications.",
	"verification.pending": "No pending verifications in queue.",
	"disputes.none": "No active disputes.",
	"firewall.rules.none": "No rules yet.",
	"cron.jobs.none": "No cron jobs yet.",
};

const DEFAULT_ADMIN_PANEL_ALLOWED_ROLES = ["owner", "admin"];

const KNOWN_ROLES = ["buyer", "factory", "buying_house", "owner", "admin", "agent"];

const DEFAULT_GOVERNANCE_CONFIG = {
	initialPolicy: null,
	initialVersion: null,
	initialSimulation: null,
	initialTemplate: null,
	defaultRules: { maxWarnings: 1 },
};

const DEFAULT_SECTION_METRICS = {
	users: [
		{ label: "Total", path: "users.total" },
		{ label: "Premium", path: "users.premium" },
		{ label: "Suspended", path: "users.suspended" },
	],
	orgs: [
		{ label: "Orgs", path: "orgs.total" },
		{ label: "Staff", path: "orgs.staff" },
		{ label: "Agents", path: "orgs.agents" },
	],
	verification: [
		{ label: "Pending", path: "verification.pending" },
		{ label: "Expiring", path: "verification.expiring" },
	],
	finance: [
		{ label: "Subscriptions", path: "finance.subscriptions" },
		{ label: "Failed renewals", path: "finance.failed_renewals" },
		{
			label: "Revenue est.",
			path: "finance.revenue_estimate_usd",
			format: "currency",
		},
	],
	wallet: [
		{ label: "Balance", path: "wallet.total_balance_usd", format: "currency" },
		{ label: "Restricted", path: "wallet.restricted_usd", format: "currency" },
		{ label: "Redemptions", path: "wallet.redemptions" },
	],
	coupons: [
		{ label: "Total", path: "coupons.total" },
		{ label: "Active", path: "coupons.active" },
		{ label: "Redemptions", path: "coupons.redemptions" },
	],
	partners: [
		{ label: "Requests", path: "partners.requests" },
		{ label: "Active", path: "partners.active" },
	],
	requests: [
		{ label: "Total", path: "requests.total" },
		{ label: "Verified-only", path: "requests.verified_only" },
		{ label: "Matches", path: "requests.matches" },
	],
	contracts: [
		{ label: "Contracts", path: "contracts.total" },
		{ label: "Pending signatures", path: "contracts.pending_signatures" },
		{ label: "Payment proofs", path: "contracts.payment_proofs" },
	],
	calls: [
		{ label: "Calls", path: "calls.total" },
		{ label: "Recordings", path: "calls.recordings" },
	],
	messages: [
		{ label: "Messages", path: "messages.total" },
		{ label: "Violations", path: "messages.violations" },
		{ label: "Strikes", path: "messages.strikes" },
	],
	media: [
		{ label: "Video pending", path: "media.videos_pending" },
		{ label: "Docs pending", path: "media.docs_pending" },
	],
	support: [
		{ label: "Tickets", path: "support.tickets" },
		{ label: "Open", path: "support.open" },
	],
	notifications: [{ label: "Total", path: "notifications.total" }],
	analytics: [{ label: "Events", path: "analytics.total_events" }],
	search: [
		{ label: "Alerts", path: "search.alerts" },
		{ label: "Abuse flags", path: "search.abuse_flags" },
	],
	ai: [
		{ label: "Knowledge", path: "ai.knowledge_entries" },
		{ label: "Chatbot on", path: "ai.chatbot_enabled" },
	],
	system: [
		{ label: "Flags", path: "system.feature_flags" },
		{ label: "Plans", path: "system.plan_limits" },
	],
	security: [{ label: "Audit entries", path: "security.audit_entries" }],
	integrations: [
		{ label: "Gateways", path: "integrations.payment_gateways" },
		{ label: "Webhooks", path: "integrations.webhooks" },
		{ label: "API keys", path: "integrations.api_keys" },
	],
	traffic: [
		{ label: "Clicks", path: "traffic.clicks" },
		{ label: "Visits", path: "traffic.visits" },
		{ label: "Spend", path: "traffic.spend", format: "currency" },
		{ label: "CPC", path: "traffic.cpc", format: "currency" },
	],
	emails: [{ label: "Emails", path: "emails.total" }],
};

async function getInventoryWithFallback() {
	try {
		const modules = await prisma.adminModule.findMany({
			where: { active: true },
			include: {
				sections: {
					where: { active: true },
					orderBy: { sort_order: "asc" },
				},
			},
			orderBy: { sort_order: "asc" },
		});

		if (!modules || modules.length === 0) {
			return DEFAULT_ADMIN_PANEL_FALLBACK_INVENTORY;
		}

		return modules.map((m) => ({
			id: m.module_id,
			label: m.label,
			icon_name: m.icon_name,
			sections: m.sections.map((s) => ({
				id: s.section_id,
				title: s.title,
				features: s.features || [],
			})),
		}));
	} catch {
		return DEFAULT_ADMIN_PANEL_FALLBACK_INVENTORY;
	}
}

async function getInventoryByModule(moduleId) {
	try {
		const module = await prisma.adminModule.findUnique({
			where: { module_id: moduleId },
			include: {
				sections: {
					where: { active: true },
					orderBy: { sort_order: "asc" },
				},
			},
		});

		if (!module) {
			return null;
		}

		return {
			id: module.module_id,
			label: module.label,
			icon_name: module.icon_name,
			sections: module.sections.map((s) => ({
				id: s.section_id,
				title: s.title,
				features: s.features || [],
			})),
		};
	} catch {
		return null;
	}
}

async function updateInventoryConfig(data, actorId) {
	const resultCount = await prisma.$transaction(async (tx) => {
		let count = 0;

		for (const module of data.modules || []) {
			const savedModule = await tx.adminModule.upsert({
				where: { module_id: module.id },
				update: {
					label: module.label,
					icon_name: module.icon_name,
					sort_order: module.sort_order || 0,
					active: module.active !== false,
					updated_at: new Date(),
				},
				create: {
					module_id: module.id,
					label: module.label,
					icon_name: module.icon_name,
					sort_order: module.sort_order || 0,
					active: module.active !== false,
				},
			});
			count++;

			for (const section of module.sections || []) {
				await tx.adminSection.upsert({
					where: { section_id: section.id },
					update: {
						module_id: savedModule.id,
						title: section.title,
						features: section.features || [],
						sort_order: section.sort_order || 0,
						active: section.active !== false,
					},
					create: {
						section_id: section.id,
						module_id: savedModule.id,
						title: section.title,
						features: section.features || [],
						sort_order: section.sort_order || 0,
						active: section.active !== false,
					},
				});
				count++;
			}
		}

		await tx.adminConfigHistory.create({
			data: {
				config_type: "inventory",
				changed_by: actorId || "system",
				new_value: JSON.stringify(data),
			},
		});

		return count;
	});

	return { success: true, count: resultCount };
}

async function getActionsWithFallback() {
	try {
		const actions = await prisma.adminAction.findMany({
			where: { active: true },
			orderBy: { sort_order: "asc" },
		});

		if (!actions || actions.length === 0) {
			return null;
		}

		return actions.map((a) => ({
			id: a.action_id,
			label: a.label,
			category: a.category,
			route: "/admin/actions",
			fields: a.fields || [],
		}));
	} catch {
		return null;
	}
}

async function getActionsAsGroups() {
	try {
		const actions = await prisma.adminAction.findMany({
			where: { active: true },
			orderBy: { sort_order: "asc" },
		});

		if (!actions || actions.length === 0) {
			return null;
		}

		const groupsMap = new Map();
		for (const a of actions) {
			const groupLabel = a.group_label || "Other Actions";
			if (!groupsMap.has(groupLabel)) {
				groupsMap.set(groupLabel, { label: groupLabel, actions: [] });
			}
			groupsMap.get(groupLabel).actions.push({
				id: a.action_id,
				label: a.label,
				category: a.category,
				route: "/admin/actions",
				fields: a.fields || [],
			});
		}

		return Array.from(groupsMap.values());
	} catch {
		return null;
	}
}

async function updateActionsConfig(data, actorId) {
	const count = await prisma.$transaction(async (tx) => {
		let c = 0;
		for (const action of data.actions || []) {
			await tx.adminAction.upsert({
				where: { action_id: action.id },
				update: {
					label: action.label,
					category: action.category,
					fields: action.fields || [],
					sort_order: action.sort_order || 0,
					active: action.active !== false,
					updated_at: new Date(),
				},
				create: {
					action_id: action.id,
					label: action.label,
					category: action.category,
					fields: action.fields || [],
					sort_order: action.sort_order || 0,
					active: action.active !== false,
				},
			});
			c++;
		}

		await tx.adminConfigHistory.create({
			data: {
				config_type: "actions",
				changed_by: actorId || "system",
				new_value: JSON.stringify(data),
			},
		});

		return c;
	});

	return { success: true, count };
}

async function getCapabilitiesWithFallback(moduleId) {
	try {
		const where = moduleId ? { module_id: moduleId } : { active: true };
		const capabilities = await prisma.adminCapability.findMany({
			where,
			orderBy: { sort_order: "asc" },
		});

		if (!capabilities || capabilities.length === 0) {
			return null;
		}

		return capabilities.map((c) => ({
			capability_id: c.capability_id,
			module_id: c.module_id,
			title: c.title,
			count: c.count,
			icon_name: c.icon_name,
			subtitle: c.subtitle,
		}));
	} catch {
		return null;
	}
}

async function updateCapabilities(data, actorId) {
	const count = await prisma.$transaction(async (tx) => {
		let c = 0;
		for (const cap of data.capabilities || []) {
			await tx.adminCapability.upsert({
				where: { capability_id: cap.capability_id },
				update: {
					module_id: cap.module_id,
					title: cap.title,
					count: cap.count || 0,
					icon_name: cap.icon_name,
					subtitle: cap.subtitle,
					sort_order: cap.sort_order || 0,
					active: cap.active !== false,
				},
				create: {
					capability_id: cap.capability_id,
					module_id: cap.module_id,
					title: cap.title,
					count: cap.count || 0,
					icon_name: cap.icon_name,
					subtitle: cap.subtitle,
					sort_order: cap.sort_order || 0,
					active: cap.active !== false,
				},
			});
			c++;
		}

		await tx.adminConfigHistory.create({
			data: {
				config_type: "capabilities",
				changed_by: actorId || "system",
				new_value: JSON.stringify(data),
			},
		});

		return c;
	});

	return { success: true, count };
}

async function getUiConfigWithFallback() {
	try {
		const config = await prisma.adminUiConfig.findUnique({
			where: { id: "default" },
		});

		if (!config) {
			return {
				section_metrics: DEFAULT_SECTION_METRICS,
				chart_palette: DEFAULT_PIE_PALETTE,
				empty_states: DEFAULT_EMPTY_STATE_COPY,
			};
		}

		return {
			section_metrics: config.section_metrics || DEFAULT_SECTION_METRICS,
			chart_palette: config.chart_palette?.length >= 2 ? config.chart_palette : DEFAULT_PIE_PALETTE,
			empty_states: config.empty_states || DEFAULT_EMPTY_STATE_COPY,
		};
	} catch {
		return {
			section_metrics: DEFAULT_SECTION_METRICS,
			chart_palette: DEFAULT_PIE_PALETTE,
			empty_states: DEFAULT_EMPTY_STATE_COPY,
		};
	}
}

async function updateUiConfig(data, actorId) {
	const [config] = await prisma.$transaction(async (tx) => {
		const c = await tx.adminUiConfig.upsert({
			where: { id: "default" },
			update: {
				section_metrics: data.section_metrics,
				chart_palette: data.chart_palette,
				empty_states: data.empty_states,
				updated_at: new Date(),
			},
			create: {
				id: "default",
				section_metrics: data.section_metrics,
				chart_palette: data.chart_palette,
				empty_states: data.empty_states,
			},
		});

		await tx.adminConfigHistory.create({
			data: {
				config_type: "ui",
				changed_by: actorId || "system",
				new_value: JSON.stringify(data),
			},
		});

		return [c];
	});

	return { success: true, config };
}

async function getMockDataWithFallback(dataType) {
	try {
		const where = dataType ? { data_type: dataType } : { active: true };
		const mockData = await prisma.adminMockData.findMany({
			where,
			orderBy: { sort_order: "asc" },
		});

		if (!mockData || mockData.length === 0) {
			if (dataType === "cms_weekly_trend") {
				return DEFAULT_CMS_WEEKLY_TREND;
			}
			if (dataType === "ultra_mini_chart_points") {
				return DEFAULT_ULTRA_MINI_CHART_POINTS;
			}
			if (dataType === "ultra_mini_chart_kpis") {
				return DEFAULT_ULTRA_MINI_CHART_KPIS;
			}
			return null;
		}

		return mockData.map((m) => m.payload);
	} catch {
		return null;
	}
}

async function updateMockData(dataKey, payload, actorId) {
	const [saved] = await prisma.$transaction(async (tx) => {
		const s = await tx.adminMockData.upsert({
			where: { data_key: dataKey },
			update: {
				payload,
				active: true,
			},
			create: {
				data_key: dataKey,
				data_type: payload.data_type || "default",
				payload,
				active: true,
			},
		});

		await tx.adminConfigHistory.create({
			data: {
				config_type: "mock",
				changed_by: actorId || "system",
				new_value: JSON.stringify({ [dataKey]: payload }),
			},
		});

		return [s];
	});

	return { success: true, saved };
}

async function getRoleConfigWithFallback() {
	try {
		const roles = await prisma.adminRoleConfig.findMany({
			where: { active: true },
		});

		if (!roles || roles.length === 0) {
			return {
				known_roles: KNOWN_ROLES,
				allowed_roles: DEFAULT_ADMIN_PANEL_ALLOWED_ROLES,
			};
		}

		return {
			known_roles: roles.map((r) => r.role_key),
			allowed_roles: roles.filter((r) => r.is_admin_role).map((r) => r.role_key),
			roles: roles.map((r) => ({
				role_key: r.role_key,
				label: r.label,
				benefits: r.benefits || [],
			})),
		};
	} catch {
		return {
			known_roles: KNOWN_ROLES,
			allowed_roles: DEFAULT_ADMIN_PANEL_ALLOWED_ROLES,
		};
	}
}

async function updateRoleConfig(data, actorId) {
	const count = await prisma.$transaction(async (tx) => {
		let c = 0;
		for (const role of data.roles || []) {
			await tx.adminRoleConfig.upsert({
				where: { role_key: role.role_key },
				update: {
					label: role.label,
					is_admin_role: role.is_admin_role,
					benefits: role.benefits || [],
					active: role.active !== false,
				},
				create: {
					role_key: role.role_key,
					label: role.label,
					is_admin_role: role.is_admin_role,
					benefits: role.benefits || [],
					active: role.active !== false,
				},
			});
			c++;
		}

		await tx.adminConfigHistory.create({
			data: {
				config_type: "roles",
				changed_by: actorId || "system",
				new_value: JSON.stringify(data),
			},
		});

		return c;
	});

	return { success: true, count };
}

async function getGovernanceConfigWithFallback() {
	try {
		const config = await prisma.governanceConfig.findUnique({
			where: { id: "default" },
		});

		if (!config) {
			return DEFAULT_GOVERNANCE_CONFIG;
		}

		return {
			initial_policy: config.initial_policy,
			initial_version: config.initial_version,
			initial_simulation: config.initial_simulation,
			initial_template: config.initial_template,
			default_rules: config.default_rules || { maxWarnings: 1 },
		};
	} catch {
		return DEFAULT_GOVERNANCE_CONFIG;
	}
}

async function updateGovernanceConfig(data, actorId) {
	const [config] = await prisma.$transaction(async (tx) => {
		const c = await tx.governanceConfig.upsert({
			where: { id: "default" },
			update: {
				initial_policy: data.initial_policy,
				initial_version: data.initial_version,
				initial_simulation: data.initial_simulation,
				initial_template: data.initial_template,
				default_rules: data.default_rules,
				updated_at: new Date(),
			},
			create: {
				id: "default",
				initial_policy: data.initial_policy,
				initial_version: data.initial_version,
				initial_simulation: data.initial_simulation,
				initial_template: data.initial_template,
				default_rules: data.default_rules,
			},
		});

		await tx.adminConfigHistory.create({
			data: {
				config_type: "governance",
				changed_by: actorId || "system",
				new_value: JSON.stringify(data),
			},
		});

		return [c];
	});

	return { success: true, config };
}

async function getBrandingConfigWithFallback() {
	try {
		const branding = await prisma.adminBranding.findMany({
			where: { active: true },
		});

		if (!branding || branding.length === 0) {
			return {
				app_name: "GarTexHub",
				admin_title: "Admin Matrix",
				command_deck: "Command Deck",
			};
		}

		const map = {};
		for (const b of branding) {
			map[b.brand_key] = b.value;
		}

		return map;
	} catch {
		return {
			app_name: "GarTexHub",
			admin_title: "Admin Matrix",
			command_deck: "Command Deck",
		};
	}
}

async function updateBrandingConfig(data, actorId) {
	const count = await prisma.$transaction(async (tx) => {
		let c = 0;
		for (const [key, value] of Object.entries(data)) {
			await tx.adminBranding.upsert({
				where: { brand_key: key },
				update: {
					value,
					active: true,
				},
				create: {
					brand_key: key,
					value,
					active: true,
				},
			});
			c++;
		}

		await tx.adminConfigHistory.create({
			data: {
				config_type: "branding",
				changed_by: actorId || "system",
				new_value: JSON.stringify(data),
			},
		});

		return c;
	});

	return { success: true, count };
}

async function getSecurityPurposesWithFallback() {
	try {
		const purposes = await prisma.adminSecurityPurpose.findMany({
			where: { active: true },
		});

		if (!purposes || purposes.length === 0) {
			return { admin_security: "passkey" };
		}

		const map = {};
		for (const p of purposes) {
			map[p.purpose_key] = p.purpose_type;
		}

		return map;
	} catch {
		return { admin_security: "passkey" };
	}
}

async function updateSecurityPurposes(data, actorId) {
	const count = await prisma.$transaction(async (tx) => {
		let c = 0;
		for (const [key, type] of Object.entries(data)) {
			await tx.adminSecurityPurpose.upsert({
				where: { purpose_key: key },
				update: {
					purpose_type: type,
					active: true,
				},
				create: {
					purpose_key: key,
					purpose_type: type,
					active: true,
				},
			});
			c++;
		}

		await tx.adminConfigHistory.create({
			data: {
				config_type: "security",
				changed_by: actorId || "system",
				new_value: JSON.stringify(data),
			},
		});

		return c;
	});

	return { success: true, count };
}

async function getAllConfig() {
	const [inventory, uiConfig, mockData, roleConfig, governanceConfig, branding, security] =
		await Promise.all([
			getInventoryWithFallback(),
			getUiConfigWithFallback(),
			getMockDataWithFallback(),
			getRoleConfigWithFallback(),
			getGovernanceConfigWithFallback(),
			getBrandingConfigWithFallback(),
			getSecurityPurposesWithFallback(),
		]);

	return {
		inventory,
		ui: uiConfig,
		mock: mockData,
		roles: roleConfig,
		governance: governanceConfig,
		branding,
		security,
	};
}

async function getConfigHistory(configType, limit = 20) {
	try {
		const where = configType ? { config_type: configType } : {};
		return await prisma.adminConfigHistory.findMany({
			where,
			orderBy: { created_at: "desc" },
			take: limit,
		});
	} catch {
		return [];
	}
}

export {
	DEFAULT_ADMIN_PANEL_ALLOWED_ROLES,
	DEFAULT_ADMIN_PANEL_FALLBACK_INVENTORY,
	DEFAULT_CMS_WEEKLY_TREND,
	DEFAULT_EMPTY_STATE_COPY,
	DEFAULT_GOVERNANCE_CONFIG,
	DEFAULT_PIE_PALETTE,
	DEFAULT_SECTION_METRICS,
	DEFAULT_ULTRA_MINI_CHART_KPIS,
	DEFAULT_ULTRA_MINI_CHART_POINTS,
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
	KNOWN_ROLES,
	updateActionsConfig,
	updateBrandingConfig,
	updateCapabilities,
	updateGovernanceConfig,
	updateInventoryConfig,
	updateMockData,
	updateRoleConfig,
	updateSecurityPurposes,
	updateUiConfig,
};
