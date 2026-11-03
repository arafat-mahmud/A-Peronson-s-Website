import crypto from "node:crypto";
import { appendAuditLog } from "../utils/auditStore.js";
import { isCrmSqlEnabled, readLegacyJson } from "../utils/crmFallbackStore.js";
import {
	canViewAnalytics,
	canViewAnalyticsAdmin,
	canViewAnalyticsDashboard,
	forbiddenError,
	scopeRecordsForUser,
} from "../utils/permissions.js";
import { createBatchWriter } from "../utils/batchWriter.js";
import { logWarn } from "../utils/logger.js";
import prisma from "../utils/prisma.js";
import { getAdminConfig } from "./adminConfigService.js";
import {
	assertNoUnauthorizedAnalyticsJoin,
	checkAnalyticsAccessPolicy,
	getAnalyticsGovernanceConfig,
	sanitizePlatformAnalytics,
} from "./analyticsGovernanceService.js";
import { getPlanForUser } from "./entitlementService.js";
import { getOrderCertificationSummary } from "./orderCertificationService.js";

const FILE = "analytics.json";
const SEARCH_TREND_MIN_EVENTS = 25;
const USE_SQL_CRM = isCrmSqlEnabled();

async function getSearchMinEvents() {
	try {
		const config = await getAdminConfig();
		const raw = Number(config?.analytics?.search_min_events);
		return Number.isFinite(raw) && raw > 0 ? raw : SEARCH_TREND_MIN_EVENTS;
	} catch {
		return SEARCH_TREND_MIN_EVENTS;
	}
}

// Analytics events are written behind the request, in batches.
//
// A page view sends several events, and each one used to hold a database
// connection for a full round trip (~250 ms to production's database) - with
// a small pool, page views queued behind their own analytics. Events are now
// buffered and written with one createMany per batch. A crash can lose at
// most one flush interval of analytics; nothing else depends on these rows.
function eventFlushIntervalMs() {
	const raw = process.env.ANALYTICS_FLUSH_INTERVAL_MS;
	if (raw !== undefined && raw !== "" && Number.isFinite(Number(raw)) && Number(raw) >= 0) {
		return Number(raw);
	}
	// Tests write straight through unless they ask for batching.
	return process.env.NODE_ENV === "test" ? 0 : 1000;
}

const analyticsWriter = createBatchWriter({
	write: (rows) => prisma.analyticsEvent.createMany({ data: rows }),
	onError: (error, size) => logWarn("analytics_flush_failed", { code: error?.code, size }),
	intervalMs: Math.max(1, eventFlushIntervalMs()),
});

export function flushAnalyticsEvents() {
	return analyticsWriter.flush();
}

export async function trackEvent({ type, actor_id, entity_id, metadata = {} }) {
	if (!USE_SQL_CRM) {
		// Legacy fallback is intentionally read-only during the verification window.
		return;
	}
	const row = {
		id: crypto.randomUUID(),
		type,
		actor_id: actor_id || null,
		entity_id: entity_id || null,
		metadata,
		created_at: new Date(),
	};
	if (!eventFlushIntervalMs()) {
		await prisma.analyticsEvent.create({ data: row });
		return;
	}
	analyticsWriter.add(row);
}

function ensureAnalyticsAccess(user) {
	if (canViewAnalytics(user)) {
		return;
	}
	throw forbiddenError();
}

function ensureAnalyticsDashboardAccess(user) {
	if (canViewAnalyticsDashboard(user)) {
		return;
	}
	throw forbiddenError();
}

function ensureAnalyticsAdminAccess(user) {
	if (canViewAnalyticsAdmin(user)) {
		return;
	}
	throw forbiddenError();
}

function scopeAnalyticsRecords(user, records, idFields) {
	// Main accounts (buying house / factory) can view the org-level dashboard.
	// In this MVP data model, we treat them as org managers (unscoped) to avoid "all zeros".
	const role = String(user?.role || "").toLowerCase();
	if (role === "buying_house" || role === "factory" || role === "owner" || role === "admin") {
		return records;
	}

	return scopeRecordsForUser(user, records, {
		idFields,
		assignmentFields: ["assigned_agent_id", "agent_id"],
	});
}

export async function getAnalyticsSummary(user) {
	ensureAnalyticsAccess(user);
	const all = USE_SQL_CRM ? await prisma.analyticsEvent.findMany() : await readLegacyJson(FILE);
	const scoped = scopeAnalyticsRecords(user, all, ["actor_id", "entity_id"]);
	const byType = scoped.reduce((acc, e) => {
		acc[e.type] = (acc[e.type] || 0) + 1;
		return acc;
	}, {});
	return { total_events: scoped.length, by_type: byType };
}

function monthKey(value) {
	const d = new Date(value || "");
	if (Number.isNaN(d.getTime())) {
		return null;
	}
	return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function toMonthlySeries(items, dateKey) {
	const bucket = items.reduce((acc, item) => {
		const key = monthKey(item[dateKey]);
		if (!key) {
			return acc;
		}
		acc[key] = (acc[key] || 0) + 1;
		return acc;
	}, {});

	return Object.entries(bucket)
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([month, count]) => ({ month, count }));
}

function formatHours(avgHours) {
	const h = Number(avgHours) || 0;
	if (!Number.isFinite(h) || h <= 0) {
		return "--";
	}
	if (h < 1) {
		return `${Math.round(h * 60)}m`;
	}
	if (h < 24) {
		return `${Math.round(h)}h`;
	}
	return `${Math.round(h / 24)}d`;
}

function calcPercent(n, d) {
	const dn = Number(d) || 0;
	if (!dn) {
		return 0;
	}
	return Math.round((Number(n || 0) / dn) * 100);
}

function safeNumber(value) {
	const n = Number(String(value || "").replace(/[^\d.]/g, ""));
	return Number.isFinite(n) ? n : null;
}

function bucketNormalizedPrice(value) {
	const n = Number(value);
	if (!Number.isFinite(n) || n < 0) {
		return "unknown";
	}
	if (n <= 5) {
		return "0-5";
	}
	if (n <= 10) {
		return "5-10";
	}
	if (n <= 20) {
		return "10-20";
	}
	if (n <= 50) {
		return "20-50";
	}
	return "50+";
}

function normalizedPriceForBucket(row = {}) {
	const min = Number(row?.priceBaseMin);
	const max = Number(row?.priceBaseMax);
	if (Number.isFinite(min)) {
		return min;
	}
	if (Number.isFinite(max)) {
		return max;
	}
	const legacy = Number(row?.priceNormalizedBase);
	return Number.isFinite(legacy) ? legacy : null;
}

function parseMatchId(matchId = "") {
	const parts = String(matchId || "").split(":");
	if (parts.length !== 2) {
		return null;
	}
	return { requirementId: parts[0], supplierId: parts[1] };
}

function computeResponseTimesForOrg(messages = [], orgMemberIds = new Set()) {
	const messagesByMatch = new Map();

	for (const msg of messages) {
		const matchId = String(msg?.match_id || "");
		if (!matchId || matchId.startsWith("friend:")) {
			continue;
		}
		if (!messagesByMatch.has(matchId)) {
			messagesByMatch.set(matchId, []);
		}
		messagesByMatch.get(matchId).push(msg);
	}

	const responseTimes = [];
	for (const msgs of messagesByMatch.values()) {
		const sorted = msgs
			.slice()
			.sort((a, b) => String(a.timestamp || "").localeCompare(String(b.timestamp || "")));
		const firstInbound = sorted.find((m) => !orgMemberIds.has(String(m.sender_id || "")));
		if (!firstInbound?.timestamp) {
			continue;
		}
		const inboundAt = new Date(firstInbound.timestamp).getTime();
		if (!Number.isFinite(inboundAt)) {
			continue;
		}

		const firstOutbound = sorted.find(
			(m) =>
				orgMemberIds.has(String(m.sender_id || "")) && new Date(m.timestamp).getTime() >= inboundAt,
		);
		if (!firstOutbound?.timestamp) {
			continue;
		}
		const outboundAt = new Date(firstOutbound.timestamp).getTime();
		if (!Number.isFinite(outboundAt)) {
			continue;
		}

		responseTimes.push((outboundAt - inboundAt) / (1000 * 60 * 60));
	}

	const avg =
		responseTimes.length > 0 ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length : 0;
	return { avg_hours: avg, formatted: formatHours(avg) };
}

