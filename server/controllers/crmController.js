import { getCrmProfileSummary, getCrmRelationshipTimeline } from "../services/crmService.js";
import { handleControllerError } from "../utils/permissions.js";

export async function crmProfileSummary(req, res) {
	try {
		const result = await getCrmProfileSummary(req.user, req.params.targetId, {
			match_id: req.query?.match_id,
			from: req.query?.from,
			to: req.query?.to,
		});
		if (result?.error === "forbidden") {
			return res.status(403).json({ error: "Forbidden" });
		}
		if (result?.error) {
			return res.status(404).json({ error: result.error });
		}
		return res.json(result);
	} catch (error) {
		return handleControllerError(res, error);
	}
}

export async function crmRelationshipTimeline(req, res) {
	try {
		const result = await getCrmRelationshipTimeline(req.user, req.params.counterpartyId, {
			match_id: req.query?.match_id,
			from: req.query?.from,
			to: req.query?.to,
		});
		if (result?.error === "forbidden") {
			return res.status(403).json({ error: "Forbidden" });
		}
		if (result?.error) {
			return res.status(404).json({ error: result.error });
		}
		return res.json(result);
	} catch (error) {
		return handleControllerError(res, error);
	}
}
