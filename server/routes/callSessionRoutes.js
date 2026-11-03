import fs from "node:fs";
import path from "node:path";
import { Router } from "express";
import multer from "multer";
import {
	createScheduledCall,
	endCall,
	getCall,
	getCallHistory,
	getCallIceServers,
	getCallsByContract,
	getPendingInvites,
	getRecording,
	joinFriendCall,
	joinOrCreateCall,
	markRecordingViewedController,
	startCall,
	updateRecording,
	uploadRecordingFile,
} from "../controllers/callSessionController.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

const callsUploadRoot = path.join(process.cwd(), "server", "uploads", "calls");
if (!fs.existsSync(callsUploadRoot)) {
	fs.mkdirSync(callsUploadRoot, { recursive: true });
}

const recordingUpload = multer({
	storage: multer.diskStorage({
		destination: (_req, _file, cb) => cb(null, callsUploadRoot),
		filename: (req, file, cb) => {
			const ext = path.extname(file.originalname || "").toLowerCase() || ".webm";
			const videoExts = new Set([
				".webm",
				".mp4",
				".ogg",
				".mkv",
				".flv",
				".mov",
				".avi",
				".wmv",
				".mpg",
				".mpeg",
				".3gp",
				".m4v",
				".ogv",
				".asf",
				".amv",
				".mxf",
				".f4v",
				".f4a",
				".f4b",
				".f4p",
				".qt",
				".rm",
				".vob",
				".rrc",
				".gifv",
				".mng",
				".yuv",
				".m4p",
				".mp2",
				".mpe",
				".mpv",
				".svi",
				".3g2",
				".roq",
				".nsv",
				".mod",
			]);
			const safeExt = videoExts.has(ext) ? ext : ".webm";
			const safeCallId = String(req.params.callId || "call").replace(/[^a-zA-Z0-9_-]/g, "_");
			cb(null, `${safeCallId}-${Date.now()}${safeExt}`);
		},
	}),
	limits: { fileSize: 120 * 1024 * 1024 },
});

router.post("/scheduled", requireAuth, createScheduledCall);
router.post("/join", requireAuth, joinOrCreateCall);
router.post("/friend/:userId/join", requireAuth, joinFriendCall);
router.get("/history", requireAuth, getCallHistory);
router.get("/by-contract/:contractId", requireAuth, getCallsByContract);
router.get("/pending", requireAuth, getPendingInvites);
router.get("/:callId/ice", requireAuth, getCallIceServers);
router.get("/:callId", requireAuth, getCall);
router.post("/:callId/start", requireAuth, startCall);
router.post("/:callId/end", requireAuth, endCall);
router.patch("/:callId/recording", requireAuth, updateRecording);
router.get("/:callId/recording", requireAuth, getRecording);
router.post("/:callId/recording/viewed", requireAuth, markRecordingViewedController);
router.post(
	"/:callId/recording/upload",
	requireAuth,
	recordingUpload.single("file"),
	uploadRecordingFile,
);

export default router;
