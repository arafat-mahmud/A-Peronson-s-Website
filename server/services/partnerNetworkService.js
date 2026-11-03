import crypto from "node:crypto";
import {
	canManagePartnerNetwork,
	canRespondToPartnerRequest,
	canViewPartnerNetwork,
	isAgent,
	isOwnerOrAdmin,
	scopeRecordsForUser,
} from "../utils/permissions.js";
import prisma from "../utils/prisma.js";
import { getAdminConfig } from "./adminConfigService.js";
import { getPlanForUser } from "./entitlementService.js";
import { createNotification } from "./notificationService.js";
import { recordMilestone } from "./ratingsService.js";
import { findUserById, listUsers } from "./userService.js";

const ACTIVE_STATUSES = new Set(["pending", "connected"]);

async function isPremium(user) {
	const plan = await getPlanForUser(user);
	return plan === "premium";
}

function isAllowedPair(fromRole, toRole) {
	return (
		(fromRole === "factory" && toRole === "buying_house") ||
		(fromRole === "buying_house" && toRole === "factory")
	);
}

function mapWithCounterparty(request, me, usersById) {
	const counterpartyId = request.requester_id === me.id ? request.target_id : request.requester_id;
	const counterparty = usersById.get(counterpartyId);
	return {
		...request,
		direction: request.requester_id === me.id ? "outgoing" : "incoming",
		counterparty: counterparty
			? {
					id: counterparty.id,
					name: counterparty.name,
					role: counterparty.role,
					verified: Boolean(counterparty.verified),
				}
			: {
					id: counterpartyId,
					name: "Unknown account",
					role: "unknown",
					verified: false,
				},
	};
}

export async function getPartnerNetwork(user, { status } = {}) {
	if (!canViewPartnerNetwork(user)) {
		const err = new Error("Forbidden");
		err.status = 403;
		throw err;
	}

	const [requests, users] = await Promise.all([prisma.partnerRequest.findMany(), listUsers()]);
	const usersById = new Map(users.map((u) => [u.id, u]));

	const scoped = scopeRecordsForUser(user, requests, {
		idFields: ["requester_id", "target_id"],
		assignmentFields: ["assigned_agent_id", "agent_id"],
	});

	const filtered = status ? scoped.filter((r) => r.status === status) : scoped;
	const rows = filtered
		.map((r) => mapWithCounterparty(r, user, usersById))
		.sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
	const connectedFactories = rows
		.filter((r) => r.status === "connected" && r.counterparty?.role === "factory")
		.map((r) => r.counterparty);

	return {
		requests: rows,
		connected_factories: connectedFactories,
		permissions: {
			view_only: isAgent(user),
			can_manage: canManagePartnerNetwork(user),
		},
	};
}

export async function getIncomingPartnerRequests(user) {
	if (!canViewPartnerNetwork(user)) {
		const err = new Error("Forbidden");
		err.status = 403;
		throw err;
	}

	const [requests, users] = await Promise.all([prisma.partnerRequest.findMany(), listUsers()]);
	const usersById = new Map(users.map((u) => [u.id, u]));
	const incoming = requests
		.filter(
			(row) =>
				String(row.target_id || "") === String(user.id) && String(row.status || "") === "pending",
		)
		.map((row) => mapWithCounterparty(row, user, usersById))
		.sort((a, b) => String(b.updated_at || "").localeCompare(String(a.updated_at || "")));

	return { requests: incoming };
}

