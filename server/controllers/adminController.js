import fs from "node:fs";
import path from "node:path";
import { handleSignCallback } from "../services/eSignService.js";
import { createNotification } from "../services/notificationService.js";
import { listReports, resolveReport } from "../services/reportService.js";
import {
	adminAssignSupportTicket,
	adminUpdateSupportTicket,
	buildSupportTicketSummary,
	listSupportTicketsAdmin,
} from "../services/supportTicketService.js";
import { readLocalJson, updateLocalJson } from "../utils/localStore.js";
import { logError, logInfo } from "../utils/logger.js";
import prisma from "../utils/prisma.js";
import { sanitizeString } from "../utils/validators.js";

function toPublicFileUrl(filePath = "") {
	if (!filePath) {
		return "";
	}
	const normalized = String(filePath).replace(/\\/g, "/");
	if (normalized.startsWith("/uploads/")) {
		return normalized;
	}
	const idx = normalized.indexOf("server/uploads/");
	if (idx >= 0) {
		return `/uploads/${normalized.slice(idx + "server/uploads/".length)}`;
	}
	return normalized.startsWith("uploads/") ? `/${normalized}` : normalized;
}

export async function verificationAudit(req, res) {
	const skip = Math.max(0, Number(req.query.skip) || 0);
	const take = Math.max(1, Math.min(500, Number(req.query.take) || 100));
	const [data, total] = await Promise.all([
		prisma.verification.findMany({ skip, take }),
		prisma.verification.count(),
	]);
	return res.json({ data, total, skip, take });
}

export async function subscriptionsAudit(req, res) {
	const skip = Math.max(0, Number(req.query.skip) || 0);
	const take = Math.max(1, Math.min(500, Number(req.query.take) || 100));
	const [data, total] = await Promise.all([
		prisma.subscription.findMany({ skip, take }),
		prisma.subscription.count(),
	]);
	return res.json({ data, total, skip, take });
}

export async function usersAudit(req, res) {
	const skip = Math.max(0, Number(req.query.skip) || 0);
	const take = Math.max(1, Math.min(500, Number(req.query.take) || 100));
	const [users, total] = await Promise.all([
		prisma.user.findMany({ skip, take }),
		prisma.user.count(),
	]);
	const data = users.map((user) => {
		const safe = { ...user };
		safe.password_hash = undefined;
		return safe;
	});
	return res.json({ data, total, skip, take });
}

export async function violationsAudit(_req, res) {
	const violations = await prisma.policyViolation.findMany({
		orderBy: { created_at: "desc" },
	});
	return res.json(violations);
}

export async function pendingVideos(_req, res) {
	const items = await prisma.product.findMany({
		where: {
			video_url: { not: null },
			video_review_status: { not: "approved" },
		},
		orderBy: { created_at: "desc" },
	});

	return res.json({ items });
}

export async function approveVideo(req, res) {
	const productId = sanitizeString(String(req.params.productId || ""), 120);
	const product = await prisma.product.findUnique({ where: { id: productId } });
	if (!product) {
		return res.status(404).json({ error: "Product not found" });
	}

	const updated = await prisma.product.update({
		where: { id: productId },
		data: {
			video_review_status: "approved",
			video_restricted: false,
			video_reviewed_at: new Date(),
			video_review_reason: "",
		},
	});

	const companyId = String(updated.company_id || "").trim();
	if (companyId) {
		await createNotification(companyId, {
			type: "video_review_approved",
			entity_type: "company_product",
			entity_id: updated.id,
			message: `Your video was approved: "${updated.title || "Product"}"`,
			meta: { product_id: updated.id },
		});
	}

	return res.json({ ok: true, item: updated });
}

