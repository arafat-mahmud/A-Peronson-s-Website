import crypto from "node:crypto";
import { readLocalJson, updateLocalJson } from "../utils/localStore.js";
import { forbiddenError } from "../utils/permissions.js";
import { sanitizeString } from "../utils/validators.js";

const KEY = "search_presets.json";

export async function listPresets(actor) {
	const all = await readLocalJson(KEY, []);
	if (!actor) {
		return [];
	}
	// Admins see all
	if (actor?.role === "admin" || actor?.role === "owner") {
		return Array.isArray(all) ? all : [];
	}
	// Otherwise return owned + shared
	return (Array.isArray(all) ? all : []).filter(
		(p) => String(p.owner_id) === String(actor.id) || p.shared === true,
	);
}

export async function createPreset(ownerId, payload = {}) {
	const now = new Date().toISOString();
	const preset = {
		id: crypto.randomUUID(),
		owner_id: String(ownerId || ""),
		name: sanitizeString(String(payload.name || "Preset"), 160),
		filters: payload.filters && typeof payload.filters === "object" ? payload.filters : {},
		shared: Boolean(payload.shared),
		created_at: now,
		updated_at: now,
	};

	await updateLocalJson(
		KEY,
		(existing = []) => {
			const arr = Array.isArray(existing) ? existing.slice() : [];
			arr.push(preset);
			return arr;
		},
		[],
	);

	return preset;
}

export async function getPresetById(id) {
	const list = await readLocalJson(KEY, []);
	if (!Array.isArray(list)) {
		return null;
	}
	return list.find((p) => String(p.id) === String(id)) || null;
}

export async function updatePreset(id, patch, actor) {
	const list = await readLocalJson(KEY, []);
	if (!Array.isArray(list)) {
		return null;
	}
	const idx = list.findIndex((p) => String(p.id) === String(id));
	if (idx < 0) {
		return null;
	}
	const existing = list[idx];
	if (
		String(existing.owner_id) !== String(actor?.id) &&
		actor?.role !== "admin" &&
		actor?.role !== "owner"
	) {
		throw forbiddenError("Not allowed to modify this preset");
	}

	const updated = {
		...existing,
		name: patch.name === undefined ? existing.name : sanitizeString(String(patch.name || ""), 160),
		filters:
			patch.filters !== undefined && typeof patch.filters === "object"
				? patch.filters
				: existing.filters,
		shared: patch.shared === undefined ? existing.shared : Boolean(patch.shared),
		updated_at: new Date().toISOString(),
	};

	list[idx] = updated;
	await updateLocalJson(KEY, () => list, []);
	return updated;
}

export async function deletePreset(id, actor) {
	const list = await readLocalJson(KEY, []);
	if (!Array.isArray(list)) {
		return false;
	}
	const idx = list.findIndex((p) => String(p.id) === String(id));
	if (idx < 0) {
		return false;
	}
	const existing = list[idx];
	if (
		String(existing.owner_id) !== String(actor?.id) &&
		actor?.role !== "admin" &&
		actor?.role !== "owner"
	) {
		throw forbiddenError("Not allowed to delete this preset");
	}

	const next = list.filter((p) => String(p.id) !== String(id));
	await updateLocalJson(KEY, () => next, []);
	return true;
}

export default {
	listPresets,
	createPreset,
	getPresetById,
	updatePreset,
	deletePreset,
};
