import { Router } from "express";
import {
	createPresetController,
	deletePresetController,
	getPresetController,
	listPresetsController,
	updatePresetController,
} from "../controllers/presetsController.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.get("/", requireAuth, listPresetsController);
router.post("/", requireAuth, createPresetController);
router.get("/:id", requireAuth, getPresetController);
router.patch("/:id", requireAuth, updatePresetController);
router.delete("/:id", requireAuth, deletePresetController);

export default router;
