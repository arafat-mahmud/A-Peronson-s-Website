import { Router } from "express";
import { adminCatalogOverview } from "../controllers/adminCatalogController.js";
import {
	approveDocument,
	approveVideo,
	assignAccountManager,
	assignSupportTicket,
	deleteEsignFailure,
	listContentReportsAudit,
	listEsignFailures,
	listProductAppealReportsAudit,
	listReportsAudit,
	listSupportTicketsAdminController,
	listSystemReportsAudit,
	pendingDocuments,
	pendingVideos,
	reanalyzeDocument,
	rejectDocument,
	rejectVideo,
	resolveReportAudit,
	retryEsignFailure,
	subscriptionsAudit,
	updateSupportTicket,
	usersAudit,
	verificationAudit,
	violationsAudit,
} from "../controllers/adminController.js";
import {
	adminAction as adminActionController,
	adminAuditLog as adminAuditLogController,
	adminDataExport as adminDataExportController,
	adminEmailExport as adminEmailExportController,
	adminGetConfig as adminGetConfigController,
	adminMasterOverview as adminMasterOverviewController,
	adminUpdateConfig as adminUpdateConfigController,
} from "../controllers/adminMasterController.js";
import {
	exportEmailSegmentAdmin,
	listAiAuditLogs,
	listCallsAdmin,
	listContractsAdmin,
	listCouponReport,
	listDisputesAdmin,
	listFraudReviewAdmin,
	listInvoicesAdmin,
	listMatchesAdmin,
	listOrgOwnershipAdmin,
	listPartnerRequestsAdmin,
	listPaymentProofsAdmin,
	listPayoutsAdmin,
	listRefundsAdmin,
	listRequirementsAdmin,
	listSearchAlertsAdmin,
	listSearchUsageAdmin,
	listSignupsAdmin,
	listStrikeHistoryAdmin,
	listSubscriptionHistoryAdmin,
	listWalletHistoryAdmin,
	listWalletLedgerAdmin,
} from "../controllers/adminOpsController.js";
import { cmsActionController, getCmsStateController } from "../controllers/cmsController.js";
import {
	applyGovernanceEnforcementController,
	createGovernancePolicyVersionController,
	evaluateTrustController,
	fileGovernanceAppealController,
	generateGovernanceMonthlyReportController,
	listGovernanceEnforcementHistoryController,
	listGovernancePoliciesController,
	listGovernanceTemplateController,
	resolveGovernanceAppealController,
	saveGovernanceTemplateController,
	simulateGovernancePolicyController,
	trustSignalsController,
	upsertGovernancePolicyController,
} from "../controllers/governanceController.js";
import {
	integrationActionController,
	integrationEmailStatusController,
	integrationOpenSearchStatusController,
	integrationStatusController,
} from "../controllers/integrationController.js";
import {
	listModerationProducts,
	updateModerationProduct,
} from "../controllers/moderationController.js";
import {
	approveOrderCertificationAdmin,
	attachOrderCertificationEvidenceAdmin,
	listOrderCertificationsAdmin,
	revokeOrderCertificationAdmin,
} from "../controllers/orderCertificationAdminController.js";
import {
	getSecurityStateController,
	securityActionController,
} from "../controllers/securityController.js";
import {
	getServerAdminStateController,
	serverAdminActionController,
} from "../controllers/serverAdminController.js";
import { adminAuditLogger } from "../middleware/adminAudit.js";
import { requireDualExportApproval } from "../middleware/adminDualConfirm.js";
import { requireAdminSecurity } from "../middleware/adminSecurity.js";
import { requireAdminStepUp } from "../middleware/adminStepUp.js";
import { requireAuth } from "../middleware/auth.js";
import { adminLimiter } from "../middleware/rateLimiter.js";
import { appendCaseMessage, getCaseWithMessages, listCasesAdmin } from "../services/caseService.js";
import prisma from "../utils/prisma.js";
import { sanitizeString } from "../utils/validators.js";

const router = Router();

router.use(adminLimiter);

