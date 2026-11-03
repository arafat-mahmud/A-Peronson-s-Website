import crypto from "node:crypto";
import prisma from "../utils/prisma.js";
import { sanitizeString } from "../utils/validators.js";

function nowIso() {
	return new Date();
}

function toAmount(value) {
	const num = Number(value);
	if (!Number.isFinite(num) || num <= 0) {
		return 0;
	}
	return Math.round(num * 100) / 100;
}

export async function getWallet(userId) {
	const user = await prisma.user.findUnique({ where: { id: String(userId) } });
	if (!user) {
		return null;
	}
	return {
		user_id: user.id,
		balance_usd: Math.round(Number(user.wallet_balance_usd || 0) * 100) / 100,
		restricted_balance_usd: Math.round(Number(user.wallet_restricted_usd || 0) * 100) / 100,
	};
}

export async function listWalletHistory(userId, limit = 50) {
	const take = Math.max(1, Math.min(200, Number(limit) || 50));
	return prisma.walletHistory.findMany({
		where: { user_id: String(userId) },
		orderBy: { created_at: "desc" },
		take,
	});
}

export async function creditWallet({
	userId,
	amountUsd,
	reason = "",
	ref = "",
	metadata = {},
	restricted = false,
}) {
	const amount = toAmount(amountUsd);
	if (!amount) {
		const err = new Error("Invalid amount");
		err.status = 400;
		throw err;
	}

	const user = await prisma.user.findUnique({ where: { id: String(userId) } });
	if (!user) {
		const err = new Error("User not found");
		err.status = 404;
		throw err;
	}

	const currentBalance = Math.round(Number(user.wallet_balance_usd || 0) * 100) / 100;
	const currentRestricted = Math.round(Number(user.wallet_restricted_usd || 0) * 100) / 100;
	const nextRestricted = restricted
		? Math.round((currentRestricted + amount) * 100) / 100
		: currentRestricted;
	const nextBalance = restricted
		? currentBalance
		: Math.round((currentBalance + amount) * 100) / 100;

	const [historyRow] = await prisma.$transaction(async (tx) => {
		await tx.user.update({
			where: { id: String(userId) },
			data: {
				wallet_balance_usd: nextBalance,
				wallet_restricted_usd: nextRestricted,
				updated_at: nowIso(),
			},
		});

		const row = await tx.walletHistory.create({
			data: {
				id: crypto.randomUUID(),
				user_id: String(userId),
				kind: "credit",
				amount_usd: amount,
				balance_after_usd: nextBalance,
				reason: sanitizeString(String(reason || ""), 80),
				ref: sanitizeString(String(ref || ""), 160),
				meta: {
					...(metadata && typeof metadata === "object" ? metadata : {}),
					restricted_credit: restricted,
					restricted_balance_after_usd: nextRestricted,
				},
			},
		});

		return [row];
	});

	return {
		wallet: {
			user_id: String(userId),
			balance_usd: nextBalance,
			restricted_balance_usd: nextRestricted,
		},
		entry: historyRow,
	};
}

export async function debitWallet({
	userId,
	amountUsd,
	reason = "",
	ref = "",
	metadata = {},
	allowRestricted = false,
}) {
	const amount = toAmount(amountUsd);
	if (!amount) {
		const err = new Error("Invalid amount");
		err.status = 400;
		throw err;
	}

	const user = await prisma.user.findUnique({ where: { id: String(userId) } });
	if (!user) {
		const err = new Error("User not found");
		err.status = 404;
		throw err;
	}

	const currentBalance = Math.round(Number(user.wallet_balance_usd || 0) * 100) / 100;
	const currentRestricted = Math.round(Number(user.wallet_restricted_usd || 0) * 100) / 100;
	const available = allowRestricted ? currentBalance + currentRestricted : currentBalance;
	if (available < amount) {
		const err = new Error(`Insufficient wallet balance. Needed $${amount.toFixed(2)}.`);
		err.status = 402;
		err.code = "WALLET_INSUFFICIENT";
		err.balance_usd = currentBalance;
		err.restricted_balance_usd = currentRestricted;
		throw err;
	}

	let restrictedUsed = 0;
	let unrestrictedUsed = amount;
	if (allowRestricted && currentRestricted > 0) {
		restrictedUsed = Math.min(currentRestricted, amount);
		unrestrictedUsed = Math.max(0, amount - restrictedUsed);
	}

	const nextRestricted = Math.round((currentRestricted - restrictedUsed) * 100) / 100;
	const nextBalance = Math.round((currentBalance - unrestrictedUsed) * 100) / 100;

	const [row] = await prisma.$transaction(async (tx) => {
		await tx.user.update({
			where: { id: String(userId) },
			data: {
				wallet_balance_usd: nextBalance,
				wallet_restricted_usd: nextRestricted,
				updated_at: new Date(),
			},
		});

		const entry = await tx.walletHistory.create({
			data: {
				id: crypto.randomUUID(),
				user_id: String(userId),
				kind: "debit",
				amount_usd: amount,
				balance_after_usd: nextBalance,
				reason: sanitizeString(String(reason || ""), 80),
				ref: sanitizeString(String(ref || ""), 160),
				meta: {
					...(metadata && typeof metadata === "object" ? metadata : {}),
					restricted_used_usd: restrictedUsed,
					restricted_balance_after_usd: nextRestricted,
				},
			},
		});

		return [entry];
	});

	return {
		wallet: {
			user_id: String(userId),
			balance_usd: nextBalance,
			restricted_balance_usd: nextRestricted,
		},
		entry: row,
	};
}

