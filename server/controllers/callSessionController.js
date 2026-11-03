import path from "node:path";
import {
	createScheduledCallSession,
	endCallSession,
	findOrCreateCallSession,
	getCallSession,
	getRecordingMetadata,
	listCallHistory,
	listCallsByContract,
	markRecording,
	markRecordingViewed,
	startCallSession,
} from "../services/callSessionService.js";
import { buildFriendMatchId, isFriendConnected } from "../services/friendService.js";
import { isImageFile } from "../services/imageProcessor.js";
import { addImageToQueue } from "../services/imageQueue.js";
import { PRIVATE_ENTITY_TYPE, recordPrivateUpload } from "../services/privateDocumentService.js";
import { findUserById } from "../services/userService.js";
import { isVideoFile } from "../services/videoProcessor.js";
import { addToQueue } from "../services/videoQueue.js";
import { buildIceServers } from "../services/webrtcService.js";
import { consumePendingInvites, enqueuePendingInvites } from "../utils/pendingInvites.js";

export async function createScheduledCall(req, res) {
	const call = await createScheduledCallSession(req.user.id, req.body);
	return res.status(201).json(call);
}

export async function startCall(req, res) {
	const result = await startCallSession(req.params.callId, req.user.id);
	if (!result) {
		return res.status(404).json({ error: "Call session not found" });
	}
	if (result === "forbidden") {
		return res.status(403).json({ error: "Forbidden" });
	}
	if (result === "invalid_transition") {
		return res.status(409).json({ error: "Call cannot be started from current state" });
	}
	return res.json(result);
}

export async function endCall(req, res) {
	const result = await endCallSession(req.params.callId, req.user.id, req.body?.reason);
	if (!result) {
		return res.status(404).json({ error: "Call session not found" });
	}
	if (result === "forbidden") {
		return res.status(403).json({ error: "Forbidden" });
	}
	if (result === "invalid_transition") {
		return res.status(409).json({ error: "Call cannot be ended from current state" });
	}
	return res.json(result);
}

export async function updateRecording(req, res) {
	const requestedStatus = String(req.body?.recording_status || "").trim();
	const validStatuses = new Set(["processing", "available", "failed"]);

	if (!(requestedStatus && validStatuses.has(requestedStatus))) {
		return res.status(400).json({
			error: "Invalid recording_status. Use processing, available, or failed.",
		});
	}

	if (requestedStatus === "available" && !String(req.body?.recording_url || "").trim()) {
		return res.status(400).json({
			error: "recording_url is required when recording_status is available",
		});
	}

	if (requestedStatus === "failed" && !String(req.body?.failure_reason || "").trim()) {
		return res.status(400).json({
			error: "failure_reason is required when recording_status is failed",
		});
	}

	const call = await getCallSession(req.params.callId, req.user.id);
	if (!call) {
		return res.status(404).json({ error: "Call session not found" });
	}
	if (call === "forbidden") {
		return res.status(403).json({ error: "Forbidden" });
	}

	const currentRecordingStatus = String(call.recording_status || "pending").trim();
	const allowedTransitions = {
		pending: new Set(["processing"]),
		processing: new Set(["available", "failed"]),
		available: new Set(),
		failed: new Set(),
	};

	if (!allowedTransitions[currentRecordingStatus]?.has(requestedStatus)) {
		return res.status(409).json({
			error: `Invalid recording status transition from ${currentRecordingStatus} to ${requestedStatus}`,
		});
	}

	const result = await markRecording(req.params.callId, req.user.id, req.body);
	if (!result) {
		return res.status(404).json({ error: "Call session not found" });
	}
	if (result === "forbidden") {
		return res.status(403).json({ error: "Forbidden" });
	}
	if (result === "invalid_transition") {
		return res.status(409).json({ error: "Invalid recording status transition for this call" });
	}
	if (result === "missing_metadata") {
		return res.status(400).json({
			error: "recording_url is required when recording_status is available",
		});
	}
	if (result === "missing_failure_reason") {
		return res.status(400).json({
			error: "failure_reason is required when recording_status is failed",
		});
	}
	return res.json(result);
}

