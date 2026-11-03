import { Router } from "express";
import {
	createJoinRequestController,
	disputeDuplicateController,
	getJoinRequestController,
	listDuplicateDisputesController,
	listMyJoinRequestsController,
	resolveDuplicateDisputeController,
	respondToJoinRequestController,
} from "../controllers/joinRequestController.js";
import { allowRoles, requireAuth } from "../middleware/auth.js";

const router = Router();

router.get("/", requireAuth, listMyJoinRequestsController);
router.post(
	"/",
	requireAuth,
	allowRoles("buyer", "factory", "buying_house"),
	createJoinRequestController,
);
router.get("/:requestId", requireAuth, getJoinRequestController);
router.post("/:requestId/respond", requireAuth, respondToJoinRequestController);

router.post("/dispute", requireAuth, disputeDuplicateController);
router.get("/disputes/all", requireAuth, listDuplicateDisputesController);
router.post("/disputes/:disputeId/resolve", requireAuth, resolveDuplicateDisputeController);

export default router;
