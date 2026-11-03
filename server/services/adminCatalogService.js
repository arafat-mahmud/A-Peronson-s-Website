import crypto from "node:crypto";
import { readAuditLog } from "../utils/auditStore.js";
import { readLocalJson } from "../utils/localStore.js";
import prisma from "../utils/prisma.js";
import { getAdminConfig } from "./adminConfigService.js";
import { listExpiringVerifications } from "./verificationService.js";

const ORG_OVERRIDE_FILE = "org_admin_overrides.json";
const VERIFICATION_BADGE_AUDIT = "verification_badge_audit.json";
const MATCH_QUALITY_FILE = "match_quality.json";
const SPAM_FILTERS_FILE = "spam_filters.json";
const SPAM_FLAGS_FILE = "spam_flags.json";
const CONTRACT_AUDIT_FILE = "contract_audit.json";
const CALL_ESCALATIONS_FILE = "call_escalations.json";
const CHAT_TRANSFER_FILE = "chat_transfer_audit.json";
const CONTENT_FLAGS_FILE = "content_flags.json";
const SUPPORT_TICKETS_FILE = "support_tickets.json";
const NOTIFICATION_TEMPLATES_FILE = "notification_templates.json";
const NOTIFICATION_BATCHES_FILE = "notification_batches.json";
const MONTHLY_TRIGGERS_FILE = "monthly_summary_triggers.json";
const AI_RESPONSE_AUDIT_FILE = "ai_response_audit.json";
const TRAFFIC_ANALYTICS_FILE = "traffic_analytics.json";
const EMAIL_SEGMENTS_FILE = "email_segments.json";
const COUPON_CAMPAIGNS_FILE = "coupon_campaigns.json";
const PARTNER_OVERRIDES_FILE = "partner_overrides.json";
const FEATURED_LISTINGS_FILE = "featured_listings.json";

const DEFAULT_ORG_OVERRIDES = {
	staff_limits: {},
	buying_house_staff_ids: [],
	permission_matrix: {},
};

function toNumber(value, fallback = 0) {
	const num = Number(value);
	return Number.isFinite(num) ? num : fallback;
}

function sortByDateDesc(rows = [], field = "created_at") {
	return [...rows].sort((a, b) => String(b?.[field] || "").localeCompare(String(a?.[field] || "")));
}

function mapUserSafe(user) {
	if (!user) {
		return null;
	}
	const safe = { ...user };
	safe.password_hash = undefined;
	return safe;
}

function buildDuplicateIndex(rows = [], fields = []) {
	const map = new Map();
	for (const row of rows) {
		for (const field of fields) {
			const raw = String(row?.[field] || "").trim();
			if (!raw) {
				continue;
			}
			const key = `${field}:${raw.toLowerCase()}`;
			const bucket = map.get(key) || { field, value: raw, user_ids: [] };
			bucket.user_ids.push(row.user_id || row.id);
			map.set(key, bucket);
		}
	}
	return [...map.values()].filter((entry) => entry.user_ids.length > 1);
}

function deriveOrgRegistry(users = [], overrides = {}, config = {}) {
	const owners = users.filter((u) =>
		["buyer", "factory", "buying_house"].includes(String(u.role || "").toLowerCase()),
	);
	const staffByOrg = new Map();
	const agentsByOrg = new Map();

	users.forEach((user) => {
		const orgId = String(user.org_owner_id || "");
		if (!orgId) {
			return;
		}
		const list = staffByOrg.get(orgId) || [];
		list.push(user);
		staffByOrg.set(orgId, list);
		if (String(user.role || "").toLowerCase() === "agent") {
			const agents = agentsByOrg.get(orgId) || [];
			agents.push(user);
			agentsByOrg.set(orgId, agents);
		}
	});

	const freeLimit = Number(config?.plan_limits?.free?.member_limit || 10);
	const premiumLimit = Number(config?.plan_limits?.premium?.member_limit || 50);

	const orgs = owners.map((owner) => {
		const orgId = String(owner.id);
		const staff = staffByOrg.get(orgId) || [];
		const agents = agentsByOrg.get(orgId) || [];
		const overrideLimit = overrides.staff_limits?.[orgId];
		const plan =
			String(owner.subscription_status || "").toLowerCase() === "premium" ? "premium" : "free";
		const limit =
			overrideLimit === undefined
				? plan === "premium"
					? premiumLimit
					: freeLimit
				: Number(overrideLimit);
		return {
			org_owner_id: orgId,
			org_name: owner.company || owner.name || "Organization",
			role: owner.role,
			region: owner.region || owner.country || "",
			premium: plan === "premium",
			verified: Boolean(owner.verified),
			staff_count: staff.length,
			agent_count: agents.length,
			staff_limit: limit,
			quotas: config?.org_quotas?.[orgId] || {},
			permission_matrix: overrides.permission_matrix?.[orgId] || {},
		};
	});

	const staffList = [...staffByOrg.entries()].flatMap(([orgId, staff]) =>
		staff.map((member) => ({
			org_owner_id: orgId,
			id: member.id,
			name: member.name,
			role: member.role,
			status: member.status,
			region: member.region || "",
			created_at: member.created_at,
		})),
	);

	return { orgs, staff_list: staffList };
}

