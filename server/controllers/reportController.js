import { createReport } from "../services/reportService.js";
import prisma from "../utils/prisma.js";
import { sanitizeString } from "../utils/validators.js";

function isOwnerOrAdmin(user) {
	return ["owner", "admin"].includes(String(user?.role || "").toLowerCase());
}

function canAppealProduct(actor, product) {
	if (!(actor && product)) {
		return false;
	}
	if (isOwnerOrAdmin(actor)) {
		return true;
	}
	if (String(product.company_id || "") === String(actor.id || "")) {
		return true;
	}
	if (
		String(actor.role || "").toLowerCase() === "agent" &&
		String(actor.org_owner_id || "") === String(product.company_id || "")
	) {
		return true;
	}
	return false;
}

export async function createSystemReportController(req, res) {
	const reason = sanitizeString(String(req.body?.reason || ""), 400);
	if (!reason) {
		return res.status(400).json({ error: "reason is required" });
	}
	const row = await createReport({
		actor: req.user,
		entity_type: "system_report",
		entity_id: sanitizeString(String(req.body?.page || "system"), 160),
		reason,
		metadata: {
			category: sanitizeString(String(req.body?.category || "system"), 80),
		},
	});
	return res.status(201).json(row);
}

export async function createProductAppealReportController(req, res) {
	const productId = sanitizeString(String(req.body?.product_id || ""), 120);
	const reason = sanitizeString(String(req.body?.reason || ""), 400);
	if (!(productId && reason)) {
		return res.status(400).json({ error: "product_id and reason are required" });
	}

	const product = await prisma.product.findUnique({
		where: { id: productId },
		select: {
			id: true,
			company_id: true,
			title: true,
			content_review_status: true,
		},
	});
	if (!product) {
		return res.status(404).json({ error: "Product not found" });
	}
	if (!canAppealProduct(req.user, product)) {
		return res.status(403).json({ error: "Forbidden" });
	}

	const row = await createReport({
		actor: req.user,
		entity_type: "product_appeal",
		entity_id: productId,
		reason,
		metadata: {
			product_title: product.title || "",
			review_status: product.content_review_status || "",
		},
	});
	return res.status(201).json(row);
}

export async function createContentReportController(req, res) {
	const targetType = sanitizeString(String(req.body?.entity_type || ""), 80);
	const targetId = sanitizeString(String(req.body?.entity_id || ""), 160);
	const reason = sanitizeString(String(req.body?.reason || ""), 400);
	if (!(targetType && targetId && reason)) {
		return res.status(400).json({ error: "entity_type, entity_id, and reason are required" });
	}

	const row = await createReport({
		actor: req.user,
		entity_type: "content_report",
		entity_id: `${targetType}:${targetId}`,
		reason,
		metadata: { target_entity_type: targetType, target_entity_id: targetId },
	});
	return res.status(201).json(row);
}
