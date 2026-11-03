import crypto from "node:crypto";
import path from "node:path";
import {
	approveDocument,
	createDraftContract,
	deleteDocument,
	getDocumentViewCount,
	getDocumentViews,
	isSupportEvidenceEntityType,
	listContractAudit,
	listContracts,
	listDocuments,
	recordDocumentView,
	registerExternalDocument,
	rejectDocument,
	saveDocumentMetadata,
	saveSupportEvidence,
	updateContractArtifact,
	updateContractSignatures,
} from "../services/documentService.js";
import { ensureEntitlement } from "../services/entitlementService.js";
import { normalizeProviderWebhook } from "../services/eSignCallbackMapper.js";
import { createSignSession, handleSignCallback } from "../services/eSignService.js";
import { recordFailedWebhook } from "../services/esignRetryService.js";
import { isImageFile } from "../services/imageProcessor.js";
import { addImageToQueue } from "../services/imageQueue.js";
import { isVideoFile } from "../services/videoProcessor.js";
import { addToQueue } from "../services/videoQueue.js";
import { logError, logInfo } from "../utils/logger.js";
import { deny, handleControllerError } from "../utils/permissions.js";
import prisma from "../utils/prisma.js";

/**
 * Resolves the case or ticket a support-evidence upload claims to belong to.
 *
 * `entity_id` arrives in the request body and used to be written straight
 * onto the Document row, so any authenticated caller could mint unlimited
 * `support_case` rows pointing at an id they made up. The row's `entity_id`
 * is the fact the authorization rests on, so it has to be resolved against a
 * row that actually exists, and the caller has to own it:
 *
 *   - a `SupportCase` with that id  -> the case's own user
 *   - a `SupportTicket` with that id -> the ticket's own user
 *   - neither                       -> 400, there is nothing to attach to
 *
 * The legacy client (FeedbackPage.jsx, SupportReports.jsx) posts a TICKET id,
 * so that branch is load-bearing: without it the legacy upload breaks.
 *
 * @param {string} entityId The id the request claimed.
 * @param {string} userId The authenticated caller's id.
 * @returns {Promise<{ ok: boolean, status: number, error: string, kind: string }>}
 */
async function resolveSupportEvidenceOwner(entityId, userId) {
	const id = String(entityId || "").trim();
	if (!id) {
		return {
			ok: false,
			status: 400,
			error: "entity_id is required for support evidence",
			kind: "",
		};
	}

	const supportCase = await prisma.supportCase.findUnique({
		where: { id },
		select: { id: true, user_id: true },
	});
	if (supportCase) {
		if (String(supportCase.user_id) !== String(userId)) {
			return { ok: false, status: 403, error: "Forbidden", kind: "support_case" };
		}
		return { ok: true, status: 200, error: "", kind: "support_case" };
	}

	const ticket = await prisma.supportTicket.findUnique({
		where: { id },
		select: { id: true, user_id: true },
	});
	if (ticket) {
		if (String(ticket.user_id) !== String(userId)) {
			return { ok: false, status: 403, error: "Forbidden", kind: "support_ticket" };
		}
		return { ok: true, status: 200, error: "", kind: "support_ticket" };
	}

	return {
		ok: false,
		status: 400,
		error: "entity_id does not name a support case or a support ticket",
		kind: "",
	};
}

export async function uploadDocument(req, res) {
	if (!req.file) {
		return res.status(400).json({ error: "No file uploaded" });
	}
	try {
		const entityType = req.body?.entity_type || "verification";
		const entityId = req.body?.entity_id || req.user.id;
		const type = req.body?.type || "other";

		// Support evidence is private: it belongs in the gated /uploads/support
		// namespace, with the Document row that anchors it written at upload
		// time. The old path wrote it into the root of server/uploads, which the
		// static mount serves unauthenticated — a client's support screenshot
		// was world-readable.
		//
		// Every other document type (verification documents, payment proofs,
		// feed media, product media) stays on saveDocumentMetadata, which
		// writes to the public root on purpose.
		if (isSupportEvidenceEntityType(entityType)) {
			// The evidence has to belong to the caller: the id in the request
			// is resolved against the case (or the legacy ticket) it names,
			// and the caller has to own it.
			const ownership = await resolveSupportEvidenceOwner(req.body?.entity_id, req.user.id);
			if (!ownership.ok) {
				return res.status(ownership.status).json({ error: ownership.error });
			}

			const doc = await saveSupportEvidence(req.user.id, entityId, type, req.file);
			// No media queue for evidence. The image/video pipeline rewrites the
			// file in place, and an attachment that is evidence must stay
			// exactly as it was uploaded.
			return res.status(201).json(doc);
		}

		const doc = await saveDocumentMetadata(req.user.id, entityType, entityId, type, req.file);

		const filePath = doc.file_path ? path.join(process.cwd(), doc.file_path) : null;
		if (filePath && isVideoFile(req.file.mimetype, req.file.originalname)) {
			addToQueue({ filePath, documentId: doc.id });
		}

		if (filePath && isImageFile(req.file.mimetype, req.file.originalname)) {
			addImageToQueue({ filePath, documentId: doc.id });
		}

		return res.status(201).json(doc);
	} catch (error) {
		return handleControllerError(res, error);
	}
}

