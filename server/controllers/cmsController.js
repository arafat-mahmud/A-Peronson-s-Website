import { getCmsState, performCmsAction } from "../services/cmsService.js";

export async function getCmsStateController(_req, res) {
	const state = await getCmsState();
	return res.json(state);
}

export async function cmsActionController(req, res) {
	const action = req.body?.action || "";
	const payload = req.body?.payload || {};
	const result = await performCmsAction(action, payload);
	return res.json(result);
}
