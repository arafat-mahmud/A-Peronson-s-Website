import crypto from "node:crypto";
import prisma from "../utils/prisma.js";
import { sanitizeString } from "../utils/validators.js";

const DEFAULT_GLOBAL_CONFIG = {
	id: "global",
	scope: "global",
	org_id: null,
	message_caps: {
		outbound_per_window: 12,
		window_minutes: 15,
		cooldown_seconds: 30,
	},
	priority_multipliers: {
		premium: 1.2,
		verified: 1.3,
	},
	strictness_mode: "balanced",
	spam_thresholds: {
		queue: 0.45,
		hard_block: 0.75,
	},
};

const STRICTNESS_MODES = {
	relaxed: { capFactor: 1.35, spamDelta: 0.08 },
	balanced: { capFactor: 1, spamDelta: 0 },
	strict: { capFactor: 0.8, spamDelta: -0.08 },
};

const RISK_PATTERNS = [
	{
		pattern: /(free\s+money|crypto\s+airdrop|guaranteed\s+profit|click\s+here)/i,
		weight: 0.45,
	},
	{
		pattern: /(http:\/\/|bit\.ly|t\.me|wa\.me|telegram|whatsapp|contact\s+me\s+on)/i,
		weight: 0.35,
	},
	{ pattern: /(urgent|act\s+now|limited\s+offer|winner)/i, weight: 0.2 },
	{ pattern: /(免费|点击|现在联系|优惠|促销)/i, weight: 0.25 },
	{
		pattern: /(বিনামূল্যে|অফার|যোগাযোগ|টেলিগ্রাম|হোয়াটসঅ্যাপ|হোয়াটসঅ্যাপ)/i,
		weight: 0.25,
	},
	{
		pattern: /(oferta|gratis|haz\s+clic|contacta\s+por\s+telegram)/i,
		weight: 0.2,
	},
];

function normalizeText(value = "") {
	return String(value || "")
		.trim()
		.toLowerCase()
		.replace(/\s+/g, " ");
}

function toIso(date = new Date()) {
	return new Date(date).toISOString();
}

function addMetric(metrics, key, step = 1) {
	metrics[key] = Number(metrics[key] || 0) + Number(step || 0);
}

function resolveStrictnessMode(mode = "balanced") {
	const key = String(mode || "balanced").toLowerCase();
	return STRICTNESS_MODES[key] ? key : "balanced";
}

function normalizeConfig(row = {}) {
	const strictnessMode = resolveStrictnessMode(row?.strictness_mode);
	const legacyMax = Number(
		row?.max_outreach_per_window || DEFAULT_GLOBAL_CONFIG.message_caps.outbound_per_window,
	);
	const legacyWindow = Number(
		row?.outreach_window_minutes || DEFAULT_GLOBAL_CONFIG.message_caps.window_minutes,
	);
	const legacyCooldown = Number(
		row?.cooldown_seconds || DEFAULT_GLOBAL_CONFIG.message_caps.cooldown_seconds,
	);
	const legacyPremiumBoost = Number(row?.premium_boost || 20);
	const legacyVerifiedBoost = Number(row?.verified_boost || 30);

	return {
		...DEFAULT_GLOBAL_CONFIG,
		...row,
		message_caps: {
			...DEFAULT_GLOBAL_CONFIG.message_caps,
			...(row?.message_caps || {}),
			outbound_per_window: Number(
				row?.message_caps?.outbound_per_window || row?.max_outreach_per_window || legacyMax,
			),
			window_minutes: Number(
				row?.message_caps?.window_minutes || row?.outreach_window_minutes || legacyWindow,
			),
			cooldown_seconds: Number(
				row?.message_caps?.cooldown_seconds || row?.cooldown_seconds || legacyCooldown,
			),
		},
		priority_multipliers: {
			...DEFAULT_GLOBAL_CONFIG.priority_multipliers,
			...(row?.priority_multipliers || {}),
			premium: Number(
				row?.priority_multipliers?.premium ||
					row?.premium_multiplier ||
					Math.max(1, legacyPremiumBoost / 100 + 1),
			),
			verified: Number(
				row?.priority_multipliers?.verified ||
					row?.verified_multiplier ||
					Math.max(1, legacyVerifiedBoost / 100 + 1),
			),
		},
		strictness_mode: strictnessMode,
		spam_thresholds: {
			...DEFAULT_GLOBAL_CONFIG.spam_thresholds,
			...(row?.spam_thresholds || {}),
			queue: Number(
				row?.spam_thresholds?.queue ||
					row?.keyword_risk_threshold_soft ||
					DEFAULT_GLOBAL_CONFIG.spam_thresholds.queue,
			),
			hard_block: Number(
				row?.spam_thresholds?.hard_block ||
					row?.keyword_risk_threshold_hard ||
					DEFAULT_GLOBAL_CONFIG.spam_thresholds.hard_block,
			),
		},
	};
}