export async function rejectVideo(req, res) {
	const productId = sanitizeString(String(req.params.productId || ""), 120);
	const reason = sanitizeString(String(req.body?.reason || "Rejected by moderator"), 240);
	const product = await prisma.product.findUnique({ where: { id: productId } });
	if (!product) {
		return res.status(404).json({ error: "Product not found" });
	}

	const updated = await prisma.product.update({
		where: { id: productId },
		data: {
			video_review_status: "rejected",
			video_restricted: true,
			video_reviewed_at: new Date(),
			video_review_reason: reason,
		},
	});

	const companyId = String(updated.company_id || "").trim();
	if (companyId) {
		await createNotification(companyId, {
			type: "video_review_rejected",
			entity_type: "company_product",
			entity_id: updated.id,
			message: `Your video was rejected: "${updated.title || "Product"}". Reason: ${reason}`,
			meta: { product_id: updated.id, reason },
		});
	}

	return res.json({ ok: true, item: updated });
}

export async function pendingDocuments(_req, res) {
	try {
		const dbPending = await prisma.document.findMany({
			where: {
				moderation_status: { in: ["pending_review", "auto_approved"] },
			},
			orderBy: { created_at: "desc" },
			take: 100,
		});
		const items = dbPending.map((d) => ({
			id: d.id,
			uploaded_by: d.uploaded_by,
			entity_type: d.entity_type,
			entity_id: d.entity_id,
			file_path: d.file_path,
			type: d.type,
			moderation_status: d.moderation_status,
			ai_label: d.ai_label,
			ai_score: d.ai_score,
			ai_confidence: d.ai_confidence,
			ai_signals: d.ai_signals,
			ai_details: d.ai_details,
			ai_timing: d.ai_timing,
			ai_severity: d.ai_severity,
			ai_early_exit: d.ai_early_exit,
			ai_analyzed_at: d.ai_analyzed_at ? d.ai_analyzed_at.toISOString() : null,
			ai_auto_approved: d.ai_auto_approved,
			moderation_flags: d.moderation_flags,
			created_at: d.created_at ? d.created_at.toISOString() : null,
			public_url: toPublicFileUrl(d.file_path || ""),
		}));
		return res.json({ items });
	} catch {
		return res.json({ items: [] });
	}
}

export async function approveDocument(req, res) {
	const docId = sanitizeString(String(req.params.documentId || ""), 120);
	let item;
	try {
		item = await prisma.document.update({
			where: { id: docId },
			data: { moderation_status: "approved" },
		});
	} catch {
		return res.status(404).json({ error: "Document not found" });
	}

	const ownerId = String(item.uploaded_by || item.entity_id || "").trim();
	if (ownerId) {
		await createNotification(ownerId, {
			type: "media_review_approved",
			entity_type: item.entity_type || "document",
			entity_id: item.entity_id || docId,
			message: "Your uploaded document was approved by moderation.",
			meta: { document_id: item.id || docId },
		});
	}

	return res.json({ ok: true, item });
}

export async function rejectDocument(req, res) {
	const docId = sanitizeString(String(req.params.documentId || ""), 120);
	const reason = sanitizeString(String(req.body?.reason || "Rejected by moderator"), 240);

	let item;
	try {
		const existing = await prisma.document.findUnique({ where: { id: docId } });
		if (!existing) {
			return res.status(404).json({ error: "Document not found" });
		}

		item = await prisma.document.update({
			where: { id: docId },
			data: {
				moderation_status: "rejected",
				moderation_flags: [...(existing.moderation_flags || []), `rejected:${reason}`],
			},
		});
	} catch {
		return res.status(404).json({ error: "Document not found" });
	}

	const ownerId = String(item.uploaded_by || item.entity_id || "").trim();
	if (ownerId) {
		await createNotification(ownerId, {
			type: "media_review_rejected",
			entity_type: item.entity_type || "document",
			entity_id: item.entity_id || item.id,
			message: `Your uploaded document was rejected by moderation. Reason: ${reason}`,
			meta: { document_id: item.id, reason },
		});
	}

	return res.json({ ok: true, item });
}

