import { createCouponCode, listCouponCodes } from "../services/walletService.js";

export async function listCoupons(_req, res) {
	const rows = await listCouponCodes();
	return res.json({ items: rows });
}

export async function createCoupon(req, res) {
	try {
		const row = await createCouponCode({
			code: req.body?.code,
			amount_usd: req.body?.amount_usd,
			active: req.body?.active,
			max_redemptions: req.body?.max_redemptions,
			expires_at: req.body?.expires_at,
			marketing_source: req.body?.marketing_source,
			verification_free_months: req.body?.verification_free_months,
			requires_card: req.body?.requires_card,
			created_by: req.user?.id,
		});
		return res.status(201).json(row);
	} catch (error) {
		return res
			.status(error.status || 400)
			.json({ error: error.message || "Unable to create coupon" });
	}
}
