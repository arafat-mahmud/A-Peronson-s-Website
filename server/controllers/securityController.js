import { getSecurityState, performSecurityAction } from "../services/securityService.js";

export async function getSecurityStateController(_req, res) {
	const state = await getSecurityState();
	return res.json(state);
}

export async function securityActionController(req, res) {
	const action = req.body?.action || "";
	const payload = req.body?.payload || {};
	const result = await performSecurityAction(action, payload);
	return res.json(result);
}
