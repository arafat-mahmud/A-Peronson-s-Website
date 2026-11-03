import { Router } from "express";
import {
	createSearchAlert,
	deleteSearchAlert,
	getSearchAlerts,
} from "../controllers/notificationController.js";
import {
	batchSearch,
	batchSearchCSV,
	exportSearchResults,
	searchAnalytics,
	searchHistoryCreate,
	searchHistoryList,
	searchSuggestions,
	spellingSuggestions,
	trendingSearches,
	uploadSearchImage,
} from "../controllers/searchController.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.post("/alerts", requireAuth, createSearchAlert);
router.get("/alerts", requireAuth, getSearchAlerts);
router.delete("/alerts/:alertId", requireAuth, deleteSearchAlert);
router.post("/image", requireAuth, uploadSearchImage);
router.get("/trending", requireAuth, trendingSearches);
router.get("/suggestions", requireAuth, searchSuggestions);
router.get("/spelling", spellingSuggestions);
router.post("/history", requireAuth, searchHistoryCreate);
router.get("/history", requireAuth, searchHistoryList);
router.post("/batch", requireAuth, batchSearch);
router.post("/batch/csv", requireAuth, batchSearchCSV);
router.post("/export", requireAuth, exportSearchResults);
router.get("/analytics", requireAuth, searchAnalytics);

export default router;
