import crypto from "node:crypto";
import prisma from "../utils/prisma.js";
import { sanitizeString } from "../utils/validators.js";

const AUTO_RATING_DAYS = Number(process.env.AUTO_RATING_DAYS || 7);
const QUALIFICATION_RULES = [["contract_signed", "communication_completed"], ["deal_completed"]];
const RECENT_LIMIT = 10;

function normalizeProfileKey(profileKey) {
	const value = sanitizeString(profileKey, 160);
	return value || "";
}

function parseUserIdFromProfileKey(profileKey) {
	const normalized = normalizeProfileKey(profileKey);
	if (!normalized) {
		return "";
	}
	if (normalized.startsWith("user:")) {
		return normalized.slice("user:".length);
	}
	return "";
}

function safeNumber(value, fallback = 0) {
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : fallback;
}

async function createFeedbackRequestNotification(counterpartyId, profileKey, tx) {
	const client = tx || prisma;
	await client.notification.create({
		data: {
			id: crypto.randomUUID(),
			user_id: counterpartyId,
			type: "rating_feedback_request",
			entity_type: "profile",
			entity_id: profileKey,
			message: "A completed interaction qualifies for feedback. Please submit a rating.",
			meta: {
				profile_key: profileKey,
				counterparty_id: counterpartyId,
			},
			read: false,
			created_at: new Date(),
		},
	});
}

function sortByCreatedAtDesc(rows) {
	return [...rows].sort((a, b) =>
		String(b.created_at || "").localeCompare(String(a.created_at || "")),
	);
}

function computeBreakdown(ratings) {
	const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
	for (const rating of ratings) {
		const value = Math.min(5, Math.max(1, Math.round(safeNumber(rating.score, 0))));
		counts[value] += 1;
	}
	return counts;
}

function computeReliability(ratings) {
	if (ratings.length === 0) {
		return {
			confidence: "low",
			verified_counterparty_ratio: 0,
			qualified_interaction_ratio: 0,
			recent_volume: 0,
		};
	}

	let verifiedCounterparty = 0;
	let qualifiedInteraction = 0;
	const recent = sortByCreatedAtDesc(ratings).slice(0, 30);

	for (const row of ratings) {
		if (row.reliability_flags?.verified_counterparty) {
			verifiedCounterparty += 1;
		}
		if (row.reliability_flags?.qualified_milestone_pair) {
			qualifiedInteraction += 1;
		}
	}

	const verifiedRatio = verifiedCounterparty / ratings.length;
	const qualifiedRatio = qualifiedInteraction / ratings.length;
	const recentVolume = recent.length;
	const confidence =
		ratings.length >= 20 && verifiedRatio >= 0.6 ? "high" : ratings.length >= 8 ? "medium" : "low";

	return {
		confidence,
		verified_counterparty_ratio: Number(verifiedRatio.toFixed(2)),
		qualified_interaction_ratio: Number(qualifiedRatio.toFixed(2)),
		recent_volume: recentVolume,
	};
}

function computeConfidenceMetadata(ratings, averageScore) {
	const sampleSize = ratings.length;
	if (!sampleSize) {
		return {
			sample_size: 0,
			score_confidence: 0,
			standard_deviation: 0,
			margin_of_error_95: 0,
			ci95_lower: 0,
			ci95_upper: 0,
		};
	}

	const variance =
		ratings.reduce((acc, row) => {
			const delta = safeNumber(row.score, 0) - averageScore;
			return acc + delta * delta;
		}, 0) / sampleSize;

	const stdDev = Math.sqrt(variance);
	const marginError = 1.96 * (stdDev / Math.sqrt(sampleSize));
	const normalizedConfidence = Math.max(
		0,
		Math.min(1, (sampleSize / (sampleSize + 6)) * (1 - stdDev / 2.5)),
	);

	return {
		sample_size: sampleSize,
		score_confidence: Number(normalizedConfidence.toFixed(2)),
		standard_deviation: Number(stdDev.toFixed(2)),
		margin_of_error_95: Number(marginError.toFixed(2)),
		ci95_lower: Number(Math.max(0, averageScore - marginError).toFixed(2)),
		ci95_upper: Number(Math.min(5, averageScore + marginError).toFixed(2)),
	};
}

