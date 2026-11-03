import { appendAuditLog } from "../utils/auditStore.js";
import { forbiddenError, isAgent } from "../utils/permissions.js";

const POLICY_IDS = {
	BASE_ROLE_ALLOW: "org-policy-base-role-allow",
	LEAD_ASSIGN_MANAGER: "org-policy-lead-assign-manager",
	ANALYTICS_AGENT_SCOPE: "org-policy-analytics-agent-scope",
	CONTRACT_APPROVE: "org-policy-contract-approve-manager",
	FILTERS_ADVANCED_PLAN: "org-policy-filters-advanced-plan",
	MEMBER_MANAGEMENT: "org-policy-member-management",
	ORG_SETTINGS: "org-policy-org-settings-manager",
	SEAT_CAP: "org-policy-seat-cap",
	TEAM_VISIBILITY: "org-policy-team-visibility",
};

const ACTIONS = {
	LEADS_ASSIGN: "leads.assign",
	LEADS_EXPORT: "leads.export",
	ANALYTICS_VIEW_ORG: "analytics.view_org",
	ANALYTICS_VIEW_AGENT: "analytics.view_agent",
	CONTRACTS_APPROVE: "contracts.approve",
	FILTERS_ADVANCED_ACCESS: "filters.advanced_access",
	MEMBERS_MANAGE: "members.manage",
	ORG_SETTINGS_MANAGE: "org.settings.manage",
};

const ORG_MANAGER_ROLES = new Set(["owner", "admin", "buying_house", "factory"]);
const BASE_PERMISSION_MATRIX = {
	[ACTIONS.LEADS_ASSIGN]: ["owner", "admin", "buying_house", "factory"],
	[ACTIONS.LEADS_EXPORT]: ["owner", "admin", "buying_house", "factory"],
	[ACTIONS.ANALYTICS_VIEW_ORG]: ["owner", "admin", "buying_house", "factory", "buyer", "agent"],
	[ACTIONS.ANALYTICS_VIEW_AGENT]: ["owner", "admin", "buying_house", "factory", "agent"],
	[ACTIONS.CONTRACTS_APPROVE]: ["owner", "admin", "buying_house", "factory"],
	[ACTIONS.FILTERS_ADVANCED_ACCESS]: [
		"owner",
		"admin",
		"buying_house",
		"factory",
		"buyer",
		"agent",
	],
	[ACTIONS.MEMBERS_MANAGE]: ["owner", "admin", "buying_house", "factory"],
	[ACTIONS.ORG_SETTINGS_MANAGE]: ["owner", "admin", "buying_house", "factory"],
};
const ROLE_FILTER_PRESETS = {
	owner: "all_access",
	admin: "all_access",
	buying_house: "demand_ops",
	factory: "supply_ops",
	buyer: "buyer_focus",
	agent: "team_scoped",
};

function roleOf(actor) {
	return String(actor?.role || "").toLowerCase();
}

function actorOrgId(actor) {
	if (!actor) {
		return "";
	}
	if (isAgent(actor)) {
		return String(actor.org_owner_id || "");
	}
	return String(actor.id || actor.org_owner_id || "");
}

function isPremium(actor) {
	return String(actor?.subscription_status || "").toLowerCase() === "premium";
}

function teamMatches(actor, resourceContext) {
	const actorTeam = String(actor?.profile?.team || actor?.team || "");
	const actorSubTeam = String(actor?.profile?.sub_team || actor?.sub_team || "");
	const resourceTeam = String(resourceContext?.team || "");
	const resourceSubTeam = String(resourceContext?.sub_team || "");
	if (!resourceTeam) {
		return true;
	}
	if (!actorTeam) {
		return false;
	}
	if (actorTeam !== resourceTeam) {
		return false;
	}
	if (!resourceSubTeam) {
		return true;
	}
	return actorSubTeam === resourceSubTeam;
}

function policyDecision({ allowed, reason, policyId, actor, action, resourceContext }) {
	return {
		allowed: Boolean(allowed),
		reason: reason || (allowed ? "authorized" : "forbidden"),
		policy_id: policyId,
		action,
		actor_id: String(actor?.id || ""),
		resource_context: resourceContext || {},
	};
}

async function auditDecision(decision) {
	await appendAuditLog({
		id: `authz:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`,
		type: decision.allowed ? "authorization.granted" : "authorization.denied",
		actor_id: decision.actor_id,
		action: decision.action,
		policy_id: decision.policy_id,
		decision: decision.allowed ? "allow" : "deny",
		reason: decision.reason,
		resource_context: decision.resource_context,
		created_at: new Date().toISOString(),
	});
}

function checkBasePermission(actor, action, resourceContext = {}) {
	const role = roleOf(actor);
	const allowedRoles = BASE_PERMISSION_MATRIX[action] || [];
	if (!allowedRoles.includes(role)) {
		return policyDecision({
			allowed: false,
			reason: `Role ${role || "unknown"} cannot perform ${action}`,
			policyId: POLICY_IDS.BASE_ROLE_ALLOW,
			actor,
			action,
			resourceContext,
		});
	}

	if (action === ACTIONS.FILTERS_ADVANCED_ACCESS && !isPremium(actor)) {
		return policyDecision({
			allowed: false,
			reason: "Advanced filters require premium/enterprise plan",
			policyId: POLICY_IDS.FILTERS_ADVANCED_PLAN,
			actor,
			action,
			resourceContext,
		});
	}

	return policyDecision({
		allowed: true,
		reason: "Role allow-list passed",
		policyId: POLICY_IDS.BASE_ROLE_ALLOW,
		actor,
		action,
		resourceContext,
	});
}

