import crypto from "node:crypto";
import { readLocalJson, updateLocalJson } from "../utils/localStore.js";
import prisma from "../utils/prisma.js";
import { sanitizeString } from "../utils/validators.js";
import { getAdminConfig, updateAdminConfig } from "./adminConfigService.js";
import {
	createKnowledgeEntry,
	deleteKnowledgeEntry,
	updateKnowledgeEntry,
} from "./assistantService.js";
import { markRecording } from "./callSessionService.js";
import { updateContractArtifact, updateContractSignatures } from "./documentService.js";
import { sendEmail } from "./emailService.js";
import {
	createMember,
	deactivateOrRemoveMember,
	resetMemberPassword,
	updateMember,
	updateMemberPermissions,
} from "./memberService.js";
import { createNotification } from "./notificationService.js";
import {
	addOrderCertificationEvidence,
	approveOrderCertification,
	revokeOrderCertification,
} from "./orderCertificationService.js";
import {
	enforcePartnerFreeTierLimits,
	updatePartnerRequestStatus,
} from "./partnerNetworkService.js";
import { updatePaymentProof } from "./paymentProofService.js";
import { recordPolicyViolation, scanPolicyText } from "./policyService.js";
import { recordRefund } from "./refundService.js";
import { createReport, resolveReport } from "./reportService.js";
import { updateRequirement } from "./requirementService.js";
import { renewPremiumMonthly, upsertSubscription } from "./subscriptionService.js";
import { adminUpdateSupportTicket, createSupportTicket } from "./supportTicketService.js";
import {
	adminForceLogout,
	adminLockMessaging,
	adminSetPassword,
	adminUpdateUser,
	findUserById,
	listUsers,
	setUserSubscriptionStatus,
	setUserVerification,
} from "./userService.js";
import {
	adminApproveVerification,
	adminRejectVerification,
	extendVerificationSubscription,
	listExpiringVerifications,
	revokeExpiredVerifications,
	setVerificationSubscription,
} from "./verificationService.js";
import { createCouponCode, creditWallet, debitWallet } from "./walletService.js";

function toId(value, max = 120) {
	return sanitizeString(String(value || ""), max);
}

function toBool(value) {
	if (typeof value === "boolean") {
		return value;
	}
	if (value === undefined || value === null) {
		return false;
	}
	return ["true", "1", "yes", "on"].includes(String(value).toLowerCase());
}

function toNumber(value, fallback = 0) {
	const num = Number(value);
	return Number.isFinite(num) ? num : fallback;
}

function parseCsvList(value) {
	if (Array.isArray(value)) {
		return value.map((v) => sanitizeString(String(v || ""), 160)).filter(Boolean);
	}
	return String(value || "")
		.split(",")
		.map((v) => sanitizeString(v.trim(), 160))
		.filter(Boolean);
}

function parseJson(value) {
	if (!value) {
		return null;
	}
	if (typeof value === "object") {
		return value;
	}
	try {
		return JSON.parse(String(value));
	} catch {
		return null;
	}
}

async function appendLocalRecord(fileName, record = {}, idKey = "id") {
	const id = record?.[idKey] || crypto.randomUUID();
	const entry = {
		...record,
		[idKey]: id,
		created_at: record.created_at || new Date().toISOString(),
	};
	await updateLocalJson(
		fileName,
		(rows = []) => {
			const next = Array.isArray(rows) ? rows : [];
			next.push(entry);
			return next;
		},
		[],
	);
	return entry;
}

async function updateLocalRecord(fileName, id, patch = {}, idKey = "id") {
	let updated = null;
	await updateLocalJson(
		fileName,
		(rows = []) => {
			const next = Array.isArray(rows) ? rows : [];
			const idx = next.findIndex((row) => String(row?.[idKey]) === String(id));
			if (idx < 0) {
				const err = new Error("Record not found");
				err.status = 404;
				throw err;
			}
			updated = {
				...next[idx],
				...patch,
				updated_at: new Date().toISOString(),
			};
			next[idx] = updated;
			return next;
		},
		[],
	);
	return updated;
}

async function removeLocalRecord(fileName, id, idKey = "id") {
	await updateLocalJson(
		fileName,
		(rows = []) =>
			Array.isArray(rows) ? rows.filter((row) => String(row?.[idKey]) !== String(id)) : [],
		[],
	);
	return true;
}

function ensureActor(actor) {
	const role = String(actor?.role || "").toLowerCase();
	if (!(actor && ["owner", "admin"].includes(role))) {
		const err = new Error("Forbidden");
		err.status = 403;
		throw err;
	}
	return actor;
}

async function resolveActor(actor) {
	ensureActor(actor);
	const full = await findUserById(actor.id);
	return full || actor;
}

async function ensureUserExists(userId) {
	const user = await findUserById(userId);
	if (!user) {
		const err = new Error("User not found");
		err.status = 404;
		throw err;
	}
	return user;
}

async function updateCouponsByKey({ codeOrId, patch }) {
	const key = sanitizeString(String(codeOrId || ""), 120).toUpperCase();
	if (!key) {
		const err = new Error("Coupon code or id is required");
		err.status = 400;
		throw err;
	}

	const existing = await prisma.couponCode.findFirst({
		where: {
			OR: [{ id: key }, { code: { equals: key, mode: "insensitive" } }],
		},
	});
	if (!existing) {
		const err = new Error("Coupon not found");
		err.status = 404;
		throw err;
	}
	const updated = await prisma.couponCode.update({
		where: { id: existing.id },
		data: patch,
	});
	return updated;
}

async function addPartnerListEntry(listKey, entryId) {
	const config = await getAdminConfig();
	const list = Array.isArray(config?.partner_controls?.[listKey])
		? config.partner_controls[listKey]
		: [];
	const next = [...new Set([...list, entryId].filter(Boolean))];
	await updateAdminConfig({
		partner_controls: { ...config.partner_controls, [listKey]: next },
	});
	return next;
}

async function removePartnerListEntry(listKey, entryId) {
	const config = await getAdminConfig();
	const list = Array.isArray(config?.partner_controls?.[listKey])
		? config.partner_controls[listKey]
		: [];
	const next = list.filter((id) => String(id) !== String(entryId));
	await updateAdminConfig({
		partner_controls: { ...config.partner_controls, [listKey]: next },
	});
	return next;
}

async function updateMessages(messageId, patch) {
	const existing = await prisma.message.findUnique({
		where: { id: String(messageId) },
	});
	if (!existing) {
		const err = new Error("Message not found");
		err.status = 404;
		throw err;
	}
	return prisma.message.update({
		where: { id: String(messageId) },
		data: patch,
	});
}

async function broadcastNotification({ actor, title, message, roles, premiumOnly, verifiedOnly }) {
	const users = await listUsers();
	const roleSet = new Set((roles || []).map((r) => String(r).toLowerCase()));
	const filtered = users.filter((u) => {
		if (roleSet.size > 0 && !roleSet.has(String(u.role || "").toLowerCase())) {
			return false;
		}
		if (premiumOnly && String(u.subscription_status || "").toLowerCase() !== "premium") {
			return false;
		}
		if (verifiedOnly && !u.verified) {
			return false;
		}
		return true;
	});

	const titleText = sanitizeString(title || "System announcement", 160);
	const msg = sanitizeString(message || "", 240);
	if (!msg) {
		const err = new Error("message is required");
		err.status = 400;
		throw err;
	}

	await Promise.all(
		filtered.map((user) =>
			createNotification(user.id, {
				type: "system_announcement",
				entity_type: "announcement",
				entity_id: crypto.randomUUID(),
				message: `${titleText}: ${msg}`,
				meta: {
					title: titleText,
					actor_id: actor.id,
					premium_only: premiumOnly,
					verified_only: verifiedOnly,
				},
			}),
		),
	);

	return { recipients: filtered.length };
}