function buildConfigMap(configRows = []) {
	const map = new Map();
	for (const row of configRows) {
		if (!row?.id) {
			continue;
		}
		map.set(String(row.id), normalizeConfig(row));
	}
	if (!map.has("global")) {
		map.set("global", normalizeConfig(DEFAULT_GLOBAL_CONFIG));
	}
	return map;
}

function resolvePolicyConfig(configMap, orgId = "") {
	const global = normalizeConfig(configMap.get("global") || DEFAULT_GLOBAL_CONFIG);
	if (!orgId) {
		return global;
	}
	const orgRow = configMap.get(`org:${orgId}`);
	if (!orgRow) {
		return global;
	}
	return normalizeConfig({ ...global, ...orgRow });
}

function estimateSpamScore(text = "") {
	const normalized = normalizeText(text);
	if (!normalized) {
		return 0;
	}
	let score = 0;
	for (const entry of RISK_PATTERNS) {
		if (entry.pattern.test(normalized)) {
			score += entry.weight;
		}
	}
	return Math.max(0, Math.min(1, score));
}

function withinWindow(messages, senderId, windowMinutes = 15) {
	const cutoff = Date.now() - Number(windowMinutes || 15) * 60 * 1000;
	return messages.filter(
		(row) =>
			String(row.sender_id || "") === String(senderId || "") &&
			new Date(row.timestamp || 0).getTime() >= cutoff,
	);
}

function hasRecentDuplicate(messages, senderId, matchId, text = "") {
	const normalized = normalizeText(text);
	if (!normalized) {
		return false;
	}
	const cutoff = Date.now() - 10 * 60 * 1000;
	return messages.some((row) => {
		if (String(row.sender_id || "") !== String(senderId || "")) {
			return false;
		}
		if (String(row.match_id || "") !== String(matchId || "")) {
			return false;
		}
		if (new Date(row.timestamp || 0).getTime() < cutoff) {
			return false;
		}
		return normalizeText(row.message || "") === normalized;
	});
}

function firstResponsePriority(messages, matchId, senderId) {
	const threadMessages = messages.filter(
		(row) => String(row.match_id || "") === String(matchId || ""),
	);
	const hasSentBefore = threadMessages.some(
		(row) => String(row.sender_id || "") === String(senderId || ""),
	);
	return !hasSentBefore && threadMessages.length <= 2;
}

function queueRanking({ sender, reputationScore, spamScore, config, firstResponse }) {
	const premiumMultiplier =
		String(sender?.subscription_status || "").toLowerCase() === "premium"
			? Number(config?.priority_multipliers?.premium || 1)
			: 1;
	const verifiedMultiplier = sender?.verified
		? Number(config?.priority_multipliers?.verified || 1)
		: 1;

	const premiumVerifiedPriorityScore = Number(
		(premiumMultiplier * verifiedMultiplier * 100).toFixed(2),
	);
	const basePriority = Number(reputationScore || 50) + (firstResponse ? 12 : 0);
	const riskPenalty = Math.round(Number(spamScore || 0) * 70);
	const adjusted = Math.round(basePriority * premiumMultiplier * verifiedMultiplier - riskPenalty);

	if (adjusted >= 90) {
		return {
			queue_rank: "urgent",
			queue_priority_label: "P1-Urgent",
			queue_priority_score: adjusted,
			premium_verified_priority_score: premiumVerifiedPriorityScore,
		};
	}
	if (adjusted >= 65) {
		return {
			queue_rank: "high",
			queue_priority_label: "P2-High",
			queue_priority_score: adjusted,
			premium_verified_priority_score: premiumVerifiedPriorityScore,
		};
	}
	if (adjusted >= 40) {
		return {
			queue_rank: "standard",
			queue_priority_label: "P3-Standard",
			queue_priority_score: adjusted,
			premium_verified_priority_score: premiumVerifiedPriorityScore,
		};
	}
	return {
		queue_rank: "low",
		queue_priority_label: "P4-Low",
		queue_priority_score: adjusted,
		premium_verified_priority_score: premiumVerifiedPriorityScore,
	};
}

