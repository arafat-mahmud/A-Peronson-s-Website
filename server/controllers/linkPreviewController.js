import { getLinkPreview } from "../services/linkPreviewService.js";
import { handleControllerError } from "../utils/permissions.js";

export async function getLinkPreviewController(req, res) {
	try {
		const { url } = req.query;
		if (!url || typeof url !== "string") {
			return res.status(400).json({ error: "url query param required" });
		}
		const preview = await getLinkPreview(url.trim());
		if (!preview) {
			return res.status(404).json({ error: "Could not fetch preview" });
		}
		return res.json(preview);
	} catch (err) {
		return handleControllerError(res, err);
	}
}
