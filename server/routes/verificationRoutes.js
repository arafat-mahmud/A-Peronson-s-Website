import { Router } from "express";
import {
	adminApprove,
	adminQueue,
	adminReject,
	adminRevokeExpired,
	getMyVerification,
	renewMyVerification,
	submitMyVerification,
} from "../controllers/verificationController.js";
import { requireAdminSecurity } from "../middleware/adminSecurity.js";
import { allowRoles, requireAuth } from "../middleware/auth.js";

const router = Router();

router.get("/me", requireAuth, getMyVerification);
router.post(
	"/me",
	requireAuth,
	allowRoles("buyer", "factory", "buying_house"),
	submitMyVerification,
);
router.post(
	"/renew",
	requireAuth,
	allowRoles("buyer", "factory", "buying_house"),
	renewMyVerification,
);
router.get("/admin/queue", requireAuth, requireAdminSecurity, adminQueue);
router.post("/admin/:userId/approve", requireAuth, requireAdminSecurity, adminApprove);
router.post("/admin/:userId/reject", requireAuth, requireAdminSecurity, adminReject);
router.post("/admin/revoke-expired", requireAuth, requireAdminSecurity, adminRevokeExpired);

export default router;