function rejectionReason(action, reason, retryAfterSeconds = 0) {
	if (action === "soft_block") {
		return `Rate limit reached. Retry after ${Math.max(1, Number(retryAfterSeconds || 0))} seconds.`;
	}
	if (action === "hard_block" && reason === "duplicate_suppression") {
		return "Duplicate message detected. Please send a unique message.";
	}
	if (action === "hard_block") {
		return "Message blocked by communication safety policy.";
	}
	return "";
}

function limitToPolicyConfigData(row) {
	const mc = row?.message_caps || {};
	const pm = row?.priority_multipliers || {};
	const st = row?.spam_thresholds || {};
	return {
		id: row.id || "global",
		scope: row.scope || "global",
		org_id: row.org_id || null,
		max_outreach_per_window: Number(mc.outbound_per_window) || 12,
		outreach_window_minutes: Number(mc.window_minutes) || 15,
		cooldown_seconds: Number(mc.cooldown_seconds) || 30,
		premium_boost: pm.premium ? Math.round((Number(pm.premium) - 1) * 100) : 20,
		verified_boost: pm.verified ? Math.round((Number(pm.verified) - 1) * 100) : 30,
		keyword_risk_threshold_soft: Number(st.queue) || 0.45,
		keyword_risk_threshold_hard: Number(st.hard_block) || 0.75,
		updated_by: row.updated_by || null,
		updated_at: row.updated_at ? new Date(row.updated_at) : new Date(),
	};
}

async function writeConfigRows(rows) {
	for (const row of rows) {
		const now = new Date();
		await prisma.communicationLimit.upsert({
			where: { id: row.id || "global" },
			create: {
				id: row.id || "global",
				scope: row.scope || "global",
				org_id: row.org_id || null,
				message_caps: row.message_caps || DEFAULT_GLOBAL_CONFIG.message_caps,
				priority_multipliers:
					row.priority_multipliers || DEFAULT_GLOBAL_CONFIG.priority_multipliers,
				strictness_mode: row.strictness_mode || "balanced",
				spam_thresholds: row.spam_thresholds || DEFAULT_GLOBAL_CONFIG.spam_thresholds,
				updated_by: row.updated_by || null,
				updated_at: now,
			},
			update: {
				scope: row.scope || "global",
				org_id: row.org_id || null,
				message_caps: row.message_caps || undefined,
				priority_multipliers: row.priority_multipliers || undefined,
				strictness_mode: row.strictness_mode || undefined,
				spam_thresholds: row.spam_thresholds || undefined,
				updated_by: row.updated_by || null,
				updated_at: now,
			},
		});

		const legacyData = limitToPolicyConfigData(row);
		await prisma.communicationPolicyConfig.upsert({
			where: { id: row.id || "global" },
			create: legacyData,
			update: { ...legacyData, updated_at: now },
		});
	}
}

async function ensureDefaultConfigRows() {
	const [current, legacy] = await Promise.all([
		prisma.communicationLimit.findMany(),
		prisma.communicationPolicyConfig.findMany(),
	]);

	const rows =
		current.length > 0
			? current
			: legacy.length > 0
				? legacy.map((l) => ({
						id: l.id,
						scope: l.scope,
						org_id: l.org_id,
						message_caps: {
							outbound_per_window: l.max_outreach_per_window,
							window_minutes: l.outreach_window_minutes,
							cooldown_seconds: l.cooldown_seconds,
						},
						priority_multipliers: {
							premium: 1 + (l.premium_boost || 20) / 100,
							verified: 1 + (l.verified_boost || 30) / 100,
						},
						strictness_mode: "balanced",
						spam_thresholds: {
							queue: l.keyword_risk_threshold_soft ?? 0.45,
							hard_block: l.keyword_risk_threshold_hard ?? 0.75,
						},
						updated_by: l.updated_by,
						updated_at: l.updated_at?.toISOString(),
					}))
				: [];

	if (!rows.some((row) => row?.id === "global")) {
		rows.push({ ...DEFAULT_GLOBAL_CONFIG, updated_at: toIso() });
	}

	await writeConfigRows(rows);

	return rows;
}

