import { Router } from "express";
import {
	completeMilestone,
	getFeedbackRequests,
	getProfileRatings,
	getProfileRatingsAggregate,
	getProfileRatingsBatch,
	getSearchRatings,
	submitRating,
} from "../controllers/ratingsController.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.get("/profiles/:profileKey", getProfileRatings);
router.get("/profiles/:profileKey/aggregate", getProfileRatingsAggregate);
router.get("/profiles", getProfileRatingsBatch);
router.get("/search", getSearchRatings);
router.get("/feedback-requests", requireAuth, getFeedbackRequests);
router.post("/profiles/:profileKey", requireAuth, submitRating);
router.post("/milestones", requireAuth, completeMilestone);
export default router;