function profileQualifiesForFeedback(completedMilestones = []) {
	return QUALIFICATION_RULES.some((rule) =>
		rule.every((milestone) => completedMilestones.includes(milestone)),
	);
}

function hasRecordedCall(calls, firstId, secondId) {
	if (!(firstId && secondId)) {
		return false;
	}
	return (Array.isArray(calls) ? calls : []).some((call) => {
		const participants = Array.isArray(call?.participant_ids)
			? call.participant_ids.map(String)
			: [];
		if (!(participants.includes(String(firstId)) && participants.includes(String(secondId)))) {
			return false;
		}
		return (
			String(call?.recording_status || "").toLowerCase() === "available" && call?.recording_url
		);
	});
}

function hasSignedContract(contracts, firstId, secondId) {
	if (!(firstId && secondId)) {
		return false;
	}
	return (Array.isArray(contracts) ? contracts : []).some((contract) => {
		if (String(contract?.entity_type || "") !== "contract") {
			return false;
		}
		const buyerId = String(contract?.buyer_id || "");
		const factoryId = String(contract?.factory_id || "");
		const matches =
			(buyerId === String(firstId) && factoryId === String(secondId)) ||
			(buyerId === String(secondId) && factoryId === String(firstId));
		if (!matches) {
			return false;
		}
		const buyerSigned = String(contract?.buyer_signature_state || "").toLowerCase() === "signed";
		const factorySigned =
			String(contract?.factory_signature_state || "").toLowerCase() === "signed";
		return buyerSigned && factorySigned;
	});
}

function averageResponseHours(messages, responderId, requesterId) {
	if (!(responderId && requesterId)) {
		return null;
	}
	const threads = new Map();
	(Array.isArray(messages) ? messages : []).forEach((msg) => {
		const matchId = String(msg?.match_id || "");
		if (!matchId) {
			return;
		}
		const senderId = String(msg?.sender_id || "");
		if (![responderId, requesterId].includes(senderId)) {
			return;
		}
		if (!threads.has(matchId)) {
			threads.set(matchId, []);
		}
		threads.get(matchId).push(msg);
	});

	const responseTimes = [];
	for (const msgs of threads.values()) {
		const sorted = msgs
			.slice()
			.sort((a, b) => String(a.timestamp || "").localeCompare(String(b.timestamp || "")));
		const firstRequest = sorted.find((m) => String(m.sender_id || "") === String(requesterId));
		if (!firstRequest?.timestamp) {
			continue;
		}
		const start = new Date(firstRequest.timestamp).getTime();
		if (!Number.isFinite(start)) {
			continue;
		}
		const response = sorted.find(
			(m) =>
				String(m.sender_id || "") === String(responderId) &&
				new Date(m.timestamp).getTime() >= start,
		);
		if (!response?.timestamp) {
			continue;
		}
		const end = new Date(response.timestamp).getTime();
		if (!Number.isFinite(end)) {
			continue;
		}
		responseTimes.push((end - start) / (1000 * 60 * 60));
	}

	if (responseTimes.length === 0) {
		return null;
	}
	return responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
}

function buildSuggestedScore({ contractSigned, recordedCall, avgResponseHours }) {
	let score = 3.5;
	const reasons = [];

	if (contractSigned) {
		score += 0.6;
		reasons.push("Contract signed");
	}
	if (recordedCall) {
		score += 0.4;
		reasons.push("Recorded call completed");
	}

	if (avgResponseHours !== null) {
		if (avgResponseHours <= 4) {
			score += 0.3;
			reasons.push("Fast responses");
		} else if (avgResponseHours <= 24) {
			score += 0.1;
			reasons.push("Responsive follow-up");
		} else if (avgResponseHours > 48) {
			score -= 0.2;
			reasons.push("Slow response time");
		}
	}

	score = Math.max(1, Math.min(5, score));
	const rounded = Math.round(score * 10) / 10;
	return { score: rounded, reasons };
}

