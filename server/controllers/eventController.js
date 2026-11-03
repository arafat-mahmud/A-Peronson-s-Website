import { ingestEvent } from "../services/eventIngestionService.js";
import { extractClientIp, locateIp } from "../services/geoService.js";
import { sanitizeString } from "../utils/validators.js";

function sanitizeMetadata(meta) {
	if (!meta || typeof meta !== "object") {
		return {};
	}
	const out = {};

	for (const [key, value] of Object.entries(meta)) {
		const safeKey = sanitizeString(String(key || ""), 60);
		if (!safeKey) {
			continue;
		}

		if (typeof value === "string") {
			out[safeKey] = sanitizeString(value, 240);
		} else if (typeof value === "number" && Number.isFinite(value)) {
			out[safeKey] = value;
		} else if (typeof value === "boolean") {
			out[safeKey] = value;
		} else if (Array.isArray(value)) {
			const cleaned = value
				.filter((item) => typeof item === "string")
				.map((item) => sanitizeString(item, 120))
				.map((item) => String(item || "").trim())
				.filter(Boolean)
				.slice(0, 25);
			if (cleaned.length > 0) {
				out[safeKey] = cleaned;
			}
		}
	}

	return out;
}

function buildActorId(req, clientId) {
	// Track authenticated users by user id; anonymous visitors by a stable client id (localStorage).
	if (req.user?.id) {
		return String(req.user.id);
	}

	const safeClientId = sanitizeString(String(clientId || ""), 120);
	if (safeClientId) {
		return `anon:${safeClientId}`;
	}
	return "anon";
}

function countryFromHeaders(req) {
	const candidates = [
		req.headers["cf-ipcountry"],
		req.headers["x-vercel-ip-country"],
		req.headers["x-geo-country"],
		req.headers["x-appengine-country"],
		req.headers["x-country"],
		req.headers["x-forwarded-country"],
	];
	const raw = candidates.find(
		(value) => value && String(value).trim() && String(value).toLowerCase() !== "unknown",
	);
	if (!raw) {
		return "";
	}
	const cleaned = sanitizeString(String(raw), 60).trim();
	if (!cleaned || cleaned === "XX") {
		return "";
	}
	return cleaned;
}

export async function postEvent(req, res) {
	const type = sanitizeString(String(req.body?.type || ""), 60).toLowerCase();
	if (!type) {
		return res.status(400).json({ error: "type is required" });
	}

	const entityType = sanitizeString(
		String(req.body?.entity_type || req.body?.entityType || ""),
		80,
	);
	const entityId = sanitizeString(String(req.body?.entity_id || req.body?.entityId || ""), 160);
	const clientId = sanitizeString(String(req.body?.client_id || req.body?.clientId || ""), 120);
	const metadata = sanitizeMetadata(req.body?.metadata);
	let country = sanitizeString(
		String(req.body?.country || metadata.country || countryFromHeaders(req) || ""),
		60,
	);

	let geo = null;
	if (!country) {
		const ip = extractClientIp(req);
		geo = await locateIp(ip);
		if (geo?.country) {
			country = sanitizeString(geo.country, 60);
		}
	}

	const enrichedMeta = {
		...metadata,
		...(entityType ? { entity_type: entityType } : {}),
		...(clientId ? { client_id: clientId } : {}),
		...(country ? { country } : {}),
		...(geo?.city ? { city: sanitizeString(geo.city, 80) } : {}),
		...(geo?.lat ? { lat: geo.lat } : {}),
		...(geo?.lng ? { lng: geo.lng } : {}),
		// Keep these short to avoid logging sensitive data.
		user_agent: sanitizeString(String(req.headers["user-agent"] || ""), 180),
	};

	const allowUnknownTypes =
		String(process.env.EVENTS_ALLOW_UNKNOWN_TYPES || "").toLowerCase() === "true";
	const result = await ingestEvent(
		{
			type,
			actor_id: buildActorId(req, clientId),
			entity_id: entityId || (entityType ? `type:${entityType}` : ""),
			metadata: enrichedMeta,
			context: {
				actorType: req.user?.id ? "user" : "anonymous",
				orgOwnerId:
					sanitizeString(String(req.user?.org_owner_id || req.user?.id || ""), 120) || "unknown",
				entityType: entityType || "unknown",
				entityId: entityId || "unknown",
				sourceModule: "web_client",
				sessionId: sanitizeString(String(metadata.session_id || ""), 180) || "unknown",
			},
		},
		{ allowUnknownTypes, sourceModule: "event_controller" },
	);

	if (!result.accepted) {
		if (result.reason === "unknown_event_type") {
			return res.status(400).json({ error: "Unknown event type" });
		}
		if (result.reason === "duplicate_event") {
			return res.status(202).json({ ok: true, deduped: true });
		}
		return res.status(400).json({ error: "Event validation failed", reason: result.reason });
	}

	return res.status(201).json({ ok: true, schema_version: result.schema_version });
}