function normalizeCouponCode(code = "") {
	return sanitizeString(String(code || ""), 80)
		.trim()
		.toUpperCase();
}

function isExpired(expiresAt) {
	if (!expiresAt) {
		return false;
	}
	const ts = new Date(expiresAt).getTime();
	if (!Number.isFinite(ts)) {
		return false;
	}
	return ts < Date.now();
}

export async function assertCouponRedeemable(code, userId = "") {
	const normalized = normalizeCouponCode(code);
	if (!normalized) {
		const err = new Error("Coupon code is required");
		err.status = 400;
		throw err;
	}

	const coupon = await prisma.couponCode.findUnique({
		where: { code: normalized },
	});

	if (!coupon?.active) {
		const err = new Error("Invalid or inactive coupon code");
		err.status = 404;
		throw err;
	}
	if (isExpired(coupon.expires_at?.toISOString())) {
		const err = new Error("Coupon code has expired");
		err.status = 410;
		throw err;
	}

	const redemptionCount = await prisma.couponRedemption.count({
		where: { code_id: coupon.id },
	});

	if (coupon.max_redemptions && redemptionCount >= coupon.max_redemptions) {
		const err = new Error("Coupon code has reached its redemption limit");
		err.status = 409;
		throw err;
	}

	if (userId) {
		const already = await prisma.couponRedemption.findFirst({
			where: { code_id: coupon.id, user_id: String(userId) },
		});
		if (already) {
			const err = new Error("Coupon code already redeemed");
			err.status = 409;
			throw err;
		}
	}

	return coupon;
}

function normalizeCouponPayload(payload = {}) {
	const code = normalizeCouponCode(payload.code || "");
	const amount = toAmount(payload.amount_usd ?? payload.amountUsd ?? 5);
	const marketingSource = sanitizeString(String(payload.marketing_source || ""), 120).trim();
	const campaign = sanitizeString(String(payload.campaign || ""), 120).trim();
	const createdBy = sanitizeString(String(payload.created_by || ""), 120).trim();
	const freeMonthsRaw =
		payload.verification_free_months ??
		payload.verificationFreeMonths ??
		payload.free_verification_months ??
		payload.freeVerificationMonths;
	const freeMonths = Number.isFinite(Number(freeMonthsRaw))
		? Math.max(0, Math.floor(Number(freeMonthsRaw)))
		: 0;
	const requiresCard =
		payload.requires_card === undefined
			? payload.requiresCard === undefined
				? false
				: Boolean(payload.requiresCard)
			: Boolean(payload.requires_card);
	const maxRedemptions =
		payload.max_redemptions !== undefined && payload.max_redemptions !== null
			? Number(payload.max_redemptions)
			: payload.maxRedemptions !== undefined && payload.maxRedemptions !== null
				? Number(payload.maxRedemptions)
				: null;
	const expiresAt = payload.expires_at || payload.expiresAt || "";
	let normalizedExpires = null;
	if (expiresAt) {
		const parsed = new Date(expiresAt);
		if (!Number.isNaN(parsed.getTime())) {
			normalizedExpires = parsed.toISOString();
		}
	}
	const roleRestrictionsRaw =
		payload.role_restrictions ?? payload.roleRestrictions ?? payload.roles ?? [];
	const roleRestrictions = Array.isArray(roleRestrictionsRaw)
		? roleRestrictionsRaw
				.map((role) => sanitizeString(String(role || ""), 40).toLowerCase())
				.filter(Boolean)
		: String(roleRestrictionsRaw || "")
				.split(",")
				.map((role) => sanitizeString(role.trim(), 40).toLowerCase())
				.filter(Boolean);

	return {
		code,
		amount_usd: amount,
		active: payload.active === undefined ? true : Boolean(payload.active),
		max_redemptions:
			Number.isFinite(maxRedemptions) && maxRedemptions > 0 ? Math.floor(maxRedemptions) : null,
		expires_at: normalizedExpires,
		created_by: createdBy || null,
		marketing_source: marketingSource || null,
		campaign: campaign || null,
		role_restrictions: roleRestrictions.length > 0 ? roleRestrictions : null,
		verification_free_months: freeMonths || null,
		requires_card: requiresCard || null,
	};
}

