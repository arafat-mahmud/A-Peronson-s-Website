import path from "node:path";
import { Router } from "express";
import multer from "multer";
import {
	adminCleanupTestAccounts,
	adminDeleteTestAccounts,
	adminDeleteUser,
	adminForceLogout,
	adminListUsers,
	adminLockMessaging,
	adminResetPassword,
	adminUpdateUser,
	adminVerifyUser,
	blockUserController,
	checkBlocked,
	deleteMyAccount,
	exportMyData,
	followUserController,
	friendRequestController,
	getMyBlockedUsers,
	listEarlyVerifiedFactoriesController,
	lockMyAccount,
	lookupUsers,
	me,
	searchUsersController,
	unblockUserController,
	unlockMyAccount,
	updateMyProfile,
	uploadAvatar,
} from "../controllers/userController.js";
import { requireAdminSecurity } from "../middleware/adminSecurity.js";
import { requireAuth } from "../middleware/auth.js";

const uploadDir = path.join(process.cwd(), "server", "uploads", "profile");
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
	limits: { fileSize: 5 * 1024 * 1024 },
	fileFilter: (_req, file, cb) => {
		const imgMimes = new Set([
			"image/jpeg",
			"image/png",
			"image/webp",
			"image/avif",
			"image/gif",
			"image/apng",
			"image/bmp",
			"image/x-ms-bmp",
			"image/tiff",
			"image/heic",
			"image/heif",
			"image/svg+xml",
			"image/x-tga",
			"image/vnd.adobe.photoshop",
			"image/x-photoshop",
			"image/x-xcf",
			"image/x-coreldraw",
			"image/x-adobe-dng",
			"image/x-canon-cr2",
			"image/x-canon-cr3",
			"image/x-nikon-nef",
			"image/x-sony-arw",
			"image/x-sony-sr2",
			"image/x-olympus-orf",
			"image/x-fuji-raf",
			"image/x-eps",
			"application/postscript",
			"application/pdf",
			"application/dicom",
			"application/x-coreldraw",
		]);
		if (imgMimes.has(file.mimetype)) {
			cb(null, true);
		} else {
			cb(new Error("Unsupported image format"));
		}
	},
});

const router = Router();

router.get("/me", requireAuth, me);
router.patch("/me/profile", requireAuth, updateMyProfile);
router.post("/me/avatar", requireAuth, upload.single("file"), uploadAvatar);
router.delete("/me", requireAuth, deleteMyAccount);
router.get("/me/export", requireAuth, exportMyData);
router.post("/me/lock", requireAuth, lockMyAccount);
router.delete("/me/lock", requireAuth, unlockMyAccount);
router.post("/me/block/:targetId", requireAuth, blockUserController);
router.delete("/me/block/:targetId", requireAuth, unblockUserController);
router.get("/me/block", requireAuth, getMyBlockedUsers);
router.get("/me/block/:targetId", requireAuth, checkBlocked);
router.get("/search", requireAuth, searchUsersController);
router.get("/verified/early", requireAuth, listEarlyVerifiedFactoriesController);
router.post("/lookup", requireAuth, lookupUsers);
router.post("/:userId/follow", requireAuth, followUserController);
router.post("/:userId/friend-request", requireAuth, friendRequestController);

router.get("/", requireAuth, requireAdminSecurity, adminListUsers);
router.patch("/:userId", requireAuth, requireAdminSecurity, adminUpdateUser);
router.patch("/:userId/verify", requireAuth, requireAdminSecurity, adminVerifyUser);
router.post("/:userId/reset-password", requireAuth, requireAdminSecurity, adminResetPassword);
router.post("/:userId/force-logout", requireAuth, requireAdminSecurity, adminForceLogout);
router.post("/:userId/lock-messaging", requireAuth, requireAdminSecurity, adminLockMessaging);
router.post("/cleanup/search", requireAuth, requireAdminSecurity, adminCleanupTestAccounts);
router.post("/cleanup/delete", requireAuth, requireAdminSecurity, adminDeleteTestAccounts);
router.delete("/:userId", requireAuth, requireAdminSecurity, adminDeleteUser);

export default router;