function buildFunnelStats({ users = [], requirements = [], matches = [], contracts = [] }) {
	const dealCount = contracts.filter(
		(c) => String(c.lifecycle_status || "").toLowerCase() === "signed",
	).length;
	return {
		signup: users.length,
		request: requirements.length,
		match: matches.length,
		deal: dealCount,
	};
}

function buildConversionTrend(events = []) {
	const byDay = {};
	events.forEach((event) => {
		const date = String(event.created_at || event.at || "").slice(0, 10);
		if (!date) {
			return;
		}
		byDay[date] = (byDay[date] || 0) + 1;
	});
	return Object.entries(byDay).map(([date, count]) => ({ date, count }));
}

function buildResponseSpeed(messages = []) {
	const responseTimes = messages
		.filter((m) => m.created_at)
		.map((m) => new Date(m.created_at).getTime())
		.filter((t) => Number.isFinite(t));
	if (responseTimes.length === 0) {
		return { avg_minutes: 0, median_minutes: 0 };
	}
	responseTimes.sort((a, b) => a - b);
	const diffs = responseTimes.slice(1).map((t, idx) => Math.max(0, t - responseTimes[idx]));
	if (diffs.length === 0) {
		return { avg_minutes: 0, median_minutes: 0 };
	}
	const avg = diffs.reduce((sum, v) => sum + v, 0) / diffs.length / 60_000;
	const median = diffs[Math.floor(diffs.length / 2)] / 60_000;
	return {
		avg_minutes: Math.round(avg * 10) / 10,
		median_minutes: Math.round(median * 10) / 10,
	};
}

function pickDate(row, fields = ["created_at", "submitted_at", "updated_at", "timestamp"]) {
	for (const field of fields) {
		const value = row?.[field];
		if (value) {
			return value;
		}
	}
	return "";
}

function dateKey(value) {
	if (!value) {
		return "";
	}
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		return "";
	}
	return date.toISOString().slice(0, 10);
}

function buildDailySeries(rows = [], options = {}) {
	const { dateField = "created_at", days = 14, uniqueBy } = options;
	const today = new Date();
	const series = [];
	const buckets = new Map();
	for (let i = days - 1; i >= 0; i -= 1) {
		const d = new Date(today);
		d.setDate(today.getDate() - i);
		const key = d.toISOString().slice(0, 10);
		series.push({ date: key, count: 0 });
		buckets.set(key, uniqueBy ? new Set() : 0);
	}

	rows.forEach((row) => {
		const rawDate = dateField ? row?.[dateField] : pickDate(row);
		const key = dateKey(rawDate);
		if (!(key && buckets.has(key))) {
			return;
		}
		if (uniqueBy) {
			buckets.get(key).add(String(row?.[uniqueBy] || ""));
		} else {
			buckets.set(key, Number(buckets.get(key) || 0) + 1);
		}
	});

	return series.map((entry) => {
		const bucket = buckets.get(entry.date);
		const count = uniqueBy ? (bucket ? bucket.size : 0) : Number(bucket || 0);
		return { ...entry, count };
	});
}

function summarizeSeries(series = []) {
	const total = series.reduce((sum, row) => sum + Number(row.count || 0), 0);
	const last = series.length > 0 ? series.at(-1).count : 0;
	return { total, last_day: last };
}

function normalizeDocType(doc = {}) {
	return String(doc.doc_type || doc.type || doc.category || doc.entity_type || "").toLowerCase();
}

