import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import {
	formatProductionCapacity,
	normalizeCompanyFacts,
} from "../../shared/config/platformTaxonomy.js";
import prisma from "../utils/prisma.js";
import { sanitizeString } from "../utils/validators.js";
import { getAdminConfig } from "./adminConfigService.js";
import { getPlanForUser } from "./entitlementService.js";
import { reindexOrg } from "./openSearchService.js";
import { upsertSubscription } from "./subscriptionService.js";
import { creditWallet, redeemCouponForUser } from "./walletService.js";

const OPENSEARCH_REINDEX_PROFILE_KEYS = new Set([
	"country",
	"industry",
	"certifications",
	"monthly_capacity",
	"lead_time_days",
	"payment_terms",
	"document_ready",
	"audit_date",
	"language_support",
	"incoterms",
	"main_processes",
	"years_in_business",
	"handles_multiple_factories",
	"team_seats",
	"export_ports",
	"location_lat",
	"location_lng",
]);

function generateSetupCode(prefix = "setup") {
	return `${prefix}-${crypto.randomBytes(4).toString("hex")}`;
}

function cleanUser(user) {
	const { password_hash: _passwordHash, passkeys, ...safe } = user;
	return {
		...safe,
		passkeys: Array.isArray(passkeys)
			? passkeys.map((key) => ({
					id: key.id,
					name: key.name || "",
					created_at: key.created_at || "",
					last_used_at: key.last_used_at || "",
					transports: Array.isArray(key.transports) ? key.transports : [],
				}))
			: [],
	};
}

export function buildFriendMatchId(userA, userB) {
	const ids = [sanitizeString(String(userA || ""), 120), sanitizeString(String(userB || ""), 120)]
		.filter(Boolean)
		.sort();
	if (ids.length !== 2) {
		return "";
	}
	return `friend:${ids[0]}:${ids[1]}`;
}

export function isUserPairInFriendMatch(matchId, userA, userB) {
	if (!String(matchId || "").startsWith("friend:")) {
		return false;
	}
	return matchId === buildFriendMatchId(userA, userB);
}

export async function isFriendConnected(userA, userB) {
	if (!(userA && userB) || userA === userB) {
		return false;
	}
	const count = await prisma.userConnection.count({
		where: {
			OR: [
				{ requester_id: userA, receiver_id: userB },
				{ requester_id: userB, receiver_id: userA },
			],
			type: { in: ["friend", "friend_request"] },
			status: { in: ["active", "accepted"] },
		},
	});
	return count > 0;
}

function connectionSnapshot(connections, viewerId, targetId) {
	const following = connections.some(
		(row) =>
			row.type === "follow" &&
			row.requester_id === viewerId &&
			row.receiver_id === targetId &&
			row.status === "active",
	);

	const friends = connections.some((row) => {
		const samePair =
			(row.requester_id === viewerId && row.receiver_id === targetId) ||
			(row.requester_id === targetId && row.receiver_id === viewerId);
		if (!samePair) {
			return false;
		}
		const status = String(row.status || "").toLowerCase();
		if (row.type === "friend" && ["active", "accepted"].includes(status)) {
			return true;
		}
		if (row.type === "friend_request" && ["active", "accepted"].includes(status)) {
			return true;
		}
		return false;
	});

	if (friends) {
		return { following, friend_status: "friends" };
	}

	const outgoingPending = connections.some(
		(row) =>
			row.type === "friend_request" &&
			row.requester_id === viewerId &&
			row.receiver_id === targetId &&
			row.status === "pending",
	);
	if (outgoingPending) {
		return { following, friend_status: "requested" };
	}

	const incomingPending = connections.some(
		(row) =>
			row.type === "friend_request" &&
			row.requester_id === targetId &&
			row.receiver_id === viewerId &&
			row.status === "pending",
	);
	if (incomingPending) {
		return { following, friend_status: "incoming" };
	}

	return { following, friend_status: "none" };
}

