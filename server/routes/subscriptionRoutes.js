import { Router } from "express";
import {
	adminSetUserSubscription,
	getMyRemainingDays,
	getMyVerificationPricing,
	getMySubscription,
	markMyVerificationExpiringSoon,
	renewMyPremiumMonthly,
	updateMySubscription,
} from "../controllers/subscriptionController.js";
import { requireAdminSecurity } from "../middleware/adminSecurity.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.get("/me", requireAuth, getMySubscription);
router.post("/me", requireAuth, updateMySubscription);
router.post("/me/renew-monthly", requireAuth, renewMyPremiumMonthly);
router.get("/me/remaining-days", requireAuth, getMyRemainingDays);
router.get("/me/verification-pricing", requireAuth, getMyVerificationPricing);
router.post("/me/verification/mark-expiring-soon", requireAuth, markMyVerificationExpiringSoon);
router.post("/admin/:userId", requireAuth, requireAdminSecurity, adminSetUserSubscription);

export default router;