export async function getDashboardAnalytics(user) {
	ensureAnalyticsDashboardAccess(user);
	const days90 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

	let events = [];
	let requirements = [];
	let messages = [];
	let matches = [];
	let documents = [];
	let users = [];
	let products = [];
	let ratings = [];

	try {
		[events, requirements, messages, matches, documents, users, products, ratings] =
			await Promise.all([
				prisma.analyticsEvent.findMany({
					where: { created_at: { gte: days90 } },
					take: 2000,
				}),
				prisma.requirement.findMany({
					where: { created_at: { gte: days90 } },
					take: 500,
				}),
				prisma.message.findMany({ take: 1000 }),
				prisma.match.findMany({ take: 500 }),
				prisma.document.findMany({ take: 500 }),
				prisma.user.findMany({ take: 500 }),
				prisma.product.findMany({ take: 500 }),
				prisma.rating.findMany({ take: 500 }),
			]);
	} catch {
		// Partial failure is acceptable — return whatever data loaded
	}

	const scopedEvents = scopeAnalyticsRecords(user, events, ["actor_id", "entity_id"]);
	const scopedRequirements = scopeAnalyticsRecords(user, requirements, [
		"buyer_id",
		"requester_id",
	]);
	const scopedMessages = scopeAnalyticsRecords(user, messages, ["sender_id", "receiver_id"]);
	const scopedMatches = scopeAnalyticsRecords(user, matches, ["buyer_id", "factory_id"]);
	const scopedDocuments = scopeAnalyticsRecords(user, documents, [
		"uploaded_by",
		"buyer_id",
		"factory_id",
		"entity_id",
	]);
	const scopedProducts = scopeAnalyticsRecords(user, products, [
		"company_id",
		"uploaded_by",
		"owner_id",
	]);

	const uniqueActiveChats = new Set(scopedMessages.map((m) => m.match_id).filter(Boolean)).size;
	const connectedPartners = new Set(scopedMatches.map((m) => m.factory_id).filter(Boolean)).size;
	const contractDocs = scopedDocuments.filter(
		(d) =>
			d.entity_type === "contract" ||
			String(d.type || "")
				.toLowerCase()
				.includes("contract"),
	);
	const byType = scopedEvents.reduce((acc, e) => {
		acc[e.type] = (acc[e.type] || 0) + 1;
		return acc;
	}, {});

	const interactionSummary = (() => {
		const pageViews = scopedEvents.filter((e) => e.type === "page_view");
		const clicks = scopedEvents.filter((e) => e.type === "click");
		const sessionEvents = scopedEvents.filter(
			(e) => e.type === "session_end" || e.type === "page_duration",
		);
		const durations = sessionEvents
			.map((e) => {
				const seconds = Number(e?.metadata?.duration_seconds);
				if (Number.isFinite(seconds) && seconds > 0) {
					return seconds;
				}
				const ms = Number(e?.metadata?.duration_ms);
				if (Number.isFinite(ms) && ms > 0) {
					return Math.round(ms / 1000);
				}
				return 0;
			})
			.filter((v) => v > 0);
		const avgSessionSeconds =
			durations.length > 0
				? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
				: 0;

		const viewsByPage = pageViews.reduce((acc, e) => {
			const key = String(
				e.entity_id || e?.metadata?.entity_id || e?.metadata?.entity_type || "unknown",
			);
			acc[key] = (acc[key] || 0) + 1;
			return acc;
		}, {});

		const topPages = Object.entries(viewsByPage)
			.sort((a, b) => b[1] - a[1])
			.slice(0, 5)
			.map(([page, count]) => ({ page, count }));

		return {
			total_page_views: pageViews.length,
			total_clicks: clicks.length,
			avg_session_duration_seconds: avgSessionSeconds,
			top_pages: topPages,
		};
	})();

	const usersById = new Map((Array.isArray(users) ? users : []).map((u) => [String(u.id), u]));

	function isRecent(iso, days = 30) {
		const t = new Date(String(iso || "")).getTime();
		if (!Number.isFinite(t)) {
			return false;
		}
		return t >= Date.now() - days * 24 * 60 * 60 * 1000;
	}

	function percent(n, d) {
		const dn = Number(d) || 0;
		if (!dn) {
			return 0;
		}
		return Math.round((Number(n || 0) / dn) * 100);
	}

	// --- Top metrics (project.md) ---
	const uniqueRequirementIdsWithMatch = new Set(
		scopedMatches.map((m) => String(m.requirement_id || "")).filter(Boolean),
	).size;
	const buyerSupplierMatchRate = percent(uniqueRequirementIdsWithMatch, scopedRequirements.length);

	const buyersActive = new Set();
	const suppliersActive = new Set();

	scopedRequirements
		.filter((r) => isRecent(r.created_at))
		.forEach((r) => {
			if (r?.buyer_id) {
				buyersActive.add(String(r.buyer_id));
			}
		});
	scopedProducts
		.filter((p) => isRecent(p.created_at))
		.forEach((p) => {
			if (p?.company_id) {
				suppliersActive.add(String(p.company_id));
			}
		});
	scopedMessages
		.filter((m) => isRecent(m.timestamp))
		.forEach((m) => {
			const sender = usersById.get(String(m.sender_id || ""));
			if (!sender) {
				return;
			}
			const role = String(sender.role || "").toLowerCase();
			if (role === "buyer") {
				buyersActive.add(String(sender.id));
			}
			if (role === "factory" || role === "buying_house") {
				suppliersActive.add(String(sender.id));
			}
		});

	const activeBuyerSupplierRatio =
		suppliersActive.size > 0
			? `${buyersActive.size}:${suppliersActive.size}`
			: `${buyersActive.size}:0`;

	const requestToContractConversion = percent(contractDocs.length, scopedRequirements.length);

	// Time to first qualified response: first verified supplier message after a buyer request.
	const firstResponseHours = [];
	const requirementsById = new Map(scopedRequirements.map((r) => [String(r.id), r]));
	const messagesByMatch = scopedMessages.reduce((acc, m) => {
		const id = String(m.match_id || "");
		if (!id) {
			return acc;
		}
		if (!acc.has(id)) {
			acc.set(id, []);
		}
		acc.get(id).push(m);
		return acc;
	}, new Map());

	for (const [matchId, msgs] of messagesByMatch.entries()) {
		const parts = String(matchId).split(":");
		if (parts.length !== 2) {
			continue;
		}
		const requirementId = parts[0];
		const factoryId = parts[1];
		const reqRow = requirementsById.get(String(requirementId));
		if (!reqRow?.created_at) {
			continue;
		}
		const buyerId = String(reqRow.buyer_id || "");
		const createdAt = new Date(reqRow.created_at).getTime();
		if (!Number.isFinite(createdAt)) {
			continue;
		}

		const sorted = msgs
			.slice()
			.sort((a, b) => String(a.timestamp || "").localeCompare(String(b.timestamp || "")));
		const firstQualified = sorted.find((m) => {
			const senderId = String(m.sender_id || "");
			if (!senderId) {
				return false;
			}
			if (senderId === buyerId) {
				return false;
			}
			if (senderId !== String(factoryId)) {
				return false;
			}
			const sender = usersById.get(senderId);
			return Boolean(sender?.verified);
		});
		if (!firstQualified?.timestamp) {
			continue;
		}
		const firstAt = new Date(firstQualified.timestamp).getTime();
		if (!Number.isFinite(firstAt) || firstAt < createdAt) {
			continue;
		}
		firstResponseHours.push((firstAt - createdAt) / (1000 * 60 * 60));
	}

	const avgFirstResponseHours =
		firstResponseHours.length > 0
			? firstResponseHours.reduce((a, b) => a + b, 0) / firstResponseHours.length
			: 0;

	const repeatBuyerRate = (() => {
		const counts = scopedRequirements.reduce((acc, r) => {
			const bid = String(r.buyer_id || "");
			if (!bid) {
				return acc;
			}
			acc[bid] = (acc[bid] || 0) + 1;
			return acc;
		}, {});
		const buyers = Object.keys(counts);
		const repeat = buyers.filter((b) => counts[b] >= 2).length;
		return percent(repeat, buyers.length);
	})();

	// Buying house metrics (project.md) derived from same data model (MVP approximations).
	const demandTrend = scopedRequirements.reduce((acc, r) => {
		const k = String(r.category || r.product || "Other");
		acc[k] = (acc[k] || 0) + 1;
		return acc;
	}, {});

	const topRequested = Object.entries(demandTrend)
		.sort((a, b) => b[1] - a[1])
		.slice(0, 5)
		.map(([label, count]) => ({ label, count }));

	const leadDealConversion = percent(contractDocs.length, uniqueActiveChats || 0);

	const avgRating = (() => {
		try {
			const rows = Array.isArray(ratings) ? ratings : [];
			const scoped = scopeAnalyticsRecords(user, rows, [
				"target_profile_key",
				"author_id",
				"from_user_id",
				"target_user_id",
			]);
			const values = scoped
				.map((r) => Number(r.rating || r.stars || 0))
				.filter((n) => Number.isFinite(n) && n > 0);
			if (values.length === 0) {
				return 0;
			}
			return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
		} catch {
			return 0;
		}
	})();

	const trustedDealScore = Math.max(0, Math.round(contractDocs.length * 10 + avgRating * 5));

	const role = String(user?.role || "").toLowerCase();
	const top_metrics = (() => {
		// Marketplace-owner view (owner/admin): use marketplace success metrics.
		if (role === "owner" || role === "admin") {
			return [
				{
					key: "match_success_rate",
					label: "Buyer -> Supplier Match Success",
					value: `${buyerSupplierMatchRate}%`,
					hint: "Matched requests / total requests",
				},
				{
					key: "active_ratio",
					label: "Active Buyer : Supplier Ratio",
					value: activeBuyerSupplierRatio,
					hint: "30-day active users",
				},
				{
					key: "request_to_contract",
					label: "Request -> Contract Conversion",
					value: `${requestToContractConversion}%`,
					hint: "Contracts / buyer requests",
				},
				{
					key: "first_response",
					label: "Time to First Qualified Response",
					value: formatHours(avgFirstResponseHours),
					hint: "Verified supplier response speed",
				},
				{
					key: "repeat_buyer",
					label: "Repeat Buyer Rate",
					value: `${repeatBuyerRate}%`,
					hint: "Buyers with 2+ requests",
				},
			];
		}

		// Organization view (buying_house/factory): use the 5 metrics Shaun listed for enterprise analytics.
		if (role === "buying_house" || role === "factory") {
			return [
				{
					key: "request_match_rate",
					label: "Buyer Request Match Rate",
					value: `${buyerSupplierMatchRate}%`,
					hint: "Matched requests / total requests",
				},
				{
					key: "lead_deal",
					label: "Lead -> Deal Conversion",
					value: `${leadDealConversion}%`,
					hint: "Contracts / active chats",
				},
				{
					key: "response_speed",
					label: "Factory Response Speed",
					value: formatHours(avgFirstResponseHours),
					hint: "Avg first verified reply",
				},
				{
					key: "demand_trend",
					label: "Buyer Demand Trend",
					value: topRequested.map((x) => x.label).join(", ") || "-",
					hint: "Top requested categories",
				},
				{
					key: "trusted_score",
					label: "Trusted Deal Score",
					value: String(trustedDealScore),
					hint: "Contracts + ratings (MVP)",
				},
			];
		}

		// Agents: show limited metrics (permission gated elsewhere).
		return [
			{
				key: "assigned_requests",
				label: "Open Buyer Requests",
				value: String(scopedRequirements.filter((r) => r.status === "open").length),
				hint: "Visible within your scope",
			},
			{
				key: "active_chats",
				label: "Active Chats",
				value: String(uniqueActiveChats),
				hint: "Threads with messages",
			},
			{
				key: "contracts",
				label: "Contracts",
				value: String(contractDocs.length),
				hint: "Contracts in your scope",
			},
			{
				key: "first_response",
				label: "Avg First Response",
				value: formatHours(avgFirstResponseHours),
				hint: "Within your scope",
			},
			{
				key: "demand_trend",
				label: "Demand Trend",
				value: topRequested.map((x) => x.label).join(", ") || "-",
				hint: "Marketplace trend (MVP)",
			},
		];
	})();

	return {
		totals: {
			buyer_requests: scopedRequirements.length,
			open_buyer_requests: scopedRequirements.filter((r) => r.status === "open").length,
			chats: uniqueActiveChats,
			messages: scopedMessages.length,
			partner_network: connectedPartners,
			contracts: contractDocs.length,
			documents: scopedDocuments.length,
			factories: users.filter((u) => u.role === "factory").length,
		},
		top_metrics,
		analytics_events: {
			total: scopedEvents.length,
			by_type: byType,
		},
		interaction_summary: interactionSummary,
		series: {
			buyer_requests: toMonthlySeries(scopedRequirements, "created_at"),
			chats: toMonthlySeries(scopedMessages, "timestamp"),
			documents: toMonthlySeries(scopedDocuments, "created_at"),
		},
	};
}

