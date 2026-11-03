import {
	Activity,
	AlertTriangle,
	ArrowRight,
	ArrowUpRight,
	BadgeCheck,
	BarChart3,
	Bell,
	BookOpen,
	Bot,
	CalendarClock,
	CheckCircle2,
	ChevronDown,
	ChevronRight,
	CircuitBoard,
	ClipboardList,
	Clock3,
	Cloud,
	Cpu,
	Crown,
	Database,
	Download,
	Eye,
	FileText,
	Filter,
	Gauge,
	Globe,
	Globe2,
	HardDrive,
	Home,
	Inbox,
	KeyRound,
	Layers3,
	LayoutDashboard,
	Loader2,
	Lock,
	LockKeyhole,
	Mail,
	Menu,
	MonitorCog,
	Moon,
	MoonStar,
	Network,
	PanelLeftClose,
	RefreshCw,
	Search,
	Server,
	ServerCog,
	Settings,
	Shield,
	ShieldAlert,
	ShieldCheck,
	Sliders,
	SlidersHorizontal,
	Sparkle,
	Sparkles,
	Sun,
	SunMedium,
	TerminalSquare,
	Ticket,
	Trash2,
	UserCog,
	Users,
	Wifi,
	Workflow,
	Wrench,
	XCircle,
} from "lucide-react";

/** @type {Object<string, React.ComponentType>} */
const ICON_REGISTRY = {
	Activity,
	AlertTriangle,
	ArrowRight,
	Cloud,
	Inbox,
	ServerCog,
	Workflow,
	BadgeCheck,
	BarChart3,
	Bell,
	BookOpen,
	CalendarClock,
	CheckCircle2,
	ChevronDown,
	ChevronRight,
	ClipboardList,
	Clock3,
	Cpu,
	Database,
	Download,
	Eye,
	FileText,
	Globe,
	Globe2,
	Gauge,
	HardDrive,
	Layers3,
	LayoutDashboard,
	CircuitBoard,
	KeyRound,
	LockKeyhole,
	Loader2,
	Menu,
	MoonStar,
	PanelLeftClose,
	RefreshCw,
	Search,
	ShieldCheck,
	Filter,
	Sparkles,
	SlidersHorizontal,
	SunMedium,
	TerminalSquare,
	Trash2,
	UserCog,
	Users,
	Wifi,
	Wrench,
	ArrowUpRight,
	Network,
	Ticket,
	Mail,
	ShieldAlert,
	Moon,
	Sun,
	Shield,
	MonitorCog,
	Crown,
	Home,
	Lock,
	Settings,
	Sparkle,
	Server,
	Sliders,
	XCircle,
	Bot,
};

/** @type {Set<string>} */
export const KNOWN_ROLES = new Set(["buyer", "factory", "buying_house", "owner", "admin", "agent"]);

/** @type {string[]} */
export const DEFAULT_ADMIN_PANEL_ALLOWED_ROLES = ["owner", "admin"];

/** @type {Array<{id: string, label: string, icon_name: string, sections: []}>} */
export const DEFAULT_ADMIN_PANEL_FALLBACK_INVENTORY = [
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
		label: "Ultra Security Settings",
		icon_name: "Lock",
		sections: [],
	},
	{ id: "config", label: "Config Editor", icon_name: "Sliders", sections: [] },
];

/**
 * Normalizes a role string.
 * @param {string} value The role string.
 * @returns {string} The normalized string.
 */
export function normalizeRole(value = "") {
	return String(value || "")
		.trim()
		.toLowerCase();
}

/**
 * Gets allowed roles for the admin panel.
 * @param {Object} config The application configuration.
 * @returns {string[]} The allowed roles.
 */
export function getAdminPanelAllowedRoles(config) {
	const raw = config?.ui?.admin_panel?.allowed_roles;
	const list = Array.isArray(raw) ? raw.map(normalizeRole).filter(Boolean) : [];
	const filtered = list.filter((role) => KNOWN_ROLES.has(role));
	if (filtered.length === 0) {
		return DEFAULT_ADMIN_PANEL_ALLOWED_ROLES;
	}
	return filtered;
}

/**
 * Gets fallback inventory for admin panel.
 * @param {Object} config The application configuration.
 * @returns {Array<{id: string, label: string, icon_name: string, sections: []}>} The inventory.
 */
