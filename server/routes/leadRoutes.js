import { Router } from "express";
import {
	getLead,
	getLeadForMatch,
	getLeads,
	patchLead,
	postLeadNote,
	postLeadReminder,
} from "../controllers/leadController.js";
import { allowRoles, requireAuth } from "../middleware/auth.js";

const router = Router();

// CRM tools are for organization accounts (buying house / factory) + their agents.
router.get(
	"/",
	requireAuth,
	allowRoles("owner", "admin", "buying_house", "factory", "agent"),
	getLeads,
);
router.get(
	"/by-match/:matchId",
	requireAuth,
	allowRoles("owner", "admin", "buying_house", "factory", "agent"),
	getLeadForMatch,
);
router.get(
	"/:leadId",
	requireAuth,
	allowRoles("owner", "admin", "buying_house", "factory", "agent"),
	getLead,
);
router.patch(
	"/:leadId",
	requireAuth,
	allowRoles("owner", "admin", "buying_house", "factory", "agent"),
	patchLead,
);
router.post(
	"/:leadId/notes",
	requireAuth,
	allowRoles("owner", "admin", "buying_house", "factory", "agent"),
	postLeadNote,
);
router.post(
	"/:leadId/reminders",
	requireAuth,
	allowRoles("owner", "admin", "buying_house", "factory", "agent"),
	postLeadReminder,
);

export default router;