export async function getCompanyAnalytics(user) {
	ensureAnalyticsDashboardAccess(user);
	const plan = await getPlanForUser(user);
	const days90 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

	let events = [];
	let products = [];
	let productViews = [];
	let messages = [];
	let documents = [];
	let users = [];
	let leads = [];
	let requirements = [];

	try {
		[events, products, productViews, messages, documents, users, leads, requirements] =
			await Promise.all([
				prisma.analyticsEvent.findMany({
					where: { created_at: { gte: days90 } },
					take: 2000,
				}),
				prisma.product.findMany({ take: 500 }),
				prisma.productView.findMany({
					where: { created_at: { gte: days90 } },
					take: 1000,
				}),
				prisma.message.findMany({ take: 1000 }),
				prisma.document.findMany({ take: 500 }),
				prisma.user.findMany({ take: 500 }),
				prisma.lead.findMany({ take: 500 }),
				prisma.requirement.findMany({
					where: { created_at: { gte: days90 } },
					take: 500,
				}),
			]);
	} catch {
		// Partial failure is acceptable — return whatever data loaded
	}

	const actorRole = String(user?.role || "").toLowerCase();
	const orgOwnerId =
		actorRole === "agent" ? String(user?.org_owner_id || "") : String(user?.id || "");

	if (!orgOwnerId) {
		throw forbiddenError();
	}

	const orgAgents = (Array.isArray(users) ? users : []).filter(
		(u) =>
			String(u.org_owner_id || "") === orgOwnerId && String(u.role || "").toLowerCase() === "agent",
	);
	const orgMemberIds = new Set([orgOwnerId, ...orgAgents.map((u) => String(u.id))]);

	const orgProducts = (Array.isArray(products) ? products : []).filter(
		(p) => String(p.company_id || "") === orgOwnerId,
	);
	const productById = new Map(orgProducts.map((p) => [String(p.id), p]));

	const orgViews = (Array.isArray(productViews) ? productViews : []).filter((v) =>
		productById.has(String(v.product_id)),
	);

	if (plan !== "premium") {
		const profileEvents = (Array.isArray(events) ? events : []).filter(
			(e) => String(e.type || "") === "profile_view" && String(e.entity_id || "") === orgOwnerId,
		);
		return {
			limited: true,
			totals: {
				profile_visits: profileEvents.length,
				product_views: orgViews.length,
			},
			top_products: [],
			profile_visits_by_country: [],
		};
	}

	const viewsByProduct = orgViews.reduce((acc, v) => {
		const pid = String(v.product_id || "");
		if (!pid) {
			return acc;
		}
		acc[pid] = (acc[pid] || 0) + 1;
		return acc;
	}, {});

	const topProducts = Object.entries(viewsByProduct)
		.sort((a, b) => b[1] - a[1])
		.slice(0, 5)
		.map(([productId, views]) => ({
			product_id: productId,
			title: productById.get(productId)?.title || "Product",
			views,
		}));

	const profileEvents = (Array.isArray(events) ? events : []).filter(
		(e) => String(e.type || "") === "profile_view" && String(e.entity_id || "") === orgOwnerId,
	);

	const profileVisitsByCountry = profileEvents.reduce((acc, e) => {
		const country = String(e?.metadata?.country || "Unknown");
		acc[country] = (acc[country] || 0) + 1;
		return acc;
	}, {});

	const profileVisitsByCountryList = Object.entries(profileVisitsByCountry)
		.sort((a, b) => b[1] - a[1])
		.map(([country, count]) => ({ country, count }));

	const orgMessages = (Array.isArray(messages) ? messages : []).filter((m) => {
		const matchId = String(m.match_id || "");
		const parts = matchId.split(":");
		if (parts.length !== 2) {
			return false;
		}
		return String(parts[1]) === orgOwnerId;
	});

	const inboundMessages = orgMessages.filter(
		(m) => !orgMemberIds.has(String(m.sender_id || "")),
	).length;
	const conversationIds = new Set(orgMessages.map((m) => m.match_id).filter(Boolean));

	const contractDocs = (Array.isArray(documents) ? documents : [])
		.filter(
			(d) =>
				d.entity_type === "contract" ||
				String(d.type || "")
					.toLowerCase()
					.includes("contract"),
		)
		.filter(
			(d) => String(d.factory_id || "") === orgOwnerId || String(d.buyer_id || "") === orgOwnerId,
		);

	const conversionRate = calcPercent(contractDocs.length, conversationIds.size);

	const messagesByMatch = new Map();
	for (const m of orgMessages) {
		const matchId = String(m.match_id || "");
		if (!matchId) {
			continue;
		}
		if (!messagesByMatch.has(matchId)) {
			messagesByMatch.set(matchId, []);
		}
		messagesByMatch.get(matchId).push(m);
	}

	const responseTimes = [];
	for (const msgs of messagesByMatch.values()) {
		const sorted = msgs
			.slice()
			.sort((a, b) => String(a.timestamp || "").localeCompare(String(b.timestamp || "")));
		const firstInbound = sorted.find((m) => !orgMemberIds.has(String(m.sender_id || "")));
		if (!firstInbound?.timestamp) {
			continue;
		}
		const inboundAt = new Date(firstInbound.timestamp).getTime();
		if (!Number.isFinite(inboundAt)) {
			continue;
		}
		const firstOutbound = sorted.find(
			(m) =>
				orgMemberIds.has(String(m.sender_id || "")) && new Date(m.timestamp).getTime() >= inboundAt,
		);
		if (!firstOutbound?.timestamp) {
			continue;
		}
		const outboundAt = new Date(firstOutbound.timestamp).getTime();
		if (!Number.isFinite(outboundAt)) {
			continue;
		}
		responseTimes.push((outboundAt - inboundAt) / (1000 * 60 * 60));
	}

	const avgResponseHours =
		responseTimes.length > 0 ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length : 0;

	const leadRows = (Array.isArray(leads) ? leads : []).filter(
		(l) => String(l.org_owner_id || "") === orgOwnerId,
	);
	const requirementById = new Map(
		(Array.isArray(requirements) ? requirements : []).map((r) => [String(r.id), r]),
	);
	const leadSources = new Map();
	for (const lead of leadRows) {
		const sourceType = String(lead.source_type || "message");
		const sourceId = String(lead.source_id || "");
		const key = `${sourceType}:${sourceId || "unknown"}`;
		const existing = leadSources.get(key) || {
			source_type: sourceType,
			source_id: sourceId,
			label: String(lead.source_label || ""),
			count: 0,
		};
		existing.count += 1;
		if (!existing.label && lead.source_label) {
			existing.label = String(lead.source_label);
		}
		leadSources.set(key, existing);
	}

	const topLeadSources = [...leadSources.values()]
		.map((entry) => {
			let label = entry.label;
			if (!label) {
				if (entry.source_type === "product") {
					label = productById.get(String(entry.source_id))?.title || "Product";
				} else if (entry.source_type === "buyer_request") {
					const req = requirementById.get(String(entry.source_id));
					label = req?.title || req?.category || "Buyer request";
				} else if (entry.source_type === "search") {
					label = `Search ${entry.source_id || ""}`.trim();
				} else if (entry.source_type === "feed_post") {
					label = "Feed post";
				} else if (entry.source_type === "direct") {
					label = "Direct message";
				} else {
					label = entry.source_type.replace(/_/g, " ");
				}
			}
			return { ...entry, label };
		})
		.sort((a, b) => b.count - a.count)
		.slice(0, 5);

	return {
		totals: {
			profile_visits: profileEvents.length,
			product_views: orgViews.length,
			inbound_messages: inboundMessages,
			conversations: conversationIds.size,
			contracts: contractDocs.length,
			conversion_rate_pct: conversionRate,
			avg_response_hours: Math.round(avgResponseHours * 10) / 10,
			avg_response_time: formatHours(avgResponseHours),
		},
		top_products: topProducts,
		profile_visits_by_country: profileVisitsByCountryList,
		top_lead_sources: topLeadSources,
	};
}

