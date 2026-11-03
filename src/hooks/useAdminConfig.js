import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
	fetchActionGroups as fetchActionGroupsThunk,
	fetchActions as fetchActionsThunk,
	fetchAdminConfig,
	fetchCapabilities as fetchCapabilitiesThunk,
	fetchInventory as fetchInventoryThunk,
	fetchRoles as fetchRolesThunk,
	fetchUiConfig as fetchUiConfigThunk,
} from "../store/configSlice.js";

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
const DEFAULT_PIE_PALETTE = ["#6dabdf", "#6aa1d4", "#0f172a"];
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
const DEFAULT_SECTION_METRICS = {
	wallet: [{ label: "Balance", path: "wallet.total_balance_usd", format: "currency" }],
};
const DEFAULT_ADMIN_PANEL_ALLOWED_ROLES = ["owner", "admin"];
const KNOWN_ROLES = ["buyer", "factory", "buying_house", "owner", "admin", "agent"];
const INFRA_CAPABILITIES_DEFAULT = [
	{
		capability_id: "system_health",
		title: "System Health & Performance Monitoring",
		count: 5,
		icon_name: "Activity",
		subtitle: "Real-time signals, resource visibility, and operational pulse.",
	},
	{
		capability_id: "os_maintenance",
		title: "OS & Software Maintenance",
		count: 4,
		icon_name: "Server",
		subtitle: "Safe updates, package checks, and controlled maintenance flows.",
	},
];
const NETWORK_CAPABILITIES_DEFAULT = [
	{
		capability_id: "monitoring",
		title: "Real-Time Monitoring & Visibility",
		count: 4,
		icon_name: "Activity",
		subtitle: "Interface health, packet loss, latency heatmap.",
	},
];
const ULTRA_CAPABILITIES_DEFAULT = [
	"Zero-Trust Access Controls",
	"Role-Based Permissions",
	"Audit Logging",
	"Encrypted Data Storage",
	"Multi-Factor Authentication",
	"Real-Time Threat Detection",
	"Compliance Management",
	"Secure API Gateway",
];
const BUYER_BENEFITS_DEFAULT = ["Access to factory network", "Request quotations", "Track orders"];
const FACTORY_BENEFITS_DEFAULT = ["Receive RFQs", "Manage products", "Track shipments"];
const BUYING_HOUSE_BENEFITS_DEFAULT = [
	"Manage multiple buyers",
	"Commission tracking",
	"Supplier network",
];

/**
 * Hook to retrieve full admin configuration including inventory, UI settings, roles, and capabilities.
 * @returns {Object} Admin configuration state and helper functions.
 */
export function useAdminFullConfig() {
	const dispatch = useDispatch();
	const { config, loading, error } = useSelector((s) => s.config);

	useEffect(() => {
		dispatch(fetchAdminConfig());
	}, [dispatch]);

	const state = useSelector((s) => s.config);
	const inventory = state.config?.inventory || DEFAULT_ADMIN_PANEL_FALLBACK_INVENTORY;
	const uiConfig = state.config?.ui_config || {};
	const roles = state.config?.roles || {};
	const infraCapabilities =
		state.config?.infra_capabilities?.length > 0
			? state.config.infra_capabilities
			: INFRA_CAPABILITIES_DEFAULT;
	const networkCapabilities =
		state.config?.network_capabilities?.length > 0
			? state.config.network_capabilities
			: NETWORK_CAPABILITIES_DEFAULT;
	const ultraCapabilities =
		state.config?.ultra_capabilities?.length > 0
			? state.config.ultra_capabilities
			: ULTRA_CAPABILITIES_DEFAULT;
	const actions = state.config?.actions || [];
	const rolesList = state.config?.roles?.roles || [];
	const knownRoles = roles?.known_roles || KNOWN_ROLES;
	const allowedRoles = roles?.allowed_roles || DEFAULT_ADMIN_PANEL_ALLOWED_ROLES;
	const piePalette =
		uiConfig?.chart_palette?.length >= 2 ? uiConfig.chart_palette : DEFAULT_PIE_PALETTE;
	const sectionMetrics = uiConfig?.section_metrics || DEFAULT_SECTION_METRICS;
	const emptyStates = uiConfig?.empty_states || DEFAULT_EMPTY_STATE_COPY;
	const cmsWeeklyTrend = DEFAULT_CMS_WEEKLY_TREND;
	const ultraMiniChartPoints = DEFAULT_ULTRA_MINI_CHART_POINTS;
	const ultraMiniChartKpis = DEFAULT_ULTRA_MINI_CHART_KPIS;

	return {
		config,
		loading,
		error,
		refetch: () => dispatch(fetchAdminConfig()),
		inventory,
		uiConfig,
		roles,
		infraCapabilities,
		networkCapabilities,
		ultraCapabilities,
		actions,
		rolesList,
		knownRoles,
		allowedRoles,
		piePalette,
		sectionMetrics,
		emptyStates,
		cmsWeeklyTrend,
		ultraMiniChartPoints,
		ultraMiniChartKpis,
	};
}

