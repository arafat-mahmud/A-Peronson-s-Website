import { logInfo } from "../utils/logger.js";
import prisma from "../utils/prisma.js";
import { trackEvent } from "./eventTrackingService.js";
import { listFeedPosts } from "./feedPostService.js";
import { batchGetLinkPreviews } from "./linkPreviewService.js";
import { getOrderCertificationMap } from "./orderCertificationService.js";
import { listProducts } from "./productService.js";
import { listRequirements } from "./requirementService.js";

const CATEGORIES = ["Shirts", "Knitwear", "Denim", "Women", "Kids"];

const FEED_BOOST_CONFIG = {
	windowDays: Number(process.env.FEED_BOOST_WINDOW_DAYS || 30),
	decayDays: Number(process.env.FEED_BOOST_DECAY_DAYS || 60),
	maxMultiplier: Number(process.env.FEED_BOOST_MAX_MULTIPLIER || 1.35),
	minProfileCompleteness: Number(process.env.FEED_BOOST_MIN_PROFILE_COMPLETENESS || 0.5),
	minActivityQuality: Number(process.env.FEED_BOOST_MIN_ACTIVITY_QUALITY || 0.4),
	minimumAccountAgeHours: Number(process.env.FEED_BOOST_MIN_ACCOUNT_AGE_HOURS || 1),
	abuseRapidWindowMinutes: Number(process.env.FEED_ABUSE_RAPID_WINDOW_MINUTES || 120),
	abuseRapidMaxPosts: Number(process.env.FEED_ABUSE_RAPID_MAX_POSTS || 3),
	spamKeywordLimit: Number(process.env.FEED_SPAM_KEYWORD_LIMIT || 3),
	spamDuplicateRatioLimit: Number(process.env.FEED_SPAM_DUPLICATE_RATIO_LIMIT || 0.5),
	spamMinWordVarietyRatio: Number(process.env.FEED_SPAM_MIN_WORD_VARIETY || 0.35),
};

const SPAM_KEYWORDS = [
	"whatsapp",
	"telegram",
	"dm",
	"discount",
	"cheap",
	"guarantee",
	"click",
	"urgent",
	"100%",
];
const DISCUSSION_BOOST_HOURS = 48;
const DISCUSSION_BOOST_MULTIPLIER = 1.12;
const PREMIUM_FEED_BOOST_MULTIPLIER = 1.08;

function clamp01(value) {
	return Math.min(1, Math.max(0, value));
}

function getAuthorId(item) {
	if (item.feed_type === "buyer_request") {
		return item.buyer_id;
	}
	if (item.feed_type === "company_product") {
		return item.company_id;
	}
	if (item.feed_type === "user_feed_post") {
		return item.user_id;
	}
	return "";
}

function computeProfileCompleteness(user = {}) {
	const profile = user.profile || {};
	const checks = [
		Boolean(user.name),
		Boolean(user.email),
		Boolean(profile.country),
		Array.isArray(profile.certifications) && profile.certifications.length > 0,
		Boolean(profile.bank_proof),
		Boolean(profile.export_license),
		Boolean(profile.monthly_capacity),
		Boolean(profile.moq),
		Boolean(profile.lead_time_days),
	];

	const completed = checks.filter(Boolean).length;
	return checks.length > 0 ? completed / checks.length : 0;
}

function computeActivityQuality(authorItemIds = [], socialRows = []) {
	if (authorItemIds.length === 0) {
		return 0.5;
	}

	const idSet = new Set(authorItemIds);
	const relevant = socialRows.filter((row) => idSet.has(row.entity_id));

	const positive = relevant.filter(
		(row) => row.interaction_type === "comment" || row.interaction_type === "share",
	).length;
	const reports = relevant.filter((row) => row.interaction_type === "report").length;

	return (positive + 1) / (positive + reports + 2);
}

function getAccountAgeDays(user = {}) {
	if (!user.created_at) {
		return Number.POSITIVE_INFINITY;
	}
	const ageMs = Date.now() - new Date(user.created_at).getTime();
	return Math.max(0, ageMs / (1000 * 60 * 60 * 24));
}