export async function getPlatformAnalytics(user) {
	return getPlatformAnalyticsAdmin(user, {});
}

function resolvePlatformOrgScopeId(user) {
	const role = String(user?.role || "").toLowerCase();
	if (role === "agent") {
		return String(user?.org_owner_id || "");
	}
	if (role === "buyer" || role === "factory" || role === "buying_house") {
		return String(user?.id || "");
	}
	return "";
}

async function buildPlatformAnalyticsSnapshot(governance) {
	const retentionMs = Math.max(1, Number(governance.retention_days || 365)) * 24 * 60 * 60 * 1000;
	const cutoff = new Date(Date.now() - retentionMs);
	const [requirements, users, events] = await Promise.all([
		prisma.requirement.findMany({
			where: { created_at: { gte: cutoff } },
			take: 2000,
		}),
		prisma.user.findMany({ take: 1000 }),
		prisma.analyticsEvent.findMany({
			where: { created_at: { gte: cutoff } },
			take: 5000,
		}),
	]);

	const usersById = new Map((Array.isArray(users) ? users : []).map((u) => [String(u.id), u]));

	return { usersById, requirementsRows: requirements, eventRows: events };
}

function buildRawPlatformReport(requirementsRows, eventRows, usersById) {
	const byCountry = {};
	const globalCategories = {};
	const priceBuckets = {};

	for (const req of requirementsRows) {
		const buyer = usersById.get(String(req.buyer_id || ""));
		const country = String(buyer?.profile?.country || "Unknown");
		const category = String(req.category || req.product || "Other");

		if (!byCountry[country]) {
			byCountry[country] = {};
		}
		byCountry[country][category] = (byCountry[country][category] || 0) + 1;
		globalCategories[category] = (globalCategories[category] || 0) + 1;

		const bucket = bucketNormalizedPrice(normalizedPriceForBucket(req));
		priceBuckets[bucket] = (priceBuckets[bucket] || 0) + 1;
	}

	const topCategoriesByCountry = Object.entries(byCountry).map(([country, categories]) => ({
		country,
		categories: Object.entries(categories)
			.sort((a, b) => b[1] - a[1])
			.slice(0, 5)
			.map(([label, count]) => ({ label, count })),
	}));

	const topCategoriesGlobal = Object.entries(globalCategories)
		.sort((a, b) => b[1] - a[1])
		.slice(0, 8)
		.map(([label, count]) => ({ label, count }));

	const priceRangeDemand = Object.entries(priceBuckets)
		.sort((a, b) => b[1] - a[1])
		.map(([bucket, count]) => ({ bucket, count }));

	const buyerCounts = requirementsRows.reduce((acc, r) => {
		const bid = String(r.buyer_id || "");
		if (!bid) {
			return acc;
		}
		acc[bid] = (acc[bid] || 0) + 1;
		return acc;
	}, {});
	const buyers = Object.keys(buyerCounts);
	const repeatBuyers = buyers.filter((bid) => buyerCounts[bid] >= 2).length;
	const repeatBuyerRate = calcPercent(repeatBuyers, buyers.length);

	const searchEvents = eventRows.filter((e) => String(e.type || "") === "search_run");
	const searchEventCount = searchEvents.length;
	const searchByCountry = {};
	const searchGlobal = {};

	searchEvents.forEach((event) => {
		const meta = event?.metadata || {};
		const country = String(meta.country || "Unknown");
		const categories = Array.isArray(meta.categories) ? meta.categories : [];
		const rawCategory = String(meta.category_primary || categories[0] || meta.category || "");
		const category = rawCategory.trim() || "Other";
		if (!searchByCountry[country]) {
			searchByCountry[country] = {};
		}
		searchByCountry[country][category] = (searchByCountry[country][category] || 0) + 1;
		searchGlobal[category] = (searchGlobal[category] || 0) + 1;
	});

	const topSearchCategoriesByCountry = Object.entries(searchByCountry).map(
		([country, categories]) => ({
			country,
			categories: Object.entries(categories)
				.sort((a, b) => b[1] - a[1])
				.slice(0, 5)
				.map(([label, count]) => ({ label, count })),
		}),
	);

	const topSearchCategoriesGlobal = Object.entries(searchGlobal)
		.sort((a, b) => b[1] - a[1])
		.slice(0, 8)
		.map(([label, count]) => ({ label, count }));

	const now = Date.now();
	const last30 = now - 30 * 24 * 60 * 60 * 1000;
	const prev30 = now - 60 * 24 * 60 * 60 * 1000;
	const trendBuckets = { current: {}, previous: {} };
	searchEvents.forEach((event) => {
		const ts = new Date(event.created_at || "").getTime();
		const meta = event?.metadata || {};
		const categories = Array.isArray(meta.categories) ? meta.categories : [];
		const rawCategory = String(meta.category_primary || categories[0] || meta.category || "");
		const category = rawCategory.trim() || "Other";
		if (!Number.isFinite(ts)) {
			return;
		}
		if (ts >= last30) {
			trendBuckets.current[category] = (trendBuckets.current[category] || 0) + 1;
		} else if (ts >= prev30) {
			trendBuckets.previous[category] = (trendBuckets.previous[category] || 0) + 1;
		}
	});

	const trendingCategories = Object.keys(trendBuckets.current)
		.map((cat) => {
			const current = trendBuckets.current[cat] || 0;
			const previous = trendBuckets.previous[cat] || 0;
			return { label: cat, delta: current - previous, current, previous };
		})
		.sort((a, b) => b.delta - a.delta)
		.slice(0, 6);

	// --- Monthly demand series by category and by top products ---
	const monthly_demand_by_category = topCategoriesGlobal.map((c) => {
		const label = String(c.label || "Other");
		const rows = (requirementsRows || []).filter(
			(r) => String(r.category || r.product || "Other") === label,
		);
		return { label, series: toMonthlySeries(rows, "created_at") };
	});

	const productCounts = (requirementsRows || []).reduce((acc, r) => {
		const p = String(r.product || r.product_name || r.product_id || "").trim();
		if (!p) {
			return acc;
		}
		acc[p] = (acc[p] || 0) + 1;
		return acc;
	}, {});

	const topProductsGlobal = Object.entries(productCounts)
		.sort((a, b) => b[1] - a[1])
		.slice(0, 8)
		.map(([label, count]) => ({ label, count }));

	const monthly_demand_by_product = topProductsGlobal.map((p) => {
		const label = String(p.label || "unknown");
		const rows = (requirementsRows || []).filter(
			(r) => String(r.product || r.product_name || r.product_id || "") === label,
		);
		return { label, series: toMonthlySeries(rows, "created_at") };
	});

	return {
		totals: {
			buyer_requests: requirementsRows.length,
			repeat_buyer_rate: repeatBuyerRate,
		},
		search_event_count: searchEventCount,
		top_categories_by_country: topCategoriesByCountry,
		top_categories_global: topCategoriesGlobal,
		monthly_demand_trend: toMonthlySeries(requirementsRows, "created_at"),
		monthly_demand_by_category,
		monthly_demand_by_product,
		price_range_demand: priceRangeDemand,
		top_search_categories_by_country: topSearchCategoriesByCountry,
		top_search_categories_global: topSearchCategoriesGlobal,
		trending_search_categories: trendingCategories,
	};
}

