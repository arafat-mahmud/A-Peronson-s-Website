import crypto from "node:crypto";
import { getBuyerRequestSubmissionErrors } from "../../shared/requirementValidation.js";
import { logInfo } from "../utils/logger.js";
import prisma from "../utils/prisma.js";
import { limitWordCount, sanitizeString } from "../utils/validators.js";
import { appendChange, emitAfterCommit } from "./changeLogService.js";
import { contentHash } from "./contentHashService.js";
import { extractOriginalPrice, getBaseCurrency, normalizePriceRange } from "./currencyService.js";
import { getPlanForUser } from "./entitlementService.js";
import {
	nextVersion,
	withBumpedVersionHash,
	withInitialVersionHash,
} from "./entityVersionService.js";
import { bumpFeedGeneration } from "./feedGenerationService.js";
import { createNotification, emitNotificationsForEntity } from "./notificationService.js";
import { deleteRequirementIndex, indexRequirement } from "./openSearchService.js";
import { moderateTextOrRedact } from "./policyService.js";
import { indexRequirement as indexRequirementQdrant } from "./qdrantService.js";
import { recordMilestone } from "./ratingsService.js";

// HyperCache Phase 5: best-effort feed generation bump after commit.
// Fire-and-forget with a catch — generation freshness must never break
// or slow down the entity write path.
function bumpFeedGenerationBestEffort() {
	try {
		const pending = bumpFeedGeneration();
		if (pending && typeof pending.catch === "function") {
			pending.catch(() => {});
		}
	} catch {
		// best-effort only
	}
}

function buildRequirementSummary(requirement) {
	if (!requirement) {
		return "";
	}
	const parts = [];
	const push = (label, value) => {
		const safe = sanitizeString(value || "", 160);
		if (!safe) {
			return;
		}
		parts.push(label ? `${label}: ${safe}` : safe);
	};

	push("", requirement.title || requirement.category);
	push("Type", requirement.request_type);
	push("Category", requirement.category);
	push("Quantity", requirement.quantity);
	push("MOQ", requirement.moq);
	push("Price", requirement.price_range);
	push("Material", requirement.material);
	push("GSM", requirement.fabric_gsm);
	push("Size", requirement.size_range);
	push("Color", requirement.color_pantone);
	push("Customization", requirement.customization_capabilities);
	push("Techpack", requirement.techpack_accepted ? "Accepted" : "");
	push("Sample lead time", requirement.sample_lead_time_days || requirement.sample_timeline);
	push("Lead time", requirement.delivery_timeline || requirement.timeline_days);
	push("Incoterms", requirement.incoterms);
	if (requirement.specs && typeof requirement.specs === "object") {
		const specs = requirement.specs;
		push("Gender", specs.gender_target);
		push("Season", specs.season);
		push("Style", specs.style_description);
		push("Material type", specs.material_type);
		push("Unit", specs.unit);
	}
	if (
		Array.isArray(requirement.certifications_required) &&
		requirement.certifications_required.length > 0
	) {
		push("Certifications", requirement.certifications_required.join(", "));
	}
	push("Compliance", requirement.compliance_details || requirement.compliance_notes);
	return parts.filter(Boolean).slice(0, 12).join(" | ");
}

function normalizeCustomFields(raw = []) {
	if (!Array.isArray(raw)) {
		return [];
	}
	return raw
		.map((row) => ({
			label: sanitizeString(row?.label || "", 120),
			value: sanitizeString(row?.value || "", 240),
		}))
		.filter((row) => row.label || row.value);
}

function buildValidationError(errors = {}) {
	const message = Object.values(errors).filter(Boolean).join(" ");
	if (!message) {
		return null;
	}
	const error = new Error(message);
	error.status = 400;
	error.details = errors;
	return error;
}

function normalizeDate(value) {
	if (!value) {
		return null;
	}
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		return null;
	}
	return date.toISOString();
}

