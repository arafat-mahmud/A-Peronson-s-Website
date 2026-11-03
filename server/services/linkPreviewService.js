import prisma from "../utils/prisma.js";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function parseDomain(urlStr) {
	try {
		const u = new URL(urlStr);
		return u.hostname.replace(/^www\./, "");
	} catch {
		return urlStr;
	}
}

export async function getLinkPreview(url) {
	if (!url || typeof url !== "string") {
		return null;
	}
	try {
		new URL(url);
	} catch {
		return null;
	}

	const existing = await prisma.linkPreview.findUnique({ where: { url } });
	if (existing && Date.now() - new Date(existing.updated_at).getTime() < CACHE_TTL_MS) {
		return existing;
	}

	try {
		const { getLinkPreview: fetchPreview } = await import("link-preview-js");
		const result = await fetchPreview(url, {
			timeout: 5000,
			followRedirects: "follow",
			headers: {
				"user-agent": "Mozilla/5.0 (compatible; GartexHub/1.0; +https://gartexhub.com)",
				"Accept-Language": "en-US",
			},
		});

		const data = {
			url: result.url || url,
			title: result.title || null,
			description: result.description || null,
			image: Array.isArray(result.images) && result.images.length > 0 ? result.images[0] : null,
			favicon:
				Array.isArray(result.favicons) && result.favicons.length > 0 ? result.favicons[0] : null,
			site_name: result.siteName || null,
			domain: parseDomain(result.url || url),
		};

		if (existing) {
			return prisma.linkPreview.update({ where: { url }, data });
		}
		return prisma.linkPreview.create({ data });
	} catch {
		const domain = parseDomain(url);
		const fallback = {
			url,
			title: domain,
			description: null,
			image: null,
			favicon: null,
			site_name: null,
			domain,
		};

		if (existing) {
			return prisma.linkPreview.update({ where: { url }, data: fallback }).catch(() => fallback);
		}
		return prisma.linkPreview.create({ data: fallback }).catch(() => fallback);
	}
}

export async function batchGetLinkPreviews(urls) {
	const unique = [...new Set(urls.filter(Boolean))];
	const existing = await prisma.linkPreview.findMany({
		where: { url: { in: unique } },
	});
	const cached = new Map(existing.map((p) => [p.url, p]));
	const stale = existing.filter(
		(p) => Date.now() - new Date(p.updated_at).getTime() >= CACHE_TTL_MS,
	);
	const missing = unique.filter((u) => !cached.has(u));
	const toFetch = [...new Set([...missing, ...stale.map((s) => s.url)])];

	const results = new Map(cached);
	await Promise.allSettled(
		toFetch.map(async (u) => {
			const preview = await getLinkPreview(u);
			if (preview) {
				results.set(u, preview);
			}
		}),
	);
	return unique.map((u) => results.get(u) || null).filter(Boolean);
}
