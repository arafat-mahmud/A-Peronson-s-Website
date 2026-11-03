import { Router } from "express";
import {
	createJourneyEvent,
	getJourney,
	getJourneyByContext,
	rollbackJourney,
} from "../controllers/dealJourneyController.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.get("/context", requireAuth, getJourneyByContext);
router.get("/:journeyId", requireAuth, getJourney);
router.post("/events", requireAuth, createJourneyEvent);
router.post("/:journeyId/rollback", requireAuth, rollbackJourney);

export default router;
