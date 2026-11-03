import axios from "axios";
import { renderContractPdfBuffer } from "../documentService.js";

export async function createDropboxSignSession({ contractId, contract, token }) {
	const base = (process.env.ESIGN_PROVIDER_URL || "").replace(/\/+$/, "");
	if (!base) {
		throw new Error("ESIGN_PROVIDER_URL is not configured for Dropbox Sign");
	}

	const apiKey = process.env.ESIGN_DROPBOX_SIGN_API_KEY || process.env.ESIGN_PROVIDER_API_KEY;
	if (!apiKey) {
		throw new Error("ESIGN_DROPBOX_SIGN_API_KEY is not configured");
	}

	// Render PDF buffer for the contract (does not mutate contract state)
	const pdfBuffer = renderContractPdfBuffer(contract);
	const fileBase64 = pdfBuffer.toString("base64");

	const returnUrl =
		process.env.ESIGN_RETURN_URL ||
		`${process.env.APP_BASE_URL || ""}/contracts/${contractId}/sign-return`;

	const body = {
		filename: `${String(contract.contract_number || contractId)}.pdf`,
		file_base64: fileBase64,
		signers: [
			{
				role: "buyer",
				name: contract.buyer_name || "",
				email: contract.buyer_email || "",
			},
			{
				role: "factory",
				name: contract.factory_name || "",
				email: contract.factory_email || "",
			},
		],
		metadata: { contractId, token },
		return_url: returnUrl,
	};

	const headers = {
		"Content-Type": "application/json",
		Authorization: `Bearer ${apiKey}`,
	};

	const endpoint = `${base}/signing_sessions`;
	const res = await axios.post(endpoint, body, { headers, timeout: 20_000 });
	const data = res?.data || {};

	const signing_url = data.signing_url || data.url || data.signingUrl || data.embedded?.sign_url;
	const session_id = data.session_id || data.id || data.request_id || data.signature_request_id;
	return { signing_url, session_id, provider_id: session_id, meta: data };
}

export default { createDropboxSignSession };
