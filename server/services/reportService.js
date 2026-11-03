import crypto from "node:crypto";
import prisma from "../utils/prisma.js";
import { sanitizeString } from "../utils/validators.js";
import { createNotification } from "./notificationService.js";

export async function createReport({ actor, entity_type, entity_id, reason = "", _metadata = {} }) {
	const row = await prisma.report.create({
		data: {
			id: crypto.randomUUID(),
			status: "open",
			entity_type: sanitizeString(String(entity_type || ""), 60),
			entity_id: sanitizeString(String(entity_id || ""), 160),
			reason: sanitizeString(String(reason || ""), 400),
			actor_id: sanitizeString(String(actor?.id || ""), 120),
			actor_name: sanitizeString(String(actor?.name || actor?.email || ""), 120),
			created_at: new Date(),
		},
	});

	const admins = await prisma.user.findMany({
		where: { role: { in: ["owner", "admin"] } },
	});

	await Promise.all(
		admins.map((admin) =>
			createNotification(admin.id, {
				type: "report_created",
				entity_type: row.entity_type,
				entity_id: row.entity_id,
				message: "A new report has been created.",
				meta: {
					report_id: row.id,
					reason: row.reason,
					actor_id: row.actor_id,
				},
			}),
		),
	);

	return row;
}

export async function listReports() {
	return prisma.report.findMany({ orderBy: { created_at: "desc" } });
}

export async function resolveReport(reportId, actor, payload = {}) {
	const id = sanitizeString(String(reportId || ""), 120);
	const existing = await prisma.report.findUnique({ where: { id } });
	if (!existing) {
		return null;
	}

	return prisma.report.update({
		where: { id },
		data: {
			status: "resolved",
			resolved_at: new Date(),
			resolved_by: sanitizeString(String(actor?.id || ""), 120),
			resolution_action: sanitizeString(String(payload.action || ""), 80),
			resolution_note: sanitizeString(String(payload.note || ""), 400),
		},
	});
}
