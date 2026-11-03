import crypto from "node:crypto";
import prisma from "../utils/prisma.js";
import { sanitizeString } from "../utils/validators.js";
import { trackEvent } from "./eventTrackingService.js";

function _toIsoNow() {
	return new Date().toISOString();
}

function _safeArray(value) {
	return Array.isArray(value) ? value : [];
}

function _sortNewest(a, b) {
	return String(b.viewed_at || "").localeCompare(String(a.viewed_at || ""));
}

function normalizeProductVideoFlags(product) {
	const reviewStatus = product.video_review_status || "approved";
	const restricted = Boolean(product.video_restricted || reviewStatus !== "approved");
	return {
		...product,
		video_review_status: reviewStatus,
		video_restricted: restricted,
		video_url: restricted ? "" : product.video_url,
		hasVideo: !restricted && Boolean(product.video_url),
	};
}

function publicAuthor(user) {
	if (!user) {
		return null;
	}
	return {
		id: user.id,
		name: user.name || "",
		role: user.role || "",
		verified: Boolean(user.verified),
		country: String(user.profile?.country || ""),
	};
}

export async function recordView(userId, productId, { windowMinutes = 10, geo = null } = {}) {
	const viewerId = sanitizeString(String(userId || ""), 120);
	const pid = sanitizeString(String(productId || ""), 120);
	if (!(viewerId && pid)) {
		return "not_found";
	}

	const product = await prisma.product.findUnique({ where: { id: pid } });
	if (!product) {
		return "not_found";
	}

	const now = Date.now();
	const windowMs = Math.max(1, Number(windowMinutes) || 10) * 60 * 1000;

	const existing = await prisma.productView.findFirst({
		where: { user_id: viewerId, product_id: pid },
	});

	if (existing) {
		const lastAt = new Date(existing.viewed_at).getTime();
		if (Number.isFinite(lastAt) && now - lastAt < windowMs) {
			return {
				ok: true,
				deduped: true,
				viewed_at: existing.viewed_at,
			};
		}
		await prisma.productView.update({
			where: { id: existing.id },
			data: { viewed_at: new Date(), updated_at: new Date() },
		});
	} else {
		await prisma.productView.create({
			data: {
				id: crypto.randomUUID(),
				user_id: viewerId,
				product_id: pid,
				viewed_at: new Date(),
				created_at: new Date(),
				updated_at: new Date(),
			},
		});
	}

	await trackEvent({
		type: "product_viewed",
		actor_id: viewerId,
		entity_id: pid,
		metadata:
			geo && typeof geo === "object"
				? {
						country: geo.country || "",
						city: geo.city || "",
						lat: geo.lat ?? null,
						lng: geo.lng ?? null,
					}
				: {},
	});
	return { ok: true, deduped: false };
}

export async function listMyProductViews(userId, { cursor = 0, limit = 10 } = {}) {
	const viewerId = sanitizeString(String(userId || ""), 120);
	const safeCursor = Math.max(0, Math.floor(Number(cursor || 0)));
	const safeLimit = Math.min(50, Math.max(1, Math.floor(Number(limit || 10))));

	const [views, products, users] = await Promise.all([
		prisma.productView.findMany({
			where: { user_id: viewerId },
			orderBy: { viewed_at: "desc" },
		}),
		prisma.product.findMany(),
		prisma.user.findMany(),
	]);

	const productsById = new Map(products.map((p) => [String(p.id), normalizeProductVideoFlags(p)]));
	const usersById = new Map(users.map((u) => [String(u.id), u]));

	const pageRows = views.slice(safeCursor, safeCursor + safeLimit);
	const items = pageRows
		.map((v) => {
			const product = productsById.get(String(v.product_id)) || null;
			const author = product ? publicAuthor(usersById.get(String(product.company_id))) : null;
			return {
				id: v.id,
				viewed_at: v.viewed_at,
				product: product
					? {
							id: product.id,
							title: product.title,
							category: product.category,
							material: product.material,
							moq: product.moq,
							lead_time_days: product.lead_time_days,
							description: product.description,
							hasVideo: Boolean(product.hasVideo),
							video_url: product.video_url || "",
							video_review_status: product.video_review_status || "",
						}
					: null,
				author,
			};
		})
		.filter((row) => row.product);

	const nextCursor = safeCursor + safeLimit < views.length ? safeCursor + safeLimit : null;
	return {
		cursor: safeCursor,
		next_cursor: nextCursor,
		total: views.length,
		items,
	};
}