// ---------------------------------------------------------------------------
// Support investigation cases.
//
// The client-facing case API lives in server/routes/caseRoutes.js. These are
// the staff views of the SAME rows: an owner/admin reads a case, its
// conversation and its investigations. The guard chain is the one every other
// admin route in this file uses - the caller must be an authenticated
// owner/admin, and the request is written to the admin audit log.
// ---------------------------------------------------------------------------

/** The characters kept from a case id. */
const SUPPORT_CASE_ID_MAX = 120;

/** The characters kept from an escalation note. */
const SUPPORT_CASE_NOTE_MAX = 500;

/**
 * The investigation queue, loaded on demand.
 *
 * The specifier is kept out of the `import()` call on purpose: the queue
 * belongs to the investigation workstream and is not in every checkout, and a
 * static import of a missing module would take the whole admin router down.
 */
const INVESTIGATION_QUEUE_MODULE = "../services/investigationQueue.js";

/**
 * Lists every support case, most recently touched first.
 *
 * @param {Object} req
 * @param {Object} res
 */
async function listSupportCasesHandler(_req, res) {
	const cases = await listCasesAdmin();
	return res.json({ cases: Array.isArray(cases) ? cases : [] });
}

/**
 * One support case: the row, the conversation, and the investigations.
 *
 * The `case` key is the SupportCase row on its own - the messages are
 * returned next to it, not inside it, so a client can tell the row from its
 * conversation.
 *
 * @param {Object} req
 * @param {Object} res
 */
async function getSupportCaseHandler(req, res) {
	const caseId = sanitizeString(String(req.params.caseId || ""), SUPPORT_CASE_ID_MAX);
	if (!caseId) {
		return res.status(400).json({ error: "caseId is required" });
	}
	const found = await getCaseWithMessages(caseId);
	if (!found) {
		return res.status(404).json({ error: "Support case not found" });
	}
	const { messages, ...caseRow } = found;
	const investigations = await prisma.supportInvestigation.findMany({
		where: { case_id: caseId },
		orderBy: { created_at: "asc" },
	});
	return res.json({
		case: caseRow,
		messages: Array.isArray(messages) ? messages : [],
		investigations: Array.isArray(investigations) ? investigations : [],
	});
}

/**
 * Flags a case as escalated and records who did it in the conversation.
 *
 * The note is optional; the message is written either way, because an
 * escalation nobody can trace is not an escalation.
 *
 * @param {Object} req
 * @param {Object} res
 */
async function escalateSupportCaseHandler(req, res) {
	const caseId = sanitizeString(String(req.params.caseId || ""), SUPPORT_CASE_ID_MAX);
	if (!caseId) {
		return res.status(400).json({ error: "caseId is required" });
	}
	const existing = await prisma.supportCase.findUnique({ where: { id: caseId } });
	if (!existing) {
		return res.status(404).json({ error: "Support case not found" });
	}
	const note = sanitizeString(String(req.body?.reason || ""), SUPPORT_CASE_NOTE_MAX);
	const agent = sanitizeString(
		String(req.user?.name || req.user?.email || req.user?.id || "admin"),
		SUPPORT_CASE_ID_MAX,
	);
	const updated = await prisma.supportCase.update({
		where: { id: caseId },
		data: { escalated: true },
	});
	await appendCaseMessage({
		caseId,
		role: "admin",
		kind: "notice",
		content: note || "Escalated by an administrator.",
		agent,
	});
	return res.json({ ok: true, case: updated });
}

/**
 * Queues a fresh investigation for a case.
 *
 * The queue is looked up through the module namespace instead of a static
 * import: it belongs to the investigation workstream, and a checkout without
 * it must report "not available" rather than take the whole admin router down
 * with a failed import.
 *
 * The queue is BOUNDED, so it can refuse the work with a 429. A refusal is
 * not an error the admin can do anything about - it is "come back in a
 * minute" - and it must not leave the case claiming that an investigation is
 * running when none was started. So the case is put back the way it was
 * before the refusal, and the refusal is reported as the 429 it is.
 *
 * @param {Object} req
 * @param {Object} res
 */
