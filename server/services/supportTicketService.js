import crypto from "node:crypto";
import prisma from "../utils/prisma.js";
import { sanitizeString } from "../utils/validators.js";
import { getAdminConfig } from "./adminConfigService.js";
import { sendEmail } from "./emailService.js";
import { createNotification } from "./notificationService.js";

function publicUser(user) {
	if (!user) {
		return null;
	}
	return {
		id: user.id,
		name: user.name || "",
		email: user.email || "",
		role: user.role || "",
	};
}

async function getSlaTargets() {
	const config = await getAdminConfig();
	const responseMinutes = Number(config?.support?.sla_targets?.response_minutes || 60);
	const resolutionHours = Number(config?.support?.sla_targets?.resolution_hours || 72);
	return {
		response_minutes: Math.max(15, responseMinutes),
		resolution_hours: Math.max(1, resolutionHours),
	};
}

function normalizePriority(priority, premium) {
	const raw = sanitizeString(String(priority || ""), 40).toLowerCase();
	if (premium && ["high", "urgent", "priority"].includes(raw)) {
		return "priority";
	}
	if (["high", "urgent", "priority"].includes(raw)) {
		return "high";
	}
	if (["low", "medium", "normal"].includes(raw)) {
		return raw;
	}
	return "standard";
}

export async function createSupportTicket({
	actor,
	subject,
	description,
	category,
	_pageUrl,
	_contactEmail,
	priority,
}) {
	const premium = String(actor?.subscription_status || "").toLowerCase() === "premium";
	const _sla = await getSlaTargets();
	const now = new Date();
	const ticketId = crypto.randomUUID();
	const assignedTo = sanitizeString(String(actor?.profile?.account_manager_id || ""), 120);

	const [ticket, initialMessage] = await prisma.$transaction(async (tx) => {
		const t = await tx.supportTicket.create({
			data: {
				id: ticketId,
				user_id: sanitizeString(String(actor?.id || ""), 120),
				subject: sanitizeString(String(subject || "Support ticket"), 160),
				category: sanitizeString(String(category || "General"), 80),
				description: sanitizeString(String(description || ""), 1200),
				status: "open",
				priority: normalizePriority(priority, premium),
				assigned_to: assignedTo || null,
				created_at: now,
				updated_at: now,
			},
		});

		const msg = await tx.supportTicketMessage.create({
			data: {
				id: crypto.randomUUID(),
				ticket_id: ticketId,
				sender_id: sanitizeString(String(actor?.id || ""), 120),
				message: sanitizeString(String(description || ""), 1200),
				created_at: now,
			},
		});

		return [t, msg];
	});

	try {
		const admins = await prisma.user.findMany({
			where: { role: { in: ["owner", "admin"] } },
		});

		const ticketSummary = [
			`New support ticket: ${ticket.subject}`,
			`Category: ${ticket.category}`,
			`Priority: ${ticket.priority}`,
			`Status: ${ticket.status}`,
			`User: ${actor?.name || actor?.email || "Unknown"}`,
			description ? `\nDescription:\n${description}` : "",
		]
			.filter(Boolean)
			.join("\n");

		await Promise.all(
			admins.map((admin) =>
				createNotification(admin.id, {
					type: "support_ticket_created",
					entity_type: "support_ticket",
					entity_id: ticketId,
					message: `New support ticket: ${ticket.subject}`,
					meta: {
						ticket_id: ticketId,
						subject: ticket.subject,
						category: ticket.category,
						priority: ticket.priority,
						user_id: actor?.id || "",
						user_name: actor?.name || "",
					},
				}).catch(() => {}),
			),
		);

		const adminEmails = admins.map((a) => a.email).filter(Boolean);
		if (adminEmails.length > 0) {
			await sendEmail({
				to: adminEmails.join(","),
				subject: `[GarTexHub Support] New ticket: ${ticket.subject}`,
				text: ticketSummary,
				source: "support_ticket_create",
			}).catch(() => {});
		}
	} catch {
		// Non-blocking: ticket was created successfully, notification failure is secondary
	}

	return { ticket, initial_message: initialMessage };
}

