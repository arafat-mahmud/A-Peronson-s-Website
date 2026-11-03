import { cancelBoost, listBoostsForUser, purchaseBoost } from "../services/boostService.js";
import { ensureEntitlement } from "../services/entitlementService.js";
import { handleControllerError } from "../utils/permissions.js";

export async function getMyBoosts(req, res) {
	const items = await listBoostsForUser(req.user.id);
	return res.json({ items });
}

export async function createBoost(req, res) {
	try {
		const scope = String(req.body?.scope || "").toLowerCase();
		const feature = scope === "profile" ? "profile_boost" : "product_boost";
		await ensureEntitlement(req.user, feature, "Premium boost requires an active subscription.");
		const result = await purchaseBoost(req.user.id, req.body || {});
		if (result === "active_exists") {
			return res.status(409).json({ error: "An active boost already exists for this scope." });
		}
		return res.status(201).json(result);
	} catch (error) {
		return handleControllerError(res, error);
	}
}

export async function cancelBoostController(req, res) {
	const result = await cancelBoost(req.user.id, req.params.boostId);
	if (!result) {
		return res.status(404).json({ error: "Boost not found" });
	}
	if (result === "forbidden") {
		return res.status(403).json({ error: "Forbidden" });
	}
	return res.json(result);
}
