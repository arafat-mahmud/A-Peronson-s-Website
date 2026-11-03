import {
	createAgentSubId,
	deleteAgentSubId,
	getAgentSubIdById,
	listAgentSubIds,
} from "../services/agentSubIdService.js";
import { handleControllerError } from "../utils/permissions.js";

export async function listAgentSubIdsController(req, res) {
	try {
		const items = await listAgentSubIds(req.user);
		return res.json({ items });
	} catch (err) {
		return handleControllerError(res, err);
	}
}

export async function createAgentSubIdController(req, res) {
	try {
		const payload = req.body || {};
		const created = await createAgentSubId(req.user.id, {
			label: payload.label || "",
			metadata: payload.metadata || {},
		});
		return res.status(201).json(created);
	} catch (err) {
		return handleControllerError(res, err);
	}
}

export async function getAgentSubIdController(req, res) {
	try {
		const id = String(req.params.id || "");
		const row = await getAgentSubIdById(id);
		if (!row) {
			return res.status(404).json({ error: "Not found" });
		}
		if (
			String(row.owner_id) !== String(req.user.id) &&
			req.user?.role !== "admin" &&
			req.user?.role !== "owner"
		) {
			return res.status(403).json({ error: "Forbidden" });
		}
		return res.json(row);
	} catch (err) {
		return handleControllerError(res, err);
	}
}

export async function deleteAgentSubIdController(req, res) {
	try {
		const id = String(req.params.id || "");
		const ok = await deleteAgentSubId(id, req.user);
		if (!ok) {
			return res.status(404).json({ error: "Not found" });
		}
		return res.json({ ok: true });
	} catch (err) {
		if (
			String(err.message || "")
				.toLowerCase()
				.includes("forbidden")
		) {
			return res.status(403).json({ error: "Forbidden" });
		}
		return handleControllerError(res, err);
	}
}

export default {
	listAgentSubIdsController,
	createAgentSubIdController,
	getAgentSubIdController,
	deleteAgentSubIdController,
};
