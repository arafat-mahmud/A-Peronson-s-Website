import crypto from "node:crypto";
import prisma from "../utils/prisma.js";
import { createNotification } from "./notificationService.js";

const ENFORCEMENT_ACTIONS = Object.freeze({
	SOFT_WARNING: "soft_warning",
	TEMP_COMMUNICATION_THROTTLE: "temporary_communication_throttle",
	FEATURE_LOCK: "feature_lock",
	MANUAL_REVIEW_QUEUE: "manual_review_queue",
});

function actionForScore(score) {
	const trust = Number(score || 0);
	if (trust >= 75) {
		return ENFORCEMENT_ACTIONS.SOFT_WARNING;
	}
	if (trust >= 50) {
		return ENFORCEMENT_ACTIONS.TEMP_COMMUNICATION_THROTTLE;
	}
	if (trust >= 25) {
		return ENFORCEMENT_ACTIONS.FEATURE_LOCK;
	}
	return ENFORCEMENT_ACTIONS.MANUAL_REVIEW_QUEUE;
}

function renderTemplate(template, context = {}) {
	return String(template || "").replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) => {
		const value = context[key];
		return value === null ? "" : String(value);
	});
}

async function getTemplate(templateKey, fallback) {
	const template = await prisma.governanceNotificationTemplate.findUnique({
		where: { template_key: templateKey },
	});
	return template?.active ? template : fallback;
}

export async function applyEnforcement({
	userId,
	evaluationId = null,
	policyDefinitionId = null,
	policyVersionId = null,
	actorId = null,
	reason = "",
}) {
	const latestEval = evaluationId
		? await prisma.trustRiskEvaluation.findUnique({
				where: { id: evaluationId },
			})
		: await prisma.trustRiskEvaluation.findFirst({
				where: { user_id: userId },
				orderBy: { created_at: "desc" },
			});

	if (!latestEval) {
		const error = new Error("No trust evaluation found for user");
		error.status = 404;
		throw error;
	}

	const action = actionForScore(latestEval.trust_score);
	const now = new Date();
	const expiresAt =
		action === ENFORCEMENT_ACTIONS.TEMP_COMMUNICATION_THROTTLE
			? new Date(now.getTime() + 6 * 60 * 60 * 1000)
			: null;

	const [enforcement] = await prisma.$transaction(async (tx) => {
		const e = await tx.governanceEnforcement.create({
			data: {
				id: crypto.randomUUID(),
				user_id: String(userId),
				evaluation_id: latestEval.id,
				policy_definition_id: policyDefinitionId,
				policy_version_id: policyVersionId,
				action,
				reason: String(reason || "Automated trust governance decision"),
				expires_at: expiresAt,
				created_by: actorId,
				metadata: {
					trust_score: latestEval.trust_score,
					signals: latestEval.signals || null,
				},
			},
		});

		if (action === ENFORCEMENT_ACTIONS.TEMP_COMMUNICATION_THROTTLE) {
			await tx.user
				.update({
					where: { id: String(userId) },
					data: {
						messaging_restricted_until: expiresAt,
					},
				})
				.catch(() => null);
		}

		if (action === ENFORCEMENT_ACTIONS.FEATURE_LOCK) {
			await tx.user
				.update({
					where: { id: String(userId) },
					data: {
						status: "restricted",
					},
				})
				.catch(() => null);
		}

		if (action === ENFORCEMENT_ACTIONS.MANUAL_REVIEW_QUEUE) {
			await tx.governanceManualReviewQueue.create({
				data: {
					id: crypto.randomUUID(),
					enforcement_id: e.id,
					user_id: String(userId),
					reason: e.reason,
					priority: "high",
					payload: {
						trust_score: latestEval.trust_score,
						signals: latestEval.signals || {},
					},
				},
			});
		}

		return [e];
	});

	const fallback = {
		subject: "Trust governance update",
		body: "Action {{action}} was applied to your account. You can appeal this decision from support.",
	};
	const template = await getTemplate("trust_decision_notice", fallback);
	await createNotification(String(userId), {
		type: "trust_governance_decision",
		entity_type: "governance_enforcement",
		entity_id: enforcement.id,
		message: renderTemplate(template.body, { action }),
		meta: {
			action,
			trust_score: latestEval.trust_score,
		},
	});

	return enforcement;
}

export async function saveNotificationTemplate({
	templateKey,
	subject,
	body,
	channel = "in_app",
	actorId = null,
}) {
	const key = String(templateKey || "").trim();
	if (!(key && String(subject || "").trim() && String(body || "").trim())) {
		const error = new Error("templateKey, subject and body are required");
		error.status = 400;
		throw error;
	}

	const existing = await prisma.governanceNotificationTemplate.findUnique({
		where: { template_key: key },
	});
	if (existing) {
		return prisma.governanceNotificationTemplate.update({
			where: { id: existing.id },
			data: {
				channel: String(channel || "in_app"),
				subject: String(subject),
				body: String(body),
				updated_at: new Date(),
			},
		});
	}

	return prisma.governanceNotificationTemplate.create({
		data: {
			id: crypto.randomUUID(),
			template_key: key,
			channel: String(channel || "in_app"),
			subject: String(subject),
			body: String(body),
			created_by: actorId,
		},
	});
}

