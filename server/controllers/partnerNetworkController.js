import {
	getIncomingPartnerRequests,
	getPartnerNetwork,
	removePartnerConnection,
	sendPartnerRequest,
	updatePartnerRequestStatus,
} from "../services/partnerNetworkService.js";

function handleError(res, error) {
	const status = Number(error?.status) || 500;
	if (status === 500) {
		return res.status(500).json({ error: "Internal server error" });
	}
	return res.status(status).json({ error: error.message || "Request failed" });
}

export async function listPartnerNetwork(req, res) {
	try {
		const data = await getPartnerNetwork(req.user, {
			status: req.query.status || "",
		});
		return res.json(data);
	} catch (error) {
		return handleError(res, error);
	}
}

export async function createPartnerRequest(req, res) {
	const targetAccountId = req.body?.targetAccountId || "";
	if (!targetAccountId) {
		return res.status(400).json({ error: "targetAccountId is required" });
	}

	try {
		const row = await sendPartnerRequest(req.user, targetAccountId);
		return res.status(201).json(row);
	} catch (error) {
		return handleError(res, error);
	}
}

export async function listIncomingPartnerRequests(req, res) {
	try {
		const data = await getIncomingPartnerRequests(req.user);
		return res.json(data);
	} catch (error) {
		return handleError(res, error);
	}
}

async function handleStatusAction(req, res, action) {
	try {
		const row = await updatePartnerRequestStatus(req.user, req.params.requestId, action);
		return res.json(row);
	} catch (error) {
		return handleError(res, error);
	}
}

export async function acceptPartnerRequest(req, res) {
	return handleStatusAction(req, res, "accept");
}

export async function rejectPartnerRequest(req, res) {
	return handleStatusAction(req, res, "reject");
}

export async function cancelPartnerRequest(req, res) {
	return handleStatusAction(req, res, "cancel");
}

export async function deletePartnerConnection(req, res) {
	try {
		const row = await removePartnerConnection(req.user, req.params.connectionId);
		return res.json({ connection: row });
	} catch (error) {
		return handleError(res, error);
	}
}
