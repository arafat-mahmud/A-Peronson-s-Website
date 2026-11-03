import {
	createPaymentProof,
	listPaymentProofsByContract,
	updatePaymentProof,
} from "../services/paymentProofService.js";
import { handleControllerError } from "../utils/permissions.js";

export async function postPaymentProof(req, res) {
	try {
		const row = await createPaymentProof(req.user, req.body || {});
		return res.status(201).json(row);
	} catch (error) {
		return handleControllerError(res, error);
	}
}

export async function getPaymentProofs(req, res) {
	try {
		const contractId = req.query.contract_id || req.query.contractId;
		const items = await listPaymentProofsByContract(req.user, contractId);
		return res.json(items);
	} catch (error) {
		return handleControllerError(res, error);
	}
}

export async function patchPaymentProof(req, res) {
	try {
		const row = await updatePaymentProof(req.user, req.params.proofId, req.body || {});
		if (!row) {
			return res.status(404).json({ error: "Payment proof not found" });
		}
		return res.json(row);
	} catch (error) {
		return handleControllerError(res, error);
	}
}