async function rerunSupportCaseHandler(req, res) {
	const caseId = sanitizeString(String(req.params.caseId || ""), SUPPORT_CASE_ID_MAX);
	if (!caseId) {
		return res.status(400).json({ error: "caseId is required" });
	}
	const existing = await prisma.supportCase.findUnique({ where: { id: caseId } });
	if (!existing) {
		return res.status(404).json({ error: "Support case not found" });
	}
	const enqueue = await loadInvestigationEnqueuer();
	if (!enqueue) {
		return res.status(503).json({ error: "The investigation runtime is not available." });
	}
	// A re-run starts the case over. The queue only moves a case that is
	// `investigating`, so a case that already finished is put back into that
	// state before the new run is created.
	//
	// The previous run's DELIVERY status is cleared with it. A failed re-run
	// would otherwise leave the case reading "sent" next to a `failed`
	// status, and the admin console would show a report that was never
	// delivered as one that was.
	await prisma.supportCase.update({
		where: { id: caseId },
		data: { status: "investigating", report_status: null, report_delivered_at: null },
	});
	try {
		await enqueue(caseId);
	} catch (error) {
		// The run never started, so the case must not say that it did. It is
		// put back exactly the way it was - status, delivery status and
		// delivery timestamp.
		await restoreCaseAfterRefusal(caseId, existing);
		const status = Number(error?.status);
		if (status === 429) {
			return res.status(429).json({
				error: "The investigation queue is full - try again shortly.",
				code: "INVESTIGATION_QUEUE_FULL",
			});
		}
		throw error;
	}
	return res.json({ ok: true, case_id: caseId, queued: true });
}

/**
 * Put a case back the way it was, after the queue refused the run.
 *
 * A failure here must not hide the refusal that caused it, so it is
 * swallowed: the caller is already returning the refusal.
 *
 * @param {string} caseId
 * @param {Object} previous The case row as it was before the re-run.
 * @returns {Promise<boolean>}
 */
async function restoreCaseAfterRefusal(caseId, previous) {
	try {
		await prisma.supportCase.update({
			where: { id: caseId },
			data: {
				status: previous?.status ?? "collecting",
				report_status: previous?.report_status ?? null,
				report_delivered_at: previous?.report_delivered_at ?? null,
			},
		});
		return true;
	} catch {
		return false;
	}
}

/**
 * The investigation queue's enqueue function, or null when it is not there.
 *
 * @returns {Promise<Function|null>}
 */
async function loadInvestigationEnqueuer() {
	try {
		const queue = await import(INVESTIGATION_QUEUE_MODULE);
		return typeof queue.enqueueInvestigation === "function" ? queue.enqueueInvestigation : null;
	} catch {
		return null;
	}
}

