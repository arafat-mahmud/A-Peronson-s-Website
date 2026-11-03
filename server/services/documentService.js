import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import {
	canAccessContract,
	canManagePartnerNetwork,
	canModifyContract,
	isAgent,
	isOwnerOrAdmin,
	scopeRecordsForUser,
} from "../utils/permissions.js";
import prisma from "../utils/prisma.js";
import { getPublicDocuments } from "../utils/privacy.js";
import { sanitizeSvgBuffer } from "../utils/svgSanitizer.js";
import { sanitizeString } from "../utils/validators.js";
import { hasCompletedCallBetweenUsers } from "./callSessionService.js";
import { ensureCertificationForContract } from "./certificationService.js";
import { trackEvent } from "./eventTrackingService.js";
import { markLeadConvertedFromContract } from "./leadService.js";
import { PRIVATE_ENTITY_TYPE, recordPrivateUpload } from "./privateDocumentService.js";
import { hasPendingRatingForCounterparty } from "./ratingsService.js";
import { recordWorkflowEvent } from "./workflowLifecycleService.js";

const SIGNATURE_STATES = new Set(["pending", "signed"]);
const ARTIFACT_STATES = new Set(["draft", "generated", "locked", "archived"]);
const MEDIA_REVIEW_EXTENSIONS = new Set([
	".png",
	".jpg",
	".jpeg",
	".webp",
	".avif",
	".gif",
	".apng",
	".bmp",
	".tiff",
	".tif",
	".heic",
	".heif",
	".tga",
	".svg",
	".dng",
	".cr2",
	".cr3",
	".nef",
	".arw",
	".sr2",
	".orf",
	".raf",
	".psd",
	".ai",
	".xcf",
	".cdr",
]);
const VIDEO_EXTENSIONS = new Set([
	".mp4",
	".webm",
	".mkv",
	".flv",
	".vob",
	".ogv",
	".ogg",
	".rrc",
	".gifv",
	".mng",
	".mov",
	".avi",
	".qt",
	".wmv",
	".yuv",
	".rm",
	".asf",
	".amv",
	".m4p",
	".m4v",
	".mpg",
	".mp2",
	".mpeg",
	".mpe",
	".mpv",
	".svi",
	".3gp",
	".3g2",
	".mxf",
	".roq",
	".nsv",
	".f4v",
	".f4p",
	".f4a",
	".f4b",
	".mod",
]);
const PROHIBITED_MEDIA_KEYWORDS = [
	"porn",
	"explicit",
	"nudity",
	"violence",
	"weapon",
	"drugs",
	"hate",
];

function toIsoNow() {
	return new Date().toISOString();
}

function normalizeContractLifecycle(contract) {
	if (contract.artifact?.status === "archived" || contract.archived_at) {
		return "archived";
	}
	if (contract.is_draft) {
		return "draft";
	}
	if (
		contract.buyer_signature_state === "signed" &&
		contract.factory_signature_state === "signed" &&
		["generated", "locked"].includes(contract.artifact?.status)
	) {
		return "signed";
	}
	return "pending_signature";
}

function canViewContractBankingReferences(actor, contract) {
	if (!(actor && contract)) {
		return false;
	}
	if (isOwnerOrAdmin(actor)) {
		return true;
	}
	const actorId = String(actor.id || "");
	if (!actorId) {
		return false;
	}
	return (
		actorId === String(contract.uploaded_by) ||
		actorId === String(contract.buyer_id) ||
		actorId === String(contract.factory_id)
	);
}

function presentContractForActor(contract, actor) {
	if (!contract) {
		return contract;
	}

	const normalizedPdfPath = (() => {
		const pdfPath = contract.artifact?.pdf_path || "";
		if (!pdfPath) {
			return "";
		}
		if (pdfPath.startsWith("/uploads/")) {
			return pdfPath;
		}
		const normalized = String(pdfPath).replace(/\\/g, "/");
		const idx = normalized.indexOf("server/uploads/");
		if (idx >= 0) {
			const suffix = normalized.slice(idx + "server/uploads/".length);
			return `/uploads/${suffix.replace(/^\/+/, "")}`;
		}
		return pdfPath;
	})();

	const base = {
		...contract,
		artifact: contract.artifact
			? { ...contract.artifact, pdf_path: normalizedPdfPath }
			: contract.artifact,
	};

	if (canViewContractBankingReferences(actor, contract)) {
		return base;
	}
	return getPublicDocuments(
		{
			...base,
			bank_name: "",
			beneficiary_name: "",
			transaction_reference: "",
			artifact: base.artifact ? { ...base.artifact, pdf_path: "" } : base.artifact,
		},
		actor?.id,
		contract.uploaded_by,
	);
}

