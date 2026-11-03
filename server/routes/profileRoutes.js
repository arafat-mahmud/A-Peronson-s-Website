import { Router } from "express";
import {
	getProfile,
	getProfilePartnerNetwork,
	getProfileProducts,
	getProfileRequests,
} from "../controllers/profileController.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.get("/:userId", requireAuth, getProfile);
router.get("/:userId/requests", requireAuth, getProfileRequests);
router.get("/:userId/products", requireAuth, getProfileProducts);
router.get("/:userId/partner-network", requireAuth, getProfilePartnerNetwork);

export default router;
