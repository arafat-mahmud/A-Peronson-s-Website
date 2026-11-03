import { Router } from "express";
import {
	createContentReportController,
	createProductAppealReportController,
	createSystemReportController,
} from "../controllers/reportController.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.post("/system", requireAuth, createSystemReportController);
router.post("/product-appeal", requireAuth, createProductAppealReportController);
router.post("/content", requireAuth, createContentReportController);

export default router;
