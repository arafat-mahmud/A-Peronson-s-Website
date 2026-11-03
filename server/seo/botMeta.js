import fs from "node:fs";
import path from "node:path";

// ── Bot-aware static meta injection (no full SSR) ────────────────────────────
// Crawlers that cannot run the JS shell get dist/index.html with per-route
// <title> / description / og:* / twitter:* swapped in plus a canonical link.
// Normal users and non-listed paths fall through via next() untouched.

export const SITE_ORIGIN = "https://gartexhub.onrender.com";

export const BOT_UA_RE =
	/googlebot|bingbot|slurp|duckduckbot|baiduspider|yandexbot|facebookexternalhit|twitterbot|linkedinbot|embedly|quora|pinterest|slackbot|whatsapp|telegrambot/i;

// Exact public paths only — req.path excludes the query string. Copy mirrors
// the frontend usePageMeta() titles so bots and JS users agree.
export const BOT_META_ROUTES = {
	"/": {
		title:
			"Garment Sourcing Platform | Apparel Manufacturers & Buying Houses in Bangladesh — GarTexHub",
		description:
			"Garment sourcing made simple — connect with verified apparel manufacturers in Bangladesh, plus buying houses and textile suppliers on GarTexHub.",
		canonical: `${SITE_ORIGIN}/`,
	},
	"/pricing": {
		title: "Garment Sourcing Plans & Pricing for Buyers, Factories & Buying Houses — GarTexHub",
		description:
			"Compare GarTexHub sourcing plans and pricing for buyers, factories and buying houses — free and premium tiers.",
		canonical: `${SITE_ORIGIN}/pricing`,
	},
	"/about": {
		title: "About GarTexHub | B2B Garment & Textile Sourcing Marketplace for Bangladesh Apparel",
		description:
			"About GarTexHub — the B2B garment and textile sourcing marketplace connecting Bangladesh apparel buyers, factories and buying houses.",
		canonical: `${SITE_ORIGIN}/about`,
	},
	"/help": {
		title: "Help Center | Garment Sourcing FAQs for Buyers & Apparel Manufacturers — GarTexHub",
		description:
			"Garment sourcing help and FAQs for buyers, factories and buying houses — verification, messaging, contracts and plans.",
		canonical: `${SITE_ORIGIN}/help`,
	},
	"/terms": {
		title: "Terms of Service — GarTexHub",
		description:
			"Review the terms and conditions governing the use of GarTexHub's textile and garment marketplace platform.",
		canonical: `${SITE_ORIGIN}/terms`,
	},
	"/privacy": {
		title: "Privacy Policy — GarTexHub",
		description:
			"Understand how GarTexHub collects, uses, and protects your personal data and privacy.",
		canonical: `${SITE_ORIGIN}/privacy`,
	},
	"/login": {
		title: "Login — GarTexHub",
		description: "Sign in to your GarTexHub account to manage sourcing, products, and connections.",
		canonical: `${SITE_ORIGIN}/login`,
	},
	"/signup": {
		title: "Create Account — GarTexHub",
		description:
			"Join GarTexHub — the B2B sourcing platform for garments and textiles. Create your account as a buyer, factory, or buying house.",
		canonical: `${SITE_ORIGIN}/signup`,
	},
};

let cachedShell = null;
let cachedMtimeMs = 0;

async function loadShell() {
	const file = path.join(process.cwd(), "dist", "index.html");
	try {
		const stat = await fs.promises.stat(file);
		if (cachedShell !== null && stat.mtimeMs === cachedMtimeMs) {
			return cachedShell;
		}
		cachedShell = await fs.promises.readFile(file, "utf8");
		cachedMtimeMs = stat.mtimeMs;
		return cachedShell;
	} catch {
		return null; // no dist (dev) — fall through to the SPA shell
	}
}

function escapeAttr(value) {
	return String(value)
		.replace(/&/g, "&amp;")
		.replace(/"/g, "&quot;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");
}

function replaceFirst(html, pattern, replacement) {
	if (!pattern.test(html)) {
		return { html, replaced: false };
	}
	return { html: html.replace(pattern, () => replacement), replaced: true };
}

export function injectBotMeta(html, meta, canonicalUrl) {
	const title = escapeAttr(meta.title);
	const desc = escapeAttr(meta.description);
	const url = escapeAttr(canonicalUrl);
	let out = html;
	let r = replaceFirst(out, /<title[^>]*>[\s\S]*?<\/title>/i, `<title>${title}</title>`);
	out = r.html;
	out = replaceFirst(
		out,
		/<meta\s+[^>]*name=["']description["'][^>]*>/i,
		`<meta name="description" content="${desc}" />`,
	).html;
	out = replaceFirst(
		out,
		/<meta\s+[^>]*property=["']og:title["'][^>]*>/i,
		`<meta property="og:title" content="${title}" />`,
	).html;
	out = replaceFirst(
		out,
		/<meta\s+[^>]*property=["']og:description["'][^>]*>/i,
		`<meta property="og:description" content="${desc}" />`,
	).html;
	out = replaceFirst(
		out,
		/<meta\s+[^>]*property=["']og:url["'][^>]*>/i,
		`<meta property="og:url" content="${url}" />`,
	).html;
	out = replaceFirst(
		out,
		/<meta\s+[^>]*name=["']twitter:title["'][^>]*>/i,
		`<meta name="twitter:title" content="${title}" />`,
	).html;
	out = replaceFirst(
		out,
		/<meta\s+[^>]*name=["']twitter:description["'][^>]*>/i,
		`<meta name="twitter:description" content="${desc}" />`,
	).html;
	// The shell ships no canonical link — inject one before </head>.
	if (!/rel=["']canonical["']/i.test(out)) {
		out = out.replace(/<\/head>/i, () => `  <link rel="canonical" href="${url}" />\n  </head>`);
	}
	return out;
}

export async function botMetaMiddleware(req, res, next) {
	if (req.method !== "GET") {
		next();
		return;
	}
	const meta = BOT_META_ROUTES[req.path];
	if (!meta) {
		next();
		return;
	}
	const ua =
		(typeof req.get === "function" ? req.get("user-agent") : null) ||
		req.headers?.["user-agent"] ||
		"";
	if (!BOT_UA_RE.test(ua)) {
		next();
		return;
	}
	let shell = null;
	try {
		shell = await loadShell();
	} catch {
		shell = null;
	}
	if (!shell) {
		next();
		return;
	}
	res.set("Content-Type", "text/html; charset=utf-8");
	res.send(injectBotMeta(shell, meta, meta.canonical));
}

export default botMetaMiddleware;