export async function registerDocumentUrl(req, res) {
	try {
		const entityType = req.body?.entity_type || "verification";
		const entityId = req.body?.entity_id || req.user.id;
		const url = req.body?.url || req.body?.file_path || "";
		const doc = await registerExternalDocument(
			req.user.id,
			entityType,
			entityId,
			req.body?.type || "image",
			url,
		);
		return res.status(201).json(doc);
	} catch (error) {
		return handleControllerError(res, error);
	}
}

export async function getDocuments(req, res) {
	const entityType = req.query.entity_type || "verification";
	const entityId = req.query.entity_id || req.user.id;
	// The actor is what the service scopes by: a support case's evidence is
	// listed only to whoever attached it and to an owner/admin.
	const docs = await listDocuments(entityType, entityId, req.user);
	return res.json(docs);
}

export async function removeDocument(req, res) {
	const result = await deleteDocument(req.params.documentId, req.user);
	if (result === "forbidden") {
		return deny(res);
	}
	if (!result) {
		return res.status(404).json({ error: "Document not found" });
	}
	return res.json({ ok: true });
}

export async function approveDocumentCtrl(req, res) {
	const result = await approveDocument(req.params.documentId, req.user);
	if (result === "forbidden") {
		return deny(res);
	}
	if (!result) {
		return res.status(404).json({ error: "Document not found" });
	}
	return res.json(result);
}

export async function rejectDocumentCtrl(req, res) {
	const reason = req.body?.reason || "";
	const result = await rejectDocument(req.params.documentId, req.user, reason);
	if (result === "forbidden") {
		return deny(res);
	}
	if (!result) {
		return res.status(404).json({ error: "Document not found" });
	}
	return res.json(result);
}

export async function createContractDraft(req, res) {
	try {
		const contract = await createDraftContract(req.user, req.body || {});
		return res.status(201).json(contract);
	} catch (error) {
		return handleControllerError(res, error);
	}
}

export async function getContracts(req, res) {
	const contracts = await listContracts(req.user);
	return res.json(contracts);
}

export async function getContractAudit(req, res) {
	try {
		await ensureEntitlement(
			req.user,
			"contract_history_audit",
			"Premium plan required for contract audit trail.",
		);
		const audit = await listContractAudit(req.user, req.params.contractId);
		if (audit === "forbidden") {
			return deny(res);
		}
		if (!audit) {
			return res.status(404).json({ error: "Contract not found" });
		}
		return res.json(audit);
	} catch (error) {
		return handleControllerError(res, error);
	}
}

export async function patchContractSignatures(req, res) {
	const result = await updateContractSignatures(req.params.contractId, req.body || {}, req.user);
	if (result === "forbidden") {
		return deny(res);
	}
	if (!result) {
		return res.status(404).json({ error: "Contract not found" });
	}
	return res.json(result);
}

export async function patchContractArtifact(req, res) {
	const result = await updateContractArtifact(req.params.contractId, req.body || {}, req.user);
	if (result === "forbidden") {
		return deny(res);
	}
	if (!result) {
		return res.status(404).json({ error: "Contract not found" });
	}
	return res.json(result);
}

export async function createContractSignSession(req, res) {
	try {
		const result = await createSignSession(req.params.contractId, req.user);
		return res.json(result);
	} catch (error) {
		return handleControllerError(res, error);
	}
}