export async function performAdminAction(action, payload, actor) {
	const name = sanitizeString(String(action || ""), 80);
	if (!name) {
		const err = new Error("action is required");
		err.status = 400;
		throw err;
	}

	const admin = await resolveActor(actor);

	if (name === "users.export_emails") {
		const users = await listUsers();
		const emails = users.map((u) => u.email).filter(Boolean);
		return { ok: true, count: emails.length, emails };
	}

	if (name === "user.update") {
		const userId = toId(payload.user_id);
		if (!userId) {
			const err = new Error("user_id is required");
			err.status = 400;
			throw err;
		}
		const updated = await adminUpdateUser(userId, payload || {});
		if (!updated) {
			const err = new Error("User not found");
			err.status = 404;
			throw err;
		}
		return { ok: true, user: updated };
	}

	if (name === "user.reset_password") {
		const userId = toId(payload.user_id);
		const newPassword = sanitizeString(String(payload.new_password || ""), 120);
		if (!(userId && newPassword)) {
			const err = new Error("user_id and new_password are required");
			err.status = 400;
			throw err;
		}
		await adminSetPassword(userId, newPassword);
		return { ok: true };
	}

	if (name === "user.force_logout") {
		const userId = toId(payload.user_id);
		if (!userId) {
			const err = new Error("user_id is required");
			err.status = 400;
			throw err;
		}
		await adminForceLogout(userId);
		return { ok: true };
	}

	if (name === "user.lock_messaging") {
		const userId = toId(payload.user_id);
		const hours = toNumber(payload.lock_hours, 24);
		if (!userId) {
			const err = new Error("user_id is required");
			err.status = 400;
			throw err;
		}
		await adminLockMessaging(userId, hours);
		return { ok: true, lock_hours: hours };
	}

	if (name === "org.transfer") {
		const fromOwner = toId(payload.from_owner_id);
		const toOwner = toId(payload.to_owner_id);
		if (!(fromOwner && toOwner)) {
			const err = new Error("from_owner_id and to_owner_id are required");
			err.status = 400;
			throw err;
		}
		await ensureUserExists(toOwner);
		const result = await prisma.user.updateMany({
			where: { org_owner_id: fromOwner },
			data: { org_owner_id: toOwner, updated_at: new Date() },
		});
		return {
			ok: true,
			moved: result.count,
			from_owner_id: fromOwner,
			to_owner_id: toOwner,
		};
	}

	if (name === "org.merge") {
		const source = toId(payload.source_owner_id);
		const target = toId(payload.target_owner_id);
		const archiveSource = toBool(payload.archive_source);
		if (!(source && target)) {
			const err = new Error("source_owner_id and target_owner_id are required");
			err.status = 400;
			throw err;
		}
		await ensureUserExists(target);
		const [moveResult] = await prisma.$transaction(async (tx) => {
			const mr = await tx.user.updateMany({
				where: { org_owner_id: source },
				data: { org_owner_id: target, updated_at: new Date() },
			});
			if (archiveSource) {
				const sourceUser = await tx.user.findUnique({
					where: { id: source },
				});
				if (sourceUser) {
					const profile = {
						...(sourceUser.profile || {}),
						org_merged_into: target,
						org_merged_at: new Date().toISOString(),
					};
					await tx.user.update({
						where: { id: source },
						data: { status: "inactive", profile, updated_at: new Date() },
					});
				}
			}
			return [mr];
		});
		return {
			ok: true,
			moved: moveResult.count,
			source_owner_id: source,
			target_owner_id: target,
		};
	}

	if (name === "org.split") {
		const orgOwnerId = toId(payload.org_owner_id);
		const newOwnerId = toId(payload.new_owner_id);
		const memberIds = parseCsvList(payload.member_ids || payload.members);
		if (!(orgOwnerId && newOwnerId) || memberIds.length === 0) {
			const err = new Error("org_owner_id, new_owner_id and member_ids are required");
			err.status = 400;
			throw err;
		}
		await ensureUserExists(newOwnerId);
		const splitResult = await prisma.user.updateMany({
			where: {
				id: { in: memberIds },
				org_owner_id: orgOwnerId,
			},
			data: { org_owner_id: newOwnerId, updated_at: new Date() },
		});
		return {
			ok: true,
			moved: splitResult.count,
			org_owner_id: orgOwnerId,
			new_owner_id: newOwnerId,
		};
	}

	if (name === "org.quota") {
		const orgOwnerId = toId(payload.org_owner_id);
		const key = sanitizeString(String(payload.key || ""), 80);
		const value = toNumber(payload.value);
		if (!(orgOwnerId && key)) {
			const err = new Error("org_owner_id and key are required");
			err.status = 400;
			throw err;
		}
		const config = await getAdminConfig();
		const current = config?.org_quotas?.[orgOwnerId] || {};
		const next = { ...current, [key]: value };
		const updated = await updateAdminConfig({
			org_quotas: { ...config.org_quotas, [orgOwnerId]: next },
		});
		return { ok: true, config: updated };
	}

	if (name === "org.staff_limit") {
		const orgOwnerId = toId(payload.org_owner_id);
		const limit = toNumber(payload.limit, 0);
		if (!(orgOwnerId && limit)) {
			const err = new Error("org_owner_id and limit are required");
			err.status = 400;
			throw err;
		}
		await updateLocalJson(
			"org_admin_overrides.json",
			(current = {}) => {
				const staffLimits = current.staff_limits || {};
				return {
					...current,
					staff_limits: { ...staffLimits, [orgOwnerId]: limit },
				};
			},
			{ staff_limits: {}, buying_house_staff_ids: [], permission_matrix: {} },
		);
		return { ok: true, org_owner_id: orgOwnerId, staff_limit: limit };
	}

	if (name === "org.buying_house_staff.add") {
		const orgOwnerId = toId(payload.org_owner_id);
		const staffId = toId(payload.staff_id || payload.member_id);
		if (!(orgOwnerId && staffId)) {
			const err = new Error("org_owner_id and staff_id are required");
			err.status = 400;
			throw err;
		}
		await updateLocalJson(
			"org_admin_overrides.json",
			(current = {}) => {
				const list = Array.isArray(current.buying_house_staff_ids)
					? current.buying_house_staff_ids
					: [];
				list.push({
					id: crypto.randomUUID(),
					org_owner_id: orgOwnerId,
					staff_id: staffId,
					created_at: new Date().toISOString(),
				});
				return { ...current, buying_house_staff_ids: list };
			},
			{ staff_limits: {}, buying_house_staff_ids: [], permission_matrix: {} },
		);
		return { ok: true, org_owner_id: orgOwnerId, staff_id: staffId };
	}

	if (name === "org.buying_house_staff.remove") {
		const staffId = toId(payload.staff_id || payload.member_id);
		if (!staffId) {
			const err = new Error("staff_id is required");
			err.status = 400;
			throw err;
		}
		await updateLocalJson(
			"org_admin_overrides.json",
			(current = {}) => {
				const list = Array.isArray(current.buying_house_staff_ids)
					? current.buying_house_staff_ids
					: [];
				return {
					...current,
					buying_house_staff_ids: list.filter((row) => String(row.staff_id) !== String(staffId)),
				};
			},
			{ staff_limits: {}, buying_house_staff_ids: [], permission_matrix: {} },
		);
		return { ok: true, staff_id: staffId };
	}

	if (name === "org.permission_matrix") {
		const orgOwnerId = toId(payload.org_owner_id);
		const matrix = parseJson(payload.permission_matrix || payload.matrix);
		if (!(orgOwnerId && matrix)) {
			const err = new Error("org_owner_id and permission_matrix are required");
			err.status = 400;
			throw err;
		}
		await updateLocalJson(
			"org_admin_overrides.json",
			(current = {}) => {
				const nextMatrix = {
					...(current.permission_matrix || {}),
					[orgOwnerId]: matrix,
				};
				return { ...current, permission_matrix: nextMatrix };
			},
			{ staff_limits: {}, buying_house_staff_ids: [], permission_matrix: {} },
		);
		return { ok: true, org_owner_id: orgOwnerId, permission_matrix: matrix };
	}

	if (name === "agent.create") {
		const orgOwnerId = toId(payload.org_owner_id);
		if (!orgOwnerId) {
			const err = new Error("org_owner_id is required");
			err.status = 400;
			throw err;
		}
		const payloadOut = {
			name: payload.name,
			username: payload.username,
			member_id: payload.member_id,
			email: payload.email,
			permissions: parseCsvList(payload.permissions),
			permission_matrix: parseJson(payload.permission_matrix || payload.permission_matrix_json),
			status: payload.status,
			password: payload.password,
		};
		const created = await createMember(orgOwnerId, payloadOut);
		return { ok: true, member: created };
	}

	if (name === "agent.deactivate" || name === "agent.remove") {
		const orgOwnerId = toId(payload.org_owner_id);
		const memberId = toId(payload.member_id);
		if (!(orgOwnerId && memberId)) {
			const err = new Error("org_owner_id and member_id are required");
			err.status = 400;
			throw err;
		}
		const result = await deactivateOrRemoveMember(
			orgOwnerId,
			memberId,
			name === "agent.remove" ? "remove" : "deactivate",
		);
		if (!result) {
			const err = new Error("Member not found");
			err.status = 404;
			throw err;
		}
		return { ok: true, ...result };
	}

	if (name === "agent.activate") {
		const orgOwnerId = toId(payload.org_owner_id);
		const memberId = toId(payload.member_id);
		if (!(orgOwnerId && memberId)) {
			const err = new Error("org_owner_id and member_id are required");
			err.status = 400;
			throw err;
		}
		const updated = await updateMember(orgOwnerId, memberId, {
			status: "active",
		});
		if (!updated) {
			const err = new Error("Member not found");
			err.status = 404;
			throw err;
		}
		return { ok: true, member: updated };
	}

	if (name === "agent.reset_password") {
		const orgOwnerId = toId(payload.org_owner_id);
		const memberId = toId(payload.member_id);
		if (!(orgOwnerId && memberId)) {
			const err = new Error("org_owner_id and member_id are required");
			err.status = 400;
			throw err;
		}
		const result = await resetMemberPassword(orgOwnerId, memberId);
		if (!result) {
			const err = new Error("Member not found");
			err.status = 404;
			throw err;
		}
		return { ok: true, ...result };
	}

	if (name === "agent.permissions") {
		const orgOwnerId = toId(payload.org_owner_id);
		const memberId = toId(payload.member_id);
		if (!(orgOwnerId && memberId)) {
			const err = new Error("org_owner_id and member_id are required");
			err.status = 400;
			throw err;
		}
		const permissions = parseCsvList(payload.permissions);
		const matrix = parseJson(payload.permission_matrix || payload.permission_matrix_json);
		const updated = await updateMemberPermissions(orgOwnerId, memberId, permissions, matrix);
		if (!updated) {
			const err = new Error("Member not found");
			err.status = 404;
			throw err;
		}
		return { ok: true, member: updated };
	}

	if (name === "verification.approve") {
		const userId = toId(payload.user_id);
		if (!userId) {
			const err = new Error("user_id is required");
			err.status = 400;
			throw err;
		}
		const record = await adminApproveVerification(userId);
		if (!record) {
			const err = new Error("Verification record not found");
			err.status = 404;
			throw err;
		}
		await setUserVerification(userId, Boolean(record.verified));
		await createNotification(userId, {
			type: record.verified ? "verification_approved" : "verification_pending",
			entity_type: "verification",
			entity_id: userId,
			message: record.verified
				? "Your verification was approved."
				: "Verification requires additional steps (missing documents or premium subscription).",
			meta: {
				review_status: record.review_status,
				reason: record.review_reason,
			},
		});
		await appendLocalRecord("verification_badge_audit.json", {
			user_id: userId,
			action: record.verified ? "approved" : "pending",
			reason: record.review_reason || "",
			actor_id: admin.id,
			at: new Date().toISOString(),
		});
		return { ok: true, record };
	}

	if (name === "verification.reject") {
		const userId = toId(payload.user_id);
		const reason = sanitizeString(String(payload.reason || "rejected_by_admin"), 240);
		if (!userId) {
			const err = new Error("user_id is required");
			err.status = 400;
			throw err;
		}
		const record = await adminRejectVerification(userId, reason);
		if (!record) {
			const err = new Error("Verification record not found");
			err.status = 404;
			throw err;
		}
		await setUserVerification(userId, false);
		await createNotification(userId, {
			type: "verification_rejected",
			entity_type: "verification",
			entity_id: userId,
			message: `Verification rejected: ${reason}`,
			meta: { reason },
		});
		await appendLocalRecord("verification_badge_audit.json", {
			user_id: userId,
			action: "rejected",
			reason,
			actor_id: admin.id,
			at: new Date().toISOString(),
		});
		return { ok: true, record };
	}

	if (name === "verification.remind_expiring") {
		const threshold =
			payload.threshold_days === undefined ? 7 : Math.max(1, toNumber(payload.threshold_days, 7));
		const expiring = await listExpiringVerifications(threshold);
		await Promise.all(
			expiring.map((rec) =>
				createNotification(rec.user_id, {
					type: "verification_expiring",
					entity_type: "verification",
					entity_id: rec.user_id,
					message: `Your verification expires in ${rec.subscription_remaining_days || threshold} day(s). Renew premium to keep your badge active.`,
					meta: {
						remaining_days: rec.subscription_remaining_days || threshold,
					},
				}),
			),
		);
		return { ok: true, count: expiring.length };
	}

	if (name === "verification.revoke_expired") {
		const before = await prisma.verification.findMany({
			where: { verified: true },
		});
		const updated = await revokeExpiredVerifications();
		const revokedIds = before
			.filter(
				(rec) =>
					rec.verified && !updated.find((row) => row.user_id === rec.user_id && row.verified),
			)
			.map((rec) => rec.user_id);
		await Promise.all(
			revokedIds.map((userId) =>
				createNotification(userId, {
					type: "verification_expired",
					entity_type: "verification",
					entity_id: userId,
					message: "Verification expired because the premium subscription ended.",
					meta: { reason: "subscription_expired" },
				}),
			),
		);
		return { ok: true, revoked: revokedIds.length };
	}

	if (name === "verification.doc.review") {
		const docId = toId(payload.doc_id || payload.document_id);
		const status = sanitizeString(String(payload.status || "approved"), 40);
		if (!docId) {
			const err = new Error("doc_id is required");
			err.status = 400;
			throw err;
		}
		let updated = null;
		await updateLocalJson(
			"verification_docs.json",
			(rows = []) => {
				const next = Array.isArray(rows) ? rows : [];
				const idx = next.findIndex((row) => String(row.id) === String(docId));
				const entry = {
					id: docId,
					status,
					review_reason: sanitizeString(String(payload.reason || ""), 200),
					reviewed_at: new Date().toISOString(),
					reviewer_id: admin.id,
				};
				if (idx < 0) {
					next.push(entry);
					updated = entry;
				} else {
					updated = { ...next[idx], ...entry };
					next[idx] = updated;
				}
				return next;
			},
			[],
		);
		return { ok: true, document: updated };
	}

	if (name === "verification.fraud.flag") {
		const userId = toId(payload.user_id);
		const reason = sanitizeString(String(payload.reason || "fraud_flag"), 200);
		if (!userId) {
			const err = new Error("user_id is required");
			err.status = 400;
			throw err;
		}
		const existing = await prisma.verification.findUnique({
			where: { user_id: String(userId) },
		});
		if (!existing) {
			const err = new Error("Verification record not found");
			err.status = 404;
			throw err;
		}
		const updatedRecord = await prisma.verification.update({
			where: { user_id: String(userId) },
			data: {
				credibility: {
					...(existing.credibility || {}),
					fraud_flag: true,
					fraud_reason: reason,
				},
				updated_at: new Date(),
			},
		});
		await appendLocalRecord("verification_badge_audit.json", {
			user_id: userId,
			action: "fraud_flag",
			reason,
			actor_id: admin.id,
			at: new Date().toISOString(),
		});
		return { ok: true, record: updatedRecord };
	}

	if (name === "verification.badge.revoke") {
		const userId = toId(payload.user_id);
		if (!userId) {
			const err = new Error("user_id is required");
			err.status = 400;
			throw err;
		}
		const existing = await prisma.verification.findUnique({
			where: { user_id: String(userId) },
		});
		if (!existing) {
			const err = new Error("Verification record not found");
			err.status = 404;
			throw err;
		}
		const updatedRecord = await prisma.verification.update({
			where: { user_id: String(userId) },
			data: {
				verified: false,
				review_status: "revoked",
				updated_at: new Date(),
			},
		});
		await setUserVerification(userId, false);
		await appendLocalRecord("verification_badge_audit.json", {
			user_id: userId,
			action: "revoked",
			reason: sanitizeString(String(payload.reason || "revoked_by_admin"), 200),
			actor_id: admin.id,
			at: new Date().toISOString(),
		});
		return { ok: true, record: updatedRecord };
	}

	if (name === "subscription.set_plan") {
		const userId = toId(payload.user_id);
		const plan = sanitizeString(String(payload.plan || "free"), 20).toLowerCase();
		if (!userId) {
			const err = new Error("user_id is required");
			err.status = 400;
			throw err;
		}
		await setUserSubscriptionStatus(userId, plan);
		const sub = await upsertSubscription(userId, plan, toBool(payload.auto_renew), {
			actor_id: admin.id,
			source: "admin_action",
			note: `set_plan:${plan}`,
		});
		if (plan === "premium") {
			await extendVerificationSubscription(userId, 30);
		} else {
			await setVerificationSubscription(userId, "");
		}
		return { ok: true, subscription: sub };
	}

	if (name === "subscription.renew") {
		const userId = toId(payload.user_id);
		if (!userId) {
			const err = new Error("user_id is required");
			err.status = 400;
			throw err;
		}
		await setUserSubscriptionStatus(userId, "premium");
		const sub = await renewPremiumMonthly(userId, toBool(payload.auto_renew), {
			actor_id: admin.id,
			source: "admin_action",
			note: "manual_renew",
		});
		await extendVerificationSubscription(userId, 30);
		return { ok: true, subscription: sub };
	}

	if (name === "finance.invoice.add") {
		const invoice = {
			id: crypto.randomUUID(),
			user_id: toId(payload.user_id),
			amount_usd: toNumber(payload.amount_usd),
			status: sanitizeString(String(payload.status || "issued"), 40),
			created_at: new Date().toISOString(),
			note: sanitizeString(String(payload.note || ""), 200),
		};
		await appendLocalRecord("invoice_log.json", invoice);
		return { ok: true, invoice };
	}

	if (name === "finance.payout.add") {
		const payout = {
			id: crypto.randomUUID(),
			user_id: toId(payload.user_id),
			amount_usd: toNumber(payload.amount_usd),
			status: sanitizeString(String(payload.status || "queued"), 40),
			created_at: new Date().toISOString(),
			note: sanitizeString(String(payload.note || ""), 200),
		};
		await appendLocalRecord("payout_ledger.json", payout);
		return { ok: true, payout };
	}

	if (name === "wallet.credit") {
		const userId = toId(payload.user_id);
		const amount = toNumber(payload.amount_usd);
		if (!(userId && amount)) {
			const err = new Error("user_id and amount_usd are required");
			err.status = 400;
			throw err;
		}
		const result = await creditWallet({
			userId,
			amountUsd: amount,
			reason: sanitizeString(String(payload.reason || "manual_credit"), 80),
			ref: sanitizeString(String(payload.ref || ""), 160),
			restricted: toBool(payload.restricted),
			metadata: payload?.metadata && typeof payload.metadata === "object" ? payload.metadata : {},
		});
		return { ok: true, ...result };
	}

	if (name === "wallet.debit") {
		const userId = toId(payload.user_id);
		const amount = toNumber(payload.amount_usd);
		if (!(userId && amount)) {
			const err = new Error("user_id and amount_usd are required");
			err.status = 400;
			throw err;
		}
		const result = await debitWallet({
			userId,
			amountUsd: amount,
			reason: sanitizeString(String(payload.reason || "manual_debit"), 80),
			ref: sanitizeString(String(payload.ref || ""), 160),
			allowRestricted: toBool(payload.allow_restricted),
			metadata: payload?.metadata && typeof payload.metadata === "object" ? payload.metadata : {},
		});
		return { ok: true, ...result };
	}

	if (name === "wallet.refund") {
		const userId = toId(payload.user_id);
		const amount = toNumber(payload.amount_usd);
		if (!(userId && amount)) {
			const err = new Error("user_id and amount_usd are required");
			err.status = 400;
			throw err;
		}
		const reason = sanitizeString(String(payload.reason || "refund"), 120);
		const ref = sanitizeString(String(payload.ref || ""), 160);
		const result = await creditWallet({
			userId,
			amountUsd: amount,
			reason,
			ref,
			restricted: false,
			metadata: { refund: true, admin_id: admin.id },
		});
		const refund = await recordRefund({
			userId,
			amountUsd: amount,
			reason,
			ref,
			actorId: admin.id,
		});
		return { ok: true, refund, ...result };
	}

	if (name === "wallet.auto_credit") {
		const enabled = toBool(payload.enabled);
		const config = await updateAdminConfig({
			feature_flags: { auto_credit: enabled },
		});
		return { ok: true, config };
	}

	if (name === "coupon.create") {
		const created = await createCouponCode(payload || {});
		return { ok: true, coupon: created };
	}

	if (name === "coupon.disable") {
		const updated = await updateCouponsByKey({
			codeOrId: payload.code || payload.coupon_id || payload.id,
			patch: { active: false },
		});
		return { ok: true, coupon: updated };
	}

	if (name === "coupon.expire") {
		const expiresAt = payload.expires_at
			? new Date(payload.expires_at).toISOString()
			: new Date().toISOString();
		const updated = await updateCouponsByKey({
			codeOrId: payload.code || payload.coupon_id || payload.id,
			patch: { active: false, expires_at: expiresAt },
		});
		return { ok: true, coupon: updated };
	}

	if (name === "coupon.redemption.add") {
		const codeId = toId(payload.code_id || payload.coupon_id);
		const userId = toId(payload.user_id);
		const amount = toNumber(payload.amount_usd);
		if (!(codeId && userId)) {
			const err = new Error("code_id and user_id are required");
			err.status = 400;
			throw err;
		}
		const redemption = {
			id: crypto.randomUUID(),
			code_id: codeId,
			user_id: userId,
			amount_usd: amount,
			created_at: new Date().toISOString(),
		};
		await prisma.couponRedemption.create({ data: redemption });
		return { ok: true, redemption };
	}

	if (name === "coupon.campaign.add") {
		const campaign = {
			id: crypto.randomUUID(),
			name: sanitizeString(String(payload.name || "campaign"), 80),
			type: sanitizeString(String(payload.type || "general"), 40),
			status: sanitizeString(String(payload.status || "active"), 40),
			created_at: new Date().toISOString(),
		};
		await appendLocalRecord("coupon_campaigns.json", campaign);
		return { ok: true, campaign };
	}

	if (name === "coupon.campaign.disable") {
		const campaignId = toId(payload.campaign_id || payload.id);
		const updated = await updateLocalRecord("coupon_campaigns.json", campaignId, {
			status: "disabled",
		});
		return { ok: true, campaign: updated };
	}

	if (
		name === "partner.force_accept" ||
		name === "partner.force_reject" ||
		name === "partner.force_cancel"
	) {
		const requestId = toId(payload.request_id);
		if (!requestId) {
			const err = new Error("request_id is required");
			err.status = 400;
			throw err;
		}
		const actionVerb =
			name === "partner.force_accept"
				? "accept"
				: name === "partner.force_reject"
					? "reject"
					: "cancel";
		const updated = await updatePartnerRequestStatus(admin, requestId, actionVerb);
		return { ok: true, request: updated };
	}

	if (name === "partner.blacklist.add") {
		const entry = toId(payload.entry_id || payload.user_id || payload.org_id);
		if (!entry) {
			const err = new Error("entry_id is required");
			err.status = 400;
			throw err;
		}
		const list = await addPartnerListEntry("blacklist", entry);
		return { ok: true, blacklist: list };
	}

	if (name === "partner.blacklist.remove") {
		const entry = toId(payload.entry_id || payload.user_id || payload.org_id);
		if (!entry) {
			const err = new Error("entry_id is required");
			err.status = 400;
			throw err;
		}
		const list = await removePartnerListEntry("blacklist", entry);
		return { ok: true, blacklist: list };
	}

	if (name === "partner.whitelist.add") {
		const entry = toId(payload.entry_id || payload.user_id || payload.org_id);
		if (!entry) {
			const err = new Error("entry_id is required");
			err.status = 400;
			throw err;
		}
		const list = await addPartnerListEntry("whitelist", entry);
		return { ok: true, whitelist: list };
	}

	if (name === "partner.whitelist.remove") {
		const entry = toId(payload.entry_id || payload.user_id || payload.org_id);
		if (!entry) {
			const err = new Error("entry_id is required");
			err.status = 400;
			throw err;
		}
		const list = await removePartnerListEntry("whitelist", entry);
		return { ok: true, whitelist: list };
	}

	if (name === "partner.free_tier_limit") {
		const limit = toNumber(payload.limit, 5);
		const config = await updateAdminConfig({
			plan_limits: { free: { partner_limit: limit } },
		});
		return { ok: true, config };
	}

	if (name === "partner.enforce_free_tier") {
		const result = await enforcePartnerFreeTierLimits();
		return { ok: true, ...result };
	}

	if (name === "partner.override") {
		const requestId = toId(payload.request_id);
		const action = sanitizeString(
			String(payload.override_action || payload.action || "override"),
			80,
		);
		if (!requestId) {
			const err = new Error("request_id is required");
			err.status = 400;
			throw err;
		}
		const entry = await appendLocalRecord("partner_overrides.json", {
			request_id: requestId,
			action,
			note: sanitizeString(String(payload.note || ""), 200),
			actor_id: admin.id,
		});
		return { ok: true, override: entry };
	}

	if (name === "partner.connect") {
		const requestId = toId(payload.request_id);
		if (!requestId) {
			const err = new Error("request_id is required");
			err.status = 400;
			throw err;
		}
		const existing = await prisma.partnerRequest.findUnique({
			where: { id: requestId },
		});
		if (!existing) {
			const err = new Error("Partner request not found");
			err.status = 404;
			throw err;
		}
		const updatedRow = await prisma.partnerRequest.update({
			where: { id: requestId },
			data: { status: "connected", updated_at: new Date() },
		});
		return { ok: true, request: updatedRow };
	}

	if (name === "request.status") {
		const requirementId = toId(payload.requirement_id);
		const status = sanitizeString(String(payload.status || ""), 40);
		if (!(requirementId && status)) {
			const err = new Error("requirement_id and status are required");
			err.status = 400;
			throw err;
		}
		const updated = await updateRequirement(requirementId, { status }, admin);
		if (!updated) {
			const err = new Error("Request not found");
			err.status = 404;
			throw err;
		}
		return { ok: true, request: updated };
	}

	if (name === "request.verified_only") {
		const requirementId = toId(payload.requirement_id);
		const verifiedOnly = toBool(payload.verified_only);
		if (!requirementId) {
			const err = new Error("requirement_id is required");
			err.status = 400;
			throw err;
		}
		const updated = await updateRequirement(requirementId, { verified_only: verifiedOnly }, admin);
		if (!updated) {
			const err = new Error("Request not found");
			err.status = 404;
			throw err;
		}
		return { ok: true, request: updated };
	}

	if (name === "request.expiry_override") {
		const requirementId = toId(payload.requirement_id);
		const expiresAt = payload.expires_at ? new Date(payload.expires_at).toISOString() : null;
		if (!(requirementId && expiresAt)) {
			const err = new Error("requirement_id and expires_at are required");
			err.status = 400;
			throw err;
		}
		const updated = await updateRequirement(requirementId, { expires_at: expiresAt }, admin);
		if (!updated) {
			const err = new Error("Request not found");
			err.status = 404;
			throw err;
		}
		return { ok: true, request: updated };
	}

	if (name === "match.quality.update") {
		const matchId = toId(payload.match_id || payload.id);
		const score = toNumber(payload.score, 0);
		if (!matchId) {
			const err = new Error("match_id is required");
			err.status = 400;
			throw err;
		}
		const entry = await appendLocalRecord("match_quality.json", {
			match_id: matchId,
			score,
			note: sanitizeString(String(payload.note || ""), 200),
			actor_id: admin.id,
		});
		return { ok: true, match_quality: entry };
	}

	if (name === "request.spam.filter.add") {
		const pattern = sanitizeString(String(payload.pattern || ""), 120);
		if (!pattern) {
			const err = new Error("pattern is required");
			err.status = 400;
			throw err;
		}
		const entry = await appendLocalRecord("spam_filters.json", {
			pattern,
			action: sanitizeString(String(payload.action || "flag"), 40),
			created_by: admin.id,
		});
		return { ok: true, filter: entry };
	}

	if (name === "request.spam.filter.remove") {
		const filterId = toId(payload.filter_id || payload.id);
		if (!filterId) {
			const err = new Error("filter_id is required");
			err.status = 400;
			throw err;
		}
		await removeLocalRecord("spam_filters.json", filterId);
		return { ok: true };
	}

	if (name === "request.spam.flag") {
		const requirementId = toId(payload.requirement_id || payload.request_id);
		if (!requirementId) {
			const err = new Error("requirement_id is required");
			err.status = 400;
			throw err;
		}
		const entry = await appendLocalRecord("spam_flags.json", {
			entity_type: "request",
			entity_id: requirementId,
			reason: sanitizeString(String(payload.reason || "spam"), 200),
			actor_id: admin.id,
		});
		return { ok: true, flag: entry };
	}

	if (
		name === "contract.lock" ||
		name === "contract.unlock" ||
		name === "contract.archive" ||
		name === "contract.unarchive"
	) {
		const contractId = toId(payload.contract_id);
		if (!contractId) {
			const err = new Error("contract_id is required");
			err.status = 400;
			throw err;
		}
		const status =
			name === "contract.lock" ? "locked" : name === "contract.archive" ? "archived" : "generated";
		const updated = await updateContractArtifact(contractId, { status }, admin);
		if (!updated) {
			const err = new Error("Contract not found");
			err.status = 404;
			throw err;
		}
		await appendLocalRecord("contract_audit.json", {
			contract_id: contractId,
			action: name,
			actor_id: admin.id,
			at: new Date().toISOString(),
		});
		return { ok: true, contract: updated };
	}

	if (name === "contract.signatures") {
		const contractId = toId(payload.contract_id);
		if (!contractId) {
			const err = new Error("contract_id is required");
			err.status = 400;
			throw err;
		}
		const patch = {
			buyer_signature_state: payload.buyer_signature_state,
			factory_signature_state: payload.factory_signature_state,
			is_draft: payload.is_draft === undefined ? undefined : toBool(payload.is_draft),
		};
		const updated = await updateContractSignatures(contractId, patch, admin);
		if (!updated) {
			const err = new Error("Contract not found");
			err.status = 404;
			throw err;
		}
		await appendLocalRecord("contract_audit.json", {
			contract_id: contractId,
			action: "contract.signatures",
			actor_id: admin.id,
			at: new Date().toISOString(),
			note: sanitizeString(String(payload.note || ""), 200),
		});
		return { ok: true, contract: updated };
	}

	if (name === "payment_proof.review") {
		const proofId = toId(payload.proof_id);
		if (!proofId) {
			const err = new Error("proof_id is required");
			err.status = 400;
			throw err;
		}
		const updated = await updatePaymentProof(admin, proofId, {
			status: payload.status,
			review_reason: payload.review_reason,
		});
		if (!updated) {
			const err = new Error("Payment proof not found");
			err.status = 404;
			throw err;
		}
		return { ok: true, payment_proof: updated };
	}

	if (name === "contract.audit.export") {
		const contractId = toId(payload.contract_id);
		if (!contractId) {
			const err = new Error("contract_id is required");
			err.status = 400;
			throw err;
		}
		const entry = await appendLocalRecord("contract_audit.json", {
			contract_id: contractId,
			action: "export",
			actor_id: admin.id,
			note: sanitizeString(String(payload.note || ""), 200),
			at: new Date().toISOString(),
		});
		return { ok: true, export: entry };
	}

	if (name === "contract.audit.note") {
		const contractId = toId(payload.contract_id);
		if (!contractId) {
			const err = new Error("contract_id is required");
			err.status = 400;
			throw err;
		}
		const entry = await appendLocalRecord("contract_audit.json", {
			contract_id: contractId,
			action: "note",
			actor_id: admin.id,
			note: sanitizeString(String(payload.note || ""), 200),
			at: new Date().toISOString(),
		});
		return { ok: true, audit: entry };
	}

	if (name === "dispute.open") {
		const contractId = toId(payload.contract_id);
		const reason = sanitizeString(String(payload.reason || ""), 400);
		if (!(contractId && reason)) {
			const err = new Error("contract_id and reason are required");
			err.status = 400;
			throw err;
		}
		const report = await createReport({
			actor: admin,
			entity_type: "contract_dispute",
			entity_id: contractId,
			reason,
			metadata: payload?.metadata && typeof payload.metadata === "object" ? payload.metadata : {},
		});
		return { ok: true, dispute: report };
	}

	if (name === "dispute.resolve") {
		const reportId = toId(payload.report_id);
		if (!reportId) {
			const err = new Error("report_id is required");
			err.status = 400;
			throw err;
		}
		const resolved = await resolveReport(reportId, admin, {
			action: payload.resolution_action,
			note: payload.resolution_note,
		});
		if (!resolved) {
			const err = new Error("Report not found");
			err.status = 404;
			throw err;
		}
		return { ok: true, dispute: resolved };
	}

	if (name === "call.recording") {
		const callId = toId(payload.call_id);
		if (!callId) {
			const err = new Error("call_id is required");
			err.status = 400;
			throw err;
		}
		const call = await prisma.callSession.findUnique({
			where: { id: String(callId) },
		});
		if (!call) {
			const err = new Error("Call not found");
			err.status = 404;
			throw err;
		}
		const result = await markRecording(callId, call.created_by || admin.id, {
			recording_status: payload.recording_status,
			recording_url: payload.recording_url,
			failure_reason: payload.failure_reason,
		});
		if (!result || result === "forbidden") {
			const err = new Error("Recording update failed");
			err.status = 400;
			throw err;
		}
		return { ok: true, call: result };
	}

	if (name === "call.escalate") {
		const callId = toId(payload.call_id);
		if (!callId) {
			const err = new Error("call_id is required");
			err.status = 400;
			throw err;
		}
		const entry = await appendLocalRecord("call_escalations.json", {
			call_id: callId,
			note: sanitizeString(String(payload.note || ""), 200),
			severity: sanitizeString(String(payload.severity || "medium"), 40),
			actor_id: admin.id,
		});
		return { ok: true, escalation: entry };
	}

	if (name === "call.proof.enforce") {
		const callId = toId(payload.call_id);
		if (!callId) {
			const err = new Error("call_id is required");
			err.status = 400;
			throw err;
		}
		const call = await prisma.callSession.findUnique({
			where: { id: String(callId) },
		});
		if (!call) {
			const err = new Error("Call not found");
			err.status = 404;
			throw err;
		}
		const updated = await prisma.callSession.update({
			where: { id: String(callId) },
			data: {
				context: {
					...(call.context || {}),
					proof_required: true,
					proof_enforced_at: new Date().toISOString(),
				},
			},
		});
		return { ok: true, call: updated };
	}

	if (name === "message.takedown") {
		const messageId = toId(payload.message_id);
		const reason = sanitizeString(String(payload.reason || "admin_takedown"), 120);
		if (!messageId) {
			const err = new Error("message_id is required");
			err.status = 400;
			throw err;
		}
		const target = await prisma.message.findUnique({
			where: { id: String(messageId) },
		});
		if (!target) {
			const err = new Error("Message not found");
			err.status = 404;
			throw err;
		}

		const updated = await updateMessages(messageId, {
			message: "[Removed by admin moderation]",
			moderated: true,
			moderation_reason: reason,
		});

		if (toBool(payload.apply_strike ?? true)) {
			await recordPolicyViolation({
				actor_id: target.sender_id,
				kind: "manual_takedown",
				reason,
				entity_type: "message",
				entity_id: target.id,
				content: target.message,
				metadata: { admin_id: admin.id },
			});
		}

		return { ok: true, message: updated };
	}

	if (name === "message.redact") {
		const messageId = toId(payload.message_id);
		const reason = sanitizeString(String(payload.reason || "admin_redact"), 120);
		if (!messageId) {
			const err = new Error("message_id is required");
			err.status = 400;
			throw err;
		}
		const updated = await updateMessages(messageId, {
			message: "[Content redacted by admin]",
			moderated: true,
			moderation_reason: reason,
		});
		return { ok: true, message: updated };
	}

	if (name === "message.transfer.audit") {
		const threadId = toId(payload.thread_id || payload.conversation_id);
		if (!threadId) {
			const err = new Error("thread_id is required");
			err.status = 400;
			throw err;
		}
		const entry = await appendLocalRecord("chat_transfer_audit.json", {
			thread_id: threadId,
			from: sanitizeString(String(payload.from || ""), 80),
			to: sanitizeString(String(payload.to || ""), 80),
			note: sanitizeString(String(payload.note || ""), 200),
			actor_id: admin.id,
		});
		return { ok: true, transfer: entry };
	}

	if (name === "message.flag") {
		const messageId = toId(payload.message_id);
		if (!messageId) {
			const err = new Error("message_id is required");
			err.status = 400;
			throw err;
		}
		const entry = await appendLocalRecord("spam_flags.json", {
			entity_type: "message",
			entity_id: messageId,
			reason: sanitizeString(String(payload.reason || "spam"), 200),
			actor_id: admin.id,
		});
		return { ok: true, flag: entry };
	}

	if (name === "message.spam.scan") {
		const rows = await prisma.message.findMany();
		let flagged = 0;
		for (const msg of rows) {
			const scan = scanPolicyText(msg.message || "");
			if (!scan) {
				continue;
			}
			await appendLocalRecord("spam_flags.json", {
				entity_type: "message",
				entity_id: msg.id,
				reason: scan.reason,
				actor_id: admin.id,
			});
			flagged += 1;
		}
		return { ok: true, flagged };
	}

	if (name === "content.flag") {
		const entityId = toId(payload.entity_id);
		if (!entityId) {
			const err = new Error("entity_id is required");
			err.status = 400;
			throw err;
		}
		const entry = await appendLocalRecord("content_flags.json", {
			entity_type: sanitizeString(String(payload.entity_type || "document"), 40),
			entity_id: entityId,
			reason: sanitizeString(String(payload.reason || "flagged"), 200),
			actor_id: admin.id,
		});
		return { ok: true, flag: entry };
	}

	if (name === "content.bulk_approve") {
		const docsResult = await prisma.document.updateMany({
			where: { moderation_status: "pending_review" },
			data: { moderation_status: "approved" },
		});
		const productResult = await prisma.product.updateMany({
			where: {
				video_url: { not: null },
				video_review_status: { not: "approved" },
			},
			data: { video_review_status: "approved", video_restricted: false },
		});
		return {
			ok: true,
			documents: docsResult.count,
			products: productResult.count,
		};
	}

	if (name === "violation.strike") {
		const userId = toId(payload.user_id);
		const reason = sanitizeString(String(payload.reason || "manual_strike"), 120);
		const kind = sanitizeString(String(payload.kind || "manual"), 60);
		if (!userId) {
			const err = new Error("user_id is required");
			err.status = 400;
			throw err;
		}
		const violation = await recordPolicyViolation({
			actor_id: userId,
			kind,
			reason,
			entity_type: "manual",
			entity_id: userId,
			content: reason,
			metadata: { admin_id: admin.id },
		});
		return { ok: true, violation };
	}

	if (name === "support.ticket.create") {
		const userId = toId(payload.user_id);
		if (!userId) {
			const err = new Error("user_id is required");
			err.status = 400;
			throw err;
		}
		const user = await ensureUserExists(userId);
		const subject = sanitizeString(String(payload.subject || "Support ticket"), 160);
		const note = sanitizeString(String(payload.note || "Created by admin"), 1200);
		const priority = sanitizeString(String(payload.priority || "standard"), 40);
		const created = await createSupportTicket({
			actor: user,
			subject,
			description: note,
			category: "Admin",
			priority,
			pageUrl: "",
			contactEmail: user.email || "",
		});
		return { ok: true, ticket: created.ticket };
	}

	if (name === "support.ticket.update") {
		const ticketId = toId(payload.ticket_id || payload.id);
		if (!ticketId) {
			const err = new Error("ticket_id is required");
			err.status = 400;
			throw err;
		}
		const patch = {
			status: sanitizeString(String(payload.status || ""), 40),
			priority: sanitizeString(String(payload.priority || ""), 40),
			resolution_note: sanitizeString(String(payload.note || ""), 240),
		};
		const updated = await adminUpdateSupportTicket(ticketId, patch, admin.id);
		return { ok: true, ticket: updated };
	}

	if (name === "support.ticket.resolve") {
		const ticketId = toId(payload.ticket_id || payload.id);
		if (!ticketId) {
			const err = new Error("ticket_id is required");
			err.status = 400;
			throw err;
		}
		const updated = await adminUpdateSupportTicket(ticketId, { status: "resolved" }, admin.id);
		return { ok: true, ticket: updated };
	}

	if (name === "support.ticket.escalate") {
		const ticketId = toId(payload.ticket_id || payload.id);
		if (!ticketId) {
			const err = new Error("ticket_id is required");
			err.status = 400;
			throw err;
		}
		const updated = await adminUpdateSupportTicket(
			ticketId,
			{
				priority: "high",
				resolution_note: sanitizeString(String(payload.note || ""), 240),
			},
			admin.id,
		);
		return { ok: true, ticket: updated };
	}

	if (name === "account.manager.assign") {
		const userId = toId(payload.user_id);
		if (!userId) {
			const err = new Error("user_id is required");
			err.status = 400;
			throw err;
		}
		const user = await prisma.user.findUnique({
			where: { id: String(userId) },
		});
		if (!user) {
			const err = new Error("User not found");
			err.status = 404;
			throw err;
		}
		const profile = {
			...(user.profile || {}),
			account_manager_id: sanitizeString(String(payload.account_manager_id || ""), 120) || null,
			account_manager_name: sanitizeString(String(payload.account_manager_name || ""), 120),
			account_manager_email: sanitizeString(String(payload.account_manager_email || ""), 160),
			account_manager_phone: sanitizeString(String(payload.account_manager_phone || ""), 60),
		};
		await prisma.user.update({
			where: { id: String(userId) },
			data: { profile },
		});
		return { ok: true, user_id: userId, profile };
	}

	if (name === "order.certification.approve") {
		const userId = toId(payload.user_id);
		if (!userId) {
			const err = new Error("user_id is required");
			err.status = 400;
			throw err;
		}
		await ensureUserExists(userId);
		const evidence = parseCsvList(payload.evidence_contract_ids || payload.evidence_ids);
		const record = await approveOrderCertification(userId, {
			issuedBy: admin.id,
			evidenceContractIds: evidence,
			note: payload.note,
		});
		return { ok: true, record };
	}

	if (name === "order.certification.revoke") {
		const userId = toId(payload.user_id);
		if (!userId) {
			const err = new Error("user_id is required");
			err.status = 400;
			throw err;
		}
		await ensureUserExists(userId);
		const record = await revokeOrderCertification(userId, {
			issuedBy: admin.id,
			note: payload.note,
		});
		return { ok: true, record };
	}

	if (name === "order.certification.evidence") {
		const userId = toId(payload.user_id);
		if (!userId) {
			const err = new Error("user_id is required");
			err.status = 400;
			throw err;
		}
		await ensureUserExists(userId);
		const evidence = parseCsvList(payload.evidence_contract_ids || payload.evidence_ids);
		if (evidence.length === 0) {
			const err = new Error("evidence_contract_ids are required");
			err.status = 400;
			throw err;
		}
		const record = await addOrderCertificationEvidence(userId, evidence, {
			issuedBy: admin.id,
			note: payload.note,
		});
		return { ok: true, record };
	}

	if (name === "notification.broadcast") {
		const roles = parseCsvList(payload.roles || payload.role);
		const premiumOnly = toBool(payload.premium_only);
		const verifiedOnly = toBool(payload.verified_only);
		const result = await broadcastNotification({
			actor: admin,
			title: payload.title,
			message: payload.message,
			roles,
			premiumOnly,
			verifiedOnly,
		});
		return { ok: true, ...result };
	}

	if (name === "notification.template.create") {
		const entry = await appendLocalRecord("notification_templates.json", {
			name: sanitizeString(String(payload.name || "Template"), 120),
			subject: sanitizeString(String(payload.subject || ""), 160),
			body: sanitizeString(String(payload.body || ""), 1000),
			channel: sanitizeString(String(payload.channel || "email"), 40),
			created_by: admin.id,
		});
		return { ok: true, template: entry };
	}

	if (name === "notification.template.update") {
		const templateId = toId(payload.template_id || payload.id);
		if (!templateId) {
			const err = new Error("template_id is required");
			err.status = 400;
			throw err;
		}
		const updated = await updateLocalRecord("notification_templates.json", templateId, {
			name: payload.name,
			subject: payload.subject,
			body: payload.body,
			channel: payload.channel,
		});
		return { ok: true, template: updated };
	}

	if (name === "notification.batch.send") {
		const entry = await appendLocalRecord("notification_batches.json", {
			template_id: toId(payload.template_id),
			status: sanitizeString(String(payload.status || "queued"), 40),
			recipients: toNumber(payload.recipients, 0),
			scheduled_at: sanitizeString(String(payload.scheduled_at || ""), 40),
			created_by: admin.id,
		});
		const templates = await readLocalJson("notification_templates.json", []);
		const template = templates.find((t) => String(t.id) === String(entry.template_id));
		const users = await listUsers();
		const userIds = parseCsvList(payload.user_ids);
		const roles = parseCsvList(payload.roles);
		const premiumOnly = toBool(payload.premium_only);
		const verifiedOnly = toBool(payload.verified_only);
		const recipients = users.filter((u) => {
			if (userIds.length > 0 && !userIds.includes(String(u.id))) {
				return false;
			}
			if (roles.length > 0 && !roles.includes(String(u.role || "").toLowerCase())) {
				return false;
			}
			if (premiumOnly && String(u.subscription_status || "").toLowerCase() !== "premium") {
				return false;
			}
			if (verifiedOnly && !u.verified) {
				return false;
			}
			return true;
		});
		if (template && recipients.length > 0) {
			await Promise.all(
				recipients.map((user) =>
					createNotification(user.id, {
						type: "batch_notification",
						entity_type: "notification_batch",
						entity_id: entry.id,
						message: template.body || template.subject || "Announcement",
						meta: {
							template_id: template.id,
							channel: template.channel,
							subject: template.subject,
							batch_id: entry.id,
						},
					}),
				),
			);
		}
		return { ok: true, batch: entry };
	}

	if (name === "notification.monthly.trigger") {
		const entry = await appendLocalRecord("monthly_summary_triggers.json", {
			name: sanitizeString(String(payload.name || "Monthly summary"), 120),
			schedule: sanitizeString(String(payload.schedule || "0 9 1 * *"), 40),
			enabled: payload.enabled === undefined ? true : toBool(payload.enabled),
			created_by: admin.id,
		});
		return { ok: true, trigger: entry };
	}

	if (name === "ai.knowledge.create") {
		const orgId = sanitizeString(String(payload.org_id || "public"), 120);
		const keywords = Array.isArray(payload.keywords)
			? payload.keywords
			: parseCsvList(payload.keywords);
		const entry = await createKnowledgeEntry(orgId, { ...payload, keywords });
		return { ok: true, entry };
	}

	if (name === "ai.knowledge.update") {
		const orgId = sanitizeString(String(payload.org_id || "public"), 120);
		const entryId = toId(payload.entry_id);
		if (!entryId) {
			const err = new Error("entry_id is required");
			err.status = 400;
			throw err;
		}
		const keywords = Array.isArray(payload.keywords)
			? payload.keywords
			: parseCsvList(payload.keywords);
		const entry = await updateKnowledgeEntry(orgId, entryId, {
			...payload,
			keywords,
		});
		return { ok: true, entry };
	}

	if (name === "ai.knowledge.delete") {
		const orgId = sanitizeString(String(payload.org_id || "public"), 120);
		const entryId = toId(payload.entry_id);
		if (!entryId) {
			const err = new Error("entry_id is required");
			err.status = 400;
			throw err;
		}
		const deleted = await deleteKnowledgeEntry(orgId, entryId);
		return { ok: true, deleted };
	}

	if (name === "ai.response.flag") {
		const entry = await appendLocalRecord("ai_response_audit.json", {
			response_id: toId(payload.response_id),
			reason: sanitizeString(String(payload.reason || "flagged"), 200),
			actor_id: admin.id,
			created_at: new Date().toISOString(),
		});
		return { ok: true, audit: entry };
	}

	if (name === "system.feature_flag") {
		const key = sanitizeString(String(payload.key || ""), 80);
		if (!key) {
			const err = new Error("key is required");
			err.status = 400;
			throw err;
		}
		const value = toBool(payload.value);
		const config = await updateAdminConfig({ feature_flags: { [key]: value } });
		return { ok: true, config };
	}

	if (name === "system.plan_limit") {
		const plan = sanitizeString(String(payload.plan || ""), 20).toLowerCase();
		const limitKey = sanitizeString(String(payload.key || ""), 80);
		const value = toNumber(payload.value);
		if (!(plan && limitKey)) {
			const err = new Error("plan and key are required");
			err.status = 400;
			throw err;
		}
		const config = await updateAdminConfig({
			plan_limits: { [plan]: { [limitKey]: value } },
		});
		return { ok: true, config };
	}

	if (name === "system.pricing") {
		const plan = sanitizeString(String(payload.plan || ""), 20).toLowerCase();
		const value = toNumber(payload.usd);
		if (!plan) {
			const err = new Error("plan is required");
			err.status = 400;
			throw err;
		}
		const key = plan === "premium" ? "premium_usd" : "free_usd";
		const config = await updateAdminConfig({ pricing: { [key]: value } });
		return { ok: true, config };
	}

	if (name === "system.policy") {
		const key = sanitizeString(String(payload.key || ""), 40);
		const value = sanitizeString(String(payload.value || ""), 2000);
		if (!(key && value)) {
			const err = new Error("key and value are required");
			err.status = 400;
			throw err;
		}
		const config = await updateAdminConfig({ policies: { [key]: value } });
		return { ok: true, config };
	}

	if (name === "system.retention") {
		const auditDays =
			payload.audit_days === undefined
				? undefined
				: Math.max(1, Math.floor(toNumber(payload.audit_days)));
		const logsDays =
			payload.logs_days === undefined
				? undefined
				: Math.max(1, Math.floor(toNumber(payload.logs_days)));
		const patch = {};
		if (auditDays !== undefined) {
			patch.audit_days = auditDays;
		}
		if (logsDays !== undefined) {
			patch.logs_days = logsDays;
		}
		if (Object.keys(patch).length === 0) {
			const err = new Error("audit_days or logs_days are required");
			err.status = 400;
			throw err;
		}
		const config = await updateAdminConfig({ retention: patch });
		return { ok: true, config };
	}

	if (name === "system.search_limits") {
		const patch = {};
		if (payload.advanced_filter_gate !== undefined) {
			patch.advanced_filter_gate = toBool(payload.advanced_filter_gate);
		}
		if (payload.abusive_search_threshold !== undefined) {
			patch.abusive_search_threshold = Math.max(0, toNumber(payload.abusive_search_threshold));
		}
		if (Object.keys(patch).length === 0) {
			const err = new Error("No search limit fields provided");
			err.status = 400;
			throw err;
		}
		const config = await updateAdminConfig({ search_limits: patch });
		return { ok: true, config };
	}

	if (name === "email.test_send") {
		const config = await getAdminConfig();
		const emailConfig = config?.notifications?.email || {};
		const recipient = sanitizeString(
			String(
				payload.to ||
					payload.recipient ||
					emailConfig.test_recipient ||
					process.env.ADMIN_TEST_EMAIL ||
					"",
			),
			160,
		);
		if (!recipient) {
			const err = new Error("Recipient email is required");
			err.status = 400;
			throw err;
		}
		const subject = sanitizeString(String(payload.subject || "GarTexHub test email"), 200);
		const body = sanitizeString(
			String(payload.message || "This is a test email from GarTexHub."),
			2000,
		);
		const result = await sendEmail({ to: recipient, subject, text: body });
		return { ok: true, result };
	}

	if (name === "integrations.update") {
		const integrations = parseJson(payload.integrations || payload.payload);
		if (!integrations || typeof integrations !== "object") {
			const err = new Error("integrations JSON is required");
			err.status = 400;
			throw err;
		}
		const config = await updateAdminConfig({ integrations });
		return { ok: true, config };
	}

	if (name === "integrations.crm.export") {
		const config = await getAdminConfig();
		const exportsList = Array.isArray(config.integrations?.crm_exports)
			? config.integrations.crm_exports
			: [];
		const entry = {
			id: crypto.randomUUID(),
			status: "queued",
			requested_at: new Date().toISOString(),
			note: sanitizeString(String(payload.note || ""), 200),
		};
		const next = [...exportsList, entry];
		const updated = await updateAdminConfig({
			integrations: { crm_exports: next },
		});
		return { ok: true, export: entry, config: updated };
	}

	if (name === "integrations.webhook.test") {
		const config = await getAdminConfig();
		const hooks = Array.isArray(config.integrations?.webhooks) ? config.integrations.webhooks : [];
		const results = [];
		if (typeof fetch === "function") {
			for (const hook of hooks) {
				try {
					const res = await fetch(hook.url || hook.endpoint || hook.target || "", {
						method: "POST",
						headers: { "content-type": "application/json" },
						body: JSON.stringify({
							event: "admin_webhook_test",
							at: new Date().toISOString(),
						}),
					});
					results.push({
						id: hook.id || hook.url,
						status: res.ok ? "sent" : "failed",
						code: res.status,
					});
				} catch (error) {
					results.push({
						id: hook.id || hook.url,
						status: "failed",
						error: String(error?.message || "error"),
					});
				}
			}
		}
		return { ok: true, results };
	}

	if (name === "traffic.record") {
		const domain = sanitizeString(String(payload.domain || "site"), 120);
		const clicks = toNumber(payload.clicks, 0);
		const visits = toNumber(payload.visits, 0);
		const spend = toNumber(payload.spend, 0);
		await updateLocalJson(
			"traffic_analytics.json",
			(
				current = {
					summary: { clicks: 0, visits: 0, spend: 0 },
					sources: [],
					domains: [],
				},
			) => {
				const summary = { ...(current.summary || {}) };
				summary.clicks = (summary.clicks || 0) + clicks;
				summary.visits = (summary.visits || 0) + visits;
				summary.spend = (summary.spend || 0) + spend;
				const domains = Array.isArray(current.domains) ? current.domains : [];
				const existing = domains.find((d) => String(d.domain) === domain);
				if (existing) {
					existing.clicks = (existing.clicks || 0) + clicks;
					existing.visits = (existing.visits || 0) + visits;
					existing.spend = (existing.spend || 0) + spend;
				} else {
					domains.push({ domain, clicks, visits, spend });
				}
				return { ...current, summary, domains };
			},
			{ summary: { clicks: 0, visits: 0, spend: 0 }, sources: [], domains: [] },
		);
		return { ok: true };
	}

	if (name === "email.segment.create") {
		const filter = parseJson(payload.filter) || payload.filter || {};
		const entry = await appendLocalRecord("email_segments.json", {
			name: sanitizeString(String(payload.name || "Segment"), 120),
			filter,
			created_by: admin.id,
		});
		return { ok: true, segment: entry };
	}

	if (name === "email.segment.update") {
		const segmentId = toId(payload.segment_id || payload.id);
		if (!segmentId) {
			const err = new Error("segment_id is required");
			err.status = 400;
			throw err;
		}
		const filter = parseJson(payload.filter) || payload.filter;
		const updated = await updateLocalRecord("email_segments.json", segmentId, {
			name: payload.name,
			filter,
			updated_by: admin.id,
		});
		return { ok: true, segment: updated };
	}

	if (name === "email.segment.delete") {
		const segmentId = toId(payload.segment_id || payload.id);
		if (!segmentId) {
			const err = new Error("segment_id is required");
			err.status = 400;
			throw err;
		}
		await removeLocalRecord("email_segments.json", segmentId);
		return { ok: true };
	}

	if (name === "featured.add") {
		const entityType = sanitizeString(String(payload.entity_type || "product"), 40);
		const entityId = toId(payload.entity_id || payload.id);
		if (!entityId) {
			const err = new Error("entity_id is required");
			err.status = 400;
			throw err;
		}
		const entry = await appendLocalRecord("featured_listings.json", {
			entity_type: entityType,
			entity_id: entityId,
			label: sanitizeString(String(payload.label || ""), 120),
			created_by: admin.id,
		});
		return { ok: true, featured: entry };
	}

	if (name === "featured.remove") {
		const listingId = toId(payload.listing_id || payload.id);
		const entityId = toId(payload.entity_id || "");
		if (!(listingId || entityId)) {
			const err = new Error("listing_id or entity_id is required");
			err.status = 400;
			throw err;
		}
		if (listingId) {
			await removeLocalRecord("featured_listings.json", listingId);
			return { ok: true, removed: listingId };
		}
		await updateLocalJson(
			"featured_listings.json",
			(rows = []) =>
				Array.isArray(rows) ? rows.filter((row) => String(row.entity_id) !== entityId) : rows,
			[],
		);
		return { ok: true, removed_entity_id: entityId };
	}

	const err = new Error(`Unknown admin action: ${name}`);
	err.status = 400;
	throw err;
}