export function evaluatePolicyContract({
	sender = null,
	matchId = "",
	text = "",
	messages = [],
	config = DEFAULT_GLOBAL_CONFIG,
	reputationScore = 50,
}) {
	const normalizedConfig = normalizeConfig(config);
	const strictness = STRICTNESS_MODES[resolveStrictnessMode(normalizedConfig.strictness_mode)];
	const softThreshold = Math.max(
		0.05,
		Math.min(0.95, Number(normalizedConfig.spam_thresholds.queue || 0.45) + strictness.spamDelta),
	);
	const hardThreshold = Math.max(
		softThreshold + 0.05,
		Math.min(
			0.99,
			Number(normalizedConfig.spam_thresholds.hard_block || 0.75) + strictness.spamDelta,
		),
	);

	const spamScore = estimateSpamScore(text);
	const recentMessages = withinWindow(
		messages,
		sender?.id || "",
		normalizedConfig.message_caps.window_minutes,
	);
	const duplicate = hasRecentDuplicate(messages, sender?.id || "", matchId, text);
	const firstResponse = firstResponsePriority(messages, matchId, sender?.id || "");
	const ranking = queueRanking({
		sender,
		reputationScore,
		spamScore,
		config: normalizedConfig,
		firstResponse,
	});

	const baseCap = Math.max(1, Number(normalizedConfig.message_caps.outbound_per_window || 12));
	const capLimit = Math.max(1, Math.floor(baseCap * strictness.capFactor));
	const retryAfterSeconds = Math.max(
		1,
		Number(normalizedConfig.message_caps.cooldown_seconds || 30),
	);

	let action = "allow";
	let reason = "policy_allow";
	let moderationFlag = false;

	if (duplicate) {
		action = "hard_block";
		reason = "duplicate_suppression";
		moderationFlag = true;
	} else if (spamScore >= hardThreshold) {
		action = "hard_block";
		reason = "spam_hard_block";
		moderationFlag = true;
	} else if (recentMessages.length >= capLimit) {
		action = "soft_block";
		reason = "rate_limit_exceeded";
	} else if (spamScore >= softThreshold) {
		action = "queue";
		reason = "spam_soft_queue";
	}

	return {
		action,
		reason,
		spamScore,
		reputationScore,
		retryAfterSeconds: action === "soft_block" ? retryAfterSeconds : 0,
		recentCount: recentMessages.length,
		ranking,
		firstResponse,
		moderationFlag,
	};
}

