import { Router } from "express";
import {
	approveReplyDraft,
	draftReply,
	extractRequirements,
	sendApprovedReply,
} from "../controllers/aiController.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.post("/requirements/extract", requireAuth, extractRequirements);
router.post("/reply/draft", requireAuth, draftReply);
router.post("/reply/approve", requireAuth, approveReplyDraft);
router.post("/reply/send", requireAuth, sendApprovedReply);

export default router;
