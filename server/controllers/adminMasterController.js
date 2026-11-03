import crypto from "node:crypto";
import { performAdminAction } from "../services/adminActionService.js";
import { getAdminConfig, updateAdminConfig } from "../services/adminConfigService.js";
import { getAdminMasterSummary } from "../services/adminMasterService.js";
import { listUsers } from "../services/userService.js";
import { readAuditLog } from "../utils/auditStore.js";
import { handleControllerError } from "../utils/permissions.js";
import prisma from "../utils/prisma.js";

export async function adminMasterOverview(req, res) {
	const summary = await getAdminMasterSummary(req.user);
	return res.json(summary);
}

export async function adminAction(req, res) {
	const action = String(req.body?.action || "").trim();
	if (!action) {
		return res.status(400).json({ error: "action is required" });
	}
	try {
		const result = await performAdminAction(action, req.body?.payload || {}, req.user);
		return res.json({ ok: true, action_id: crypto.randomUUID(), result });
	} catch (error) {
		return handleControllerError(res, error);
	}
}

export async function adminAuditLog(req, res) {
	const items = await readAuditLog();
	const limit = Math.max(1, Math.min(200, Number(req.query?.limit || 100)));
	return res.json({ items: items.slice(-limit).reverse() });
}

export async function adminGetConfig(_req, res) {
	const config = await getAdminConfig();
	return res.json(config);
}

export async function adminUpdateConfig(req, res) {
	const patch = req.body || {};
	const config = await updateAdminConfig(patch);
	return res.json(config);
}

export async function adminEmailExport(_req, res) {
	const users = await listUsers();
	const emails = users.map((u) => u.email).filter(Boolean);
	const csv = ["email", ...emails].join("\n");
	res.setHeader("Content-Type", "text/csv");
	res.setHeader("Content-Disposition", 'attachment; filename="gartexhub_emails.csv"');
	return res.send(csv);
}

function toCsv(rows = []) {
	if (rows.length === 0) {
		return "";
	}
	const headers = Object.keys(rows[0]);
	const escape = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
	const lines = [
		headers.join(","),
		...rows.map((row) => headers.map((key) => escape(row[key])).join(",")),
	];
	return lines.join("\n");
}

async function generatePdf(data, dataset, res) {
	const { default: PDFDocument } = await import("pdfkit");
	return new Promise((resolve, reject) => {
		try {
			const doc = new PDFDocument({ margin: 50, size: "A4" });
			const chunks = [];

			doc.on("data", (chunk) => chunks.push(chunk));
			doc.on("end", () => {
				const pdfBuffer = Buffer.concat(chunks);
				res.setHeader("Content-Type", "application/pdf");
				res.setHeader("Content-Disposition", `attachment; filename="${dataset}.pdf"`);
				res.end(pdfBuffer);
				resolve();
			});
			doc.on("error", reject);

			doc.fontSize(18).text(`GarTexHub - ${dataset.replace(/_/g, " ").toUpperCase()} REPORT`, {
				align: "center",
			});
			doc.moveDown(0.5);
			doc.fontSize(10).text(`Generated: ${new Date().toISOString()}`, { align: "center" });
			doc.moveDown();

			const flatten = (obj, prefix = "") => {
				const result = [];
				for (const [key, value] of Object.entries(obj || {})) {
					if (value && typeof value === "object" && !Array.isArray(value)) {
						result.push(...flatten(value, `${prefix}${key}.`));
					} else {
						result.push({
							key: `${prefix}${key}`,
							value: String(value ?? "").substring(0, 80),
						});
					}
				}
				return result;
			};

			if (data && typeof data === "object") {
				const rows = flatten(data);

				if (rows.length > 0) {
					doc.fontSize(11).text(`Total Items: ${rows.length}`, { align: "left" });
					doc.moveDown();

					doc.fontSize(9);
					let y = doc.y;
					doc.text("Key", 50, y, { width: 300, lineBreak: false });
					doc.text("Value", 350, y, { width: 200, lineBreak: false });
					doc.moveDown();
					y = doc.y;

					doc.fontSize(8);
					doc.strokeColor("#cccccc").lineWidth(0.5);

					rows.slice(0, 200).forEach((row) => {
						if (doc.y > 750) {
							doc.addPage();
							y = 50;
						}
						y = doc.y;
						doc.stroke().moveTo(50, y).lineTo(550, y).stroke();
						doc.text(row.key, 50, y + 5, { width: 300, lineBreak: false });
						doc.text(row.value, 350, y + 5, { width: 200, lineBreak: false });
						doc.moveDown(0.8);
					});
				} else {
					doc.fontSize(11).text("No data available", { align: "left" });
				}
			} else {
				doc.fontSize(11).text("No data available", { align: "left" });
			}

			doc.moveDown(2);
			doc.fontSize(8).text("GarTexHub Admin Export", { align: "center" });

			doc.end();
		} catch (err) {
			reject(err);
		}
	});
}