export function getAdminPanelFallbackInventory(config) {
	const raw = config?.ui?.admin_panel?.fallback_inventory;
	if (!(Array.isArray(raw) && raw.length > 0)) {
		return DEFAULT_ADMIN_PANEL_FALLBACK_INVENTORY;
	}
	const rows = raw
		.map((row) => {
			const id = String(row?.id || "").trim();
			const label = String(row?.label || "").trim();
			const iconName = String(row?.icon_name || "").trim();
			if (!(id && label)) {
				return null;
			}
			return { id, label, icon_name: iconName, sections: [] };
		})
		.filter(Boolean);
	return rows.length > 0 ? rows : DEFAULT_ADMIN_PANEL_FALLBACK_INVENTORY;
}

/**
 * Gets an icon component from registry.
 * @param {string} iconName The icon name.
 * @param {React.ComponentType} [fallback=ShieldCheck] The fallback component.
 * @returns {React.ComponentType} The icon component.
 */
export function getIconComponent(iconName = "", fallback = ShieldCheck) {
	const key = String(iconName || "").trim();
	return ICON_REGISTRY[key] || fallback;
}

/** @type {Array<{title: string, count: number, icon: React.ComponentType, subtitle: string}>} */
export const INFRA_CAPABILITIES = [
	{
		title: "System Health & Performance Monitoring",
		count: 5,
		icon: Activity,
		subtitle: "Real-time signals, resource visibility, and operational pulse.",
	},
	{
		title: "OS & Software Maintenance",
		count: 4,
		icon: Server,
		subtitle: "Safe updates, package checks, and controlled maintenance flows.",
	},
	{
		title: "User & Security Administration",
		count: 5,
		icon: UserCog,
		subtitle: "Accounts, SSH keys, access, and permission hygiene.",
	},
	{
		title: "Backup & Disaster Recovery",
		count: 3,
		icon: Database,
		subtitle: "Retention, recovery posture, and scheduled protection.",
	},
	{
		title: "Networking & System Settings",
		count: 2,
		icon: Wifi,
		subtitle: "Firewall, SSL, DNS, timezone, and NTP coordination.",
	},
];

/** @type {Array<{title: string, count: number, items: string[]}>} */
export const NETWORK_CAPABILITIES = [
	{
		title: "Real-Time Monitoring & Visibility",
		count: 4,
		items: ["Interface health", "Packet loss", "Latency heatmap", "Topology map"],
	},
	{
		title: "Configuration & Management",
		count: 5,
		items: ["Device templates", "Change pushes", "Versioned config", "Rollback safety"],
	},
	{
		title: "Security Management",
		count: 5,
		items: ["IDS/IPS feeds", "Rogue AP detection", "Policy drift", "Threat posture"],
	},
	{
		title: "Traffic & Bandwidth Analysis",
		count: 3,
		items: ["NetFlow insight", "QoS review", "Bandwidth trends"],
	},
	{
		title: "Troubleshooting & Alerting",
		count: 3,
		items: ["Incident timeline", "Anomaly triage", "Auto-escalation"],
	},
	{
		title: "Asset & User Management",
		count: 3,
		items: ["Inventory sync", "Auth roles", "Ownership tracking"],
	},
];

/**
 * Converts a list to a textarea string.
 * @param {string[]} value The list.
 * @returns {string} The textarea string.
 */
export function listToTextarea(value) {
	return Array.isArray(value) ? value.join("\n") : "";
}

/**
 * Converts a textarea string to a list.
 * @param {string} value The textarea string.
 * @returns {string[]} The list.
 */
export function textareaToList(value) {
	const raw = String(value || "").split(/[\n,]/);
	const cleaned = raw.map((entry) => entry.trim()).filter(Boolean);
	return [...new Set(cleaned)];
}

export { cn } from "../lib/cn.js";

/** @type {Object<string, Array<{label: string, path: string}>>} */
export const SECTION_METRICS = {
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
	subscriptions: [
		{ label: "Active", path: "subscriptions.active" },
		{ label: "Trialing", path: "subscriptions.trialing" },
		{ label: "Canceled", path: "subscriptions.canceled" },
	],
	contracts: [
		{ label: "Total", path: "contracts.total" },
		{ label: "Pending", path: "contracts.pending" },
		{ label: "Completed", path: "contracts.completed" },
	],
	moderation: [
		{ label: "Flagged", path: "moderation.flagged" },
		{ label: "Auto-removed", path: "moderation.auto_removed" },
	],
};

