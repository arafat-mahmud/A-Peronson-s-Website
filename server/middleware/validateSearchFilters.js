import fs from "node:fs";
import path from "node:path";

const SCHEMA_PATH = path.join(process.cwd(), "server", "schemas", "searchFilters.schema.json");

function parseNumber(value) {
	if (value === undefined || value === null || value === "") {
		return null;
	}
	const n = Number(String(value).trim());
	return Number.isFinite(n) ? n : null;
}

function parseBoolean(value) {
	if (typeof value === "boolean") {
		return value;
	}
	const s = String(value || "").toLowerCase();
	if (s === "true") {
		return true;
	}
	if (s === "false") {
		return false;
	}
	return null;
}

function parseArrayish(value) {
	if (Array.isArray(value)) {
		return value;
	}
	if (typeof value === "string" && value.includes(",")) {
		return value
			.split(",")
			.map((v) => v.trim())
			.filter(Boolean);
	}
	if (typeof value === "string" && value.trim()) {
		return [value.trim()];
	}
	return [];
}

function coerceQueryToTypes(query) {
	const raw = { ...(query || {}) };
	const coerced = {};

	for (const [k, v] of Object.entries(raw)) {
		if (
			k === "verifiedOnly" ||
			k === "sampleAvailable" ||
			k === "handlesMultipleFactories" ||
			k === "hasPermissionMatrix" ||
			k === "permissionSectionEdit"
		) {
			const b = parseBoolean(v);
			if (b === null) {
				coerced[k] = v;
			} else {
				coerced[k] = b;
			}
			continue;
		}
		if (
			[
				"gsmMin",
				"gsmMax",
				"capacityMin",
				"yearsInBusinessMin",
				"responseTimeMax",
				"teamSeatsMin",
				"distanceKm",
				"locationLat",
				"locationLng",
				"leadTimeMax",
				"sampleLeadTime",
				"auditScoreMin",
			].includes(k)
		) {
			const n = parseNumber(v);
			coerced[k] = n === null ? v : n;
			continue;
		}
		if (
			[
				"category",
				"fabricType",
				"colorPantone",
				"customization",
				"certifications",
				"incoterms",
				"paymentTerms",
				"documentReady",
				"languageSupport",
				"processes",
				"exportPort",
			].includes(k)
		) {
			coerced[k] = parseArrayish(v);
			continue;
		}
		// default: leave as string
		coerced[k] = v;
	}

	return coerced;
}

export function validateFiltersMiddleware(req, res, next) {
	let schema = null;
	try {
		const data = fs.readFileSync(SCHEMA_PATH, "utf8");
		schema = JSON.parse(data);
	} catch {
		return next();
	}

	const coerced = coerceQueryToTypes(req.query || {});

	const errors = [];
	const props = schema.properties || {};
	for (const [key, rule] of Object.entries(props)) {
		if (!(key in coerced)) {
			continue;
		}
		const val = coerced[key];
		const types = Array.isArray(rule.type) ? rule.type : [rule.type];
		let ok = false;
		for (const t of types) {
			if (
				t === "string" &&
				(typeof val === "string" || (Array.isArray(val) && val.every((x) => typeof x === "string")))
			) {
				ok = true;
				break;
			}
			if (t === "number" && typeof val === "number") {
				ok = true;
				break;
			}
			if (t === "boolean" && typeof val === "boolean") {
				ok = true;
				break;
			}
			if (t === "array" && Array.isArray(val)) {
				ok = true;
				break;
			}
		}
		if (!ok) {
			errors.push({
				key,
				expected: rule.type,
				received: Array.isArray(val) ? "array" : typeof val,
			});
		}
	}

	if (errors.length > 0) {
		return res.status(400).json({ error: "Invalid search filter types", details: errors });
	}

	// Attach parsed/coerced filters for downstream handlers.
	req.parsedFilters = coerced;
	return next();
}

export default validateFiltersMiddleware;
