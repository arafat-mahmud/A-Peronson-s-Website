import axios from "axios";
import { createDropboxSignSession } from "./providers/dropboxSign.js";

/**
 * Dispatcher for available provider adapters. Accepts the contract object
 * so adapters can render or upload the PDF if needed.
 */
export async function createProviderSignSession({ contractId, contract, actor, token }) {
	const providerType = String(process.env.ESIGN_PROVIDER_TYPE || "").toLowerCase();

	if (providerType === "dropbox_sign" || providerType === "dropbox") {
		return createDropboxSignSession({ contractId, contract, actor, token });
	}

	// Fallback: generic HTTP adapter that posts JSON to /signing_sessions
	const base = process.env.ESIGN_PROVIDER_URL;
	if (!base) {
		throw new Error("ESIGN_PROVIDER_URL is not configured");
	}
	const endpoint = `${base.replace(/\/+$/, "")}/signing_sessions`;

	const headers = { "Content-Type": "application/json" };
	if (process.env.ESIGN_PROVIDER_API_KEY) {
		headers.Authorization = `Bearer ${process.env.ESIGN_PROVIDER_API_KEY}`;
	}

	const returnUrl =
		process.env.ESIGN_RETURN_URL ||
		`${process.env.APP_BASE_URL || ""}/contracts/${contractId}/sign-return`;
	const body = {
		contractId,
		token,
		contract: contract || null,
		actor: { id: String(actor?.id || "") },
		return_url: returnUrl,
		metadata: {
			contractId,
			token,
		},
	};

	const res = await axios.post(endpoint, body, { headers, timeout: 10_000 });
	const data = res?.data || {};

	// Normalize common shapes into a small response contract
	const signing_url = data.signing_url || data.url || data.signingUrl || data.embedded?.sign_url;
	const session_id = data.session_id || data.id || data.request_id || data.signature_request_id;
	return { signing_url, session_id, meta: data };
}