export async function listUsers() {
	const users = await prisma.user.findMany();
	const updated = [];
	for (const user of users) {
		const profile = { ...(user.profile || {}) };
		const hasMfa = String(profile.mfa_setup_code || "").trim();
		const hasStepup = String(profile.stepup_setup_code || "").trim();
		if (!(hasMfa && hasStepup)) {
			await prisma.$transaction(async (tx) => {
				if (!hasMfa) {
					profile.mfa_setup_code = generateSetupCode("mfa");
					await tx.user.update({
						where: { id: user.id },
						data: { profile },
					});
				}
				if (!hasStepup) {
					profile.stepup_setup_code = generateSetupCode("stepup");
					await tx.user.update({
						where: { id: user.id },
						data: { profile },
					});
				}
			});
		}
		updated.push({ ...user, profile });
	}
	return updated.map(cleanUser);
}

export async function listUsersByIds(ids = []) {
	const safeIds = (Array.isArray(ids) ? ids : []).map((id) => String(id));
	if (safeIds.length === 0) {
		return [];
	}
	const users = await prisma.user.findMany({
		where: { id: { in: safeIds } },
	});
	return users.map(cleanUser);
}

// Marketplace rule: a company is identified by its company name. The personal
// account name stays internal (owner + own agents only).
export function companyDisplayName(user = {}) {
	const org = String(user?.profile?.organization_name || user?.company_name || "").trim();
	if (org) {
		return org;
	}
	const name = String(user?.name || "").trim();
	return name || "Unknown";
}

function isSameOrg(a = {}, b = {}) {
	const aOwner = String(a?.org_owner_id || "");
	const bOwner = String(b?.org_owner_id || "");
	return (
		(aOwner !== "" && aOwner === String(b?.id || "")) ||
		(bOwner !== "" && bOwner === String(a?.id || ""))
	);
}

// Strangers get the public company card only. Contact details are withheld
// unless the viewer is the owner, a platform admin, or part of the same org.
export function shapeLookupUser(viewer = {}, target = {}) {
	const cleaned = cleanUser(target);
	const displayName = companyDisplayName(target);
	const isSelf = String(viewer?.id || "") !== "" && String(viewer.id) === String(target.id);
	const isPlatform = ["admin", "owner"].includes(viewer?.role);
	if (isSelf || isPlatform || isSameOrg(viewer, target)) {
		return { ...cleaned, name: displayName };
	}
	const { email: _email, username: _username, ...rest } = cleaned;
	const { phone: _phone, ...profile } = rest.profile || {};
	return { ...rest, name: displayName, profile };
}

export async function lookupPublicUsers(viewer = {}, ids = []) {
	const users = await listUsersByIds(ids);
	const shaped = await Promise.all(
		users.map(async (u) => {
			const out = shapeLookupUser(viewer, u);
			if (u.role !== "agent") {
				// Capacity is a company claim (how many employees work there),
				// not agent bookkeeping. Owner-declared value wins.
				const declared = Number(u?.profile?.capacity || 0);
				out.capacity =
					Number.isFinite(declared) && declared > 0
						? declared
						: await prisma.user
								.count({
									where: {
										role: "agent",
										org_owner_id: u.id,
										status: { not: "removed" },
									},
								})
								.catch(() => 0);
			}
			return out;
		}),
	);
	return { users: shaped };
}

export async function listEarlyVerifiedFactories({ days = 30, limit = 20 } = {}) {
	const cutoff = new Date(Date.now() - Number(days || 30) * 24 * 60 * 60 * 1000);
	const rows = await prisma.user.findMany({
		where: {
			role: "factory",
			verified: true,
			OR: [{ updated_at: { gte: cutoff } }, { created_at: { gte: cutoff } }],
		},
		orderBy: { updated_at: "desc" },
		take: Math.max(1, Math.min(50, Number(limit || 20))),
	});
	return rows.map(cleanUser);
}