export async function reanalyzeDocument(req, res) {
	const docId = sanitizeString(String(req.params.documentId || ""), 120);

	const doc = await prisma.document.findUnique({ where: { id: docId } });
	if (!doc) {
		return res.status(404).json({ error: "Document not found" });
	}

	const filePath = doc.file_path || "";
	const fullPath = path.join(process.cwd(), "server", filePath);

	if (!fs.existsSync(fullPath)) {
		return res.status(400).json({ error: "File not found on disk" });
	}

	const { isAIAnalyticsEnabled } = await import("../services/aiModerationService.js");
	if (!isAIAnalyticsEnabled()) {
		return res.status(200).json({
			error: null,
			message: "AI Haram Analytics is disabled via AI_HARAM_ANALYTICS_ENABLED",
		});
	}

	res.json({ status: "processing", message: "Reanalysis queued" });

	const { analyzeBufferWithAI } = await import("../services/aiModerationService.js");

	try {
		const buffer = fs.readFileSync(fullPath);
		const filename = path.basename(fullPath);
		const result = await analyzeBufferWithAI(buffer, filename);

		const label = result?.label || "UNKNOWN";
		const score = result?.score || 0;
		const confidence = result?.confidence || "low";
		const signals = result?.signals || [];
		const details = result?.details || {};
		const timing = result?.timing || {};
		const severity = result?.severity || null;
		const earlyExit = result?.is_early_exit;
		const autoApproved = label === "SAFE" || label === "QUESTIONABLE";

		await prisma.document.update({
			where: { id: docId },
			data: {
				ai_label: label,
				ai_score: score,
				ai_confidence: confidence,
				ai_signals: signals,
				ai_details: details,
				ai_timing: timing,
				ai_severity: severity,
				ai_early_exit: earlyExit,
				ai_analyzed_at: new Date(),
				ai_auto_approved: autoApproved,
				moderation_status: autoApproved ? "auto_approved" : "pending_review",
			},
		});

		logInfo("Reanalyze completed", { docId, label, score });
	} catch (err) {
		logError("Reanalyze failed", new Error(`docId=${docId}: ${err.message}`));
		await prisma.document.update({
			where: { id: docId },
			data: {
				ai_label: "ERROR",
				ai_score: 0,
				ai_analyzed_at: new Date(),
			},
		});
	}
}

export async function listReportsAudit(_req, res) {
	const items = await listReports();
	return res.json({ items });
}

export async function listSystemReportsAudit(_req, res) {
	const items = await listReports();
	const filtered = items.filter((r) =>
		["system_report", "support"].includes(String(r.entity_type || "").toLowerCase()),
	);
	return res.json({ items: filtered });
}

export async function listProductAppealReportsAudit(_req, res) {
	const items = await listReports();
	const filtered = items.filter(
		(r) => String(r.entity_type || "").toLowerCase() === "product_appeal",
	);
	return res.json({ items: filtered });
}

export async function listContentReportsAudit(_req, res) {
	const items = await listReports();
	const filtered = items.filter(
		(r) => String(r.entity_type || "").toLowerCase() === "content_report",
	);
	return res.json({ items: filtered });
}

export async function resolveReportAudit(req, res) {
	const updated = await resolveReport(req.params.reportId, req.user, req.body || {});
	if (!updated) {
		return res.status(404).json({ error: "Report not found" });
	}
	return res.json({ ok: true, item: updated });
}

export async function assignSupportTicket(req, res) {
	const ticketId = sanitizeString(String(req.body?.ticket_id || ""), 120);
	if (!ticketId) {
		return res.status(400).json({ error: "ticket_id is required" });
	}
	const assigneeId = sanitizeString(String(req.body?.assignee_id || ""), 120);
	const updated = await adminAssignSupportTicket(ticketId, assigneeId, req.user.id);
	if (!updated) {
		return res.status(404).json({ error: "Ticket not found" });
	}
	return res.json({
		ok: true,
		ticket: await buildSupportTicketSummary(updated),
	});
}

export async function updateSupportTicket(req, res) {
	const ticketId = sanitizeString(String(req.params.ticketId || ""), 120);
	if (!ticketId) {
		return res.status(400).json({ error: "ticketId is required" });
	}
	const updated = await adminUpdateSupportTicket(ticketId, req.body || {}, req.user.id);
	if (!updated) {
		return res.status(404).json({ error: "Ticket not found" });
	}
	return res.json({
		ok: true,
		ticket: await buildSupportTicketSummary(updated),
	});
}

