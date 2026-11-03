import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import prisma from "../utils/prisma.js";
import { getAdminConfig } from "./adminConfigService.js";
import { getPlanForUser } from "./entitlementService.js";
import { getSubscription } from "./subscriptionService.js";

const DEFAULT_FREE_MEMBER_LIMIT = 3;

const VALID_PERMISSIONS = new Set([
	"view_requests",
	"assign_requests",
	"manage_members",
	"reports_only",
]);
const PERMISSION_CONFLICTS = [["manage_members", "reports_only"]];

const MATRIX_SECTIONS = ["requests", "products", "analytics", "members", "documents"];

function sanitizePermissions(permissions) {
	if (!Array.isArray(permissions)) {
		return [];
	}
	return [
		...new Set(
			permissions.map((p) => String(p).trim().slice(0, 64)).filter((p) => VALID_PERMISSIONS.has(p)),
		),
	];
}

function sanitizePermissionMatrix(rawMatrix) {
	const input = rawMatrix && typeof rawMatrix === "object" ? rawMatrix : {};
	const matrix = {};
	for (const section of MATRIX_SECTIONS) {
		const sectionValue =
			input?.[section] && typeof input[section] === "object" ? input[section] : {};
		matrix[section] = {
			view: Boolean(sectionValue.view),
			edit: Boolean(sectionValue.edit),
		};
	}
	matrix.members = { view: false, edit: false };
	return matrix;
}

function hasPermissionConflict(permissions) {
	return (
		PERMISSION_CONFLICTS.find(([a, b]) => permissions.includes(a) && permissions.includes(b)) ||
		null
	);
}

function cleanAgent(user) {
	if (!user) {
		return null;
	}
	const { password_hash: _ph, ...safe } = user;
	return safe;
}

function generateNextMemberId() {
	return `AGT-${String(Date.now()).slice(-6)}`;
}

function normalizeAgent(orgOwnerId, payload = {}, current = null) {
	const name = String(payload.name ?? current?.name ?? "")
		.trim()
		.slice(0, 120);
	const username = String(payload.username ?? current?.username ?? "")
		.trim()
		.slice(0, 64);
	const rawMemberId = String(payload.member_id ?? payload.account_id ?? current?.member_id ?? "")
		.trim()
		.slice(0, 64);
	const memberId = rawMemberId || generateNextMemberId();

	const role = "agent";
	const rawStatus = String(payload.status ?? current?.status ?? "active")
		.trim()
		.slice(0, 32);
	const status = rawStatus || "active";

	const permissions =
		payload.permissions === undefined
			? Array.isArray(current?.permissions)
				? current.permissions
				: []
			: sanitizePermissions(payload.permissions);

	const permissionMatrix =
		payload.permission_matrix === undefined
			? sanitizePermissionMatrix(current?.permission_matrix || {})
			: sanitizePermissionMatrix(payload.permission_matrix);

	const email =
		(payload.email ?? current?.email ?? "").toString().trim().slice(0, 160) ||
		`agent-${memberId}@gartexhub.local`;

	const messagingRaw =
		payload.messaging_restricted_until ?? current?.messaging_restricted_until ?? null;
	const messagingRestricted =
		messagingRaw instanceof Date ? messagingRaw : messagingRaw ? new Date(messagingRaw) : null;

	const passwordResetAt =
		payload.password_reset_at === undefined
			? current?.password_reset_at || null
			: payload.password_reset_at instanceof Date
				? payload.password_reset_at
				: payload.password_reset_at
					? new Date(payload.password_reset_at)
					: null;

	return {
		id: current?.id || crypto.randomUUID(),
		org_owner_id: orgOwnerId,
		name: name || memberId,
		username,
		member_id: memberId,
		email: email.toLowerCase(),
		role,
		status,
		wallet_balance_usd: Number(current?.wallet_balance_usd ?? 0),
		policy_strikes: Number(current?.policy_strikes ?? 0),
		messaging_restricted_until: messagingRestricted,
		permissions,
		permission_matrix: permissionMatrix,
		assigned_requests: Number(payload.assigned_requests ?? current?.assigned_requests ?? 0),
		performance_score: Number(payload.performance_score ?? current?.performance_score ?? 0),
		password_reset_at: passwordResetAt,
		created_at:
			current?.created_at instanceof Date
				? current.created_at
				: current?.created_at
					? new Date(current.created_at)
					: new Date(),
		updated_at: new Date(),
	};
}