function buildVerificationDocs(documents = []) {
	const verificationKeywords = [
		"verification",
		"business",
		"vat",
		"ein",
		"eori",
		"bank",
		"tax",
		"registration",
	];
	return documents
		.filter((doc) => {
			const type = normalizeDocType(doc);
			return verificationKeywords.some((key) => type.includes(key));
		})
		.map((doc) => ({
			id: doc.id,
			user_id: doc.user_id || doc.owner_id,
			type: doc.doc_type || doc.type || doc.category || "verification",
			status: doc.status || doc.review_status || doc.moderation_status || "pending",
			submitted_at: doc.submitted_at || doc.created_at || doc.updated_at,
			file_url: doc.file_url || doc.url || "",
		}));
}

function computeTrafficAnalytics(analyticsRows = [], stored = {}) {
	const summary = { clicks: 0, visits: 0, spend: 0 };
	const sources = new Map();
	const domains = new Map();

	analyticsRows.forEach((event) => {
		const name = String(event.event || event.type || event.name || "").toLowerCase();
		const isClick = name.includes("click");
		const isVisit = name.includes("visit") || name.includes("page_view") || name.includes("view");
		if (isClick) {
			summary.clicks += 1;
		}
		if (isVisit) {
			summary.visits += 1;
		}

		const source = String(event.source || event.utm_source || event.referrer || "").trim();
		if (source) {
			const existing = sources.get(source) || { source, clicks: 0, visits: 0 };
			if (isClick) {
				existing.clicks += 1;
			}
			if (isVisit) {
				existing.visits += 1;
			}
			sources.set(source, existing);
		}

		let domain = "";
		const url = event.url || event.page || event.path || "";
		if (url) {
			try {
				const parsed = new URL(url, "http://localhost");
				domain = parsed.hostname && parsed.hostname !== "localhost" ? parsed.hostname : "";
			} catch {
				domain = "";
			}
		}
		if (domain) {
			const existing = domains.get(domain) || { domain, clicks: 0, visits: 0 };
			if (isClick) {
				existing.clicks += 1;
			}
			if (isVisit) {
				existing.visits += 1;
			}
			domains.set(domain, existing);
		}
	});

	const storedSummary = stored?.summary || {};
	const mergedSummary = {
		clicks: (storedSummary.clicks || 0) + summary.clicks,
		visits: (storedSummary.visits || 0) + summary.visits,
		spend: (storedSummary.spend || 0) + summary.spend,
	};

	const storedDomains = Array.isArray(stored?.domains) ? stored.domains : [];
	const storedSources = Array.isArray(stored?.sources) ? stored.sources : [];
	storedDomains.forEach((row) => {
		if (!row?.domain) {
			return;
		}
		const existing = domains.get(row.domain) || {
			domain: row.domain,
			clicks: 0,
			visits: 0,
			spend: 0,
		};
		existing.clicks += row.clicks || 0;
		existing.visits += row.visits || 0;
		existing.spend += row.spend || 0;
		domains.set(row.domain, existing);
	});
	storedSources.forEach((row) => {
		if (!row?.source) {
			return;
		}
		const existing = sources.get(row.source) || {
			source: row.source,
			clicks: 0,
			visits: 0,
		};
		existing.clicks += row.clicks || 0;
		existing.visits += row.visits || 0;
		sources.set(row.source, existing);
	});

	const withRates = (row = {}) => {
		const clicks = Number(row.clicks || 0);
		const spend = Number(row.spend || 0);
		const cpc = clicks > 0 ? spend / clicks : null;
		return { ...row, clicks, spend, cpc };
	};

	return {
		summary: withRates(mergedSummary),
		sources: [...sources.values()],
		domains: [...domains.values()].map(withRates),
	};
}

function buildMatchQuality(matches = [], messages = []) {
	const messagesByMatch = messages.reduce((acc, msg) => {
		const key = String(msg.match_id || "");
		if (!key) {
			return acc;
		}
		acc[key] = acc[key] || [];
		acc[key].push(msg);
		return acc;
	}, {});

	return (Array.isArray(matches) ? matches : []).map((match) => {
		const matchId = String(match.id || match.match_id || "");
		const thread = messagesByMatch[matchId] || [];
		const responseCount = thread.length;
		const verifiedBias = match.buyer_verified || match.factory_verified ? 10 : 0;
		const score = Math.min(100, Math.round(responseCount * 5 + verifiedBias));
		return {
			match_id: matchId,
			score,
			note: responseCount ? `Messages: ${responseCount}` : "No activity yet",
			updated_at: new Date().toISOString(),
		};
	});
}