export async function listCouponCodes() {
	return prisma.couponCode.findMany({
		orderBy: { created_at: "desc" },
	});
}

export async function createCouponCode(payload = {}) {
	const normalized = normalizeCouponPayload(payload);
	if (!normalized.code) {
		const err = new Error("Coupon code is required");
		err.status = 400;
		throw err;
	}
	if (!normalized.amount_usd) {
		const err = new Error("Coupon amount is invalid");
		err.status = 400;
		throw err;
	}

	const exists = await prisma.couponCode.findUnique({
		where: { code: normalized.code },
	});
	if (exists) {
		const err = new Error("Coupon code already exists");
		err.status = 409;
		throw err;
	}

	return prisma.couponCode.create({
		data: {
			id: crypto.randomUUID(),
			code: normalized.code,
			amount_usd: normalized.amount_usd,
			active: normalized.active,
			max_redemptions: normalized.max_redemptions,
			expires_at: normalized.expires_at ? new Date(normalized.expires_at) : null,
			created_by: normalized.created_by,
			marketing_source: normalized.marketing_source,
			created_at: new Date(),
		},
	});
}

export async function redeemCouponForUser({ userId, code }) {
	const normalized = normalizeCouponCode(code);
	const coupon = await assertCouponRedeemable(normalized, userId);
	const amount = toAmount(coupon.amount_usd || 0);
	if (!amount) {
		const err = new Error("Coupon amount is invalid");
		err.status = 400;
		throw err;
	}

	const user = await prisma.user.findUnique({ where: { id: String(userId) } });
	if (!user) {
		const err = new Error("User not found");
		err.status = 404;
		throw err;
	}

	if (coupon.requires_card && !user.profile?.payment_method_on_file) {
		const err = new Error("Payment method required to redeem this coupon.");
		err.status = 402;
		err.code = "PAYMENT_METHOD_REQUIRED";
		throw err;
	}

	const roleRestrictions = Array.isArray(coupon.role_restrictions) ? coupon.role_restrictions : [];
	if (roleRestrictions.length > 0) {
		const userRole = String(user.role || "").toLowerCase();
		if (!roleRestrictions.includes(userRole)) {
			const err = new Error("Coupon code is not valid for this account role.");
			err.status = 403;
			err.code = "ROLE_NOT_ELIGIBLE";
			throw err;
		}
	}

	const currentRestricted = Math.round(Number(user.wallet_restricted_usd || 0) * 100) / 100;
	const nextRestricted = Math.round((currentRestricted + amount) * 100) / 100;
	const freeMonths = Number(coupon.verification_free_months || 0);
	let nextProfile = user.profile || {};
	if (Number.isFinite(freeMonths) && freeMonths > 0) {
		const freeUntil = new Date();
		freeUntil.setDate(freeUntil.getDate() + freeMonths * 30);
		nextProfile = {
			...nextProfile,
			verification_free_until: freeUntil.toISOString(),
			verification_free_months: freeMonths,
			verification_free_source: coupon.code || coupon.id,
		};
	}

	const [redemption] = await prisma.$transaction(async (tx) => {
		await tx.user.update({
			where: { id: String(userId) },
			data: {
				profile: nextProfile,
				wallet_restricted_usd: nextRestricted,
				updated_at: new Date(),
			},
		});

		const red = await tx.couponRedemption.create({
			data: {
				id: crypto.randomUUID(),
				code_id: coupon.id,
				user_id: String(userId),
				amount_usd: amount,
				redeemed_at: new Date(),
			},
		});

		const _balanceAfter = Math.round(Number(user.wallet_balance_usd || 0) * 100) / 100;

		await tx.walletHistory.create({
			data: {
				id: crypto.randomUUID(),
				user_id: String(userId),
				kind: "credit",
				amount_usd: amount,
				balance_after_usd: _balanceAfter,
				reason: "coupon_redeem",
				ref: `coupon:${coupon.code}`,
				meta: {
					restricted_credit: true,
					restricted_balance_after_usd: nextRestricted,
					coupon_id: coupon.id,
					coupon_code: coupon.code,
					marketing_source: coupon.marketing_source || null,
					campaign: coupon.campaign || null,
					role_restrictions: Array.isArray(coupon.role_restrictions)
						? coupon.role_restrictions
						: null,
					verification_free_months: Number(coupon.verification_free_months || 0) || null,
					requires_card: Boolean(coupon.requires_card),
				},
			},
		});

		return [red];
	});

	return {
		wallet: {
			user_id: String(userId),
			balance_usd: user?.wallet_balance_usd || 0,
			restricted_balance_usd: nextRestricted,
		},
		redemption,
	};
}
