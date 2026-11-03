import { Router } from "express";
import { adminAuditLogger } from "../middleware/adminAudit.js";
import { requireAdminSecurity } from "../middleware/adminSecurity.js";
import { requireAuth } from "../middleware/auth.js";
import {
	deleteUploadFile,
	getUploadsListing,
	getUploadsStats,
} from "../services/uploadsService.js";

const router = Router();

router.get(
	"/uploads/listing",
	requireAuth,
	requireAdminSecurity,
	adminAuditLogger(),
	async (req, res) => {
		try {
			const folder = req.query.folder || "all";
			const { files, total } = await getUploadsListing(folder);
			res.json({ files, count: files.length, total });
		} catch (error) {
			res.status(500).json({ error: error.message });
		}
	},
);

router.get(
	"/uploads/stats",
	requireAuth,
	requireAdminSecurity,
	adminAuditLogger(),
	async (_req, res) => {
		try {
			const stats = await getUploadsStats();
			res.json(stats);
		} catch (error) {
			res.status(500).json({ error: error.message });
		}
	},
);

router.delete(
	"/uploads/file",
	requireAuth,
	requireAdminSecurity,
	adminAuditLogger(),
	async (req, res) => {
		try {
			const { file_path } = req.body;
			if (!file_path) {
				return res.status(400).json({ error: "file_path is required" });
			}
			const result = await deleteUploadFile(file_path);
			if (result.error) {
				return res.status(404).json({ error: result.error });
			}
			res.json(result);
		} catch (error) {
			res.status(500).json({ error: error.message });
		}
	},
);

export default router;
