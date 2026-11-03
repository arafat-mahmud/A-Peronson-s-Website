import {
	getDealJourneyByContext,
	getDealJourneyById,
	recordJourneyEvent,
	rollbackDealJourney,
} from "../services/dealJourneyService.js";
import { handleControllerError } from "../utils/permissions.js";

export async function getJourneyByContext(req, res) {
	try {
		const row = await getDealJourneyByContext({
			requirement_id: req.query.requirement_id,
			product_id: req.query.product_id,
			match_id: req.query.match_id,
			contract_id: req.query.contract_id,
		});
		if (!row) {
			return res.status(404).json({ error: "Deal journey not found" });
		}
		return res.json(row);
	} catch (error) {
		return handleControllerError(res, error);
	}
}

export async function getJourney(req, res) {
	try {
		const row = await getDealJourneyById(req.params.journeyId);
		if (!row) {
			return res.status(404).json({ error: "Deal journey not found" });
		}
		return res.json(row);
	} catch (error) {
		return handleControllerError(res, error);
	}
}

export async function createJourneyEvent(req, res) {
	try {
		const row = await recordJourneyEvent(
			req.body?.event_type,
			req.body?.context || {},
			req.body?.metadata || {},
		);
		if (!row) {
			return res.status(400).json({ error: "Invalid event_type" });
		}
		return res.status(201).json(row);
	} catch (error) {
		return handleControllerError(res, error);
	}
}

export async function rollbackJourney(req, res) {
	try {
		const row = await rollbackDealJourney(
			req.params.journeyId,
			req.body?.to_state,
			req.body?.reason,
			req.user?.id,
		);
		if (!row) {
			return res.status(404).json({ error: "Deal journey not found or invalid rollback payload" });
		}
		return res.json(row);
	} catch (error) {
		return handleControllerError(res, error);
	}
}
