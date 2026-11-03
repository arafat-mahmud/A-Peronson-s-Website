const IP_GEO_TTL_MS = 6 * 60 * 60 * 1000;
const SEARCH_TTL_MS = 60 * 60 * 1000;

const ipCache = new Map();
const searchCache = new Map();

function now() {
	return Date.now();
}

function cacheGet(cache, key) {
	const entry = cache.get(key);
	if (!entry) {
		return null;
	}
	if (entry.expires_at && entry.expires_at < now()) {
		cache.delete(key);
		return null;
	}
	return entry.value || null;
}

function cacheSet(cache, key, value, ttlMs) {
	cache.set(key, { value, expires_at: now() + ttlMs });
}

function sanitizeIp(value) {
	const raw = String(value || "").trim();
	if (!raw) {
		return "";
	}
	const parts = raw
		.split(",")
		.map((p) => p.trim())
		.filter(Boolean);
	return parts[0] || "";
}

export function extractClientIp(req) {
	const candidates = [
		req.headers["x-forwarded-for"],
		req.headers["cf-connecting-ip"],
		req.headers["x-real-ip"],
		req.ip,
	];
	for (const candidate of candidates) {
		const ip = sanitizeIp(candidate);
		if (ip) {
			return ip;
		}
	}
	return "";
}

export async function locateIp(ip = "") {
	const safeIp = sanitizeIp(ip);
	if (!safeIp) {
		return null;
	}
	const cached = cacheGet(ipCache, safeIp);
	if (cached) {
		return cached;
	}

	if (typeof fetch !== "function") {
		return null;
	}
	try {
		const res = await fetch(
			`http://ip-api.com/json/${encodeURIComponent(safeIp)}?fields=status,message,country,countryCode,regionName,city,lat,lon,query`,
			{
				headers: { "user-agent": "GarTexHub/1.0" },
			},
		);
		const data = await res.json().catch(() => ({}));
		if (!res.ok || data?.status !== "success") {
			return null;
		}
		const geo = {
			ip: data.query,
			country: data.country || "",
			country_code: data.countryCode || "",
			region: data.regionName || "",
			city: data.city || "",
			lat: Number.isFinite(Number(data.lat)) ? Number(data.lat) : null,
			lng: Number.isFinite(Number(data.lon)) ? Number(data.lon) : null,
		};
		cacheSet(ipCache, safeIp, geo, IP_GEO_TTL_MS);
		return geo;
	} catch {
		return null;
	}
}

export async function searchGeo(query = "") {
	const term = String(query || "").trim();
	if (!term) {
		return [];
	}
	const cached = cacheGet(searchCache, term.toLowerCase());
	if (cached) {
		return cached;
	}

	if (typeof fetch !== "function") {
		return [];
	}
	try {
		const url = new URL("https://nominatim.openstreetmap.org/search");
		url.searchParams.set("q", term);
		url.searchParams.set("format", "json");
		url.searchParams.set("addressdetails", "1");
		url.searchParams.set("limit", "6");
		const res = await fetch(url.toString(), {
			headers: { "user-agent": "GarTexHub/1.0 (contact@gartexhub.com)" },
		});
		const data = await res.json().catch(() => []);
		const results = Array.isArray(data)
			? data
					.map((row) => ({
						id: row.place_id,
						label: row.display_name,
						lat: Number(row.lat),
						lng: Number(row.lon),
					}))
					.filter((row) => Number.isFinite(row.lat) && Number.isFinite(row.lng))
			: [];
		cacheSet(searchCache, term.toLowerCase(), results, SEARCH_TTL_MS);
		return results;
	} catch {
		return [];
	}
}
