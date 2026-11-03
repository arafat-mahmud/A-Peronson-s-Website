import { Router } from "express";
import {
	createAction,
	createComment,
	createReport,
	createShare,
	getEntityInteractions,
} from "../controllers/socialController.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.post("/actions", requireAuth, createAction);
router.get("/:entityType/:entityId", requireAuth, getEntityInteractions);
router.post("/:entityType/:entityId/comment", requireAuth, createComment);
router.post("/:entityType/:entityId/share", requireAuth, createShare);
router.post("/:entityType/:entityId/report", requireAuth, createReport);

export default router;
