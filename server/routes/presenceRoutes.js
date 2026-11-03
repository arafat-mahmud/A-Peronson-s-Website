import { Router } from "express";
import { getPresence } from "../controllers/presenceController.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.post("/", requireAuth, getPresence);

export default router;
