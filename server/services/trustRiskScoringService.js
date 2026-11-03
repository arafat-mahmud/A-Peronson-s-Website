import crypto from "node:crypto";
import prisma from "../utils/prisma.js";

const MAX_SIGNAL = 100;

function clamp(value, min = 0, max = MAX_SIGNAL) {
	const num = Number(value);
	if (!Number.isFinite(num)) {
		return min;
	}
	return Math.max(min, Math.min(max, num));
}

function daysSince(value) {
	if (!value) {
		return null;
	}
	const ts = new Date(value).getTime();
	if (!Number.isFinite(ts)) {
		return null;
	}
	return Math.max(0, Math.floor((Date.now() - ts) / (24 * 60 * 60 * 1000)));
}

export async function computeTrustRiskSignals({ userId }) {
	const id = String(userId || "").trim();
	if (!id) {
		const error = new Error("userId is required");
		error.status = 400;
		throw error;
	}

	const [user, verification, disputes, suspiciousMessages, breaches] = await Promise.all([
		prisma.user.findUnique({ where: { id } }),
		prisma.verification.findUnique({ where: { user_id: id } }),
		prisma.report.findMany({
			where: {
				actor_id: id,
				entity_type: "dispute",
			},
			orderBy: { created_at: "desc" },
			take: 36,
		}),
		prisma.messagePolicyDecision.findMany({
			where: {
				sender_id: id,
				OR: [{ action: "block" }, { requires_human_review: true }],
			},
			orderBy: { created_at: "desc" },
			take: 100,
		}),
		prisma.report.findMany({
			where: {
				actor_id: id,
				entity_type: "contract",
				OR: [{ resolution_action: { contains: "breach" } }, { reason: { contains: "breach" } }],
			},
			orderBy: { created_at: "desc" },
			take: 24,
		}),
	]);

	const verificationDays = daysSince(verification?.verified_at);
	const verificationRecency =
		verificationDays === null ? 100 : clamp(Math.round((verificationDays / 180) * 100));

	const disputeHistory = clamp(disputes.length * 15);
	const suspiciousMessaging = clamp(suspiciousMessages.length * 8);
	const contractBreach = clamp(breaches.length * 30);

	const trustScore = clamp(
		100 -
			(verificationRecency * 0.25 +
				disputeHistory * 0.25 +
				suspiciousMessaging * 0.3 +
				contractBreach * 0.2),
	);

	return {
		user_id: id,
		role: user?.role || null,
		trust_score: Number(trustScore.toFixed(2)),
		signals: {
			verification_recency: verificationRecency,
			dispute_history: disputeHistory,
			suspicious_messaging_behavior: suspiciousMessaging,
			contract_breach_flags: contractBreach,
		},
	};
}

export async function recordTrustRiskEvaluation({ userId, decision = null }) {
	const computed = await computeTrustRiskSignals({ userId });
	const created = await prisma.trustRiskEvaluation.create({
		data: {
			id: crypto.randomUUID(),
			user_id: computed.user_id,
			role: computed.role,
			trust_score: computed.trust_score,
			verification_recency: computed.signals.verification_recency,
			dispute_history: computed.signals.dispute_history,
			suspicious_messaging: computed.signals.suspicious_messaging_behavior,
			contract_breach: computed.signals.contract_breach_flags,
			decision,
			signals: computed.signals,
		},
	});

	return created;
}
