import { Router } from "express";
import {
	acceptPartnerRequest,
	cancelPartnerRequest,
	createPartnerRequest,
	deletePartnerConnection,
	listIncomingPartnerRequests,
	listPartnerNetwork,
	rejectPartnerRequest,
} from "../controllers/partnerNetworkController.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.get("/", requireAuth, listPartnerNetwork);
router.get("/requests/incoming", requireAuth, listIncomingPartnerRequests);
router.post("/requests", requireAuth, createPartnerRequest);
router.post("/requests/:requestId/accept", requireAuth, acceptPartnerRequest);
router.post("/requests/:requestId/reject", requireAuth, rejectPartnerRequest);
router.post("/requests/:requestId/cancel", requireAuth, cancelPartnerRequest);
router.delete("/:connectionId", requireAuth, deletePartnerConnection);

export default router;
