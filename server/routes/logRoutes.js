import { Router } from "express";
import { postLog } from "../controllers/logController.js";
import { optionalAuth } from "../middleware/auth.js";
import { generalLimiter } from "../middleware/rateLimiter.js";

const router = Router();

// Frontend log ingestion:
// - Accepts `{ level, message, user }` or `{ batch: [...] }` and emits into the log hub
//   where it appears as `frontend:<pubip>:<user>:<message>` in the live stream.
// - `optionalAuth` so anonymous visitors can still report logs.
router.post("/", generalLimiter, optionalAuth, postLog);

export default router;