router.get("/users", requireAuth, requireAdminSecurity, adminAuditLogger(), usersAudit);
router.get(
	"/verification",
	requireAuth,
	requireAdminSecurity,
	adminAuditLogger(),
	verificationAudit,
);
router.get(
	"/subscriptions",
	requireAuth,
	requireAdminSecurity,
	adminAuditLogger(),
	subscriptionsAudit,
);
router.get("/violations", requireAuth, requireAdminSecurity, adminAuditLogger(), violationsAudit);
router.get("/videos/pending", requireAuth, requireAdminSecurity, adminAuditLogger(), pendingVideos);
router.post(
	"/videos/:productId/approve",
	requireAuth,
	requireAdminSecurity,
	requireAdminStepUp,
	adminAuditLogger(),
	approveVideo,
);
router.post(
	"/videos/:productId/reject",
	requireAuth,
	requireAdminSecurity,
	requireAdminStepUp,
	adminAuditLogger(),
	rejectVideo,
);
router.get(
	"/media/pending",
	requireAuth,
	requireAdminSecurity,
	adminAuditLogger(),
	pendingDocuments,
);
router.post(
	"/media/:documentId/approve",
	requireAuth,
	requireAdminSecurity,
	requireAdminStepUp,
	adminAuditLogger(),
	approveDocument,
);
router.post(
	"/media/:documentId/reject",
	requireAuth,
	requireAdminSecurity,
	requireAdminStepUp,
	adminAuditLogger(),
	rejectDocument,
);
router.post(
	"/media/:documentId/reanalyze",
	requireAuth,
	requireAdminSecurity,
	requireAdminStepUp,
	adminAuditLogger(),
	reanalyzeDocument,
);
router.get("/reports", requireAuth, requireAdminSecurity, adminAuditLogger(), listReportsAudit);
router.get(
	"/reports/system",
	requireAuth,
	requireAdminSecurity,
	adminAuditLogger(),
	listSystemReportsAudit,
);
router.get(
	"/reports/product-appeals",
	requireAuth,
	requireAdminSecurity,
	adminAuditLogger(),
	listProductAppealReportsAudit,
);
router.get(
	"/reports/content",
	requireAuth,
	requireAdminSecurity,
	adminAuditLogger(),
	listContentReportsAudit,
);
router.post(
	"/reports/:reportId/resolve",
	requireAuth,
	requireAdminSecurity,
	requireAdminStepUp,
	adminAuditLogger(),
	resolveReportAudit,
);
router.get(
	"/moderation/products",
	requireAuth,
	requireAdminSecurity,
	adminAuditLogger(),
	listModerationProducts,
);
router.patch(
	"/moderation/products/:productId",
	requireAuth,
	requireAdminSecurity,
	requireAdminStepUp,
	adminAuditLogger(),
	updateModerationProduct,
);
router.get(
	"/support/tickets",
	requireAuth,
	requireAdminSecurity,
	adminAuditLogger(),
	listSupportTicketsAdminController,
);
router.post(
	"/support/assign",
	requireAuth,
	requireAdminSecurity,
	requireAdminStepUp,
	adminAuditLogger(),
	assignSupportTicket,
);
router.patch(
	"/support/:ticketId",
	requireAuth,
	requireAdminSecurity,
	requireAdminStepUp,
	adminAuditLogger(),
	updateSupportTicket,
);
router.get(
	"/support/cases",
	requireAuth,
	requireAdminSecurity,
	adminAuditLogger(),
	listSupportCasesHandler,
);
router.get(
	"/support/cases/:caseId",
	requireAuth,
	requireAdminSecurity,
	adminAuditLogger(),
	getSupportCaseHandler,
);
router.post(
	"/support/cases/:caseId/escalate",
	requireAuth,
	requireAdminSecurity,
	requireAdminStepUp,
	adminAuditLogger(),
	escalateSupportCaseHandler,
);
router.post(
	"/support/cases/:caseId/rerun",
	requireAuth,
	requireAdminSecurity,
	requireAdminStepUp,
	adminAuditLogger(),
	rerunSupportCaseHandler,
);
router.post(
	"/account-manager/assign",
	requireAuth,
	requireAdminSecurity,
	requireAdminStepUp,
	adminAuditLogger(),
	assignAccountManager,
);
router.get(
	"/order-certifications",
	requireAuth,
	requireAdminSecurity,
	adminAuditLogger(),
	listOrderCertificationsAdmin,
);
router.post(
	"/order-certifications/evidence",
	requireAuth,
	requireAdminSecurity,
	requireAdminStepUp,
	adminAuditLogger(),
	attachOrderCertificationEvidenceAdmin,
);
router.post(
	"/order-certifications/approve",
	requireAuth,
	requireAdminSecurity,
	requireAdminStepUp,
	adminAuditLogger(),
	approveOrderCertificationAdmin,
);
router.post(
	"/order-certifications/revoke",
	requireAuth,
	requireAdminSecurity,
	requireAdminStepUp,
	adminAuditLogger(),
	revokeOrderCertificationAdmin,
);
router.get("/contracts", requireAuth, requireAdminSecurity, adminAuditLogger(), listContractsAdmin);
router.get("/disputes", requireAuth, requireAdminSecurity, adminAuditLogger(), listDisputesAdmin);
router.get(
	"/partner-requests",
	requireAuth,
	requireAdminSecurity,
	adminAuditLogger(),
	listPartnerRequestsAdmin,
);
router.get("/calls", requireAuth, requireAdminSecurity, adminAuditLogger(), listCallsAdmin);
router.get(
	"/payment-proofs",
	requireAuth,
	requireAdminSecurity,
	adminAuditLogger(),
	listPaymentProofsAdmin,
);
router.get(
	"/wallet/history",
	requireAuth,
	requireAdminSecurity,
	adminAuditLogger(),
	listWalletHistoryAdmin,
);
router.get(
	"/wallet/ledger",
	requireAuth,
	requireAdminSecurity,
	adminAuditLogger(),
	listWalletLedgerAdmin,
);
router.get(
	"/search/alerts",
	requireAuth,
	requireAdminSecurity,
	adminAuditLogger(),
	listSearchAlertsAdmin,
);
router.get(
	"/search/usage",
	requireAuth,
	requireAdminSecurity,
	adminAuditLogger(),
	listSearchUsageAdmin,
);
router.get("/matches", requireAuth, requireAdminSecurity, adminAuditLogger(), listMatchesAdmin);
router.get(
	"/requirements",
	requireAuth,
	requireAdminSecurity,
	adminAuditLogger(),
	listRequirementsAdmin,
);
router.get(
	"/subscriptions/history",
	requireAuth,
	requireAdminSecurity,
	adminAuditLogger(),
	listSubscriptionHistoryAdmin,
);
router.get(
	"/coupons/report",
	requireAuth,
	requireAdminSecurity,
	adminAuditLogger(),
	listCouponReport,
);
router.get("/invoices", requireAuth, requireAdminSecurity, adminAuditLogger(), listInvoicesAdmin);
router.get("/payouts", requireAuth, requireAdminSecurity, adminAuditLogger(), listPayoutsAdmin);
router.get("/refunds", requireAuth, requireAdminSecurity, adminAuditLogger(), listRefundsAdmin);
router.get("/ai/audit", requireAuth, requireAdminSecurity, adminAuditLogger(), listAiAuditLogs);
router.get("/signups", requireAuth, requireAdminSecurity, adminAuditLogger(), listSignupsAdmin);
router.get(
	"/strikes",
	requireAuth,
	requireAdminSecurity,
	adminAuditLogger(),
	listStrikeHistoryAdmin,
);
router.get(
	"/fraud/verification",
	requireAuth,
	requireAdminSecurity,
	adminAuditLogger(),
	listFraudReviewAdmin,
);
router.get(
	"/orgs/ownership",
	requireAuth,
	requireAdminSecurity,
	adminAuditLogger(),
	listOrgOwnershipAdmin,
);
router.get("/catalog", requireAuth, requireAdminSecurity, adminAuditLogger(), adminCatalogOverview);
router.get(
	"/server-admin/state",
	requireAuth,
	requireAdminSecurity,
	adminAuditLogger(),
	getServerAdminStateController,
);
router.post(
	"/server-admin/actions",
	requireAuth,
	requireAdminSecurity,
	requireAdminStepUp,
	adminAuditLogger(),
	serverAdminActionController,
);
router.get(
	"/cms/state",
	requireAuth,
	requireAdminSecurity,
	adminAuditLogger(),
	getCmsStateController,
);
router.post(
	"/cms/actions",
	requireAuth,
	requireAdminSecurity,
	requireAdminStepUp,
	adminAuditLogger(),
	cmsActionController,
);
router.get(
	"/security/state",
	requireAuth,
	requireAdminSecurity,
	adminAuditLogger(),
	getSecurityStateController,
);
router.post(
	"/security/actions",
	requireAuth,
	requireAdminSecurity,
	requireAdminStepUp,
	adminAuditLogger(),
	securityActionController,
);
router.get(
	"/integrations/status",
	requireAuth,
	requireAdminSecurity,
	adminAuditLogger(),
	integrationStatusController,
);
router.get(
	"/integrations/opensearch/status",
	requireAuth,
	requireAdminSecurity,
	adminAuditLogger(),
	integrationOpenSearchStatusController,
);
router.get(
	"/integrations/email/status",
	requireAuth,
	requireAdminSecurity,
	adminAuditLogger(),
	integrationEmailStatusController,
);
router.post(
	"/integrations/actions",
	requireAuth,
	requireAdminSecurity,
	requireAdminStepUp,
	adminAuditLogger(),
	integrationActionController,
);

