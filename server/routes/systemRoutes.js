import { Router } from "express";
import {
	systemAbout,
	systemHome,
	systemMeta,
	systemPolicies,
	systemPricing,
} from "../controllers/systemController.js";

const router = Router();

router.get("/meta", systemMeta);
router.get("/home", systemHome);
router.get("/pricing", systemPricing);
router.get("/about", systemAbout);
router.get("/policies", systemPolicies);

export default router;