export async function fileGovernanceAppeal({ enforcementId, userId, reason }) {
	if (
		!(
			String(enforcementId || "").trim() &&
			String(userId || "").trim() &&
			String(reason || "").trim()
		)
	) {
		const error = new Error("enforcementId, userId and reason are required");
		error.status = 400;
		throw error;
	}

	const appeal = await prisma.governanceAppeal.create({
		data: {
			id: crypto.randomUUID(),
			enforcement_id: String(enforcementId),
			user_id: String(userId),
			reason: String(reason),
		},
	});

	const fallback = {
		subject: "Appeal received",
		body: "Your appeal for enforcement {{enforcement_id}} has been submitted.",
	};
	const template = await getTemplate("trust_appeal_received", fallback);
	await createNotification(String(userId), {
		type: "trust_appeal_received",
		entity_type: "governance_appeal",
		entity_id: appeal.id,
		message: renderTemplate(template.body, { enforcement_id: enforcementId }),
	});

	return appeal;
}

export async function resolveGovernanceAppeal({ appealId, outcome, notes = "", actorId = null }) {
	const updated = await prisma.governanceAppeal.update({
		where: { id: String(appealId || "") },
		data: {
			status: "resolved",
			outcome: String(outcome || "upheld"),
			outcome_notes: String(notes || ""),
			reviewed_by: actorId,
			reviewed_at: new Date(),
			updated_at: new Date(),
		},
	});

	await createNotification(String(updated.user_id), {
		type: "trust_appeal_resolved",
		entity_type: "governance_appeal",
		entity_id: updated.id,
		message: `Your trust appeal has been resolved with outcome: ${updated.outcome}.`,
		meta: {
			outcome: updated.outcome,
			notes: updated.outcome_notes,
		},
	});

	return updated;
}

export async function buildMonthlyGovernanceReport({ month, actorId = null }) {
	const monthValue = String(month || "").trim() || new Date().toISOString().slice(0, 7);
	const start = new Date(`${monthValue}-01T00:00:00.000Z`);
	const end = new Date(start);
	end.setUTCMonth(end.getUTCMonth() + 1);

	const [enforcements, evaluations, appeals] = await Promise.all([
		prisma.governanceEnforcement.findMany({
			where: { created_at: { gte: start, lt: end } },
		}),
		prisma.trustRiskEvaluation.findMany({
			where: { created_at: { gte: start, lt: end } },
		}),
		prisma.governanceAppeal.findMany({
			where: { created_at: { gte: start, lt: end } },
		}),
	]);

	const total = enforcements.length;
	const manualReviews = enforcements.filter(
		(row) => row.action === ENFORCEMENT_ACTIONS.MANUAL_REVIEW_QUEUE,
	).length;
	const falsePositives = enforcements.filter(
		(row) => String(row.status || "").toLowerCase() === "reverted",
	).length;
	const appealOverturned = appeals.filter(
		(row) => String(row.outcome || "").toLowerCase() === "overturned",
	).length;

	const roleBuckets = evaluations.reduce((acc, row) => {
		const role = String(row.role || "unknown");
		const current = acc[role] || { count: 0, totalScore: 0 };
		current.count += 1;
		current.totalScore += Number(row.trust_score || 0);
		acc[role] = current;
		return acc;
	}, {});

	const trustScoreDriftByRole = Object.entries(roleBuckets).map(([role, value]) => ({
		role,
		average_trust_score: value.count ? Number((value.totalScore / value.count).toFixed(2)) : 0,
		evaluations: value.count,
	}));

	const metrics = {
		month: monthValue,
		policy_hit_rates: {
			total_enforcements: total,
			manual_review_rate: total ? Number((manualReviews / total).toFixed(4)) : 0,
		},
		false_positives: {
			reverted_actions: falsePositives,
			rate: total ? Number((falsePositives / total).toFixed(4)) : 0,
		},
		appeal_outcomes: {
			submitted: appeals.length,
			overturned: appealOverturned,
			uphold_rate:
				appeals.length > 0
					? Number(((appeals.length - appealOverturned) / appeals.length).toFixed(4))
					: 0,
		},
		trust_score_drift_by_role: trustScoreDriftByRole,
	};

	return prisma.governanceMonthlyReport.upsert({
		where: { month: monthValue },
		create: {
			id: crypto.randomUUID(),
			month: monthValue,
			metrics,
			created_by: actorId,
		},
		update: {
			metrics,
			created_by: actorId,
		},
	});
}

export async function listEnforcementHistory({ limit = 100 }) {
	return prisma.governanceEnforcement.findMany({
		orderBy: { created_at: "desc" },
		take: Math.max(1, Math.min(500, Number(limit) || 100)),
	});
}

export async function listGovernanceTemplates() {
	return prisma.governanceNotificationTemplate.findMany({
		orderBy: { created_at: "desc" },
	});
}
