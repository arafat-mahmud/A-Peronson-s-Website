import { getPresenceSnapshot } from "../services/presenceService.js";

export function getPresence(req, res) {
	const ids = Array.isArray(req.body?.user_ids) ? req.body.user_ids : [];
	const presence = getPresenceSnapshot(ids);
	return res.status(200).json({ presence });
}
