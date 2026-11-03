const OWNER_ADMIN_ROLES = new Set(["owner", "admin"]);
const MEMBER_MANAGER_ROLES = new Set(["owner", "admin", "buying_house", "factory"]);

export function forbiddenError(message = "Access denied") {
	const error = new Error(message);
	error.status = 403;
	error.code = "FORBIDDEN";
	return error;
}

export function deny(res, message = "Access denied") {
	return res.status(403).json({ error: message, code: "FORBIDDEN" });
}

export function handleControllerError(res, error) {
	const status = Number(error?.status) || 500;
	if (status === 403) {
		return deny(res, error?.message || "Access denied");
	}
	if (status >= 500) {
		return res.status(status).json({ error: "Internal server error" });
	}
	return res.status(status).json({ error: error?.message || "Request failed" });
}

export function hasRole(user, ...roles) {
	return Boolean(user?.role) && roles.includes(user.role);
}

export function isOwnerOrAdmin(user) {
	return OWNER_ADMIN_ROLES.has(user?.role);
}

export function isAgent(user) {
	return user?.role === "agent";
}

export function canManagePartnerNetwork(user) {
	// Partner Network UI is buying-house owned; factories participate by responding (accept/reject) via notifications.
	return isOwnerOrAdmin(user) || hasRole(user, "buying_house");
}

export function canViewPartnerNetwork(user) {
	return canManagePartnerNetwork(user) || isAgent(user);
}

export function canRespondToPartnerRequest(user) {
	return isOwnerOrAdmin(user) || hasRole(user, "factory");
}

export function canManageMembers(user) {
	return MEMBER_MANAGER_ROLES.has(user?.role);
}

export function canManageOrgPolicies(user) {
	if (isOwnerOrAdmin(user)) {
		return true;
	}
	return Boolean(user?.permission_matrix?.org_operations?.policy_admin);
}

export function canManageOrgQueue(user) {
	if (isOwnerOrAdmin(user)) {
		return true;
	}
	return Boolean(user?.permission_matrix?.org_operations?.queue_manager);
}

export function canManageLeadAssignments(user) {
	if (isOwnerOrAdmin(user)) {
		return true;
	}
	return Boolean(user?.permission_matrix?.org_operations?.assignment_manager);
}

export function canViewAnalytics(user) {
	return isOwnerOrAdmin(user) || hasRole(user, "buying_house", "factory", "buyer", "agent");
}

export function canViewAnalyticsAdmin(user) {
	return isOwnerOrAdmin(user);
}

export function canViewAnalyticsDashboard(user) {
	if (isOwnerOrAdmin(user)) {
		return true;
	}
	if (hasRole(user, "buying_house", "factory", "buyer")) {
		return true;
	}
	if (isAgent(user)) {
		return Boolean(user?.permission_matrix?.analytics?.view);
	}
	return false;
}

function includesUserId(record, userId, idFields = []) {
	return idFields.some((field) => String(record?.[field] || "") === String(userId));
}

function includesAssignedAgent(
	record,
	userId,
	assignmentFields = ["assigned_agent_id", "agent_id"],
) {
	return assignmentFields.some((field) => {
		const value = record?.[field];
		if (Array.isArray(value)) {
			return value.map(String).includes(String(userId));
		}
		return String(value || "") === String(userId);
	});
}

export function scopeRecordsForUser(user, records, options = {}) {
	const { idFields = [], assignmentFields = ["assigned_agent_id", "agent_id"] } = options;

	if (isOwnerOrAdmin(user)) {
		return records;
	}

	if (isAgent(user)) {
		return records.filter(
			(record) =>
				includesAssignedAgent(record, user.id, assignmentFields) ||
				includesUserId(record, user.id, idFields),
		);
	}

	return records.filter((record) => includesUserId(record, user.id, idFields));
}

export function canAccessContract(actor, contract) {
	if (!(actor && contract)) {
		return false;
	}
	if (isOwnerOrAdmin(actor)) {
		return true;
	}

	if (isAgent(actor)) {
		return (
			includesAssignedAgent(contract, actor.id) ||
			includesUserId(contract, actor.id, ["uploaded_by", "buyer_id", "factory_id"])
		);
	}

	return includesUserId(contract, actor.id, ["uploaded_by", "buyer_id", "factory_id"]);
}

export function canModifyContract(actor, contract) {
	if (!canAccessContract(actor, contract)) {
		return false;
	}
	return !isAgent(actor);
}