export async function getCall(req, res) {
	const result = await getCallSession(req.params.callId, req.user.id);
	if (!result) {
		return res.status(404).json({ error: "Call session not found" });
	}
	if (result === "forbidden") {
		return res.status(403).json({ error: "Forbidden" });
	}
	return res.json(result);
}

export async function uploadRecordingFile(req, res) {
	const file = req.file;
	if (!file) {
		return res.status(400).json({ error: "File is required" });
	}

	const allowedMimes = new Set([
		"video/webm",
		"video/mp4",
		"video/ogg",
		"video/x-matroska",
		"video/x-flv",
		"video/mpeg",
		"video/quicktime",
		"video/x-msvideo",
		"video/x-ms-wmv",
		"video/x-ms-asf",
		"video/3gpp",
		"video/3gpp2",
		"video/x-m4v",
		"video/x-amv",
		"video/x-sgi-movie",
		"video/x-nsv",
		"video/x-yuv",
		"video/x-f4v",
		"video/x-mng",
		"video/x-roq",
		"audio/webm",
		"audio/ogg",
		"audio/mp4",
		"application/mxf",
		"application/vnd.rn-realmedia",
	]);
	const mime = String(file.mimetype || "").toLowerCase();
	if (mime && !allowedMimes.has(mime)) {
		return res.status(400).json({ error: "Unsupported recording file type" });
	}

	const callId = req.params.callId;
	const call = await getCallSession(callId, req.user.id);
	if (!call) {
		return res.status(404).json({ error: "Call session not found" });
	}
	if (call === "forbidden") {
		return res.status(403).json({ error: "Forbidden" });
	}

	const fileName = path.basename(String(file.path || "")).replace(/\\/g, "/");
	const publicUrl = fileName ? `/uploads/calls/${fileName}` : "";
	if (!publicUrl) {
		return res.status(500).json({ error: "Recording upload failed" });
	}

	// If the call never transitioned to processing, do it now so we can mark it available.
	if (String(call.recording_status || "pending") === "pending") {
		await markRecording(callId, req.user.id, {
			recording_status: "processing",
		});
	}

	const updated = await markRecording(callId, req.user.id, {
		recording_status: "available",
		recording_url: publicUrl,
	});

	if (updated === "forbidden") {
		return res.status(403).json({ error: "Forbidden" });
	}
	if (updated === "invalid_transition") {
		return res.status(409).json({ error: "Invalid recording status transition for this call" });
	}
	if (updated === "missing_metadata") {
		return res.status(400).json({
			error: "recording_url is required when recording_status is available",
		});
	}

	// The Document row is the authorization key for /uploads/calls, and it is
	// the only place the OWNING call session can be recorded: recording_url is
	// caller-supplied (PATCH /api/calls/:callId/recording accepts any string),
	// so it can never be the anchor. entity_id carries the call id the file was
	// uploaded for, and fileAccessService authorizes against that session's
	// participants.
	await recordPrivateUpload({
		entityType: PRIVATE_ENTITY_TYPE.CALL_RECORDING,
		entityId: String(callId),
		filePath: publicUrl,
		uploadedBy: req.user.id,
		type: "video",
	});

	if (isVideoFile(file.mimetype, file.originalname)) {
		const fullPath = String(file.path || "");
		if (fullPath) {
			addToQueue({ filePath: fullPath, documentId: null });
		}
	}

	if (isImageFile(file.mimetype, file.originalname)) {
		const fullPath = String(file.path || "");
		if (fullPath) {
			addImageToQueue({ filePath: fullPath, documentId: null });
		}
	}

	return res.status(201).json(updated);
}