router.get(
	"/governance/policies",
	requireAuth,
	requireAdminSecurity,
	adminAuditLogger(),
	listGovernancePoliciesController,
);
router.post(
	"/governance/policies",
	requireAuth,
	requireAdminSecurity,
	requireAdminStepUp,
	adminAuditLogger(),
	upsertGovernancePolicyController,
);
router.post(
	"/governance/policy-versions",
	requireAuth,
	requireAdminSecurity,
	requireAdminStepUp,
	adminAuditLogger(),
	createGovernancePolicyVersionController,
);
router.post(
	"/governance/simulate",
	requireAuth,
	requireAdminSecurity,
	adminAuditLogger(),
	simulateGovernancePolicyController,
);
router.get(
	"/governance/trust/signals",
	requireAuth,
	requireAdminSecurity,
	adminAuditLogger(),
	trustSignalsController,
);
router.post(
	"/governance/trust/evaluate",
	requireAuth,
	requireAdminSecurity,
	requireAdminStepUp,
	adminAuditLogger(),
	evaluateTrustController,
);
router.post(
	"/governance/enforcement/apply",
	requireAuth,
	requireAdminSecurity,
	requireAdminStepUp,
	adminAuditLogger(),
	applyGovernanceEnforcementController,
);
router.get(
	"/governance/enforcement/history",
	requireAuth,
	requireAdminSecurity,
	adminAuditLogger(),
	listGovernanceEnforcementHistoryController,
);
router.get(
	"/governance/templates",
	requireAuth,
	requireAdminSecurity,
	adminAuditLogger(),
	listGovernanceTemplateController,
);
router.post(
	"/governance/templates",
	requireAuth,
	requireAdminSecurity,
	requireAdminStepUp,
	adminAuditLogger(),
	saveGovernanceTemplateController,
);
router.post("/governance/appeals", requireAuth, adminAuditLogger(), fileGovernanceAppealController);
router.post(
	"/governance/appeals/resolve",
	requireAuth,
	requireAdminSecurity,
	requireAdminStepUp,
	adminAuditLogger(),
	resolveGovernanceAppealController,
);
router.post(
	"/governance/reports/monthly",
	requireAuth,
	requireAdminSecurity,
	adminAuditLogger(),
	generateGovernanceMonthlyReportController,
);

