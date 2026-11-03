import crypto from "node:crypto";
import { logError, logWarn } from "../utils/logger.js";
import prisma from "../utils/prisma.js";

// The Document row is the authorization key for every gated uploads prefix:
// fileAccessService.authorizeFilePath refuses to serve a path that no row
// anchors ("not_found"). Rows are written HERE, at upload time, because the
// facts the authorization needs — who uploaded the file, which thread it went
// to, which call session owns the recording — only exist at the moment the
// file lands on disk. A backfill can never know them: the AI-moderation
// backfill (uploadsService) is disabled in the deployed configuration
// (AI_HARAM_ANALYTICS_ENABLED=false) and it only ever covered image/video.
//
// A file without a row is not "public" — it is unreachable, for everyone,
// including the person who uploaded it. That is the fail-closed direction, and
// it is why the row is written on the upload path rather than by a scanner.

export const PRIVATE_ENTITY_TYPE = {
	CHAT_ATTACHMENT: "chat_attachment",
	CALL_RECORDING: "call_recording",
	SEARCH_IMAGE: "search_image",
	SUPPORT_CASE: "support_case",
};

function text(value) {
	return String(value ?? "").trim();
}

/**
 * Writes the Document row that anchors one private upload.
 *
 * @param {Object} params
 * @param {string} params.entityType One of PRIVATE_ENTITY_TYPE.
 * @param {string} params.entityId The fact the authorization anchors on: the
 *   file name for a chat attachment, the owning call id for a recording, the
 *   owning case id for a support attachment.
 * @param {string} params.filePath The public path, e.g. "/uploads/chat/x.png".
 * @param {string} params.uploadedBy The id of the user who uploaded it.
 * @param {string} [params.type] The media type, for the admin listing.
 * @param {Object} [params.moderation] Optional moderation columns for the
 *   admin review queue: { moderation_status, moderation_flags }. Absent for
 *   the three callers that have no moderation step.
 * @returns {Promise<Object|null>} The created row, or null when it could not
 *   be written.
 */
export async function recordPrivateUpload({
	entityType,
	entityId,
	filePath,
	uploadedBy,
	type = "other",
	moderation = null,
}) {
	const entity = text(entityType);
	const id = text(entityId);
	const file = text(filePath);
	const owner = text(uploadedBy);

	if (!(entity && id && file && owner)) {
		logWarn("private upload row skipped: incomplete", {
			entityType: entity,
			entityId: id,
			filePath: file,
			uploadedBy: owner,
		});
		return null;
	}

	try {
		return await prisma.document.create({
			data: {
				id: crypto.randomUUID(),
				uploaded_by: owner,
				entity_type: entity,
				entity_id: id,
				file_path: file,
				type: text(type) || "other",
				...(moderation
					? {
							moderation_status: text(moderation.moderation_status) || null,
							moderation_flags: moderation.moderation_flags ?? null,
						}
					: {}),
			},
		});
	} catch (error) {
		// The bytes are already on disk and the message is already sent, so
		// failing the request here would only produce a duplicate upload. What
		// the failure costs is reachability: the file becomes unreadable, so it
		// is logged loudly rather than swallowed.
		logError("private upload row failed", new Error(`${file}: ${error.message}`));
		return null;
	}
}