export async function recordMilestone({
	profileKey,
	counterpartyId,
	interactionType,
	milestone,
	actorId,
}) {
	const normalizedProfile = normalizeProfileKey(profileKey);
	const normalizedCounterparty = sanitizeString(counterpartyId, 120);
	const normalizedInteractionType = sanitizeString(interactionType || "deal", 40);
	const normalizedMilestone = sanitizeString(milestone, 60);

	if (!(normalizedProfile && normalizedCounterparty && normalizedMilestone)) {
		return null;
	}

	const now = new Date();

	const existing = await prisma.ratingMilestone.findFirst({
		where: {
			profile_key: normalizedProfile,
			counterparty_id: normalizedCounterparty,
			interaction_type: normalizedInteractionType,
			milestone: normalizedMilestone,
		},
	});

	const txResult = await prisma.$transaction(async (tx) => {
		if (existing) {
			await tx.ratingMilestone.update({
				where: { id: existing.id },
				data: {
					status: "completed",
					completed_at: now,
					updated_at: now,
					updated_by: actorId,
				},
			});
		} else {
			await tx.ratingMilestone.create({
				data: {
					id: crypto.randomUUID(),
					profile_key: normalizedProfile,
					counterparty_id: normalizedCounterparty,
					interaction_type: normalizedInteractionType,
					milestone: normalizedMilestone,
					status: "completed",
					completed_at: now,
					created_at: now,
					updated_at: now,
					updated_by: actorId,
				},
			});
		}

		const completed = await tx.ratingMilestone.findMany({
			where: {
				profile_key: normalizedProfile,
				counterparty_id: normalizedCounterparty,
				status: "completed",
			},
		});
		const completedMilestones = completed.map((row) => row.milestone);
		const qualifies = profileQualifiesForFeedback(completedMilestones);

		let feedbackRequest = null;
		if (qualifies) {
			const existingRequest = await tx.ratingFeedbackRequest.findFirst({
				where: {
					profile_key: normalizedProfile,
					counterparty_id: normalizedCounterparty,
					status: "pending",
				},
			});

			if (!existingRequest) {
				feedbackRequest = await tx.ratingFeedbackRequest.create({
					data: {
						id: crypto.randomUUID(),
						profile_key: normalizedProfile,
						counterparty_id: normalizedCounterparty,
						interaction_type: normalizedInteractionType,
						qualification_rules: QUALIFICATION_RULES,
						status: "pending",
						triggered_by: actorId,
						created_at: now,
					},
				});

				await tx.ratingFeedbackEvent.create({
					data: {
						id: crypto.randomUUID(),
						profile_key: normalizedProfile,
						counterparty_id: normalizedCounterparty,
						interaction_type: normalizedInteractionType,
						event: "feedback_requested",
						milestone: normalizedMilestone,
						created_at: now,
					},
				});

				await createFeedbackRequestNotification(normalizedCounterparty, normalizedProfile, tx);
			}
		}

		return { feedback_request: feedbackRequest, qualifies };
	});

	return txResult;
}

export async function createRating({
	profileKey,
	fromUserId,
	interactionType,
	score,
	comment = "",
	reliabilityFlags = {},
	categories = {},
}) {
	const normalizedProfile = normalizeProfileKey(profileKey);
	const normalizedFrom = sanitizeString(fromUserId, 120);
	const normalizedInteractionType = sanitizeString(interactionType || "deal", 40);
	const normalizedComment = sanitizeString(comment, 500);
	const numericScore = Math.min(5, Math.max(1, Math.round(safeNumber(score, 0))));

	if (!(normalizedProfile && normalizedFrom && numericScore)) {
		const err = new Error("profile_key, from_user_id and score are required");
		err.status = 400;
		throw err;
	}

	const clampCategory = (v) => {
		const n = Number(v);
		return Number.isFinite(n) ? Math.min(5, Math.max(1, Math.round(n))) : null;
	};

	const pendingRequest = await prisma.ratingFeedbackRequest.findFirst({
		where: {
			profile_key: normalizedProfile,
			counterparty_id: normalizedFrom,
			status: "pending",
		},
	});

	const [rating] = await prisma.$transaction(async (tx) => {
		if (pendingRequest) {
			await tx.ratingFeedbackRequest.update({
				where: { id: pendingRequest.id },
				data: {
					status: "fulfilled",
					fulfilled_at: new Date(),
				},
			});
		}

		const r = await tx.rating.create({
			data: {
				id: crypto.randomUUID(),
				profile_key: normalizedProfile,
				from_user_id: normalizedFrom,
				interaction_type: normalizedInteractionType,
				score: numericScore,
				comment: normalizedComment,
				sample_accuracy: clampCategory(categories.sample_accuracy),
				communication_speed: clampCategory(categories.communication_speed),
				quality_control: clampCategory(categories.quality_control),
				delivery_timeliness: clampCategory(categories.delivery_timeliness),
				after_sales_support: clampCategory(categories.after_sales_support),
				reliability_flags: {
					verified_counterparty: Boolean(reliabilityFlags.verified_counterparty),
					qualified_milestone_pair: Boolean(reliabilityFlags.qualified_milestone_pair),
					auto_generated: false,
				},
				auto_generated: false,
				created_at: new Date(),
			},
		});

		return [r];
	});

	return rating;
}