function applyEnterprisePolicies(actor, action, resourceContext, baseDecision) {
	if (!baseDecision.allowed) {
		return baseDecision;
	}

	if (action === ACTIONS.LEADS_ASSIGN && isAgent(actor)) {
		return policyDecision({
			allowed: false,
			reason: "Agents cannot assign leads",
			policyId: POLICY_IDS.LEAD_ASSIGN_MANAGER,
			actor,
			action,
			resourceContext,
		});
	}

	if (action === ACTIONS.ANALYTICS_VIEW_AGENT && isAgent(actor)) {
		const targetAgentId = String(resourceContext?.target_agent_id || actor.id || "");
		if (targetAgentId && targetAgentId !== String(actor.id || "")) {
			return policyDecision({
				allowed: false,
				reason: "Agents can only view their own analytics scope",
				policyId: POLICY_IDS.ANALYTICS_AGENT_SCOPE,
				actor,
				action,
				resourceContext,
			});
		}
	}

	if (action === ACTIONS.CONTRACTS_APPROVE && !ORG_MANAGER_ROLES.has(roleOf(actor))) {
		return policyDecision({
			allowed: false,
			reason: "Contract approvals require org manager role",
			policyId: POLICY_IDS.CONTRACT_APPROVE,
			actor,
			action,
			resourceContext,
		});
	}

	if (action === ACTIONS.MEMBERS_MANAGE) {
		const seatCap = Number(resourceContext?.seat_cap || 0);
		const requestedSeats = Number(resourceContext?.requested_seats || 0);
		const activeSeats = Number(resourceContext?.active_seats || 0);
		if (seatCap > 0 && requestedSeats > 0 && activeSeats + requestedSeats > seatCap) {
			return policyDecision({
				allowed: false,
				reason: `Seat cap exceeded (${activeSeats + requestedSeats}/${seatCap})`,
				policyId: POLICY_IDS.SEAT_CAP,
				actor,
				action,
				resourceContext,
			});
		}
	}

	if (
		[ACTIONS.ANALYTICS_VIEW_ORG, ACTIONS.ANALYTICS_VIEW_AGENT, ACTIONS.LEADS_ASSIGN].includes(
			action,
		) &&
		!teamMatches(actor, resourceContext)
	) {
		return policyDecision({
			allowed: false,
			reason: "Restricted visibility outside your team/sub-team",
			policyId: POLICY_IDS.TEAM_VISIBILITY,
			actor,
			action,
			resourceContext,
		});
	}

	if (action === ACTIONS.ORG_SETTINGS_MANAGE && !ORG_MANAGER_ROLES.has(roleOf(actor))) {
		return policyDecision({
			allowed: false,
			reason: "Only org managers can update organization settings",
			policyId: POLICY_IDS.ORG_SETTINGS,
			actor,
			action,
			resourceContext,
		});
	}

	return baseDecision;
}

export async function authorize(actor, action, resourceContext = {}) {
	const requestedAction = String(action || "");
	const baseDecision = checkBasePermission(actor, requestedAction, resourceContext);
	const decision = applyEnterprisePolicies(actor, requestedAction, resourceContext, baseDecision);
	await auditDecision(decision);
	if (!decision.allowed) {
		throw forbiddenError(decision.reason);
	}
	return decision;
}

export function buildCapabilityPayload(actor) {
	const orgId = actorOrgId(actor);
	const team = String(actor?.profile?.team || actor?.team || "");
	const subTeam = String(actor?.profile?.sub_team || actor?.sub_team || "");
	const entries = Object.values(ACTIONS).map((action) => {
		const baseDecision = checkBasePermission(actor, action, {
			org_id: orgId,
			team,
			sub_team: subTeam,
		});
		const decision = applyEnterprisePolicies(
			actor,
			action,
			{ org_id: orgId, team, sub_team: subTeam },
			baseDecision,
		);
		return [action, Boolean(decision.allowed)];
	});
	const byAction = Object.fromEntries(entries);

	return {
		...byAction,
		leads: {
			assign: Boolean(byAction[ACTIONS.LEADS_ASSIGN]),
			export: Boolean(byAction[ACTIONS.LEADS_EXPORT]),
		},
		analytics: {
			view_org: Boolean(byAction[ACTIONS.ANALYTICS_VIEW_ORG]),
			view_agent: Boolean(byAction[ACTIONS.ANALYTICS_VIEW_AGENT]),
		},
		contracts: {
			approve: Boolean(byAction[ACTIONS.CONTRACTS_APPROVE]),
		},
		filters: {
			advanced_access: Boolean(byAction[ACTIONS.FILTERS_ADVANCED_ACCESS]),
			advanced: Boolean(byAction[ACTIONS.FILTERS_ADVANCED_ACCESS]),
			preset: ROLE_FILTER_PRESETS[roleOf(actor)] || "basic",
		},
		members: {
			manage: Boolean(byAction[ACTIONS.MEMBERS_MANAGE]),
		},
		org: {
			settings_manage: Boolean(byAction[ACTIONS.ORG_SETTINGS_MANAGE]),
		},
	};
}

export { ACTIONS, POLICY_IDS };
