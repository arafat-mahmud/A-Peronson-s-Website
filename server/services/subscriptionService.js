import crypto from "node:crypto";
import prisma from "../utils/prisma.js";
import { recordSubscriptionEvent } from "./subscriptionHistoryService.js";

function nowIso() {
	return new Date();
}

function plusDays(days) {
	return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

function diffDaysFromNow(endDate) {
	const endTime = new Date(endDate || "").getTime();
	if (!Number.isFinite(endTime)) {
		return 0;
	}
	const diffMs = endTime - Date.now();
	if (diffMs <= 0) {
		return 0;
	}
	return Math.ceil(diffMs / (24 * 60 * 60 * 1000));
}

export async function getSubscription(userId) {
	return prisma.subscription.findFirst({ where: { user_id: userId } });
}

export async function upsertSubscription(userId, plan = "free", autoRenew = true, meta = {}) {
	const existing = await prisma.subscription.findFirst({
		where: { user_id: userId },
	});
	const previousPlan = existing?.plan || "";
	const start = nowIso();
	const end = plan === "premium" ? plusDays(30) : plusDays(3650);

	if (existing) {
		await prisma.subscription.update({
			where: { id: existing.id },
			data: {
				plan,
				start_date: start,
				end_date: end,
				auto_renew: Boolean(autoRenew),
			},
		});
	} else {
		await prisma.subscription.create({
			data: {
				id: crypto.randomUUID(),
				user_id: userId,
				plan,
				start_date: start,
				end_date: end,
				auto_renew: Boolean(autoRenew),
			},
		});
	}

	const next = {
		user_id: userId,
		plan,
		start_date: start.toISOString(),
		end_date: end.toISOString(),
		auto_renew: Boolean(autoRenew),
	};
	const action =
		previousPlan && previousPlan !== plan ? (plan === "premium" ? "upgrade" : "downgrade") : "set";
	await recordSubscriptionEvent({
		userId,
		plan,
		previousPlan,
		action,
		actorId: meta?.actor_id || "",
		source: meta?.source || "system",
		note: meta?.note || "",
	});
	return next;
}

export async function renewPremiumMonthly(userId, autoRenew = true, meta = {}) {
	const existing = await prisma.subscription.findFirst({
		where: { user_id: userId },
	});
	const previousPlan = existing?.plan || "";

	const currentEndTime = existing?.end_date ? new Date(existing.end_date).getTime() : Number.NaN;
	const baseTime =
		Number.isFinite(currentEndTime) && currentEndTime > Date.now() ? currentEndTime : Date.now();
	const end = new Date(baseTime + 30 * 24 * 60 * 60 * 1000);
	const start = nowIso();

	if (existing) {
		await prisma.subscription.update({
			where: { id: existing.id },
			data: {
				plan: "premium",
				start_date: start,
				end_date: end,
				auto_renew: Boolean(autoRenew),
			},
		});
	} else {
		await prisma.subscription.create({
			data: {
				id: crypto.randomUUID(),
				user_id: userId,
				plan: "premium",
				start_date: start,
				end_date: end,
				auto_renew: Boolean(autoRenew),
			},
		});
	}

	await recordSubscriptionEvent({
		userId,
		plan: "premium",
		previousPlan,
		action: "renew",
		actorId: meta?.actor_id || "",
		source: meta?.source || "system",
		note: meta?.note || "",
	});
	return {
		user_id: userId,
		plan: "premium",
		start_date: start.toISOString(),
		end_date: end.toISOString(),
		auto_renew: Boolean(autoRenew),
	};
}

export async function getRemainingDays(userId) {
	const sub = await getSubscription(userId);
	if (!sub) {
		return 0;
	}
	return diffDaysFromNow(sub.end_date);
}

export async function isSubscriptionValid(userId) {
	const sub = await getSubscription(userId);
	if (!sub) {
		return false;
	}
	return diffDaysFromNow(sub.end_date) > 0;
}
