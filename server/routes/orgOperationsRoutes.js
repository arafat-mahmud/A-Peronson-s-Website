import { Router } from "express";
import {
	getLegacyOperationsPolicies,
	getOperationsEscalations,
	getOperationsPolicies,
	getOperationsQueue,
	getOperationsWorkload,
	postOperationsEscalate,
	postOperationsRebalance,
	postResolveEscalation,
	putLegacyOperationsPolicies,
	putOperationsPolicies,
} from "../controllers/orgOperationsController.js";
import { allowRoles, requireAuth } from "../middleware/auth.js";

const router = Router();

router.use(requireAuth, allowRoles("owner", "admin", "buying_house", "factory", "agent"));

router.get("/policies", getOperationsPolicies);
router.put("/policies", putOperationsPolicies);
router.get("/legacy-policies", getLegacyOperationsPolicies);
router.put("/legacy-policies", putLegacyOperationsPolicies);
router.get("/queue", getOperationsQueue);
router.post("/rebalance", postOperationsRebalance);
router.post("/escalate/:leadId", postOperationsEscalate);
router.get("/escalations", getOperationsEscalations);
router.post("/escalations/:leadId/resolve", postResolveEscalation);
router.get("/workload", getOperationsWorkload);

export default router;
