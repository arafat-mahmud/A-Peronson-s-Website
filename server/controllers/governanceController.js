import {
	applyEnforcement,
	buildMonthlyGovernanceReport,
	fileGovernanceAppeal,
	listEnforcementHistory,
	listGovernanceTemplates,
	resolveGovernanceAppeal,
	saveNotificationTemplate,
} from "../services/enforcementService.js";
import {
	createPolicyVersion,
	listPolicyRegistry,
	simulatePolicy,
	upsertPolicyDefinition,
} from "../services/policyRegistryService.js";
import {
	computeTrustRiskSignals,
	recordTrustRiskEvaluation,
} from "../services/trustRiskScoringService.js";
import { handleControllerError } from "../utils/permissions.js";

export async function listGovernancePoliciesController(_req, res) {
	try {
		const items = await listPolicyRegistry();
		return res.json({ items });
	} catch (error) {
		return handleControllerError(res, error);
	}
}

export async function upsertGovernancePolicyController(req, res) {
	try {
		const item = await upsertPolicyDefinition({
			...req.body,
			actorId: req.user?.id || null,
		});
		return res.json({ item });
	} catch (error) {
		return handleControllerError(res, error);
	}
}

export async function createGovernancePolicyVersionController(req, res) {
	try {
		const item = await createPolicyVersion({
			...req.body,
			actorId: req.user?.id || null,
		});
		return res.json({ item });
	} catch (error) {
		return handleControllerError(res, error);
	}
}

export async function simulateGovernancePolicyController(req, res) {
	try {
		const result = await simulatePolicy(req.body || {});
		return res.json(result);
	} catch (error) {
		return handleControllerError(res, error);
	}
}

export async function trustSignalsController(req, res) {
	try {
		const userId = String(req.query?.user_id || req.body?.user_id || "");
		const result = await computeTrustRiskSignals({ userId });
		return res.json(result);
	} catch (error) {
		return handleControllerError(res, error);
	}
}

export async function evaluateTrustController(req, res) {
	try {
		const userId = String(req.body?.user_id || "");
		const decision = req.body?.decision ? String(req.body.decision) : null;
		const result = await recordTrustRiskEvaluation({ userId, decision });
		return res.json(result);
	} catch (error) {
		return handleControllerError(res, error);
	}
}

export async function applyGovernanceEnforcementController(req, res) {
	try {
		const result = await applyEnforcement({
			...req.body,
			actorId: req.user?.id || null,
		});
		return res.json(result);
	} catch (error) {
		return handleControllerError(res, error);
	}
}

export async function listGovernanceEnforcementHistoryController(req, res) {
	try {
		const items = await listEnforcementHistory({
			limit: Number(req.query?.limit || 100),
		});
		return res.json({ items });
	} catch (error) {
		return handleControllerError(res, error);
	}
}

export async function saveGovernanceTemplateController(req, res) {
	try {
		const item = await saveNotificationTemplate({
			...req.body,
			actorId: req.user?.id || null,
		});
		return res.json({ item });
	} catch (error) {
		return handleControllerError(res, error);
	}
}

export async function listGovernanceTemplateController(_req, res) {
	try {
		const items = await listGovernanceTemplates();
		return res.json({ items });
	} catch (error) {
		return handleControllerError(res, error);
	}
}

export async function fileGovernanceAppealController(req, res) {
	try {
		const item = await fileGovernanceAppeal(req.body || {});
		return res.json({ item });
	} catch (error) {
		return handleControllerError(res, error);
	}
}

export async function resolveGovernanceAppealController(req, res) {
	try {
		const item = await resolveGovernanceAppeal({
			...req.body,
			actorId: req.user?.id || null,
		});
		return res.json({ item });
	} catch (error) {
		return handleControllerError(res, error);
	}
}

export async function generateGovernanceMonthlyReportController(req, res) {
	try {
		const item = await buildMonthlyGovernanceReport({
			month: req.body?.month,
			actorId: req.user?.id || null,
		});
		return res.json({ item });
	} catch (error) {
		return handleControllerError(res, error);
	}
}
