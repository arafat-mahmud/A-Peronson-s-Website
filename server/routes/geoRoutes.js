import { Router } from "express";
import { geoLocate, geoSearch } from "../controllers/geoController.js";

const router = Router();

router.get("/locate", geoLocate);
router.get("/search", geoSearch);

export default router;