export async function createContractSignCallback(req, res) {
	try {
		// Enhanced webhook validation: support HMAC signature, timestamp tolerance, and replay protection
		const secret = String(process.env.ESIGN_WEBHOOK_SECRET || "");
		const toleranceSeconds = Number(process.env.ESIGN_WEBHOOK_TOLERANCE_SECONDS || 300);
		const retentionMs = Number(process.env.ESIGN_WEBHOOK_NONCE_RETENTION_MS || 24 * 60 * 60 * 1000);

		const signatureHeader = String(
			req.headers["x-esign-signature"] || req.headers["x-hub-signature"] || "",
		);
		const incomingSecretHeader = String(req.headers["x-esign-secret"] || req.query?.secret || "");

		// Log receipt of webhook (do not log full payload for privacy/security)
		try {
			logInfo("esign_webhook_received", {
				contractId: req.params.contractId,
				hasSignature: Boolean(signatureHeader),
				hasSecret: Boolean(incomingSecretHeader),
			});
		} catch {
			void 0;
		}

		// Without a shared secret anyone could mark a contract signed: refuse in
		// production; local development may call it unauthenticated.
		if (!secret && process.env.NODE_ENV === "production") {
			return res.status(503).json({ error: "E-sign webhook is not configured" });
		}
		if (secret) {
			if (signatureHeader) {
				// Support formats: 't=timestamp,v1=hex' or 'sha256=hex' or raw hex
				let timestamp = null;
				let signature = null;
				const parts = signatureHeader.split(",").map((p) => p.trim());
				for (const p of parts) {
					if (p.startsWith("t=")) {
						timestamp = p.slice(2);
					}
					if (p.startsWith("v1=")) {
						signature = p.slice(3);
					}
					if (p.startsWith("sha256=")) {
						signature = p.slice("sha256=".length);
					}
				}
				if (!signature && parts.length === 1) {
					signature = parts[0];
				}

				if (!signature) {
					return res.status(403).json({ error: "Signature missing" });
				}

				const raw = Buffer.isBuffer(req.body)
					? req.body
					: Buffer.from(JSON.stringify(req.body || {}), "utf8");
				const payloadString = raw.toString("utf8");

				if (timestamp) {
					const tsNum = Number(timestamp);
					if (
						!Number.isFinite(tsNum) ||
						Math.abs(Date.now() - tsNum * 1000) > toleranceSeconds * 1000
					) {
						return res.status(403).json({ error: "Webhook timestamp outside tolerance" });
					}

					const signedPayload = `${timestamp}.${payloadString}`;
					const expectedSig = crypto
						.createHmac("sha256", secret)
						.update(signedPayload)
						.digest("hex");
					try {
						const sigBuf = Buffer.from(signature, "hex");
						const expectedBuf = Buffer.from(expectedSig, "hex");
						if (
							sigBuf.length !== expectedBuf.length ||
							!crypto.timingSafeEqual(sigBuf, expectedBuf)
						) {
							return res.status(403).json({ error: "Invalid signature" });
						}
					} catch {
						return res.status(403).json({ error: "Invalid signature format" });
					}

					// Replay protection: store processed signatures in PostgreSQL
					try {
						const nowTs = Date.now();
						const cutoff = new Date(nowTs - retentionMs);

						await prisma.$transaction(async (tx) => {
							// Delete old nonces first
							await tx.esignWebhookNonce.deleteMany({
								where: {
									created_at: { lt: cutoff },
								},
							});

							// Check if signature already used
							const existing = await tx.esignWebhookNonce.findUnique({
								where: { nonce: signature },
							});
							if (existing) {
								const err = new Error("Replay detected");
								err.status = 403;
								throw err;
							}

							// Store new nonce
							await tx.esignWebhookNonce.create({
								data: { nonce: signature },
							});
						});
					} catch (e) {
						if (e && e.status === 403) {
							return res.status(403).json({ error: "Replay detected" });
						}
						throw e;
					}
				} else {
					// No timestamp: fall back to static secret header check
					if (!incomingSecretHeader || incomingSecretHeader !== secret) {
						return res.status(403).json({ error: "Forbidden" });
					}
				}
			} else {
				// No signature header: fall back to static secret header / query param
				if (!incomingSecretHeader || incomingSecretHeader !== secret) {
					return res.status(403).json({ error: "Forbidden" });
				}
			}
		}

		const contractId = req.params.contractId;
		let payload = {};
		if (Buffer.isBuffer(req.body)) {
			try {
				payload = JSON.parse(req.body.toString("utf8"));
			} catch {
				payload = {};
			}
		} else {
			payload = req.body || {};
		}

		// Best-effort normalize provider webhook shapes into our internal payload
		try {
			const normalized = normalizeProviderWebhook(payload, req.headers || {});
			if (normalized && (normalized.buyer_signed || normalized.factory_signed)) {
				payload = { ...payload, ...normalized };
			}
		} catch {
			void 0;
		}

		try {
			const updated = await handleSignCallback(contractId, payload);
			try {
				logInfo("esign_webhook_processed", {
					contractId,
					buyer_signature_state: updated?.buyer_signature_state,
					factory_signature_state: updated?.factory_signature_state,
					artifact_status: updated?.artifact?.status,
				});
			} catch {
				void 0;
			}
			return res.json({ ok: true, contract: updated });
		} catch (innerErr) {
			// If processing failed, persist for retry and return error
			try {
				await recordFailedWebhook({
					contractId,
					payload,
					headers: { signature: signatureHeader || null },
					error: innerErr?.message || String(innerErr),
				});
			} catch (recErr) {
				try {
					logError("esign_webhook_record_failed", recErr);
				} catch {
					void 0;
				}
			}
			throw innerErr;
		}
	} catch (error) {
		try {
			logError("esign_webhook_processing_error", error);
		} catch {
			void 0;
		}
		return handleControllerError(res, error);
	}
}

export async function logDocumentView(req, res) {
	try {
		const documentId = req.params.documentId;
		if (!documentId) {
			return res.status(400).json({ error: "documentId required" });
		}
		await recordDocumentView(documentId, req.user?.id, req.ip);
		const count = await getDocumentViewCount(documentId);
		return res.json({ ok: true, view_count: count });
	} catch (error) {
		return handleControllerError(res, error);
	}
}

export async function getDocumentViewStats(req, res) {
	try {
		const documentId = req.params.documentId;
		if (!documentId) {
			return res.status(400).json({ error: "documentId required" });
		}
		const [count, views] = await Promise.all([
			getDocumentViewCount(documentId),
			getDocumentViews(documentId, 20),
		]);
		return res.json({ view_count: count, recent_views: views });
	} catch (error) {
		return handleControllerError(res, error);
	}
}