async function ensureUniqueIdentity({ orgOwnerId, username, memberId, currentUserId = null }) {
	const dupeUsername = await prisma.user.findFirst({
		where: {
			role: "agent",
			org_owner_id: orgOwnerId,
			...(currentUserId ? { id: { not: currentUserId } } : {}),
			username: { equals: username, mode: "insensitive" },
		},
	});
	if (dupeUsername) {
		const error = new Error("Duplicate username in this organization");
		error.status = 409;
		throw error;
	}

	const dupeMemberId = await prisma.user.findFirst({
		where: {
			...(currentUserId ? { id: { not: currentUserId } } : {}),
			member_id: { equals: memberId, mode: "insensitive" },
		},
	});
	if (dupeMemberId) {
		const error = new Error("Member ID already exists");
		error.status = 409;
		throw error;
	}
}

async function assertFreePlanMemberLimit({
	orgOwnerId,
	currentAgentId = null,
	nextStatus = "active",
}) {
	const orgOwner = await prisma.user.findUnique({ where: { id: orgOwnerId } });
	const plan = orgOwner
		? await getPlanForUser(orgOwner)
		: (await getSubscription(orgOwnerId))?.plan === "premium"
			? "premium"
			: "free";
	if (plan !== "free") {
		return;
	}

	const config = await getAdminConfig();
	const freeLimit = Number(config?.plan_limits?.free?.agent_limit || DEFAULT_FREE_MEMBER_LIMIT);

	const activeCount = await prisma.user.count({
		where: {
			role: "agent",
			org_owner_id: orgOwnerId,
			status: "active",
			...(currentAgentId ? { id: { not: currentAgentId } } : {}),
		},
	});

	if (nextStatus === "active" && activeCount >= freeLimit) {
		const error = new Error(`Free plan allows up to ${freeLimit} active sub-accounts`);
		error.status = 403;
		throw error;
	}
}

export async function listMembers(orgOwnerId) {
	const agents = await prisma.user.findMany({
		where: { role: "agent", org_owner_id: orgOwnerId, status: { not: "removed" } },
		orderBy: { created_at: "desc" },
	});
	return agents.map(cleanAgent);
}

export async function getMember(orgOwnerId, memberId) {
	const agent = await prisma.user.findFirst({
		where: { id: memberId, org_owner_id: orgOwnerId, role: "agent" },
	});
	return cleanAgent(agent);
}

export async function createMember(orgOwnerId, payload) {
	const agent = normalizeAgent(orgOwnerId, payload);

	const conflict = hasPermissionConflict(agent.permissions);
	if (conflict) {
		const error = new Error(
			`Permission conflict: ${conflict[0]} cannot be combined with ${conflict[1]}`,
		);
		error.status = 400;
		throw error;
	}

	if (!(agent.name && agent.username && agent.member_id)) {
		const error = new Error("name, username and member_id are required");
		error.status = 400;
		throw error;
	}

	await ensureUniqueIdentity({
		orgOwnerId,
		username: agent.username,
		memberId: agent.member_id,
	});

	await assertFreePlanMemberLimit({
		orgOwnerId,
		nextStatus: "active",
	});

	const rawPassword =
		String(payload.password || "").trim() || crypto.randomBytes(8).toString("base64url");
	agent.password_hash = await bcrypt.hash(rawPassword, 10);

	const created = await prisma.user.create({ data: agent });
	const safe = cleanAgent(created);
	if (!payload.password) {
		return { ...safe, temporary_password: rawPassword };
	}
	return safe;
}