function toGovernedResponse(report, { scopeLevel, suppression, privacyThresholdApplied }) {
	return {
		...report,
		scope_level: scopeLevel,
		suppressed_fields: Object.keys(suppression || {}).filter((key) => {
			if (key === "noise_injected") {
				return Boolean(suppression[key]);
			}
			return Number(suppression[key] || 0) > 0;
		}),
		privacy_threshold_applied: Boolean(privacyThresholdApplied),
	};
}

export async function getPlatformAnalyticsSummary(user) {
	ensureAnalyticsAccess(user);
	const governance = await getAnalyticsGovernanceConfig();
	const viewPolicy = checkAnalyticsAccessPolicy(user, governance, {
		mode: "view",
	});
	if (!viewPolicy.allowed) {
		throw forbiddenError("Analytics governance policy denied this request");
	}

	const { usersById, requirementsRows, eventRows } =
		await buildPlatformAnalyticsSnapshot(governance);
	const minEvents = await getSearchMinEvents();
	const rawReport = buildRawPlatformReport(requirementsRows, eventRows, usersById);
	rawReport.search_min_events = minEvents;
	rawReport.search_data_ready = rawReport.search_event_count >= minEvents;
	rawReport.search_data_source = rawReport.search_data_ready ? "search_events" : "proxy_requests";
	rawReport.top_categories_by_country = [];
	rawReport.top_search_categories_by_country = [];

	const { report, suppression } = sanitizePlatformAnalytics(rawReport, governance);
	const response = toGovernedResponse(report, {
		scopeLevel: "platform_summary_aggregated",
		suppression,
		privacyThresholdApplied: governance.enabled,
	});

	appendAuditLog({
		id: crypto.randomUUID(),
		at: new Date().toISOString(),
		actor_id: user?.id || null,
		actor_role: user?.role || null,
		action: "platform_analytics_summary_requested",
		path: "/analytics/platform/summary",
		status: 200,
		payload: {
			scope_level: response.scope_level,
			suppression_counts: suppression,
		},
	}).catch(() => null);

	return response;
}