function sanitizeSignatureState(value, fallback = "pending") {
	const normalized = sanitizeString(value || fallback, 20).toLowerCase();
	return SIGNATURE_STATES.has(normalized) ? normalized : fallback;
}

function sanitizeArtifactState(value, fallback = "draft") {
	const normalized = sanitizeString(value || fallback, 20).toLowerCase();
	return ARTIFACT_STATES.has(normalized) ? normalized : fallback;
}

function ensureAllowed(file) {
	const ext = path.extname(file.originalname || "").toLowerCase();
	const allowed = [
		".jpg",
		".jpeg",
		".png",
		".webp",
		".avif",
		".gif",
		".apng",
		".bmp",
		".tiff",
		".tif",
		".heic",
		".heif",
		".dcm",
		".tga",
		".svg",
		".eps",
		".pdf",
		".dng",
		".cr2",
		".cr3",
		".nef",
		".arw",
		".sr2",
		".orf",
		".raf",
		".psd",
		".ai",
		".xcf",
		".cdr",
		".mp4",
		".webm",
		".mkv",
		".flv",
		".vob",
		".ogv",
		".ogg",
		".rrc",
		".gifv",
		".mng",
		".mov",
		".avi",
		".qt",
		".wmv",
		".yuv",
		".rm",
		".asf",
		".amv",
		".m4p",
		".m4v",
		".mpg",
		".mp2",
		".mpeg",
		".mpe",
		".mpv",
		".svi",
		".3gp",
		".3g2",
		".mxf",
		".roq",
		".nsv",
		".f4v",
		".f4p",
		".f4a",
		".f4b",
		".mod",
	];
	if (!allowed.includes(ext)) {
		throw new Error("Invalid file type");
	}
}

function getMediaModerationResult(file) {
	const name = String(file?.originalname || "").toLowerCase();
	const ext = path.extname(file?.originalname || "").toLowerCase();
	const flags = [];

	if (MEDIA_REVIEW_EXTENSIONS.has(ext)) {
		flags.push(`media_type:${ext.replace(".", "")}`);
	}
	if (VIDEO_EXTENSIONS.has(ext)) {
		flags.push(`media_type:${ext.replace(".", "")}`);
	}

	for (const keyword of PROHIBITED_MEDIA_KEYWORDS) {
		if (name.includes(keyword)) {
			flags.push(`prohibited_keyword:${keyword}`);
		}
	}

	const requiresReview = true;
	return {
		flags,
		moderation_status: requiresReview ? "pending_review" : "approved",
	};
}

function getMediaModerationResultFromUrl(url) {
	const flags = [];
	const raw = String(url || "").trim();
	const internal =
		raw.startsWith("/uploads/") || raw.startsWith("uploads/") || raw.includes("server/uploads/");
	let ext = "";

	if (internal) {
		ext = path.extname(raw).toLowerCase();
	} else {
		let parsed = null;
		try {
			parsed = new URL(url);
		} catch {
			flags.push("invalid_url");
		}

		if (parsed && !["http:", "https:"].includes(parsed.protocol)) {
			flags.push("invalid_url_protocol");
		}

		ext = parsed ? path.extname(parsed.pathname || "").toLowerCase() : "";
	}
	if (ext && MEDIA_REVIEW_EXTENSIONS.has(ext)) {
		flags.push(`media_type:${ext.replace(".", "")}`);
	}

	const searchable = String(url || "").toLowerCase();
	for (const keyword of PROHIBITED_MEDIA_KEYWORDS) {
		if (searchable.includes(keyword)) {
			flags.push(`prohibited_keyword:${keyword}`);
		}
	}

	const requiresReview = flags.length > 0;
	return {
		flags,
		moderation_status: requiresReview ? "pending_review" : "approved",
	};
}

function ensureAllowedUrl(url) {
	const raw = String(url || "").trim();
	const internal =
		raw.startsWith("/uploads/") || raw.startsWith("uploads/") || raw.includes("server/uploads/");
	if (!internal) {
		throw new Error("Only internal media URLs are allowed");
	}
	const ext = path.extname(raw).toLowerCase();
	if (!MEDIA_REVIEW_EXTENSIONS.has(ext) && ext !== ".pdf" && ext !== ".eps" && ext !== ".dcm") {
		throw new Error("Unsupported image format");
	}
}

