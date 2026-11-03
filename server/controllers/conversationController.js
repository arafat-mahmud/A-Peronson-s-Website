import {
	claimConversation,
	grantConversationAccess,
	requestConversationAccess,
	transferConversation,
} from "../services/conversationLockService.js";

export async function claim(req, res) {
	const result = await claimConversation(req.params.requestId, req.user);
	if (result.status === "locked") {
		return res.status(409).json(result);
	}
	return res.json(result);
}

export async function grant(req, res) {
	const targetId = req.body?.target_user_id || req.body?.target_agent_id;
	const result = await grantConversationAccess(req.params.requestId, req.user, targetId);
	if (result === "invalid_target") {
		return res.status(400).json({ error: "target_user_id is required" });
	}
	if (result === "forbidden") {
		return res.status(403).json({ error: "Forbidden" });
	}
	if (!result) {
		return res.status(404).json({ error: "Lock not found" });
	}
	return res.json(result);
}

export async function requestAccess(req, res) {
	const result = await requestConversationAccess(req.params.requestId, req.user);
	if (!result) {
		return res.status(404).json({ error: "Conversation not found" });
	}
	return res.json(result);
}

export async function transfer(req, res) {
	const targetId = req.body?.target_user_id || req.body?.target_agent_id;
	const result = await transferConversation(req.params.requestId, req.user, targetId);
	if (result === "invalid_target") {
		return res.status(400).json({ error: "target_user_id is required" });
	}
	if (result === "forbidden") {
		return res.status(403).json({ error: "Forbidden" });
	}
	if (!result) {
		return res.status(404).json({ error: "Lock not found" });
	}
	return res.json(result);
}