function detectSpamSignals(messages = []) {
	const keywords = [
		"whatsapp",
		"telegram",
		"wechat",
		"viber",
		"crypto",
		"bitcoin",
		"western union",
		"moneygram",
		"wire transfer",
		"free money",
	];
	return (Array.isArray(messages) ? messages : [])
		.map((message) => {
			const text = String(message.message || message.content || message.text || "").toLowerCase();
			if (!text) {
				return null;
			}
			let score = 0;
			if (/(https?:\/\/|www\.)/.test(text)) {
				score += 2;
			}
			if (keywords.some((k) => text.includes(k))) {
				score += 2;
			}
			if (/(\d{10,})/.test(text)) {
				score += 1;
			}
			if (text.length > 280) {
				score += 1;
			}
			if (score < 2) {
				return null;
			}
			return {
				id: crypto.randomUUID(),
				message_id: message.id,
				sender_id: message.sender_id,
				score,
				reason: "auto_classifier",
				created_at: message.timestamp || message.created_at || new Date().toISOString(),
			};
		})
		.filter(Boolean);
}

export async function getAdminCatalog() {
	const [
		users,
		verification,
		subscriptions,
		requirements,
		matches,
		documents,
		companyProducts,
		paymentProofs,
		callSessions,
		messages,
		violations,
		reports,
		notifications,
		analytics,
		walletHistory,
		couponCodes,
		couponRedemptions,
		assistantKnowledge,
		leadNotes,
	] = await Promise.all([
		prisma.user.findMany(),
		prisma.verification.findMany(),
		prisma.subscription.findMany(),
		prisma.requirement.findMany(),
		prisma.match.findMany(),
		prisma.document.findMany(),
		prisma.product.findMany(),
		prisma.paymentProof.findMany(),
		prisma.callSession.findMany(),
		prisma.message.findMany(),
		prisma.policyViolation.findMany(),
		prisma.report.findMany(),
		prisma.notification.findMany(),
		prisma.analyticsEvent.findMany(),
		prisma.walletHistory.findMany(),
		prisma.couponCode.findMany(),
		prisma.couponRedemption.findMany(),
		prisma.assistantKnowledge.findMany(),
		prisma.leadNote.findMany(),
	]);

	const [
		orgOverrides,
		badgeAudit,
		matchQuality,
		spamFilters,
		spamFlags,
		contractAudit,
		callEscalations,
		chatTransfers,
		contentFlags,
		supportTicketsLocal,
		notificationTemplates,
		notificationBatches,
		monthlyTriggers,
		aiResponseAudit,
		trafficAnalyticsStored,
		emailSegments,
		couponCampaigns,
		partnerOverrides,
		invoices,
		payouts,
		featuredListings,
	] = await Promise.all([
		readLocalJson(ORG_OVERRIDE_FILE, DEFAULT_ORG_OVERRIDES),
		readLocalJson(VERIFICATION_BADGE_AUDIT, []),
		readLocalJson(MATCH_QUALITY_FILE, []),
		readLocalJson(SPAM_FILTERS_FILE, []),
		readLocalJson(SPAM_FLAGS_FILE, []),
		readLocalJson(CONTRACT_AUDIT_FILE, []),
		readLocalJson(CALL_ESCALATIONS_FILE, []),
		readLocalJson(CHAT_TRANSFER_FILE, []),
		readLocalJson(CONTENT_FLAGS_FILE, []),
		readLocalJson(SUPPORT_TICKETS_FILE, []),
		readLocalJson(NOTIFICATION_TEMPLATES_FILE, []),
		readLocalJson(NOTIFICATION_BATCHES_FILE, []),
		readLocalJson(MONTHLY_TRIGGERS_FILE, []),
		readLocalJson(AI_RESPONSE_AUDIT_FILE, []),
		readLocalJson(TRAFFIC_ANALYTICS_FILE, {
			summary: { clicks: 0, visits: 0, spend: 0 },
			sources: [],
			domains: [],
		}),
		readLocalJson(EMAIL_SEGMENTS_FILE, []),
		readLocalJson(COUPON_CAMPAIGNS_FILE, []),
		readLocalJson(PARTNER_OVERRIDES_FILE, []),
		readLocalJson("invoice_log.json", []),
		readLocalJson("payout_ledger.json", []),
		readLocalJson(FEATURED_LISTINGS_FILE, []),
	]);

	const config = await getAdminConfig();
	const auditLog = await readAuditLog();

	const usersRows = Array.isArray(users) ? users : [];
	const verificationRows = Array.isArray(verification) ? verification : [];
	const subscriptionRows = Array.isArray(subscriptions) ? subscriptions : [];
	const requirementRows = Array.isArray(requirements) ? requirements : [];
	const matchRows = Array.isArray(matches) ? matches : [];
	const documentRows = Array.isArray(documents) ? documents : [];
	const productRows = Array.isArray(companyProducts) ? companyProducts : [];
	const proofRows = Array.isArray(paymentProofs) ? paymentProofs : [];
	const callRows = Array.isArray(callSessions) ? callSessions : [];
	const messageRows = Array.isArray(messages) ? messages : [];
	const violationRows = Array.isArray(violations) ? violations : [];
	const reportRows = Array.isArray(reports) ? reports : [];
	const notificationRows = Array.isArray(notifications) ? notifications : [];
	const analyticsRows = Array.isArray(analytics) ? analytics : [];
	const walletRows = Array.isArray(walletHistory) ? walletHistory : [];
	const couponRows = Array.isArray(couponCodes) ? couponCodes : [];
	const couponRedemptionRows = Array.isArray(couponRedemptions) ? couponRedemptions : [];
	const knowledgeRows = Array.isArray(assistantKnowledge) ? assistantKnowledge : [];
	const notesRows = Array.isArray(leadNotes) ? leadNotes : [];
	const supportTicketRows = await prisma.supportTicket.findMany();
	const supportTickets = Array.isArray(supportTicketRows) ? supportTicketRows : [];

	const orgRegistry = deriveOrgRegistry(
		usersRows,
		orgOverrides || DEFAULT_ORG_OVERRIDES,
		config || {},
	);

	const expiringVerification = await listExpiringVerifications(30).catch(() => []);
	const duplicateCandidates = buildDuplicateIndex(verificationRows, [
		"business_registration",
		"vat_ein",
		"eori",
		"bank_account",
		"tax_id",
		"company_registration",
	]);

	const failedRenewals = subscriptionRows.filter((s) => {
		const end = new Date(s.end_date || 0).getTime();
		return Number.isFinite(end) && end < Date.now() && Boolean(s.auto_renew);
	});
	const revenueByPlan = subscriptionRows.reduce((acc, sub) => {
		const plan = String(sub.plan || "free");
		acc[plan] = (acc[plan] || 0) + 1;
		return acc;
	}, {});
	const revenueSummary = Object.entries(revenueByPlan).map(([plan, count]) => ({
		plan,
		subscribers: count,
		price_usd:
			plan === "premium"
				? toNumber(config?.pricing?.premium_usd, 0)
				: toNumber(config?.pricing?.free_usd, 0),
	}));

	const couponCampaignList = Array.isArray(couponCampaigns) ? couponCampaigns : [];
	const earlyAdopter = couponCampaignList.filter(
		(c) => String(c.type || "").toLowerCase() === "early_adopter",
	);

	const partnerRequests = await prisma.partnerRequest.findMany();
	const partnerRows = Array.isArray(partnerRequests) ? partnerRequests : [];
	const connectedFactories = partnerRows.filter((row) => row.status === "connected");

	const contractDocs = documentRows.filter((d) =>
		String(d.entity_type || "")
			.toLowerCase()
			.includes("contract"),
	);
	const verificationDocs = buildVerificationDocs(documentRows);
	const funnelStats = buildFunnelStats({
		users: usersRows,
		requirements: requirementRows,
		matches: matchRows,
		contracts: contractDocs,
	});
	const conversionTrend = buildConversionTrend(analyticsRows);
	const responseSpeed = buildResponseSpeed(messageRows);

	const loginEvents = analyticsRows.filter((event) => {
		const name = String(event.type || event.event || event.name || "").toLowerCase();
		return name.includes("login") || name.includes("auth") || name.includes("session");
	});
	const activityEvents = analyticsRows
		.filter((event) => event.actor_id || event.user_id)
		.map((event) => ({ ...event, actor_id: event.actor_id || event.user_id }));

	const activeUsersTrend = buildDailySeries(activityEvents, {
		dateField: "created_at",
		uniqueBy: "actor_id",
		days: 14,
	});
	const loginTrend = buildDailySeries(loginEvents, {
		dateField: "created_at",
		days: 14,
	});
	const buyerRequestTrend = buildDailySeries(requirementRows, {
		dateField: undefined,
		days: 14,
	});
	const factoryProducts = productRows.filter(
		(row) => String(row.company_role || "").toLowerCase() === "factory",
	);
	const factoryPerformanceTrend = buildDailySeries(factoryProducts, {
		dateField: "created_at",
		days: 14,
	});

	const activeUsersSummary = summarizeSeries(activeUsersTrend);
	const loginSummary = summarizeSeries(loginTrend);
	const requestSummary = summarizeSeries(buyerRequestTrend);
	const factorySummary = summarizeSeries(factoryPerformanceTrend);

	const factoryTop = factoryProducts.reduce((acc, row) => {
		const key = String(row.company_id || row.owner_id || "unknown");
		const current = acc[key] || {
			company_id: key,
			company_name: row.company_name || "Factory",
			products: 0,
			last_product_at: "",
		};
		const created = row.created_at || row.updated_at || "";
		const last =
			current.last_product_at && created
				? String(created) > String(current.last_product_at)
					? created
					: current.last_product_at
				: current.last_product_at || created;
		acc[key] = {
			...current,
			products: current.products + 1,
			last_product_at: last,
		};
		return acc;
	}, {});

	const aiSummaries = notesRows.filter(
		(note) =>
			String(note.note || "").startsWith("AI Summary:") ||
			String(note.note || "").startsWith("AI Negotiation:"),
	);
	const matchesByBuyer = matchRows.reduce((acc, match) => {
		const buyerId = String(match.buyer_id || "");
		if (!buyerId) {
			return acc;
		}
		acc[buyerId] = acc[buyerId] || [];
		acc[buyerId].push(match);
		return acc;
	}, {});
	const contractsByBuyer = contractDocs.reduce((acc, doc) => {
		const buyerId = String(doc.buyer_id || doc.owner_id || "");
		if (!buyerId) {
			return acc;
		}
		acc[buyerId] = acc[buyerId] || [];
		acc[buyerId].push(doc);
		return acc;
	}, {});

	const featuredRows = Array.isArray(featuredListings) ? featuredListings : [];
	const productById = new Map(productRows.map((row) => [String(row.id), row]));
	const requirementById = new Map(requirementRows.map((row) => [String(row.id), row]));
	const featured = featuredRows.map((row) => {
		const entityId = String(row.entity_id || row.id);
		const entityType = String(row.entity_type || "").toLowerCase();
		const product = entityType.includes("product") ? productById.get(entityId) : null;
		const request = entityType.includes("request") ? requirementById.get(entityId) : null;
		return {
			...row,
			entity_id: entityId,
			entity_type: entityType || (product ? "product" : request ? "request" : "unknown"),
			title: row.label || product?.title || request?.title || "Featured item",
			status: product?.video_review_status || request?.status || "active",
			owner_id: product?.company_id || request?.buyer_id || "",
		};
	});

	return {
		orgs: {
			list: orgRegistry.orgs,
			staff_list: orgRegistry.staff_list,
			staff_limits: orgOverrides?.staff_limits || {},
			buying_house_staff_ids: orgOverrides?.buying_house_staff_ids || [],
			permission_matrix: orgOverrides?.permission_matrix || {},
		},
		verification: {
			docs_queue: sortByDateDesc(verificationDocs, "submitted_at"),
			badge_audit: sortByDateDesc(badgeAudit, "at"),
			duplicates: duplicateCandidates,
			expiring: expiringVerification,
			fraud_flags: verificationRows.filter((row) => Boolean(row.fraud_flag)),
		},
		finance: {
			failed_renewals: failedRenewals,
			upgrade_history: sortByDateDesc(
				await readLocalJson("subscription_history.json", []),
				"created_at",
			),
			invoices,
			payouts,
			revenue_summary: revenueSummary,
		},
		wallet: {
			ledger: sortByDateDesc(walletRows, "created_at"),
			redemptions: sortByDateDesc(couponRedemptionRows, "created_at"),
			refunds: await readLocalJson("refund_log.json", []),
		},
		coupons: {
			codes: couponRows,
			campaigns: couponCampaignList,
			early_adopter_campaigns: earlyAdopter,
		},
		partners: {
			requests: partnerRows,
			connected_factories: connectedFactories,
			overrides: partnerOverrides,
			blacklist: config?.partner_controls?.blacklist || [],
			whitelist: config?.partner_controls?.whitelist || [],
			free_tier_limit: Number(config?.plan_limits?.free?.partner_limit || 5),
		},
		requests: {
			list: requirementRows,
			matches: matchRows,
			match_quality:
				Array.isArray(matchQuality) && matchQuality.length > 0
					? matchQuality
					: buildMatchQuality(matchRows, messageRows),
			spam_filters: spamFilters,
			spam_flags: spamFlags,
		},
		contracts: {
			vault: contractDocs,
			audit_trail: contractAudit,
			payment_proofs: proofRows,
		},
		calls: {
			logs: callRows,
			escalations: callEscalations,
		},
		moderation: {
			violations: violationRows,
			chat_transfers: chatTransfers,
			spam_flags: spamFlags,
			auto_spam_flags: detectSpamSignals(messageRows),
		},
		content: {
			product_videos: productRows,
			documents: documentRows,
			flags: contentFlags,
		},
		support: {
			tickets: supportTickets.length > 0 ? supportTickets : supportTicketsLocal,
			reports: reportRows,
			sla_targets: config?.support?.sla_targets || {},
		},
		notifications: {
			templates: notificationTemplates,
			batches: notificationBatches,
			monthly_triggers: monthlyTriggers,
			notifications: notificationRows,
		},
		analytics: {
			platform_metrics: analyticsRows.slice(0, 50),
			buying_house: usersRows
				.filter((u) => String(u.role || "").toLowerCase() === "buying_house")
				.map((u) => ({
					...mapUserSafe(u),
					requests: requirementRows.filter((r) => String(r.buyer_id || "") === String(u.id)).length,
					matches: (matchesByBuyer[String(u.id)] || []).length,
					deals: (contractsByBuyer[String(u.id)] || []).filter(
						(c) => String(c.lifecycle_status || "").toLowerCase() === "signed",
					).length,
				})),
			funnel: funnelStats,
			agent_performance: usersRows
				.filter((u) => String(u.role || "").toLowerCase() === "agent")
				.map((u) => ({
					id: u.id,
					name: u.name,
					performance_score: u.performance_score || 0,
					assigned_requests: u.assigned_requests || 0,
				})),
			conversion_trend: conversionTrend,
			response_speed: responseSpeed,
			active_users: {
				last_14_days: activeUsersSummary.total,
				last_day: activeUsersSummary.last_day,
			},
			active_users_trend: activeUsersTrend,
			login_trend: loginTrend,
			login_summary: loginSummary,
			buyer_request_trend: buyerRequestTrend,
			buyer_request_summary: requestSummary,
			factory_performance_trend: factoryPerformanceTrend,
			factory_performance_summary: factorySummary,
			factory_top: Object.values(factoryTop)
				.sort((a, b) => b.products - a.products)
				.slice(0, 8),
		},
		search: {
			alerts: await prisma.searchAlert.findMany(),
			usage: await prisma.searchUsageCounter.findMany(),
		},
		ai: {
			knowledge_entries: knowledgeRows,
			summary_logs: aiSummaries,
			response_audit: aiResponseAudit,
		},
		system: {
			feature_flags: config?.feature_flags || {},
			plan_limits: config?.plan_limits || {},
			pricing: config?.pricing || {},
			policies: config?.policies || {},
			integrations: config?.integrations || {},
			retention: config?.retention || {},
		},
		security: {
			admin_audit_log: auditLog.slice(-200),
			access_log: auditLog.slice(-50).map((entry) => ({
				id: entry.id || crypto.randomUUID(),
				at: entry.at,
				actor_id: entry.actor_id,
				ip: entry.ip,
				device_id: entry.device_id,
				status: entry.status,
				path: entry.path,
			})),
		},
		traffic: computeTrafficAnalytics(analyticsRows, trafficAnalyticsStored),
		emails: {
			segments: emailSegments,
		},
		featured: {
			listings: featured,
		},
	};
}
