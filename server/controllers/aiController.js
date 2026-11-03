import {
	approveReply,
	generateDraftResponse,
	orchestrateRequirementExtraction,
	sendReply,
} from "../services/aiOrchestrationService.js";
import { handleControllerError } from "../utils/permissions.js";

export async function extractRequirements(req, res) {
	try {
		const text = String(req.body?.text || "");
		const result = await orchestrateRequirementExtraction({ text });
		return res.json(result);
	} catch (error) {
		return handleControllerError(res, error);
	}
}

export async function draftReply(req, res) {
	try {
		const text = String(req.body?.text || "");
		// Build a lightweight draft by first extracting requirements and then generating a draft response.
		const extraction = await orchestrateRequirementExtraction({ text });
		const draft = generateDraftResponse(
			extraction.extracted || {},
			extraction.missing_fields || [],
		);
		return res.json({ draft, extraction });
	} catch (error) {
		return handleControllerError(res, error);
	}
}

export async function approveReplyDraft(req, res) {
	try {
		const draft = String(req.body?.draft || "");
		const extractedRequirements =
			req.body?.extracted_requirements && typeof req.body.extracted_requirements === "object"
				? req.body.extracted_requirements
				: {};
		const allowNumericCommitment = Boolean(req.body?.allow_numeric_commitment);
		return res.json(approveReply({ draft, extractedRequirements, allowNumericCommitment }));
	} catch (error) {
		return handleControllerError(res, error);
	}
}

export async function sendApprovedReply(req, res) {
	try {
		const draft = String(req.body?.draft || "");
		const approval =
			req.body?.approval && typeof req.body.approval === "object" ? req.body.approval : {};
		return res.json(sendReply({ draft, approval }));
	} catch (error) {
		return handleControllerError(res, error);
	}
}