const DATASET_MODEL_MAP = {
	users: () => prisma.user.findMany(),
	requirements: () => prisma.requirement.findMany(),
	company_products: () => prisma.product.findMany(),
	messages: () => prisma.message.findMany(),
	notifications: () => prisma.notification.findMany(),
	search_alerts: () => prisma.searchAlert.findMany(),
	documents: () => prisma.document.findMany(),
	leads: () => prisma.lead.findMany(),
	feed_posts: () => prisma.feedPost.findMany(),
	boost: () => prisma.boost.findMany(),
	matches: () => prisma.match.findMany(),
	conversation_locks: () => prisma.conversationLock.findMany(),
	partner_requests: () => prisma.partnerRequest.findMany(),
	call_sessions: () => prisma.callSession.findMany(),
	call_recording_views: () => prisma.callRecordingView.findMany(),
	product_views: () => prisma.productView.findMany(),
	subscriptions: () => prisma.subscription.findMany(),
	violations: () => prisma.policyViolation.findMany(),
	ratings: () => prisma.rating.findMany(),
	social_interactions: () => prisma.socialInteraction.findMany(),
	user_connections: () => prisma.userConnection.findMany(),
	lead_notes: () => prisma.leadNote.findMany(),
	lead_reminders: () => prisma.leadReminder.findMany(),
	lead_assignments: () => prisma.leadAssignment.findMany(),
	lead_sla_timers: () => prisma.leadSlaTimer.findMany(),
	lead_escalations: () => prisma.leadEscalation.findMany(),
	agent_workloads: () => prisma.agentWorkload.findMany(),
	agent_capacity: () => prisma.agentCapacity.findMany(),
	analytics: () => prisma.analyticsEvent.findMany(),
	wallet_history: () => prisma.walletHistory.findMany(),
	coupon_codes: () => prisma.couponCode.findMany(),
	coupon_redemptions: () => prisma.couponRedemption.findMany(),
	reports: () => prisma.report.findMany(),
	org_policies: () => prisma.orgPolicy.findMany(),
	org_ops_policies: () => prisma.orgOpsPolicy.findMany(),
	verification: () => prisma.verification.findMany(),
	payment_proofs: () => prisma.paymentProof.findMany(),
	support_tickets: () => prisma.supportTicket.findMany(),
	support_ticket_messages: () => prisma.supportTicketMessage.findMany(),
	search_usage_counters: () => prisma.searchUsageCounter.findMany(),
	assistant_knowledge: () => prisma.assistantKnowledge.findMany(),
};

export async function adminDataExport(req, res) {
	const dataset = String(req.query?.dataset || "").trim();
	const format = String(req.query?.format || "json").toLowerCase();
	if (!dataset) {
		return res.status(400).json({ error: "dataset is required" });
	}

	let data = null;

	if (dataset === "full_system") {
		const { getAdminMasterSummary } = await import("../services/adminMasterService.js");
		const { getAdminConfig } = await import("../services/adminConfigService.js");
		const { listUsers } = await import("../services/userService.js");
		const { readAuditLog } = await import("../utils/auditStore.js");

		const [summary, config, users, audit] = await Promise.all([
			getAdminMasterSummary(req.user),
			getAdminConfig(),
			listUsers(),
			readAuditLog().then((items) => items.slice(-50).reverse()),
		]);

		data = { summary, config, users_count: users.length, recent_audit: audit };
	} else {
		const fetcher = DATASET_MODEL_MAP[dataset];
		if (!fetcher) {
			return res.status(404).json({ error: "dataset not found" });
		}
		data = await fetcher();
	}

	if (format === "csv") {
		const rows = Array.isArray(data) ? data : [data];
		const csv = toCsv(rows);
		res.setHeader("Content-Type", "text/csv");
		res.setHeader("Content-Disposition", `attachment; filename="${dataset}.csv"`);
		return res.send(csv);
	}

	if (format === "pdf") {
		try {
			await generatePdf(data, dataset, res);
		} catch {
			return res.status(500).json({ error: "Failed to generate PDF" });
		}
		return;
	}

	res.setHeader("Content-Type", "application/json");
	return res.json({ dataset, items: data });
}
