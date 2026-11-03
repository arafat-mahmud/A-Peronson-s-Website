import { Router } from "express";
import {
	networkAction,
	networkInventory,
	networkOverview,
} from "../controllers/networkController.js";
import { adminAuditLogger } from "../middleware/adminAudit.js";
import { requireAdminSecurity } from "../middleware/adminSecurity.js";
import { requireAdminStepUp } from "../middleware/adminStepUp.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.get("/overview", requireAuth, requireAdminSecurity, adminAuditLogger(), networkOverview);
router.get("/inventory", requireAuth, requireAdminSecurity, adminAuditLogger(), networkInventory);
router.post(
	"/actions",
	requireAuth,
	requireAdminSecurity,
	requireAdminStepUp,
	adminAuditLogger({
		actionResolver: (req) => String(req.body?.action || "network.action"),
	}),
	networkAction,
);

export default router;