/** @type {Object<string, Array<{label: string, path: string, icon: React.ComponentType, format: string, tone?: string}>>} */
export const METRIC_CARDS = {
	users: [
		{
			label: "Total Users",
			path: "users.total",
			icon: Users,
			format: "number",
		},
		{ label: "Premium", path: "users.premium", icon: Crown, format: "number" },
		{
			label: "Suspended",
			path: "users.suspended",
			icon: XCircle,
			format: "number",
			tone: "rose",
		},
	],
	orgs: [
		{
			label: "Total Orgs",
			path: "orgs.total",
			icon: Layers3,
			format: "number",
		},
		{ label: "Staff", path: "orgs.staff", icon: Users, format: "number" },
		{ label: "Agents", path: "orgs.agents", icon: UserCog, format: "number" },
	],
	verification: [
		{
			label: "Pending",
			path: "verification.pending",
			icon: Clock3,
			format: "number",
			tone: "amber",
		},
		{
			label: "Expiring",
			path: "verification.expiring",
			icon: AlertTriangle,
			format: "number",
			tone: "rose",
		},
		{
			label: "Verified",
			path: "verification.verified",
			icon: BadgeCheck,
			format: "number",
			tone: "emerald",
		},
	],
	contracts: [
		{
			label: "Total",
			path: "contracts.total",
			icon: FileText,
			format: "number",
		},
		{
			label: "Pending",
			path: "contracts.pending",
			icon: Clock3,
			format: "number",
			tone: "amber",
		},
		{
			label: "Completed",
			path: "contracts.completed",
			icon: CheckCircle2,
			format: "number",
			tone: "emerald",
		},
	],
	moderation: [
		{
			label: "Flagged",
			path: "moderation.flagged",
			icon: AlertTriangle,
			format: "number",
			tone: "rose",
		},
		{
			label: "Reviewed",
			path: "moderation.reviewed",
			icon: Eye,
			format: "number",
		},
		{
			label: "Auto-Removed",
			path: "moderation.auto_removed",
			icon: Trash2,
			format: "number",
			tone: "orange",
		},
	],
};

/** @type {Object<string, {title: string, items: string[]}>} */
export const DEFAULT_BENEFITS = {
	factory: {
		title: "Factory Benefits",
		items: [
			"Verified factory status",
			"Direct buyer connections",
			"Production capacity showcase",
			"Quality certification badges",
			"Real-time inquiry management",
		],
	},
	buying_house: {
		title: "Buying House Benefits",
		items: [
			"Sourcing dashboard",
			"Supplier verification tools",
			"Bulk order management",
			"Commission tracking",
			"Team collaboration",
		],
	},
	buyer: {
		title: "Buyer Benefits",
		items: [
			"Verified supplier network",
			"RFQ management",
			"Secure escrow payments",
			"Order tracking",
			"Trade assurance",
		],
	},
};

/**
 * Returns the CSS classes for the status badge.
 * @returns {Object<string, string>} The CSS class map.
 */
export function statusBadge() {
	return {
		pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
		approved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
		rejected: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
		default: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
	};
}

/**
 * Formats a number for display.
 * @param {number|string} value The value to format.
 * @returns {string} The formatted number string.
 */
export function formatNumber(value) {
	if (value === null || value === undefined) {
		return "0";
	}
	const num = Number(value);
	if (Number.isNaN(num)) {
		return "0";
	}
	if (num >= 1_000_000) {
		return `${(num / 1_000_000).toFixed(1)}M`;
	}
	if (num >= 1000) {
		return `${(num / 1000).toFixed(1)}K`;
	}
	return String(num);
}

/**
 * Formats a currency value for display.
 * @param {number|string} value The currency value.
 * @returns {string} The formatted currency string.
 */
export function formatCurrency(value) {
	if (value === null || value === undefined) {
		return "$0";
	}
	const num = Number(value);
	if (Number.isNaN(num)) {
		return "$0";
	}
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		minimumFractionDigits: 0,
		maximumFractionDigits: 0,
	}).format(num);
}

