import {
	getNetworkInventory,
	getNetworkOverview,
	performNetworkAction,
} from "../services/networkService.js";

export async function networkOverview(_req, res) {
	const data = await getNetworkOverview();
	return res.json(data);
}

export async function networkInventory(_req, res) {
	const data = await getNetworkInventory();
	return res.json(data);
}

export async function networkAction(req, res) {
	const action = String(req.body?.action || "").trim();
	if (!action) {
		return res.status(400).json({ error: "action is required" });
	}
	const payload = req.body?.payload || {};
	const result = await performNetworkAction(action, payload);
	return res.json(result);
}