function getAgeBoostMultiplier(accountAgeDays) {
	const { windowDays, decayDays, maxMultiplier } = FEED_BOOST_CONFIG;

	if (!Number.isFinite(accountAgeDays)) {
		return 1;
	}
	if (accountAgeDays <= windowDays) {
		return maxMultiplier;
	}
	if (accountAgeDays <= windowDays + decayDays) {
		const decayProgress = (accountAgeDays - windowDays) / Math.max(1, decayDays);
		const multiplier = 1 + (maxMultiplier - 1) * (1 - decayProgress);
		return Math.max(1, multiplier);
	}

	return 1;
}

function normalizeContent(item = {}) {
	return `${item.title || ""} ${item.description || ""} ${item.description_markdown || ""} ${item.caption || ""}`
		.toLowerCase()
		.replace(/\s+/g, " ")
		.trim();
}

function evaluateSpamPattern(item = {}, authorItems = []) {
	const text = normalizeContent(item);
	if (!text) {
		return {
			keywordHits: 0,
			duplicateRatio: 0,
			wordVarietyRatio: 0,
			lowQualitySpam: false,
		};
	}

	const words = text.split(/\W+/).filter(Boolean);
	const uniqueWords = new Set(words);
	const wordVarietyRatio = words.length > 0 ? uniqueWords.size / words.length : 0;

	const keywordHits = SPAM_KEYWORDS.reduce(
		(count, keyword) => count + (text.includes(keyword) ? 1 : 0),
		0,
	);

	const normalizedItems = authorItems
		.map((authorItem) => normalizeContent(authorItem))
		.filter(Boolean);

	const duplicateCount = normalizedItems.filter((entry) => entry === text).length;
	const duplicateRatio = normalizedItems.length > 0 ? duplicateCount / normalizedItems.length : 0;

	const lowQualitySpam =
		keywordHits >= FEED_BOOST_CONFIG.spamKeywordLimit ||
		duplicateRatio >= FEED_BOOST_CONFIG.spamDuplicateRatioLimit ||
		wordVarietyRatio < FEED_BOOST_CONFIG.spamMinWordVarietyRatio;

	return {
		keywordHits,
		duplicateRatio,
		wordVarietyRatio,
		lowQualitySpam,
	};
}

function evaluateRepeatedPosting(item = {}, authorItems = []) {
	const createdAt = new Date(item.created_at).getTime();
	if (!Number.isFinite(createdAt)) {
		return {
			postsInRapidWindow: 0,
			suspiciousRepeatedPosting: false,
		};
	}

	const rapidWindowMs = FEED_BOOST_CONFIG.abuseRapidWindowMinutes * 60 * 1000;
	const windowStart = createdAt - rapidWindowMs;

	const postsInRapidWindow = authorItems.filter((authorItem) => {
		const authorCreatedAt = new Date(authorItem.created_at).getTime();
		return (
			Number.isFinite(authorCreatedAt) &&
			authorCreatedAt >= windowStart &&
			authorCreatedAt <= createdAt
		);
	}).length;

	return {
		postsInRapidWindow,
		suspiciousRepeatedPosting: postsInRapidWindow > FEED_BOOST_CONFIG.abuseRapidMaxPosts,
	};
}

function evaluateAntiAbuseSignals(item = {}, authorItems = []) {
	const repeatedPosting = evaluateRepeatedPosting(item, authorItems);
	const spamPattern = evaluateSpamPattern(item, authorItems);

	return {
		...repeatedPosting,
		...spamPattern,
		antiAbusePassed: !(repeatedPosting.suspiciousRepeatedPosting || spamPattern.lowQualitySpam),
	};
}

function calculateRecencyScore(itemCreatedAt) {
	const hoursOld = Math.max(0, (Date.now() - new Date(itemCreatedAt).getTime()) / (1000 * 60 * 60));
	return 1 / (1 + hoursOld / 24);
}

function roundNumber(value) {
	return Number(value.toFixed(4));
}

