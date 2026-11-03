import { addAction, addComment, listInteractions } from "../services/socialService.js";

export async function createComment(req, res) {
	const text = req.body?.text || "";
	if (!text.trim()) {
		return res.status(400).json({ error: "Comment text required" });
	}
	try {
		const row = await addComment(
			req.user,
			req.params.entityType,
			req.params.entityId,
			text,
			req.body?.parent_id || "",
		);
		return res.status(201).json(row);
	} catch (err) {
		const status = err.status || 500;
		return res.status(status).json({ error: err.message || "Unable to add comment" });
	}
}

export async function createShare(req, res) {
	const row = await addAction(req.user, req.params.entityType, req.params.entityId, "share");
	return res.status(201).json(row);
}

export async function createReport(req, res) {
	const row = await addAction(
		req.user,
		req.params.entityType,
		req.params.entityId,
		"report",
		req.body?.reason || "",
	);
	return res.status(201).json(row);
}

export async function getEntityInteractions(req, res) {
	return res.json(await listInteractions(req.params.entityType, req.params.entityId));
}

export async function createAction(req, res) {
	const { entityType, entityId, action } = req.body || {};
	if (!(entityType && entityId && action)) {
		return res.status(400).json({ error: "entityType, entityId, action required" });
	}
	if (action === "comment") {
		return createComment(
			{
				...req,
				params: { entityType, entityId },
				body: { text: "Comment noted" },
			},
			res,
		);
	}
	if (action === "share") {
		return createShare({ ...req, params: { entityType, entityId } }, res);
	}
	if (action === "report") {
		return createReport(
			{
				...req,
				params: { entityType, entityId },
				body: { reason: "Reported from feed action" },
			},
			res,
		);
	}
	const row = await addAction(req.user, entityType, entityId, action);
	return res.status(201).json(row);
}
