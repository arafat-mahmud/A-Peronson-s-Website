import { Router } from "express";
import {
	getPaymentProofs,
	patchPaymentProof,
	postPaymentProof,
} from "../controllers/paymentProofController.js";
import { allowRoles, requireAuth } from "../middleware/auth.js";

const router = Router();

router.get(
	"/",
	requireAuth,
	allowRoles("buyer", "factory", "buying_house", "admin", "owner", "agent"),
	getPaymentProofs,
);
router.post(
	"/",
	requireAuth,
	allowRoles("buyer", "factory", "buying_house", "admin", "owner", "agent"),
	postPaymentProof,
);
router.patch(
	"/:proofId",
	requireAuth,
	allowRoles("factory", "buying_house", "admin", "owner"),
	patchPaymentProof,
);

export default router;
