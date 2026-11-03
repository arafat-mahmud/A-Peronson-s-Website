import { getAdminCatalog } from "../services/adminCatalogService.js";

export async function adminCatalogOverview(_req, res) {
	const catalog = await getAdminCatalog();
	return res.json(catalog);
}