function normalizeSpecs(payload, requestType) {
	const type = String(requestType || "").toLowerCase();
	if (type === "textile") {
		return {
			material_type: sanitizeString(payload.material_type || "", 120),
			sub_category: sanitizeString(payload.sub_category || "", 120),
			unit: sanitizeString(payload.unit || "", 40),
			fiber_composition: sanitizeString(payload.fiber_composition || "", 160),
			fabric_weight_gsm: sanitizeString(
				payload.fabric_weight_gsm || payload.fabric_weight || "",
				40,
			),
			fabric_width: sanitizeString(payload.fabric_width || "", 80),
			yarn_count: sanitizeString(payload.yarn_count || "", 80),
			thread_count: sanitizeString(payload.thread_count || "", 80),
			finish_required: sanitizeString(payload.finish_required || "", 160),
			stretch_required: sanitizeString(payload.stretch_required || "", 80),
			color: sanitizeString(payload.color || "", 120),
			pattern: sanitizeString(payload.pattern || "", 120),
			price_unit: sanitizeString(payload.price_unit || "", 80),
			delivery_port: sanitizeString(payload.delivery_port || "", 120),
			lead_time_required: sanitizeString(payload.lead_time_required || "", 80),
			lab_test_required: sanitizeString(payload.lab_test_required || "", 160),
			swatch_first: sanitizeString(payload.swatch_first || "", 40),
			lab_cert_notes: sanitizeString(payload.lab_cert_notes || "", 240),
			preferred_factory_location: sanitizeString(payload.preferred_factory_location || "", 120),
			factory_size_preference: sanitizeString(payload.factory_size_preference || "", 120),
			export_experience_preference: sanitizeString(payload.export_experience_preference || "", 120),
			confidentiality_toggle: Boolean(payload.confidentiality_toggle),
			packaging_requirement: sanitizeString(payload.packaging_requirement || "", 160),
			origin_label_required: sanitizeString(payload.origin_label_required || "", 160),
			hangtag_barcode: sanitizeString(payload.hangtag_barcode || "", 160),
			partial_shipment_allowed: sanitizeString(payload.partial_shipment_allowed || "", 40),
			shipment_mode: sanitizeString(payload.shipment_mode || "", 40),
		};
	}
	return {
		gender_target: sanitizeString(payload.gender_target || "", 80),
		season: sanitizeString(payload.season || "", 80),
		number_of_styles: sanitizeString(payload.number_of_styles || "", 40),
		fabric_composition: sanitizeString(payload.fabric_composition || "", 160),
		fabric_weight_gsm: sanitizeString(payload.fabric_weight_gsm || payload.fabric_weight || "", 40),
		weave_or_knit: sanitizeString(payload.weave_or_knit || "", 80),
		size_range: sanitizeString(payload.size_range || payload.size_chart || "", 120),
		color_requirement: sanitizeString(payload.color_requirement || "", 160),
		style_description: sanitizeString(payload.style_description || "", 300),
		tech_pack_required: sanitizeString(payload.tech_pack_required || "", 40),
		destination_port: sanitizeString(payload.destination_port || "", 120),
		ex_factory_date: sanitizeString(payload.ex_factory_date || "", 80),
		sample_required: sanitizeString(payload.sample_required || "", 40),
		sample_type: sanitizeString(payload.sample_type || "", 80),
		payment_terms: sanitizeString(payload.payment_terms || "", 120),
		compliance_certs: Array.isArray(payload.compliance_certs)
			? payload.compliance_certs.map((c) => sanitizeString(c, 80))
			: [],
		sustainability_certs: Array.isArray(payload.sustainability_certs)
			? payload.sustainability_certs.map((c) => sanitizeString(c, 80))
			: [],
		compliance_notes: sanitizeString(payload.compliance_notes || "", 240),
		preferred_factory_location: sanitizeString(payload.preferred_factory_location || "", 120),
		factory_size_preference: sanitizeString(payload.factory_size_preference || "", 120),
		export_experience_preference: sanitizeString(payload.export_experience_preference || "", 120),
		confidentiality_toggle: Boolean(payload.confidentiality_toggle),
		packaging_requirement: sanitizeString(payload.packaging_requirement || "", 160),
		origin_label_required: sanitizeString(payload.origin_label_required || "", 160),
		hangtag_barcode: sanitizeString(payload.hangtag_barcode || "", 160),
		partial_shipment_allowed: sanitizeString(payload.partial_shipment_allowed || "", 40),
		shipment_mode: sanitizeString(payload.shipment_mode || "", 40),
	};
}

function assertRequiredFields(payload, requestType, status = "open") {
	if (String(status || "").toLowerCase() === "draft") {
		return;
	}
	const validationPayload = {
		...(payload || {}),
		request_type: requestType || payload.request_type || payload.requestType || "",
	};
	const errors = getBuyerRequestSubmissionErrors(validationPayload);
	const error = buildValidationError(errors);
	if (error) {
		throw error;
	}
}

