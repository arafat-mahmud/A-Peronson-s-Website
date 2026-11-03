import crypto from "node:crypto";
import { readLocalJson, updateLocalJson } from "../utils/localStore.js";

const KEY = "agent_sub_ids.json";

export async function listAgentSubIds(actor) {
	const all = await readLocalJson(KEY, []);
	if (!actor) {
		return [];
	}
	if (actor?.role === "admin" || actor?.role === "owner") {
		return Array.isArray(all) ? all : [];
	}
	return (Array.isArray(all) ? all : []).filter((s) => String(s.owner_id) === String(actor.id));
}

export async function createAgentSubId(ownerId, { label = "", metadata = {} } = {}) {
	const row = {
		id: crypto.randomUUID(),
		owner_id: String(ownerId || ""),
		label: String(label || "").slice(0, 160),
		metadata: metadata || {},
		created_at: new Date().toISOString(),
	};
	await updateLocalJson(
		KEY,
		(existing = []) => {
			const arr = Array.isArray(existing) ? existing.slice() : [];
			arr.push(row);
			return arr;
		},
		[],
	);
	return row;
}

export async function getAgentSubIdById(id) {
	const all = await readLocalJson(KEY, []);
	if (!Array.isArray(all)) {
		return null;
	}
	return all.find((r) => String(r.id) === String(id)) || null;
}

export async function deleteAgentSubId(id, actor) {
	const all = await readLocalJson(KEY, []);
	if (!Array.isArray(all)) {
		return false;
	}
	const idx = all.findIndex((r) => String(r.id) === String(id));
	if (idx < 0) {
		return false;
	}
	const existing = all[idx];
	if (
		String(existing.owner_id) !== String(actor?.id) &&
		actor?.role !== "admin" &&
		actor?.role !== "owner"
	) {
		throw new Error("forbidden");
	}
	const next = all.filter((r) => String(r.id) !== String(id));
	await updateLocalJson(KEY, () => next, []);
	return true;
}

export default {
	listAgentSubIds,
	createAgentSubId,
	getAgentSubIdById,
	deleteAgentSubId,
};
