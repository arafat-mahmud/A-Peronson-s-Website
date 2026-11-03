import {
	getProfileOverview,
	getProfilePartnerNetworkSummary,
	getProfileProductsPage,
	getProfileRequestsPage,
} from "../services/profileService.js";

function parsePaging(query) {
	const cursor = Number.isFinite(Number(query?.cursor))
		? Math.max(0, Math.floor(Number(query.cursor)))
		: 0;
	const limitRaw = Number.isFinite(Number(query?.limit)) ? Math.floor(Number(query.limit)) : 12;
	const limit = Math.min(50, Math.max(1, limitRaw));
	return { cursor, limit };
}

export async function getProfile(req, res) {
	const data = await getProfileOverview(req.user.id, req.params.userId);
	if (data === "not_found") {
		return res.status(404).json({ error: "User not found" });
	}
	return res.json(data);
}

export async function getProfileRequests(req, res) {
	const { cursor, limit } = parsePaging(req.query);
	const data = await getProfileRequestsPage(req.user.id, req.params.userId, {
		cursor,
		limit,
	});
	if (data === "not_found") {
		return res.status(404).json({ error: "User not found" });
	}
	if (data === "invalid_role") {
		return res.status(400).json({ error: "Requests only available for buyer profiles" });
	}
	return res.json(data);
}

export async function getProfileProducts(req, res) {
	const { cursor, limit } = parsePaging(req.query);
	const data = await getProfileProductsPage(req.user.id, req.params.userId, {
		cursor,
		limit,
	});
	if (data === "not_found") {
		return res.status(404).json({ error: "User not found" });
	}
	if (data === "invalid_role") {
		return res.status(400).json({
			error: "Products only available for factory / buying house profiles",
		});
	}
	return res.json(data);
}

export async function getProfilePartnerNetwork(req, res) {
	const data = await getProfilePartnerNetworkSummary(req.user.id, req.params.userId);
	if (data === "not_found") {
		return res.status(404).json({ error: "User not found" });
	}
	if (data === "invalid_role") {
		return res.status(400).json({
			error: "Partner network only available for buying house profiles",
		});
	}
	return res.json(data);
}