export async function getPlatformOverview(user) {
	// Lightweight anonymized overview for all authenticated roles.
	const governance = await getAnalyticsGovernanceConfig();
	const { usersById, requirementsRows, eventRows } =
		await buildPlatformAnalyticsSnapshot(governance);
	const rawReport = buildRawPlatformReport(requirementsRows, eventRows, usersById);

	const { report, suppression } = sanitizePlatformAnalytics(rawReport, governance);
	const response = toGovernedResponse(report, {
		scopeLevel: "platform_overview_aggregated",
		suppression,
		privacyThresholdApplied: governance.enabled,
	});

	appendAuditLog({
		id: crypto.randomUUID(),
		at: new Date().toISOString(),
		actor_id: user?.id || null,
		actor_role: user?.role || null,
		action: "platform_analytics_overview_requested",
		path: "/analytics/platform/overview",
		status: 200,
		payload: {
			scope_level: response.scope_level,
			suppression_counts: suppression,
		},
	}).catch(() => null);

	return response;
}

export async function getPlatformTrends(user, options = {}) {
	// Role-scoped trends; non-admins get org-scoped anonymized trends only.
	const governance = await getAnalyticsGovernanceConfig();
	const role = String(user?.role || "").toLowerCase();
	const isAdmin = role === "admin" || role === "owner";

	const orgScopeId = resolvePlatformOrgScopeId(user);
	if (!(isAdmin || orgScopeId)) {
		// only admins/owners may request global trends
		const err = new Error("Forbidden: trends require org scope or admin role");
		err.status = 403;
		throw err;
	}

	assertNoUnauthorizedAnalyticsJoin(options.dimensions || []);
	const { usersById, requirementsRows, eventRows } =
		await buildPlatformAnalyticsSnapshot(governance);

	const scopedRequirements = orgScopeId
		? requirementsRows.filter(
				(row) =>
					String(row?.buyer_id || "") === orgScopeId ||
					String(row?.assigned_agent_id || row?.agent_id || "") === orgScopeId,
			)
		: requirementsRows;

	const scopedEvents = orgScopeId
		? eventRows.filter(
				(row) =>
					String(row?.actor_id || "") === orgScopeId || String(row?.entity_id || "") === orgScopeId,
			)
		: eventRows;

	const rawReport = buildRawPlatformReport(scopedRequirements, scopedEvents, usersById);
	rawReport.org_scope = orgScopeId ? `org:${orgScopeId.slice(0, 6)}***` : "org:global";

	const { report, suppression } = sanitizePlatformAnalytics(rawReport, governance);
	const response = toGovernedResponse(report, {
		scopeLevel: orgScopeId ? "platform_trends_org_anonymized" : "platform_trends_global_anonymized",
		suppression,
		privacyThresholdApplied: governance.enabled,
	});

	appendAuditLog({
		id: crypto.randomUUID(),
		at: new Date().toISOString(),
		actor_id: user?.id || null,
		actor_role: user?.role || null,
		action: "platform_analytics_trends_requested",
		path: "/analytics/platform/trends",
		status: 200,
		payload: {
			scope_level: response.scope_level,
			requested_dimensions: options.dimensions || [],
			org_scope: rawReport.org_scope,
			suppression_counts: suppression,
		},
	}).catch(() => null);

	return response;
}

export async function getPlatformAnalyticsSegment(user, options = {}) {
	ensureAnalyticsAccess(user);
	const governance = await getAnalyticsGovernanceConfig();
	const viewPolicy = checkAnalyticsAccessPolicy(user, governance, {
		mode: "view",
	});
	if (!viewPolicy.allowed) {
		throw forbiddenError("Analytics governance policy denied this request");
	}

	assertNoUnauthorizedAnalyticsJoin(options.dimensions || []);
	const orgScopeId = resolvePlatformOrgScopeId(user);
	const { usersById, requirementsRows, eventRows } =
		await buildPlatformAnalyticsSnapshot(governance);
	const scopedRequirements = requirementsRows.filter((row) => {
		if (!orgScopeId) {
			return false;
		}
		const buyerId = String(row?.buyer_id || "");
		const assignedAgent = String(row?.assigned_agent_id || row?.agent_id || "");
		return buyerId === orgScopeId || assignedAgent === orgScopeId;
	});
	const scopedEvents = eventRows.filter((row) => {
		if (!orgScopeId) {
			return false;
		}
		return (
			String(row?.actor_id || "") === orgScopeId || String(row?.entity_id || "") === orgScopeId
		);
	});

	const minEvents = await getSearchMinEvents();
	const rawReport = buildRawPlatformReport(scopedRequirements, scopedEvents, usersById);
	rawReport.search_min_events = minEvents;
	rawReport.search_data_ready = rawReport.search_event_count >= minEvents;
	rawReport.search_data_source = rawReport.search_data_ready ? "search_events" : "proxy_requests";
	rawReport.org_scope = orgScopeId ? `org:${orgScopeId.slice(0, 6)}***` : "org:unknown";

	const { report, suppression } = sanitizePlatformAnalytics(rawReport, governance);
	const response = toGovernedResponse(report, {
		scopeLevel: "platform_segment_org_anonymized",
		suppression,
		privacyThresholdApplied: governance.enabled,
	});

	appendAuditLog({
		id: crypto.randomUUID(),
		at: new Date().toISOString(),
		actor_id: user?.id || null,
		actor_role: user?.role || null,
		action: "platform_analytics_segment_requested",
		path: "/analytics/platform/segment",
		status: 200,
		payload: {
			scope_level: response.scope_level,
			requested_dimensions: options.dimensions || [],
			org_scope: rawReport.org_scope,
			suppression_counts: suppression,
		},
	}).catch(() => null);

	return response;
}

export async function getPlatformAnalyticsAdmin(user, options = {}) {
	ensureAnalyticsAdminAccess(user);

	const governance = await getAnalyticsGovernanceConfig();
	const viewPolicy = checkAnalyticsAccessPolicy(user, governance, {
		mode: "view",
	});
	if (!viewPolicy.allowed) {
		throw forbiddenError("Analytics governance policy denied this request");
	}

	const { usersById, requirementsRows, eventRows } =
		await buildPlatformAnalyticsSnapshot(governance);
	const rawReport = buildRawPlatformReport(requirementsRows, eventRows, usersById);
	const minEvents = await getSearchMinEvents();
	rawReport.search_min_events = minEvents;
	rawReport.search_data_ready = rawReport.search_event_count >= minEvents;
	rawReport.search_data_source = rawReport.search_data_ready ? "search_events" : "proxy_requests";
	if (!rawReport.search_data_ready) {
		rawReport.top_search_categories_by_country = rawReport.top_categories_by_country;
		rawReport.top_search_categories_global = rawReport.top_categories_global;
	}

	const { report, suppression } = sanitizePlatformAnalytics(rawReport, governance);
	const response = toGovernedResponse(report, {
		scopeLevel: "platform_admin_full_detail",
		suppression,
		privacyThresholdApplied: governance.enabled,
	});

	appendAuditLog({
		id: crypto.randomUUID(),
		at: new Date().toISOString(),
		actor_id: user?.id || null,
		actor_role: user?.role || null,
		action: options.export
			? "platform_analytics_export_requested"
			: "platform_analytics_admin_requested",
		path: "/analytics/platform/admin",
		status: 200,
		payload: {
			requested_scope: "platform_admin",
			export_requested: Boolean(options.export),
			governance_mode: viewPolicy.mode,
			governance_retention_days: governance.retention_days,
			governance_geo_granularity: governance.geo_granularity,
			governance_min_cohort_size: governance.min_cohort_size,
			suppression_counts: suppression,
		},
	}).catch(() => null);

	return response;
}