function buildRatingMap(store) {
	const rows = Array.isArray(store?.ratings) ? store.ratings : Array.isArray(store) ? store : [];
	const sums = new Map();
	const counts = new Map();
	for (const row of rows) {
		const key = String(row?.profile_key || "");
		if (!key.startsWith("user:")) {
			continue;
		}
		const userId = key.slice("user:".length);
		if (!userId) {
			continue;
		}
		const value = Number(row?.score || 0);
		if (!Number.isFinite(value) || value <= 0) {
			continue;
		}
		sums.set(userId, (sums.get(userId) || 0) + value);
		counts.set(userId, (counts.get(userId) || 0) + 1);
	}
	const averages = new Map();
	for (const [userId, total] of sums.entries()) {
		const count = counts.get(userId) || 0;
		if (!count) {
			continue;
		}
		averages.set(userId, total / count);
	}
	return averages;
}

function isActivePaidBoost(boost) {
	if (!boost) {
		return false;
	}
	if (String(boost.status || "").toLowerCase() !== "active") {
		return false;
	}
	const now = Date.now();
	const startsAt = new Date(boost.starts_at).getTime();
	const endsAt = new Date(boost.ends_at).getTime();
	if (!(Number.isFinite(startsAt) && Number.isFinite(endsAt))) {
		return false;
	}
	return now >= startsAt && now <= endsAt;
}

function buildPaidBoostMap(boosts = []) {
	const byUser = new Map();
	boosts.forEach((boost) => {
		if (!isActivePaidBoost(boost)) {
			return;
		}
		if (String(boost.scope || "").toLowerCase() !== "feed") {
			return;
		}
		const userId = String(boost.user_id || "");
		const multiplier = Number(boost.multiplier || 1);
		if (!(userId && Number.isFinite(multiplier)) || multiplier <= 1) {
			return;
		}
		const current = byUser.get(userId) || 1;
		if (multiplier > current) {
			byUser.set(userId, multiplier);
		}
	});
	return byUser;
}

function normalizeCategoryValue(item = {}) {
	const value = String(item.category || "")
		.toLowerCase()
		.trim();
	return value || "unknown";
}

