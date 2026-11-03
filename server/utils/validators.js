const ROLES = ["buyer", "factory", "buying_house", "admin", "agent", "owner"];
const PUBLIC_ROLES = ["buyer", "factory", "buying_house", "agent"];

export function validateEmail(email) {
	return typeof email === "string" && /.+@.+\..+/.test(email);
}

export function validateRole(role) {
	return ROLES.includes(role);
}

export function validatePublicRole(role) {
	return PUBLIC_ROLES.includes(role);
}

export function escapeHtml(str) {
	if (typeof str !== "string") {
		return "";
	}
	const htmlEntities = {
		"&": "&amp;",
		"<": "&lt;",
		">": "&gt;",
		'"': "&quot;",
		"'": "&#39;",
	};
	return str.replace(/[&<>"']/g, (char) => htmlEntities[char] || char);
}

export function unescapeHtml(str) {
	if (typeof str !== "string") {
		return "";
	}
	return str
		.replace(/&#39;/g, "'")
		.replace(/&quot;/g, '"')
		.replace(/&gt;/g, ">")
		.replace(/&lt;/g, "<")
		.replace(/&amp;/g, "&");
}

export function sanitizeString(input, max = 500) {
	if (typeof input !== "string") {
		return "";
	}
	const escaped = escapeHtml(input);
	return escaped
		.trim()
		.replace(/[\r\n]+/g, " ")
		.replace(/\s+/g, " ")
		.slice(0, max);
}

export function sanitizeForHtml(input, max = 1000) {
	return sanitizeString(input, max);
}

export function requireFields(payload, fields) {
	const missing = fields.filter(
		(f) => payload[f] === undefined || payload[f] === null || payload[f] === "",
	);
	return missing;
}

export function isPositiveNumberLike(value) {
	const n = Number(value);
	return Number.isFinite(n) && n > 0;
}

export function limitWordCount(text, maxWords) {
	if (typeof text !== "string") {
		return "";
	}
	const trimmed = text.trim();
	if (!trimmed) {
		return "";
	}
	const words = trimmed.split(/\s+/);
	if (words.length <= maxWords) {
		return trimmed;
	}
	return words.slice(0, maxWords).join(" ");
}
