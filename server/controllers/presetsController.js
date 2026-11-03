import {
	createPreset,
	deletePreset,
	getPresetById,
	listPresets,
	updatePreset,
} from "../services/presetsService.js";
import { deny, handleControllerError, isOwnerOrAdmin } from "../utils/permissions.js";

export async function listPresetsController(req, res) {
	try {
		const items = await listPresets(req.user);
		return res.json({ items });
	} catch (err) {
		return handleControllerError(res, err);
	}
}

export async function createPresetController(req, res) {
	try {
		const payload = req.body || {};
		const created = await createPreset(req.user.id, payload);
		return res.status(201).json(created);
	} catch (err) {
		return handleControllerError(res, err);
	}
}

export async function getPresetController(req, res) {
	try {
		const id = String(req.params.id || "");
		const preset = await getPresetById(id);
		if (!preset) {
			return res.status(404).json({ error: "Preset not found" });
		}
		if (
			String(preset.owner_id) !== String(req.user?.id) &&
			!preset.shared &&
			!isOwnerOrAdmin(req.user)
		) {
			return deny(res);
		}
		return res.json(preset);
	} catch (err) {
		return handleControllerError(res, err);
	}
}

export async function updatePresetController(req, res) {
	try {
		const id = String(req.params.id || "");
		const patch = req.body || {};
		const updated = await updatePreset(id, patch, req.user);
		if (!updated) {
			return res.status(404).json({ error: "Preset not found" });
		}
		return res.json(updated);
	} catch (err) {
		return handleControllerError(res, err);
	}
}

export async function deletePresetController(req, res) {
	try {
		const id = String(req.params.id || "");
		const ok = await deletePreset(id, req.user);
		if (!ok) {
			return res.status(404).json({ error: "Preset not found" });
		}
		return res.json({ ok: true });
	} catch (err) {
		return handleControllerError(res, err);
	}
}

export default {
	listPresetsController,
	createPresetController,
	getPresetController,
	updatePresetController,
	deletePresetController,
};
