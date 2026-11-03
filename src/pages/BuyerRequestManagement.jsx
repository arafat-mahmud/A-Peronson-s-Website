/**
 * @typedef {Object} BuyerRequestForm
 * @property {string} requestType
 * @property {string} title
 * @property {string} industry
 * @property {string} category
 * @property {string} genderTarget
 * @property {string} season
 * @property {string} totalQuantity
 * @property {string} numberOfStyles
 * @property {string} fabricComposition
 * @property {string} fabricWeightGsm
 * @property {string} weaveOrKnit
 * @property {string} sizeRange
 * @property {string} colorRequirement
 * @property {string} styleDescription
 * @property {string} techPackRequired
 * @property {string} targetFobPrice
 * @property {string} incoterms
 * @property {string} destinationPort
 * @property {string} exFactoryDate
 * @property {string} sampleRequired
 * @property {string} sampleType
 * @property {string} paymentTerms
 * @property {string[]} complianceCerts
 * @property {string[]} sustainabilityCerts
 * @property {string} complianceNotes
 * @property {string} materialType
 * @property {string} subCategory
 * @property {string} quantity
 * @property {string} unit
 * @property {string} fiberComposition
 * @property {string} fabricWidth
 * @property {string} yarnCount
 * @property {string} threadCount
 * @property {string} finishRequired
 * @property {string} stretchRequired
 * @property {string} color
 * @property {string} pattern
 * @property {string} targetPrice
 * @property {string} priceUnit
 * @property {string} deliveryPort
 * @property {string} leadTimeRequired
 * @property {string} labTestRequired
 * @property {string} swatchFirst
 * @property {string} labCertNotes
 * @property {string} quoteDeadline
 * @property {string} expiresAt
 * @property {string} maxSuppliers
 * @property {boolean} verifiedOnly
 * @property {string} preferredFactoryLocation
 * @property {string} factorySizePreference
 * @property {string} exportExperiencePreference
 * @property {boolean} confidentialityToggle
 * @property {string} packagingRequirement
 * @property {string} originLabelRequired
 * @property {string} hangtagBarcode
 * @property {string} partialShipmentAllowed
 * @property {string} shipmentMode
 * @property {Array<{label: string, value: string}>} customFields
 * @property {string} customDescription
 */

import { AnimatePresence, motion } from "framer-motion";
import {
	ArrowLeft,
	ArrowRight,
	Bot,
	CheckCircle2,
	ChevronRight,
	ClipboardList,
	CloudUpload,
	Edit3,
	FileText,
	Filter,
	Layers3,
	MoonStar,
	Plus,
	RefreshCw,
	Sparkles,
	SunMedium,
	Trash2,
	X,
	Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ThreeDot } from "react-loading-indicators";
import { Link } from "react-router-dom";
import { garmentCategories, textileCategories } from "../../shared/config/platformTaxonomy.js";
import {
	getBuyerRequestErrorStep,
	getBuyerRequestStepErrors,
	getBuyerRequestSubmissionErrors,
} from "../../shared/requirementValidation.js";
import ScrollReveal from "../components/ScrollReveal.jsx";
/*
  Route: /buyer-requests
  Access: Protected (login required)
  Allowed roles: buyer, buying_house, admin

  Primary responsibilities:
    - Manage buyer requests (create, edit, delete, assign).
    - AI-assisted request creation.
    - Status tracking and management.
*/
import NeonAtom from "../components/ui/NeonAtom.jsx";
import UploadProgressBar from "../components/ui/UploadProgressBar.jsx";
import WordCount from "../components/ui/WordCount.jsx";
import { useEntitlements, useSecureUser } from "../hooks/useSecureUser.js";
import { mapExtractedToForm } from "../lib/aiPrefill.js";
import { apiRequest, getCurrentUser, getToken, hasEntitlement } from "../lib/auth.js";
import { logger } from "../lib/logger.js";
import { useTheme } from "../lib/ThemeProvider.jsx";
import { uploadFile } from "../lib/upload.js";

/** @type {BuyerRequestForm} */
const EMPTY_FORM = {
	requestType: "",
	title: "",
	industry: "",
	category: "",
	genderTarget: "",
	season: "",
	totalQuantity: "",
	numberOfStyles: "",
	fabricComposition: "",
	fabricWeightGsm: "",
	weaveOrKnit: "",
	sizeRange: "",
	colorRequirement: "",
	styleDescription: "",
	techPackRequired: "",
	targetFobPrice: "",
	incoterms: "",
	destinationPort: "",
	exFactoryDate: "",
	sampleRequired: "",
	sampleType: "",
	paymentTerms: "",
	complianceCerts: [],
	sustainabilityCerts: [],
	complianceNotes: "",
	materialType: "",
	subCategory: "",
	quantity: "",
	unit: "",
	fiberComposition: "",
	fabricWidth: "",
	yarnCount: "",
	threadCount: "",
	finishRequired: "",
	stretchRequired: "",
	color: "",
	pattern: "",
	targetPrice: "",
	priceUnit: "",
	deliveryPort: "",
	leadTimeRequired: "",
	labTestRequired: "",
	swatchFirst: "",
	labCertNotes: "",
	quoteDeadline: "",
	expiresAt: "",
	maxSuppliers: "",
	verifiedOnly: false,
	preferredFactoryLocation: "",
	factorySizePreference: "",
	exportExperiencePreference: "",
	confidentialityToggle: false,
	packagingRequirement: "",
	originLabelRequired: "",
	hangtagBarcode: "",
	partialShipmentAllowed: "",
	shipmentMode: "",
	customFields: [],
	customDescription: "",
};

/**
 * Converts form data to API payload.
 * @param {BuyerRequestForm} form The form state.
 * @returns {Object} The API payload.
 */
function formToPayload(form) {
	const isTextile = form.requestType === "textile";
	const category = isTextile ? form.subCategory : form.category;
	const priceRange = isTextile ? form.targetPrice : form.targetFobPrice;
	const quantity = isTextile ? form.quantity : form.totalQuantity;

	return {
		request_type: form.requestType || "garments",
		title: form.title,
		industry: form.industry,
		category,
		product: isTextile ? form.materialType : form.category,
		quantity,
		price_range: priceRange,
		incoterms: form.incoterms,
		payment_terms: form.paymentTerms,
		material: isTextile ? form.fiberComposition : form.fabricComposition,
		fabric_gsm: form.fabricWeightGsm,
		size_range: form.sizeRange,
		color_pantone: form.colorRequirement,
		custom_description: form.customDescription,
		quote_deadline: form.quoteDeadline || null,
		expires_at: form.expiresAt || null,
		max_suppliers: form.maxSuppliers || null,
		verified_only: Boolean(form.verifiedOnly),
		custom_fields: Array.isArray(form.customFields) ? form.customFields : [],
		gender_target: form.genderTarget,
		season: form.season,
		number_of_styles: form.numberOfStyles,
		fabric_composition: form.fabricComposition,
		weave_or_knit: form.weaveOrKnit,
		color_requirement: form.colorRequirement,
		style_description: form.styleDescription,
		tech_pack_required: form.techPackRequired,
		destination_port: form.destinationPort,
		ex_factory_date: form.exFactoryDate,
		sample_required: form.sampleRequired,
		sample_type: form.sampleType,
		compliance_certs: Array.isArray(form.complianceCerts) ? form.complianceCerts : [],
		sustainability_certs: Array.isArray(form.sustainabilityCerts) ? form.sustainabilityCerts : [],
		compliance_notes: form.complianceNotes,
		material_type: form.materialType,
		sub_category: form.subCategory,
		unit: form.unit,
		fiber_composition: form.fiberComposition,
		fabric_width: form.fabricWidth,
		yarn_count: form.yarnCount,
		thread_count: form.threadCount,
		finish_required: form.finishRequired,
		stretch_required: form.stretchRequired,
		color: form.color,
		pattern: form.pattern,
		target_price: form.targetPrice,
		price_unit: form.priceUnit,
		delivery_port: form.deliveryPort,
		lead_time_required: form.leadTimeRequired,
		lab_test_required: form.labTestRequired,
	};
}

/**
 * Converts API requirement to form data.
 * @param {Object} req The requirement object from API.
 * @returns {BuyerRequestForm} The form state.
 */
function requirementToForm(req) {
	const specs = req?.specs && typeof req.specs === "object" ? req.specs : {};
	return {
		...EMPTY_FORM,
		requestType: req.request_type || "garments",
		title: req.title || "",
		industry: req.industry || "",
		category: req.category || "",
		genderTarget: specs.gender_target || "",
		season: specs.season || "",
		totalQuantity: req.quantity || "",
		numberOfStyles: specs.number_of_styles || "",
		fabricComposition: specs.fabric_composition || req.material || "",
		fabricWeightGsm: specs.fabric_weight_gsm || req.fabric_gsm || "",
		weaveOrKnit: specs.weave_or_knit || "",
		sizeRange: specs.size_range || req.size_range || "",
		colorRequirement: specs.color_requirement || req.color_pantone || "",
		styleDescription: specs.style_description || "",
		techPackRequired: specs.tech_pack_required || "",
		targetFobPrice: req.price_range || "",
		incoterms: req.incoterms || "",
		destinationPort: specs.destination_port || "",
		exFactoryDate: specs.ex_factory_date || "",
		sampleRequired: specs.sample_required || "",
		sampleType: specs.sample_type || "",
		paymentTerms: specs.payment_terms || req.payment_terms || "",
		complianceCerts: Array.isArray(specs.compliance_certs) ? specs.compliance_certs : [],
		sustainabilityCerts: Array.isArray(specs.sustainability_certs)
			? specs.sustainability_certs
			: [],
		complianceNotes: specs.compliance_notes || req.compliance_notes || "",
		materialType: specs.material_type || "",
		subCategory: specs.sub_category || req.category || "",
		quantity: req.quantity || "",
		unit: specs.unit || "",
		fiberComposition: specs.fiber_composition || "",
		fabricWidth: specs.fabric_width || "",
		yarnCount: specs.yarn_count || "",
		threadCount: specs.thread_count || "",
		finishRequired: specs.finish_required || "",
		stretchRequired: specs.stretch_required || "",
		color: specs.color || "",
		pattern: specs.pattern || "",
		targetPrice: req.price_range || "",
		priceUnit: specs.price_unit || "",
		deliveryPort: specs.delivery_port || "",
		leadTimeRequired: specs.lead_time_required || "",
		labTestRequired: specs.lab_test_required || "",
		swatchFirst: specs.swatch_first || "",
		labCertNotes: specs.lab_cert_notes || "",
		quoteDeadline: req.quote_deadline
			? new Date(req.quote_deadline).toISOString().slice(0, 10)
			: "",
		expiresAt: req.expires_at ? new Date(req.expires_at).toISOString().slice(0, 10) : "",
		maxSuppliers: req.max_suppliers ?? "",
		verifiedOnly: Boolean(req.verified_only),
		preferredFactoryLocation: specs.preferred_factory_location || "",
		factorySizePreference: specs.factory_size_preference || "",
		exportExperiencePreference: specs.export_experience_preference || "",
		confidentialityToggle: Boolean(specs.confidentiality_toggle),
		packagingRequirement: specs.packaging_requirement || "",
		originLabelRequired: specs.origin_label_required || "",
		hangtagBarcode: specs.hangtag_barcode || "",
		partialShipmentAllowed: specs.partial_shipment_allowed || "",
		shipmentMode: specs.shipment_mode || "",
		customFields: Array.isArray(specs.custom_fields) ? specs.custom_fields : [],
		customDescription: req.custom_description || specs.custom_description || "",
	};
}