// Only the rows between the two users can affect their relationship, so the
// snapshot never needs the whole connections table.
function findPairConnections(viewerId, targetId) {
	return prisma.userConnection.findMany({
		where: {
			OR: [
				{ requester_id: viewerId, receiver_id: targetId },
				{ requester_id: targetId, receiver_id: viewerId },
			],
		},
	});
}

export async function searchUsers(viewerId, query, cursor = 0, limit = 12) {
	const search = sanitizeString(query || "", 120)
		.trim()
		.toLowerCase();

	const where = {
		NOT: { role: "agent" },
	};
	if (search) {
		where.OR = [
			{ name: { contains: search, mode: "insensitive" } },
			{ email: { contains: search, mode: "insensitive" } },
			{ role: { contains: search, mode: "insensitive" } },
			{ username: { contains: search, mode: "insensitive" } },
		];
	}

	const take = Math.min(50, Math.max(1, Number(limit) || 12));

	const [users, total, connections] = await Promise.all([
		prisma.user.findMany({
			where,
			orderBy: { name: "asc" },
			skip: cursor,
			take: take + 1,
		}),
		prisma.user.count({ where }),
		viewerId
			? prisma.userConnection.findMany({
					where: { OR: [{ requester_id: viewerId }, { receiver_id: viewerId }] },
				})
			: [],
	]);

	const hasMore = users.length > take;
	if (hasMore) {
		users.pop();
	}

	const items = users.map((user) => {
		const safe = cleanUser(user);
		const profile = safe.profile || {};
		const isSelf = user.id === viewerId;
		const relation = isSelf
			? { following: false, friend_status: "self" }
			: connectionSnapshot(connections, viewerId, user.id);
		return {
			id: safe.id,
			name: safe.name,
			email: safe.email,
			role: safe.role,
			verified: Boolean(safe.verified),
			company: profile.company || "",
			country: profile.country || "",
			industry: profile.industry || "",
			avatar_url: profile.avatar_url || profile.avatar || "",
			headline: profile.headline || "",
			bio: profile.bio || "",
			is_self: isSelf,
			...relation,
		};
	});

	return {
		items,
		total,
		cursor: cursor + items.length,
		next_cursor: hasMore ? cursor + items.length : null,
	};
}

export async function followUser(viewerId, targetId) {
	const existing = await prisma.userConnection.findFirst({
		where: { type: "follow", requester_id: viewerId, receiver_id: targetId },
	});

	if (existing) {
		await prisma.userConnection.update({
			where: { id: existing.id },
			data: { status: "active", updated_at: new Date() },
		});
	} else {
		await prisma.userConnection.create({
			data: {
				id: crypto.randomUUID(),
				type: "follow",
				requester_id: viewerId,
				receiver_id: targetId,
				status: "active",
				created_at: new Date(),
				updated_at: new Date(),
			},
		});
	}

	const rows = await findPairConnections(viewerId, targetId);
	return connectionSnapshot(rows, viewerId, targetId);
}

export async function sendFriendRequest(viewerId, targetId) {
	const now = new Date();

	const existingFriend = await prisma.userConnection.findFirst({
		where: {
			type: "friend",
			status: { in: ["active", "accepted"] },
			OR: [
				{ requester_id: viewerId, receiver_id: targetId },
				{ requester_id: targetId, receiver_id: viewerId },
			],
		},
	});

	if (existingFriend) {
		const rows = await findPairConnections(viewerId, targetId);
		return connectionSnapshot(rows, viewerId, targetId);
	}

	const incoming = await prisma.userConnection.findFirst({
		where: {
			type: "friend_request",
			requester_id: targetId,
			receiver_id: viewerId,
			status: "pending",
		},
	});

	if (incoming) {
		await prisma.userConnection.update({
			where: { id: incoming.id },
			data: { type: "friend", status: "active", updated_at: now },
		});
		const rows = await findPairConnections(viewerId, targetId);
		return connectionSnapshot(rows, viewerId, targetId);
	}

	const outgoing = await prisma.userConnection.findFirst({
		where: {
			type: "friend_request",
			requester_id: viewerId,
			receiver_id: targetId,
			status: "pending",
		},
	});

	if (!outgoing) {
		await prisma.userConnection.create({
			data: {
				id: crypto.randomUUID(),
				type: "friend_request",
				requester_id: viewerId,
				receiver_id: targetId,
				status: "pending",
				created_at: now,
				updated_at: now,
			},
		});
	}

	const rows = await findPairConnections(viewerId, targetId);
	return connectionSnapshot(rows, viewerId, targetId);
}

