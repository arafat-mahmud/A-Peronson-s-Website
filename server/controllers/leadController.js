import { ACTIONS, authorize } from "../services/authorizationService.js";
import {
	addLeadNote,
	addLeadReminder,
	getLeadById,
	getLeadByMatch,
	listLeads,
	updateLead,
} from "../services/leadService.js";
import { handleControllerError } from "../utils/permissions.js";

export async function getLeads(req, res) {
	const items = await listLeads(req.user);
	return res.json({ items });
}

export async function getLead(req, res) {
	const lead = await getLeadById(req.user, req.params.leadId);
	if (!lead) {
		return res.status(404).json({ error: "Lead not found" });
	}
	return res.json(lead);
}

export async function getLeadForMatch(req, res) {
	const lead = await getLeadByMatch(req.user, req.params.matchId);
	if (!lead) {
		return res.status(404).json({ error: "Lead not found" });
	}
	return res.json(lead);
}

export async function patchLead(req, res) {
	try {
		const patch = req.body || {};
		if (patch.assigned_agent_id === undefined) {
			await authorize(req.user, ACTIONS.ANALYTICS_VIEW_AGENT, {
				lead_id: req.params.leadId,
			});
		} else {
			await authorize(req.user, ACTIONS.LEADS_ASSIGN, {
				lead_id: req.params.leadId,
			});
		}
		const updated = await updateLead(req.user, req.params.leadId, patch);
		if (!updated) {
			return res.status(404).json({ error: "Lead not found" });
		}
		return res.json(updated);
	} catch (error) {
		return handleControllerError(res, error);
	}
}

export async function postLeadNote(req, res) {
	const row = await addLeadNote(req.user, req.params.leadId, req.body?.note);
	if (!row) {
		return res.status(404).json({ error: "Lead not found" });
	}
	if (!row.note) {
		return res.status(400).json({ error: "note is required" });
	}
	return res.status(201).json(row);
}

export async function postLeadReminder(req, res) {
	const row = await addLeadReminder(req.user, req.params.leadId, req.body || {});
	if (!row) {
		return res.status(404).json({ error: "Lead not found" });
	}
	return res.status(201).json(row);
}
