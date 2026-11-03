import { Router } from "express";
import {
	getChatbotProfile,
	getChatbotSettingsController,
	replyWithChatbot,
	updateChatbotSettingsController,
} from "../controllers/chatbotController.js";
import { allowRoles, requireAuth } from "../middleware/auth.js";

const router = Router();

// Public summary for UI (still requires auth because it reveals product/capability hints).
router.get("/profile/:userId", requireAuth, getChatbotProfile);

// Generate an optional bot reply for a chat thread.
router.post("/reply", requireAuth, replyWithChatbot);
// Chatbot control plane — org managers only (buyers/agents must not change these).
router.get(
	"/settings",
	requireAuth,
	allowRoles("owner", "admin", "buying_house", "factory"),
	getChatbotSettingsController,
);
router.post(
	"/settings",
	requireAuth,
	allowRoles("owner", "admin", "buying_house", "factory"),
	updateChatbotSettingsController,
);

export default router;
