import crypto from "node:crypto";
import { boostPriceUsd, normalizeBoostDuration } from "../../shared/config/boostPricing.js";
import prisma from "../utils/prisma.js";
import { sanitizeString } from "../utils/validators.js";
import { trackEvent } from "./eventTrackingService.js";
import { debitWallet } from "./walletService.js";

const DEFAULTS = {
	durationDays: Number(process.env.BOOST_DEFAULT_DURATION_DAYS || 7),
	multiplier: Number(process.env.BOOST_DEFAULT_MULTIPLIER || 1.5),
	priceUsd: Number(process.env.BOOST_DEFAULT_PRICE_USD || 9.99),
};

const ALLOWED_SCOPES = new Set(["feed", "profile"]);

function _nowIso() {
	return new Date().toISOString();
}

function _addDaysIso(days) {
	const safeDays = Number(days) > 0 ? Number(days) : DEFAULTS.durationDays;
	return new Date(Date.now() + safeDays * 24 * 60 * 60 * 1000).toISOString();
}

function normalizeScope(scope) {
	const value = sanitizeString(String(scope || ""), 20).toLowerCase();
	return ALLOWED_SCOPES.has(value) ? value : "feed";
}

function normalizeMultiplier(multiplier) {
	const value = Number(multiplier);
	if (!Number.isFinite(value) || value <= 1) {
		return DEFAULTS.multiplier;
	}
	return Math.min(3, Math.max(1.05, value));
}

function _isActiveBoost(boost) {
	if (!boost) {
		return false;
	}
	if (String(boost.status || "").toLowerCase() !== "active") {
		return false;
	}
	const now = Date.now();
	const startsAt = new Date(boost.starts_at).getTime();
	const endsAt = new Date(boost.ends_at).getTime();
	if (!(Number.isFinite(startsAt) && Number.isFinite(endsAt))) {
		return false;
	}
	return now >= startsAt && now <= endsAt;
}

export async function getActiveBoostMap(scope = "") {
	const normalizedScope = scope ? normalizeScope(scope) : "";
	const now = new Date();
	const where = {
		status: "active",
		starts_at: { lte: now },
		ends_at: { gte: now },
	};
	if (normalizedScope) {
		where.scope = normalizedScope;
	}

	const boosts = await prisma.boost.findMany({ where });
	const activeByUser = {};

	boosts.forEach((boost) => {
		const userId = String(boost.user_id || "");
		if (!userId) {
			return;
		}
		const multiplier = Number(boost.multiplier || 1);
		if (!Number.isFinite(multiplier) || multiplier <= 1) {
			return;
		}
		const current = Number(activeByUser[userId] || 1);
		if (multiplier > current) {
			activeByUser[userId] = multiplier;
		}
	});

	return activeByUser;
}

export async function listBoostsForUser(userId) {
	return prisma.boost.findMany({
		where: { user_id: String(userId) },
		orderBy: { created_at: "desc" },
	});
}

export async function getActiveBoostsForUser(userId, scope = "") {
	const normalizedScope = scope ? normalizeScope(scope) : "";
	const now = new Date();
	const where = {
		user_id: String(userId),
		status: "active",
		starts_at: { lte: now },
		ends_at: { gte: now },
	};
	if (normalizedScope) {
		where.scope = normalizedScope;
	}

	return prisma.boost.findMany({ where });
}

export async function getActiveBoostMultiplier(userId, scope = "") {
	const active = await getActiveBoostsForUser(userId, scope);
	if (active.length === 0) {
		return 1;
	}
	const maxMultiplier = active.reduce((acc, b) => Math.max(acc, Number(b.multiplier || 1)), 1);
	return Number.isFinite(maxMultiplier) && maxMultiplier > 1 ? maxMultiplier : 1;
}

export async function purchaseBoost(userId, payload = {}) {
	const scope = normalizeScope(payload.scope);
	// Duration comes from a fixed list and the price is computed here; a
	// client-supplied price_usd is ignored.
	const durationDays = normalizeBoostDuration(payload.duration_days || payload.durationDays);
	const multiplier = normalizeMultiplier(payload.multiplier);
	const priceUsd = boostPriceUsd(durationDays, DEFAULTS.priceUsd);

	const now = new Date();
	const _endsAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);

	const hasActive = await prisma.boost.findFirst({
		where: {
			user_id: String(userId),
			scope,
			status: "active",
			starts_at: { lte: now },
			ends_at: { gte: now },
		},
	});
	if (hasActive) {
		return "active_exists";
	}

	await debitWallet({
		userId,
		amountUsd: priceUsd,
		reason: "boost_purchase",
		ref: `boost:${scope}`,
		metadata: { scope, multiplier, duration_days: durationDays },
	});

	const row = await prisma.boost.create({
		data: {
			id: crypto.randomUUID(),
			user_id: String(userId),
			scope,
			multiplier,
			status: "active",
			starts_at: now,
			ends_at: _endsAt,
			price_usd: priceUsd,
			created_at: now,
		},
	});

	await trackEvent({
		type: "boost_purchase",
		actor_id: String(userId),
		entity_id: row.id,
		metadata: {
			scope,
			multiplier,
			duration_days: durationDays,
			price_usd: priceUsd,
		},
	});

	return row;
}

export async function cancelBoost(userId, boostId) {
	const boost = await prisma.boost.findUnique({
		where: { id: String(boostId) },
	});
	if (!boost) {
		return null;
	}
	if (String(boost.user_id) !== String(userId || "")) {
		return "forbidden";
	}

	const next = await prisma.boost.update({
		where: { id: String(boostId) },
		data: {
			status: "cancelled",
			cancelled_at: new Date(),
		},
	});

	await trackEvent({
		type: "boost_cancelled",
		actor_id: String(userId),
		entity_id: next.id,
		metadata: { scope: next.scope },
	});

	return next;
}

export async function expireBoosts() {
	const now = new Date();
	await prisma.boost.updateMany({
		where: { status: "active", ends_at: { lt: now } },
		data: { status: "expired" },
	});
	return prisma.boost.findMany();
}
