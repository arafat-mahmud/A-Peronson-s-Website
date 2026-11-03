import { Router } from "express";
import {
	createJourney,
	getJourney,
	getJourneyByMatch,
	transitionJourney,
} from "../controllers/workflowLifecycleController.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.post("/journeys", requireAuth, createJourney);
router.post("/journeys/:id/transition", requireAuth, transitionJourney);
router.get("/journeys/:id", requireAuth, getJourney);
router.get("/journeys/by-match/:matchId", requireAuth, getJourneyByMatch);

export default router;