export async function findUserByEmail(email) {
	return prisma.user.findFirst({
		where: { email: { equals: email, mode: "insensitive" } },
	});
}

export async function findUserByMemberId(memberId) {
	const id = sanitizeString(String(memberId || ""), 64).trim();
	if (!id) {
		return null;
	}
	return prisma.user.findFirst({
		where: { member_id: { equals: id, mode: "insensitive" } },
	});
}

export async function findUserById(id) {
	return prisma.user.findUnique({ where: { id } });
}

export async function registerUser(payload) {
	const hash = await bcrypt.hash(payload.password, 10);

	const user = {
		id: crypto.randomUUID(),
		name: sanitizeString(payload.name || payload.company_name, 120),
		email: payload.email.toLowerCase(),
		password_hash: hash,
		role: payload.role,
		status: "active",
		verified: false,
		subscription_status: payload.subscription_status === "premium" ? "premium" : "free",
		created_at: new Date(),
		wallet_balance_usd: 0,
		wallet_restricted_usd: 0,
		policy_strikes: 0,
		messaging_restricted_until: null,
		profile: {
			organization_name: sanitizeString(payload.company_name || "", 120),
			position: sanitizeString(payload.profile?.position || "", 80),
			country: sanitizeString(payload.profile?.country || "", 120),
			certifications: Array.isArray(payload.profile?.certifications)
				? payload.profile.certifications.map((c) => sanitizeString(c, 80))
				: [],
			bank_proof: sanitizeString(payload.profile?.bank_proof || "", 200),
			export_license: sanitizeString(payload.profile?.export_license || "", 160),
			factory_sector: sanitizeString(payload.profile?.factory_sector || "", 40).toLowerCase(),
			industry: sanitizeString(
				payload.profile?.industry || payload.profile?.factory_sector || "",
				40,
			).toLowerCase(),
			// Already validated by normalizeCompanyFacts in the auth controller.
			...(Number.isInteger(payload.profile?.employee_count)
				? { employee_count: payload.profile.employee_count }
				: {}),
			...(payload.profile?.production_capacity
				? { production_capacity: payload.profile.production_capacity }
				: {}),
			monthly_capacity: sanitizeString(
				payload.profile?.monthly_capacity ||
					formatProductionCapacity(payload.profile?.production_capacity),
				80,
			),
			moq: sanitizeString(payload.profile?.moq || "", 40),
			lead_time_days: sanitizeString(payload.profile?.lead_time_days || "", 40),
			mfa_setup_code: sanitizeString(
				payload.profile?.mfa_setup_code || generateSetupCode("mfa"),
				120,
			),
			stepup_setup_code: sanitizeString(
				payload.profile?.stepup_setup_code || generateSetupCode("stepup"),
				120,
			),
		},
	};

	try {
		await prisma.user.create({ data: user });
	} catch (error) {
		if (error?.code === "P2002") {
			const duplicate = new Error("Email already used");
			duplicate.status = 409;
			throw duplicate;
		}
		throw error;
	}
	void (async () => {
		try {
			await upsertSubscription(user.id, user.subscription_status, true, {
				actor_id: user.id,
				source: "system",
				note: "user_created",
			});
		} catch {
			// non-blocking: subscription setup should not block signup
		}

		try {
			const config = await getAdminConfig();
			if (config?.feature_flags?.auto_credit !== false) {
				await creditWallet({
					userId: user.id,
					amountUsd: 5,
					reason: "auto_credit",
					ref: `auto-credit:${user.id}`,
					restricted: true,
					metadata: { source: "signup" },
				});
			}
		} catch {
			// non-blocking: auto-credit failures should not block signup
		}

		if (payload?.coupon_code) {
			try {
				await redeemCouponForUser({ userId: user.id, code: payload.coupon_code });
			} catch {
				// non-blocking: coupon fulfillment should not block signup
			}
		}

		try {
			const { createUserOpencodeSession } = await import("./assistantService.js");
			await createUserOpencodeSession(user.id);
		} catch {
			// non-blocking: session creation should not block signup
		}
	})();

	return cleanUser(user);
}

