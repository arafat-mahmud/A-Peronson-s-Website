import { isPremiumUser } from "../services/entitlementService.js";
import { createReport } from "../services/reportService.js";
import {
	appendSupportTicketMessage,
	buildSupportTicketSummary,
	createSupportTicket,
	getSupportTicketById,
	listSupportTicketMessages,
	listSupportTicketsForUser,
} from "../services/supportTicketService.js";
import { sanitizeString } from "../utils/validators.js";

export async function getSupportCategories(req, res) {
	return res.json({
		categories: [
			"Bug Report",
			"Feature Request",
			"Account Problem",
			"Payment / Verification Issue",
			"Report a User",
			"Content Report",
			"General Feedback",
			"Other",
		],
		priorities: ["Low", "Medium", "High", "Urgent"],
	});
}

export async function createSupportReport(req, res) {
	const subject = sanitizeString(String(req.body?.subject || ""), 140);
	const description = sanitizeString(String(req.body?.description || ""), 1200);
	if (!(subject && description)) {
		return res.status(400).json({ error: "Subject and description are required" });
	}

	const premium = await isPremiumUser(req.user);
	const requestedPriority = sanitizeString(String(req.body?.priority || ""), 40).toLowerCase();
	const priority =
		premium && ["high", "urgent", "priority"].includes(requestedPriority) ? "priority" : "standard";

	const metadata = {
		category: sanitizeString(String(req.body?.category || ""), 80),
		page_url: sanitizeString(String(req.body?.page_url || ""), 240),
		priority,
		contact_email: sanitizeString(String(req.body?.contact_email || ""), 120),
		premium_support: premium,
	};

	const report = await createReport({
		actor: req.user,
		entity_type: "support",
		entity_id: `support:${req.user?.id || "anonymous"}`,
		reason: subject,
		metadata: { ...metadata, description },
	});

	return res.status(201).json(report);
}

export async function createSupportTicketController(req, res) {
	const subject = sanitizeString(String(req.body?.subject || ""), 140);
	const description = sanitizeString(String(req.body?.description || ""), 1200);
	if (!(subject && description)) {
		return res.status(400).json({ error: "Subject and description are required" });
	}

	const premium = await isPremiumUser(req.user);
	const requestedPriority = sanitizeString(String(req.body?.priority || ""), 40).toLowerCase();
	const priority =
		premium && ["high", "urgent", "priority"].includes(requestedPriority) ? "priority" : "standard";

	const ticketResult = await createSupportTicket({
		actor: req.user,
		subject,
		description,
		category: sanitizeString(String(req.body?.category || ""), 80),
		pageUrl: sanitizeString(String(req.body?.page_url || ""), 240),
		contactEmail: sanitizeString(String(req.body?.contact_email || ""), 120),
		priority,
	});

	return res.status(201).json({
		ticket: ticketResult.ticket,
		message: ticketResult.initial_message,
	});
}

export async function listMySupportTicketsController(req, res) {
	const tickets = await listSupportTicketsForUser(req.user.id);
	const summaries = await Promise.all(tickets.map((ticket) => buildSupportTicketSummary(ticket)));
	return res.json({ items: summaries });
}

export async function listSupportTicketMessagesController(req, res) {
	const ticketId = sanitizeString(String(req.params.ticketId || ""), 120);
	if (!ticketId) {
		return res.status(400).json({ error: "ticketId is required" });
	}
	const ticket = await getSupportTicketById(ticketId);
	if (!ticket) {
		return res.status(404).json({ error: "Ticket not found" });
	}
	if (String(ticket.user_id) !== String(req.user.id)) {
		return res.status(403).json({ error: "Forbidden" });
	}
	const messages = await listSupportTicketMessages(ticketId);
	return res.json({ items: messages });
}

export async function postSupportTicketMessageController(req, res) {
	const ticketId = sanitizeString(String(req.params.ticketId || ""), 120);
	const message = sanitizeString(String(req.body?.message || ""), 1200);
	if (!(ticketId && message)) {
		return res.status(400).json({ error: "message is required" });
	}
	const entry = await appendSupportTicketMessage(ticketId, req.user, message);
	if (entry === "forbidden") {
		return res.status(403).json({ error: "Forbidden" });
	}
	if (!entry) {
		return res.status(404).json({ error: "Ticket not found" });
	}
	return res.status(201).json(entry);
}
