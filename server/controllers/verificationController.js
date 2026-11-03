import { createNotification } from "../services/notificationService.js";
import { findUserById, setUserVerification } from "../services/userService.js";
import {
	adminApproveVerification,
	adminRejectVerification,
	extendVerificationSubscription,
	getVerification,
	listVerificationQueue,
	revokeExpiredVerifications,
	upsertVerification,
} from "../services/verificationService.js";
import { debitWallet } from "../services/walletService.js";

export async function getMyVerification(req, res) {
	const rec = await getVerification(req.user.id);
	return res.json(rec || { user_id: req.user.id, verified: false, missing_required: [] });
}

export async function submitMyVerification(req, res) {
	const user = await findUserById(req.user.id);
	if (!user) {
		return res.status(404).json({ error: "User not found" });
	}

	try {
		const rec = await upsertVerification(user, req.body?.documents || {});
		return res.json(rec);
	} catch (error) {
		const status = Number(error?.statusCode) || 400;
		return res.status(status).json({ error: error?.message || "Verification data is invalid" });
	}
}

export async function adminApprove(req, res) {
	const rec = await adminApproveVerification(req.params.userId);
	if (!rec) {
		return res.status(404).json({ error: "Verification record not found" });
	}
	await setUserVerification(req.params.userId, rec.verified);
	if (rec.verified) {
		await createNotification(req.params.userId, {
			type: "verification_approved",
			entity_type: "verification",
			entity_id: req.params.userId,
			message: "Your verification has been approved. Your profile is now verified.",
			meta: { review_status: rec.review_status || "approved" },
		});
	}
	return res.json(rec);
}

export async function adminReject(req, res) {
	const reason = req.body?.reason || "Rejected by admin";
	const rec = await adminRejectVerification(req.params.userId, reason);
	if (!rec) {
		return res.status(404).json({ error: "Verification record not found" });
	}
	await setUserVerification(req.params.userId, false);
	await createNotification(req.params.userId, {
		type: "verification_rejected",
		entity_type: "verification",
		entity_id: req.params.userId,
		message: `Verification was rejected. Reason: ${reason}`,
		meta: { review_status: rec.review_status || "rejected", reason },
	});
	return res.json(rec);
}

export async function adminQueue(req, res) {
	const status = req.query.status || "";
	const rows = await listVerificationQueue({ status });
	return res.json({ items: rows });
}

export async function adminRevokeExpired(_req, res) {
	const updated = await revokeExpiredVerifications();
	return res.json({ ok: true, total: updated.length });
}

export async function renewMyVerification(req, res) {
	// project.md: verification is subscription-based and renewed monthly.
	// MVP: wallet-only renewal (no payment gateway yet).
	const FIRST_MONTH_PRICE_USD = 1.99;
	const RENEWAL_PRICE_USD = 6.99;

	const existing = await getVerification(req.user.id);
	const user = await findUserById(req.user.id);
	const freeUntilRaw = user?.profile?.verification_free_until;
	const freeUntil = freeUntilRaw ? new Date(freeUntilRaw) : null;
	const hasFreeWindow =
		freeUntil && Number.isFinite(freeUntil.getTime()) && freeUntil.getTime() > Date.now();
	const isFirstTime = !existing?.subscription_valid_until;
	const priceUsd = hasFreeWindow ? 0 : isFirstTime ? FIRST_MONTH_PRICE_USD : RENEWAL_PRICE_USD;

	let charge = null;
	if (priceUsd > 0) {
		charge = await debitWallet({
			userId: req.user.id,
			amountUsd: priceUsd,
			reason: "verification_renewal",
			ref: `verification:${req.user.id}`,
			allowRestricted: true,
		});
	}

	const verification = await extendVerificationSubscription(req.user.id, 30);
	return res.json({
		ok: true,
		price_usd: priceUsd,
		free_until: hasFreeWindow ? freeUntil.toISOString() : null,
		wallet: charge?.wallet || null,
		wallet_entry: charge?.entry || null,
		verification,
	});
}