function escapePdfText(value = "") {
	return String(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function buildSimpleContractPdf(contract) {
	const lines = [
		"A-Personson Contract Artifact",
		`Contract Number: ${contract.contract_number || contract.id}`,
		`Title: ${contract.title || "Contract"}`,
		`Buyer: ${contract.buyer_name || "N/A"} (${contract.buyer_id || "N/A"})`,
		`Factory: ${contract.factory_name || "N/A"} (${contract.factory_id || "N/A"})`,
		contract.bank_name ? `Bank: ${contract.bank_name}` : "",
		contract.beneficiary_name ? `Beneficiary: ${contract.beneficiary_name}` : "",
		contract.transaction_reference
			? `Transaction Reference: ${contract.transaction_reference}`
			: "",
		`Buyer Signature Timestamp: ${contract.buyer_signed_at || "N/A"}`,
		`Factory Signature Timestamp: ${contract.factory_signed_at || "N/A"}`,
		`Generated At: ${toIsoNow()}`,
	].filter(Boolean);

	const contentLines = lines
		.map((line, idx) => `BT /F1 12 Tf 50 ${760 - idx * 22} Td (${escapePdfText(line)}) Tj ET`)
		.join("\n");
	const contentStream = `${contentLines}\n`;

	const objects = [];
	objects.push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
	objects.push("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");
	objects.push(
		"3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n",
	);
	objects.push("4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n");
	objects.push(
		`5 0 obj\n<< /Length ${Buffer.byteLength(contentStream, "utf8")} >>\nstream\n${contentStream}endstream\nendobj\n`,
	);

	let offset = 0;
	let pdf = "%PDF-1.4\n";
	offset = Buffer.byteLength(pdf, "utf8");
	const xrefOffsets = [0];

	for (const object of objects) {
		xrefOffsets.push(offset);
		pdf += object;
		offset = Buffer.byteLength(pdf, "utf8");
	}

	const xrefStart = offset;
	pdf += `xref\n0 ${objects.length + 1}\n`;
	pdf += "0000000000 65535 f \n";
	for (const objOffset of xrefOffsets.slice(1)) {
		pdf += `${String(objOffset).padStart(10, "0")} 00000 n \n`;
	}

	pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
	return Buffer.from(pdf, "utf8");
}

export async function generateContractArtifact(contract) {
	const generatedAt = toIsoNow();
	const generationVersion = Number(contract.artifact?.version || 0) + 1;
	const pdfBuffer = buildSimpleContractPdf(contract);
	const pdfHash = crypto.createHash("sha256").update(pdfBuffer).digest("hex");

	const uploadsDir = path.join(process.cwd(), "server", "uploads", "contracts");
	await fs.mkdir(uploadsDir, { recursive: true });

	const safeContractNumber = sanitizeString(contract.contract_number || contract.id, 80).replace(
		/[^a-zA-Z0-9_-]/g,
		"_",
	);
	const fileName = `${safeContractNumber || contract.id}-v${generationVersion}.pdf`;
	const filePath = path.join(uploadsDir, fileName);
	await fs.writeFile(filePath, pdfBuffer);

	return {
		pdf_path: `/uploads/contracts/${fileName}`,
		pdf_hash: pdfHash,
		status: "generated",
		generated_at: generatedAt,
		version: generationVersion,
		signer_ids: {
			buyer_id: sanitizeString(contract.buyer_id || "", 120),
			factory_id: sanitizeString(contract.factory_id || "", 120),
		},
		signature_timestamps: {
			buyer_signed_at: contract.buyer_signed_at || "",
			factory_signed_at: contract.factory_signed_at || "",
		},
	};
}

// Render the contract PDF as a Buffer without persisting artifact metadata.
export function renderContractPdfBuffer(contract) {
	return buildSimpleContractPdf(contract);
}

// --- support evidence -------------------------------------------------------
//
// A support case's evidence is a private namespace, like chat attachments and
// call recordings. The evidence file itself is a client-supplied artefact
// (a screenshot of the bug, an export of the failing request), and it used to
// be written into the ROOT of server/uploads — which the static mount serves
// unauthenticated. A client's support screenshot was world-readable.
//
// It now lands in the gated /uploads/support prefix, and the Document row
// that anchors it — the key authorizeFilePath resolves against — is written
// at upload time, where the uploader and the owning case are known.
//
// The other document paths (verification documents, payment proofs, feed
// media, product media) legitimately land in the public root and keep using
// saveDocumentMetadata.

// The entity type the authorization resolver has a branch for. A row with any
// other type is a hard deny, so the write path normalises to this one.
export const SUPPORT_EVIDENCE_ENTITY_TYPE = PRIVATE_ENTITY_TYPE.SUPPORT_CASE;

// The type the live client sends. FeedbackPage.jsx and SupportReports.jsx
// both post entity_type "support_ticket" with the ticket id, and the rows
// they produced carry that value. Both spellings are support evidence, so
// both are routed into the gated namespace and both are ownership-checked
// when they are listed.
const SUPPORT_EVIDENCE_REQUEST_TYPES = new Set(["support_case", "support_ticket"]);

export function isSupportEvidenceEntityType(entityType) {
	return SUPPORT_EVIDENCE_REQUEST_TYPES.has(
		String(entityType || "")
			.trim()
			.toLowerCase(),
	);
}

// The public path of a support evidence file. This is the shape the
// authorization resolver expects: "/uploads/<prefix>/<name>", forward
// slashes, exactly what toPublicPath() produces for the file on disk.
function supportEvidencePublicPath(name) {
	return `/uploads/support/${name}`;
}

/**
 * Writes one piece of support evidence into the gated support namespace.
 *
 * @param {string} uploadedBy The id of the user who attached it.
 * @param {string} caseId The case the evidence belongs to. For the support
 *   portal this is the case id; the legacy feedback client sends the ticket
 *   id it was given.
 * @param {string} type The media type, for the admin listing.
 * @param {Object} file The multer file.
 * @returns {Promise<Object>} The Document row that anchors the file.
 */
export async function saveSupportEvidence(uploadedBy, caseId, type, file) {
	ensureAllowed(file);
	const moderation = getMediaModerationResult(file);
	const safeName = `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
	const supportDir = path.join(process.cwd(), "server", "uploads", "support");
	await fs.mkdir(supportDir, { recursive: true });
	const targetPath = path.join(supportDir, safeName);

	let fileBuffer = file.buffer;
	if (
		file.mimetype === "image/svg+xml" ||
		path.extname(file.originalname).toLowerCase() === ".svg"
	) {
		const { content } = sanitizeSvgBuffer(file.buffer);
		fileBuffer = content;
	}
	await fs.writeFile(targetPath, fileBuffer);

	const filePath = supportEvidencePublicPath(safeName);
	// The row is the authorization key. It is written here, at write time,
	// because the uploader is known here and nowhere else: a backfill can
	// only ever write a "system" row, which authorises an admin and nobody
	// else.
	const row = await recordPrivateUpload({
		entityType: SUPPORT_EVIDENCE_ENTITY_TYPE,
		entityId: caseId,
		filePath,
		uploadedBy,
		type: type || "other",
		moderation,
	});

	// The row IS the authorization key: authorizeFilePath refuses to serve a
	// path that no row anchors, so a file whose row failed to write is
	// unreachable for EVERYONE - the uploader included. A 201 that claims
	// success would hand the client a path it can never read, and the client
	// would attach that dead path to the case. The upload fails loudly
	// instead of pretending.
	//
	// The bytes stay on disk. They are inside the gated prefix, so they are
	// not served by the static mount, and the uploads registry adopts them as
	// a "system" row on the next boot (an admin can still reach them).
	if (!(row && row.id)) {
		const error = new Error("Support evidence could not be anchored");
		error.status = 500;
		throw error;
	}

	return {
		...row,
		uploaded_by: uploadedBy,
		entity_type: SUPPORT_EVIDENCE_ENTITY_TYPE,
		entity_id: caseId,
		file_path: filePath,
		type: type || "other",
		moderation_status: moderation.moderation_status,
		moderation_flags: moderation.flags,
		created_at: new Date(),
	};
}

export async function saveDocumentMetadata(ownerId, entityType, entityId, type, file) {
	ensureAllowed(file);
	const moderation = getMediaModerationResult(file);
	const safeName = `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
	const targetPath = path.join(process.cwd(), "server", "uploads", safeName);
	let fileBuffer = file.buffer;
	if (
		file.mimetype === "image/svg+xml" ||
		path.extname(file.originalname).toLowerCase() === ".svg"
	) {
		const { content } = sanitizeSvgBuffer(file.buffer);
		fileBuffer = content;
	}
	await fs.writeFile(targetPath, fileBuffer);

	const doc = {
		id: crypto.randomUUID(),
		uploaded_by: ownerId,
		entity_type: sanitizeString(entityType, 60),
		entity_id: sanitizeString(entityId, 100),
		file_path: path.relative(process.cwd(), targetPath),
		type: sanitizeString(type || "other", 60),
		moderation_status: moderation.moderation_status,
		moderation_flags: moderation.flags,
		created_at: new Date(),
	};

	await prisma.document.create({ data: doc });
	if (
		doc.entity_type === "company_product" &&
		String(doc.type || "")
			.toLowerCase()
			.includes("image")
	) {
		await trackEvent({
			type: "product_image_uploaded",
			actor_id: ownerId,
			entity_id: doc.entity_id,
			metadata: { document_id: doc.id },
		});
	}
	if (
		doc.entity_type === "company_product" &&
		String(doc.type || "")
			.toLowerCase()
			.includes("video")
	) {
		await trackEvent({
			type: "product_video_uploaded",
			actor_id: ownerId,
			entity_id: doc.entity_id,
			metadata: { document_id: doc.id },
		});
	}
	return doc;
}

async function hasAcceptedPaymentProof(contractId) {
	const count = await prisma.paymentProof.count({
		where: {
			contract_id: contractId,
			OR: [
				{ type: "bank_transfer", status: "received" },
				{ type: "lc", status: "accepted" },
			],
		},
	});
	return count > 0;
}

async function checkPaymentProof(contractId) {
	return hasAcceptedPaymentProof(contractId);
}

export async function registerExternalDocument(ownerId, entityType, entityId, type, url) {
	const safeUrl = sanitizeString(String(url || ""), 600);
	if (!safeUrl) {
		throw new Error("Media URL is required");
	}
	ensureAllowedUrl(safeUrl);
	const moderation = getMediaModerationResultFromUrl(safeUrl);

	const doc = {
		id: crypto.randomUUID(),
		uploaded_by: ownerId,
		entity_type: sanitizeString(entityType, 60),
		entity_id: sanitizeString(entityId, 100),
		file_path: safeUrl,
		type: sanitizeString(type || "image", 60),
		moderation_status: moderation.moderation_status,
		moderation_flags: moderation.flags,
		created_at: new Date(),
	};

	await prisma.document.create({ data: doc });
	if (
		doc.entity_type === "company_product" &&
		String(doc.type || "")
			.toLowerCase()
			.includes("image")
	) {
		await trackEvent({
			type: "product_image_registered",
			actor_id: ownerId,
			entity_id: doc.entity_id,
			metadata: { document_id: doc.id },
		});
	}
	return doc;
}

// The evidence of a support case is the client's own material, so it is not
// listed to whoever learns the case id: only the person who attached it, and
// an owner/admin, see it. This used to be an unfiltered listing, which meant
// any authenticated user who learned a ticket id could enumerate that
// ticket's attachments.
//
// The other entity types keep the previous behaviour. Their rows are public
// media or verification documents that the app lists by their own entity id,
// and narrowing them is a different change with a different blast radius.
//
// The actor is required for the support namespace: no actor means no grant,
// so a caller that forgets to pass one gets an empty collection rather than
// an unscoped one.
export async function listDocuments(entityType, entityId, actor) {
	const docs = await prisma.document.findMany({
		where: { entity_type: entityType, entity_id: entityId },
	});
	if (!isSupportEvidenceEntityType(entityType)) {
		return docs;
	}
	return docs.filter((doc) => canListSupportEvidence(actor, doc));
}

function canListSupportEvidence(actor, doc) {
	if (!actor) return false;
	if (isOwnerOrAdmin(actor)) return true;
	const actorId = String(actor.id ?? "").trim();
	if (!actorId) return false;
	return String(doc?.uploaded_by ?? "").trim() === actorId;
}

export async function deleteDocument(docId, actor) {
	const target = await prisma.document.findUnique({ where: { id: docId } });
	if (!target) {
		return false;
	}
	if (!isOwnerOrAdmin(actor) && target.uploaded_by !== actor.id) {
		return "forbidden";
	}

	await prisma.document.delete({ where: { id: docId } });
	return true;
}

export async function approveDocument(docId, actor) {
	const existing = await prisma.document.findUnique({ where: { id: docId } });
	if (!existing) {
		return null;
	}
	if (!isOwnerOrAdmin(actor)) {
		return "forbidden";
	}

	return prisma.document.update({
		where: { id: docId },
		data: {
			moderation_status: "approved",
			moderation_reason: "",
			updated_at: new Date(),
		},
	});
}

export async function rejectDocument(docId, actor, reason = "") {
	const existing = await prisma.document.findUnique({ where: { id: docId } });
	if (!existing) {
		return null;
	}
	if (!isOwnerOrAdmin(actor)) {
		return "forbidden";
	}

	return prisma.document.update({
		where: { id: docId },
		data: {
			moderation_status: "rejected",
			moderation_reason: reason || "Rejected by admin",
			updated_at: new Date(),
		},
	});
}

export async function createDraftContract(actor, payload = {}) {
	if (isAgent(actor) || !canManagePartnerNetwork(actor)) {
		const err = new Error("Forbidden");
		err.status = 403;
		throw err;
	}

	const buyerId = sanitizeString(payload.buyer_id || "", 120);
	const factoryId = sanitizeString(payload.factory_id || "", 120);

	if (buyerId && factoryId) {
		const hasPending = await hasPendingRatingForCounterparty(buyerId, factoryId);
		if (!hasPending) {
			const err = new Error(
				"Rating required before creating a new contract with this counterparty",
			);
			err.status = 403;
			throw err;
		}
	}

	const ownerId = actor.id;
	const contract = {
		id: crypto.randomUUID(),
		entity_type: "contract",
		contract_number: sanitizeString(payload.contract_number || `CN-${Date.now()}`, 80),
		title: sanitizeString(payload.title || "Draft Contract", 160),
		buyer_name: sanitizeString(payload.buyer_name || "", 160),
		factory_name: sanitizeString(payload.factory_name || "", 160),
		buyer_id: sanitizeString(payload.buyer_id || "", 120),
		factory_id: sanitizeString(payload.factory_id || "", 120),
		bank_name: sanitizeString(payload.bank_name || "", 120),
		beneficiary_name: sanitizeString(payload.beneficiary_name || "", 120),
		transaction_reference: sanitizeString(payload.transaction_reference || "", 160),
		is_draft: true,
		buyer_signature_state: "pending",
		factory_signature_state: "pending",
		buyer_signed_at: null,
		factory_signed_at: null,
		artifact: {
			pdf_path: "",
			pdf_hash: "",
			status: "draft",
			generated_at: "",
			version: 0,
			signer_ids: {
				buyer_id: "",
				factory_id: "",
			},
			signature_timestamps: {
				buyer_signed_at: "",
				factory_signed_at: "",
			},
		},
		uploaded_by: ownerId,
		created_at: new Date(),
		updated_at: new Date(),
	};
	contract.lifecycle_status = normalizeContractLifecycle(contract);
	await prisma.$transaction(async (tx) => {
		await tx.document.create({ data: contract });
		await appendContractAudit(
			contract.id,
			actor.id,
			"contract_created",
			{
				title: contract.title,
			},
			tx,
		);
	});
	await trackEvent({
		type: "contract_created",
		actor_id: actor.id,
		entity_id: contract.id,
	});
	await recordWorkflowEvent(
		"contract_created",
		{
			contract_id: contract.id,
			requirement_id: payload.requirement_id,
			product_id: payload.product_id,
			match_id: payload.match_id,
			chat_thread_id: payload.match_id,
		},
		{ actor_id: actor.id },
	).catch(() => null);
	return contract;
}

async function appendContractAudit(contractId, actorId, action, metadata, tx) {
	const client = tx || prisma;
	try {
		const row = {
			id: crypto.randomUUID(),
			contract_id: String(contractId || ""),
			actor_id: actorId || null,
			action: String(action || ""),
			metadata: metadata || {},
			created_at: new Date().toISOString(),
		};
		await client.contractAudit.create({ data: row });
	} catch {
		void 0;
	}
}

export async function listContracts(actor) {
	const contracts = await prisma.document.findMany({
		where: { entity_type: "contract" },
	});
	const scoped = scopeRecordsForUser(actor, contracts, {
		idFields: ["uploaded_by", "buyer_id", "factory_id"],
		assignmentFields: ["assigned_agent_id", "agent_id"],
	});

	return scoped
		.map((c) => ({ ...c, lifecycle_status: normalizeContractLifecycle(c) }))
		.map((c) => presentContractForActor(c, actor));
}

export async function listContractAudit(actor, contractId) {
	const id = sanitizeString(String(contractId || ""), 120);
	if (!id) {
		return null;
	}
	const contract = await prisma.document.findFirst({
		where: { id, entity_type: "contract" },
	});
	if (!contract) {
		return null;
	}
	if (!canAccessContract(actor, contract)) {
		return "forbidden";
	}
	const auditRows = await prisma.contractAudit.findMany({
		where: { contract_id: id },
	});
	const items = (Array.isArray(auditRows) ? auditRows : [])
		.filter((row) => String(row.contract_id || "") === id)
		.sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));

	return { contract_id: id, items };
}

