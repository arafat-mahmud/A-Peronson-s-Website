export function mapExtractedToForm(extracted = {}) {
	if (!extracted || typeof extracted !== "object") {
		return {};
	}

	const priceMin = Number.isFinite(Number(extracted?.price?.min))
		? Number(extracted.price.min)
		: null;
	const priceMax = Number.isFinite(Number(extracted?.price?.max))
		? Number(extracted.price.max)
		: null;
	const priceCurrency = extracted?.price?.currency || extracted?.price?.currency_code || "USD";
	const priceStr =
		priceMin === null
			? ""
			: `${priceCurrency} ${priceMin}${priceMax !== null && priceMax !== priceMin ? `-${priceMax}` : ""}`;

	const timelineDays =
		extracted?.timeline?.normalized_days ??
		(Number.isFinite(Number(extracted?.timeline)) ? Number(extracted.timeline) : null);
	const leadTime = Number.isFinite(Number(timelineDays))
		? `${timelineDays} days`
		: extracted?.timeline || "";

	const fabricGsm = Number.isFinite(Number(extracted?.fabric?.gsm))
		? String(extracted.fabric.gsm)
		: "";
	const moq = extracted?.moq !== undefined && extracted?.moq !== null ? String(extracted.moq) : "";

	return {
		// legacy/compat keys expected by tests and older callers
		product_type: extracted.product_type || "",
		category: extracted.category || extracted.sub_category || "",
		moq,
		target_price:
			extracted?.target_price !== undefined && extracted?.target_price !== null
				? String(extracted.target_price)
				: priceMin === null
					? ""
					: String(priceMin),
		timeline: extracted?.timeline || "",
		incoterm: extracted?.incoterm || extracted?.incoterms || "",
		certifications: Array.isArray(extracted.certifications) ? extracted.certifications : [],
		notes: extracted?.notes || extracted?.description || "",
		// map to the client form keys where possible
		requestType:
			typeof extracted.product_type === "string" && /textile/i.test(extracted.product_type)
				? "textile"
				: "",
		title: extracted.title || "",
		// keep client-facing category key too (already set above)
		subCategory: extracted.sub_category || "",
		materialType: extracted.material_type || extracted.material || "",
		totalQuantity:
			extracted.quantity !== undefined && extracted.quantity !== null
				? String(extracted.quantity)
				: "",
		quantity:
			extracted.quantity !== undefined && extracted.quantity !== null
				? String(extracted.quantity)
				: moq,
		unit: extracted.unit || "",
		targetFobPrice: priceStr,
		targetPrice: priceStr,
		fabricComposition: extracted?.fabric?.composition || extracted?.material || "",
		fiberComposition: extracted?.fabric?.composition || extracted?.material || "",
		fabricWeightGsm: fabricGsm,
		leadTimeRequired: leadTime,
		incoterms: extracted.incoterm || extracted.incoterms || "",
		complianceNotes: extracted?.compliance?.notes || extracted?.notes || "",
		complianceCerts: Array.isArray(extracted.certifications)
			? extracted.certifications
			: Array.isArray(extracted?.compliance?.certs)
				? extracted.compliance.certs
				: [],
		sustainabilityCerts: Array.isArray(extracted.sustainability) ? extracted.sustainability : [],
		customDescription: extracted?.notes || extracted?.description || "",
	};
}

export default { mapExtractedToForm };