export async function getCallIceServers(req, res) {
	const result = await getCallSession(req.params.callId, req.user.id);
	if (!result) {
		return res.status(404).json({ error: "Call session not found" });
	}
	if (result === "forbidden") {
		return res.status(403).json({ error: "Forbidden" });
	}

	const iceServers = buildIceServers({ userId: req.user.id });
	return res.json({ iceServers });
}

export async function getCallHistory(req, res) {
	const matchIds = req.query.match_ids
		? String(req.query.match_ids)
				.split(",")
				.map((id) => id.trim())
				.filter(Boolean)
		: [];

	const history = await listCallHistory(matchIds, req.user.id);
	return res.json({ items: history });
}

export async function getCallsByContract(req, res) {
	const items = await listCallsByContract(req.params.contractId, req.user.id);
	return res.json({ items });
}

export async function getRecording(req, res) {
	const meta = await getRecordingMetadata(req.params.callId, req.user.id);
	if (!meta) {
		return res.status(404).json({ error: "Call session not found" });
	}
	if (meta === "forbidden") {
		return res.status(403).json({ error: "Forbidden" });
	}
	return res.json(meta);
}

export async function markRecordingViewedController(req, res) {
	const result = await markRecordingViewed(req.params.callId, req.user.id);
	if (!result) {
		return res.status(404).json({ error: "Call session not found" });
	}
	if (result === "forbidden") {
		return res.status(403).json({ error: "Forbidden" });
	}
	return res.json(result);
}

export async function getPendingInvites(req, res) {
	const invites = consumePendingInvites(req.user.id);
	return res.json({ invites });
}

export async function joinOrCreateCall(req, res) {
	const result = await findOrCreateCallSession(req.user.id, req.body || {});
	const call = result?.call || null;
	if (call?.id && Array.isArray(call.participant_ids)) {
		const caller = await findUserById(req.user.id);
		const from = caller
			? {
					id: caller.id,
					name: caller.name || "",
					email: caller.email || req.user.email || "",
					avatar: caller.avatar_url || caller.avatar || "",
					role: caller.role || req.user.role || "",
					verified: Boolean(caller.verified),
				}
			: {
					id: req.user.id,
					name: "",
					email: req.user.email || "",
					avatar: "",
					role: req.user.role || "",
					verified: false,
				};

		const targets = [...new Set(call.participant_ids)].filter((id) => id && id !== req.user.id);
		if (targets.length > 0) {
			enqueuePendingInvites(targets, [
				{
					type: "incoming_call",
					call_id: call.id,
					match_id: call.match_id || "",
					from,
				},
			]);
		}
	}
	return res.status(result.created ? 201 : 200).json(result);
}

export async function joinFriendCall(req, res) {
	const targetId = String(req.params.userId || "").trim();
	if (!targetId || targetId === req.user.id) {
		return res.status(400).json({ error: "Invalid friend target" });
	}

	const connected = await isFriendConnected(req.user.id, targetId);
	if (!connected) {
		return res.status(403).json({ error: "Only friends can start direct calls" });
	}

	const matchId = buildFriendMatchId(req.user.id, targetId);
	const result = await findOrCreateCallSession(req.user.id, {
		match_id: matchId,
		chat_thread_id: matchId,
		participant_ids: [targetId],
		title: "Friend call",
	});

	const call = result?.call || null;
	if (call?.id) {
		const caller = await findUserById(req.user.id);
		const from = caller
			? {
					id: caller.id,
					name: caller.name || "",
					email: caller.email || req.user.email || "",
					avatar: caller.avatar_url || caller.avatar || "",
					role: caller.role || req.user.role || "",
					verified: Boolean(caller.verified),
				}
			: {
					id: req.user.id,
					name: "",
					email: req.user.email || "",
					avatar: "",
					role: req.user.role || "",
					verified: false,
				};

		enqueuePendingInvites(
			[targetId],
			[
				{
					type: "incoming_call",
					call_id: call.id,
					match_id: call.match_id || matchId,
					from,
				},
			],
		);
	}

	return res.status(result.created ? 201 : 200).json(result);
}