// ... (rest of the file as before)

function toPublicFileUrl(filePath = "") {
	if (!filePath) {
		return "";
	}
	const normalized = String(filePath).replace(/\\/g, "/");
	const marker = "server/uploads/";
	if (normalized.includes(marker)) {
		const suffix = normalized.split(marker)[1];
		return `/uploads/${suffix}`;
	}
	if (normalized.startsWith("/uploads/")) {
		return normalized;
	}
	if (normalized.startsWith("uploads/")) {
		return `/${normalized}`;
	}
	return normalized.startsWith("/") ? normalized : `/${normalized}`;
}

const GARMENT_COMPLIANCE_CERTS = ["BSCI", "WRAP", "SA8000"];
const GARMENT_SUSTAIN_CERTS = ["GOTS", "OEKO-TEX", "GRS"];

const roles = ["buyer", "buying_house", "admin"];

const badge =
	"inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium tracking-wide";

function Pill({ children, className = "" }) {
	return <span class={`${badge} ${className}`}>{children}</span>;
}

function Field({ label, children, hint, error, required }) {
	return (
		<label class="block space-y-1.5">
			<div class="flex items-center justify-between gap-3">
				<span class="text-sm font-medium text-slate-700 dark:text-slate-200">
					{label} {required ? <span class="text-sky-500">*</span> : null}
				</span>
				{hint ? <span class="text-xs text-slate-400 dark:text-slate-500">{hint}</span> : null}
			</div>
			{children}
			{error ? <p class="text-xs font-semibold text-rose-500">{error}</p> : null}
		</label>
	);
}

function Input(props) {
	return (
		<input
			{...props}
			class={`w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-4 focus:ring-sky-400/15 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 ${props.className || ""}`}
		/>
	);
}

function TextArea(props) {
	return (
		<textarea
			{...props}
			class={`w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-4 focus:ring-sky-400/15 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 ${props.className || ""}`}
		/>
	);
}

function Select(props) {
	return (
		<select
			{...props}
			class={`w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-sm outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-400/15 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 ${props.className || ""}`}
		/>
	);
}

function requestStatusBadge(status = "") {
	const s = String(status || "open").toLowerCase();
	if (s === "open" || s === "active") {
		return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-200 border-emerald-500/20";
	}
	if (s === "reviewing" || s === "reviewing_quotes") {
		return "bg-amber-500/15 text-amber-700 dark:text-amber-200 border-amber-500/20";
	}
	if (s === "closed" || s === "completed") {
		return "bg-zinc-500/15 text-zinc-700 dark:text-zinc-200 border-zinc-500/20";
	}
	return "bg-zinc-500/15 text-zinc-700 dark:text-zinc-200 border-zinc-500/20";
}

function formatRequestStatus(status = "") {
	const s = String(status || "open").toLowerCase();
	if (s === "open" || s === "active") {
		return "Active";
	}
	if (s === "reviewing" || s === "reviewing_quotes") {
		return "Reviewing Quotes";
	}
	if (s === "closed" || s === "completed") {
		return "Closed";
	}
	return String(status || "open").replaceAll("_", " ");
}

