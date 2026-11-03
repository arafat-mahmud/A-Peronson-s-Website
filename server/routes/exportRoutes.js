import { Router } from "express";
import { exportAnalytics } from "../controllers/exportController.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.post("/analytics", requireAuth, exportAnalytics);

export default router;
