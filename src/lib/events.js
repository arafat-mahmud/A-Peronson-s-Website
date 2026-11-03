import { apiRequest, getToken } from "./auth.js";

const CLIENT_ID_KEY = "gt_client_id";
const SESSION_ID_KEY = "gt_session_id";

const CANONICAL_EVENTS = new Set([
	"boost_cancelled",
	"boost_purchase",
	"call_end",
	"call_start",
	"call_warning_shown",
	"click",
	"contract_archived",
	"contract_buyer_signed",
	"contract_call_warning",
	"contract_created",
	"contract_factory_signed",
	"contract_locked",
	"contract_signed",
	"feed_item_viewed",
	"industry_auto_reply",
	"industry_page_view",
	"lead_converted",
	"lead_created",
	"lead_reminder_due",
	"lead_source_attached",
	"message_sent",
	"new_profile_boost_impressions",
	"page_duration",
	"page_view",
	"payment_proof_created",
	"payment_proof_status_updated",
	"payment_proof_submitted",
	"product_created",
	"product_deleted",
	"product_image_registered",
	"product_image_removed",
	"product_image_uploaded",
	"product_image_url_added",
	"product_media_updated",
	"product_published",
	"product_unpublished",
	"product_updated",
	"product_video_updated",
	"product_video_uploaded",
	"product_viewed",
	"profile_view",
	"search_filters_changed",
	"search_run",
	"session_end",
	"session_start",
]);

function randomId() {
	// Prefer crypto UUID when available; fall back to a simple random string.
	try {
		if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
			return crypto.randomUUID();
		}
	} catch {
		// ignore
	}
	return `cid_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

function normalizeEventType(type) {
	return String(type || "")
		.trim()
		.toLowerCase()
		.replace(/\s+/g, "_");
}

/**
 * Retrieves or creates a persistent client ID stored in localStorage.
 * @returns {string} The client ID.
 */
export function getClientId() {
	try {
		const existing = localStorage.getItem(CLIENT_ID_KEY);
		if (existing) {
			return existing;
		}
		const created = randomId();
		localStorage.setItem(CLIENT_ID_KEY, created);
		return created;
	} catch {
		// localStorage may be blocked; fall back to an ephemeral id.
		return randomId();
	}
}

/**
 * Retrieves or creates a session ID stored in sessionStorage.
 * @returns {string} The session ID.
 */
export function getSessionId() {
	try {
		const existing = sessionStorage.getItem(SESSION_ID_KEY);
		if (existing) {
			return existing;
		}
		const created = randomId();
		sessionStorage.setItem(SESSION_ID_KEY, created);
		return created;
	} catch {
		return randomId();
	}
}

/**
 * Tracks a client-side event by POSTing to the events API.
 * Silently fails to never break the UI.
 * @param {string} type - The event type name.
 * @param {Object} [options] - Event options.
 * @param {string} [options.entityType=''] - The entity type.
 * @param {string} [options.entityId=''] - The entity ID.
 * @param {Object} [options.metadata={}] - Additional metadata.
 * @returns {Promise<void>}
 */
export async function trackClientEvent(
	type,
	{ entityType = "", entityId = "", metadata = {} } = {},
) {
	// Best-effort event logging: failures should never break UI flows.
	try {
		const canonicalType = normalizeEventType(type);
		if (!CANONICAL_EVENTS.has(canonicalType)) {
			return;
		}

		const sessionId = getSessionId();
		const normalizedEntityType =
			String(entityType || metadata?.entity_type || "unknown")
				.trim()
				.toLowerCase() || "unknown";
		const normalizedEntityId =
			String(entityId || metadata?.entity_id || "unknown").trim() || "unknown";

		await apiRequest("/events", {
			method: "POST",
			token: getToken(),
			body: {
				type: canonicalType,
				entity_type: normalizedEntityType,
				entity_id: normalizedEntityId,
				client_id: getClientId(),
				metadata: {
					...metadata,
					session_id: sessionId,
					actor_type: getToken() ? "user" : "anonymous",
					source_module: "web_client",
					entity_type: normalizedEntityType,
					entity_id: normalizedEntityId,
				},
			},
		});
	} catch {
		// silent
	}
}
