import { forbiddenError } from "../utils/permissions.js";
import prisma from "../utils/prisma.js";
import { getAdminConfig } from "./adminConfigService.js";
import { getSubscription } from "./subscriptionService.js";

const DEFAULT_FREE_MEMBER_LIMIT = 3;

// Company-management features are shared by the company-side roles. owner and
// admin were missing entirely, so a premium owner got an empty feature map and
// could never pass the team_access_management check.
const COMPANY_MANAGEMENT_FEATURES = [
	"profile_boost",
	"product_boost",
	"advanced_analytics",
	"priority_search_ranking",
	"ai_auto_reply_customization",
	"dedicated_account_manager",
	"custom_branding",
	"enterprise_analytics_dashboard",
	"unlimited_agents",
	"buying_pattern_analysis",
	"order_completion_certification",
	"dedicated_support",
	"contract_history_audit",
	"multi_agent_management",
	"team_access_management",
	"request_performance_insights",
	"buyer_interest_analytics",
	"agent_performance_analytics",
	"product_video_capacity",
	"lead_distribution",
	"buyer_communication_insights",
	"buyer_request_priority_access",
	"buyer_conversion_insights",
	"unlimited_partner_accept",
];

const PREMIUM_FEATURES_BY_ROLE = {
	buyer: [
		"advanced_search_filters",
		"priority_buyer_request_placement",
		"dedicated_support",
		"contract_history_audit",
		"early_access_verified_factories",
		"buying_pattern_analysis",
		"order_completion_certification",
		"ai_auto_reply_customization",
		"smart_supplier_matching",
		"request_performance_insights",
		"profile_boost",
		"product_boost",
	],
	factory: COMPANY_MANAGEMENT_FEATURES,
	owner: COMPANY_MANAGEMENT_FEATURES,
	admin: COMPANY_MANAGEMENT_FEATURES,
	agent: [
		"custom_branding",
		"dedicated_account_manager",
		"profile_boost",
		"product_boost",
		"advanced_search_filters",
		"advanced_analytics",
		"multi_agent_management",
		"team_access_management",
		"lead_distribution",
	],
	buying_house: [
		"profile_boost",
		"product_boost",
		"advanced_analytics",
		"priority_search_ranking",
		"ai_auto_reply_customization",
		"dedicated_account_manager",
		"custom_branding",
		"enterprise_analytics_dashboard",
		"unlimited_agents",
		"buying_pattern_analysis",
		"order_completion_certification",
		"dedicated_support",
		"contract_history_audit",
		"multi_agent_management",
		"team_access_management",
		"request_performance_insights",
		"buyer_interest_analytics",
		"agent_performance_analytics",
		"product_video_capacity",
		"lead_distribution",
		"buyer_communication_insights",
		"buyer_request_priority_access",
		"buyer_conversion_insights",
		"unlimited_partner_access",
	],
};

function normalizeRole(role) {
	const raw = String(role || "").toLowerCase();
	if (raw === "buying_house" || raw === "buying house") {
		return "buying_house";
	}
	if (raw === "factory") {
		return "factory";
	}
	if (raw === "buyer") {
		return "buyer";
	}
	if (raw === "agent") {
		return "agent";
	}
	return raw;
}

export async function getPlanForUser(user) {
	if (!user) {
		return "free";
	}
	const sub = await getSubscription(user.id);
	if (sub?.plan === "premium") {
		return "premium";
	}
	if (String(user?.subscription_status || "").toLowerCase() === "premium") {
		return "premium";
	}

	if (user.role === "agent" && user.org_owner_id) {
		const orgOwner = await prisma.user.findUnique({
			where: { id: user.org_owner_id },
		});
		if (orgOwner) {
			const ownerPlan = await getPlanForUser(orgOwner);
			if (ownerPlan === "premium") {
				return "premium";
			}

			const config = await getAdminConfig();
			const freeLimit = Number(config?.plan_limits?.free?.agent_limit || DEFAULT_FREE_MEMBER_LIMIT);
			const activeCount = await prisma.user.count({
				where: {
					role: "agent",
					org_owner_id: user.org_owner_id,
					status: "active",
				},
			});
			if (activeCount <= freeLimit) {
				return "premium";
			}
		}
	}

	return "free";
}

export async function isPremiumUser(user) {
	const plan = await getPlanForUser(user);
	return plan === "premium";
}

export async function getEntitlements(user) {
	const role = normalizeRole(user?.role);
	const plan = await getPlanForUser(user);
	const premium = plan === "premium";
	const premiumFeatures = PREMIUM_FEATURES_BY_ROLE[role] || [];
	const featureMap = Object.fromEntries(premiumFeatures.map((feature) => [feature, premium]));

	return {
		role,
		plan,
		premium,
		premium_features: premiumFeatures,
		features: featureMap,
	};
}

export async function ensureEntitlement(user, feature, message = "") {
	const entitlements = await getEntitlements(user);
	if (entitlements?.features?.[feature]) {
		return entitlements;
	}
	const err = forbiddenError(message || "Premium plan required");
	err.code = "PREMIUM_REQUIRED";
	err.feature = feature;
	throw err;
}