export async function listSupportTicketsForUser(userId) {
	return prisma.supportTicket.findMany({
		where: { user_id: String(userId) },
		orderBy: { updated_at: "desc" },
	});
}

export async function listSupportTicketsAdmin({
	status,
	priority,
	assignedTo,
	_premiumOnly,
	limit = 50,
	offset = 0,
} = {}) {
	const where = {};
	if (status) {
		where.status = sanitizeString(String(status), 40).toLowerCase();
	}
	if (priority) {
		where.priority = sanitizeString(String(priority), 40).toLowerCase();
	}
	if (assignedTo) {
		where.assigned_to = sanitizeString(String(assignedTo), 120);
	}

	const start = Math.max(0, Number(offset) || 0);
	const max = Math.min(200, Math.max(1, Number(limit) || 50));

	return prisma.supportTicket.findMany({
		where,
		orderBy: { updated_at: "desc" },
		skip: start,
		take: max,
	});
}

export async function listSupportTicketMessages(ticketId) {
	return prisma.supportTicketMessage.findMany({
		where: { ticket_id: String(ticketId) },
		orderBy: { created_at: "asc" },
	});
}

export async function getSupportTicketById(ticketId) {
	return prisma.supportTicket.findUnique({ where: { id: String(ticketId) } });
}

export async function appendSupportTicketMessage(ticketId, actor, message) {
	const ticket = await prisma.supportTicket.findUnique({
		where: { id: String(ticketId) },
	});
	if (!ticket) {
		return null;
	}
	if (String(ticket.user_id) !== String(actor?.id || "")) {
		return "forbidden";
	}

	const [entry] = await prisma.$transaction(async (tx) => {
		const msg = await tx.supportTicketMessage.create({
			data: {
				id: crypto.randomUUID(),
				ticket_id: String(ticketId),
				sender_id: sanitizeString(String(actor?.id || ""), 120),
				message: sanitizeString(String(message || ""), 1200),
				created_at: new Date(),
			},
		});

		const nextStatus = ticket.status === "resolved" ? "open" : ticket.status;
		await tx.supportTicket.update({
			where: { id: String(ticketId) },
			data: { updated_at: msg.created_at, status: nextStatus },
		});

		return [msg];
	});

	return entry;
}

export async function adminAssignSupportTicket(ticketId, assigneeId, _actorId) {
	const ticket = await prisma.supportTicket.findUnique({
		where: { id: String(ticketId) },
	});
	if (!ticket) {
		return null;
	}

	return prisma.supportTicket.update({
		where: { id: String(ticketId) },
		data: {
			assigned_to: sanitizeString(String(assigneeId || ""), 120) || null,
			updated_at: new Date(),
		},
	});
}

export async function adminUpdateSupportTicket(ticketId, patch = {}, _actorId = "") {
	const ticket = await prisma.supportTicket.findUnique({
		where: { id: String(ticketId) },
	});
	if (!ticket) {
		return null;
	}

	const nextStatus = patch.status
		? sanitizeString(String(patch.status || ""), 40).toLowerCase()
		: ticket.status;

	return prisma.supportTicket.update({
		where: { id: String(ticketId) },
		data: {
			status: nextStatus || ticket.status,
			...(patch.priority
				? { priority: sanitizeString(String(patch.priority), 40).toLowerCase() }
				: {}),
			...(nextStatus === "resolved" ? { resolved_at: new Date() } : {}),
			updated_at: new Date(),
		},
	});
}

export async function buildSupportTicketSummary(ticket) {
	if (!ticket) {
		return ticket;
	}
	const [user, assignee] = await Promise.all([
		ticket.user_id ? prisma.user.findUnique({ where: { id: String(ticket.user_id) } }) : null,
		ticket.assigned_to
			? prisma.user.findUnique({ where: { id: String(ticket.assigned_to) } })
			: null,
	]);
	return {
		...ticket,
		user: publicUser(user),
		assignee: publicUser(assignee),
	};
}