function normalizeRequirement(buyerId, payload) {
	const requestType =
		sanitizeString(payload.request_type || payload.requestType || "garments", 40).toLowerCase() ===
		"textile"
			? "textile"
			: "garments";
	const status = sanitizeString(payload.status || "open", 20).toLowerCase();
	assertRequiredFields(payload, requestType, status);
	const title = sanitizeString(payload.title || payload.request_title || "", 160);
	const specs = normalizeSpecs(payload, requestType);
	const customFields = normalizeCustomFields(payload.custom_fields || payload.customFields || []);
	const normalized = {
		id: crypto.randomUUID(),
		buyer_id: buyerId,
		title,
		request_type: requestType,
		verified_only: Boolean(payload.verified_only),
		specs,
		custom_fields: customFields,
		quote_deadline: normalizeDate(payload.quote_deadline),
		expires_at: normalizeDate(payload.expires_at),
		max_suppliers:
			payload.max_suppliers !== undefined &&
			payload.max_suppliers !== null &&
			payload.max_suppliers !== ""
				? Number(payload.max_suppliers)
				: null,
		// Structured fields (Phase 2). Older UI will continue to use category/material/quantity/etc.
		product: sanitizeString(payload.product || payload.category, 120),
		industry: sanitizeString(payload.industry || payload.industry_type || "", 80),
		category: sanitizeString(payload.category, 120),
		target_market: sanitizeString(payload.target_market || payload.target || "", 80),
		quantity: sanitizeString(payload.quantity, 40),
		moq: sanitizeString(payload.moq || payload.moq_qty || "", 40),
		price_range: sanitizeString(
			payload.price_range || payload.target_price || payload.target_fob_price,
			80,
		),
		material: sanitizeString(payload.material || payload.fabric_type, 120),
		fabric_gsm: sanitizeString(payload.fabric_gsm || payload.gsm || "", 40),
		timeline_days: sanitizeString(payload.timeline_days, 40),
		delivery_timeline: sanitizeString(
			payload.delivery_timeline || payload.delivery || payload.deadline || "",
			80,
		),
		certifications_required: Array.isArray(payload.certifications_required)
			? payload.certifications_required.map((c) => sanitizeString(c, 80))
			: [],
		shipping_terms: sanitizeString(
			payload.shipping_terms || payload.shipping_port || payload.delivery_port || "",
			120,
		),
		incoterms: sanitizeString(payload.incoterms || payload.incoterm || "", 80),
		payment_terms: sanitizeString(payload.payment_terms || payload.payment || "", 120),
		document_ready: sanitizeString(payload.document_ready || "", 80),
		audit_date: sanitizeString(payload.audit_date || "", 80),
		language_support: sanitizeString(payload.language_support || "", 120),
		capacity_min: sanitizeString(payload.capacity_min || "", 80),
		trims_wash: sanitizeString(payload.trims_wash || payload.trims || payload.wash || "", 200),
		sample_timeline: sanitizeString(payload.sample_timeline || "", 120),
		sample_available: sanitizeString(payload.sample_available || "", 40),
		sample_lead_time_days: sanitizeString(payload.sample_lead_time_days || "", 40),
		packaging: sanitizeString(payload.packaging || "", 200),
		compliance_notes: sanitizeString(payload.compliance_notes || "", 400),
		compliance_details: sanitizeString(payload.compliance_details || "", 400),
		custom_description: sanitizeString(payload.custom_description || "", 10_000),
		size_range: sanitizeString(payload.size_range || payload.size_chart || "", 120),
		color_pantone: sanitizeString(payload.color_pantone || payload.colors || "", 120),
		customization_capabilities: sanitizeString(
			payload.customization_capabilities || payload.customization || "",
			240,
		),
		techpack_accepted: Boolean(payload.techpack_accepted),
		// Lead ownership / assignment (Buying House flow).
		assigned_agent_id: sanitizeString(payload.assigned_agent_id || "", 120),
		// DateTime? column: an empty string made Prisma reject every new request.
		assigned_at: normalizeDate(payload.assigned_at),
		assigned_by: sanitizeString(payload.assigned_by || "", 120),
		status: status || "open",
		priority_tier: sanitizeString(payload.priority_tier || "", 40),
		priority_until: normalizeDate(payload.priority_until),
		created_at: new Date().toISOString(),
	};
	normalized.ai_summary = buildRequirementSummary(normalized);
	return normalized;
}

