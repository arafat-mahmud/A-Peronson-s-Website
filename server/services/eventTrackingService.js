import { sanitizeString } from "../utils/validators.js";
import { ingestEvent } from "./eventIngestionService.js";

function inferActorType(actorId = "") {
	const raw = String(actorId || "");
	if (!raw) {
		return "unknown";
	}
	if (raw.startsWith("anon:")) {
		return "anonymous";
	}
	return "user";
}

export async function trackEventWithTaxonomy({
	type,
	actor_id,
	entity_id,
	metadata = {},
	sourceModule = "backend",
	actorType = "",
	orgOwnerId = "",
	entityType = "",
	sessionId = "server",
	idempotencyKey = "",
	allowUnknownTypes = false,
} = {}) {
	const safeEntityId = sanitizeString(String(entity_id || metadata?.entity_id || ""), 180);
	const safeEntityType = sanitizeString(String(entityType || metadata?.entity_type || ""), 80);

	return ingestEvent(
		{
			type,
			actor_id,
			entity_id: safeEntityId || (safeEntityType ? `type:${safeEntityType}` : "unknown"),
			metadata,
			idempotency_key: idempotencyKey,
			context: {
				actorType: sanitizeString(
					String(actorType || metadata?.actor_type || inferActorType(actor_id)),
					60,
				),
				orgOwnerId: sanitizeString(
					String(orgOwnerId || metadata?.org_owner_id || actor_id || "unknown"),
					120,
				),
				entityType: safeEntityType || "unknown",
				entityId: safeEntityId || "unknown",
				sourceModule: sanitizeString(
					String(sourceModule || metadata?.source_module || "backend"),
					80,
				),
				sessionId: sanitizeString(String(sessionId || metadata?.session_id || "server"), 180),
			},
		},
		{
			sourceModule,
			allowUnknownTypes,
		},
	);
}

export const trackEvent = trackEventWithTaxonomy;