/**
 * Resolves a nested path in an object.
 * @param {Object} source The source object.
 * @param {string} path The dot-notation path.
 * @returns {*} The resolved value or null.
 */
export function _resolvePath(source, path) {
	if (!path) {
		return source;
	}
	const keys = path.split(".");
	let result = source;
	for (const key of keys) {
		if (result === null || result === undefined) {
			return null;
		}
		result = result[key];
	}
	return result;
}

/**
 * Exports user emails to a CSV file with enriched non-sensitive fields.
 * @param {Array<{email: string, name: string, role: string, verified: boolean, company?: string, plan?: string, created_at?: string, last_active?: string, country?: string, status?: string}>} rows The list of user objects.
 */
export function exportEmailsCsv(rows = []) {
	if (!(Array.isArray(rows) && rows.length > 0)) {
		return;
	}
	const headers = [
		"Email",
		"Name",
		"Role",
		"Verified",
		"Company",
		"Plan",
		"Country",
		"Joined Date",
		"Last Active",
		"Account Status",
	];
	const t = (v) => String(v ?? "").replace(/"/g, '""');
	const csv = [
		headers.join(","),
		...rows.map((r) =>
			[
				t(r.email),
				t(r.name),
				t(r.role),
				t(r.verified),
				t(r.company || r.company_name || ""),
				t(r.plan || r.plan_type || ""),
				t(r.country || ""),
				t(r.created_at ? new Date(r.created_at).toISOString().split("T")[0] : ""),
				t(r.last_active ? new Date(r.last_active).toISOString().split("T")[0] : ""),
				t(r.status || (r.banned ? "Banned" : r.verified ? "Active" : "Pending")),
			].join(","),
		),
	].join("\n");
	const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	const timestamp = new Date().toISOString().slice(0, 10);
	a.href = url;
	a.download = `users_export_${timestamp}.csv`;
	a.click();
	URL.revokeObjectURL(url);
}

/** @type {string} */
export const NO_DATA_LABEL = "No Data";

/**
 * Checks if a value is a valid hex color code.
 * @param {string|number} value The color string.
 * @returns {boolean} True if valid hex color.
 */
export function isHexColor(value) {
	return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(String(value || "").trim());
}

/**
 * Gets the pie chart color palette from configuration.
 * @param {Object} _config The application configuration (unused).
 * @returns {string[]} The palette colors.
 */
export function getAdminPanelPiePalette(_config) {
	return DEFAULT_PIE_PALETTE;
}

/**
 * Gets the CMS weekly trend fallback data.
 * @param {Object} config The application configuration.
 * @returns {Array<{name: string, value: number}>} The trend data.
 */
export function getCmsWeeklyTrendFallback(config) {
	const raw = config?.ui?.admin_panel?.fallbacks?.cms?.weekly_trend;
	if (!(Array.isArray(raw) && raw.length > 0)) {
		return DEFAULT_CMS_WEEKLY_TREND;
	}
	return raw
		.map((item) => {
			const name = String(item?.name || item?.day || item?.label || "").trim();
			const value = Number(item?.value ?? item?.count ?? item?.users ?? 0);
			if (!(name && Number.isFinite(value))) {
				return null;
			}
			return { name, value };
		})
		.filter(Boolean)
		.slice(0, 31);
}

/**
 * Gets ultra security mini chart points.
 * @param {Object} config The application configuration.
 * @returns {number[]} The points.
 */
export function getUltraMiniChartPoints(config) {
	const raw = config?.ui?.admin_panel?.fallbacks?.ultra_security?.mini_chart_points;
	if (!Array.isArray(raw) || raw.length < 3) {
		return DEFAULT_ULTRA_MINI_CHART_POINTS;
	}
	return raw.map(Number).filter(Number.isFinite).slice(0, 60);
}

/**
 * Gets ultra security KPI metrics.
 * @param {Object} config The application configuration.
 * @returns {Array<{label: string, value: string}>} The KPIs.
 */
export function getUltraMiniChartKpis(config) {
	const raw = config?.ui?.admin_panel?.fallbacks?.ultra_security?.mini_chart_kpis;
	if (!(Array.isArray(raw) && raw.length > 0)) {
		return DEFAULT_ULTRA_MINI_CHART_KPIS;
	}
	return raw
		.map((item) => ({
			label: String(item?.label || "").trim(),
			value: String(item?.value || "").trim(),
		}))
		.filter((item) => item.label && item.value)
		.slice(0, 6);
}

/**
 * Gets ultra security capabilities.
 * @param {Object} config The application configuration.
 * @returns {string[]} The capabilities.
 */
export function getUltraSecurityCapabilities(config) {
	const raw = config?.ui?.admin_panel?.fallbacks?.ultra_security?.capabilities;
	const list = Array.isArray(raw)
		? raw
				.map(String)
				.map((s) => s.trim())
				.filter(Boolean)
		: [];
	const unique = [...new Set(list)];
	return unique.length > 0 ? unique.slice(0, 30) : ULTRA_CAPABILITIES_DEFAULT;
}

/**
 * Gets the no data label for contracts.
 * @param {Object} config The application configuration.
 * @returns {string} The label.
 */
export function getContractNoDataLabel(config) {
	return (
		String(config?.ui?.admin_panel?.fallbacks?.contract_status?.no_data_label || "").trim() ||
		NO_DATA_LABEL
	);
}

/**
 * Gets empty state copy text.
 * @param {Object} config The application configuration.
 * @param {string} key The key.
 * @param {string} fallback The fallback text.
 * @returns {string} The copy text.
 */
export function getEmptyStateCopy(config, key, fallback) {
	const path = String(key || "").trim();
	const copy = config?.ui?.admin_panel?.copy?.empty_states?.[path];
	return (
		String(copy || "").trim() ||
		(DEFAULT_EMPTY_STATE_COPY[path] ? DEFAULT_EMPTY_STATE_COPY[path] : fallback)
	);
}

/** @type {string[]} */
export const ULTRA_CAPABILITIES_DEFAULT = [
	"Advanced Search Filters",
	"Priority Buyer Request Placement",
	"Dedicated Support",
	"Contract History & Audit Trail",
	"Early Access to New Verified Factories",
	"Buying Pattern Analysis",
	"Order Completion Certification",
	"Verified Supplier Directory",
	"Real-time Messaging",
	"Video Call Capability",
	"Secure Document Sharing",
	"Escrow Payment Protection",
	"Quality Inspection Reports",
	"Logistics Tracking",
	"Custom RFQ Templates",
];

/** @type {Array<{name: string, value: number}>} */
export const DEFAULT_CMS_WEEKLY_TREND = [
	{ name: "Mon", value: 12 },
	{ name: "Tue", value: 19 },
	{ name: "Wed", value: 15 },
	{ name: "Thu", value: 22 },
	{ name: "Fri", value: 28 },
	{ name: "Sat", value: 18 },
	{ name: "Sun", value: 10 },
];

/** @type {number[]} */
export const DEFAULT_ULTRA_MINI_CHART_POINTS = [12, 19, 15, 22, 28, 18, 10, 14, 20, 25, 30, 22];

/** @type {Array<{label: string, value: string}>} */
export const DEFAULT_ULTRA_MINI_CHART_KPIS = [
	{ label: "Active Users", value: "2,847" },
	{ label: "Total Revenue", value: "$124.5K" },
	{ label: "Conversion Rate", value: "12.4%" },
	{ label: "Avg. Session", value: "8m 32s" },
];

/** @type {Object<string, string>} */
export const DEFAULT_EMPTY_STATE_COPY = {
	no_verifications: "No pending verifications at this time.",
	no_contracts: "No contracts found. Start by creating your first contract.",
	no_contracts_by_status: "No contracts found with this status.",
	no_contracts_by_org: "No contracts found for this organization.",
	no_subscriptions: "No active subscriptions.",
	no_moderation_cases: "No moderation cases to review.",
};

/** @type {string[]} */
export const BUYER_BENEFITS_DEFAULT = DEFAULT_BENEFITS.buyer.items;
/** @type {string[]} */
export const FACTORY_BENEFITS_DEFAULT = DEFAULT_BENEFITS.factory.items;
/** @type {string[]} */
export const BUYING_HOUSE_BENEFITS_DEFAULT = DEFAULT_BENEFITS.buying_house.items;

/** @type {string[]} */
export const DEFAULT_PIE_PALETTE = [
	"#3773a8",
	"#10B981",
	"#F59E0B",
	"#EF4444",
	"#8B5CF6",
	"#EC4899",
	"#1d9999",
	"#84CC16",
];
