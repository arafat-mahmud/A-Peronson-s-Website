import { extractClientIp, locateIp, searchGeo } from "../services/geoService.js";
import { sanitizeString } from "../utils/validators.js";

export async function geoLocate(req, res) {
	const ip = extractClientIp(req);
	const geo = await locateIp(ip);
	if (!geo) {
		return res.json({ ok: false, geo: null });
	}
	return res.json({ ok: true, geo });
}

export async function geoSearch(req, res) {
	const query = sanitizeString(String(req.query?.q || ""), 200);
	if (!query) {
		return res.json({ ok: true, items: [] });
	}
	const items = await searchGeo(query);
	return res.json({ ok: true, items });
}