router.get(
	"/master",
	requireAuth,
	requireAdminSecurity,
	adminAuditLogger(),
	adminMasterOverviewController,
);
router.post(
	"/actions",
	requireAuth,
	requireAdminSecurity,
	requireAdminStepUp,
	adminAuditLogger({
		actionResolver: (req) => String(req.body?.action || "admin.action"),
	}),
	adminActionController,
);
router.get(
	"/audit",
	requireAuth,
	requireAdminSecurity,
	adminAuditLogger(),
	adminAuditLogController,
);
router.get(
	"/config",
	requireAuth,
	requireAdminSecurity,
	adminAuditLogger(),
	adminGetConfigController,
);
router.patch(
	"/config",
	requireAuth,
	requireAdminSecurity,
	requireAdminStepUp,
	adminAuditLogger(),
	adminUpdateConfigController,
);
router.get(
	"/emails/export",
	requireAuth,
	requireAdminSecurity,
	requireDualExportApproval,
	adminAuditLogger(),
	adminEmailExportController,
);
router.get(
	"/emails/segments/export",
	requireAuth,
	requireAdminSecurity,
	requireDualExportApproval,
	adminAuditLogger(),
	exportEmailSegmentAdmin,
);
router.get(
	"/exports/run",
	requireAuth,
	requireAdminSecurity,
	requireDualExportApproval,
	adminAuditLogger(),
	adminDataExportController,
);

router.get(
	"/esign-failures",
	requireAuth,
	requireAdminSecurity,
	adminAuditLogger(),
	listEsignFailures,
);
router.post(
	"/esign-failures/:id/retry",
	requireAuth,
	requireAdminSecurity,
	requireAdminStepUp,
	adminAuditLogger(),
	retryEsignFailure,
);
router.delete(
	"/esign-failures/:id",
	requireAuth,
	requireAdminSecurity,
	requireAdminStepUp,
	adminAuditLogger(),
	deleteEsignFailure,
);

export default router;
