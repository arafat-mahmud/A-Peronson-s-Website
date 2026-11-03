import { Router } from "express";
import { cancelBoostController, createBoost, getMyBoosts } from "../controllers/boostController.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.get("/me", requireAuth, getMyBoosts);
router.post("/", requireAuth, createBoost);
router.post("/:boostId/cancel", requireAuth, cancelBoostController);

export default router;
