import crypto from "node:crypto";
import { updateLocalJson } from "../utils/localStore.js";
import { sanitizeString } from "../utils/validators.js";

const FILE = "refund_log.json";

export async function recordRefund({ userId, amountUsd, reason = "", ref = "", actorId = "" }) {
	const entry = {
		id: crypto.randomUUID(),
		user_id: sanitizeString(String(userId || ""), 120),
		amount_usd: Number(amountUsd || 0),
		reason: sanitizeString(String(reason || ""), 120),
		ref: sanitizeString(String(ref || ""), 200),
		actor_id: sanitizeString(String(actorId || ""), 120),
		created_at: new Date().toISOString(),
	};

	await updateLocalJson(
		FILE,
		(rows) => {
			const next = Array.isArray(rows) ? rows : [];
			next.push(entry);
			return next;
		},
		[],
	);

	return entry;
}
