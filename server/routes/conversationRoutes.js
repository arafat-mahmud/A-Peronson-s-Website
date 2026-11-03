import { Router } from "express";
import { claim, grant, requestAccess, transfer } from "../controllers/conversationController.js";
import { allowRoles, requireAuth } from "../middleware/auth.js";

const router = Router();
router.post("/:requestId/claim", requireAuth, allowRoles("buying_house", "admin", "agent"), claim);
router.post(
	"/:requestId/grant",
	requireAuth,
	allowRoles("buying_house", "factory", "admin", "owner", "agent"),
	grant,
);
router.post(
	"/:requestId/request-access",
	requireAuth,
	allowRoles("buying_house", "factory", "admin", "owner", "agent"),
	requestAccess,
);
router.post(
	"/:requestId/transfer",
	requireAuth,
	allowRoles("buying_house", "factory", "admin", "owner", "agent"),
	transfer,
);
export default router;