export async function getPremiumInsights(user) {
	const plan = await getPlanForUser(user);
	if (plan !== "premium") {
		throw forbiddenError("Premium plan required");
	}
	const days90 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

	const role = String(user?.role || "").toLowerCase();

	let requirements = [];
	let matches = [];
	let messages = [];
	let documents = [];
	let users = [];
	let leads = [];
	let products = [];
	let productViews = [];

	try {
		[requirements, matches, messages, documents, users, leads, products, productViews] =
			await Promise.all([
				prisma.requirement.findMany({
					where: { created_at: { gte: days90 } },
					take: 1000,
				}),
				prisma.match.findMany({ take: 500 }),
				prisma.message.findMany({ take: 1000 }),
				prisma.document.findMany({ take: 500 }),
				prisma.user.findMany({ take: 500 }),
				prisma.lead.findMany({ take: 500 }),
				prisma.product.findMany({ take: 500 }),
				prisma.productView.findMany({
					where: { created_at: { gte: days90 } },
					take: 1000,
				}),
			]);
	} catch {
		// Partial failure is acceptable — return whatever data loaded
	}

	const docs = Array.isArray(documents) ? documents : [];
	const contracts = docs.filter(
		(d) =>
			d.entity_type === "contract" ||
			String(d.type || "")
				.toLowerCase()
				.includes("contract"),
	);

	if (role === "buyer") {
		const myRequests = Array.isArray(requirements)
			? requirements.filter((r) => String(r.buyer_id || "") === String(user.id))
			: [];
		const myReqIds = new Set(myRequests.map((r) => String(r.id || "")));
		const myMatches = Array.isArray(matches)
			? matches.filter((m) => myReqIds.has(String(m.requirement_id || "")))
			: [];
		const matchedReqIds = new Set(myMatches.map((m) => String(m.requirement_id || "")));
		const myContracts = contracts.filter((c) => String(c.buyer_id || "") === String(user.id));

		const relatedMessages = Array.isArray(messages)
			? messages.filter((m) => {
					const match = parseMatchId(m.match_id || "");
					return match && myReqIds.has(String(match.requirementId));
				})
			: [];

		const response = computeResponseTimesForOrg(relatedMessages, new Set([String(user.id)]));

		const categoryCounts = myRequests.reduce((acc, r) => {
			const key = String(r.category || r.product || "Other");
			acc[key] = (acc[key] || 0) + 1;
			return acc;
		}, {});

		const priceBuckets = myRequests.reduce((acc, r) => {
			const bucket = bucketNormalizedPrice(normalizedPriceForBucket(r));
			acc[bucket] = (acc[bucket] || 0) + 1;
			return acc;
		}, {});

		const avgQty = (() => {
			const nums = myRequests.map((r) => safeNumber(r.quantity)).filter((n) => Number.isFinite(n));
			if (nums.length === 0) {
				return null;
			}
			return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
		})();

		const buyingPatternRows = [
			...Object.entries(categoryCounts)
				.sort((a, b) => b[1] - a[1])
				.slice(0, 5)
				.map(([label, count]) => ({ label, count })),
			...Object.entries(priceBuckets).map(([bucket, count]) => ({
				label: `Price ${bucket}`,
				count,
			})),
			...(avgQty === null ? [] : [{ label: "Avg order qty", count: avgQty }]),
		];

		const signedContracts = myContracts.filter(
			(c) => String(c.lifecycle_status || "").toLowerCase() === "signed",
		).length;
		const certification = await getOrderCertificationSummary(user.id);
		const smartMatchSuccessRate = calcPercent(signedContracts, matchedReqIds.size || 0);

		return {
			role,
			request_performance: {
				total_requests: myRequests.length,
				matched_requests: matchedReqIds.size,
				match_rate_pct: calcPercent(matchedReqIds.size, myRequests.length),
				avg_response_time: response.formatted,
				contracts_signed: signedContracts,
				conversion_rate_pct: calcPercent(signedContracts, myRequests.length),
			},
			smart_matching_success_rate: {
				match_rate_pct: smartMatchSuccessRate,
				matched_requests: matchedReqIds.size,
				contracts_signed: signedContracts,
			},
			buying_pattern_analysis: buyingPatternRows,
			order_completion_certification: {
				status: certification?.status || "pending",
				signed_contracts: certification?.signed_contracts ?? signedContracts,
				issued_at: certification?.issued_at || null,
			},
			request_performance_insights: {
				open_requests: myRequests.filter((r) => String(r.status || "").toLowerCase() === "open")
					.length,
				response_speed_hours: Math.round((response.avg_hours || 0) * 10) / 10,
			},
		};
	}

	const orgId = role === "agent" ? String(user.org_owner_id || "") : String(user.id || "");
	const orgUsers = Array.isArray(users)
		? users.filter((u) => String(u.org_owner_id || "") === orgId || String(u.id) === orgId)
		: [];
	const orgMemberIds = new Set(orgUsers.map((u) => String(u.id)));

	const orgMatches = Array.isArray(matches)
		? matches.filter((m) => String(m.factory_id || "") === orgId)
		: [];
	const orgReqIds = new Set(orgMatches.map((m) => String(m.requirement_id || "")));
	const orgRequests = Array.isArray(requirements)
		? requirements.filter((r) => orgReqIds.has(String(r.id || "")))
		: [];

	const orgMessages = Array.isArray(messages)
		? messages.filter((m) => {
				const match = parseMatchId(m.match_id || "");
				return match && String(match.supplierId) === orgId;
			})
		: [];

	const inboundMessages = orgMessages.filter((m) => !orgMemberIds.has(String(m.sender_id || "")));
	const buyers = new Set(orgRequests.map((r) => String(r.buyer_id || "")).filter(Boolean));

	const orgContracts = contracts.filter(
		(c) => String(c.factory_id || "") === orgId || String(c.buyer_id || "") === orgId,
	);
	const signedContracts = orgContracts.filter(
		(c) => String(c.lifecycle_status || "").toLowerCase() === "signed",
	).length;
	const orgCertification = await getOrderCertificationSummary(orgId);

	const response = computeResponseTimesForOrg(orgMessages, orgMemberIds);

	const orgProducts = Array.isArray(products)
		? products.filter((p) => String(p.company_id || "") === orgId)
		: [];
	const productIds = new Set(orgProducts.map((p) => String(p.id || "")));
	const orgViews = Array.isArray(productViews)
		? productViews.filter((v) => productIds.has(String(v.product_id || "")))
		: [];
	const inquiryRate =
		orgViews.length > 0 ? Math.round((inboundMessages.length / orgViews.length) * 100) / 100 : 0;

	const leadRows = Array.isArray(leads)
		? leads.filter((l) => String(l.org_owner_id || "") === orgId)
		: [];
	const leadByAgent = leadRows.reduce((acc, lead) => {
		const key = String(lead.assigned_agent_id || "unassigned");
		acc[key] = (acc[key] || 0) + 1;
		return acc;
	}, {});

	const leadOutcomeByAgent = leadRows.reduce((acc, lead) => {
		const key = String(lead.assigned_agent_id || "unassigned");
		if (!acc[key]) {
			acc[key] = { closed: 0, confirmed: 0, converted: 0 };
		}
		const status = String(lead.status || "");
		if (status === "closed") {
			acc[key].closed += 1;
		}
		if (status === "order_confirmed") {
			acc[key].confirmed += 1;
		}
		if (lead.conversion_at) {
			acc[key].converted += 1;
		}
		return acc;
	}, {});

	const agentPerformance = orgUsers
		.filter((u) => String(u.role || "").toLowerCase() === "agent")
		.map((agent) => ({
			agent_id: agent.id,
			name: agent.name,
			assigned_leads: leadByAgent[String(agent.id)] || 0,
			closed_leads: leadOutcomeByAgent[String(agent.id)]?.closed || 0,
			orders_confirmed: leadOutcomeByAgent[String(agent.id)]?.confirmed || 0,
			conversions: leadOutcomeByAgent[String(agent.id)]?.converted || 0,
		}));

	const categoryCounts = orgRequests.reduce((acc, r) => {
		const key = String(r.category || r.product || "Other");
		acc[key] = (acc[key] || 0) + 1;
		return acc;
	}, {});

	const buyingPattern = Object.entries(categoryCounts)
		.sort((a, b) => b[1] - a[1])
		.slice(0, 5)
		.map(([label, count]) => ({ label, count }));

	return {
		role,
		advanced_analytics: {
			product_views: orgViews.length,
			inbound_inquiries: inboundMessages.length,
			inquiry_rate: inquiryRate,
		},
		buyer_interest_analytics: {
			unique_buyers: buyers.size,
			inbound_messages: inboundMessages.length,
			matched_requests: orgReqIds.size,
		},
		request_performance_insights: {
			open_requests: orgRequests.filter((r) => String(r.status || "").toLowerCase() === "open")
				.length,
			response_speed: response.formatted,
			match_rate_pct: calcPercent(orgReqIds.size, orgRequests.length),
		},
		buyer_communication_insights: {
			avg_response_time: response.formatted,
			total_messages: orgMessages.length,
			inbound_messages: inboundMessages.length,
		},
		buyer_conversion_insights: {
			contracts_signed: signedContracts,
			conversion_rate_pct: calcPercent(
				signedContracts,
				orgMessages.length > 0 ? orgMessages.length : 1,
			),
		},
		agent_performance_analytics: agentPerformance,
		lead_distribution: leadByAgent,
		buying_pattern_analysis: buyingPattern,
		order_completion_certification: {
			status: orgCertification?.status || "pending",
			signed_contracts: orgCertification?.signed_contracts ?? signedContracts,
			issued_at: orgCertification?.issued_at || null,
		},
	};
}

