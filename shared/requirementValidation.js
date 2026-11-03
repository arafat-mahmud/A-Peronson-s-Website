const PLACEHOLDER_TITLE_PATTERNS = [
	/^abc$/i,
	/^abcd$/i,
	/^demo$/i,
	/^test$/i,
	/^sample$/i,
	/^title$/i,
	/^item$/i,
	/^placeholder$/i,
	/^lorem$/i,
	/^asdf+$/i,
	/^qwer+$/i,
	/^zxcv+$/i,
	/^dummy$/i,
];

const ENGLISH_NUMBER_WORDS =
	/\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|billion|dozen|pair|pairs|piece|pieces|single|double)\b/i;

function normalizeText(value) {
	return String(value ?? "")
		.replace(/\s+/g, " ")
		.trim();
}

function compactText(value) {
	return normalizeText(value)
		.toLowerCase()
		.replace(/[^a-z0-9\u0980-\u09ff]+/g, "");
}

function resolveRequestType(payload = {}) {
	const raw = normalizeText(payload.requestType ?? payload.request_type ?? "");
	if (raw.toLowerCase() === "textile") {
		return "textile";
	}
	return "garments";
}

function firstPresentField(payload = {}, keys = []) {
	for (const key of keys) {
		const value = normalizeText(payload?.[key]);
		if (value) {
			return { key, value };
		}
	}
	return { key: keys[0] || "", value: "" };
}

export function isMeaningfulRequestTitle(value) {
	const text = normalizeText(value);
	if (!text) {
		return false;
	}
	const compact = compactText(text);
	if (compact.length < 3) {
		return false;
	}
	if (!/[a-z\u0980-\u09ff]/i.test(text)) {
		return false;
	}
	if (PLACEHOLDER_TITLE_PATTERNS.some((pattern) => pattern.test(compact))) {
		return false;
	}
	if (/^(.)\1+$/.test(compact)) {
		return false;
	}
	return true;
}

export function isMeaningfulRequestQuantity(value) {
	const text = normalizeText(value);
	if (!text) {
		return false;
	}
	if (/\d/.test(text) || /[০-৯]/.test(text)) {
		return true;
	}
	if (ENGLISH_NUMBER_WORDS.test(text)) {
		return true;
	}
	if (/[\u0980-\u09ff]/.test(text)) {
		return true;
	}
	return false;
}

