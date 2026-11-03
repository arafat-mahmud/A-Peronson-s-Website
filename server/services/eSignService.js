import crypto from "node:crypto";
import prisma from "../utils/prisma.js";
import { createProviderSignSession } from "./eSignProvider.js";

export async function createSignSession(contractId, actor) {
	const contract = await prisma.document.findFirst({
		where: { entity_type: "contract", id: String(contractId) },
	});
	if (!contract) {
		const err = new Error("Contract not found");
		err.status = 404;
		throw err;
	}
	const actorId = String(actor?.id || "");
	if (!actorId) {
		const err = new Error("Unauthorized");
		err.status = 401;
		throw err;
	}

	const token = crypto.randomUUID();

	// If a real provider is configured (any supported provider type + ESIGN_PROVIDER_URL), call it
	let signingUrl;
	let providerSession = null;
	if (process.env.ESIGN_PROVIDER_TYPE && process.env.ESIGN_PROVIDER_URL) {
		try {
			providerSession = await createProviderSignSession({
				contractId,
				contract,
				actor,
				token,
			});
			signingUrl = providerSession.signing_url || providerSession.url || providerSession.signingUrl;
		} catch {
			const providerBase = process.env.ESIGN_PROVIDER_URL || "https://example-esign.local";
			signingUrl = `${providerBase.replace(/\/+$/, "")}/sign?contract_id=${encodeURIComponent(contractId)}&token=${encodeURIComponent(token)}`;
		}
	} else {
		const providerBase = process.env.ESIGN_PROVIDER_URL || "https://example-esign.local";
		signingUrl = `${providerBase.replace(/\/+$/, "")}/sign?contract_id=${encodeURIComponent(contractId)}&token=${encodeURIComponent(token)}`;
	}

	const artifact = { ...(contract.artifact || {}) };
	artifact.signing_url = signingUrl;
	artifact.signing_token = token;
	if (providerSession?.session_id) {
		artifact.provider_session_id = providerSession.session_id;
	}
	if (providerSession?.provider_id) {
		artifact.provider_request_id = providerSession.provider_id;
	}
	if (providerSession?.meta) {
		artifact.provider_meta = providerSession.meta;
	}
	await prisma.document.update({
		where: { id: contract.id },
		data: { artifact, updated_at: new Date() },
	});
	return { signing_url: signingUrl, token };
}

export async function handleSignCallback(contractId, payload = {}) {
	const contract = await prisma.document.findFirst({
		where: { entity_type: "contract", id: String(contractId) },
	});
	if (!contract) {
		const err = new Error("Contract not found");
		err.status = 404;
		throw err;
	}

	const updateData = { updated_at: new Date() };
	if (payload.buyer_signed) {
		updateData.buyer_signature_state = "signed";
		updateData.buyer_signed_at = contract.buyer_signed_at || new Date();
	}
	if (payload.factory_signed) {
		updateData.factory_signature_state = "signed";
		updateData.factory_signed_at = contract.factory_signed_at || new Date();
	}

	// If both signed, attempt to generate PDF artifact
	try {
		if (
			(updateData.buyer_signature_state === "signed" ||
				contract.buyer_signature_state === "signed") &&
			(updateData.factory_signature_state === "signed" ||
				contract.factory_signature_state === "signed")
		) {
			const { generateContractArtifact } = await import("./documentService.js");
			if (typeof generateContractArtifact === "function") {
				const artifact = await generateContractArtifact(contract);
				updateData.artifact = { ...(contract.artifact || {}), ...artifact };
			}
		}
	} catch {
		// swallow generation errors - caller can retry
	}

	const updated = await prisma.document.update({
		where: { id: contract.id },
		data: updateData,
	});
	return updated;
}
