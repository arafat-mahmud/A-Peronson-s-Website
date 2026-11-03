import crypto from "node:crypto";
import prisma from "../utils/prisma.js";
import { sanitizeString } from "../utils/validators.js";
import { createNotification } from "./notificationService.js";
import { adminUpdateUser } from "./userService.js";

const JOIN_NOTIFICATION_TYPE = "join_request";
const JOIN_REMINDER_TYPE = "join_request_reminder";

function parseMeta(notification) {
	return notification?.meta && typeof notification.meta === "object" ? notification.meta : {};
}

function isOwnerOrAdminForCompany(user, companyOwnerId) {
	const role = String(user?.role || "").toLowerCase();
	if (["owner", "admin"].includes(role)) {
		return true;
	}
	return String(user?.id || "") === String(companyOwnerId || "");
}

export async function createJoinRequest({
	applicantUser,
	companyUser,
	sourceVerificationId = "",
	position = "",
	message = "",
}) {
	if (!(applicantUser?.id && companyUser?.id)) {
		const err = new Error("Applicant and company are required");
		err.status = 400;
		throw err;
	}

	const ownerIds = new Set([String(companyUser.id)]);
	const orgMembers = await prisma.user.findMany({
		where: {
			OR: [{ id: companyUser.id }, { org_owner_id: companyUser.id }],
			role: { in: ["owner", "admin", "agent", "factory", "buying_house"] },
		},
	});
	orgMembers.forEach((row) => ownerIds.add(String(row.id)));

	const existing = await prisma.notification.findFirst({
		where: {
			type: JOIN_NOTIFICATION_TYPE,
			entity_id: String(companyUser.id),
			meta: {
				path: ["applicant_id"],
				equals: String(applicantUser.id),
			},
		},
	});
	if (existing) {
		return existing;
	}

	const requestId = crypto.randomUUID();
	const payload = {
		id: requestId,
		kind: JOIN_NOTIFICATION_TYPE,
		status: "pending",
		request_id: requestId,
		applicant_id: String(applicantUser.id),
		applicant_name: sanitizeString(String(applicantUser.name || ""), 120),
		applicant_email: sanitizeString(String(applicantUser.email || ""), 160),
		position: sanitizeString(String(position || applicantUser?.profile?.position || ""), 80),
		message: sanitizeString(String(message || ""), 240),
		company_owner_id: String(companyUser.id),
		company_name: sanitizeString(
			String(companyUser?.name || companyUser?.profile?.organization_name || ""),
			160,
		),
		company_logo: String(
			companyUser?.profile?.brand_logo_url ||
				companyUser?.profile?.avatar_url ||
				companyUser?.avatar_url ||
				"",
		),
		company_banner: String(companyUser?.profile?.brand_cover_url || ""),
		source_verification_id: String(sourceVerificationId || ""),
		created_at: new Date().toISOString(),
	};

	const created = [];
	const recipientList = [...ownerIds];
	for (let index = 0; index < recipientList.length; index += 1) {
		const recipientId = recipientList[index];
		const note = await createNotification(recipientId, {
			type: JOIN_NOTIFICATION_TYPE,
			entity_type: "join_request",
			entity_id: String(companyUser.id),
			message: `${applicantUser.name || "An applicant"} requested to join ${payload.company_name || "the company"}.`,
			id: index === 0 ? requestId : undefined,
			meta: payload,
		});
		created.push(note);
	}

	return created[0] || null;
}

export async function getJoinRequestById(notificationId) {
	const row = await prisma.notification.findUnique({ where: { id: notificationId } });
	if (!row) {
		return null;
	}
	return row;
}

export async function getJoinRequestSnapshot(notificationId, user) {
	const row = await getJoinRequestById(notificationId);
	if (!row) {
		return null;
	}
	const meta = parseMeta(row);
	if (
		!isOwnerOrAdminForCompany(user, meta.company_owner_id) &&
		String(meta.applicant_id || "") !== String(user?.id || "")
	) {
		const err = new Error("Forbidden");
		err.status = 403;
		throw err;
	}
	return {
		...row,
		meta,
	};
}

