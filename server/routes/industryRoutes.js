import { Router } from "express";
import { getIndustryAutoReply, getIndustryPage } from "../controllers/industryController.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.get("/:slug", requireAuth, getIndustryPage);
router.post("/:slug/auto-reply", requireAuth, getIndustryAutoReply);

export default router;