export async function updateContractSignatures(contractId, patch, actor) {
	const existing = await prisma.document.findFirst({
		where: { id: contractId, entity_type: "contract" },
	});
	if (!existing) {
		return null;
	}
	if (!canModifyContract(actor, existing)) {
		return "forbidden";
	}
	// Each party signs only its own side; staff may record either.
	if (!isOwnerOrAdmin(actor)) {
		const actorId = String(actor?.id || "");
		const touchesBuyer = patch.buyer_signature_state !== undefined;
		const touchesFactory = patch.factory_signature_state !== undefined;
		if (
			(touchesBuyer && actorId !== String(existing.buyer_id || "")) ||
			(touchesFactory && actorId !== String(existing.factory_id || ""))
		) {
			return "forbidden";
		}
	}

	if (existing.buyer_id && existing.factory_id) {
		const callCompleted = await hasCompletedCallBetweenUsers(
			existing.buyer_id,
			existing.factory_id,
		);
		if (!callCompleted) {
			const err = new Error(
				"A completed video call between buyer and factory is required before signing a contract.",
			);
			err.status = 403;
			err.code = "VIDEO_CALL_REQUIRED";
			throw err;
		}
	}

	const previousBuyerState = existing.buyer_signature_state;
	const previousFactoryState = existing.factory_signature_state;

	const nextBuyerState =
		patch.buyer_signature_state === undefined
			? existing.buyer_signature_state
			: sanitizeSignatureState(patch.buyer_signature_state, existing.buyer_signature_state);
	const nextFactoryState =
		patch.factory_signature_state === undefined
			? existing.factory_signature_state
			: sanitizeSignatureState(patch.factory_signature_state, existing.factory_signature_state);

	const paymentProofOk = await checkPaymentProof(existing.id);

	const next = {
		...existing,
		is_draft: patch.is_draft === undefined ? existing.is_draft : Boolean(patch.is_draft),
		buyer_signature_state: nextBuyerState,
		factory_signature_state: nextFactoryState,
		// DateTime columns: an unsigned side is null. "" was rejected by Prisma,
		// so every first signature on a contract failed with a 500.
		buyer_signed_at: nextBuyerState === "signed" ? existing.buyer_signed_at || toIsoNow() : null,
		factory_signed_at:
			nextFactoryState === "signed" ? existing.factory_signed_at || toIsoNow() : null,
		updated_at: new Date(),
	};

	const bothSigned =
		next.buyer_signature_state === "signed" && next.factory_signature_state === "signed";
	const hasGeneratedArtifact = Boolean(
		next.artifact?.generated_at && next.artifact?.pdf_hash && next.artifact?.pdf_path,
	);
	if (bothSigned) {
		next.is_draft = false;
	}
	if (bothSigned && !hasGeneratedArtifact) {
		next.artifact = await generateContractArtifact(next);
	}

	next.lifecycle_status = normalizeContractLifecycle(next);
	await prisma.$transaction(async (tx) => {
		await tx.document.update({ where: { id: contractId }, data: next });

		if (previousBuyerState !== nextBuyerState && nextBuyerState === "signed") {
			await appendContractAudit(
				next.id,
				actor.id,
				"buyer_signed",
				{
					previous: previousBuyerState,
					now: nextBuyerState,
				},
				tx,
			);
		}
		if (previousFactoryState !== nextFactoryState && nextFactoryState === "signed") {
			await appendContractAudit(
				next.id,
				actor.id,
				"factory_signed",
				{
					previous: previousFactoryState,
					now: nextFactoryState,
				},
				tx,
			);
		}
		if (next.lifecycle_status === "signed") {
			await appendContractAudit(
				next.id,
				actor.id,
				"contract_signed",
				{
					artifact: next.artifact || null,
				},
				tx,
			);
		}
	});

	if (previousBuyerState !== nextBuyerState && nextBuyerState === "signed") {
		await trackEvent({
			type: "contract_buyer_signed",
			actor_id: actor.id,
			entity_id: next.id,
		});
	}
	if (previousFactoryState !== nextFactoryState && nextFactoryState === "signed") {
		await trackEvent({
			type: "contract_factory_signed",
			actor_id: actor.id,
			entity_id: next.id,
		});
	}
	if (next.lifecycle_status === "signed") {
		await trackEvent({
			type: "contract_signed",
			actor_id: actor.id,
			entity_id: next.id,
		});
		if (process.env.NODE_ENV !== "test") {
			await ensureCertificationForContract(next);
			await markLeadConvertedFromContract({
				buyerId: next.buyer_id,
				factoryId: next.factory_id,
				contractId: next.id,
			});
			await recordWorkflowEvent(
				"contract_signed",
				{ contract_id: next.id },
				{ actor_id: actor.id },
			).catch(() => null);
		}
	}
	return {
		...presentContractForActor(next, actor),
		payment_proof_ok: paymentProofOk,
	};
}