export async function verifyPassword(user, password) {
	return bcrypt.compare(password, user.password_hash);
}

function buildDeletedEmail(userId) {
	const suffix = sanitizeString(String(userId || ""), 80).slice(0, 48) || crypto.randomUUID();
	return `deleted+${suffix}@gartexhub.invalid`;
}

export async function deleteUserWithPassword(userId, password) {
	const current = await prisma.user.findUnique({ where: { id: userId } });
	if (!current) {
		return null;
	}

	const ok = await verifyPassword(current, String(password || ""));
	if (!ok) {
		const err = new Error("Invalid password");
		err.status = 401;
		throw err;
	}

	const now = new Date();
	const updated = await prisma.user.update({
		where: { id: userId },
		data: {
			name: "Deleted User",
			email: buildDeletedEmail(current.id),
			status: "deleted",
			verified: false,
			subscription_status: "free",
			password_hash: await bcrypt.hash(crypto.randomUUID(), 10),
			password_reset_at: now,
			profile: {
				...(current.profile || {}),
				deleted_at: now.toISOString(),
				delete_reason: "self_delete",
			},
		},
	});

	await prisma.userConnection.deleteMany({
		where: {
			OR: [{ requester_id: userId }, { receiver_id: userId }],
		},
	});

	return cleanUser(updated);
}

const PROTECTED_PROFILE_KEYS = [
	"mfa_setup_code",
	"stepup_setup_code",
	"organization_name_changed_at",
];

export const ORGANIZATION_RENAME_LOCK_DAYS = 90;

// Client rule (26/09/2026): a company name is not changed casually. A verified
// company re-submits its trade license and documents; any other company waits
// 90 days between renames.
function assertOrganizationRenameAllowed(user) {
	if (user.verified) {
		const error = new Error(
			"Verified companies change their organization name through verification: re-upload the trade license and documents.",
		);
		error.status = 409;
		error.code = "ORG_NAME_REVERIFY_REQUIRED";
		throw error;
	}
	const changedAt = Date.parse(user.profile?.organization_name_changed_at || "");
	if (Number.isFinite(changedAt)) {
		const lockMs = ORGANIZATION_RENAME_LOCK_DAYS * 24 * 60 * 60 * 1000;
		const remainingMs = changedAt + lockMs - Date.now();
		if (remainingMs > 0) {
			const days = Math.ceil(remainingMs / (24 * 60 * 60 * 1000));
			const error = new Error(
				`The organization name was changed recently. It can be changed again in ${days} day(s).`,
			);
			error.status = 409;
			error.code = "ORG_NAME_LOCKED";
			throw error;
		}
	}
}