async function computeAvgFirstResponseHours(forUserId = null) {
	const where = forUserId ? { buyer_id: forUserId } : {};
	const requirements = await prisma.requirement.findMany({
		where,
		select: { id: true, buyer_id: true, created_at: true },
	});
	if (requirements.length === 0) return 0;

	const reqIds = requirements.map((r) => r.id);
	const matches = await prisma.match.findMany({ where: { requirement_id: { in: reqIds } } });
	if (matches.length === 0) return 0;

	const matchIdSet = new Set(matches.map((m) => String(m.id)));
	const messages = await prisma.message.findMany({
		where: { match_id: { in: [...matchIdSet] } },
		orderBy: [{ timestamp: "asc" }],
	});

	const reqById = new Map(requirements.map((r) => [String(r.id), r]));
	const messagesByMatch = {};
	for (const m of messages) {
		const mid = String(m.match_id || "");
		if (!mid) continue;
		if (!messagesByMatch[mid]) messagesByMatch[mid] = [];
		messagesByMatch[mid].push(m);
	}

	const hours = [];
	for (const match of matches) {
		const mid = `${match.requirement_id || ""}:${match.factory_id || ""}`;
		const parsed = parseMatchId(mid);
		if (!parsed) continue;
		const reqId = parsed.requirementId;
		const factoryId = parsed.supplierId;
		const req = reqById.get(reqId);
		if (!req?.created_at) continue;

		const createdAt = new Date(req.created_at).getTime();
		if (!Number.isFinite(createdAt)) continue;

		const msgs = messagesByMatch[mid] || [];
		const firstMsg = msgs.find((m) => {
			const senderId = String(m.sender_id || "");
			return senderId && senderId !== String(req.buyer_id) && senderId === factoryId;
		});
		if (!firstMsg?.timestamp) continue;

		const firstAt = new Date(firstMsg.timestamp).getTime();
		if (!Number.isFinite(firstAt) || firstAt < createdAt) continue;

		hours.push((firstAt - createdAt) / (1000 * 60 * 60));
	}

	return hours.length > 0 ? hours.reduce((a, b) => a + b, 0) / hours.length : 0;
}

export async function getCoreMetrics(user) {
	const role = String(user?.role || "").toLowerCase();
	const userId = String(user?.id || "");

	const isOwner = ["owner", "admin"].includes(role);
	const isBuyingHouse = role === "buying_house";

	if (isBuyingHouse) {
		const contractDocFilter = {
			OR: [{ entity_type: "contract" }, { type: { contains: "contract", mode: "insensitive" } }],
		};
		const [totalRequests, totalMatches, contracts, ratings, topProducts, avgHours] = await Promise.all([
			prisma.requirement.count({ where: { buyer_id: userId } }),
			prisma.requirement.count({ where: { buyer_id: userId, assigned_agent_id: { not: null } } }),
			prisma.document.count({
				where: { AND: [contractDocFilter, { OR: [{ buyer_id: userId }, { factory_id: userId }] }] },
			}),
			prisma.rating.aggregate({ _avg: { score: true }, where: { profile_key: `user:${userId}` } }),
			prisma.requirement.groupBy({ by: ["category"], where: { buyer_id: userId, category: { not: null } }, _count: true, orderBy: { _count: { category: "desc" } }, take: 5 }),
			computeAvgFirstResponseHours(userId),
		]);

		const matchRate = totalRequests > 0 ? Math.round((totalMatches / totalRequests) * 100) : 0;
		const trustScore = Math.max(0, contracts + (ratings._avg.score || 0));

		return {
			ok: true, role,
			metrics: [
				{ key: "buyer_request_match_rate", label: "Request Match Rate", value: matchRate, unit: "%", hint: "matched / total relevant" },
				{ key: "factory_response_speed", label: "Response Speed", value: formatHours(avgHours), unit: "", hint: "avg first response time" },
				{ key: "buyer_demand_trend", label: "Demand Trend", value: topProducts.map((p) => p.category).join(", ") || "--", unit: "", hint: "top requested products" },
				{ key: "trusted_deal_score", label: "Trust Score", value: trustScore, unit: "", hint: "deals + rating" },
			],
		};
	}

	if (isOwner) {
		const contractDocFilter = {
			OR: [{ entity_type: "contract" }, { type: { contains: "contract", mode: "insensitive" } }],
		};
		const [totalBuyerRequests, matchedRequests, contracts, buyers, suppliers, returningBuyerGroups, avgHours] = await Promise.all([
			prisma.requirement.count(),
			prisma.requirement.count({ where: { assigned_agent_id: { not: null } } }),
			prisma.document.count({ where: contractDocFilter }),
			prisma.user.count({ where: { role: "buyer" } }),
			prisma.user.count({ where: { role: { in: ["factory", "buying_house"] } } }),
			prisma.requirement.groupBy({ by: ["buyer_id"] }),
			computeAvgFirstResponseHours(null),
		]);
		const returningBuyers = returningBuyerGroups.length;

		const matchRate = totalBuyerRequests > 0 ? Math.round((matchedRequests / totalBuyerRequests) * 100) : 0;
		const ratio = suppliers > 0 ? (buyers / suppliers).toFixed(1) : "--";
		const conversion = totalBuyerRequests > 0 ? Math.round((contracts / totalBuyerRequests) * 100) : 0;
		const repeatRate = buyers > 0 ? Math.round((returningBuyers / buyers) * 100) : 0;

		return {
			ok: true, role,
			metrics: [
				{ key: "buyer_supplier_match_rate", label: "Match Rate", value: matchRate, unit: "%", hint: "matched / total requests" },
				{ key: "buyer_supplier_ratio", label: "Buyer/Supplier Ratio", value: ratio, unit: ":1", hint: "active buyers vs suppliers" },
				{ key: "request_to_contract_conversion", label: "Request to Contract", value: conversion, unit: "%", hint: "contracts / buyer requests" },
				{ key: "first_qualified_response_time", label: "Response Time", value: formatHours(avgHours), unit: "", hint: "avg first qualified reply" },
				{ key: "repeat_buyer_rate", label: "Repeat Buyer Rate", value: repeatRate, unit: "%", hint: "returning / total buyers" },
			],
		};
	}

	return { ok: true, role, metrics: [] };
}