export async function createRequirement(buyerId, payload) {
	const requirement = normalizeRequirement(buyerId, payload);
	const baseCurrency = await getBaseCurrency();
	const originalPrice = extractOriginalPrice(payload);
	const normalizedPrice = await normalizePriceRange({
		min: originalPrice.priceOriginalMin,
		max: originalPrice.priceOriginalMax,
		currency: originalPrice.currency,
		baseCurrency,
	});
	requirement.currency = originalPrice.currency;
	requirement.priceOriginalMin = normalizedPrice.priceOriginalMin;
	requirement.priceOriginalMax = normalizedPrice.priceOriginalMax;
	requirement.priceBaseMin = normalizedPrice.priceBaseMin;
	requirement.priceBaseMax = normalizedPrice.priceBaseMax;
	requirement.priceNormalizedBase = normalizedPrice.priceBaseMin;
	const plan = await getPlanForUser({ id: buyerId });
	const maxWords = plan === "premium" ? 1500 : 600;
	requirement.custom_description = limitWordCount(requirement.custom_description, maxWords);
	if (plan === "premium") {
		requirement.priority_tier = "priority";
		requirement.priority_until = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
	} else {
		requirement.priority_tier = "standard";
		requirement.priority_until = null;
	}

	// Trust & safety (project.md): auto-remove outside-contact sharing or obscene text.
	// We moderate the free-text fields that are most likely to contain contact details.
	try {
		const actor = await prisma.user.findUnique({ where: { id: buyerId } });
		if (actor) {
			const moderated = await moderateTextOrRedact({
				actor,
				text: requirement.custom_description,
				entity_type: "buyer_request",
				entity_id: requirement.id,
			});
			requirement.custom_description = moderated.text;
			requirement.moderated = Boolean(moderated.moderated);
			requirement.moderation_reason = moderated.reason || "";
		}
	} catch {
		// silent: never block creation due to moderation pipeline failures
	}

	// HyperCache Phase 5: entity write + ledger append in one $transaction
	// (entity_type "requirement") following the feedPostService.js pattern.
	const requirementLedgerRow = await prisma.$transaction(async (tx) => {
		const created = await tx.requirement.create({
			data: withInitialVersionHash(requirement, contentHash(requirement)),
		});
		return appendChange(tx, {
			scope: String(buyerId || ""),
			entity_type: "requirement",
			entity_id: created.id,
			operation: "CREATE",
			entity_version: created.version ?? 1,
			content_hash: created.content_hash ?? null,
		});
	});
	emitAfterCommit(requirementLedgerRow);
	bumpFeedGenerationBestEffort();
	try {
		const author = await prisma.user.findUnique({ where: { id: buyerId } });
		await indexRequirement(requirement, {
			...(author || {}),
			...(author?.profile || {}),
		});
		indexRequirementQdrant(requirement, author || {});
	} catch {
		// ignore index failures
	}
	const isDraft = String(requirement.status || "").toLowerCase() === "draft";
	if (!isDraft) {
		await emitNotificationsForEntity("buyer_request", requirement);
		try {
			const targets = await prisma.user.findMany({
				where: {
					verified: true,
					role: { in: ["factory", "buying_house"] },
				},
			});
			await Promise.all(
				targets.map((target) =>
					createNotification(target.id, {
						type: "buyer_request_verified",
						entity_type: "buyer_request",
						entity_id: requirement.id,
						message: `New buyer request available (${requirement.request_type || "garments"}).`,
						meta: {
							request_type: requirement.request_type || "garments",
							title: requirement.title || "",
							category: requirement.category || "",
						},
					}),
				),
			);
		} catch {
			// non-blocking notifications
		}
	}
	logInfo("Buyer request created", {
		requirement_id: requirement.id,
		buyer_id: buyerId,
		status: requirement.status,
		at: requirement.created_at,
	});
	return requirement;
}

export async function listRequirements(filters = {}) {
	const where = {};
	if (filters.buyerId) {
		where.buyer_id = filters.buyerId;
	}
	if (filters.status) {
		where.status = filters.status;
	}
	if (filters.createdAfter) {
		where.created_at = { gte: filters.createdAfter };
	}
	return prisma.requirement.findMany({ where });
}

