import { Router } from "express";
import {
	infraAction,
	infraOverview,
	infraProcesses,
	infraServices,
	infraState,
	infraStorage,
} from "../controllers/infraController.js";
import { adminAuditLogger } from "../middleware/adminAudit.js";
import { requireAdminSecurity } from "../middleware/adminSecurity.js";
import { requireAdminStepUp } from "../middleware/adminStepUp.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.get("/overview", requireAuth, requireAdminSecurity, adminAuditLogger(), infraOverview);
router.get("/processes", requireAuth, requireAdminSecurity, adminAuditLogger(), infraProcesses);
router.get("/services", requireAuth, requireAdminSecurity, adminAuditLogger(), infraServices);
router.get("/storage", requireAuth, requireAdminSecurity, adminAuditLogger(), infraStorage);
router.get("/state", requireAuth, requireAdminSecurity, adminAuditLogger(), infraState);
router.post(
	"/actions",
	requireAuth,
	requireAdminSecurity,
	requireAdminStepUp,
	adminAuditLogger({
		actionResolver: (req) => String(req.body?.action || "infra.action"),
	}),
	infraAction,
);

export default router;
