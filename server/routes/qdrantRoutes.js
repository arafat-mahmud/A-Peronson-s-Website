import { Router } from "express";
import { requireAdminSecurity } from "../middleware/adminSecurity.js";
import { requireAuth } from "../middleware/auth.js";
import { isEmbeddingConfigured } from "../services/embeddingService.js";
import { ensureQdrantCollections, getQdrantStatus, reindexAll } from "../services/qdrantService.js";
import { isRerankerConfigured } from "../services/rerankerService.js";

const router = Router();

router.get("/status", async (_req, res) => {
	try {
		const [qdrant, embeddings, reranker] = await Promise.all([
			getQdrantStatus(),
			isEmbeddingConfigured(),
			isRerankerConfigured(),
		]);
		return res.json({
			qdrant,
			embeddings_configured: embeddings,
			reranker_configured: reranker,
		});
	} catch (err) {
		return res.status(500).json({ error: err.message });
	}
});

router.post("/ensure-collections", requireAuth, requireAdminSecurity, async (_req, res) => {
	try {
		const result = await ensureQdrantCollections();
		return res.json(result);
	} catch (err) {
		return res.status(500).json({ error: err.message });
	}
});

router.post("/reindex", requireAuth, requireAdminSecurity, async (req, res) => {
	try {
		const reset = req.query.reset === "true";
		const result = await reindexAll({ reset });
		return res.json(result);
	} catch (err) {
		return res.status(500).json({ error: err.message });
	}
});

export default router;