export async function updateProfile(userId, profilePatch) {
	const current = await prisma.user.findUnique({ where: { id: userId } });
	if (!current) {
		return null;
	}

	const plan = await getPlanForUser(current);
	const currentProfile = current.profile || {};
	const patch = { ...(profilePatch || {}) };

	// Server-managed keys: security setup codes and the rename timestamp are
	// never accepted from a profile form (mass assignment).
	for (const key of PROTECTED_PROFILE_KEYS) {
		delete patch[key];
	}

	// The settings form calls the company name "display_name"; the marketplace
	// reads profile.organization_name, so both spellings land there.
	if (patch.organization_name === undefined && patch.display_name !== undefined) {
		patch.organization_name = patch.display_name;
	}
	delete patch.display_name;

	const extras = {};
	if (patch.organization_name !== undefined) {
		const nextName = sanitizeString(String(patch.organization_name ?? ""), 120).trim();
		const currentName = String(currentProfile.organization_name || "").trim();
		const renaming = Boolean(nextName) && nextName.toLowerCase() !== currentName.toLowerCase();
		if (!nextName) {
			delete patch.organization_name;
		} else if (renaming && currentName && currentProfile.onboarding_completed === "true") {
			assertOrganizationRenameAllowed(current);
			extras.organization_name_changed_at = new Date().toISOString();
		}
	}

	const companyFacts = normalizeCompanyFacts(patch);
	const factErrors = Object.values(companyFacts.errors);
	if (factErrors.length > 0) {
		const error = new Error(factErrors[0]);
		error.status = 400;
		throw error;
	}
	delete patch.employee_count;
	delete patch.production_capacity;
	Object.assign(extras, companyFacts.value);

	const brandingFields = new Set([
		"brand_logo_url",
		"brand_cover_url",
		"brand_color",
		"brand_accent",
		"brand_tagline",
		"brand_website",
		"brand_name",
		"account_manager_name",
		"account_manager_email",
		"account_manager_phone",
	]);
	const patchEntries = Object.entries(patch)
		.filter(([key]) => plan === "premium" || !brandingFields.has(key))
		.map(([k, v]) => [
			k,
			Array.isArray(v)
				? v.map((x) => sanitizeString(String(x), 120))
				: sanitizeString(String(v ?? ""), k === "bio" || k === "about" ? 1200 : 240),
		]);

	const nextProfile = {
		...currentProfile,
		...Object.fromEntries(patchEntries),
		...extras,
	};

	const updated = await prisma.user.update({
		where: { id: userId },
		data: { profile: nextProfile },
	});

	const patchedKeys = new Set([...patchEntries.map(([key]) => key), ...Object.keys(extras)]);
	const shouldReindex = [...patchedKeys].some((key) => OPENSEARCH_REINDEX_PROFILE_KEYS.has(key));
	if (shouldReindex) {
		const orgId =
			current.role === "agent" && current.org_owner_id
				? String(current.org_owner_id)
				: String(current.id);
		try {
			await reindexOrg(orgId);
		} catch {
			// ignore index failures
		}
	}

	return cleanUser(updated);
}

export async function setUserVerification(userId, verified) {
	const updated = await prisma.user.update({
		where: { id: userId },
		data: { verified: Boolean(verified) },
	});
	if (!updated) {
		return null;
	}
	const orgId =
		updated.role === "agent" && updated.org_owner_id
			? String(updated.org_owner_id)
			: String(updated.id);
	try {
		await reindexOrg(orgId);
	} catch {
		// ignore index failures
	}
	return cleanUser(updated);
}

export async function setUserSubscriptionStatus(userId, plan) {
	const updated = await prisma.user.update({
		where: { id: userId },
		data: { subscription_status: plan === "premium" ? "premium" : "free" },
	});
	if (!updated) {
		return null;
	}
	return cleanUser(updated);
}