export async function updateContractArtifact(contractId, patch, actor) {
	const existing = await prisma.document.findFirst({
		where: { id: contractId, entity_type: "contract" },
	});
	if (!existing) {
		return null;
	}
	if (!canModifyContract(actor, existing)) {
		return "forbidden";
	}

	const previousStatus = existing.artifact?.status || "draft";
	const artifactStatus =
		patch.status === undefined
			? existing.artifact?.status || "draft"
			: sanitizeArtifactState(patch.status, existing.artifact?.status || "draft");

	const paymentProofOk = await checkPaymentProof(existing.id);

	const hasGeneratedArtifact = Boolean(
		existing.artifact?.generated_at && existing.artifact?.pdf_hash && existing.artifact?.pdf_path,
	);
	if (["locked", "archived"].includes(artifactStatus) && !hasGeneratedArtifact) {
		const err = new Error("Only generated artifacts can be locked or archived.");
		err.status = 400;
		throw err;
	}

	const next = {
		...existing,
		is_draft: artifactStatus === "draft" ? existing.is_draft : false,
		artifact: {
			...(existing.artifact || {}),
			status: artifactStatus,
			pdf_path: existing.artifact?.pdf_path || "",
			pdf_hash: existing.artifact?.pdf_hash || "",
			generated_at: existing.artifact?.generated_at || "",
			version: Number(existing.artifact?.version || 0),
			signer_ids: {
				buyer_id: existing.artifact?.signer_ids?.buyer_id || "",
				factory_id: existing.artifact?.signer_ids?.factory_id || "",
			},
			signature_timestamps: {
				buyer_signed_at: existing.artifact?.signature_timestamps?.buyer_signed_at || "",
				factory_signed_at: existing.artifact?.signature_timestamps?.factory_signed_at || "",
			},
		},
		archived_at: artifactStatus === "archived" ? toIsoNow() : existing.archived_at,
		updated_at: toIsoNow(),
	};

	next.lifecycle_status = normalizeContractLifecycle(next);
	await prisma.$transaction(async (tx) => {
		await tx.document.update({ where: { id: contractId }, data: next });

		if (previousStatus !== artifactStatus && artifactStatus === "locked") {
			await appendContractAudit(
				next.id,
				actor.id,
				"artifact_locked",
				{
					previous: previousStatus,
					now: artifactStatus,
				},
				tx,
			);
		}
		if (previousStatus !== artifactStatus && artifactStatus === "archived") {
			await appendContractAudit(
				next.id,
				actor.id,
				"artifact_archived",
				{
					previous: previousStatus,
					now: artifactStatus,
				},
				tx,
			);
		}
	});

	if (previousStatus !== artifactStatus && artifactStatus === "locked") {
		await trackEvent({
			type: "contract_locked",
			actor_id: actor.id,
			entity_id: next.id,
		});
	}
	if (previousStatus !== artifactStatus && artifactStatus === "archived") {
		await trackEvent({
			type: "contract_archived",
			actor_id: actor.id,
			entity_id: next.id,
		});
	}
	return {
		...presentContractForActor(next, actor),
		payment_proof_ok: paymentProofOk,
	};
}

export async function recordDocumentView(documentId, viewerId, viewerIp) {
	try {
		await prisma.documentView.create({
			data: {
				document_id: documentId,
				viewer_id: viewerId || null,
				viewer_ip: viewerIp || null,
			},
		});
	} catch (err) {
		logError("recordDocumentView failed", err);
	}
}

export async function getDocumentViewCount(documentId) {
	try {
		const count = await prisma.documentView.count({
			where: { document_id: documentId },
		});
		return count;
	} catch {
		return 0;
	}
}

export async function getDocumentViews(documentId, limit = 50) {
	try {
		return await prisma.documentView.findMany({
			where: { document_id: documentId },
			orderBy: { viewed_at: "desc" },
			take: limit,
		});
	} catch {
		return [];
	}
}
