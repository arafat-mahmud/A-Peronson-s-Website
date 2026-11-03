import {
	getRemainingDays,
	getSubscription,
	renewPremiumMonthly,
	upsertSubscription,
} from "../services/subscriptionService.js";
import { findUserById } from "../services/userService.js";
import { markVerificationExpiringSoon } from "../services/verificationService.js";
import { debitWallet } from "../services/walletService.js";

// What /me/renew-monthly charges to the wallet. The billing UI reads these
// from GET /me, so the amount a user is shown is the amount they pay.
const PREMIUM_FIRST_MONTH_USD = 1.99;
const PREMIUM_RENEWAL_USD = 6.99;

function premiumPricing(sub) {
	const isPremium = String(sub?.plan || "").toLowerCase() === "premium";
	return {
		first_month_usd: PREMIUM_FIRST_MONTH_USD,
		renewal_usd: PREMIUM_RENEWAL_USD,
		next_charge_usd: isPremium ? PREMIUM_RENEWAL_USD : PREMIUM_FIRST_MONTH_USD,
		currency: "USD",
		period_days: 30,
	};
}

export async function getMySubscription(req, res) {
	const sub = await getSubscription(req.user.id);
	const current = sub || {
		user_id: req.user.id,
		plan: "free",
		start_date: "",
		end_date: "",
		auto_renew: true,
	};
	return res.json({ ...current, pricing: premiumPricing(sub) });
}

// Self-service can only cancel (move to Free). Premium is granted by a paid
// renewal (/me/renew-monthly, charged to the wallet) or by an admin.
export async function updateMySubscription(req, res) {
	if (req.body?.plan === "premium") {
		return res.status(402).json({ error: "Premium is activated through billing (renew-monthly)." });
	}
	const plan = "free";
	const sub = await upsertSubscription(req.user.id, plan, req.body?.auto_renew, {
		actor_id: req.user.id,
		source: "user_request",
		note: "self_service",
	});
	return res.json(sub);
}

export async function adminSetUserSubscription(req, res) {
	const user = await findUserById(req.params.userId);
	if (!user) {
		return res.status(404).json({ error: "User not found" });
	}
	const plan = req.body?.plan === "premium" ? "premium" : "free";
	const sub = await upsertSubscription(user.id, plan, req.body?.auto_renew, {
		actor_id: req.user.id,
		source: "admin_request",
		note: "subscription_override",
	});
	return res.json(sub);
}

// The verification page shows these before the user pays; they must match
// what verificationController charges (FIRST_MONTH / RENEWAL).
export async function getMyVerificationPricing(_req, res) {
	return res.json({ first_month: 1.99, renewal: 6.99, currency: "USD" });
}

export async function renewMyPremiumMonthly(req, res) {
	const existing = await getSubscription(req.user.id);
	const priceUsd = premiumPricing(existing).next_charge_usd;

	try {
		const charge = await debitWallet({
			userId: req.user.id,
			amountUsd: priceUsd,
			reason: "subscription_renewal",
			ref: `subscription:${req.user.id}`,
			allowRestricted: true,
		});
		const sub = await renewPremiumMonthly(req.user.id, req.body?.auto_renew);
		return res.json({
			...sub,
			price_usd: priceUsd,
			wallet: charge.wallet,
			wallet_entry: charge.entry,
		});
	} catch (error) {
		return res
			.status(error.status || 400)
			.json({ error: error.message || "Unable to renew subscription" });
	}
}

export async function getMyRemainingDays(req, res) {
	const remaining_days = await getRemainingDays(req.user.id);
	return res.json({ user_id: req.user.id, remaining_days });
}

export async function markMyVerificationExpiringSoon(req, res) {
	const remainingDays = await getRemainingDays(req.user.id);
	const rec = await markVerificationExpiringSoon(
		req.user.id,
		remainingDays,
		req.body?.threshold_days || 7,
	);
	if (!rec) {
		return res.status(404).json({ error: "Verification record not found" });
	}
	return res.json(rec);
}
