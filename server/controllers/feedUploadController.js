import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { isAIAnalyticsEnabled, runImageFileAnalysis } from "../services/aiModerationService.js";
import { addImageToQueue } from "../services/imageQueue.js";
import { addToQueue } from "../services/videoQueue.js";
import { logError, logInfo } from "../utils/logger.js";
import prisma from "../utils/prisma.js";
import { sanitizeSvgFile } from "../utils/svgSanitizer.js";

function generateId() {
	return crypto.randomUUID();
}

function inferType(mime = "", originalName = "") {
	const lower = String(mime || "").toLowerCase();
	if (lower.startsWith("video/")) {
		return "video";
	}
	if (lower.startsWith("image/")) {
		return "image";
	}
	const ext = path.extname(String(originalName || "")).toLowerCase();
	if (
		[
			".mp4",
			".webm",
			".mkv",
			".flv",
			".vob",
			".ogv",
			".ogg",
			".rrc",
			".gifv",
			".mng",
			".mov",
			".avi",
			".qt",
			".wmv",
			".yuv",
			".rm",
			".asf",
			".amv",
			".m4p",
			".m4v",
			".mpg",
			".mp2",
			".mpeg",
			".mpe",
			".mpv",
			".svi",
			".3gp",
			".3g2",
			".mxf",
			".roq",
			".nsv",
			".f4v",
			".f4p",
			".f4a",
			".f4b",
			".mod",
		].includes(ext)
	) {
		return "video";
	}
	return "image";
}

async function runAIAnalysis(docId, fullPath) {
	if (!isAIAnalyticsEnabled()) {
		return;
	}
	try {
		if (!fs.existsSync(fullPath)) {
			return;
		}
		const result = await runImageFileAnalysis(fullPath);

		const newStatus = result.autoApproved ? "auto_approved" : "pending_review";

		await prisma.document.update({
			where: { id: docId },
			data: {
				ai_label: result.label,
				ai_score: result.score,
				ai_confidence: result.confidence,
				ai_signals: result.signals,
				ai_details: result.details,
				ai_timing: result.timing || {},
				ai_severity: result.severity,
				ai_early_exit: result.is_early_exit,
				ai_analyzed_at: new Date(),
				ai_auto_approved: result.autoApproved,
				moderation_status: newStatus,
			},
		});

		logInfo("AI Moderation document result", {
			docId,
			label: result.label,
			score: result.score,
			autoApproved: result.autoApproved,
		});
	} catch (err) {
		logError("AI Moderation document failed", new Error(`docId=${docId}: ${err.message}`));
	}
}

export async function uploadFeedMedia(req, res) {
	const file = req.file;
	if (!file) {
		return res.status(400).json({ error: "File is required" });
	}
	const type = inferType(file.mimetype, file.originalname);
	const filename = String(file.filename || "");
	if (!filename) {
		return res.status(500).json({ error: "Upload failed" });
	}

	const url = `/uploads/feed/${filename}`;
	const fullPath = path.join(process.cwd(), "server", "uploads", "feed", filename);

	await sanitizeSvgFile(fullPath).catch(() => null);

	try {
		const doc = await prisma.document.create({
			data: {
				id: generateId(),
				uploaded_by: req.user?.id || "anonymous",
				entity_type: "feed_media",
				entity_id: filename,
				file_path: url,
				type,
				moderation_status: "pending_review",
				ai_label: "PENDING",
				ai_score: 0,
				ai_severity: null,
				ai_early_exit: false,
				created_at: new Date(),
			},
		});

		if (type === "image" || type === "video") {
			runAIAnalysis(doc.id, fullPath).catch((err) => logError("feedUpload_aiAnalysis_failed", err));
		}

		if (type === "video") {
			addToQueue({ filePath: fullPath, documentId: doc.id });
		}

		if (type === "image") {
			addImageToQueue({ filePath: fullPath, documentId: doc.id });
		}

		return res.status(201).json({
			url,
			type,
			docId: doc.id,
			video_status: type === "video" ? "queued" : undefined,
		});
	} catch {
		return res.status(201).json({
			url,
			type,
			video_status: type === "video" ? "queued" : undefined,
		});
	}
}