export async function listPendingJoinRequestsForUser(user) {
	const rows = await prisma.notification.findMany({
		where: { type: JOIN_NOTIFICATION_TYPE },
		orderBy: { created_at: "desc" },
	});
	return rows.filter((row) => {
		const meta = parseMeta(row);
		return (
			meta?.status === "pending" &&
			(isOwnerOrAdminForCompany(user, meta.company_owner_id) ||
				String(meta.applicant_id || "") === String(user?.id || ""))
		);
	});
}

export async function respondToJoinRequest({ notificationId, user, action, reason = "" }) {
	const normalizedAction = String(action || "").toLowerCase();
	if (!["accept", "reject"].includes(normalizedAction)) {
		const err = new Error("Invalid action");
		err.status = 400;
		throw err;
	}
	const row = await getJoinRequestById(notificationId);
	if (!row) {
		const err = new Error("Join request not found");
		err.status = 404;
		throw err;
	}
	const meta = parseMeta(row);
	if (meta.status && meta.status !== "pending") {
		const err = new Error("Join request already handled");
		err.status = 400;
		throw err;
	}

	if (!isOwnerOrAdminForCompany(user, meta.company_owner_id)) {
		const err = new Error("Forbidden");
		err.status = 403;
		throw err;
	}

	const requestKey = String(meta.request_id || row.id);
	const nextMeta = {
		...meta,
		status: normalizedAction === "accept" ? "approved" : "rejected",
		reason: normalizedAction === "reject" ? sanitizeString(reason || "", 240) : "",
		acted_at: new Date().toISOString(),
		acted_by: String(user.id || ""),
	};

	const relatedRows = await prisma.notification.findMany({
		where: {
			type: JOIN_NOTIFICATION_TYPE,
			meta: {
				path: ["request_id"],
				equals: requestKey,
			},
		},
	});

	await Promise.all(
		relatedRows.map((item) =>
			prisma.notification.update({
				where: { id: item.id },
				data: { meta: nextMeta, read: true },
			}),
		),
	);

	if (normalizedAction === "accept") {
		await adminUpdateUser(meta.applicant_id, {
			role: "agent",
			org_owner_id: meta.company_owner_id,
			verified: true,
		});
		await createNotification(meta.applicant_id, {
			type: "join_request_approved",
			entity_type: "join_request",
			entity_id: row.id,
			message: `${meta.company_name || "Your company"} accepted your request to join.`,
			meta: nextMeta,
		});
	} else {
		const rejectionReasonRaw = String(reason || "").trim();
		if (!rejectionReasonRaw) {
			const err = new Error("Rejection reason is required");
			err.status = 400;
			throw err;
		}
		const rejectionReason = sanitizeString(rejectionReasonRaw, 240);
		await createNotification(meta.applicant_id, {
			type: "join_request_rejected",
			entity_type: "join_request",
			entity_id: row.id,
			message: `Your request to join ${meta.company_name || "the company"} was rejected. Reason: ${rejectionReason}`,
			meta: { ...nextMeta, reason: rejectionReason },
		});
	}

	return { ...row, meta: nextMeta };
}

export async function runJoinRequestReminderSweep() {
	const pending = await prisma.notification.findMany({
		where: { type: JOIN_NOTIFICATION_TYPE },
		orderBy: { created_at: "asc" },
	});
	const now = Date.now();
	const reminderWindowMs = 24 * 60 * 60 * 1000;
	let processed = 0;

	for (const row of pending) {
		const meta = parseMeta(row);
		if (meta.status !== "pending" || meta.reminder_sent_at) {
			continue;
		}
		const createdAt = new Date(meta.created_at || row.created_at || 0).getTime();
		if (!Number.isFinite(createdAt) || now - createdAt < reminderWindowMs) {
			continue;
		}

		await createNotification(meta.company_owner_id, {
			type: JOIN_REMINDER_TYPE,
			entity_type: "join_request",
			entity_id: row.id,
			message: `Reminder: you still have a pending join request from ${meta.applicant_name || "an applicant"}.`,
			meta: {
				request_id: row.id,
				applicant_id: meta.applicant_id,
				company_owner_id: meta.company_owner_id,
			},
		});
		await prisma.notification.update({
			where: { id: row.id },
			data: {
				meta: {
					...meta,
					reminder_sent_at: new Date().toISOString(),
				},
			},
		});
		processed += 1;
	}

	return { ok: true, processed };
}

