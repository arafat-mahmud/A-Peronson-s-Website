import { sanitizeString } from "../utils/validators.js";
import {
	getOrderCertificationSummary,
	listOrderCertifications,
	recordCertificationEvidenceFromContract,
} from "./orderCertificationService.js";

export async function ensureCertificationForContract(contract) {
	return recordCertificationEvidenceFromContract(contract);
}

export async function listCertificationsForOrg(orgId) {
	const id = sanitizeString(String(orgId || ""), 120);
	if (!id) {
		return [];
	}
	const rows = await listOrderCertifications();
	return rows.filter((row) => String(row.user_id || "") === id);
}

export async function getCertificationSummary(orgId) {
	const id = sanitizeString(String(orgId || ""), 120);
	if (!id) {
		return null;
	}
	return getOrderCertificationSummary(id);
}
