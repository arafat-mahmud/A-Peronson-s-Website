import { Router } from "express";
import { createCoupon, listCoupons } from "../controllers/couponController.js";
import { requireAdminSecurity } from "../middleware/adminSecurity.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.get("/", requireAuth, requireAdminSecurity, listCoupons);
router.post("/", requireAuth, requireAdminSecurity, createCoupon);

export default router;