export async function evaluateMessagePolicy({
	sender = null,
	matchId = "",
	text = "",
	type = "text",
	orgId = "",
}) {
	const [messages, configRows, reputationRows] = await Promise.all([
		prisma.message.findMany(),
		ensureDefaultConfigRows(),
		prisma.senderReputation.findMany(),
	]);

	const configMap = buildConfigMap(configRows);
	const config = resolvePolicyConfig(configMap, orgId);

	const senderId = String(sender?.id || "");
	const nowIso = toIso();
	const reputationIdx = reputationRows.findIndex((row) => String(row.sender_id || "") === senderId);
	const reputation =
		reputationIdx >= 0
			? reputationRows[reputationIdx]
			: {
					id: crypto.randomUUID(),
					sender_id: senderId,
					trust_score: 50,
					spam_reports: 0,
					positive_interactions: 0,
					updated_at: nowIso,
				};

	const reputationScore = Math.max(0, Math.min(100, Number(reputation.trust_score || 50)));
	const contract = evaluatePolicyContract({
		sender,
		matchId,
		text,
		messages,
		config,
		reputationScore,
	});

	const decisionId = crypto.randomUUID();
	const queueId = crypto.randomUUID();

	const logRow = {
		id: decisionId,
		queue_id:
			contract.action === "allow" ||
			contract.action === "soft_block" ||
			contract.action === "hard_block"
				? null
				: queueId,
		sender_id: senderId,
		org_id: orgId || null,
		match_id: sanitizeString(String(matchId || ""), 160),
		action: contract.action,
		reason: contract.reason,
		reputation_score: Number(contract.reputationScore || 0),
		spam_score: Number(contract.spamScore.toFixed(4)),
		frequency_count: contract.recentCount,
		first_response_priority: contract.firstResponse,
		queue_rank: contract.ranking.queue_rank,
		queue_score: contract.ranking.queue_priority_score,
		queue_priority_label: contract.ranking.queue_priority_label,
		premium_verified_priority_score: contract.ranking.premium_verified_priority_score,
		retry_after_seconds: contract.retryAfterSeconds,
		moderation_flag: Boolean(contract.moderationFlag),
		false_positive: false,
		reviewer_id: null,
		reviewer_notes: null,
		created_at: nowIso,
		updated_at: nowIso,
	};

	let queue = null;
	if (contract.action === "queue") {
		queue = {
			id: queueId,
			message_id: null,
			match_id: sanitizeString(String(matchId || ""), 160),
			sender_id: senderId,
			org_id: orgId || null,
			queue_status: "queued",
			queue_rank: contract.ranking.queue_rank,
			queue_score: contract.ranking.queue_priority_score,
			queue_priority_label: contract.ranking.queue_priority_label,
			policy_reason: contract.reason,
			retry_after_seconds: null,
			requires_human_review: false,
			metadata: { message_type: type },
			created_at: nowIso,
			updated_at: nowIso,
		};
	}

	// Read and update metrics from AppState
	const metricsKey = "policy_metrics";
	let metrics = {};
	try {
		const metricsRecord = await prisma.appState.findUnique({
			where: { key: metricsKey },
		});
		if (metricsRecord?.data) {
			metrics = metricsRecord.data;
		}
	} catch {
		metrics = {};
	}

	addMetric(metrics, "total_inbound_outbound_evaluated");
	addMetric(metrics, contract.action);
	if (contract.action === "hard_block" || contract.action === "soft_block") {
		addMetric(metrics, "blocked_total");
	}

	if (contract.action === "queue") {
		addMetric(metrics, "queued_total");
	}

	const blockedTotal = Number(metrics.blocked_total || 0);
	const evaluatedTotal = Number(metrics.total_inbound_outbound_evaluated || 0);
	metrics.blocked_rate = evaluatedTotal ? Number((blockedTotal / evaluatedTotal).toFixed(4)) : 0;

	const queuedTotal = Number(metrics.queued_total || 0);
	const sentFromQueue = Number(metrics.sent_from_queue || 0);
	metrics.queued_to_sent_conversion = queuedTotal
		? Number((sentFromQueue / queuedTotal).toFixed(4))
		: 0;

	const falsePositives = Number(metrics.false_positive_total || 0);
	const spamActions = Number(metrics.hard_block || 0) + Number(metrics.queue || 0);
	metrics.spam_false_positive_ratio = spamActions
		? Number((falsePositives / spamActions).toFixed(4))
		: 0;

	await prisma.$transaction(async (tx) => {
		await tx.messagePolicyLog.create({
			data: {
				id: logRow.id,
				queue_id: logRow.queue_id,
				sender_id: logRow.sender_id,
				org_id: logRow.org_id,
				match_id: logRow.match_id,
				action: logRow.action,
				reason: logRow.reason,
				reputation_score: logRow.reputation_score,
				spam_score: logRow.spam_score,
				frequency_count: logRow.frequency_count,
				first_response_priority: logRow.first_response_priority,
				queue_rank: logRow.queue_rank,
				queue_score: logRow.queue_score,
				queue_priority_label: logRow.queue_priority_label,
				premium_verified_priority_score: logRow.premium_verified_priority_score,
				retry_after_seconds: logRow.retry_after_seconds,
				moderation_flag: logRow.moderation_flag,
				false_positive: logRow.false_positive,
				reviewer_id: logRow.reviewer_id,
				reviewer_notes: logRow.reviewer_notes,
				created_at: new Date(),
				updated_at: new Date(),
			},
		});

		// Also write to legacy message_policy_decisions
		await tx.messagePolicyDecision.create({
			data: {
				id: logRow.id,
				queue_id: logRow.queue_id,
				sender_id: logRow.sender_id,
				org_id: logRow.org_id,
				match_id: logRow.match_id,
				action: logRow.action,
				reason: logRow.reason,
				trust_score: logRow.reputation_score,
				keyword_risk_score: logRow.spam_score,
				frequency_count: logRow.frequency_count,
				first_response_priority: logRow.first_response_priority,
				queue_rank: logRow.queue_rank,
				queue_score: logRow.queue_score,
				queue_priority_label: logRow.queue_priority_label,
				retry_after_seconds: logRow.retry_after_seconds,
				requires_human_review: Boolean(logRow.moderation_flag),
				false_positive: logRow.false_positive,
				reviewer_id: logRow.reviewer_id,
				reviewer_notes: logRow.reviewer_notes,
				created_at: new Date(),
				updated_at: new Date(),
			},
		});

		if (queue) {
			await tx.messageQueueItem.create({
				data: {
					id: queue.id,
					message_id: queue.message_id,
					match_id: queue.match_id,
					sender_id: queue.sender_id,
					org_id: queue.org_id,
					queue_status: queue.queue_status,
					queue_rank: queue.queue_rank,
					queue_score: queue.queue_score,
					queue_priority_label: queue.queue_priority_label,
					policy_reason: queue.policy_reason,
					retry_after_seconds: queue.retry_after_seconds,
					requires_human_review: queue.requires_human_review,
					metadata: queue.metadata,
					created_at: new Date(),
					updated_at: new Date(),
				},
			});

			// Also write to legacy message_queue
			await tx.messageQueue.create({
				data: {
					id: queue.id,
					message_id: queue.message_id,
					match_id: queue.match_id,
					sender_id: queue.sender_id,
					org_id: queue.org_id,
					queue_status: queue.queue_status,
					queue_rank: queue.queue_rank,
					queue_score: queue.queue_score,
					queue_priority_label: queue.queue_priority_label,
					policy_reason: queue.policy_reason,
					retry_after_seconds: queue.retry_after_seconds,
					requires_human_review: queue.requires_human_review,
					metadata: queue.metadata,
					created_at: new Date(),
					updated_at: new Date(),
				},
			});
		}

		if (reputationIdx >= 0) {
			const delta =
				contract.action === "hard_block" ? -3 : contract.action === "soft_block" ? -1.5 : 0.2;
			const updatedTrustScore = Math.max(
				0,
				Math.min(100, Number((reputationScore + delta).toFixed(2))),
			);
			const updatedSpamReports =
				contract.action === "hard_block"
					? Number(reputationRows[reputationIdx].spam_reports || 0) + 1
					: Number(reputationRows[reputationIdx].spam_reports || 0);
			const updatedPositiveInteractions =
				contract.action === "allow"
					? Number(reputationRows[reputationIdx].positive_interactions || 0) + 1
					: Number(reputationRows[reputationIdx].positive_interactions || 0);

			await tx.senderReputation.update({
				where: { id: reputationRows[reputationIdx].id },
				data: {
					trust_score: updatedTrustScore,
					spam_reports: updatedSpamReports,
					positive_interactions: updatedPositiveInteractions,
					updated_at: new Date(),
				},
			});
		} else {
			await tx.senderReputation.create({
				data: {
					id: reputation.id,
					sender_id: reputation.sender_id,
					trust_score: reputation.trust_score,
					spam_reports: reputation.spam_reports,
					positive_interactions: reputation.positive_interactions,
					updated_at: new Date(),
				},
			});
		}

		await tx.appState.upsert({
			where: { key: metricsKey },
			create: { key: metricsKey, data: metrics, updated_at: new Date() },
			update: { data: metrics, updated_at: new Date() },
		});
	});

	return {
		action: contract.action,
		reason: contract.reason,
		queue,
		decision: logRow,
		spam_score: logRow.spam_score,
		reputation_score: logRow.reputation_score,
		premium_verified_priority_score: logRow.premium_verified_priority_score,
		queue_rank: logRow.queue_rank,
		retry_after_seconds: contract.retryAfterSeconds,
		moderation_flag: Boolean(contract.moderationFlag),
		rejection_message: rejectionReason(
			contract.action,
			contract.reason,
			contract.retryAfterSeconds,
		),
	};
}