export async function listSupportTicketsAdminController(req, res) {
	const status = sanitizeString(String(req.query?.status || ""), 40);
	const priority = sanitizeString(String(req.query?.priority || ""), 40);
	const assignedTo = sanitizeString(String(req.query?.assigned_to || ""), 120);
	const premiumOnly =
		req.query?.premium_only === undefined
			? undefined
			: ["true", "1", "yes"].includes(String(req.query?.premium_only).toLowerCase());
	const limit = Math.max(1, Math.min(200, Number(req.query?.limit || 50)));
	const offset = Math.max(0, Number(req.query?.offset || 0));
	const tickets = await listSupportTicketsAdmin({
		status,
		priority,
		assignedTo,
		premiumOnly,
		limit,
		offset,
	});
	const summaries = await Promise.all(tickets.map((ticket) => buildSupportTicketSummary(ticket)));
	return res.json({ items: summaries });
}

export async function assignAccountManager(req, res) {
	const userId = sanitizeString(String(req.body?.user_id || ""), 120);
	if (!userId) {
		return res.status(400).json({ error: "user_id is required" });
	}

	const user = await prisma.user.findUnique({ where: { id: userId } });
	if (!user) {
		return res.status(404).json({ error: "User not found" });
	}

	const profile = {
		...(user.profile || {}),
		account_manager_id: sanitizeString(String(req.body?.account_manager_id || ""), 120) || null,
		account_manager_name: sanitizeString(String(req.body?.account_manager_name || ""), 120),
		account_manager_email: sanitizeString(String(req.body?.account_manager_email || ""), 160),
		account_manager_phone: sanitizeString(String(req.body?.account_manager_phone || ""), 60),
	};

	await prisma.user.update({
		where: { id: userId },
		data: { profile },
	});

	return res.json({ ok: true, user_id: userId, profile });
}

// E-sign webhook failure admin helpers
export async function listEsignFailures(_req, res) {
	const items = await readLocalJson("esign_webhook_failures", []);
	return res.json({ items: Array.isArray(items) ? items : [] });
}

export async function retryEsignFailure(req, res) {
	const id = String(req.params.id || "").trim();
	const list = await readLocalJson("esign_webhook_failures", []);
	const idx = Array.isArray(list) ? list.findIndex((it) => String(it.id) === id) : -1;
	if (idx < 0) {
		return res.status(404).json({ error: "not_found" });
	}
	const item = list[idx];
	try {
		await handleSignCallback(item.contractId, item.payload);
		const next = list.filter((it) => String(it.id) !== id);
		await updateLocalJson("esign_webhook_failures", () => next, []);
		logInfo("admin_esign_retry_success", {
			id: item.id,
			contractId: item.contractId,
		});
		return res.json({ ok: true });
	} catch (err) {
		item.attempts = Number(item.attempts || 0) + 1;
		item.lastAttemptAt = Date.now();
		item.lastError = String(err?.message || err);
		const next = list.map((it) => (String(it.id) === id ? item : it));
		await updateLocalJson("esign_webhook_failures", () => next, []);
		logError("admin_esign_retry_failed", {
			id: item.id,
			contractId: item.contractId,
			error: item.lastError,
		});
		return res.status(500).json({ ok: false, error: "retry_failed", message: item.lastError });
	}
}

export async function deleteEsignFailure(req, res) {
	const id = String(req.params.id || "").trim();
	const list = await readLocalJson("esign_webhook_failures", []);
	const next = Array.isArray(list) ? list.filter((it) => String(it.id) !== id) : [];
	if (next.length === (Array.isArray(list) ? list.length : 0)) {
		return res.status(404).json({ error: "not_found" });
	}
	await updateLocalJson("esign_webhook_failures", () => next, []);
	logInfo("admin_esign_failure_deleted", { id });
	return res.json({ ok: true });
}