function diversifyFeedItems(
	items = [],
	{ explorationRate = 0.2, maxSameAuthorRun = 1, maxSameCategoryRun = 2 } = {},
) {
	if (!Array.isArray(items) || items.length <= 2) {
		return items;
	}

	const topWindow = items.slice(0, 20);
	const freq = new Map();
	for (const item of topWindow) {
		const key = normalizeCategoryValue(item);
		freq.set(key, (freq.get(key) || 0) + 1);
	}
	const dominantCategory = [...freq.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "unknown";

	const dominantPool = [];
	const explorePool = [];
	for (const item of items) {
		const cat = normalizeCategoryValue(item);
		if (cat === dominantCategory) {
			dominantPool.push(item);
		} else {
			explorePool.push(item);
		}
	}

	const explorationEvery = Math.max(3, Math.round(1 / Math.max(0.05, explorationRate)));
	const output = [];
	let lastAuthorId = "";
	let lastCategory = "";
	let authorRun = 0;
	let categoryRun = 0;

	function authorIdFor(item) {
		if (item.feed_type === "buyer_request") {
			return item.buyer_id || "";
		}
		if (item.feed_type === "company_product") {
			return item.company_id || "";
		}
		return "";
	}

	function canPick(item) {
		const authorId = authorIdFor(item);
		const category = normalizeCategoryValue(item);

		const nextAuthorRun = authorId && authorId === lastAuthorId ? authorRun + 1 : 1;
		const nextCategoryRun = category && category === lastCategory ? categoryRun + 1 : 1;

		if (authorId && nextAuthorRun > maxSameAuthorRun) {
			return false;
		}
		if (category && nextCategoryRun > maxSameCategoryRun) {
			return false;
		}
		return true;
	}

	function pickFrom(poolPrimary, poolSecondary) {
		const scanLimit = 30;
		const tryPools = [poolPrimary, poolSecondary];
		for (const pool of tryPools) {
			if (pool.length === 0) {
				continue;
			}
			const maxScan = Math.min(scanLimit, pool.length);
			for (let i = 0; i < maxScan; i++) {
				const candidate = pool[i];
				if (!candidate) {
					continue;
				}
				if (!canPick(candidate)) {
					continue;
				}
				pool.splice(i, 1);
				return candidate;
			}
		}

		const fallback = poolPrimary.shift() || poolSecondary.shift() || null;
		return fallback;
	}

	while (dominantPool.length > 0 || explorePool.length > 0) {
		const step = output.length;
		const shouldExplore =
			explorePool.length > 0 && step % explorationEvery === explorationEvery - 1;
		const chosen = shouldExplore
			? pickFrom(explorePool, dominantPool)
			: pickFrom(dominantPool, explorePool);

		if (!chosen) {
			break;
		}

		const authorId = authorIdFor(chosen);
		const category = normalizeCategoryValue(chosen);

		if (authorId && authorId === lastAuthorId) {
			authorRun += 1;
		} else {
			lastAuthorId = authorId;
			authorRun = 1;
		}

		if (category && category === lastCategory) {
			categoryRun += 1;
		} else {
			lastCategory = category;
			categoryRun = 1;
		}

		output.push(chosen);
	}

	return output.length > 0 ? output : items;
}

const MAX_FEED_AGE_DAYS = 90;

// HyperCache Phase 5 — feed engine stabilization.
// Per-request fan-out guards: bound the enrichment `in` queries and the
// link-preview batch so a single feed request cannot fan out unboundedly.
// These caps are generous on purpose — they only bite on pathological
// catalog sizes and never change the ranking formula.
const MAX_FEED_FANOUT_IDS = 5000;
const MAX_FEED_LINK_PREVIEW_URLS = 200;

// Stable opaque cursor (cursor_v2): base64url of { s, t, id } where
// s = ranking_score of the last item on the page,
// t = created_at epoch ms of that item,
// id = id of that item.
// The feed sort is the total order (ranking_score desc, created_at desc,
// id asc), so the keyset filter below always selects a suffix of the
// sorted list. Integer `cursor` (offset) semantics are untouched — old
// clients that never send cursor_v2 see byte-identical behavior.
function toEpochMs(value) {
	const ms = new Date(value).getTime();
	return Number.isFinite(ms) ? ms : 0;
}

function feedSortKey(item) {
	const score = Number(item?._ranking?.ranking_score);
	return {
		score: Number.isFinite(score) ? score : 0,
		createdAtMs: toEpochMs(item?.created_at),
		id: String(item?.id || ""),
	};
}

function compareFeedSortKey(a, b) {
	if (a.score !== b.score) {
		return b.score - a.score;
	}
	if (a.createdAtMs !== b.createdAtMs) {
		return b.createdAtMs - a.createdAtMs;
	}
	if (a.id === b.id) {
		return 0;
	}
	return a.id < b.id ? -1 : 1;
}

function encodeFeedCursorV2(key) {
	try {
		const payload = { s: key.score, t: key.createdAtMs, id: key.id };
		return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
	} catch {
		return null;
	}
}

function decodeFeedCursorV2(value) {
	if (typeof value !== "string" || !value || value.length > 512) {
		return null;
	}
	try {
		const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
		const score = Number(parsed?.s);
		const createdAtMs = Number(parsed?.t);
		const id = String(parsed?.id || "");
		if (!(Number.isFinite(score) && Number.isFinite(createdAtMs) && id) || id.length > 200) {
			return null;
		}
		return { score, createdAtMs, id };
	} catch {
		return null;
	}
}

// Keyset condition: keep items strictly AFTER the decoded cursor in the
// total feed order. Invalid/absent cursors never reach here (callers fall
// back to the legacy integer-offset slice).
function isFeedItemAfterKeyset(item, key) {
	const k = feedSortKey(item);
	if (k.score !== key.score) {
		return k.score < key.score;
	}
	if (k.createdAtMs !== key.createdAtMs) {
		return k.createdAtMs < key.createdAtMs;
	}
	return k.id > key.id;
}

export async function getCombinedFeed({
	unique = false,
	type = "all",
	category = "",
	cursor = 0,
	cursor_v2 = null,
	limit = 12,
	viewer = null,
}) {
	const recencyThreshold = new Date(Date.now() - MAX_FEED_AGE_DAYS * 24 * 60 * 60 * 1000);

	const [requests, products, feedPosts, orderCertMap] = await Promise.all([
		type === "products" || type === "posts"
			? []
			: listRequirements({ status: "open", createdAfter: recencyThreshold }),
		type === "requests" || type === "posts"
			? []
			: listProducts({
					category,
					viewerId: viewer?.id,
					viewerRole: viewer?.role,
					createdAfter: recencyThreshold,
				}),
		type === "requests" || type === "products"
			? []
			: listFeedPosts({ status: "published", createdAfter: recencyThreshold }),
		getOrderCertificationMap(),
	]);

	const allItemEntries = [];
	for (const r of requests) {
		allItemEntries.push({ id: r.id, authorId: r.buyer_id });
	}
	for (const p of products) {
		allItemEntries.push({ id: p.id, authorId: p.company_id });
	}
	for (const fp of feedPosts) {
		allItemEntries.push({ id: fp.id, authorId: fp.user_id });
	}

	const authorIds = [...new Set(allItemEntries.map((i) => i.authorId).filter(Boolean))];
	const itemIds = allItemEntries.map((i) => i.id);
	// Phase 5 guard: cap enrichment fan-out (generous; normal catalogs unaffected).
	const cappedAuthorIds = authorIds.slice(0, MAX_FEED_FANOUT_IDS);
	const cappedItemIds = itemIds.slice(0, MAX_FEED_FANOUT_IDS);

	const now = new Date();
	const [users, socialInteractions, boosts, ratingsStore] = await Promise.all([
		cappedAuthorIds.length > 0
			? prisma.user.findMany({
					where: { id: { in: cappedAuthorIds } },
					select: {
						id: true,
						name: true,
						email: true,
						verified: true,
						role: true,
						profile: true,
						subscription_status: true,
						created_at: true,
					},
				})
			: [],
		itemIds.length > 0
			? prisma.socialInteraction.findMany({
					where: { entity_id: { in: cappedItemIds } },
				})
			: [],
		prisma.boost.findMany({
			where: {
				scope: "feed",
				status: "active",
				starts_at: { lte: now },
				ends_at: { gte: now },
			},
		}),
		// Only the authors on this page: the rating table grows with every
		// review, and reading all of it for every feed request does not scale.
		cappedAuthorIds.length > 0
			? prisma.rating.findMany({
					where: { profile_key: { in: cappedAuthorIds.map((id) => `user:${id}`) } },
					select: { profile_key: true, score: true },
				})
			: [],
	]);
	const usersById = new Map(users.map((u) => [u.id, u]));

	const paidBoostByUser = buildPaidBoostMap(Array.isArray(boosts) ? boosts : []);
	const ratingByUser = buildRatingMap(ratingsStore);
	const viewerVerified = Boolean(viewer?.verified);

	const discussionByRequest = new Map();
	if (Array.isArray(socialInteractions)) {
		for (const row of socialInteractions) {
			if (row.interaction_type !== "comment") {
				continue;
			}
			if (String(row.entity_type || "") !== "buyer_request") {
				continue;
			}
			const requestId = String(row.entity_id || "");
			if (!requestId) {
				continue;
			}
			const ts = new Date(row.created_at || "").getTime();
			if (!Number.isFinite(ts)) {
				continue;
			}
			const prev = discussionByRequest.get(requestId) || 0;
			if (ts > prev) {
				discussionByRequest.set(requestId, ts);
			}
		}
	}

	const combined = [
		...requests.map((r) => ({ ...r, feed_type: "buyer_request", icon: "💼" })),
		...products.map((p) => ({
			...p,
			feed_type: "company_product",
			icon: "🏭",
		})),
		...feedPosts.map((post) => ({
			...post,
			feed_type: "user_feed_post",
			icon: "📝",
		})),
	];

	const feedPostLinks = combined
		.filter((i) => i.feed_type === "user_feed_post" && Array.isArray(i.links))
		.flatMap((i) => i.links)
		.slice(0, MAX_FEED_LINK_PREVIEW_URLS);
	if (feedPostLinks.length > 0) {
		const previews = await batchGetLinkPreviews(feedPostLinks);
		const previewMap = new Map(previews.map((p) => [p.url, p]));
		for (const item of combined) {
			if (item.feed_type === "user_feed_post" && Array.isArray(item.links)) {
				item.link_previews = item.links.map((url) => previewMap.get(url) || null).filter(Boolean);
			}
		}
	}

	const itemsByAuthor = combined.reduce((acc, item) => {
		const authorId = getAuthorId(item);
		if (!authorId) {
			return acc;
		}
		if (!acc[authorId]) {
			acc[authorId] = [];
		}
		acc[authorId].push(item);
		return acc;
	}, {});

	const ranked = combined.map((item) => {
		const authorId = getAuthorId(item);
		const author = usersById.get(authorId) || null;
		const certification = authorId ? orderCertMap.get(String(authorId)) : null;
		const profileCompleteness = computeProfileCompleteness(author);
		const authorItems = itemsByAuthor[authorId] || [];
		const activityQuality = computeActivityQuality(
			authorItems.map((authorItem) => authorItem.id),
			socialInteractions,
		);
		const antiAbuseSignals = evaluateAntiAbuseSignals(item, authorItems);
		const verifiedContact = Boolean(author?.verified);
		const avgRating = ratingByUser.get(String(authorId || "")) || null;
		const trustedSeller = verifiedContact || (Number.isFinite(avgRating) && avgRating >= 4.3);
		const accountAgeDays = getAccountAgeDays(author);
		const minAccountAgeDays = FEED_BOOST_CONFIG.minimumAccountAgeHours / 24;
		const accountAgeEligible = accountAgeDays >= minAccountAgeDays;

		const discussionTs = discussionByRequest.get(String(item.id || "")) || 0;
		const discussionActive =
			item.feed_type === "buyer_request" &&
			discussionTs &&
			Date.now() - discussionTs <= DISCUSSION_BOOST_HOURS * 60 * 60 * 1000;
		const discussionBoost = viewerVerified && discussionActive ? DISCUSSION_BOOST_MULTIPLIER : 1;
		const premiumBoostMultiplier =
			String(author?.subscription_status || "").toLowerCase() === "premium"
				? PREMIUM_FEED_BOOST_MULTIPLIER
				: 1;

		const antiAbuseEligible =
			profileCompleteness >= FEED_BOOST_CONFIG.minProfileCompleteness &&
			verifiedContact &&
			activityQuality >= FEED_BOOST_CONFIG.minActivityQuality &&
			accountAgeEligible &&
			antiAbuseSignals.antiAbusePassed;

		const ageBoostMultiplier = antiAbuseEligible ? getAgeBoostMultiplier(accountAgeDays) : 1;
		const guardedAgeBoost = !trustedSeller && ageBoostMultiplier > 1.2 ? 1.2 : ageBoostMultiplier;
		const paidBoostMultiplier = paidBoostByUser.get(String(authorId || "")) || 1;
		const trustMultiplier = trustedSeller ? 1.06 : 1;
		const combinedMultiplier = Math.max(
			1,
			guardedAgeBoost *
				paidBoostMultiplier *
				trustMultiplier *
				discussionBoost *
				premiumBoostMultiplier,
		);
		const boostActive = combinedMultiplier > 1;
		const recencyScore = calculateRecencyScore(item.created_at);
		const rankingScore = recencyScore * combinedMultiplier;

		return {
			...item,
			author: {
				id: authorId,
				// Company name first: the feed is a marketplace surface, never a
				// directory of personal accounts.
				name:
					author?.profile?.organization_name ||
					item.company_name ||
					item.organization_name ||
					author?.name ||
					item.name ||
					"Unknown",
				company_name:
					author?.profile?.organization_name ||
					item.company_name ||
					item.organization_name ||
					"",
				verified: Boolean(author?.verified),
				role: String(author?.role || ""),
				avatar_url:
					author?.profile?.profile_image ||
					author?.profile?.avatar_url ||
					author?.profile?.avatar ||
					author?.avatar_url ||
					"",
				accountType: String(author?.role || "")
					.replace(/_/g, " ")
					.replace(/\b\w/g, (c) => c.toUpperCase()),
				rolePath: String(author?.role || "").replace(/_/g, "-"),
			},
			order_certification_status: certification?.status || "",
			discussion_active: discussionActive && viewerVerified,
			_ranking: {
				ranking_score: rankingScore,
			},
			feed_metadata: {
				boost_active: boostActive,
				paid_boost_active: paidBoostMultiplier > 1,
				premium_boost_active: premiumBoostMultiplier > 1,
				ranking_components: {
					recency_score: roundNumber(recencyScore),
					account_age_days: roundNumber(accountAgeDays),
					boost_multiplier: roundNumber(combinedMultiplier),
					paid_boost_multiplier: roundNumber(paidBoostMultiplier),
					premium_boost_multiplier: roundNumber(premiumBoostMultiplier),
					age_boost_multiplier: roundNumber(guardedAgeBoost),
					discussion_boost_multiplier: roundNumber(discussionBoost),
					trust_multiplier: roundNumber(trustMultiplier),
					avg_rating: avgRating === null ? null : roundNumber(avgRating),
					profile_completeness: roundNumber(clamp01(profileCompleteness)),
					verified_contact: verifiedContact,
					activity_quality_score: roundNumber(clamp01(activityQuality)),
					account_age_eligible: accountAgeEligible,
					anti_abuse_eligible: antiAbuseEligible,
					suspicious_repeated_posting: antiAbuseSignals.suspiciousRepeatedPosting,
					posts_in_rapid_window: antiAbuseSignals.postsInRapidWindow,
					low_quality_spam: antiAbuseSignals.lowQualitySpam,
					spam_keyword_hits: antiAbuseSignals.keywordHits,
					duplicate_content_ratio: roundNumber(clamp01(antiAbuseSignals.duplicateRatio)),
					word_variety_ratio: roundNumber(clamp01(antiAbuseSignals.wordVarietyRatio)),
				},
			},
		};
	});

	// Total order: ranking_score desc, created_at desc, id asc. The score
	// comparison is unchanged from before; the created_at/id tiebreakers
	// only make exact-score ties deterministic (required for keyset
	// correctness). Offset pagination works identically under any order.
	const sortedItems = ranked.sort((a, b) => compareFeedSortKey(feedSortKey(a), feedSortKey(b)));

	const diversifyOptions = {
		explorationRate: 0.2,
		maxSameAuthorRun: 1,
		maxSameCategoryRun: 2,
	};

	const boostActiveCount = sortedItems.filter((item) => item.feed_metadata?.boost_active).length;
	const totalItemCount = sortedItems.length;
	const newProfileBoostedCount = sortedItems.filter((item) => {
		const multiplier = item.feed_metadata?.ranking_components?.age_boost_multiplier || 1;
		return Number(multiplier) > 1;
	}).length;
	const safeCursor = Math.max(0, Math.floor(Number(cursor || 0)));
	const safeLimit = Math.min(50, Math.max(1, Math.floor(Number(limit || 12))));

	// Phase 5: stable opaque cursor. When a valid cursor_v2 is present it
	// takes precedence and the integer offset is ignored; otherwise the
	// legacy offset slice below runs exactly as before.
	const keyset = decodeFeedCursorV2(cursor_v2);
	let orderedPage;
	let nextCursor;
	let nextCursorV2;
	if (keyset) {
		const tail = sortedItems.filter((item) => isFeedItemAfterKeyset(item, keyset));
		const ordered = unique ? diversifyFeedItems(tail, diversifyOptions) : tail;
		orderedPage = ordered.slice(0, safeLimit);
		const hasMore = ordered.length > safeLimit;
		// No meaningful integer offset on the keyset path; old clients never
		// send cursor_v2 so they never observe this branch.
		nextCursor = null;
		const last = orderedPage[orderedPage.length - 1];
		nextCursorV2 = hasMore && last ? encodeFeedCursorV2(feedSortKey(last)) : null;
	} else {
		const ordered = unique ? diversifyFeedItems(sortedItems, diversifyOptions) : sortedItems;
		orderedPage = ordered.slice(safeCursor, safeCursor + safeLimit);
		nextCursor = safeCursor + safeLimit < totalItemCount ? safeCursor + safeLimit : null;
		const last = orderedPage[orderedPage.length - 1];
		nextCursorV2 = nextCursor != null && last ? encodeFeedCursorV2(feedSortKey(last)) : null;
	}
	const pageItems = orderedPage.map((item) => {
		const next = { ...item };
		next._ranking = undefined;
		return next;
	});

	logInfo("Feed ranking components", {
		total_items: totalItemCount,
		boosted_items: boostActiveCount,
		boost_config: FEED_BOOST_CONFIG,
		ranking_snapshot: sortedItems.slice(0, 20).map((item) => ({
			item_id: item.id,
			feed_type: item.feed_type,
			author_id: getAuthorId(item),
			created_at: item.created_at,
			boost_active: item.feed_metadata?.boost_active,
			...item.feed_metadata?.ranking_components,
		})),
	});

	if (newProfileBoostedCount > 0) {
		await trackEvent({
			type: "new_profile_boost_impressions",
			actor_id: null,
			entity_id: null,
			metadata: { count: newProfileBoostedCount, total: totalItemCount },
		});
	}

	return {
		tags: CATEGORIES,
		unique,
		cursor: safeCursor,
		next_cursor: nextCursor,
		next_cursor_v2: nextCursorV2,
		metadata: {
			boost: {
				active_item_count: boostActiveCount,
				total_item_count: totalItemCount,
				config: FEED_BOOST_CONFIG,
			},
		},
		items: pageItems,
	};
}

export async function getShareablePost(entityType, entityId) {
	const typeMap = {
		buyer_request: "buyer_request",
		company_product: "company_product",
		product: "company_product",
		feed_post: "user_feed_post",
		post: "user_feed_post",
		user_feed_post: "user_feed_post",
	};
	const feedType = typeMap[entityType];
	if (!feedType) return null;

	let raw = null;
	let authorId = "";

	if (feedType === "buyer_request") {
		raw = await prisma.requirement.findUnique({ where: { id: entityId } });
		if (raw && !["active", "open"].includes(raw.status)) raw = null;
		authorId = raw?.buyer_id || "";
	} else if (feedType === "company_product") {
		raw = await prisma.product.findUnique({ where: { id: entityId } });
		if (raw && !["active", "open", "published"].includes(raw.status)) raw = null;
		authorId = raw?.company_id || "";
	} else if (feedType === "user_feed_post") {
		raw = await prisma.feedPost.findUnique({ where: { id: entityId } });
		if (raw && raw.status !== "published") raw = null;
		authorId = raw?.user_id || "";
	}

	if (!raw) return null;

	const author = authorId
		? await prisma.user.findUnique({
				where: { id: authorId },
			})
		: null;

	const authorProfile = author?.profile || {};
	const profile =
		typeof authorProfile === "string"
			? (() => {
					try {
						return JSON.parse(authorProfile);
					} catch {
						return {};
					}
				})()
			: authorProfile;

	return {
		...raw,
		feed_type: feedType,
		entityType: feedType,
		author: {
			id: authorId,
			name:
				profile?.organization_name ||
				author?.name ||
				raw.company_name ||
				raw.organization_name ||
				raw.name ||
				"Unknown",
			company_name: profile?.organization_name || raw.company_name || raw.organization_name || "",
			verified: Boolean(author?.verified),
			role: String(author?.role || ""),
			avatar_url:
				profile?.profile_image ||
				profile?.avatar_url ||
				profile?.avatar ||
				author?.avatar_url ||
				"",
			accountType: String(author?.role || "")
				.replace(/_/g, " ")
				.replace(/\b\w/g, (c) => c.toUpperCase()),
		},
	};
}