export async function adminUpdateUser(userId, patch = {}) {
	const current = await prisma.user.findUnique({ where: { id: userId } });
	if (!current) {
		return null;
	}

	const allowedRoles = new Set(["buyer", "factory", "buying_house", "owner", "admin", "agent"]);
	const nextRole = allowedRoles.has(String(patch.role || "").toLowerCase())
		? String(patch.role).toLowerCase()
		: current.role;
	const nextStatus = patch.status ? sanitizeString(String(patch.status), 40) : current.status;
	const nextVerified = patch.verified === undefined ? current.verified : Boolean(patch.verified);
	const nextPlan = patch.subscription_status
		? String(patch.subscription_status).toLowerCase() === "premium"
			? "premium"
			: "free"
		: current.subscription_status;
	const nextStrikes =
		patch.policy_strikes === undefined
			? current.policy_strikes
			: Math.max(0, Number(patch.policy_strikes || 0));
	const nextMessagingRestricted =
		patch.messaging_restricted_until === undefined
			? current.messaging_restricted_until
			: patch.messaging_restricted_until
				? new Date(patch.messaging_restricted_until)
				: null;
	const nextOrgOwnerId =
		patch.org_owner_id === undefined
			? current.org_owner_id
			: sanitizeString(String(patch.org_owner_id || ""), 120) || null;
	const nextMemberId =
		patch.member_id === undefined
			? current.member_id
			: sanitizeString(String(patch.member_id || ""), 120) || null;
	const nextPermissions =
		patch.permissions === undefined
			? current.permissions
			: Array.isArray(patch.permissions)
				? patch.permissions.map((p) => sanitizeString(String(p), 64))
				: [];
	let nextPermissionMatrix = current.permission_matrix;
	if (patch.permission_matrix !== undefined) {
		const rawMatrix =
			patch.permission_matrix && typeof patch.permission_matrix === "object"
				? patch.permission_matrix
				: {};
		const sections = ["requests", "products", "analytics", "members", "documents"];
		nextPermissionMatrix = Object.fromEntries(
			sections.map((section) => {
				const sectionValue =
					rawMatrix?.[section] && typeof rawMatrix[section] === "object" ? rawMatrix[section] : {};
				return [
					section,
					{
						view: Boolean(sectionValue.view),
						edit: Boolean(sectionValue.edit),
					},
				];
			}),
		);
	}
	const nextChatbot =
		patch.chatbot_enabled === undefined ? current.chatbot_enabled : Boolean(patch.chatbot_enabled);

	const profile = { ...(current.profile || {}) };
	if (patch.fraud_flags !== undefined) {
		profile.fraud_flags = Array.isArray(patch.fraud_flags)
			? patch.fraud_flags.map((v) => sanitizeString(String(v), 80))
			: [];
	}
	if (patch.admin_notes !== undefined) {
		profile.admin_notes = sanitizeString(String(patch.admin_notes || ""), 800);
	}
	if (patch.mfa_setup_code !== undefined) {
		profile.mfa_setup_code = sanitizeString(String(patch.mfa_setup_code || ""), 120);
	}
	if (patch.stepup_setup_code !== undefined) {
		profile.stepup_setup_code = sanitizeString(String(patch.stepup_setup_code || ""), 120);
	}

	const data = {
		role: nextRole,
		status: nextStatus,
		verified: nextVerified,
		subscription_status: nextPlan,
		policy_strikes: nextStrikes,
		messaging_restricted_until: nextMessagingRestricted,
		org_owner_id: nextOrgOwnerId,
		member_id: nextMemberId,
		permissions: nextPermissions,
		permission_matrix: nextPermissionMatrix,
		chatbot_enabled: nextChatbot,
		profile,
	};

	const next = await prisma.user.update({ where: { id: userId }, data });

	const roleChanged =
		String(current.role || "").toLowerCase() !== String(nextRole || "").toLowerCase();
	const verifiedChanged = Boolean(current.verified) !== Boolean(nextVerified);
	const ownerChanged = String(current.org_owner_id || "") !== String(nextOrgOwnerId || "");
	if (roleChanged || verifiedChanged || ownerChanged) {
		const touched = new Set();
		const currentOrgId =
			current.role === "agent" && current.org_owner_id
				? String(current.org_owner_id)
				: String(current.id);
		const nextOrgId =
			nextRole === "agent" && nextOrgOwnerId ? String(nextOrgOwnerId) : String(next.id);
		if (currentOrgId) {
			touched.add(currentOrgId);
		}
		if (nextOrgId) {
			touched.add(nextOrgId);
		}
		for (const orgId of touched) {
			try {
				await reindexOrg(orgId);
			} catch {
				// ignore index failures
			}
		}
	}

	return cleanUser(next);
}

