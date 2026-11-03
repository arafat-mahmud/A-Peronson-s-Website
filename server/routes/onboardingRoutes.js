import { Router } from "express";
import { submitOnboarding } from "../controllers/onboardingController.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.post("/", requireAuth, submitOnboarding);
export default router;
