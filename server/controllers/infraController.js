import {
	getInfraState,
	getSystemOverview,
	listProcesses,
	listServices,
	listStorage,
	performInfraAction,
} from "../services/infraService.js";

export async function infraOverview(_req, res) {
	const data = await getSystemOverview();
	return res.json(data);
}

export async function infraProcesses(_req, res) {
	const data = await listProcesses();
	return res.json({ items: data });
}

export async function infraServices(_req, res) {
	const data = await listServices();
	return res.json({ items: data });
}

export async function infraStorage(_req, res) {
	const data = await listStorage();
	return res.json({ items: data });
}

export async function infraState(_req, res) {
	const data = await getInfraState();
	return res.json(data);
}

export async function infraAction(req, res) {
	const action = String(req.body?.action || "").trim();
	if (!action) {
		return res.status(400).json({ error: "action is required" });
	}
	const payload = req.body?.payload || {};
	const result = await performInfraAction(action, payload);
	return res.json(result);
}
