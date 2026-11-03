import crypto from "node:crypto";
import { readLocalJson, updateLocalJson } from "../utils/localStore.js";
import { sanitizeString } from "../utils/validators.js";

const FILE = "subscription_history.json";

function nowIso() {
	return new Date().toISOString();
}

export async function listSubscriptionHistory({ userId } = {}) {
	const rows = await readLocalJson(FILE, []);
	const filtered = userId ? rows.filter((row) => String(row.user_id) === String(userId)) : rows;
	return filtered.sort((a, b) =>
		String(b.created_at || "").localeCompare(String(a.created_at || "")),
	);
}

export async function recordSubscriptionEvent({
	userId,
	plan,
	previousPlan,
	action,
	actorId,
	source = "system",
	note = "",
}) {
	const entry = {
		id: crypto.randomUUID(),
		user_id: sanitizeString(String(userId || ""), 120),
		plan: sanitizeString(String(plan || ""), 40),
		previous_plan: sanitizeString(String(previousPlan || ""), 40),
		action: sanitizeString(String(action || ""), 80),
		actor_id: sanitizeString(String(actorId || ""), 120),
		source: sanitizeString(String(source || ""), 80),
		note: sanitizeString(String(note || ""), 240),
		created_at: nowIso(),
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
