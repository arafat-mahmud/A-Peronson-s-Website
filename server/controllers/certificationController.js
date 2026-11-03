import {
	getCertificationSummary,
	listCertificationsForOrg,
} from "../services/certificationService.js";
import { sanitizeString } from "../utils/validators.js";

function resolveOrgId(user) {
	if (!user) {
		return "";
	}
	return String(user.role || "").toLowerCase() === "agent"
		? String(user.org_owner_id || "")
		: String(user.id || "");
}

export async function getMyCertification(req, res) {
	const orgId = resolveOrgId(req.user);
	if (!orgId) {
		return res.status(400).json({ error: "Organization not found" });
	}
	const summary = await getCertificationSummary(orgId);
	const items = await listCertificationsForOrg(orgId);
	return res.json({ summary, items });
}

export async function getOrgCertification(req, res) {
	const orgId = sanitizeString(String(req.params.orgId || ""), 120);
	if (!orgId) {
		return res.status(400).json({ error: "orgId is required" });
	}
	const summary = await getCertificationSummary(orgId);
	return res.json({ summary });
}
