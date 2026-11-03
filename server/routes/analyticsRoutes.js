import { Router } from "express";
import {
	analyticsCompany,
	analyticsCoreMetrics,
	analyticsDashboard,
	analyticsPlatformAdmin,
	analyticsPlatformOverview,
	analyticsPlatformSegment,
	analyticsPlatformSummary,
	analyticsPlatformTrends,
	analyticsPremium,
	analyticsSummary,
	analyticsViewers,
} from "../controllers/analyticsController.js";
import { allowRoles, requireAuth } from "../middleware/auth.js";

const router = Router();

router.get(
	"/summary",
	requireAuth,
	allowRoles("owner", "admin", "buying_house", "factory", "buyer", "agent"),
	analyticsSummary,
);
router.get(
	"/core-metrics",
	requireAuth,
	allowRoles("owner", "admin", "buying_house", "factory"),
	analyticsCoreMetrics,
);
router.get(
	"/dashboard",
	requireAuth,
	allowRoles("owner", "admin", "buying_house", "factory", "buyer", "agent"),
	analyticsDashboard,
);
router.get(
	"/company",
	requireAuth,
	allowRoles("owner", "admin", "buying_house", "factory", "agent"),
	analyticsCompany,
);
router.get(
	"/platform/overview",
	requireAuth,
	allowRoles("owner", "admin", "buying_house", "factory", "buyer", "agent"),
	analyticsPlatformOverview,
);
router.get(
	"/platform/trends",
	requireAuth,
	allowRoles("owner", "admin", "buying_house", "factory", "buyer", "agent"),
	analyticsPlatformTrends,
);
router.get(
	"/platform/summary",
	requireAuth,
	allowRoles("owner", "admin", "buying_house", "factory", "buyer", "agent"),
	analyticsPlatformSummary,
);
router.get(
	"/platform/segment",
	requireAuth,
	allowRoles("owner", "admin", "buying_house", "factory", "buyer", "agent"),
	analyticsPlatformSegment,
);
router.get("/platform/admin", requireAuth, allowRoles("owner", "admin"), analyticsPlatformAdmin);
router.get("/platform", requireAuth, allowRoles("owner", "admin"), analyticsPlatformAdmin);
router.get(
	"/premium",
	requireAuth,
	allowRoles("owner", "admin", "buyer", "factory", "buying_house", "agent"),
	analyticsPremium,
);
router.get(
	"/viewers",
	requireAuth,
	allowRoles("owner", "admin", "buying_house", "factory", "agent"),
	analyticsViewers,
);

export default router;