async function autoGenerateRatingsForOverdueRequests() {
	// Auto-rating abolished: ratings are manual-only.
	// Overdue feedback requests are now marked as expired instead of receiving
	// synthetic 5-star ratings.  This keeps the feedback-request lifecycle
	// clean and prevents inflated averages.
	const pending = await prisma.ratingFeedbackRequest.findMany({
		where: { status: "pending" },
	});
	if (pending.length === 0) {
		return;
	}

	const now = Date.now();
	const cutoffMs = Math.max(1, AUTO_RATING_DAYS) * 24 * 60 * 60 * 1000;
	const overdue = pending.filter((row) => {
		const ts = new Date(row.created_at).getTime();
		if (!Number.isFinite(ts)) {
			return false;
		}
		return now - ts >= cutoffMs;
	});
	if (overdue.length === 0) {
		return;
	}

	for (const row of overdue) {
		const profileKey = normalizeProfileKey(row.profile_key);
		const counterpartyId = sanitizeString(row.counterparty_id, 120);
		if (!(profileKey && counterpartyId)) {
			continue;
		}

		const alreadyRated = await prisma.rating.findFirst({
			where: {
				profile_key: profileKey,
				from_user_id: counterpartyId,
			},
		});

		await prisma.$transaction(async (tx) => {
			await tx.ratingFeedbackRequest.update({
				where: { id: row.id },
				data: {
					status: alreadyRated ? "fulfilled" : "expired",
					fulfilled_at: alreadyRated ? row.fulfilled_at || new Date() : new Date(),
				},
			});

			if (!alreadyRated) {
				await tx.ratingFeedbackEvent.create({
					data: {
						id: crypto.randomUUID(),
						profile_key: profileKey,
						counterparty_id: counterpartyId,
						interaction_type: sanitizeString(row.interaction_type || "deal", 40),
						event: "request_expired",
						milestone: "no_user_feedback",
						created_at: new Date(),
					},
				});
			}
		});
	}
}

export async function getProfileRatingsSummary(profileKey) {
	const normalizedProfile = normalizeProfileKey(profileKey);
	const [ratings, pendingRequestCount] = await Promise.all([
		prisma.rating.findMany({
			where: { profile_key: normalizedProfile },
			orderBy: { created_at: "desc" },
		}),
		prisma.ratingFeedbackRequest.count({
			where: { profile_key: normalizedProfile, status: "pending" },
		}),
	]);

	const recent = ratings.slice(0, RECENT_LIMIT);
	const totalCount = ratings.length;
	const average = totalCount
		? ratings.reduce((sum, row) => sum + safeNumber(row.score, 0), 0) / totalCount
		: 0;
	const recentAverage =
		recent.length > 0
			? recent.reduce((sum, row) => sum + safeNumber(row.score, 0), 0) / recent.length
			: 0;

	const categoryKeys = [
		"sample_accuracy",
		"communication_speed",
		"quality_control",
		"delivery_timeliness",
		"after_sales_support",
	];
	const categoryAverages = {};
	for (const key of categoryKeys) {
		const scored = ratings.filter((r) => Number.isFinite(Number(r[key])));
		categoryAverages[key] =
			scored.length > 0
				? Number((scored.reduce((sum, r) => sum + Number(r[key]), 0) / scored.length).toFixed(2))
				: null;
	}

	return {
		profile_key: normalizedProfile,
		aggregate: {
			average_score: Number(average.toFixed(2)),
			recent_average_score: Number(recentAverage.toFixed(2)),
			total_count: totalCount,
			reliability: computeReliability(ratings),
			confidence_metadata: computeConfidenceMetadata(ratings, average),
			category_averages: categoryAverages,
		},
		breakdown: computeBreakdown(ratings),
		recent_reviews: recent.slice(0, 5).map((row) => ({
			id: row.id,
			from_user_id: row.from_user_id,
			score: row.score,
			comment: row.comment,
			interaction_type: row.interaction_type,
			auto_generated: Boolean(row.auto_generated),
			created_at: row.created_at,
			sample_accuracy: row.sample_accuracy,
			communication_speed: row.communication_speed,
			quality_control: row.quality_control,
			delivery_timeliness: row.delivery_timeliness,
			after_sales_support: row.after_sales_support,
		})),
		feedback_requests: pendingRequestCount,
	};
}

