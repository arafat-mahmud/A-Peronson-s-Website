import { Router } from "express";
import { getLinkPreviewController } from "../controllers/linkPreviewController.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.get("/preview", requireAuth, getLinkPreviewController);
export default router;
