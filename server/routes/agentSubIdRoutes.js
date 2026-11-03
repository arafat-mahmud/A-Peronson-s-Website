import { Router } from "express";
import {
	createAgentSubIdController,
	deleteAgentSubIdController,
	getAgentSubIdController,
	listAgentSubIdsController,
} from "../controllers/agentSubIdController.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.get("/", requireAuth, listAgentSubIdsController);
router.post("/", requireAuth, createAgentSubIdController);
router.get("/:id", requireAuth, getAgentSubIdController);
router.delete("/:id", requireAuth, deleteAgentSubIdController);

export default router;