export async function adminSetPassword(userId, newPassword) {
	const existing = await prisma.user.findUnique({ where: { id: userId } });
	if (!existing) {
		return null;
	}

	const hash = await bcrypt.hash(String(newPassword), 10);
	const updated = await prisma.user.update({
		where: { id: userId },
		data: { password_hash: hash, password_reset_at: new Date() },
	});
	return cleanUser(updated);
}

export async function adminForceLogout(userId) {
	const updated = await prisma.user.update({
		where: { id: userId },
		data: { password_reset_at: new Date() },
	});
	if (!updated) {
		return null;
	}
	return cleanUser(updated);
}

export async function selfLockAccount(userId) {
	const current = await prisma.user.findUnique({ where: { id: userId } });
	if (!current) {
		return null;
	}
	const updated = await prisma.user.update({
		where: { id: userId },
		data: {
			status: "locked",
			profile: {
				...(current.profile || {}),
				locked_at: new Date().toISOString(),
				previous_status: current.status,
			},
		},
	});
	return cleanUser(updated);
}

export async function selfUnlockAccount(userId) {
	const current = await prisma.user.findUnique({ where: { id: userId } });
	if (!current) {
		return null;
	}
	const prevStatus = current.profile?.previous_status || "active";
	const updated = await prisma.user.update({
		where: { id: userId },
		data: {
			status: prevStatus,
			profile: {
				...(current.profile || {}),
				locked_at: null,
				previous_status: null,
			},
		},
	});
	return cleanUser(updated);
}

export async function blockUser(actorId, targetId) {
	if (actorId === targetId) {
		const err = new Error("Cannot block yourself");
		err.status = 400;
		throw err;
	}
	const current = await prisma.user.findUnique({ where: { id: actorId } });
	if (!current) {
		return null;
	}
	const blocked = current.profile?.blocked_users || [];
	if (blocked.includes(targetId)) {
		return cleanUser(current);
	}
	const updated = await prisma.user.update({
		where: { id: actorId },
		data: {
			profile: {
				...(current.profile || {}),
				blocked_users: [...blocked, targetId],
			},
		},
	});
	return cleanUser(updated);
}

export async function unblockUser(actorId, targetId) {
	const current = await prisma.user.findUnique({ where: { id: actorId } });
	if (!current) {
		return null;
	}
	const blocked = current.profile?.blocked_users || [];
	const updated = await prisma.user.update({
		where: { id: actorId },
		data: {
			profile: {
				...(current.profile || {}),
				blocked_users: blocked.filter((id) => id !== targetId),
			},
		},
	});
	return cleanUser(updated);
}

export async function getBlockedUsers(userId) {
	const user = await prisma.user.findUnique({ where: { id: userId } });
	if (!user) {
		return [];
	}
	const blockedIds = user.profile?.blocked_users || [];
	if (blockedIds.length === 0) {
		return [];
	}
	const blockedUsers = await prisma.user.findMany({
		where: { id: { in: blockedIds } },
		select: { id: true, name: true, email: true, role: true },
	});
	return blockedUsers;
}

export async function isUserBlocked(actorId, targetId) {
	const actor = await prisma.user.findUnique({ where: { id: actorId } });
	if (!actor) {
		return false;
	}
	const blocked = actor.profile?.blocked_users || [];
	return blocked.includes(targetId);
}

export async function adminLockMessaging(userId, lockHours = 0) {
	const existing = await prisma.user.findUnique({ where: { id: userId } });
	if (!existing) {
		return null;
	}

	const hours = Math.max(0, Number(lockHours || 0));
	const updated = await prisma.user.update({
		where: { id: userId },
		data: {
			messaging_restricted_until: hours ? new Date(Date.now() + hours * 60 * 60 * 1000) : null,
		},
	});
	return cleanUser(updated);
}

export async function deleteUser(userId) {
	const existing = await prisma.user.findUnique({ where: { id: userId } });
	if (!existing) {
		return false;
	}
	await prisma.user.delete({ where: { id: userId } });
	return true;
}