export async function attachMessageToQueue(queueId, messageId) {
	if (!(queueId && messageId)) {
		return;
	}
	const queueItem = await prisma.messageQueueItem.findUnique({
		where: { id: String(queueId) },
	});
	if (!queueItem) {
		return;
	}

	// Update metrics in AppState
	const metricsKey = "policy_metrics";
	let metrics = {};
	try {
		const metricsRecord = await prisma.appState.findUnique({
			where: { key: metricsKey },
		});
		if (metricsRecord?.data) {
			metrics = metricsRecord.data;
		}
	} catch {
		metrics = {};
	}

	addMetric(metrics, "sent_from_queue");
	const queuedTotal = Number(metrics.queued_total || 0);
	const sentFromQueue = Number(metrics.sent_from_queue || 0);
	metrics.queued_to_sent_conversion = queuedTotal
		? Number((sentFromQueue / queuedTotal).toFixed(4))
		: 0;

	await prisma.$transaction(async (tx) => {
		await tx.messageQueueItem.update({
			where: { id: String(queueId) },
			data: {
				message_id: String(messageId),
				queue_status: "sent",
				updated_at: new Date(),
			},
		});

		await tx.messageQueue.update({
			where: { id: String(queueId) },
			data: {
				message_id: String(messageId),
				queue_status: "sent",
				updated_at: new Date(),
			},
		});

		await tx.appState.upsert({
			where: { key: metricsKey },
			create: { key: metricsKey, data: metrics, updated_at: new Date() },
			update: { data: metrics, updated_at: new Date() },
		});
	});
}

