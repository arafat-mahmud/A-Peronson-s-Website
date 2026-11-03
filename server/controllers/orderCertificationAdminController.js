import {
	addOrderCertificationEvidence,
	approveOrderCertification,
	listOrderCertifications,
	revokeOrderCertification,
} from "../services/orderCertificationService.js";
import { findUserById } from "../services/userService.js";
import { sanitizeString } from "../utils/validators.js";

function normalizeIds(value) {
	if (Array.isArray(value)) {
		return value.map((v) => sanitizeString(String(v || ""), 120)).filter(Boolean);
	}
	return String(value || "")
		.split(",")
		.map((entry) => sanitizeString(entry.trim(), 120))
		.filter(Boolean);
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

export async function listOrderCertificationsAdmin(req, res) {
	const status = sanitizeString(String(req.query?.status || ""), 40);
	const items = await listOrderCertifications({ status });
	return res.json({ items });
}

export async function approveOrderCertificationAdmin(req, res) {
	try {
		const userId = sanitizeString(String(req.body?.user_id || ""), 120);
		if (!userId) {
			return res.status(400).json({ error: "user_id is required" });
		}
		await ensureUserExists(userId);
		const evidence = normalizeIds(req.body?.evidence_contract_ids || req.body?.evidence_ids);
		const note = sanitizeString(String(req.body?.note || ""), 320);
		const record = await approveOrderCertification(userId, {
			issuedBy: req.user?.id,
			evidenceContractIds: evidence,
			note,
		});
		return res.json({ record });
	} catch (err) {
		return res
			.status(err.status || 400)
			.json({ error: err.message || "Unable to approve certification" });
	}
}

export async function revokeOrderCertificationAdmin(req, res) {
	try {
		const userId = sanitizeString(String(req.body?.user_id || ""), 120);
		if (!userId) {
			return res.status(400).json({ error: "user_id is required" });
		}
		await ensureUserExists(userId);
		const note = sanitizeString(String(req.body?.note || ""), 320);
		const record = await revokeOrderCertification(userId, {
			issuedBy: req.user?.id,
			note,
		});
		return res.json({ record });
	} catch (err) {
		return res
			.status(err.status || 400)
			.json({ error: err.message || "Unable to revoke certification" });
	}
}

export async function attachOrderCertificationEvidenceAdmin(req, res) {
	try {
		const userId = sanitizeString(String(req.body?.user_id || ""), 120);
		if (!userId) {
			return res.status(400).json({ error: "user_id is required" });
		}
		await ensureUserExists(userId);
		const evidence = normalizeIds(req.body?.evidence_contract_ids || req.body?.evidence_ids);
		if (evidence.length === 0) {
			return res.status(400).json({ error: "evidence_contract_ids are required" });
		}
		const note = sanitizeString(String(req.body?.note || ""), 320);
		const record = await addOrderCertificationEvidence(userId, evidence, {
			issuedBy: req.user?.id,
			note,
		});
		return res.json({ record });
	} catch (err) {
		return res
			.status(err.status || 400)
			.json({ error: err.message || "Unable to attach evidence" });
	}
}
