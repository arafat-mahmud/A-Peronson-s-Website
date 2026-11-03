import { getServerAdminState, performServerAdminAction } from "../services/serverAdminService.js";

export async function getServerAdminStateController(_req, res) {
	const state = await getServerAdminState();
	return res.json(state);
}

export async function serverAdminActionController(req, res) {
	const action = req.body?.action || "";
	const payload = req.body?.payload || {};
	const result = await performServerAdminAction(action, payload);
	return res.json(result);
}
