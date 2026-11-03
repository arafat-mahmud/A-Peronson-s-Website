import { Router } from "express";
import { postEvent } from "../controllers/eventController.js";
import { optionalAuth } from "../middleware/auth.js";

const router = Router();

// Public+protected event sink:
// - Anonymous visitors can send events using `client_id` (generated client-side).
// - Authenticated users will be tracked by `req.user.id`.
router.post("/", optionalAuth, postEvent);

export default router;