export async function getRequirementById(id) {
	return prisma.requirement.findUnique({ where: { id } });
}

export async function updateRequirement(requirementId, patch, actor) {
	const existing = await prisma.requirement.findUnique({
		where: { id: requirementId },
	});
	if (!existing) {
		return null;
	}
	if (actor.role === "buyer" && existing.buyer_id !== actor.id) {
		return "forbidden";
	}

	const actorRole = String(actor?.role || "").toLowerCase();
	const canAssign = actorRole === "buying_house" || actorRole === "owner" || actorRole === "admin";

	const requestedAssignedAgentId =
		patch.assigned_agent_id === undefined
			? undefined
			: sanitizeString(patch.assigned_agent_id || "", 120);
	const assignmentChanged =
		requestedAssignedAgentId !== undefined &&
		requestedAssignedAgentId !== String(existing.assigned_agent_id || "");
	if (assignmentChanged && !canAssign) {
		return "forbidden";
	}

	const nextRequestType =
		patch.request_type !== undefined || patch.requestType !== undefined
			? sanitizeString(
					patch.request_type || patch.requestType || existing.request_type || "garments",
					40,
				).toLowerCase() === "textile"
				? "textile"
				: "garments"
			: sanitizeString(existing.request_type || "garments", 40).toLowerCase() === "textile"
				? "textile"
				: "garments";
	const mergedSpecs =
		patch.specs === undefined
			? normalizeSpecs({ ...existing.specs, ...patch }, nextRequestType)
			: normalizeSpecs(patch.specs, nextRequestType);
	const mergedCustomFields =
		patch.custom_fields !== undefined || patch.customFields !== undefined
			? normalizeCustomFields(patch.custom_fields || patch.customFields || [])
			: normalizeCustomFields(existing.custom_fields || []);

	const next = {
		...existing,
		title: patch.title === undefined ? existing.title || "" : sanitizeString(patch.title, 160),
		request_type: nextRequestType,
		verified_only:
			patch.verified_only === undefined
				? Boolean(existing.verified_only)
				: Boolean(patch.verified_only),
		specs: mergedSpecs,
		custom_fields: mergedCustomFields,
		quote_deadline:
			patch.quote_deadline === undefined
				? (existing.quote_deadline ?? null)
				: normalizeDate(patch.quote_deadline),
		expires_at:
			patch.expires_at === undefined
				? (existing.expires_at ?? null)
				: normalizeDate(patch.expires_at),
		max_suppliers:
			patch.max_suppliers === undefined
				? (existing.max_suppliers ?? null)
				: patch.max_suppliers === null || patch.max_suppliers === ""
					? null
					: Number(patch.max_suppliers),
		product:
			patch.product === undefined ? existing.product || "" : sanitizeString(patch.product, 120),
		category:
			patch.category === undefined ? existing.category : sanitizeString(patch.category, 120),
		industry:
			patch.industry === undefined ? existing.industry || "" : sanitizeString(patch.industry, 80),
		target_market:
			patch.target_market === undefined
				? existing.target_market || ""
				: sanitizeString(patch.target_market, 80),
		quantity: patch.quantity === undefined ? existing.quantity : sanitizeString(patch.quantity, 40),
		price_range:
			patch.price_range === undefined
				? existing.price_range
				: sanitizeString(patch.price_range, 80),
		material:
			patch.material === undefined ? existing.material : sanitizeString(patch.material, 120),
		moq: patch.moq === undefined ? existing.moq || "" : sanitizeString(patch.moq, 40),
		fabric_gsm:
			patch.fabric_gsm === undefined
				? existing.fabric_gsm || ""
				: sanitizeString(patch.fabric_gsm, 40),
		timeline_days:
			patch.timeline_days === undefined
				? existing.timeline_days
				: sanitizeString(patch.timeline_days, 40),
		delivery_timeline:
			patch.delivery_timeline === undefined
				? existing.delivery_timeline || ""
				: sanitizeString(patch.delivery_timeline, 80),
		certifications_required:
			patch.certifications_required === undefined
				? existing.certifications_required
				: Array.isArray(patch.certifications_required)
					? patch.certifications_required.map((c) => sanitizeString(c, 80))
					: [],
		shipping_terms:
			patch.shipping_terms === undefined
				? existing.shipping_terms
				: sanitizeString(patch.shipping_terms, 120),
		incoterms:
			patch.incoterms === undefined
				? existing.incoterms || ""
				: sanitizeString(patch.incoterms, 80),
		payment_terms:
			patch.payment_terms === undefined
				? existing.payment_terms || ""
				: sanitizeString(patch.payment_terms, 120),
		document_ready:
			patch.document_ready === undefined
				? existing.document_ready || ""
				: sanitizeString(patch.document_ready, 80),
		audit_date:
			patch.audit_date === undefined
				? existing.audit_date || ""
				: sanitizeString(patch.audit_date, 80),
		language_support:
			patch.language_support === undefined
				? existing.language_support || ""
				: sanitizeString(patch.language_support, 120),
		capacity_min:
			patch.capacity_min === undefined
				? existing.capacity_min || ""
				: sanitizeString(patch.capacity_min, 80),
		trims_wash:
			patch.trims_wash === undefined
				? existing.trims_wash || ""
				: sanitizeString(patch.trims_wash, 200),
		sample_timeline:
			patch.sample_timeline === undefined
				? existing.sample_timeline || ""
				: sanitizeString(patch.sample_timeline, 120),
		sample_available:
			patch.sample_available === undefined
				? existing.sample_available || ""
				: sanitizeString(patch.sample_available, 40),
		sample_lead_time_days:
			patch.sample_lead_time_days === undefined
				? existing.sample_lead_time_days || ""
				: sanitizeString(patch.sample_lead_time_days, 40),
		packaging:
			patch.packaging === undefined
				? existing.packaging || ""
				: sanitizeString(patch.packaging, 200),
		compliance_notes:
			patch.compliance_notes === undefined
				? existing.compliance_notes || ""
				: sanitizeString(patch.compliance_notes, 400),
		compliance_details:
			patch.compliance_details === undefined
				? existing.compliance_details || ""
				: sanitizeString(patch.compliance_details, 400),
		custom_description:
			patch.custom_description === undefined
				? existing.custom_description
				: sanitizeString(patch.custom_description, 10_000),
		size_range:
			patch.size_range === undefined
				? existing.size_range || ""
				: sanitizeString(patch.size_range, 120),
		color_pantone:
			patch.color_pantone === undefined
				? existing.color_pantone || ""
				: sanitizeString(patch.color_pantone, 120),
		customization_capabilities:
			patch.customization_capabilities === undefined
				? existing.customization_capabilities || ""
				: sanitizeString(patch.customization_capabilities, 240),
		techpack_accepted:
			patch.techpack_accepted === undefined
				? Boolean(existing.techpack_accepted)
				: Boolean(patch.techpack_accepted),
		status: patch.status === undefined ? existing.status : sanitizeString(patch.status, 20),
		assigned_agent_id: assignmentChanged
			? requestedAssignedAgentId
			: sanitizeString(existing.assigned_agent_id || "", 120),
		assigned_at: assignmentChanged ? new Date().toISOString() : normalizeDate(existing.assigned_at),
		assigned_by: assignmentChanged
			? sanitizeString(actor.id || "", 120)
			: sanitizeString(existing.assigned_by || "", 120),
		priority_tier:
			patch.priority_tier === undefined
				? existing.priority_tier || ""
				: sanitizeString(patch.priority_tier || "", 40),
		priority_until:
			patch.priority_until === undefined
				? existing.priority_until || null
				: normalizeDate(patch.priority_until),
	};

	const baseCurrency = await getBaseCurrency();
	const originalPrice = extractOriginalPrice({
		priceOriginalMin:
			patch.priceOriginalMin === undefined ? existing.priceOriginalMin : patch.priceOriginalMin,
		priceOriginalMax:
			patch.priceOriginalMax === undefined ? existing.priceOriginalMax : patch.priceOriginalMax,
		priceOriginal: patch.priceOriginal === undefined ? existing.priceOriginal : patch.priceOriginal,
		currency:
			patch.currency === undefined
				? existing.currency || existing.currencyOriginal
				: patch.currency,
		price_range: next.price_range,
	});
	const normalizedPrice = await normalizePriceRange({
		min: originalPrice.priceOriginalMin,
		max: originalPrice.priceOriginalMax,
		currency: originalPrice.currency,
		baseCurrency,
	});
	next.currency = originalPrice.currency;
	next.priceOriginalMin = normalizedPrice.priceOriginalMin;
	next.priceOriginalMax = normalizedPrice.priceOriginalMax;
	next.priceBaseMin = normalizedPrice.priceBaseMin;
	next.priceBaseMax = normalizedPrice.priceBaseMax;
	next.priceNormalizedBase = normalizedPrice.priceBaseMin;

	assertRequiredFields(
		{
			...next,
			...next.specs,
			request_type: next.request_type,
		},
		next.request_type,
		next.status,
	);

	next.ai_summary = buildRequirementSummary(next);

	// Trust & safety moderation for updated free-text fields.
	try {
		if (patch.custom_description !== undefined) {
			const moderated = await moderateTextOrRedact({
				actor,
				text: next.custom_description,
				entity_type: "buyer_request",
				entity_id: next.id,
			});
			next.custom_description = moderated.text;
			next.moderated = Boolean(moderated.moderated);
			next.moderation_reason = moderated.reason || "";
		}
	} catch {
		// silent
	}

	if (patch.custom_description !== undefined) {
		const plan = await getPlanForUser(actor);
		const maxWords = plan === "premium" ? 1500 : 600;
		next.custom_description = limitWordCount(next.custom_description, maxWords);
	}

	// HyperCache Phase 5: version bump + ledger append in one $transaction
	// (entity_type "requirement", operation UPDATE) following feedPostService.js.
	const { version: _ignoredReqVersion, content_hash: _ignoredReqHash, ...hashableReqNext } = next;
	const requirementUpdateHash = contentHash(hashableReqNext);
	const requirementUpdateLedgerRow = await prisma.$transaction(async (tx) => {
		await tx.requirement.update({
			where: { id: requirementId },
			data: withBumpedVersionHash(next, existing.version, requirementUpdateHash),
		});
		return appendChange(tx, {
			scope: String(next.buyer_id || ""),
			entity_type: "requirement",
			entity_id: requirementId,
			operation: "UPDATE",
			entity_version: nextVersion(existing.version),
			content_hash: requirementUpdateHash,
		});
	});
	emitAfterCommit(requirementUpdateLedgerRow);
	bumpFeedGenerationBestEffort();
	try {
		const author = await prisma.user.findUnique({
			where: { id: next.buyer_id },
		});
		await indexRequirement(next, {
			...(author || {}),
			...(author?.profile || {}),
		});
		indexRequirementQdrant(next, author || {});
	} catch {
		// ignore index failures
	}
	// project.md: smart notifications trigger when new matching buyer requests appear.
	// Emit on updates as well so edited requests can match saved alerts.
	await emitNotificationsForEntity("buyer_request", next);

	const normalizedStatus = String(next.status || "").toLowerCase();
	const statusTransitioned = normalizedStatus !== String(existing.status || "").toLowerCase();
	if (
		statusTransitioned &&
		["deal_completed", "closed", "fulfilled", "completed"].includes(normalizedStatus) &&
		patch?.counterparty_id
	) {
		await recordMilestone({
			profileKey: `user:${actor.id}`,
			counterpartyId: sanitizeString(patch.counterparty_id, 120),
			interactionType: "deal",
			milestone: "deal_completed",
			actorId: actor.id,
		});
	}

	return next;
}

export async function removeRequirement(requirementId, actor) {
	const target = await prisma.requirement.findUnique({
		where: { id: requirementId },
	});
	if (!target) {
		return false;
	}
	if (actor.role === "buyer" && target.buyer_id !== actor.id) {
		return "forbidden";
	}
	// HyperCache Phase 5: tombstone ledger row in the same $transaction
	// (entity_type "requirement", operation DELETE) following feedPostService.js.
	const requirementDeleteLedgerRow = await prisma.$transaction(async (tx) => {
		await tx.requirement.delete({ where: { id: requirementId } });
		return appendChange(tx, {
			scope: String(target.buyer_id || ""),
			entity_type: "requirement",
			entity_id: requirementId,
			operation: "DELETE",
			entity_version: nextVersion(target.version),
			content_hash: target.content_hash ?? null,
		});
	});
	emitAfterCommit(requirementDeleteLedgerRow);
	bumpFeedGenerationBestEffort();
	try {
		await deleteRequirementIndex(requirementId);
	} catch {
		// ignore index failures
	}
	return true;
}