export async function hasPendingRatingForCounterparty(userId, counterpartyId) {
	const profileKey = `user:${sanitizeString(String(userId), 120)}`;
	const normalizedCounterparty = sanitizeString(String(counterpartyId), 120);

	if (!(profileKey && normalizedCounterparty)) {
		return false;
	}

	const pending = await prisma.ratingFeedbackRequest.findFirst({
		where: {
			profile_key: profileKey,
			counterparty_id: normalizedCounterparty,
			status: "pending",
		},
	});

	return pending !== null;
}

export async function getRatingsForProfiles(profileKeys = []) {
	const keys = [
		...new Set(
			(Array.isArray(profileKeys) ? profileKeys : []).map(normalizeProfileKey).filter(Boolean),
		),
	];
	const result = {};
	for (const key of keys) {
		result[key] = await getProfileRatingsSummary(key);
	}
	return result;
}

export async function getAggregateForProfile(profileKey) {
	const summary = await getProfileRatingsSummary(profileKey);
	return {
		profile_key: summary.profile_key,
		aggregate: summary.aggregate,
		feedback_requests: summary.feedback_requests,
	};
}

export async function getSearchRatingCards(profileKeys = []) {
	const summaries = await getRatingsForProfiles(profileKeys);
	return Object.fromEntries(
		Object.entries(summaries).map(([profileKey, summary]) => [
			profileKey,
			{
				average_score: summary.aggregate.average_score,
				total_count: summary.aggregate.total_count,
				confidence: summary.aggregate.reliability.confidence,
				score_confidence: summary.aggregate.confidence_metadata.score_confidence,
				breakdown: summary.breakdown,
			},
		]),
	);
}

export async function listPendingFeedbackRequestsForUser(userId) {
	const normalizedUser = sanitizeString(userId, 120);
	if (!normalizedUser) {
		return [];
	}

	await autoGenerateRatingsForOverdueRequests();

	const pending = await prisma.ratingFeedbackRequest.findMany({
		where: {
			counterparty_id: normalizedUser,
			status: "pending",
		},
		orderBy: { created_at: "desc" },
	});

	if (pending.length === 0) {
		return [];
	}

	const [calls, documents, messages] = await Promise.all([
		prisma.callSession.findMany(),
		prisma.document.findMany(),
		prisma.message.findMany(),
	]);

	return pending.map((row) => {
		const targetUserId = parseUserIdFromProfileKey(row.profile_key);
		const contractSigned = hasSignedContract(documents, targetUserId, normalizedUser);
		const recordedCall = hasRecordedCall(calls, targetUserId, normalizedUser);
		const avgResponseHours = averageResponseHours(messages, targetUserId, normalizedUser);
		const suggestion = buildSuggestedScore({
			contractSigned,
			recordedCall,
			avgResponseHours,
		});

		return {
			...row,
			suggested_score: suggestion.score,
			suggested_reasons: suggestion.reasons,
			signals: {
				contract_signed: contractSigned,
				recorded_call: recordedCall,
				avg_response_hours:
					avgResponseHours === null ? null : Math.round(avgResponseHours * 10) / 10,
			},
		};
	});
}
