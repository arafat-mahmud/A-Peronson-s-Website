import { Router } from "express";
import {
	askAssistant,
	askAssistantPublic,
	deleteAssistantRule,
	deleteSession,
	getAssistantConfigHandler,
	getAssistantRules,
	getConversationSummary,
	getNegotiationHelper,
	getSessionMessages,
	postAssistantRule,
	postExtractRequirement,
	postGenerateFirstResponse,
	postValidateResponse,
	putAssistantConfigHandler,
	putAssistantRules,
} from "../controllers/assistantController.js";
import {
	createKnowledgeHandler,
	deleteKnowledgeHandler,
	listKnowledgeHandler,
	updateKnowledgeHandler,
} from "../controllers/assistantKnowledgeController.js";
import { allowRoles, requireAuth } from "../middleware/auth.js";

const router = Router();

router.post("/ask", requireAuth, askAssistant);
// The "public" assistant is still behind requireAuth. It used to be open to
// anybody, and an unauthenticated caller reached a guest session on a
// write-capable agent: one session per call, with no owner and no
// restriction. The assistant answers platform questions, and answering them
// does not need an anonymous caller.
router.post("/ask-public", requireAuth, askAssistantPublic);
router.get("/session-messages", requireAuth, getSessionMessages);
router.get("/knowledge", requireAuth, listKnowledgeHandler);
router.post("/knowledge", requireAuth, allowRoles("owner", "admin"), createKnowledgeHandler);
router.patch("/knowledge/:id", requireAuth, allowRoles("owner", "admin"), updateKnowledgeHandler);
router.delete("/knowledge/:id", requireAuth, allowRoles("owner", "admin"), deleteKnowledgeHandler);
router.delete("/session", requireAuth, deleteSession);
router.post("/extract-requirement", requireAuth, postExtractRequirement);
router.post("/generate-first-response", requireAuth, postGenerateFirstResponse);
router.post("/validate-response", requireAuth, postValidateResponse);
router.post("/conversation-summary", requireAuth, getConversationSummary);
router.post("/negotiation", requireAuth, getNegotiationHelper);

router.get("/rules", requireAuth, allowRoles("owner", "admin"), getAssistantRules);
router.put("/rules", requireAuth, allowRoles("owner", "admin"), putAssistantRules);
router.post("/rules", requireAuth, allowRoles("owner", "admin"), postAssistantRule);
router.delete(
	"/rules/:type/:ruleId",
	requireAuth,
	allowRoles("owner", "admin"),
	deleteAssistantRule,
);

router.get("/config", requireAuth, allowRoles("owner", "admin"), getAssistantConfigHandler);
router.put("/config", requireAuth, allowRoles("owner", "admin"), putAssistantConfigHandler);

export default router;