export async function sendPartnerRequest(user, targetAccountId) {
	if (!canManagePartnerNetwork(user)) {
		const err = new Error("Forbidden");
		err.status = 403;
		throw err;
	}

	const target = await findUserById(targetAccountId);
	if (!target) {
		const err = new Error("Target account not found");
		err.status = 404;
		throw err;
	}

	if (target.id === user.id) {
		const err = new Error("Cannot request your own account");
		err.status = 400;
		throw err;
	}

	if (!isAllowedPair(user.role, target.role)) {
		const err = new Error(
			"Partner requests only allowed between factory and buying house accounts",
		);
		err.status = 400;
		throw err;
	}

	const id = crypto.randomUUID();
	const config = await getAdminConfig();
	const freePartnerLimit = Number(config?.plan_limits?.free?.partner_limit || 5);
	const isPremiumUser = await isPremium(user);
	const now = new Date();

	const duplicate = await prisma.partnerRequest.findFirst({
		where: {
			OR: [
				{ requester_id: user.id, target_id: target.id },
				{ requester_id: target.id, target_id: user.id },
			],
			status: { in: ["pending", "connected"] },
		},
	});
	if (duplicate) {
		const err = new Error(
			"An active partner relationship/request already exists between these accounts",
		);
		err.status = 409;
		throw err;
	}

	if (user.role === "buying_house" && !isPremiumUser) {
		const outgoingCount = await prisma.partnerRequest.count({
			where: {
				requester_id: user.id,
				status: { in: [...ACTIVE_STATUSES] },
			},
		});
		if (outgoingCount >= freePartnerLimit) {
			const err = new Error(
				`Upgrade to premium to send more than ${freePartnerLimit} partner requests.`,
			);
			err.status = 403;
			throw err;
		}
	}

	const row = await prisma.partnerRequest.create({
		data: {
			id,
			requester_id: user.id,
			requester_role: user.role,
			target_id: target.id,
			target_role: target.role,
			status: "pending",
			created_at: now,
			updated_at: now,
		},
	});
	if (row) {
		// Notify the target factory so they can accept/reject from /notifications.
		await createNotification(target.id, {
			type: "partner_request",
			entity_type: "partner_request",
			entity_id: row.id,
			message: `New partner request from ${user.name}`,
			meta: {
				request_id: row.id,
				requester_id: user.id,
				requester_role: user.role,
			},
		});
	}

	return row;
}

export async function updatePartnerRequestStatus(user, requestId, action) {
	// Accept/reject is allowed for factories (targets) and owner/admin. Cancel is allowed for buying house requester and owner/admin.
	const isAdmin = isOwnerOrAdmin(user);
	const isFactory =
		canRespondToPartnerRequest(user) &&
		!isAdmin &&
		String(user?.role || "").toLowerCase() === "factory";
	const canCancel = isAdmin || String(user?.role || "").toLowerCase() === "buying_house";
	if (!(isAdmin || isFactory || canCancel)) {
		const err = new Error("Forbidden");
		err.status = 403;
		throw err;
	}

	if (!["accept", "reject", "cancel"].includes(action)) {
		const err = new Error("Invalid action");
		err.status = 400;
		throw err;
	}

	const config = await getAdminConfig();
	const freePartnerLimit = Number(config?.plan_limits?.free?.partner_limit || 5);
	const isPremiumUser = await isPremium(user);

	const nextStatus =
		action === "accept" ? "connected" : action === "reject" ? "rejected" : "cancelled";

	const current = await prisma.partnerRequest.findUnique({
		where: { id: requestId },
	});
	if (!current) {
		const err = new Error("Request not found");
		err.status = 404;
		throw err;
	}
	if (current.status !== "pending") {
		const err = new Error("Only pending requests can be updated");
		err.status = 400;
		throw err;
	}

	if (
		action === "accept" &&
		String(user.role || "").toLowerCase() === "factory" &&
		!isPremiumUser
	) {
		const existingConnections = await prisma.partnerRequest.count({
			where: { target_id: user.id, status: "connected" },
		});
		if (existingConnections >= freePartnerLimit) {
			const err = new Error(
				`Subscribe to premium to accept more than ${freePartnerLimit} partner requests.`,
			);
			err.status = 403;
			throw err;
		}
	}

	if (!isAdmin) {
		if (action === "cancel" && current.requester_id !== user.id) {
			const err = new Error("Only requester can cancel this request");
			err.status = 403;
			throw err;
		}
		if ((action === "accept" || action === "reject") && current.target_id !== user.id) {
			const err = new Error("Only target account can accept/reject this request");
			err.status = 403;
			throw err;
		}
	}

	const updatedRow = await prisma.partnerRequest.update({
		where: { id: requestId },
		data: { status: nextStatus, updated_at: new Date() },
	});

	if (updatedRow && nextStatus === "connected") {
		// Notify the requester that the factory accepted the connection.
		await createNotification(updatedRow.requester_id, {
			type: "partner_request",
			entity_type: "partner_request",
			entity_id: updatedRow.id,
			message: "Partner request accepted",
			meta: {
				request_id: updatedRow.id,
				target_id: updatedRow.target_id,
			},
		});
		await Promise.all([
			recordMilestone({
				profileKey: `user:${updatedRow.requester_id}`,
				counterpartyId: updatedRow.target_id,
				interactionType: "contract",
				milestone: "contract_signed",
				actorId: user.id,
			}),
			recordMilestone({
				profileKey: `user:${updatedRow.target_id}`,
				counterpartyId: updatedRow.requester_id,
				interactionType: "contract",
				milestone: "contract_signed",
				actorId: user.id,
			}),
		]);
	}

	return updatedRow;
}