export async function listPolicyFalsePositiveCandidates() {
	const logs = await prisma.messagePolicyLog.findMany({
		where: {
			action: { in: ["hard_block", "queue", "soft_block"] },
		},
		orderBy: { created_at: "desc" },
		take: 250,
	});
	return logs;
}

export async function listMessageQueueItems({ status = "" } = {}) {
	const normalized = String(status || "")
		.trim()
		.toLowerCase();

	const where = normalized ? { queue_status: { equals: normalized } } : {};

	const queueRows = await prisma.messageQueueItem.findMany({
		where,
		orderBy: [{ queue_score: "desc" }, { created_at: "asc" }],
	});
	return queueRows;
}

export async function markPolicyDecisionFalsePositive(decisionId, reviewerId, notes = "") {
	const log = await prisma.messagePolicyLog.findUnique({
		where: { id: String(decisionId || "") },
	});
	if (!log) {
		return null;
	}

	// Update metrics in AppState
	const metricsKey = "policy_metrics";
	let metrics = {};
	try {
		const metricsRecord = await prisma.appState.findUnique({
			where: { key: metricsKey },
		});
		if (metricsRecord?.data) {
			metrics = metricsRecord.data;
		}
	} catch {
		metrics = {};
	}

	addMetric(metrics, "false_positive_total");

	const [updatedLog] = await prisma.$transaction(async (tx) => {
		const log1 = await tx.messagePolicyLog.update({
			where: { id: String(decisionId || "") },
			data: {
				false_positive: true,
				reviewer_id: sanitizeString(String(reviewerId || ""), 120) || null,
				reviewer_notes: sanitizeString(String(notes || ""), 400) || null,
				updated_at: new Date(),
			},
		});

		await tx.messagePolicyDecision.update({
			where: { id: String(decisionId || "") },
			data: {
				false_positive: true,
				reviewer_id: sanitizeString(String(reviewerId || ""), 120) || null,
				reviewer_notes: sanitizeString(String(notes || ""), 400) || null,
				updated_at: new Date(),
			},
		});

		await tx.appState.upsert({
			where: { key: metricsKey },
			create: { key: metricsKey, data: metrics, updated_at: new Date() },
			update: { data: metrics, updated_at: new Date() },
		});

		return [log1];
	});

	return updatedLog;
}