export async function updateMember(orgOwnerId, memberId, payload) {
	const current = await prisma.user.findFirst({
		where: { id: memberId, org_owner_id: orgOwnerId, role: "agent" },
	});
	if (!current) {
		return null;
	}

	const next = normalizeAgent(orgOwnerId, payload, current);

	if (!["active", "inactive"].includes(next.status)) {
		const error = new Error("status must be active or inactive");
		error.status = 400;
		throw error;
	}

	await ensureUniqueIdentity({
		orgOwnerId,
		username: next.username,
		memberId: next.member_id,
		currentUserId: current.id,
	});

	const conflict = hasPermissionConflict(next.permissions);
	if (conflict) {
		const error = new Error(
			`Permission conflict: ${conflict[0]} cannot be combined with ${conflict[1]}`,
		);
		error.status = 400;
		throw error;
	}

	await assertFreePlanMemberLimit({
		orgOwnerId,
		currentAgentId: current.id,
		nextStatus: next.status,
	});

	const { id: _id, created_at: _created_at, password_hash: _password_hash, ...updatable } = next;

	const updated = await prisma.user.update({
		where: { id: memberId },
		data: { ...updatable, updated_at: new Date() },
	});

	return cleanAgent(updated);
}

export async function updateMemberPermissions(
	orgOwnerId,
	memberId,
	permissionsPayload,
	permissionMatrixPayload,
) {
	return updateMember(orgOwnerId, memberId, {
		permissions: permissionsPayload,
		permission_matrix: permissionMatrixPayload,
	});
}

export async function resetMemberPassword(orgOwnerId, memberId) {
	const current = await prisma.user.findFirst({
		where: { id: memberId, org_owner_id: orgOwnerId, role: "agent" },
	});
	if (!current) {
		return null;
	}

	const tempPassword = crypto.randomBytes(6).toString("base64url");
	const hashed = await bcrypt.hash(tempPassword, 10);

	const updated = await prisma.user.update({
		where: { id: memberId },
		data: {
			password_hash: hashed,
			password_reset_at: new Date(),
			updated_at: new Date(),
		},
	});

	return { member: cleanAgent(updated), temporary_password: tempPassword };
}

export async function deactivateOrRemoveMember(orgOwnerId, memberId, mode = "deactivate") {
	const current = await prisma.user.findFirst({
		where: { id: memberId, org_owner_id: orgOwnerId, role: "agent" },
	});
	if (!current) {
		return null;
	}

	if (mode === "remove") {
		const removed = await prisma.user.update({
			where: { id: memberId },
			data: { status: "removed", updated_at: new Date() },
		});
		return { member: cleanAgent(removed), mode: "remove" };
	}

	const updated = await prisma.user.update({
		where: { id: memberId },
		data: { status: "inactive", updated_at: new Date() },
	});

	return { member: cleanAgent(updated), mode: "deactivate" };
}

export async function getMemberConstraints(orgOwnerRecord = null) {
	const config = await getAdminConfig();
	const freeLimit = Number(config?.plan_limits?.free?.agent_limit ?? DEFAULT_FREE_MEMBER_LIMIT);
	const premiumLimit = Number(config?.plan_limits?.premium?.agent_limit ?? 999);
	const plan = orgOwnerRecord ? await getPlanForUser(orgOwnerRecord) : "free";
	return {
		plan,
		free_member_limit: freeLimit,
		premium_member_limit: premiumLimit,
		valid_permissions: [...VALID_PERMISSIONS],
		permission_conflicts: PERMISSION_CONFLICTS,
		permission_matrix_sections: MATRIX_SECTIONS,
	};
}

export async function getMemberPermissionMetrics(orgOwnerId) {
	const agents = await prisma.user.findMany({
		where: { role: "agent", org_owner_id: orgOwnerId, status: { not: "removed" } },
		select: { permissions: true, permission_matrix: true, status: true },
	});

	const totalMembers = agents.length;
	const activeMembers = agents.filter((a) => a.status === "active").length;

	const permissionCounts = {};
	for (const perm of VALID_PERMISSIONS) {
		permissionCounts[perm] = agents.filter(
			(a) => Array.isArray(a.permissions) && a.permissions.includes(perm),
		).length;
	}

	const matrixCoverage = {};
	for (const section of MATRIX_SECTIONS) {
		const withView = agents.filter((a) => a.permission_matrix?.[section]?.view).length;
		const withEdit = agents.filter((a) => a.permission_matrix?.[section]?.edit).length;
		matrixCoverage[section] = { view: withView, edit: withEdit };
	}

	return { totalMembers, activeMembers, permissionCounts, matrixCoverage };
}
