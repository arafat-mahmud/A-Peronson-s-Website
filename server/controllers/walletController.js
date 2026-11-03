import {
	assertCouponRedeemable,
	getWallet,
	listWalletHistory,
	redeemCouponForUser,
} from "../services/walletService.js";

export async function getMyWallet(req, res) {
	const wallet = await getWallet(req.user.id);
	if (!wallet) {
		return res.status(404).json({ error: "Wallet not found" });
	}
	return res.json(wallet);
}

export async function getMyWalletHistory(req, res) {
	const limit = req.query?.limit || 50;
	const items = await listWalletHistory(req.user.id, limit);
	return res.json({ items });
}

export async function validateCoupon(req, res) {
	const code = String(req.body?.code || "").trim();
	if (!code) {
		return res.status(400).json({ error: "Coupon code is required" });
	}
	try {
		const coupon = await assertCouponRedeemable(code, req.user.id);
		return res.json({
			valid: true,
			code: coupon.code,
			amount_usd: coupon.amount_usd,
			expires_at: coupon.expires_at,
			verification_free_months: coupon.verification_free_months || 0,
			requires_card: Boolean(coupon.requires_card),
		});
	} catch (error) {
		return res
			.status(error.status || 400)
			.json({ valid: false, error: error.message || "Invalid coupon" });
	}
}

export async function redeemCoupon(req, res) {
	const code = String(req.body?.code || "").trim();
	if (!code) {
		return res.status(400).json({ error: "Coupon code is required" });
	}
	try {
		const result = await redeemCouponForUser({ userId: req.user.id, code });
		return res.json(result);
	} catch (error) {
		return res
			.status(error.status || 400)
			.json({ error: error.message || "Unable to redeem coupon" });
	}
}
