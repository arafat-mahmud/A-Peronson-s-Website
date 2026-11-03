import * as Utils from "./AdminPanel.utils.js";

/**
 * Returns the CSS classes for the status badge.
 * @returns {string} The CSS class string.
 */
export function statusBadge() {
	return "bg-emerald-400/20 text-emerald-200";
}

/**
 * Formats a number for display.
 * @param {number|string} value The value to format.
 * @returns {string} The formatted number string.
 */
export function formatNumber(value) {
	const num = Number(value || 0);
	return Number.isFinite(num) ? num.toLocaleString() : "0";
}

/**
 * Formats a currency value for display.
 * @param {number|string} value The currency value.
 * @returns {string} The formatted currency string.
 */
export function formatCurrency(value) {
	const num = Number(value || 0);
	return Number.isFinite(num)
		? `$${num.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
		: "$0";
}

/**
 * Resolves a nested path in an object.
 * @param {Object} source The source object.
 * @param {string} path The dot-notation path.
 * @returns {*} The resolved value or undefined.
 */
export function _resolvePath(source, path) {
	if (!(source && path)) {
		return;
	}
	return path
		.split(".")
		.reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), source);
}

/**
 * Exports user emails to a CSV file.
 * @param {Array<{email: string}>} rows The list of user objects.
 */
export function exportEmailsCsv(rows = []) {
	const emails = rows.map((u) => u.email).filter(Boolean);
	const csv = ["email", ...emails].join("\n");
	const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = "gartexhub_emails.csv";
	link.click();
	URL.revokeObjectURL(url);
}

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
 * @param {Object} config The application configuration.
 * @returns {string[]|null} The palette colors or null.
 */
export function getAdminPanelPiePalette(config) {
	const raw = config?.ui?.admin_panel?.theme?.pie_palette;
	if (!Array.isArray(raw)) {
		return null;
	}
	const colors = raw
		.map((s) => String(s || "").trim())
		.filter(Boolean)
		.filter(isHexColor);
	return colors.length >= 2 ? colors.slice(0, 12) : null;
}

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

/** @type {number[]} */
export const DEFAULT_ULTRA_MINI_CHART_POINTS = [12, 19, 15, 22, 28, 18, 10, 14, 20, 25, 30, 22];

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
	const points = raw.map(Number).filter(Number.isFinite);
	return points.length >= 3 ? points.slice(0, 60) : DEFAULT_ULTRA_MINI_CHART_POINTS;
}

/** @type {Array<{label: string, value: string}>} */
export const DEFAULT_ULTRA_MINI_CHART_KPIS = [
	{ label: "Active Users", value: "2,847" },
	{ label: "Total Revenue", value: "$124.5K" },
	{ label: "Conversion Rate", value: "12.4%" },
	{ label: "Avg. Session", value: "8m 32s" },
];

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

/** @type {string} */
export const DEFAULT_CONTRACT_NO_DATA_LABEL = "No Data";

/**
 * Gets the no data label for contracts.
 * @param {Object} config The application configuration.
 * @returns {string} The label.
 */
export function getContractNoDataLabel(config) {
	const raw = config?.ui?.admin_panel?.fallbacks?.contract_status?.no_data_label;
	const value = String(raw || "").trim();
	return value || DEFAULT_CONTRACT_NO_DATA_LABEL;
}

/** @type {Object<string, string>} */
export const DEFAULT_EMPTY_STATE_COPY = {
	no_verifications: "No pending verifications at this time.",
	no_contracts: "No contracts found. Start by creating your first contract.",
	no_contracts_by_status: "No contracts found with this status.",
	no_contracts_by_org: "No contracts found for this organization.",
	no_subscriptions: "No active subscriptions.",
	no_moderation_cases: "No moderation cases to review.",
};

/**
 * Gets empty state copy text.
 * @param {Object} config The application configuration.
 * @param {string} key The key.
 * @param {string} fallback The fallback text.
 * @returns {string} The copy text.
 */
export function getEmptyStateCopy(config, key, fallback) {
	const k = String(key || "").trim();
	const raw = config?.ui?.admin_panel?.copy?.empty_states?.[k];
	const value = String(raw || "").trim();
	if (value) {
		return value;
	}
	if (DEFAULT_EMPTY_STATE_COPY[k]) {
		return DEFAULT_EMPTY_STATE_COPY[k];
	}
	return fallback;
}

/** @type {string[]} */
export const buyerBenefits = [
	"Advanced Search Filters",
	"Priority Buyer Request Placement",
	"Dedicated Support",
	"Contract History & Audit Trail",
	"Early Access to New Verified Factories",
	"Buying Pattern Analysis",
	"Order Completion Certification",
	"AI Auto-reply Customization",
	"Smart Supplier Matching",
	"Request Performance Insights",
	"Profile, product boost & increased reach",
];

/** @type {string[]} */
export const factoryBenefits = [
	"Profile, product boost & increased reach",
	"Advanced analytics (who viewed, inquiry rate)",
	"Priority in search results & filters",
	"AI auto-reply customization",
	"Dedicated account manager",
	"Custom branding on profile",
	"Enterprise analytics dashboard",
	"Unlimited agent/sub-ID creation",
	"Buying Pattern Analysis",
	"Order Completion Certification",
	"Verified factory profile badge",
	"Production capacity showcase",
	"Direct access to verified buyers",
];

/** @type {string[]} */
export const buyingHouseBenefits = [
	"Multi-factory management dashboard",
	"Team collaboration tools",
	"Sourcing analytics",
	"Commission tracking",
	"Custom sourcing workflows",
	"Verified factory network access",
	"Bulk order management",
	"AI-powered supplier matching",
	"Quality assurance tools",
	"Real-time order tracking",
	"Profile, product boost & increased reach",
];

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

/**
 * Gets the pie chart color palette.
 * @param {Object} config The application configuration.
 * @returns {string[]} The palette colors.
 */
export function getPiePalette(config) {
	const fromConfig = getAdminPanelPiePalette(config);
	return fromConfig || DEFAULT_PIE_PALETTE;
}

export { cn } from "../lib/cn.js";

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
	const filtered = list.filter((role) => Utils.KNOWN_ROLES.has(role));
	if (filtered.length === 0) {
		return Utils.DEFAULT_ADMIN_PANEL_ALLOWED_ROLES;
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
		return Utils.DEFAULT_ADMIN_PANEL_FALLBACK_INVENTORY;
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

	return rows.length > 0 ? rows : Utils.DEFAULT_ADMIN_PANEL_FALLBACK_INVENTORY;
}

/**
 * Gets an icon component from registry.
 * @param {Object} ICON_REGISTRY The registry object.
 * @param {string} iconName The icon name.
 * @param {React.ComponentType} fallback The fallback component.
 * @returns {React.ComponentType} The icon component.
 */
export function getIconComponent(ICON_REGISTRY, iconName, fallback) {
	const key = String(iconName || "").trim();
	return ICON_REGISTRY[key] || fallback;
}

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

/** @type {Array<{label: string, actions: Array<{id: string, label: string, route: string, fields: Array<{key: string, label: string}>}>}>} */
export const ACTION_GROUPS = [
	{
		label: "Platform Actions",
		actions: [
			{
				id: "users.export_emails",
				label: "Export email list",
				route: "/admin/actions",
				fields: [],
			},
			{
				id: "notification.broadcast",
				label: "Broadcast announcement",
				route: "/admin/actions",
				fields: [
					{ key: "title", label: "Title" },
					{ key: "message", label: "Message" },
					{ key: "roles", label: "Target roles (comma)" },
					{ key: "premium_only", label: "Premium only (true/false)" },
					{ key: "verified_only", label: "Verified only (true/false)" },
				],
			},
			{
				id: "email.test_send",
				label: "Send test email",
				route: "/admin/actions",
				fields: [{ key: "to", label: "Recipient email" }],
			},
			{
				id: "partner.force_accept",
				label: "Force accept partner request",
				route: "/admin/actions",
				fields: [{ key: "request_id", label: "Request ID" }],
			},
			{
				id: "partner.force_reject",
				label: "Force reject partner request",
				route: "/admin/actions",
				fields: [{ key: "request_id", label: "Request ID" }],
			},
			{
				id: "partner.force_cancel",
				label: "Force cancel partner request",
				route: "/admin/actions",
				fields: [{ key: "request_id", label: "Request ID" }],
			},
			{
				id: "partner.blacklist.add",
				label: "Add to partner blacklist",
				route: "/admin/actions",
				fields: [{ key: "entry_id", label: "User/Org ID" }],
			},
			{
				id: "partner.blacklist.remove",
				label: "Remove from blacklist",
				route: "/admin/actions",
				fields: [{ key: "entry_id", label: "User/Org ID" }],
			},
			{
				id: "partner.whitelist.add",
				label: "Add to partner whitelist",
				route: "/admin/actions",
				fields: [{ key: "entry_id", label: "User/Org ID" }],
			},
			{
				id: "partner.whitelist.remove",
				label: "Remove from whitelist",
				route: "/admin/actions",
				fields: [{ key: "entry_id", label: "User/Org ID" }],
			},
			{
				id: "request.status",
				label: "Update request status",
				route: "/admin/actions",
				fields: [
					{ key: "requirement_id", label: "Request ID" },
					{ key: "status", label: "Status" },
				],
			},
			{
				id: "request.reopen",
				label: "Reopen request",
				route: "/admin/actions",
				fields: [{ key: "requirement_id", label: "Request ID" }],
			},
			{
				id: "request.force_close",
				label: "Force close request",
				route: "/admin/actions",
				fields: [{ key: "requirement_id", label: "Request ID" }],
			},
			{
				id: "contract.status",
				label: "Update contract status",
				route: "/admin/actions",
				fields: [
					{ key: "contract_id", label: "Contract ID" },
					{ key: "status", label: "Status" },
				],
			},
			{
				id: "contract.archive",
				label: "Archive contract",
				route: "/admin/actions",
				fields: [{ key: "contract_id", label: "Contract ID" }],
			},
			{
				id: "contract.unarchive",
				label: "Unarchive contract",
				route: "/admin/actions",
				fields: [{ key: "contract_id", label: "Contract ID" }],
			},
			{
				id: "organization.suspend",
				label: "Suspend organization",
				route: "/admin/actions",
				fields: [{ key: "org_id", label: "Organization ID" }],
			},
			{
				id: "organization.unsuspend",
				label: "Unsuspend organization",
				route: "/admin/actions",
				fields: [{ key: "org_id", label: "Organization ID" }],
			},
			{
				id: "organization.delete",
				label: "Delete organization",
				route: "/admin/actions",
				fields: [{ key: "org_id", label: "Organization ID" }],
			},
			{
				id: "user.suspend",
				label: "Suspend user",
				route: "/admin/actions",
				fields: [{ key: "user_id", label: "User ID" }],
			},
			{
				id: "user.unsuspend",
				label: "Unsuspend user",
				route: "/admin/actions",
				fields: [{ key: "user_id", label: "User ID" }],
			},
			{
				id: "user.delete",
				label: "Delete user",
				route: "/admin/actions",
				fields: [{ key: "user_id", label: "User ID" }],
			},
			{
				id: "user.verify",
				label: "Verify user",
				route: "/admin/actions",
				fields: [{ key: "user_id", label: "User ID" }],
			},
			{
				id: "user.unverify",
				label: "Unverify user",
				route: "/admin/actions",
				fields: [{ key: "user_id", label: "User ID" }],
			},
			{
				id: "user_impersonate.start",
				label: "Start impersonating user",
				route: "/admin/actions",
				fields: [{ key: "user_id", label: "User ID" }],
			},
			{
				id: "user_impersonate.stop",
				label: "Stop impersonating",
				route: "/admin/actions",
				fields: [],
			},
			{
				id: "subscription.cancel",
				label: "Cancel subscription",
				route: "/admin/actions",
				fields: [{ key: "subscription_id", label: "Subscription ID" }],
			},
			{
				id: "subscription.refund",
				label: "Refund subscription",
				route: "/admin/actions",
				fields: [{ key: "subscription_id", label: "Subscription ID" }],
			},
			{
				id: "moderation.case.resolve",
				label: "Resolve moderation case",
				route: "/admin/actions",
				fields: [{ key: "case_id", label: "Case ID" }],
			},
			{
				id: "moderation.case.escalate",
				label: "Escalate moderation case",
				route: "/admin/actions",
				fields: [{ key: "case_id", label: "Case ID" }],
			},
		],
	},
	{
		label: "Factury Actions",
		actions: [
			{
				id: "factory.status",
				label: "Update factory status",
				route: "/admin/factories/actions",
				fields: [
					{ key: "factory_id", label: "Factory ID" },
					{ key: "status", label: "Status" },
				],
			},
			{
				id: "factory.verify",
				label: "Verify factory",
				route: "/admin/factories/actions",
				fields: [{ key: "factory_id", label: "Factory ID" }],
			},
			{
				id: "factory.unverify",
				label: "Unverify factory",
				route: "/admin/factories/actions",
				fields: [{ key: "factory_id", label: "Factory ID" }],
			},
			{
				id: "factory.suspend",
				label: "Suspend factory",
				route: "/admin/factories/actions",
				fields: [{ key: "factory_id", label: "Factory ID" }],
			},
			{
				id: "factory.unsuspend",
				label: "Unsuspend factory",
				route: "/admin/factories/actions",
				fields: [{ key: "factory_id", label: "Factory ID" }],
			},
			{
				id: "factory.delete",
				label: "Delete factory",
				route: "/admin/factories/actions",
				fields: [{ key: "factory_id", label: "Factory ID" }],
			},
			{
				id: "factory.feature",
				label: "Feature factory",
				route: "/admin/factories/actions",
				fields: [{ key: "factory_id", label: "Factory ID" }],
			},
			{
				id: "factory.unfeature",
				label: "Unfeature factory",
				route: "/admin/factories/actions",
				fields: [{ key: "factory_id", label: "Factory ID" }],
			},
			{
				id: "factory.set_buyer",
				label: "Assign buyer to factory",
				route: "/admin/factories/actions",
				fields: [
					{ key: "factory_id", label: "Factory ID" },
					{ key: "buyer_id", label: "Buyer ID" },
				],
			},
		],
	},
	{
		label: "Buying House Actions",
		actions: [
			{
				id: "buying_house.status",
				label: "Update buying house status",
				route: "/admin/buying-houses/actions",
				fields: [
					{ key: "buying_house_id", label: "Buying House ID" },
					{ key: "status", label: "Status" },
				],
			},
			{
				id: "buying_house.verify",
				label: "Verify buying house",
				route: "/admin/buying-houses/actions",
				fields: [{ key: "buying_house_id", label: "Buying House ID" }],
			},
			{
				id: "buying_house.unverify",
				label: "Unverify buying house",
				route: "/admin/buying-houses/actions",
				fields: [{ key: "buying_house_id", label: "Buying House ID" }],
			},
			{
				id: "buying_house.suspend",
				label: "Suspend buying house",
				route: "/admin/buying-houses/actions",
				fields: [{ key: "buying_house_id", label: "Buying House ID" }],
			},
			{
				id: "buying_house.unsuspend",
				label: "Unsuspend buying house",
				route: "/admin/buying-houses/actions",
				fields: [{ key: "buying_house_id", label: "Buying House ID" }],
			},
			{
				id: "buying_house.delete",
				label: "Delete buying house",
				route: "/admin/buying-houses/actions",
				fields: [{ key: "buying_house_id", label: "Buying House ID" }],
			},
			{
				id: "buying_house.assign_agents",
				label: "Assign agents",
				route: "/admin/buying-houses/actions",
				fields: [
					{ key: "buying_house_id", label: "Buying House ID" },
					{ key: "agent_ids", label: "Agent IDs (comma)" },
				],
			},
		],
	},
	{
		label: "RFQ Actions",
		actions: [
			{
				id: "rfq.status",
				label: "Update RFQ status",
				route: "/admin/rfqs/actions",
				fields: [
					{ key: "rfq_id", label: "RFQ ID" },
					{ key: "status", label: "Status" },
				],
			},
			{
				id: "rfq.close",
				label: "Close RFQ",
				route: "/admin/rfqs/actions",
				fields: [{ key: "rfq_id", label: "RFQ ID" }],
			},
			{
				id: "rfq.reopen",
				label: "Reopen RFQ",
				route: "/admin/rfqs/actions",
				fields: [{ key: "rfq_id", label: "RFQ ID" }],
			},
			{
				id: "rfq.delete",
				label: "Delete RFQ",
				route: "/admin/rfqs/actions",
				fields: [{ key: "rfq_id", label: "RFQ ID" }],
			},
			{
				id: "rfq.assign_factory",
				label: "Assign factory to RFQ",
				route: "/admin/rfqs/actions",
				fields: [
					{ key: "rfq_id", label: "RFQ ID" },
					{ key: "factory_id", label: "Factory ID" },
				],
			},
		],
	},
	{
		label: "Invoice & Payment Actions",
		actions: [
			{
				id: "invoice.issue",
				label: "Issue invoice",
				route: "/admin/invoices/actions",
				fields: [
					{ key: "order_id", label: "Order ID" },
					{ key: "amount", label: "Amount" },
				],
			},
			{
				id: "invoice.cancel",
				label: "Cancel invoice",
				route: "/admin/invoices/actions",
				fields: [{ key: "invoice_id", label: "Invoice ID" }],
			},
			{
				id: "payment.refund",
				label: "Refund payment",
				route: "/admin/payments/actions",
				fields: [
					{ key: "payment_id", label: "Payment ID" },
					{ key: "amount", label: "Amount" },
				],
			},
			{
				id: "payment.capture",
				label: "Capture payment",
				route: "/admin/payments/actions",
				fields: [{ key: "payment_id", label: "Payment ID" }],
			},
			{
				id: "payment.void",
				label: "Void payment",
				route: "/admin/payments/actions",
				fields: [{ key: "payment_id", label: "Payment ID" }],
			},
		],
	},
	{
		label: "Content & CMS Actions",
		actions: [
			{
				id: "cms.page.publish",
				label: "Publish CMS page",
				route: "/admin/cms/actions",
				fields: [{ key: "page_id", label: "Page ID" }],
			},
			{
				id: "cms.page.unpublish",
				label: "Unpublish CMS page",
				route: "/admin/cms/actions",
				fields: [{ key: "page_id", label: "Page ID" }],
			},
			{
				id: "cms.page.delete",
				label: "Delete CMS page",
				route: "/admin/cms/actions",
				fields: [{ key: "page_id", label: "Page ID" }],
			},
			{
				id: "cms.banner.publish",
				label: "Publish banner",
				route: "/admin/cms/actions",
				fields: [{ key: "banner_id", label: "Banner ID" }],
			},
			{
				id: "cms.banner.unpublish",
				label: "Unpublish banner",
				route: "/admin/cms/actions",
				fields: [{ key: "banner_id", label: "Banner ID" }],
			},
			{
				id: "cms.banner.delete",
				label: "Delete banner",
				route: "/admin/cms/actions",
				fields: [{ key: "banner_id", label: "Banner ID" }],
			},
			{
				id: "cms.blog.publish",
				label: "Publish blog post",
				route: "/admin/cms/actions",
				fields: [{ key: "blog_id", label: "Blog ID" }],
			},
			{
				id: "cms.blog.unpublish",
				label: "Unpublish blog post",
				route: "/admin/cms/actions",
				fields: [{ key: "blog_id", label: "Blog ID" }],
			},
			{
				id: "cms.blog.delete",
				label: "Delete blog post",
				route: "/admin/cms/actions",
				fields: [{ key: "blog_id", label: "Blog ID" }],
			},
		],
	},
	{
		label: "System & Config Actions",
		actions: [
			{
				id: "config.set",
				label: "Set config value",
				route: "/admin/config/actions",
				fields: [
					{ key: "key", label: "Config key" },
					{ key: "value", label: "Config value" },
				],
			},
			{
				id: "config.delete",
				label: "Delete config value",
				route: "/admin/config/actions",
				fields: [{ key: "key", label: "Config key" }],
			},
			{
				id: "cache.clear",
				label: "Clear cache",
				route: "/admin/config/actions",
				fields: [{ key: "cache_key", label: "Cache key (optional)" }],
			},
			{
				id: "feature_flag.toggle",
				label: "Toggle feature flag",
				route: "/admin/config/actions",
				fields: [
					{ key: "flag_name", label: "Flag name" },
					{ key: "enabled", label: "Enabled (true/false)" },
				],
			},
			{
				id: "webhook.trigger",
				label: "Trigger webhook",
				route: "/admin/config/actions",
				fields: [
					{ key: "webhook_id", label: "Webhook ID" },
					{ key: "payload", label: "Payload JSON" },
				],
			},
		],
	},
	{
		label: "Security Actions",
		actions: [
			{
				id: "security.ip_ban",
				label: "Ban IP address",
				route: "/admin/security/actions",
				fields: [
					{ key: "ip_address", label: "IP Address" },
					{ key: "reason", label: "Reason" },
				],
			},
			{
				id: "security.ip_unban",
				label: "Unban IP address",
				route: "/admin/security/actions",
				fields: [{ key: "ip_address", label: "IP Address" }],
			},
			{
				id: "security.session_revoke",
				label: "Revoke user session",
				route: "/admin/security/actions",
				fields: [{ key: "session_id", label: "Session ID" }],
			},
			{
				id: "security.api_key_create",
				label: "Create API key",
				route: "/admin/security/actions",
				fields: [
					{ key: "user_id", label: "User ID" },
					{ key: "permissions", label: "Permissions" },
				],
			},
			{
				id: "security.api_key_revoke",
				label: "Revoke API key",
				route: "/admin/security/actions",
				fields: [{ key: "key_id", label: "Key ID" }],
			},
			{
				id: "security.mfa_enable",
				label: "Enable MFA for user",
				route: "/admin/security/actions",
				fields: [{ key: "user_id", label: "User ID" }],
			},
			{
				id: "security.mfa_disable",
				label: "Disable MFA for user",
				route: "/admin/security/actions",
				fields: [{ key: "user_id", label: "User ID" }],
			},
			{
				id: "security.immutable.snapshot",
				label: "Create immutable backup",
				route: "/admin/security/actions",
				fields: [],
			},
		],
	},
];

/**
 * Reads the email delivery outcome out of an /admin/actions response body.
 *
 * The endpoint answers with `{ ok, action_id, result: { ok, result } }`: the outer
 * `ok` only says the admin action itself ran, and the inner `result` is the
 * sendEmail() outcome `{ ok, status }`. The email truth therefore lives at
 * `response.result.result`.
 *
 * A flattened body is accepted only when it says so: `{ delivery: { ok, status } }`.
 * The flag is the point. The previous version also accepted `response.result`
 * and `response` itself whenever they carried a `status`, which meant that a
 * future change to the envelope — one that put a `status` on the outer object —
 * would be read as a delivery result, and the panel would claim a send that
 * never happened. The admin action envelope carries no `delivery` key, so
 * nothing it grows can be mistaken for one.
 *
 * @param {Object} response The parsed /admin/actions response body.
 * @returns {{ok: boolean, status: string}|null} The delivery outcome, or null when unknown.
 */
export function readEmailDeliveryResult(response) {
	const candidates = [response?.result?.result, response?.delivery];
	for (const candidate of candidates) {
		if (
			candidate &&
			typeof candidate === "object" &&
			typeof candidate.status === "string" &&
			candidate.status
		) {
			return { ok: candidate.ok === true, status: candidate.status };
		}
	}
	return null;
}

/**
 * Turns an email.test_send response into the notice/error the operator sees.
 *
 * A log-only delivery (email disabled, provider unconfigured, unsupported
 * provider) must never be reported as sent: sendEmail() returns ok:false for
 * every one of those branches, and that flag is what this reads. An unknown
 * outcome is reported as not delivered rather than optimistically as sent.
 *
 * @param {Object} response The parsed /admin/actions response body.
 * @returns {{delivered: boolean, status: string, notice: string, error: string}} The outcome.
 */
export function describeEmailTestOutcome(response) {
	const delivery = readEmailDeliveryResult(response);
	if (delivery?.ok) {
		const detail = delivery.status === "sent" ? "" : ` (${delivery.status})`;
		return {
			delivered: true,
			status: delivery.status,
			notice: `Test email sent${detail}.`,
			error: "",
		};
	}
	const status = delivery?.status ?? "unknown";
	return {
		delivered: false,
		status,
		notice: "",
		error: `Test email not delivered (${status}). Check the email provider settings and the email log.`,
	};
}
