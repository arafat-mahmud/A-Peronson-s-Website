import fs from "node:fs";
import path from "node:path";
import { Router } from "express";
import multer from "multer";
import {
	acceptRequest,
	getMessages,
	getPolicyConfig,
	inbox,
	listMessagePolicyQueueInspector,
	listPolicyReviewQueue,
	markPolicyFalsePositive,
	markRead,
	rejectRequest,
	sendFriendDirectMessage,
	sendMessage,
	updatePolicyConfig,
	updateSenderReputation,
	uploadMessageAttachment,
	weeklyPolicyDecisionQualityReport,
} from "../controllers/messageController.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

const ALLOWED_IMG_EXTS = new Set([
	".jpg",
	".jpeg",
	".png",
	".webp",
	".avif",
	".gif",
	".apng",
	".bmp",
	".tiff",
	".tif",
	".heic",
	".heif",
	".dcm",
	".tga",
	".svg",
	".eps",
	".pdf",
	".dng",
	".cr2",
	".cr3",
	".nef",
	".arw",
	".sr2",
	".orf",
	".raf",
	".psd",
	".ai",
	".xcf",
	".cdr",
]);
const ALLOWED_VID_EXTS = new Set([
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
]);

const uploadDir = path.join(process.cwd(), "server", "uploads", "chat");
if (!fs.existsSync(uploadDir)) {
	fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({
	storage: multer.diskStorage({
		destination: (_req, _file, cb) => cb(null, uploadDir),
		filename: (_req, file, cb) => {
			const ext = path.extname(file.originalname || "").slice(0, 12);
			const baseWithoutExt = path.basename(file.originalname || "file", ext);
			const safeBase = baseWithoutExt.replace(/[^a-zA-Z0-9_.-]/g, "_").slice(0, 80) || "file";
			cb(null, `${Date.now()}-${safeBase}${ext || ""}`);
		},
	}),
	limits: { fileSize: 250 * 1024 * 1024 },
	fileFilter: (_req, file, cb) => {
		const ext = path.extname(file.originalname || "").toLowerCase();
		const mime = String(file.mimetype || "").toLowerCase();
		if (
			mime.startsWith("image/") ||
			ALLOWED_IMG_EXTS.has(ext) ||
			mime.startsWith("video/") ||
			ALLOWED_VID_EXTS.has(ext)
		) {
			cb(null, true);
		} else {
			cb(new Error("Unsupported file format"));
		}
	},
});

router.get("/inbox", requireAuth, inbox);
router.post("/requests/:threadId/accept", requireAuth, acceptRequest);
router.post("/requests/:threadId/reject", requireAuth, rejectRequest);
router.post("/friend/:userId", requireAuth, sendFriendDirectMessage);

router.get("/policy/config", requireAuth, getPolicyConfig);
router.get("/policy/review-queue", requireAuth, listPolicyReviewQueue);
router.get("/policy/queue-inspector", requireAuth, listMessagePolicyQueueInspector);
router.post(
	"/policy/review-queue/:decisionId/false-positive",
	requireAuth,
	markPolicyFalsePositive,
);
router.post("/policy/reputation/:senderId/adjust", requireAuth, updateSenderReputation);
router.get(
	"/policy/reports/weekly-decision-quality",
	requireAuth,
	weeklyPolicyDecisionQualityReport,
);
router.put("/policy/config", requireAuth, updatePolicyConfig);
router.post("/:matchId/read", requireAuth, markRead);
router.post("/:matchId/upload", requireAuth, upload.single("file"), uploadMessageAttachment);
router.post("/:matchId", requireAuth, sendMessage);
router.get("/:matchId", requireAuth, getMessages);

export default router;