export async function adjustSenderReputation(senderId, delta = 0, _actorId = "", _notes = "") {
	const safeSenderId = sanitizeString(String(senderId || ""), 120);
	if (!safeSenderId) {
		return null;
	}

	const existing = await prisma.senderReputation.findUnique({
		where: { sender_id: safeSenderId },
	});

	const now = new Date();
	if (existing) {
		const current = Number(existing.trust_score || 50);
		await prisma.senderReputation.update({
			where: { id: existing.id },
			data: {
				trust_score: Math.max(0, Math.min(100, Number((current + Number(delta || 0)).toFixed(2)))),
				updated_at: now,
			},
		});
	} else {
		await prisma.senderReputation.create({
			data: {
				id: crypto.randomUUID(),
				sender_id: safeSenderId,
				trust_score: Math.max(0, Math.min(100, Number(50 + delta))),
				spam_reports: 0,
				positive_interactions: 0,
				updated_at: now,
			},
		});
	}

	return prisma.senderReputation.findUnique({
		where: { sender_id: safeSenderId },
	});
}

export async function getWeeklyDecisionQualityReport() {
	const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

	const [logs, metricsRecord] = await Promise.all([
		prisma.messagePolicyLog.findMany({
			where: { created_at: { gte: since } },
		}),
		prisma.appState.findUnique({ where: { key: "policy_metrics" } }),
	]);

	const rows = logs || [];
	const metrics =
		metricsRecord?.data && typeof metricsRecord.data === "object" ? metricsRecord.data : {};

	const byAction = rows.reduce((acc, row) => {
		const key = String(row.action || "unknown");
		acc[key] = Number(acc[key] || 0) + 1;
		return acc;
	}, {});
	const falsePositives = rows.filter((row) => row.false_positive).length;
	const reviewed = rows.filter((row) => row.reviewer_id || row.false_positive).length;

	const responseQualityByRole = rows.reduce((acc, row) => {
		const role = String(row.sender_role || "unknown");
		const base = Number(acc[role] || 0);
		const bonus = row.action === "allow" ? 1 : row.action === "queue" ? 0.4 : -0.8;
		acc[role] = Number((base + bonus).toFixed(3));
		return acc;
	}, {});

	return {
		window: "7d",
		generated_at: toIso(),
		totals: {
			decisions: rows.length,
			false_positives: falsePositives,
			reviewed,
			false_positive_rate: rows.length > 0 ? Number((falsePositives / rows.length).toFixed(4)) : 0,
		},
		by_action: byAction,
		policy_metrics: metrics,
		response_quality_score_by_role: responseQualityByRole,
	};
}

export async function getCommunicationPolicyConfig({ org_id = "" } = {}) {
	const rows = await ensureDefaultConfigRows();
	const map = buildConfigMap(rows);
	return resolvePolicyConfig(map, org_id);
}

export async function upsertCommunicationPolicyConfig({
	scope = "global",
	org_id = null,
	config = {},
	actor_id = "",
}) {
	const safeScope = scope === "org" ? "org" : "global";
	const id = safeScope === "global" ? "global" : `org:${sanitizeString(String(org_id || ""), 120)}`;
	if (safeScope === "org" && !org_id) {
		const err = new Error("org_id is required for org scope policy updates");
		err.status = 400;
		throw err;
	}

	// Read current rows from communication_limits
	const rows = await prisma.communicationLimit.findMany();
	const idx = rows.findIndex((row) => String(row.id || "") === id);
	const base =
		safeScope === "global"
			? DEFAULT_GLOBAL_CONFIG
			: { ...DEFAULT_GLOBAL_CONFIG, scope: "org", org_id };

	const mergedConfig = {
		...(idx >= 0 ? rows[idx] : base),
		...config,
		id,
		scope: safeScope,
		org_id: safeScope === "org" ? org_id : null,
		updated_by: sanitizeString(String(actor_id || ""), 120) || null,
		updated_at: toIso(),
	};

	// Normalize the merged config to ensure nested structure
	const nextRow = normalizeConfig(mergedConfig);

	// Convert to CommunicationLimit shape if needed
	const limitRow = {
		id: nextRow.id,
		scope: nextRow.scope,
		org_id: nextRow.org_id,
		message_caps: nextRow.message_caps,
		priority_multipliers: nextRow.priority_multipliers,
		strictness_mode: nextRow.strictness_mode,
		spam_thresholds: nextRow.spam_thresholds,
		updated_by: nextRow.updated_by,
		updated_at: nextRow.updated_at ? new Date(nextRow.updated_at) : new Date(),
	};

	await writeConfigRows([limitRow]);
	return limitRow;
}