export function getBuyerRequestStepErrors(payload = {}, step = 0) {
	const requestTypeLabel = normalizeText(payload.requestType ?? payload.request_type ?? "");
	if (!requestTypeLabel) {
		return { requestType: "Select a request type to continue." };
	}

	const requestType = resolveRequestType(payload);
	const errors = {};

	if (step === 0) {
		return errors;
	}

	if (step === 1) {
		const title = firstPresentField(payload, ["title", "request_title"]);
		if (!title.value) {
			errors[title.key] = "Title is required.";
		} else if (!isMeaningfulRequestTitle(title.value)) {
			errors[title.key] = 'Use a real product title, like "Denim jacket".';
		}

		if (requestType === "textile") {
			const materialType = firstPresentField(payload, ["materialType", "material_type"]);
			if (!materialType.value) {
				errors[materialType.key] = "Material type is required.";
			}

			const subCategory = firstPresentField(payload, ["subCategory", "sub_category"]);
			if (!subCategory.value) {
				errors[subCategory.key] = "Sub-category is required.";
			}

			const quantity = firstPresentField(payload, ["quantity", "totalQuantity", "total_quantity"]);
			if (!quantity.value) {
				errors[quantity.key] = "Quantity is required.";
			} else if (!isMeaningfulRequestQuantity(quantity.value)) {
				errors[quantity.key] = "Enter a real quantity, such as 100, one hundred, or 100 pcs.";
			}

			const unit = firstPresentField(payload, ["unit"]);
			if (!unit.value) {
				errors[unit.key] = "Unit is required.";
			}
		} else {
			const category = firstPresentField(payload, ["category"]);
			if (!category.value) {
				errors[category.key] = "Category is required.";
			}

			const genderTarget = firstPresentField(payload, ["genderTarget", "gender_target"]);
			if (!genderTarget.value) {
				errors[genderTarget.key] = "Gender target is required.";
			}

			const season = firstPresentField(payload, ["season"]);
			if (!season.value) {
				errors[season.key] = "Season is required.";
			}

			const quantity = firstPresentField(payload, ["totalQuantity", "quantity", "total_quantity"]);
			if (!quantity.value) {
				errors[quantity.key] = "Total quantity is required.";
			} else if (!isMeaningfulRequestQuantity(quantity.value)) {
				errors[quantity.key] = "Enter a real quantity, such as 100, one hundred, or 100 pcs.";
			}
		}

		return errors;
	}

	if (step === 2) {
		if (requestType === "textile") {
			const fiberComposition = firstPresentField(payload, [
				"fiberComposition",
				"fiber_composition",
			]);
			if (!fiberComposition.value) {
				errors[fiberComposition.key] = "Fiber composition is required.";
			}

			const fabricWeight = firstPresentField(payload, [
				"fabricWeightGsm",
				"fabric_weight_gsm",
				"fabric_weight",
			]);
			if (!fabricWeight.value) {
				errors[fabricWeight.key] = "Fabric weight (GSM) is required.";
			}
		}
		return errors;
	}

	if (step === 3) {
		if (requestType === "textile") {
			const targetPrice = firstPresentField(payload, [
				"targetPrice",
				"price_range",
				"target_price",
			]);
			if (!targetPrice.value) {
				errors[targetPrice.key] = "Target price is required.";
			}

			const priceUnit = firstPresentField(payload, ["priceUnit", "price_unit"]);
			if (!priceUnit.value) {
				errors[priceUnit.key] = "Price unit is required.";
			}

			const incoterms = firstPresentField(payload, ["incoterms", "incoterm"]);
			if (!incoterms.value) {
				errors[incoterms.key] = "Incoterm is required.";
			}

			const deliveryPort = firstPresentField(payload, ["deliveryPort", "delivery_port"]);
			if (!deliveryPort.value) {
				errors[deliveryPort.key] = "Delivery port is required.";
			}

			const leadTimeRequired = firstPresentField(payload, [
				"leadTimeRequired",
				"lead_time_required",
			]);
			if (!leadTimeRequired.value) {
				errors[leadTimeRequired.key] = "Lead time is required.";
			}
		} else {
			const targetFobPrice = firstPresentField(payload, [
				"targetFobPrice",
				"price_range",
				"target_fob_price",
			]);
			if (!targetFobPrice.value) {
				errors[targetFobPrice.key] = "Target FOB price is required.";
			}

			const incoterms = firstPresentField(payload, ["incoterms", "incoterm"]);
			if (!incoterms.value) {
				errors[incoterms.key] = "Incoterm is required.";
			}

			const exFactoryDate = firstPresentField(payload, ["exFactoryDate", "ex_factory_date"]);
			if (!exFactoryDate.value) {
				errors[exFactoryDate.key] = "Ex-factory date is required.";
			}

			const paymentTerms = firstPresentField(payload, ["paymentTerms", "payment_terms"]);
			if (!paymentTerms.value) {
				errors[paymentTerms.key] = "Payment terms are required.";
			}
		}
		return errors;
	}

	return errors;
}

export function getBuyerRequestSubmissionErrors(payload = {}) {
	return {
		...getBuyerRequestStepErrors(payload, 1),
		...getBuyerRequestStepErrors(payload, 2),
		...getBuyerRequestStepErrors(payload, 3),
	};
}

export function getBuyerRequestErrorStep(errors = {}) {
	const step1Keys = new Set([
		"requestType",
		"title",
		"request_title",
		"category",
		"genderTarget",
		"gender_target",
		"season",
		"totalQuantity",
		"quantity",
		"total_quantity",
		"materialType",
		"material_type",
		"subCategory",
		"sub_category",
		"unit",
	]);
	const step2Keys = new Set([
		"fiberComposition",
		"fiber_composition",
		"fabricWeightGsm",
		"fabric_weight_gsm",
		"fabric_weight",
	]);
	const step3Keys = new Set([
		"targetFobPrice",
		"price_range",
		"target_price",
		"targetPrice",
		"priceUnit",
		"price_unit",
		"incoterms",
		"incoterm",
		"exFactoryDate",
		"ex_factory_date",
		"paymentTerms",
		"payment_terms",
		"deliveryPort",
		"delivery_port",
		"leadTimeRequired",
		"lead_time_required",
	]);

	if (Object.keys(errors).some((key) => step1Keys.has(key))) {
		return 1;
	}
	if (Object.keys(errors).some((key) => step2Keys.has(key))) {
		return 2;
	}
	if (Object.keys(errors).some((key) => step3Keys.has(key))) {
		return 3;
	}
	return 0;
}
