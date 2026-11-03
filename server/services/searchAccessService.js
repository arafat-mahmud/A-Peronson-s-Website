import {
	FILTER_TIERS,
	PLAN_DAILY_LIMITS,
	PLAN_FILTER_ACCESS,
	SEARCH_CAPABILITIES,
} from "../config/searchAccessConfig.js";
import prisma from "../utils/prisma.js";
import { getAdminConfig } from "./adminConfigService.js";
import { getSubscription } from "./subscriptionService.js";

function todayKey() {
	return new Date().toISOString().slice(0, 10);
}

function resolvePlan(plan) {
	return plan === "premium" ? "premium" : "free";
}

export async function getUserPlan(userId) {
	const sub = await getSubscription(userId);
	return resolvePlan(sub?.plan);
}

export function extractUsedAdvancedFilters(filters = {}) {
	return FILTER_TIERS.advanced.filter((key) => {
		const value = filters[key];
		if (typeof value === "boolean") {
			return value;
		}
		return value !== undefined && value !== null && String(value).trim() !== "";
	});
}

export function canUseAdvancedFilters(plan) {
	const resolvedPlan = resolvePlan(plan);
	const allowed = PLAN_FILTER_ACCESS[resolvedPlan]?.allowedTiers || ["basic"];
	return allowed.includes("advanced");
}

async function upsertUsageRow(userId, action, dateKey, incrementBy = 0) {
	const existing = await prisma.searchUsageCounter.findFirst({
		where: { user_id: userId, action },
	});

	if (existing) {
		const nextCount =
			existing.date === dateKey ? Number(existing.count || 0) + incrementBy : incrementBy;
		if (existing.date !== dateKey) {
			return prisma.searchUsageCounter.update({
				where: { id: existing.id },
				data: {
					date: dateKey,
					count: Math.max(0, nextCount),
					updated_at: new Date(),
					reset_at: new Date(),
				},
			});
		}
		return prisma.searchUsageCounter.update({
			where: { id: existing.id },
			data: {
				date: dateKey,
				count: Math.max(0, nextCount),
				updated_at: new Date(),
			},
		});
	}

	return prisma.searchUsageCounter.create({
		data: {
			user_id: userId,
			action,
			date: dateKey,
			count: Math.max(0, incrementBy),
			updated_at: new Date(),
		},
	});
}

export async function getQuotaSnapshot(userId, action, plan) {
	const resolvedPlan = resolvePlan(plan);
	const config = await getAdminConfig();
	const configuredSearchDaily = Number(config?.plan_limits?.[resolvedPlan]?.search_daily || 0);
	const fallbackLimit = Number(PLAN_DAILY_LIMITS[resolvedPlan]?.[action] || 0);
	const dailyLimit = configuredSearchDaily > 0 ? configuredSearchDaily : fallbackLimit;
	const today = todayKey();
	const usage = await prisma.searchUsageCounter.findFirst({
		where: { user_id: userId, action },
	});

	let used = 0;
	if (usage?.date === today) {
		used = Number(usage.count || 0);
	} else if (usage) {
		await upsertUsageRow(userId, action, today, 0);
	}

	const remaining = Math.max(0, dailyLimit - used);
	return {
		action,
		plan: resolvedPlan,
		date: today,
		daily_limit: dailyLimit,
		used,
		remaining,
	};
}

export async function consumeQuota(userId, action, plan) {
	const snapshot = await getQuotaSnapshot(userId, action, plan);
	if (snapshot.remaining <= 0) {
		return { allowed: false, quota: snapshot };
	}

	await upsertUsageRow(userId, action, snapshot.date, 1);
	return {
		allowed: true,
		quota: {
			...snapshot,
			used: snapshot.used + 1,
			remaining: Math.max(0, snapshot.remaining - 1),
		},
	};
}

export function getSearchCapabilities(plan) {
	const resolvedPlan = resolvePlan(plan);
	const capabilities = SEARCH_CAPABILITIES[resolvedPlan];
	return {
		plan: resolvedPlan,
		...capabilities,
	};
}

export function buildSearchAccessPayload({
	action,
	plan,
	quota,
	missingFilters = [],
	upgradeRequired = false,
}) {
	const capabilities = getSearchCapabilities(plan);
	return {
		action,
		plan: capabilities.plan,
		capabilities,
		quota,
		requirements: {
			upgrade_required: Boolean(upgradeRequired || missingFilters.length > 0),
			...(missingFilters.length > 0 ? { advanced_filters: missingFilters } : {}),
		},
	};
}

export function buildLimitError({
	code,
	message,
	quota,
	missingFilters = [],
	upgradeRequired = false,
}) {
	const action = quota?.action || null;
	const plan = quota?.plan || "free";
	const access = buildSearchAccessPayload({
		action,
		plan,
		quota,
		missingFilters,
		upgradeRequired,
	});

	return {
		error: message,
		code,
		action,
		plan,
		quota,
		remaining_quota: quota?.remaining ?? 0,
		requirements: access.requirements,
		capabilities: access.capabilities,
		...(missingFilters.length > 0 ? { advanced_filters: missingFilters } : {}),
	};
}
