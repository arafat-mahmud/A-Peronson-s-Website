import {
	createJoinRequest,
	disputeDuplicateFlag,
	getJoinRequestSnapshot,
	listDuplicateDisputes,
	listPendingJoinRequestsForUser,
	resolveDuplicateDispute,
	respondToJoinRequest,
} from "../services/companyJoinService.js";
import { findUserById } from "../services/userService.js";

export async function createJoinRequestController(req, res) {
	const companyId = String(req.body?.company_id || req.body?.company_owner_id || "").trim();
	if (!companyId) {
		return res.status(400).json({ error: "Missing company_id" });
	}

	const companyUser = await findUserById(companyId);
	if (!companyUser) {
		return res.status(404).json({ error: "Company account not found" });
	}

	const request = await createJoinRequest({
		applicantUser: req.user,
		companyUser,
		sourceVerificationId: req.body?.source_verification_id || "",
		position: req.body?.position || "",
		message: req.body?.message || "",
	});

	return res.status(201).json({
		ok: true,
		request,
	});
}

export async function getJoinRequestController(req, res) {
	try {
		const request = await getJoinRequestSnapshot(req.params.requestId, req.user);
		if (!request) {
			return res.status(404).json({ error: "Join request not found" });
		}
		return res.json(request);
	} catch (error) {
		const status = Number(error?.status) || 400;
		return res.status(status).json({ error: error?.message || "Unable to load join request" });
	}
}

export async function respondToJoinRequestController(req, res) {
	try {
		const result = await respondToJoinRequest({
			notificationId: req.params.requestId,
			user: req.user,
			action: String(req.body?.action || "")
				.trim()
				.toLowerCase(),
			reason: req.body?.reason || "",
		});
		return res.json({ ok: true, request: result });
	} catch (error) {
		const status = Number(error?.status) || 400;
		return res.status(status).json({ error: error?.message || "Unable to update join request" });
	}
}

export async function listMyJoinRequestsController(req, res) {
	try {
		const rows = await listPendingJoinRequestsForUser(req.user);
		return res.json({ items: rows });
	} catch (error) {
		return res.status(400).json({ error: error?.message || "Unable to load join requests" });
	}
}

export async function disputeDuplicateController(req, res) {
	try {
		const companyId = String(req.body?.company_id || "").trim();
		if (!companyId) {
			return res.status(400).json({ error: "Missing company_id" });
		}
		const dispute = await disputeDuplicateFlag({
			applicantUser: req.user,
			companyUserId: companyId,
			sourceVerificationId: req.body?.source_verification_id || "",
			applicantName: req.body?.applicant_name || "",
			applicantEmail: req.body?.applicant_email || "",
		});
		return res.status(201).json({ ok: true, dispute });
	} catch (error) {
		const status = Number(error?.status) || 400;
		return res.status(status).json({ error: error?.message || "Unable to submit dispute" });
	}
}

export async function listDuplicateDisputesController(_req, res) {
	try {
		const items = await listDuplicateDisputes();
		return res.json({ items });
	} catch (error) {
		return res.status(400).json({ error: error?.message || "Unable to load disputes" });
	}
}

export async function resolveDuplicateDisputeController(req, res) {
	try {
		const result = await resolveDuplicateDispute({
			notificationId: req.params.disputeId,
			user: req.user,
			action: String(req.body?.action || "")
				.trim()
				.toLowerCase(),
			reason: req.body?.reason || "",
		});
		return res.json({ ok: true, dispute: result });
	} catch (error) {
		const status = Number(error?.status) || 400;
		return res.status(status).json({ error: error?.message || "Unable to resolve dispute" });
	}
}
