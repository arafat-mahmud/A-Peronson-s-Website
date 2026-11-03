import { Router } from "express";
import {
	createOrgMember,
	deactivateOrRemoveOrgMember,
	getMemberMetrics,
	getOrgMember,
	listOrgMembers,
	patchMemberPermissions,
	postMemberPasswordReset,
	putOrgMember,
} from "../controllers/memberController.js";
import { allowRoles, requireAuth } from "../middleware/auth.js";

const router = Router();

router.get(
	"/",
	requireAuth,
	allowRoles("owner", "admin", "buying_house", "factory"),
	listOrgMembers,
);
router.get(
	"/metrics",
	requireAuth,
	allowRoles("owner", "admin", "buying_house", "factory"),
	getMemberMetrics,
);
router.get(
	"/:memberId",
	requireAuth,
	allowRoles("owner", "admin", "buying_house", "factory"),
	getOrgMember,
);
router.post(
	"/",
	requireAuth,
	allowRoles("owner", "admin", "buying_house", "factory"),
	createOrgMember,
);
router.put(
	"/:memberId",
	requireAuth,
	allowRoles("owner", "admin", "buying_house", "factory"),
	putOrgMember,
);
router.patch(
	"/:memberId/permissions",
	requireAuth,
	allowRoles("owner", "admin", "buying_house", "factory"),
	patchMemberPermissions,
);
router.post(
	"/:memberId/reset-password",
	requireAuth,
	allowRoles("owner", "admin", "buying_house", "factory"),
	postMemberPasswordReset,
);
router.delete(
	"/:memberId",
	requireAuth,
	allowRoles("owner", "admin", "buying_house", "factory"),
	deactivateOrRemoveOrgMember,
);

export default router;
