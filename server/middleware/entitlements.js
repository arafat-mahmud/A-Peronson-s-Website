import { ensureEntitlement } from "../services/entitlementService.js";

export function requireEntitlement(feature, message = "") {
	return async (req, res, next) => {
		try {
			await ensureEntitlement(req.user, feature, message);
			return next();
		} catch (error) {
			return res.status(error?.status || 403).json({
				error: error?.message || "Premium plan required",
				code: error?.code || "PREMIUM_REQUIRED",
				feature: error?.feature || feature,
			});
		}
	};
}