export async function removePartnerConnection(user, connectionId) {
	if (!(canManagePartnerNetwork(user) || isOwnerOrAdmin(user))) {
		const err = new Error("Forbidden");
		err.status = 403;
		throw err;
	}

	const current = await prisma.partnerRequest.findUnique({
		where: { id: connectionId },
	});
	if (!current) {
		const err = new Error("Connection not found");
		err.status = 404;
		throw err;
	}
	if (String(current.status || "") !== "connected") {
		const err = new Error("Only connected rows can be removed");
		err.status = 400;
		throw err;
	}

	if (!isOwnerOrAdmin(user)) {
		const mine =
			String(current.requester_id || "") === String(user.id) ||
			String(current.target_id || "") === String(user.id);
		if (!mine) {
			const err = new Error("You can only remove your own partner connections");
			err.status = 403;
			throw err;
		}
	}

	return prisma.partnerRequest.update({
		where: { id: connectionId },
		data: {
			status: "cancelled",
			updated_at: new Date(),
		},
	});
}

export async function enforcePartnerFreeTierLimits() {
	const [requests, users, config] = await Promise.all([
		prisma.partnerRequest.findMany(),
		listUsers(),
		getAdminConfig(),
	]);
	const rows = Array.isArray(requests) ? requests : [];
	const usersById = new Map(users.map((u) => [String(u.id), u]));
	const freePartnerLimit = Number(config?.plan_limits?.free?.partner_limit || 5);

	const activeByUser = rows.reduce((acc, row) => {
		if (row.status !== "connected") {
			return acc;
		}
		const requester = String(row.requester_id);
		const target = String(row.target_id);
		acc[requester] = acc[requester] || [];
		acc[target] = acc[target] || [];
		acc[requester].push(row);
		acc[target].push(row);
		return acc;
	}, {});

	let updated = false;
	const now = new Date();
	const updates = [];

	for (const row of rows) {
		if (row.status !== "connected") {
			continue;
		}
		const requester = usersById.get(String(row.requester_id));
		const target = usersById.get(String(row.target_id));
		const requesterFree = requester && !(await isPremium(requester));
		const targetFree = target && !(await isPremium(target));
		const requesterActive = activeByUser[String(row.requester_id)] || [];
		const targetActive = activeByUser[String(row.target_id)] || [];
		const requesterOver = requesterFree && requesterActive.length > freePartnerLimit;
		const targetOver = targetFree && targetActive.length > freePartnerLimit;
		if (requesterOver || targetOver) {
			updated = true;
			updates.push(
				prisma.partnerRequest.update({
					where: { id: row.id },
					data: {
						limit_exceeded: true,
						enforced_at: now,
					},
				}),
			);
		}
	}

	if (updates.length > 0) {
		await prisma.$transaction(updates);
	}

	return { updated, limit: freePartnerLimit };
}
