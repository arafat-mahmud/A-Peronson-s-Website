import { Router } from "express";
import {
	createSupportReport,
	createSupportTicketController,
	getSupportCategories,
	listMySupportTicketsController,
	listSupportTicketMessagesController,
	postSupportTicketMessageController,
} from "../controllers/supportController.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.get("/categories", requireAuth, getSupportCategories);
router.post("/reports", requireAuth, createSupportReport);
router.get("/tickets", requireAuth, listMySupportTicketsController);
router.post("/tickets", requireAuth, createSupportTicketController);
router.get("/tickets/:ticketId/messages", requireAuth, listSupportTicketMessagesController);
router.post("/tickets/:ticketId/messages", requireAuth, postSupportTicketMessageController);

export default router;
