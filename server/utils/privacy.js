const PHONE_REGEX =
	/(?<!\d)(?:(?:phone|tel|whatsapp)\s*:\s*)?\+?(?=(?:[().\s.-]*\d){7,15}(?![().\s.-]*\d))[().-]*\d(?:[().\s.-]*\d){6,14}(?:\s*(?:ext(?:\.)?|extension)\s*\d{1,5})?/gi;

export function redactPhoneNumbers(text) {
	if (typeof text !== "string") {
		return text;
	}
	return text.replace(PHONE_REGEX, "[REDACTED]");
}

export function redactPhoneFromDocument(doc) {
	if (typeof doc === "string") {
		return redactPhoneNumbers(doc);
	}
	if (Array.isArray(doc)) {
		return doc.map(redactPhoneFromDocument);
	}
	if (doc !== null && typeof doc === "object") {
		const result = {};
		for (const key of Object.keys(doc)) {
			result[key] = redactPhoneFromDocument(doc[key]);
		}
		return result;
	}
	return doc;
}

export function getPublicDocuments(docs, viewerId, ownerId) {
	if (viewerId === ownerId) {
		return docs;
	}
	return redactPhoneFromDocument(docs);
}

export function redactPhoneFromProfile(profile) {
	if (!profile || typeof profile !== "object") {
		return profile;
	}
	const result = { ...profile };
	const PHONE_FIELDS = new Set(["account_manager_phone", "phone", "business_phone"]);
	for (const key of Object.keys(result)) {
		if (
			(PHONE_FIELDS.has(key) || key.endsWith("phone") || key.endsWith("phone_number")) &&
			typeof result[key] === "string"
		) {
			result[key] = redactPhoneNumbers(result[key]);
		}
	}
	return result;
}
