import {
	getChatbotProfileSummary,
	getChatbotSettings,
	maybeGenerateBotReply,
	updateChatbotSettings,
} from "../services/chatbotService.js";
import { ensureEntitlement } from "../services/entitlementService.js";
import { handleControllerError } from "../utils/permissions.js";

export async function getChatbotProfile(req, res) {
	const summary = await getChatbotProfileSummary(req.params.userId);
	if (!summary) {
		return res.status(404).json({ error: "User not found" });
	}
	return res.json({ ok: true, profile: summary });
}

export async function replyWithChatbot(req, res) {
	const match_id = req.body?.match_id || req.body?.threadId || req.body?.thread_id || "";
	const message = req.body?.message || req.body?.text || "";
	const result = await maybeGenerateBotReply({
		match_id,
		sender_id: req.user?.id,
		message,
	});
	return res.json({ ok: true, ...result });
}

export async function getChatbotSettingsController(req, res) {
	try {
		await ensureEntitlement(
			req.user,
			"ai_auto_reply_customization",
			"Premium plan required for AI auto-reply customization.",
		);
		const settings = await getChatbotSettings(req.user?.id);
		if (!settings) {
			return res.status(404).json({ error: "User not found" });
		}
		return res.json({ ok: true, settings });
	} catch (err) {
		return handleControllerError(res, err);
	}
}

export async function updateChatbotSettingsController(req, res) {
	try {
		await ensureEntitlement(
			req.user,
			"ai_auto_reply_customization",
			"Premium plan required for AI auto-reply customization.",
		);
		const settings = await updateChatbotSettings(req.user?.id, req.body || {});
		if (!settings) {
			return res.status(404).json({ error: "User not found" });
		}
		return res.json({ ok: true, settings });
	} catch (err) {
		return handleControllerError(res, err);
	}
}