/**
 * Hook to retrieve inventory configuration.
 * @returns {Object} Inventory list and loading state.
 */
export function useInventory() {
	const dispatch = useDispatch();
	const { inventory, inventoryLoading: loading } = useSelector((s) => s.config);

	useEffect(() => {
		dispatch(fetchInventoryThunk());
	}, [dispatch]);

	return {
		inventory: inventory.length > 0 ? inventory : DEFAULT_ADMIN_PANEL_FALLBACK_INVENTORY,
		loading,
	};
}

/**
 * Hook to retrieve UI configuration.
 * @returns {Object} UI configuration object and loading state.
 */
export function useUiConfig() {
	const dispatch = useDispatch();
	const { uiConfig, uiConfigLoading: loading } = useSelector((s) => s.config);

	useEffect(() => {
		dispatch(fetchUiConfigThunk());
	}, [dispatch]);

	return {
		...uiConfig,
		loading,
		piePalette: uiConfig.chart_palette,
		sectionMetrics: uiConfig.section_metrics,
		emptyStates: uiConfig.empty_states,
	};
}

/**
 * Hook to retrieve capabilities for a specific module.
 * @param {string} moduleId - The ID of the module.
 * @returns {Object} Capabilities object and loading state.
 */
export function useCapabilities(moduleId) {
	const dispatch = useDispatch();
	const { capabilities, capabilitiesLoading: loading } = useSelector((s) => s.config);

	useEffect(() => {
		if (moduleId) {
			dispatch(fetchCapabilitiesThunk(moduleId));
		}
	}, [dispatch, moduleId]);

	return { capabilities, loading };
}

/**
 * Hook to retrieve available actions.
 * @returns {Object} Actions array and loading state.
 */
export function useActions() {
	const dispatch = useDispatch();
	const { actions, actionsLoading: loading } = useSelector((s) => s.config);

	useEffect(() => {
		dispatch(fetchActionsThunk());
	}, [dispatch]);

	return { actions, loading };
}

/**
 * Hook to retrieve action groups.
 * @returns {Object} Action groups and loading state.
 */
export function useActionGroups() {
	const dispatch = useDispatch();
	const { actionGroups: groups, actionGroupsLoading: loading } = useSelector((s) => s.config);

	useEffect(() => {
		dispatch(fetchActionGroupsThunk());
	}, [dispatch]);

	return { groups, loading };
}

/**
 * Hook to retrieve role configuration.
 * @returns {Object} Role configuration and loading state.
 */
export function useRoleConfig() {
	const dispatch = useDispatch();
	const { roleConfig, roleConfigLoading: loading } = useSelector((s) => s.config);

	useEffect(() => {
		dispatch(fetchRolesThunk());
	}, [dispatch]);

	const roles = roleConfig.roles || [];
	return {
		...roleConfig,
		loading,
		knownRoles: roleConfig.known_roles,
		allowedRoles: roleConfig.allowed_roles,
		rolesList: roles,
		buyerBenefits: roles.find((r) => r.role_key === "buyer")?.benefits || BUYER_BENEFITS_DEFAULT,
		factoryBenefits:
			roles.find((r) => r.role_key === "factory")?.benefits || FACTORY_BENEFITS_DEFAULT,
		buyingHouseBenefits:
			roles.find((r) => r.role_key === "buying_house")?.benefits || BUYING_HOUSE_BENEFITS_DEFAULT,
	};
}

export {
	BUYER_BENEFITS_DEFAULT,
	BUYING_HOUSE_BENEFITS_DEFAULT,
	DEFAULT_ADMIN_PANEL_ALLOWED_ROLES,
	DEFAULT_ADMIN_PANEL_FALLBACK_INVENTORY,
	DEFAULT_CMS_WEEKLY_TREND,
	DEFAULT_EMPTY_STATE_COPY,
	DEFAULT_PIE_PALETTE,
	DEFAULT_SECTION_METRICS,
	DEFAULT_ULTRA_MINI_CHART_KPIS,
	DEFAULT_ULTRA_MINI_CHART_POINTS,
	FACTORY_BENEFITS_DEFAULT,
	INFRA_CAPABILITIES_DEFAULT,
	KNOWN_ROLES,
	NETWORK_CAPABILITIES_DEFAULT,
	ULTRA_CAPABILITIES_DEFAULT,
};