const DUPLICATE_DISPUTE_TYPE = "duplicate_dispute";

export async function disputeDuplicateFlag({
	applicantUser,
	companyUserId,
	sourceVerificationId = "",
	applicantName = "",
	applicantEmail = "",
}) {
	if (!(applicantUser?.id && companyUserId)) {
		const err = new Error("Applicant and company are required");
		err.status = 400;
		throw err;
	}

	const existing = await prisma.notification.findFirst({
		where: {
			type: DUPLICATE_DISPUTE_TYPE,
			entity_id: String(companyUserId),
			meta: {
				path: ["applicant_id"],
				equals: String(applicantUser.id),
			},
		},
	});
	if (existing) {
		return existing;
	}

	const disputeId = crypto.randomUUID();
	const payload = {
		id: disputeId,
		kind: DUPLICATE_DISPUTE_TYPE,
		status: "pending_review",
		dispute_id: disputeId,
		applicant_id: String(applicantUser.id),
		applicant_name: sanitizeString(String(applicantName || applicantUser.name || ""), 120),
		applicant_email: sanitizeString(String(applicantEmail || applicantUser.email || ""), 160),
		company_user_id: String(companyUserId),
		source_verification_id: String(sourceVerificationId || ""),
		created_at: new Date().toISOString(),
	};

	const created = await createNotification("admin", {
		type: DUPLICATE_DISPUTE_TYPE,
		entity_type: "duplicate_dispute",
		entity_id: String(companyUserId),
		message: `${payload.applicant_name || "A user"} disputes a duplicate flag with company ${companyUserId}.`,
		meta: payload,
	});

	return created;
}

export async function listDuplicateDisputes() {
	const rows = await prisma.notification.findMany({
		where: { type: DUPLICATE_DISPUTE_TYPE },
		orderBy: { created_at: "desc" },
	});
	return rows.filter((row) => {
		const meta = parseMeta(row);
		return meta.status === "pending_review";
	});
}

export async function resolveDuplicateDispute({ notificationId, user, action, reason = "" }) {
	const normalizedAction = String(action || "").toLowerCase();
	if (!["approve_applicant", "confirm_duplicate"].includes(normalizedAction)) {
		const err = new Error("Invalid action");
		err.status = 400;
		throw err;
	}

	const row = await prisma.notification.findUnique({ where: { id: notificationId } });
	if (!row) {
		const err = new Error("Dispute not found");
		err.status = 404;
		throw err;
	}
	const meta = parseMeta(row);
	if (meta.status !== "pending_review") {
		const err = new Error("Dispute already resolved");
		err.status = 400;
		throw err;
	}

	const nextStatus =
		normalizedAction === "approve_applicant" ? "resolved_clear" : "resolved_confirmed";
	const nextMeta = {
		...meta,
		status: nextStatus,
		resolution_reason: sanitizeString(String(reason || ""), 240),
		acted_at: new Date().toISOString(),
		acted_by: String(user?.id || ""),
	};

	await prisma.notification.update({
		where: { id: notificationId },
		data: { meta: nextMeta, read: true },
	});

	await createNotification(meta.applicant_id, {
		type: "duplicate_dispute_resolved",
		entity_type: "duplicate_dispute",
		entity_id: notificationId,
		message:
			normalizedAction === "approve_applicant"
				? "Your duplicate dispute was resolved in your favor. You may proceed with verification."
				: `Your duplicate dispute was reviewed. The duplicate flag was confirmed. Reason: ${reason || "Confirmed by admin"}`,
		meta: nextMeta,
	});

	return { ...row, meta: nextMeta };
}
