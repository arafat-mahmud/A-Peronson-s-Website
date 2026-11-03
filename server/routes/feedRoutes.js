import fs from "node:fs";
import path from "node:path";
import { Router } from "express";
import multer from "multer";
import { combinedFeed } from "../controllers/feedController.js";
import {
	getMyFeedPosts,
	patchFeedPost,
	postFeedPost,
	removeFeedPost,
	searchFeedPostsController,
} from "../controllers/feedPostController.js";
import { feedStream } from "../controllers/feedStreamController.js";
import { uploadFeedMedia } from "../controllers/feedUploadController.js";
import { requireAuth } from "../middleware/auth.js";
import { getAdminConfig } from "../services/adminConfigService.js";
import { getShareablePost } from "../services/feedService.js";

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
const ALLOWED_VID_MIMES = new Set([
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

const uploadDir = path.join(process.cwd(), "server", "uploads", "feed");
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
			ALLOWED_VID_MIMES.has(mime) ||
			ALLOWED_VID_EXTS.has(ext)
		) {
			cb(null, true);
		} else {
			cb(new Error("Unsupported file format"));
		}
	},
});

router.get("/stream", feedStream);
// The feed page's labels and messages. They are UI copy, so every signed-in
// user may read them; only admins may change them (/api/admin/config/feed-page).
// Members used to call the admin route, get 403 and fall back to defaults.
router.get("/page-config", requireAuth, async (_req, res) => {
	try {
		const config = await getAdminConfig();
		res.set("Cache-Control", "private, max-age=300");
		res.json(config.feed_page || {});
	} catch {
		res.status(500).json({ error: "Failed to fetch feed page config" });
	}
});
router.get("/share/:entityType/:entityId", async (req, res) => {
	try {
		const post = await getShareablePost(req.params.entityType, req.params.entityId);
		if (!post) return res.status(404).json({ error: "Post not found or unavailable" });
		return res.json(post);
	} catch (err) {
		return res.status(500).json({ error: "Failed to load shared post" });
	}
});
router.get("/posts/mine", requireAuth, getMyFeedPosts);
router.get("/search", requireAuth, searchFeedPostsController);
router.post("/posts/upload", requireAuth, upload.single("file"), uploadFeedMedia);
router.post("/posts", requireAuth, postFeedPost);
router.patch("/posts/:postId", requireAuth, patchFeedPost);
router.delete("/posts/:postId", requireAuth, removeFeedPost);
router.get("/", requireAuth, combinedFeed);
export default router;