export default function BuyerRequestManagement() {
	const user = useMemo(() => getCurrentUser(), []);
	const { user: secureUser, loading: secureLoading } = useSecureUser();
	const { hasEntitlement: secureHasEntitlement } = useEntitlements();
	const role = secureUser?.role || String(user?.role || "").toLowerCase();
	const canSmartMatch =
		secureHasEntitlement("smart_supplier_matching") ||
		hasEntitlement(user, "smart_supplier_matching");

	const { theme, toggleTheme } = useTheme();
	const [moreFieldsOpen, setMoreFieldsOpen] = useState(false);
	const [form, setForm] = useState(EMPTY_FORM);
	const [step, setStep] = useState(0);
	const [pendingAttachments, setPendingAttachments] = useState([]);
	const [fieldErrors, setFieldErrors] = useState({});

	const [requests, setRequests] = useState([]);
	const [browse, setBrowse] = useState([]);
	const [agents, setAgents] = useState([]);
	const [attachmentsByRequest, setAttachmentsByRequest] = useState({});
	const [uploadingAttachmentId, setUploadingAttachmentId] = useState("");
	const [attachmentUploadProgress, setAttachmentUploadProgress] = useState(0);
	const [attachmentFeedback, setAttachmentFeedback] = useState("");
	const [attachmentTypeByRequest, setAttachmentTypeByRequest] = useState({});

	const [loading, setLoading] = useState(true);
	const [loadingBrowse, setLoadingBrowse] = useState(false);
	const [pageLoading, setPageLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState("");
	const [success, setSuccess] = useState("");
	const [smartMatches, setSmartMatches] = useState({});
	const [smartMatchLoading, setSmartMatchLoading] = useState("");
	const [smartMatchError, setSmartMatchError] = useState({});
	const [aiParsing, setAiParsing] = useState(false);
	const [aiParseWarnings, setAiParseWarnings] = useState([]);
	const [aiParseFeedback, setAiParseFeedback] = useState("");

	const [editingId, setEditingId] = useState("");
	const [editForm, setEditForm] = useState(EMPTY_FORM);

	const token = useMemo(() => getToken(), []);

	const isTextile = form.requestType === "textile";
	const steps = useMemo(
		() =>
			isTextile
				? ["Type", "Basics", "Technical", "Commercial", "Compliance", "Preview"]
				: ["Type", "Basics", "Product", "Commercial", "Compliance", "Preview"],
		[isTextile],
	);
	const isFirstStep = step === 0;
	const isLastStep = step === steps.length - 1;

	useEffect(() => {
		if (step > steps.length - 1) {
			setStep(steps.length - 1);
		}
	}, [step, steps.length]);

	function clearValidationState() {
		setFieldErrors({});
		setError("");
	}

	function validateCurrentStep(targetStep = step) {
		const nextErrors = getBuyerRequestStepErrors(form, targetStep);
		setFieldErrors(nextErrors);
		if (Object.keys(nextErrors).length > 0) {
			setError("Please fix the highlighted fields before continuing.");
			return false;
		}
		return true;
	}

	function handleNext() {
		if (!validateCurrentStep(step)) {
			return;
		}
		clearValidationState();
		setStep((prev) => Math.min(steps.length - 1, prev + 1));
	}

	function handleBack() {
		clearValidationState();
		setStep((prev) => Math.max(0, prev - 1));
	}

	function updateCustomField(index, key, value) {
		setForm((prev) => {
			const next = Array.isArray(prev.customFields) ? [...prev.customFields] : [];
			const row = next[index] || { label: "", value: "" };
			next[index] = { ...row, [key]: value };
			return { ...prev, customFields: next };
		});
	}

	function addCustomField() {
		setForm((prev) => ({
			...prev,
			customFields: [
				...(Array.isArray(prev.customFields) ? prev.customFields : []),
				{ label: "", value: "" },
			],
		}));
	}

	function removeCustomField(index) {
		setForm((prev) => ({
			...prev,
			customFields: (Array.isArray(prev.customFields) ? prev.customFields : []).filter(
				(_, i) => i !== index,
			),
		}));
	}

	const loadRequests = useCallback(async () => {
		if (!token) {
			return;
		}
		setLoading(true);
		setError("");
		try {
			const data = await apiRequest("/requirements", { token });
			setRequests(Array.isArray(data) ? data : []);
		} catch (err) {
			setError(err.message || "Failed to load buyer requests.");
			setRequests([]);
		} finally {
			setLoading(false);
		}
	}, [token]);

	const loadBrowse = useCallback(async () => {
		if (!token || role !== "buyer") {
			return;
		}
		setLoadingBrowse(true);
		try {
			const data = await apiRequest("/requirements/browse", { token });
			setBrowse(Array.isArray(data) ? data : []);
		} catch (err) {
			logger.warn("Failed to load browse:", err);
			setBrowse([]);
		} finally {
			setLoadingBrowse(false);
		}
	}, [role, token]);

	const loadAgents = useCallback(async () => {
		if (!token) {
			return;
		}
		if (!(role === "buying_house" || role === "admin")) {
			return;
		}
		try {
			const data = await apiRequest("/org/members", { token });
			setAgents(Array.isArray(data?.members) ? data.members : []);
		} catch (err) {
			logger.warn("Failed to load agents:", err);
			setAgents([]);
		}
	}, [role, token]);

	const loadAttachments = useCallback(
		async (requirementId) => {
			if (!(token && requirementId)) {
				return;
			}
			try {
				const data = await apiRequest(
					`/documents?entity_type=buyer_request&entity_id=${encodeURIComponent(requirementId)}`,
					{ token },
				);
				setAttachmentsByRequest((prev) => ({
					...prev,
					[requirementId]: Array.isArray(data) ? data : [],
				}));
			} catch (err) {
				logger.warn("Failed to load attachments:", err);
				setAttachmentsByRequest((prev) => ({ ...prev, [requirementId]: [] }));
			}
		},
		[token],
	);

	const uploadAttachment = useCallback(
		async (requirementId, file, type = "reference") => {
			if (!(token && requirementId && file)) {
				return;
			}
			setAttachmentFeedback("");
			setUploadingAttachmentId(requirementId);
			setAttachmentUploadProgress(0);
			try {
				await uploadFile("/documents", {
					file,
					token,
					fields: {
						entity_type: "buyer_request",
						entity_id: requirementId,
						type: type || "reference",
					},
					onProgress: setAttachmentUploadProgress,
				});
				setAttachmentFeedback("Attachment uploaded.");
				await loadAttachments(requirementId);
			} catch (err) {
				setAttachmentFeedback(err.message || "Attachment upload failed");
			} finally {
				setUploadingAttachmentId("");
				setAttachmentUploadProgress(0);
			}
		},
		[loadAttachments, token],
	);

	const removeAttachment = useCallback(
		async (documentId, requirementId) => {
			if (!(token && documentId)) {
				return;
			}
			setAttachmentFeedback("");
			try {
				await apiRequest(`/documents/${encodeURIComponent(documentId)}`, {
					method: "DELETE",
					token,
				});
				if (requirementId) {
					await loadAttachments(requirementId);
				}
				setAttachmentFeedback("Attachment removed.");
			} catch (err) {
				setAttachmentFeedback(err.message || "Failed to remove attachment.");
			}
		},
		[loadAttachments, token],
	);

	useEffect(() => {
		loadRequests();
		loadBrowse();
		loadAgents();
	}, [loadAgents, loadBrowse, loadRequests]);

	useEffect(() => {
		if (pageLoading && !loading && !secureLoading && !loadingBrowse) {
			setPageLoading(false);
		}
	}, [pageLoading, loading, secureLoading, loadingBrowse]);

	async function createRequest(statusOverride = "open") {
		if (!token) {
			return;
		}
		setSaving(true);
		setError("");
		setSuccess("");
		try {
			if (statusOverride !== "draft") {
				const validationErrors = getBuyerRequestSubmissionErrors(form);
				if (Object.keys(validationErrors).length > 0) {
					setFieldErrors(validationErrors);
					setError("Please fix the highlighted fields before posting.");
					setStep(getBuyerRequestErrorStep(validationErrors));
					return;
				}
			}
			const created = await apiRequest("/requirements", {
				method: "POST",
				token,
				body: { ...formToPayload(form), status: statusOverride },
			});
			if (created?.id && pendingAttachments.length > 0) {
				for (const attachment of pendingAttachments) {
					if (!attachment?.file) {
						continue;
					}
					await uploadAttachment(created.id, attachment.file, attachment.type || "tech_pack");
				}
			}
			setSuccess(statusOverride === "draft" ? "Draft saved." : "Buyer request posted.");
			setForm(EMPTY_FORM);
			setPendingAttachments([]);
			setFieldErrors({});
			setStep(0);
			await loadRequests();
			await loadBrowse();
		} catch (err) {
			setError(err.message || "Failed to post buyer request.");
		} finally {
			setSaving(false);
		}
	}

	async function saveDraft() {
		await createRequest("draft");
	}

	async function parseDescriptionWithAi() {
		if (!token) {
			return;
		}
		if (!form.customDescription.trim()) {
			setAiParseFeedback("Please enter request text in Custom description first.");
			return;
		}
		setAiParsing(true);
		setAiParseWarnings([]);
		setAiParseFeedback("");
		try {
			const response = await apiRequest("/ai/requirements/extract", {
				method: "POST",
				token,
				body: { text: form.customDescription },
			});
			const extracted = response?.requirements || {};
			const missing = Array.isArray(extracted.missing_fields) ? extracted.missing_fields : [];
			setAiParseWarnings(missing);

			try {
				const mapped = mapExtractedToForm(extracted);
				const sanitized = Object.entries(mapped).reduce((acc, [k, v]) => {
					if (v === undefined || v === null) {
						return acc;
					}
					if (typeof v === "string" && v.trim() === "") {
						return acc;
					}
					if (Array.isArray(v) && v.length === 0) {
						return acc;
					}
					acc[k] = v;
					return acc;
				}, {});
				setForm((prev) => ({ ...prev, ...sanitized }));
			} catch (err) {
				logger.warn("AI parse fallback used:", err);
				const timelineDays = extracted?.timeline?.normalized_days;
				const priceMin = extracted?.price?.min;
				const priceMax = extracted?.price?.max;
				const priceCurrency = extracted?.price?.currency || "USD";

				setForm((prev) => ({
					...prev,
					targetFobPrice: Number.isFinite(priceMin)
						? `${priceCurrency} ${priceMin}${Number.isFinite(priceMax) && priceMax !== priceMin ? `-${priceMax}` : ""}`
						: prev.targetFobPrice,
					targetPrice: Number.isFinite(priceMin)
						? `${priceCurrency} ${priceMin}${Number.isFinite(priceMax) && priceMax !== priceMin ? `-${priceMax}` : ""}`
						: prev.targetPrice,
					fabricComposition:
						extracted?.fabric?.composition || extracted?.fabric?.material || prev.fabricComposition,
					fiberComposition:
						extracted?.fabric?.composition || extracted?.fabric?.material || prev.fiberComposition,
					fabricWeightGsm: Number.isFinite(extracted?.fabric?.gsm)
						? String(extracted.fabric.gsm)
						: prev.fabricWeightGsm,
					complianceNotes: extracted?.compliance?.notes || prev.complianceNotes,
					leadTimeRequired: Number.isFinite(timelineDays)
						? `${timelineDays} days`
						: prev.leadTimeRequired,
				}));
			}

			const confidence = Number(response?.confidence || 0);
			setAiParseFeedback(`AI parsed your text (confidence ${Math.round(confidence * 100)}%).`);
		} catch (err) {
			setAiParseFeedback(err.message || "AI parsing failed.");
		} finally {
			setAiParsing(false);
		}
	}

	function startEditing(req) {
		setEditingId(req.id);
		setEditForm(requirementToForm(req));
		setSuccess("");
		setError("");
	}

	function duplicateRequest(req) {
		setForm(requirementToForm(req));
		setStep(1);
		setSuccess("Loaded the request into the form. Update details and post when ready.");
		setError("");
		if (typeof window !== "undefined") {
			window.scrollTo({ top: 0, behavior: "smooth" });
		}
	}

	async function saveEdit() {
		if (!(token && editingId)) {
			return;
		}
		setSaving(true);
		setError("");
		setSuccess("");
		try {
			const validationErrors = getBuyerRequestSubmissionErrors(editForm);
			if (Object.keys(validationErrors).length > 0) {
				setError("Please fix the highlighted fields before saving.");
				return;
			}
			await apiRequest(`/requirements/${encodeURIComponent(editingId)}`, {
				method: "PATCH",
				token,
				body: formToPayload(editForm),
			});
			setSuccess("Request updated.");
			setEditingId("");
			setEditForm(EMPTY_FORM);
			await loadRequests();
			await loadBrowse();
		} catch (err) {
			setError(err.message || "Failed to update request.");
		} finally {
			setSaving(false);
		}
	}

	async function deleteRequest(id) {
		if (!(token && id)) {
			return;
		}
		setSaving(true);
		setError("");
		setSuccess("");
		try {
			await apiRequest(`/requirements/${encodeURIComponent(id)}`, {
				method: "DELETE",
				token,
			});
			setSuccess("Request deleted.");
			await loadRequests();
			await loadBrowse();
		} catch (err) {
			setError(err.message || "Failed to delete request.");
		} finally {
			setSaving(false);
		}
	}

	async function loadSmartMatches(requirementId) {
		if (!(token && requirementId)) {
			return;
		}
		if (!canSmartMatch) {
			return;
		}
		setSmartMatchLoading(requirementId);
		setSmartMatchError((prev) => ({ ...prev, [requirementId]: "" }));
		try {
			const data = await apiRequest(`/requirements/${encodeURIComponent(requirementId)}/matches`, {
				token,
			});
			setSmartMatches((prev) => ({
				...prev,
				[requirementId]: Array.isArray(data?.matches) ? data.matches : [],
			}));
		} catch (err) {
			setSmartMatchError((prev) => ({
				...prev,
				[requirementId]: err.message || "Unable to load smart matches",
			}));
			setSmartMatches((prev) => ({ ...prev, [requirementId]: [] }));
		} finally {
			setSmartMatchLoading("");
		}
	}

	async function assignRequest(requirementId, agentId) {
		if (!(token && requirementId)) {
			return;
		}
		setError("");
		setSuccess("");
		try {
			await apiRequest(`/requirements/${encodeURIComponent(requirementId)}`, {
				method: "PATCH",
				token,
				body: { assigned_agent_id: agentId || "" },
			});
			setSuccess("Assignment updated.");
			await loadRequests();
		} catch (err) {
			setError(err.message || "Failed to assign request.");
		}
	}

	const myRequests = useMemo(() => {
		if (role === "buyer") {
			return requests;
		}
		return requests.filter((r) => String(r.status || "open").toLowerCase() === "open");
	}, [requests, role]);

	const previewRows = useMemo(() => {
		const rows = [
			{ label: "Request type", value: form.requestType || "garments" },
			{ label: "Title", value: form.title },
			{
				label: "Category",
				value: isTextile ? form.subCategory : form.category,
			},
			{ label: "Industry", value: form.industry },
			{ label: "Gender target", value: form.genderTarget },
			{ label: "Season", value: form.season },
			{ label: "Total quantity", value: form.totalQuantity },
			{ label: "Number of styles", value: form.numberOfStyles },
			{ label: "Material type", value: form.materialType },
			{ label: "Quantity", value: form.quantity },
			{ label: "Unit", value: form.unit },
			{
				label: "Fabric composition",
				value: form.fabricComposition || form.fiberComposition,
			},
			{ label: "Fabric weight (GSM)", value: form.fabricWeightGsm },
			{ label: "Weave/Knit", value: form.weaveOrKnit },
			{ label: "Size range", value: form.sizeRange },
			{
				label: "Color requirement",
				value: form.colorRequirement || form.color,
			},
			{ label: "Style description", value: form.styleDescription },
			{ label: "Tech pack required", value: form.techPackRequired },
			{ label: "Target FOB price", value: form.targetFobPrice },
			{ label: "Target price", value: form.targetPrice },
			{ label: "Price unit", value: form.priceUnit },
			{ label: "Incoterm", value: form.incoterms },
			{
				label: "Destination port",
				value: form.destinationPort || form.deliveryPort,
			},
			{ label: "Ex-factory date", value: form.exFactoryDate },
			{ label: "Lead time required", value: form.leadTimeRequired },
			{ label: "Sample required", value: form.sampleRequired },
			{ label: "Sample type", value: form.sampleType },
			{ label: "Payment terms", value: form.paymentTerms },
			{
				label: "Compliance certs",
				value: Array.isArray(form.complianceCerts) ? form.complianceCerts.join(", ") : "",
			},
			{
				label: "Sustainability certs",
				value: Array.isArray(form.sustainabilityCerts) ? form.sustainabilityCerts.join(", ") : "",
			},
			{ label: "Lab test required", value: form.labTestRequired },
			{ label: "Swatch first", value: form.swatchFirst },
			{
				label: "Compliance notes",
				value: form.complianceNotes || form.labCertNotes,
			},
			{ label: "Quote deadline", value: form.quoteDeadline },
			{ label: "Request expiry", value: form.expiresAt },
			{ label: "Max suppliers", value: form.maxSuppliers },
			{ label: "Preferred location", value: form.preferredFactoryLocation },
			{ label: "Factory size", value: form.factorySizePreference },
			{ label: "Export experience", value: form.exportExperiencePreference },
			{
				label: "Confidentiality",
				value: form.confidentialityToggle ? "Hide brand name" : "",
			},
			{ label: "Packaging", value: form.packagingRequirement },
			{ label: "Origin label", value: form.originLabelRequired },
			{ label: "Hang tag / barcode", value: form.hangtagBarcode },
			{ label: "Partial shipment", value: form.partialShipmentAllowed },
			{ label: "Shipment mode", value: form.shipmentMode },
			{
				label: "Messaging access",
				value: form.verifiedOnly ? "Verified request only" : "Normal",
			},
		];
		return rows.filter((row) => row.value);
	}, [form, isTextile]);

	const dark = theme === "dark";

	const shell = dark
		? "bg-[var(--theme-custom-07111f)] text-slate-100"
		: "bg-gradient-to-br from-sky-50 via-white to-cyan-50 text-slate-900";

	const panel = dark
		? "border-white/10 bg-white/5 shadow-[0_20px_80px_rgba(0,0,0,0.35)]"
		: "border-slate-200 bg-white/80 shadow-[0_20px_80px_rgba(0,106,106,0.08)] backdrop-blur";

	const soft = dark ? "text-slate-300" : "text-slate-600";

	const headerTitle = role === "buyer" ? "Post Buyer Request" : "Buyer Request Management";
	const roleSubtitle =
		role === "buyer"
			? "Create structured requests so factories and buying houses can compare requirements quickly."
			: "Lead queue for buyer requests. Use Assign to route a request to a specific agent.";

	if (pageLoading) {
		return <NeonAtom fill={true} timeout={10_000} />;
	}

	return (
		<div class={`min-h-screen ${shell}`}>
			<div class="mx-auto max-w-[1600px] px-4 py-5 sm:px-6 lg:px-8">
				<div class={`overflow-hidden rounded-[32px] border ${panel}`}>
					<div class="border-b border-white/10 bg-gradient-to-r from-sky-500/15 via-cyan-500/10 to-blue-500/10 px-4 py-4 sm:px-6">
						<div class="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
							<div class="flex items-start gap-4">
								<div class="rounded-3xl bg-gradient-to-br from-sky-500 to-cyan-400 p-4 text-white shadow-lg shadow-sky-500/20">
									<ClipboardList class="h-7 w-7" />
								</div>
								<div>
									<div class="mb-2 flex flex-wrap items-center gap-2">
										<Pill class="border-sky-400/30 bg-sky-500/15 text-sky-300">
											/buyer-requests
										</Pill>
										<Pill
											class={`border-white/10 bg-white/5 ${dark ? "text-slate-300" : "text-slate-600"}`}
										>
											Role: {role}
										</Pill>
									</div>
									<h1 class="text-2xl font-bold tracking-tight sm:text-3xl">{headerTitle}</h1>
									<p class={`mt-1 max-w-3xl text-sm sm:text-base ${soft}`}>{roleSubtitle}</p>
								</div>
							</div>

							<div class="flex flex-wrap items-center gap-2">
								<div
									class={`flex items-center gap-2 rounded-2xl border px-2 py-2 ${dark ? "border-white/10 bg-white/5" : "border-slate-200 bg-white"}`}
								>
									{roles.map((r) => (
										<span
											key={r}
											class={`rounded-xl px-3 py-2 text-sm font-medium ${role === r ? "bg-sky-500 text-white shadow-lg shadow-sky-500/20" : dark ? "text-slate-500" : "text-slate-400"}`}
										>
											{r === "buying_house"
												? "Buying House"
												: r.charAt(0).toUpperCase() + r.slice(1)}
										</span>
									))}
								</div>
								{role === "buyer" ? null : (
									<Link
										to="/owner"
										class={`inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-medium transition ${dark ? "border-white/10 bg-white/5 text-slate-200" : "border-slate-200 bg-white text-slate-700"}`}
									>
										Back to Dashboard
									</Link>
								)}
								<button
									onClick={toggleTheme}
									class={`inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-medium transition ${dark ? "border-white/10 bg-white/5 text-slate-200" : "border-slate-200 bg-white text-slate-700"}`}
								>
									{dark ? <SunMedium class="h-4 w-4" /> : <MoonStar class="h-4 w-4" />}
									{dark ? "Light" : "Dark"}
								</button>
							</div>
						</div>
					</div>

					<div class="grid gap-4 p-4 lg:grid-cols-12 lg:p-6">
						<div class={role === "buyer" ? "lg:col-span-8 xl:col-span-8" : "lg:col-span-12"}>
							<ScrollReveal as="section">
								<div class={`rounded-[28px] border p-5 ${panel}`}>
									<div class="mb-5 flex items-center justify-between gap-3">
										<div class="flex items-center gap-3">
											<div
												class={`rounded-2xl p-3 ${dark ? "bg-sky-500/15 text-sky-300" : "bg-sky-100 text-sky-700"}`}
											>
												<Sparkles class="h-5 w-5" />
											</div>
											<div>
												<h2 class="text-lg font-semibold tracking-tight">
													{role === "buyer" ? "Request Builder" : "Request Management Hub"}
												</h2>
												<p class={`text-sm ${soft}`}>
													{role === "buyer"
														? "Premium workflow UI with dense controls and polished spacing."
														: "Lead queue with agent assignment and tracking."}
												</p>
											</div>
										</div>
									</div>

									{(error || success || attachmentFeedback || aiParseFeedback) && (
										<div class="mb-5 space-y-2">
											{success ? (
												<div class="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-200">
													<CheckCircle2 class="mr-2 inline-block h-4 w-4" /> {success}
												</div>
											) : null}
											{error ? (
												<div class="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-200">
													<X class="mr-2 inline-block h-4 w-4" /> {error}
												</div>
											) : null}
											{attachmentFeedback ? (
												<div class="rounded-2xl border border-sky-500/20 bg-sky-500/10 px-4 py-3 text-sm text-sky-700 dark:text-sky-200">
													<CloudUpload class="mr-2 inline-block h-4 w-4" /> {attachmentFeedback}
												</div>
											) : null}
											{aiParseFeedback ? (
												<div class="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-700 dark:text-cyan-200">
													<Bot class="mr-2 inline-block h-4 w-4" /> {aiParseFeedback}
												</div>
											) : null}
										</div>
									)}

									{role === "buyer" ? (
										<>
											<div class="mb-5 flex flex-wrap items-center justify-between gap-3">
												<div>
													<div class="text-sm text-slate-500 dark:text-slate-400">
														Step {step + 1} of {steps.length} —{" "}
														<span class="font-medium text-slate-700 dark:text-slate-200">
															{steps[step]}
														</span>
													</div>
													<div class={`mt-1 text-sm ${soft}`}>
														Complete each step so verified suppliers can quote faster.
													</div>
												</div>
												<div class="flex items-center gap-2">
													<button
														onClick={() => setMoreFieldsOpen((v) => !v)}
														class={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-medium transition ${dark ? "border-white/10 bg-white/5 text-slate-200" : "border-slate-200 bg-white text-slate-700"}`}
													>
														<Filter class="h-4 w-4" />
														{moreFieldsOpen ? "Hide more fields" : "More fields"}
													</button>
													<button
														onClick={parseDescriptionWithAi}
														disabled={aiParsing || !form.customDescription.trim()}
														class="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-sky-500 to-cyan-400 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-sky-500/25 transition hover:-translate-y-0.5 disabled:opacity-50"
													>
														<Bot class="h-4 w-4" /> {aiParsing ? "Parsing..." : "AI parse my text"}
													</button>
												</div>
											</div>

											<div class="mb-5 grid gap-2 sm:grid-cols-6">
												{steps.map((label, i) => (
													<div
														key={label}
														class={`rounded-2xl border px-3 py-3 text-center text-xs font-semibold ${i === step ? "border-sky-400 bg-sky-500/15 text-sky-300" : dark ? "border-white/10 bg-white/5 text-slate-300" : "border-slate-200 bg-white text-slate-500"}`}
													>
														{i + 1}. {label}
													</div>
												))}
											</div>

											{aiParseWarnings.length > 0 ? (
												<div class="mb-5 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-xs text-amber-700 dark:text-amber-200">
													Missing data confidence warning: {aiParseWarnings.join(", ")}
												</div>
											) : null}

											<div class="space-y-5">
												{step === 0 ? (
													<div class="grid gap-4 md:grid-cols-2">
														<button
															type="button"
															class={`group rounded-[26px] border p-5 text-left transition hover:-translate-y-1 ${form.requestType === "garments" ? "border-sky-400 bg-sky-500/10 shadow-lg shadow-sky-500/10" : dark ? "border-white/10 bg-white/5" : "border-slate-200 bg-white"}${fieldErrors.requestType ? " ring-2 ring-rose-400" : ""}`}
															onClick={() => setForm({ ...form, requestType: "garments" })}
														>
															<div class="mb-3 flex items-center justify-between">
																<div class="rounded-2xl bg-gradient-to-br from-sky-500 to-cyan-400 p-3 text-white shadow-lg shadow-sky-500/20">
																	<Layers3 class="h-5 w-5" />
																</div>
																{form.requestType === "garments" ? (
																	<CheckCircle2 class="h-5 w-5 text-sky-400" />
																) : (
																	<ChevronRight class="h-5 w-5 text-slate-400 group-hover:text-sky-400" />
																)}
															</div>
															<div class="text-lg font-semibold">Garments Buyer</div>
															<div class={`mt-1 text-sm ${soft}`}>
																Finished garments with design + construction focus.
															</div>
														</button>
														<button
															type="button"
															class={`group rounded-[26px] border p-5 text-left transition hover:-translate-y-1 ${form.requestType === "textile" ? "border-sky-400 bg-sky-500/10 shadow-lg shadow-sky-500/10" : dark ? "border-white/10 bg-white/5" : "border-slate-200 bg-white"}${fieldErrors.requestType ? " ring-2 ring-rose-400" : ""}`}
															onClick={() => setForm({ ...form, requestType: "textile" })}
														>
															<div class="mb-3 flex items-center justify-between">
																<div class="rounded-2xl bg-gradient-to-br from-sky-500 to-cyan-400 p-3 text-white shadow-lg shadow-sky-500/20">
																	<FileText class="h-5 w-5" />
																</div>
																{form.requestType === "textile" ? (
																	<CheckCircle2 class="h-5 w-5 text-sky-400" />
																) : (
																	<ChevronRight class="h-5 w-5 text-slate-400 group-hover:text-sky-400" />
																)}
															</div>
															<div class="text-lg font-semibold">Textile Buyer</div>
															<div class={`mt-1 text-sm ${soft}`}>
																Fabric/yarn/trim requests with technical specs.
															</div>
														</button>
													</div>
												) : null}

												{step === 1 ? (
													<div class="grid gap-4 md:grid-cols-2">
														<Field
															label="Request title"
															required={true}
															hint="Example: Denim Jacket - 10k pcs"
															error={fieldErrors.title || fieldErrors.request_title}
														>
															<Input
																value={form.title}
																onChange={(e) => setForm({ ...form, title: e.target.value })}
																placeholder="Meaningful title"
															/>
														</Field>
														{isTextile ? (
															<>
																<Field
																	label="Material type"
																	required={true}
																	error={fieldErrors.materialType || fieldErrors.material_type}
																>
																	<Input
																		value={form.materialType}
																		onChange={(e) =>
																			setForm({
																				...form,
																				materialType: e.target.value,
																			})
																		}
																		placeholder="Cotton"
																	/>
																</Field>
																<Field
																	label="Sub-category"
																	required={true}
																	error={fieldErrors.subCategory || fieldErrors.sub_category}
																>
																	<select
																		value={form.subCategory}
																		onChange={(e) =>
																			setForm({
																				...form,
																				subCategory: e.target.value,
																			})
																		}
																		class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-white/10 dark:bg-slate-950"
																	>
																		<option value="">Select sub-category</option>
																		{textileCategories.map((cat) => (
																			<option key={cat} value={cat}>
																				{cat}
																			</option>
																		))}
																	</select>
																</Field>
																<Field
																	label="Quantity"
																	required={true}
																	error={
																		fieldErrors.quantity ||
																		fieldErrors.totalQuantity ||
																		fieldErrors.total_quantity
																	}
																>
																	<Input
																		value={form.quantity}
																		onChange={(e) =>
																			setForm({
																				...form,
																				quantity: e.target.value,
																			})
																		}
																		placeholder="5000"
																	/>
																</Field>
																<Field label="Unit" required={true} error={fieldErrors.unit}>
																	<Input
																		value={form.unit}
																		onChange={(e) => setForm({ ...form, unit: e.target.value })}
																		placeholder="kg"
																	/>
																</Field>
															</>
														) : (
															<>
																<Field
																	label="Product category"
																	required={true}
																	error={fieldErrors.category}
																>
																	<select
																		value={form.category}
																		onChange={(e) =>
																			setForm({
																				...form,
																				category: e.target.value,
																			})
																		}
																		class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-white/10 dark:bg-slate-950"
																	>
																		<option value="">Select category</option>
																		{garmentCategories.map((cat) => (
																			<option key={cat} value={cat}>
																				{cat}
																			</option>
																		))}
																	</select>
																</Field>
																<Field
																	label="Gender target"
																	required={true}
																	error={fieldErrors.genderTarget || fieldErrors.gender_target}
																>
																	<Select
																		value={form.genderTarget}
																		onChange={(e) =>
																			setForm({
																				...form,
																				genderTarget: e.target.value,
																			})
																		}
																	>
																		<option value="">Select gender</option>
																		<option value="Women">Women</option>
																		<option value="Men">Men</option>
																		<option value="Kids">Kids</option>
																		<option value="Unisex">Unisex</option>
																	</Select>
																</Field>
																<Field label="Season" required={true} error={fieldErrors.season}>
																	<Select
																		value={form.season}
																		onChange={(e) =>
																			setForm({
																				...form,
																				season: e.target.value,
																			})
																		}
																	>
																		<option value="">Select season</option>
																		<option value="Spring">Spring</option>
																		<option value="Summer">Summer</option>
																		<option value="Autumn">Autumn</option>
																		<option value="Winter">Winter</option>
																		<option value="All season">All season</option>
																	</Select>
																</Field>
																<Field
																	label="Total quantity (pcs)"
																	required={true}
																	error={
																		fieldErrors.totalQuantity ||
																		fieldErrors.quantity ||
																		fieldErrors.total_quantity
																	}
																>
																	<Input
																		value={form.totalQuantity}
																		onChange={(e) =>
																			setForm({
																				...form,
																				totalQuantity: e.target.value,
																			})
																		}
																		placeholder="10000"
																	/>
																</Field>
															</>
														)}

														{moreFieldsOpen ? (
															<>
																<Field label="Industry" hint="Optional">
																	<Input
																		value={form.industry}
																		onChange={(e) =>
																			setForm({
																				...form,
																				industry: e.target.value,
																			})
																		}
																		placeholder="Apparel / Textile"
																	/>
																</Field>
																{isTextile ? null : (
																	<Field label="Number of styles" hint="Optional">
																		<Input
																			value={form.numberOfStyles}
																			onChange={(e) =>
																				setForm({
																					...form,
																					numberOfStyles: e.target.value,
																				})
																			}
																			placeholder="2"
																		/>
																	</Field>
																)}
															</>
														) : null}
													</div>
												) : null}

												{step === 2 && isTextile ? (
													<div class="grid gap-4 md:grid-cols-2">
														<Field
															label="Fiber composition"
															required={true}
															error={fieldErrors.fiberComposition || fieldErrors.fiber_composition}
														>
															<Input
																value={form.fiberComposition}
																onChange={(e) =>
																	setForm({
																		...form,
																		fiberComposition: e.target.value,
																	})
																}
																placeholder="100% combed cotton"
															/>
														</Field>
														<Field
															label="Fabric weight (GSM)"
															required={true}
															error={
																fieldErrors.fabricWeightGsm ||
																fieldErrors.fabric_weight_gsm ||
																fieldErrors.fabric_weight
															}
														>
															<Input
																value={form.fabricWeightGsm}
																onChange={(e) =>
																	setForm({
																		...form,
																		fabricWeightGsm: e.target.value,
																	})
																}
																placeholder="180"
															/>
														</Field>
														<Field label="Fabric width">
															<Input
																value={form.fabricWidth}
																onChange={(e) =>
																	setForm({
																		...form,
																		fabricWidth: e.target.value,
																	})
																}
																placeholder="58 inches"
															/>
														</Field>
														<Field label="Yarn count">
															<Input
																value={form.yarnCount}
																onChange={(e) =>
																	setForm({
																		...form,
																		yarnCount: e.target.value,
																	})
																}
																placeholder="30s"
															/>
														</Field>
														<Field label="Thread count">
															<Input
																value={form.threadCount}
																onChange={(e) =>
																	setForm({
																		...form,
																		threadCount: e.target.value,
																	})
																}
																placeholder="N/A"
															/>
														</Field>
														<Field label="Finish required">
															<Input
																value={form.finishRequired}
																onChange={(e) =>
																	setForm({
																		...form,
																		finishRequired: e.target.value,
																	})
																}
																placeholder="Bio wash"
															/>
														</Field>
														<Field label="Stretch required">
															<Input
																value={form.stretchRequired}
																onChange={(e) =>
																	setForm({
																		...form,
																		stretchRequired: e.target.value,
																	})
																}
																placeholder="Low stretch"
															/>
														</Field>
														<Field label="Color">
															<Input
																value={form.color}
																onChange={(e) => setForm({ ...form, color: e.target.value })}
																placeholder="White"
															/>
														</Field>
														<Field label="Pattern">
															<Input
																value={form.pattern}
																onChange={(e) => setForm({ ...form, pattern: e.target.value })}
																placeholder="Solid"
															/>
														</Field>
													</div>
												) : null}

												{step === 2 && !isTextile ? (
													<div class="grid gap-4 md:grid-cols-2">
														<Field label="Fabric composition">
															<Input
																value={form.fabricComposition}
																onChange={(e) =>
																	setForm({
																		...form,
																		fabricComposition: e.target.value,
																	})
																}
																placeholder="98% cotton, 2% elastane"
															/>
														</Field>
														<Field label="Fabric weight (GSM)">
															<Input
																value={form.fabricWeightGsm}
																onChange={(e) =>
																	setForm({
																		...form,
																		fabricWeightGsm: e.target.value,
																	})
																}
																placeholder="320"
															/>
														</Field>
														<Field label="Weave / Knit type">
															<Input
																value={form.weaveOrKnit}
																onChange={(e) =>
																	setForm({
																		...form,
																		weaveOrKnit: e.target.value,
																	})
																}
																placeholder="Twill weave"
															/>
														</Field>
														<Field label="Size range">
															<Input
																value={form.sizeRange}
																onChange={(e) =>
																	setForm({
																		...form,
																		sizeRange: e.target.value,
																	})
																}
																placeholder="S-XL"
															/>
														</Field>
														<Field label="Color requirement">
															<Input
																value={form.colorRequirement}
																onChange={(e) =>
																	setForm({
																		...form,
																		colorRequirement: e.target.value,
																	})
																}
																placeholder="Indigo and black"
															/>
														</Field>
														<Field label="Style description">
															<TextArea
																rows={4}
																value={form.styleDescription}
																onChange={(e) =>
																	setForm({
																		...form,
																		styleDescription: e.target.value,
																	})
																}
																placeholder="Premium structured jacket..."
															/>
															<WordCount
																text={form.styleDescription}
																limit={(() => {
																	const u = getCurrentUser();
																	return String(u?.subscription_status || "").toLowerCase() ===
																		"premium"
																		? 1500
																		: 600;
																})()}
															/>
														</Field>
														<Field label="Tech pack required">
															<Input
																value={form.techPackRequired}
																onChange={(e) =>
																	setForm({
																		...form,
																		techPackRequired: e.target.value,
																	})
																}
																placeholder="Yes / No"
															/>
														</Field>
														<Field label="Tech pack upload" hint="optional">
															<div
																class={`rounded-2xl border border-dashed p-4 ${dark ? "border-white/15 bg-white/5" : "border-sky-200 bg-sky-50/70"}`}
															>
																{pendingAttachments.length > 0 ? (
																	<div class="space-y-2">
																		{pendingAttachments.map((fileRow, index) => (
																			<div
																				key={`${fileRow.file?.name}-${index}`}
																				class={`flex items-center justify-between rounded-2xl border px-3 py-2 ${dark ? "border-white/10 bg-white/5" : "border-slate-200 bg-white"}`}
																			>
																				<span class="text-xs text-slate-600 dark:text-slate-400">
																					{fileRow.file?.name || "File"}
																				</span>
																				<button
																					type="button"
																					class="text-xs font-semibold text-rose-500"
																					onClick={() =>
																						setPendingAttachments((prev) =>
																							prev.filter((_, i) => i !== index),
																						)
																					}
																				>
																					Remove
																				</button>
																			</div>
																		))}
																	</div>
																) : (
																	<p class="text-xs text-slate-500">
																		You can upload tech packs and sketches after posting too.
																	</p>
																)}
																<div class="mt-3 flex items-center gap-2">
																	<label class="inline-flex cursor-pointer items-center gap-2 rounded-2xl bg-sky-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-sky-500/20">
																		<CloudUpload class="h-4 w-4" /> Add file
																		<input
																			type="file"
																			class="hidden"
																			onChange={(event) => {
																				const file = event.target.files?.[0];
																				if (file) {
																					setPendingAttachments((prev) => [
																						...prev,
																						{ file, type: "tech_pack" },
																					]);
																				}
																				event.target.value = "";
																			}}
																		/>
																	</label>
																</div>
															</div>
														</Field>
													</div>
												) : null}

												{step === 3 ? (
													<div class="grid gap-4 md:grid-cols-2">
														{isTextile ? (
															<>
																<Field
																	label="Target price"
																	required={true}
																	error={
																		fieldErrors.targetPrice ||
																		fieldErrors.price_range ||
																		fieldErrors.target_price
																	}
																>
																	<Input
																		value={form.targetPrice}
																		onChange={(e) =>
																			setForm({
																				...form,
																				targetPrice: e.target.value,
																			})
																		}
																		placeholder="2.15"
																	/>
																</Field>
																<Field
																	label="Price unit"
																	required={true}
																	error={fieldErrors.priceUnit || fieldErrors.price_unit}
																>
																	<Input
																		value={form.priceUnit}
																		onChange={(e) =>
																			setForm({
																				...form,
																				priceUnit: e.target.value,
																			})
																		}
																		placeholder="/ kg"
																	/>
																</Field>
																<Field
																	label="Incoterm"
																	required={true}
																	error={fieldErrors.incoterms || fieldErrors.incoterm}
																>
																	<Select
																		value={form.incoterms}
																		onChange={(e) =>
																			setForm({
																				...form,
																				incoterms: e.target.value,
																			})
																		}
																	>
																		<option value="">Select incoterm</option>
																		<option value="FOB">FOB</option>
																		<option value="CIF">CIF</option>
																		<option value="EXW">EXW</option>
																	</Select>
																</Field>
																<Field
																	label="Delivery port"
																	required={true}
																	error={fieldErrors.deliveryPort || fieldErrors.delivery_port}
																>
																	<Input
																		value={form.deliveryPort}
																		onChange={(e) =>
																			setForm({
																				...form,
																				deliveryPort: e.target.value,
																			})
																		}
																		placeholder="Chittagong"
																	/>
																</Field>
																<Field
																	label="Lead time required"
																	required={true}
																	error={
																		fieldErrors.leadTimeRequired || fieldErrors.lead_time_required
																	}
																>
																	<Input
																		value={form.leadTimeRequired}
																		onChange={(e) =>
																			setForm({
																				...form,
																				leadTimeRequired: e.target.value,
																			})
																		}
																		placeholder="30 days"
																	/>
																</Field>
																<Field label="Lab test required">
																	<Input
																		value={form.labTestRequired}
																		onChange={(e) =>
																			setForm({
																				...form,
																				labTestRequired: e.target.value,
																			})
																		}
																		placeholder="Yes / No"
																	/>
																</Field>
																<Field label="Swatch/sample first?">
																	<Input
																		value={form.swatchFirst}
																		onChange={(e) =>
																			setForm({
																				...form,
																				swatchFirst: e.target.value,
																			})
																		}
																		placeholder="Yes / No"
																	/>
																</Field>
															</>
														) : (
															<>
																<Field
																	label="Target FOB price"
																	required={true}
																	error={
																		fieldErrors.targetFobPrice ||
																		fieldErrors.price_range ||
																		fieldErrors.target_fob_price
																	}
																>
																	<Input
																		value={form.targetFobPrice}
																		onChange={(e) =>
																			setForm({
																				...form,
																				targetFobPrice: e.target.value,
																			})
																		}
																		placeholder="8.40"
																	/>
																</Field>
																<Field
																	label="Incoterm"
																	required={true}
																	error={fieldErrors.incoterms || fieldErrors.incoterm}
																>
																	<Select
																		value={form.incoterms}
																		onChange={(e) =>
																			setForm({
																				...form,
																				incoterms: e.target.value,
																			})
																		}
																	>
																		<option value="">Select incoterm</option>
																		<option value="FOB">FOB</option>
																		<option value="CIF">CIF</option>
																		<option value="EXW">EXW</option>
																	</Select>
																</Field>
																<Field label="Destination port">
																	<Input
																		value={form.destinationPort}
																		onChange={(e) =>
																			setForm({
																				...form,
																				destinationPort: e.target.value,
																			})
																		}
																		placeholder="Chittagong"
																	/>
																</Field>
																<Field
																	label="Ex-factory date"
																	required={true}
																	error={fieldErrors.exFactoryDate || fieldErrors.ex_factory_date}
																>
																	<Input
																		type="date"
																		value={form.exFactoryDate}
																		onChange={(e) =>
																			setForm({
																				...form,
																				exFactoryDate: e.target.value,
																			})
																		}
																	/>
																</Field>
																<Field label="Sample required">
																	<Input
																		value={form.sampleRequired}
																		onChange={(e) =>
																			setForm({
																				...form,
																				sampleRequired: e.target.value,
																			})
																		}
																		placeholder="Yes / No"
																	/>
																</Field>
																<Field label="Sample type">
																	<Input
																		value={form.sampleType}
																		onChange={(e) =>
																			setForm({
																				...form,
																				sampleType: e.target.value,
																			})
																		}
																		placeholder="Proto sample"
																	/>
																</Field>
																<Field
																	label="Payment terms"
																	required={true}
																	error={fieldErrors.paymentTerms || fieldErrors.payment_terms}
																>
																	<Input
																		value={form.paymentTerms}
																		onChange={(e) =>
																			setForm({
																				...form,
																				paymentTerms: e.target.value,
																			})
																		}
																		placeholder="30% advance, 70% against B/L"
																	/>
																</Field>
															</>
														)}

														{moreFieldsOpen ? (
															<>
																<Field label="Quote deadline" hint="Optional">
																	<Input
																		type="date"
																		value={form.quoteDeadline}
																		onChange={(e) =>
																			setForm({
																				...form,
																				quoteDeadline: e.target.value,
																			})
																		}
																	/>
																</Field>
																<Field label="Request expiry" hint="Optional">
																	<Input
																		type="date"
																		value={form.expiresAt}
																		onChange={(e) =>
																			setForm({
																				...form,
																				expiresAt: e.target.value,
																			})
																		}
																	/>
																</Field>
																<Field label="Max suppliers to contact" hint="Optional">
																	<Input
																		value={form.maxSuppliers}
																		onChange={(e) =>
																			setForm({
																				...form,
																				maxSuppliers: e.target.value,
																			})
																		}
																		placeholder="8"
																	/>
																</Field>
																<Field
																	label="Messaging access"
																	hint="Normal: verified goes to inbox, unverified goes to requests. Verified request only: only verified suppliers can message."
																>
																	<div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
																		<button
																			type="button"
																			onClick={() =>
																				setForm({
																					...form,
																					verifiedOnly: false,
																				})
																			}
																			class={`rounded-2xl border p-4 text-left text-sm transition ${form.verifiedOnly ? (dark ? "border-white/10 bg-white/5" : "border-slate-200 bg-white") : "border-sky-400 bg-sky-500/10"}`}
																		>
																			<div class="font-semibold">Normal</div>
																			<div class={`mt-1 text-xs ${soft}`}>
																				verified goes to inbox, unverified goes to requests
																			</div>
																		</button>
																		<button
																			type="button"
																			onClick={() => setForm({ ...form, verifiedOnly: true })}
																			class={`rounded-2xl border p-4 text-left text-sm transition ${form.verifiedOnly ? "border-sky-400 bg-sky-500/10" : dark ? "border-white/10 bg-white/5" : "border-slate-200 bg-white"}`}
																		>
																			<div class="font-semibold">Verified request only</div>
																			<div class={`mt-1 text-xs ${soft}`}>
																				only verified suppliers can message
																			</div>
																		</button>
																	</div>
																</Field>
															</>
														) : null}
													</div>
												) : null}

												{step === 4 ? (
													<div class="grid gap-4 xl:grid-cols-2">
														<div class={`rounded-[26px] border p-5 ${panel}`}>
															<h3 class="mb-4 text-base font-semibold">Compliance / Lab</h3>
															{isTextile ? (
																<Field label="Lab/Certification notes">
																	<TextArea
																		rows={4}
																		value={form.labCertNotes}
																		onChange={(e) =>
																			setForm({
																				...form,
																				labCertNotes: e.target.value,
																			})
																		}
																		placeholder="Testing requirements..."
																	/>
																</Field>
															) : (
																<>
																	<Field label="Compliance certifications">
																		<div class="grid grid-cols-2 gap-3">
																			{GARMENT_COMPLIANCE_CERTS.map((cert) => (
																				<label
																					key={cert}
																					class={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm ${dark ? "border-white/10 bg-white/5" : "border-slate-200 bg-white"}`}
																				>
																					<input
																						type="checkbox"
																						checked={form.complianceCerts.includes(cert)}
																						onChange={(e) => {
																							const next = e.target.checked
																								? [...form.complianceCerts, cert]
																								: form.complianceCerts.filter((c) => c !== cert);
																							setForm({
																								...form,
																								complianceCerts: next,
																							});
																						}}
																						class="h-4 w-4 accent-sky-500"
																					/>
																					<span>{cert}</span>
																				</label>
																			))}
																		</div>
																	</Field>
																	<Field label="Sustainability certifications">
																		<div class="grid grid-cols-2 gap-3">
																			{GARMENT_SUSTAIN_CERTS.map((cert) => (
																				<label
																					key={cert}
																					class={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm ${dark ? "border-white/10 bg-white/5" : "border-slate-200 bg-white"}`}
																				>
																					<input
																						type="checkbox"
																						checked={form.sustainabilityCerts.includes(cert)}
																						onChange={(e) => {
																							const next = e.target.checked
																								? [...form.sustainabilityCerts, cert]
																								: form.sustainabilityCerts.filter(
																										(c) => c !== cert,
																									);
																							setForm({
																								...form,
																								sustainabilityCerts: next,
																							});
																						}}
																						class="h-4 w-4 accent-sky-500"
																					/>
																					<span>{cert}</span>
																				</label>
																			))}
																		</div>
																	</Field>
																	<Field label="Compliance notes">
																		<TextArea
																			rows={4}
																			value={form.complianceNotes}
																			onChange={(e) =>
																				setForm({
																					...form,
																					complianceNotes: e.target.value,
																				})
																			}
																			placeholder="Traceability, audit readiness..."
																		/>
																	</Field>
																</>
															)}

															<div class="mt-4 grid gap-4 md:grid-cols-2">
																<Field label="Preferred factory location">
																	<Input
																		value={form.preferredFactoryLocation}
																		onChange={(e) =>
																			setForm({
																				...form,
																				preferredFactoryLocation: e.target.value,
																			})
																		}
																		placeholder="Gazipur / Chittagong / Any"
																	/>
																</Field>
																<Field label="Factory size preference">
																	<Input
																		value={form.factorySizePreference}
																		onChange={(e) =>
																			setForm({
																				...form,
																				factorySizePreference: e.target.value,
																			})
																		}
																		placeholder="Small / Medium / Large"
																	/>
																</Field>
																<Field label="Export experience preference">
																	<Input
																		value={form.exportExperiencePreference}
																		onChange={(e) =>
																			setForm({
																				...form,
																				exportExperiencePreference: e.target.value,
																			})
																		}
																		placeholder="EU required / US required / Any"
																	/>
																</Field>
																<Field label="Confidentiality">
																	<label
																		class={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm ${dark ? "border-white/10 bg-white/5" : "border-slate-200 bg-white"}`}
																	>
																		<input
																			type="checkbox"
																			checked={form.confidentialityToggle}
																			onChange={(e) =>
																				setForm({
																					...form,
																					confidentialityToggle: e.target.checked,
																				})
																			}
																			class="h-4 w-4 accent-sky-500"
																		/>
																		Hide brand name (only verified suppliers can see it)
																	</label>
																</Field>
															</div>
														</div>

														<div class="space-y-4">
															<div class={`rounded-[26px] border p-5 ${panel}`}>
																<h3 class="mb-4 text-base font-semibold">Packaging & Shipment</h3>
																<div class="grid gap-4">
																	<Field label="Packaging requirement">
																		<Input
																			value={form.packagingRequirement}
																			onChange={(e) =>
																				setForm({
																					...form,
																					packagingRequirement: e.target.value,
																				})
																			}
																			placeholder="Poly bag / Hanger / Flat pack"
																		/>
																	</Field>
																	<Field label="Origin label requirement">
																		<Input
																			value={form.originLabelRequired}
																			onChange={(e) =>
																				setForm({
																					...form,
																					originLabelRequired: e.target.value,
																				})
																			}
																			placeholder="Made in Bangladesh required?"
																		/>
																	</Field>
																	<Field label="Hang tag / Barcode">
																		<Input
																			value={form.hangtagBarcode}
																			onChange={(e) =>
																				setForm({
																					...form,
																					hangtagBarcode: e.target.value,
																				})
																			}
																			placeholder="Buyer-supplied / Factory to arrange"
																		/>
																	</Field>
																	<Field label="Partial shipment allowed">
																		<Input
																			value={form.partialShipmentAllowed}
																			onChange={(e) =>
																				setForm({
																					...form,
																					partialShipmentAllowed: e.target.value,
																				})
																			}
																			placeholder="Yes / No"
																		/>
																	</Field>
																	<Field label="Shipment mode">
																		<Input
																			value={form.shipmentMode}
																			onChange={(e) =>
																				setForm({
																					...form,
																					shipmentMode: e.target.value,
																				})
																			}
																			placeholder="Sea / Air / Both"
																		/>
																	</Field>
																</div>
															</div>

															<div class={`rounded-[26px] border p-5 ${panel}`}>
																<div class="mb-3 flex items-center justify-between">
																	<h3 class="text-base font-semibold">Custom fields</h3>
																	<button
																		type="button"
																		onClick={addCustomField}
																		class="inline-flex items-center gap-2 rounded-xl bg-sky-500 px-3 py-2 text-xs font-semibold text-white"
																	>
																		<Plus class="h-3.5 w-3.5" /> Add custom field
																	</button>
																</div>
																<div class="space-y-3">
																	{(Array.isArray(form.customFields) ? form.customFields : []).map(
																		(row, index) => (
																			<div
																				key={`custom-${index}`}
																				class="grid gap-2 md:grid-cols-[1fr_1fr_auto]"
																			>
																				<Input
																					placeholder="Label"
																					value={row.label}
																					onChange={(e) =>
																						updateCustomField(index, "label", e.target.value)
																					}
																				/>
																				<Input
																					placeholder="Value"
																					value={row.value}
																					onChange={(e) =>
																						updateCustomField(index, "value", e.target.value)
																					}
																				/>
																				<button
																					type="button"
																					onClick={() => removeCustomField(index)}
																					class="rounded-2xl border px-3 py-2 text-sm text-rose-500"
																				>
																					Remove
																				</button>
																			</div>
																		),
																	)}
																</div>
																<div class="mt-4">
																	<Field
																		label="Custom description"
																		hint="Use this for extra notes, design details, or negotiation context."
																	>
																		<TextArea
																			rows={5}
																			value={form.customDescription}
																			onChange={(e) =>
																				setForm({
																					...form,
																					customDescription: e.target.value,
																				})
																			}
																			placeholder="Use this for extra notes..."
																		/>
																		<WordCount
																			text={form.customDescription}
																			limit={(() => {
																				const u = getCurrentUser();
																				return String(
																					u?.subscription_status || "",
																				).toLowerCase() === "premium"
																					? 1500
																					: 600;
																			})()}
																		/>
																	</Field>
																</div>
															</div>
														</div>
													</div>
												) : null}

												{step === 5 ? (
													<div>
														<div class="mb-4 flex items-center justify-between">
															<div>
																<h3 class="text-xl font-semibold">Preview summary</h3>
																<p class={`text-sm ${soft}`}>Review all fields before posting.</p>
															</div>
															<Pill class="bg-sky-500/15 text-sky-300">
																{previewRows.length} visible fields
															</Pill>
														</div>
														{previewRows.length === 0 ? (
															<div
																class={`rounded-[24px] border p-6 text-sm ${dark ? "border-white/10 bg-white/5" : "border-slate-200 bg-white"}`}
															>
																No fields filled yet.
															</div>
														) : (
															<div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
																{previewRows.map((row) => (
																	<div
																		key={row.label}
																		class={`rounded-[22px] border p-4 ${dark ? "border-white/10 bg-white/5" : "border-slate-200 bg-white"}`}
																	>
																		<div class="text-xs uppercase tracking-wider text-slate-400">
																			{row.label}
																		</div>
																		<div class="mt-1 text-sm font-medium break-words">
																			{row.value}
																		</div>
																	</div>
																))}
															</div>
														)}
													</div>
												) : null}
											</div>

											<div class="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-5">
												<div class="flex gap-2">
													<button
														type="button"
														onClick={handleBack}
														disabled={isFirstStep}
														class={`inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-medium transition ${isFirstStep ? "cursor-not-allowed opacity-40" : dark ? "border-white/10 bg-white/5" : "border-slate-200 bg-white"}`}
													>
														<ArrowLeft class="h-4 w-4" /> Back
													</button>
													<button
														type="button"
														disabled={saving}
														onClick={saveDraft}
														class="inline-flex items-center gap-2 rounded-2xl border border-sky-400/20 bg-sky-500/10 px-4 py-3 text-sm font-semibold text-sky-700 transition hover:bg-sky-500/15 disabled:opacity-70 dark:text-sky-200"
													>
														<CloudUpload class="h-4 w-4" />{" "}
														{saving ? (
															<ThreeDot
																variant="bounce"
																color="#337ab0"
																size="small"
																text=""
																textColor=""
															/>
														) : (
															"Save Draft"
														)}
													</button>
												</div>
												<div class="flex gap-2">
													{isLastStep ? (
														<button
															type="button"
															disabled={saving}
															onClick={() => createRequest()}
															class="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-sky-500 to-cyan-400 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-500/25 transition hover:-translate-y-0.5 disabled:opacity-70"
														>
															{saving ? (
																<ThreeDot
																	variant="bounce"
																	color="#337ab0"
																	size="small"
																	text=""
																	textColor=""
																/>
															) : (
																"Post Request"
															)}{" "}
															<Sparkles class="h-4 w-4" />
														</button>
													) : (
														<button
															type="button"
															disabled={saving}
															onClick={handleNext}
															class="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-sky-500 to-cyan-400 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-500/25 transition hover:-translate-y-0.5 disabled:opacity-50"
														>
															Next <ArrowRight class="h-4 w-4" />
														</button>
													)}
												</div>
											</div>
										</>
									) : (
										<div class="space-y-6">
											<div class="flex flex-wrap items-center gap-2">
												<Pill class="bg-sky-500/15 text-sky-300">Open Buyer Requests</Pill>
												<Pill class="bg-cyan-500/15 text-cyan-300">Assign to agents</Pill>
												<Pill class={`bg-white/5 ${dark ? "text-slate-300" : "text-slate-600"}`}>
													Manual refresh only
												</Pill>
											</div>

											<div class={`rounded-[26px] border p-5 ${panel}`}>
												<div class="mb-4 flex items-center justify-between gap-3">
													<div>
														<h3 class="text-lg font-semibold">Lead queue</h3>
														<p class={`text-sm ${soft}`}>
															Use Assign to route a request to a specific agent.
														</p>
													</div>
													<button
														type="button"
														onClick={loadRequests}
														class="inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-medium transition dark:border-white/10 dark:bg-white/5"
													>
														<RefreshCw class="h-4 w-4" /> Refresh
													</button>
												</div>

												{myRequests.length > 0 ? (
													<div class="overflow-x-auto rounded-[22px] border border-white/10">
														<table class="min-w-full divide-y divide-white/10 text-left text-sm">
															<thead class="bg-white/5 text-slate-300">
																<tr>
																	<th class="px-4 py-3 font-medium">Title</th>
																	<th class="px-4 py-3 font-medium">Status</th>
																	<th class="px-4 py-3 font-medium">Qty</th>
																	<th class="px-4 py-3 font-medium">Target</th>
																	<th class="px-4 py-3 font-medium">Delivery</th>
																	<th class="px-4 py-3 font-medium">Assign</th>
																</tr>
															</thead>
															<tbody class="divide-y divide-white/10">
																{myRequests.map((r) => (
																	<tr key={r.id} class="hover:bg-white/5">
																		<td class="px-4 py-4">
																			<div class="font-medium">
																				{r.title || r.category || "Buyer Request"}
																			</div>
																			<div class="mt-1 text-xs text-slate-400">
																				Buyer: {String(r.buyer_id || "").slice(0, 8)}
																				...
																				{r.ai_summary ? ` - ${r.ai_summary}` : ""}
																			</div>
																		</td>
																		<td class="px-4 py-4">
																			<span class={`${badge} ${requestStatusBadge(r.status)}`}>
																				{formatRequestStatus(r.status)}
																			</span>
																		</td>
																		<td class="px-4 py-4">{r.quantity || "--"}</td>
																		<td class="px-4 py-4">{r.target_market || "--"}</td>
																		<td class="px-4 py-4">
																			{r.delivery_timeline || r.timeline_days || "--"}
																		</td>
																		<td class="px-4 py-4">
																			<Select
																				value={r.assigned_agent_id || ""}
																				onChange={(e) => assignRequest(r.id, e.target.value)}
																			>
																				<option value="">Unassigned</option>
																				{agents.map((a) => (
																					<option key={a.id} value={a.id}>
																						{a.name} ({a.member_id})
																					</option>
																				))}
																			</Select>
																		</td>
																	</tr>
																))}
															</tbody>
														</table>
													</div>
												) : (
													<div class={`text-sm ${soft}`}>No open requests.</div>
												)}
											</div>
										</div>
									)}
								</div>
							</ScrollReveal>
						</div>

						{role === "buyer" ? (
							<div class="space-y-4 lg:col-span-4 xl:col-span-4">
								<div class={`rounded-[28px] border p-5 ${panel}`}>
									<div class="mb-4 flex items-center justify-between">
										<div>
											<h3 class="font-semibold">Premium feature</h3>
											<p class={`text-xs ${soft}`}>Smart supplier matching</p>
										</div>
										<Star class="h-5 w-5 text-sky-400" />
									</div>
									{canSmartMatch ? null : (
										<>
											<div class="rounded-2xl border border-sky-400/20 bg-sky-500/10 p-4 text-sm text-slate-700 dark:text-slate-200">
												Smart supplier matching is a Premium feature.
											</div>
											<Link
												to="/pricing"
												class="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-sky-500 to-cyan-400 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-500/20"
											>
												<Zap class="h-4 w-4" /> Upgrade to unlock
											</Link>
										</>
									)}
									{canSmartMatch ? (
										<div class="mt-4 rounded-2xl border border-white/10 p-4">
											<div class="mb-3 flex items-center justify-between">
												<span class="text-sm font-medium">Smart match</span>
												<Pill class="bg-white/5 text-slate-300">
													GET /api/requirements/{"{id}"}/matches
												</Pill>
											</div>
										</div>
									) : null}
								</div>
							</div>
						) : null}

						{role === "buyer" ? (
							<ScrollReveal as="section">
								<div class="grid gap-4 border-t border-white/10 p-4 lg:grid-cols-12 lg:p-6">
									<div class="lg:col-span-7">
										<div class={`rounded-[28px] border p-5 ${panel}`}>
											<div class="mb-4 flex items-center justify-between gap-3">
												<div>
													<h3 class="text-lg font-semibold">My Requests</h3>
													<p class={`text-sm ${soft}`}>
														Duplicate, smart match, edit, delete, and manage attachments.
													</p>
												</div>
												<button
													type="button"
													onClick={loadRequests}
													class="inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-medium dark:border-white/10 dark:bg-white/5"
												>
													<RefreshCw class="h-4 w-4" /> Refresh
												</button>
											</div>

											{myRequests.length > 0 ? (
												<div class="grid gap-4">
													<AnimatePresence>
														{myRequests.map((r) => {
															const attachments = attachmentsByRequest[r.id] || [];
															const selectedType = attachmentTypeByRequest[r.id] || "tech_pack";
															return (
																<motion.div
																	key={r.id}
																	layout={true}
																	initial={{ opacity: 0, y: 12 }}
																	animate={{ opacity: 1, y: 0 }}
																	exit={{ opacity: 0, scale: 0.95 }}
																	transition={{
																		duration: 0.25,
																		ease: [0.16, 1, 0.3, 1],
																	}}
																	class={`rounded-[24px] border p-5 ${dark ? "border-white/10 bg-white/5" : "border-slate-200 bg-white"}`}
																>
																	{editingId === r.id ? (
																		<div class="space-y-3">
																			<Field label="Title">
																				<Input
																					value={editForm.title}
																					onChange={(e) =>
																						setEditForm({
																							...editForm,
																							title: e.target.value,
																						})
																					}
																				/>
																			</Field>
																			<Field label="Category">
																				<Input
																					value={editForm.category}
																					onChange={(e) =>
																						setEditForm({
																							...editForm,
																							category: e.target.value,
																						})
																					}
																				/>
																			</Field>
																			<Field label="Quantity">
																				<Input
																					value={editForm.quantity}
																					onChange={(e) =>
																						setEditForm({
																							...editForm,
																							quantity: e.target.value,
																						})
																					}
																				/>
																			</Field>
																			<Field label="Custom description">
																				<TextArea
																					rows={4}
																					value={editForm.customDescription}
																					onChange={(e) =>
																						setEditForm({
																							...editForm,
																							customDescription: e.target.value,
																						})
																					}
																				/>
																				<WordCount
																					text={editForm.customDescription}
																					limit={(() => {
																						const u = getCurrentUser();
																						return String(
																							u?.subscription_status || "",
																						).toLowerCase() === "premium"
																							? 1500
																							: 600;
																					})()}
																				/>
																			</Field>
																			<Field
																				label="Messaging access"
																				hint="Normal: verified goes to inbox, unverified goes to requests. Verified request only: only verified suppliers can message."
																			>
																				<div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
																					<button
																						type="button"
																						onClick={() =>
																							setEditForm({
																								...editForm,
																								verifiedOnly: false,
																							})
																						}
																						class={`rounded-2xl border p-4 text-left text-sm transition ${editForm.verifiedOnly ? (dark ? "border-white/10 bg-white/5" : "border-slate-200 bg-white") : "border-sky-400 bg-sky-500/10"}`}
																					>
																						<div class="font-semibold">Normal</div>
																					</button>
																					<button
																						type="button"
																						onClick={() =>
																							setEditForm({
																								...editForm,
																								verifiedOnly: true,
																							})
																						}
																						class={`rounded-2xl border p-4 text-left text-sm transition ${editForm.verifiedOnly ? "border-sky-400 bg-sky-500/10" : dark ? "border-white/10 bg-white/5" : "border-slate-200 bg-white"}`}
																					>
																						<div class="font-semibold">Verified request only</div>
																					</button>
																				</div>
																			</Field>
																			<div class="flex gap-2">
																				<button
																					type="button"
																					disabled={saving}
																					onClick={saveEdit}
																					class="rounded-2xl bg-sky-500 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-70"
																				>
																					Save
																				</button>
																				<button
																					type="button"
																					onClick={() => setEditingId("")}
																					class="rounded-2xl border px-4 py-2.5 text-sm font-medium dark:border-white/10 dark:bg-white/5"
																				>
																					Cancel
																				</button>
																			</div>
																		</div>
																	) : (
																		<div class="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
																			<div>
																				<div class="flex flex-wrap items-center gap-2">
																					<h4 class="text-base font-semibold">
																						{r.title || r.category || "Buyer Request"}
																					</h4>
																					<span class={`${badge} ${requestStatusBadge(r.status)}`}>
																						{formatRequestStatus(r.status)}
																					</span>
																				</div>
																				<div class={`mt-2 text-sm ${soft}`}>
																					Qty {r.quantity || "--"} - {r.material || "--"} - Target{" "}
																					{r.target_market || "--"} - Delivery{" "}
																					{r.delivery_timeline || r.timeline_days || "--"}
																				</div>
																				<div class="mt-3 flex flex-wrap gap-2">
																					<button
																						type="button"
																						onClick={() => duplicateRequest(r)}
																						class="inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs font-medium dark:border-white/10 dark:bg-white/5"
																					>
																						<ClipboardList class="h-3.5 w-3.5" /> Duplicate
																					</button>
																					<button
																						type="button"
																						disabled={!canSmartMatch}
																						onClick={() => loadSmartMatches(r.id)}
																						class="inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs font-medium dark:border-white/10 dark:bg-white/5 disabled:opacity-60"
																					>
																						<Sparkles class="h-3.5 w-3.5" />{" "}
																						{smartMatchLoading === r.id ? (
																							<ThreeDot
																								variant="bounce"
																								color="#337ab0"
																								size="small"
																								text=""
																								textColor=""
																							/>
																						) : (
																							"Smart match"
																						)}
																					</button>
																					<button
																						type="button"
																						onClick={() => startEditing(r)}
																						class="inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs font-medium dark:border-white/10 dark:bg-white/5"
																					>
																						<Edit3 class="h-3.5 w-3.5" /> Edit
																					</button>
																					<button
																						type="button"
																						onClick={() => deleteRequest(r.id)}
																						class="inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs font-medium text-rose-500 dark:border-white/10 dark:bg-white/5"
																					>
																						<Trash2 class="h-3.5 w-3.5" /> Delete
																					</button>
																				</div>
																			</div>

																			<div
																				class={`rounded-2xl border border-white/10 bg-sky-500/10 px-4 py-3 text-sm ${dark ? "text-sky-300" : "text-sky-700"}`}
																			>
																				<div class="font-medium">Attachments</div>
																				<div
																					class={`mt-1 text-xs ${dark ? "text-sky-200/80" : "text-sky-600/80"}`}
																				>
																					Tech pack, sketch, reference image, compliance, other
																				</div>
																			</div>
																		</div>
																	)}

																	{canSmartMatch ? null : (
																		<div class="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-200">
																			Smart supplier matching is a Premium feature.
																			<div class="mt-2">
																				<Link
																					to="/pricing"
																					class="text-xs font-semibold text-sky-400 hover:underline"
																				>
																					Upgrade to unlock
																				</Link>
																			</div>
																		</div>
																	)}

																	{smartMatchError[r.id] ? (
																		<p class="mt-2 text-xs text-rose-500">
																			{smartMatchError[r.id]}
																		</p>
																	) : null}

																	{canSmartMatch &&
																	(smartMatches[r.id]?.length > 0 || smartMatchLoading === r.id) ? (
																		<div
																			class={`mt-4 rounded-[22px] border p-4 ${dark ? "border-white/10 bg-white/5" : "border-slate-200 bg-white"}`}
																		>
																			<p class="text-xs font-semibold">Smart matches</p>
																			<div class="mt-2 space-y-2">
																				{(smartMatches[r.id] || []).slice(0, 3).map((match) => (
																					<div
																						key={match.id || match.supplier_id}
																						class={`flex items-center justify-between rounded-2xl border px-3 py-2 text-xs ${dark ? "border-white/10 bg-white/5" : "border-slate-200 bg-white"}`}
																					>
																						<span class="truncate">
																							{match.name ||
																								match.supplier_name ||
																								match.supplier_id}
																						</span>
																						<Pill class="bg-emerald-500/15 text-emerald-300">
																							{match.score || match.match_score || "--"}
																						</Pill>
																					</div>
																				))}
																				{smartMatches[r.id]?.length === 0 &&
																				smartMatchLoading === r.id ? (
																					<div class={`text-xs ${soft}`}>Finding matches...</div>
																				) : null}
																			</div>
																		</div>
																	) : null}

																	{editingId === r.id ? null : (
																		<div class="mt-4">
																			<div
																				class={`rounded-[22px] border p-4 ${dark ? "border-white/10 bg-white/5" : "border-slate-200 bg-white"}`}
																			>
																				<div class="flex items-center justify-between">
																					<p class="text-xs font-semibold">Attachments</p>
																					<button
																						type="button"
																						onClick={() => loadAttachments(r.id)}
																						class="text-xs font-semibold text-sky-400"
																					>
																						Refresh
																					</button>
																				</div>
																				<div class="mt-2 space-y-2">
																					{attachments.length > 0 ? (
																						attachments.map((doc) => (
																							<div
																								key={doc.id}
																								class={`flex items-center justify-between gap-2 rounded-2xl border px-3 py-2 ${dark ? "border-white/10 bg-white/5" : "border-slate-200 bg-white"}`}
																							>
																								<a
																									class="text-xs font-semibold truncate"
																									href={toPublicFileUrl(doc.file_path)}
																									target="_blank"
																									rel="noreferrer"
																								>
																									{doc.type || "Attachment"}:{" "}
																									{doc.file_path
																										? String(doc.file_path).split(/[\\/]/).pop()
																										: "File"}
																								</a>
																								<button
																									type="button"
																									onClick={() => removeAttachment(doc.id, r.id)}
																									class="text-xs font-semibold text-rose-500"
																								>
																									Remove
																								</button>
																							</div>
																						))
																					) : (
																						<div class="text-xs text-slate-500">
																							No attachments uploaded yet.
																						</div>
																					)}
																				</div>

																				<div class="mt-3 flex flex-wrap items-center gap-2">
																					<Select
																						value={selectedType}
																						onChange={(e) =>
																							setAttachmentTypeByRequest((prev) => ({
																								...prev,
																								[r.id]: e.target.value,
																							}))
																						}
																					>
																						<option value="tech_pack">Tech pack</option>
																						<option value="sketch">Sketch</option>
																						<option value="reference_image">Reference image</option>
																						<option value="compliance">Compliance</option>
																						<option value="other">Other</option>
																					</Select>
																					<label class="inline-flex cursor-pointer items-center gap-2 rounded-2xl bg-sky-500 px-4 py-2.5 text-sm font-semibold text-white">
																						{uploadingAttachmentId === r.id ? (
																							<ThreeDot
																								variant="bounce"
																								color="#337ab0"
																								size="small"
																								text=""
																								textColor=""
																							/>
																						) : (
																							"Upload file"
																						)}
																						<input
																							type="file"
																							class="hidden"
																							onChange={(event) => {
																								const file = event.target.files?.[0];
																								if (file) {
																									uploadAttachment(r.id, file, selectedType);
																								}
																								event.target.value = "";
																							}}
																						/>
																					</label>
																					{uploadingAttachmentId === r.id && (
																						<UploadProgressBar
																							progress={attachmentUploadProgress}
																							class="w-24"
																						/>
																					)}
																				</div>
																			</div>
																		</div>
																	)}
																</motion.div>
															);
														})}
													</AnimatePresence>
												</div>
											) : (
												<div class={`text-sm ${soft}`}>No requests yet.</div>
											)}
										</div>
									</div>

									<div class="space-y-4 lg:col-span-5">
										<div class={`rounded-[28px] border p-5 ${panel}`}>
											<div class="mb-4 flex items-center justify-between">
												<div>
													<h3 class="text-lg font-semibold">Browse Requests (Summary Only)</h3>
													<p class={`text-sm ${soft}`}>
														You can research market demand, but full details remain private.
													</p>
												</div>
												<button
													type="button"
													onClick={loadBrowse}
													class="inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-medium dark:border-white/10 dark:bg-white/5"
												>
													<RefreshCw class="h-4 w-4" />{" "}
													{loadingBrowse ? (
														<ThreeDot
															variant="bounce"
															color="#337ab0"
															size="small"
															text=""
															textColor=""
														/>
													) : (
														"Refresh"
													)}
												</button>
											</div>

											{browse.length > 0 ? (
												<div class="space-y-3">
													{browse
														.filter((r) => r.buyer_id !== user?.id)
														.slice(0, 12)
														.map((r) => (
															<div
																key={r.id}
																class={`rounded-[22px] border p-4 ${dark ? "border-white/10 bg-white/5" : "border-slate-200 bg-white"}`}
															>
																<div class="flex items-center justify-between gap-3">
																	<div class="font-medium">
																		{r.title || r.category || "Buyer Request"}
																	</div>
																	<Pill
																		class={`bg-white/5 ${dark ? "text-slate-300" : "text-slate-600"}`}
																	>
																		{String(r.buyer_id || "").slice(0, 8)}
																	</Pill>
																</div>
																<div class={`mt-2 text-sm ${soft}`}>
																	Qty {r.quantity || "--"} - {r.material || "--"} - Target{" "}
																	{r.target_market || "--"} - Delivery {r.delivery_timeline || "--"}
																</div>
																<Link
																	to={`/buyer/${encodeURIComponent(r.buyer_id)}`}
																	class="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-sky-400 hover:text-sky-300"
																>
																	View Buyer Profile <ChevronRight class="h-4 w-4" />
																</Link>
															</div>
														))}
												</div>
											) : (
												<div class={`text-sm ${soft}`}>No requests to browse yet.</div>
											)}
										</div>
									</div>
								</div>
							</ScrollReveal>
						) : null}
					</div>
				</div>
			</div>
		</div>
	);
}
