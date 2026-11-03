import { getActiveBoostMap } from "../services/boostService.js";
import { getBaseCurrency, normalizeMoney } from "../services/currencyService.js";
import { ensureEntitlement } from "../services/entitlementService.js";
import { extractClientIp, locateIp } from "../services/geoService.js";
import { isOpenSearchConfigured, searchOpenSearch } from "../services/openSearchService.js";
import { getOrderCertificationMap } from "../services/orderCertificationService.js";
import {
	createProduct,
	listProducts,
	removeProduct,
	updateProductById,
} from "../services/productService.js";
import { listMyProductViews, recordView } from "../services/productViewService.js";
import { isQdrantConfigured, searchQdrant } from "../services/qdrantService.js";
import { isRerankerConfigured, rerankIds } from "../services/rerankerService.js";
import {
	buildLimitError,
	buildSearchAccessPayload,
	canUseAdvancedFilters,
	consumeQuota,
	extractUsedAdvancedFilters,
	getQuotaSnapshot,
	getUserPlan,
} from "../services/searchAccessService.js";
import { findUserById } from "../services/userService.js";
import { recordWorkflowEvent } from "../services/workflowLifecycleService.js";
import { handleControllerError } from "../utils/permissions.js";
import prisma from "../utils/prisma.js";

function parseNumber(value) {
	if (value === undefined || value === null) {
		return null;
	}
	const raw = String(value).trim();
	if (!raw) {
		return null;
	}
	const n = Number(raw.replace(/[^\d.]/g, ""));
	return Number.isFinite(n) ? n : null;
}

function parseList(value) {
	return String(value || "")
		.split(",")
		.map((entry) => entry.trim().toLowerCase())
		.filter(Boolean);
}

function parseBoolean(value) {
	if (typeof value === "boolean") {
		return value;
	}
	return String(value || "").toLowerCase() === "true";
}

function parseCoordinate(value) {
	const n = Number(String(value || "").trim());
	return Number.isFinite(n) ? n : null;
}

function parseRange(value) {
	const raw = String(value || "").trim();
	if (!raw) {
		return { min: null, max: null };
	}
	const parts = raw.split("-").map((part) => parseNumber(part));
	const min = Number.isFinite(parts[0]) ? parts[0] : null;
	const max = Number.isFinite(parts[1]) ? parts[1] : null;
	if (min === null && max === null) {
		const single = parseNumber(raw);
		return { min: single, max: single };
	}
	return { min, max };
}

function normalizeSearchText(value) {
	return String(value || "")
		.toLowerCase()
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^a-z0-9]+/g, " ")
		.trim();
}

function buildSearchTokens(raw) {
	const base = normalizeSearchText(raw);
	if (!base) {
		return [];
	}
	const tokens = base
		.split(/\s+/)
		.map((token) => (token === "woman" ? "women" : token))
		.filter(Boolean);
	return [...new Set(tokens)];
}

function rangesOverlap(filterRange, valueRange) {
	if (!filterRange) {
		return true;
	}
	const filter = parseRange(filterRange);
	const value = parseRange(valueRange);
	if (filter.min === null && filter.max === null) {
		return true;
	}
	if (value.min === null && value.max === null) {
		return false;
	}

	const fMin = filter.min ?? filter.max;
	const fMax = filter.max ?? filter.min;
	const vMin = value.min ?? value.max;
	const vMax = value.max ?? value.min;

	if (fMin !== null && vMax !== null && vMax < fMin) {
		return false;
	}
	if (fMax !== null && vMin !== null && vMin > fMax) {
		return false;
	}
	return true;
}

function _numberInsideRange(value, rangeRaw) {
	const range = parseRange(rangeRaw);
	if (!Number.isFinite(value)) {
		return false;
	}
	if (range.min !== null && value < range.min) {
		return false;
	}
	if (range.max !== null && value > range.max) {
		return false;
	}
	return true;
}

function matchesMoqRange(rawRange, moqValue) {
	if (!rawRange) {
		return true;
	}
	const moq = Number.isFinite(Number(moqValue)) ? Number(moqValue) : parseNumber(moqValue);
	if (!Number.isFinite(moq)) {
		return false;
	}

	const range = String(rawRange || "").trim();
	const parts = range.split("-").map((p) => parseNumber(p));
	const min = Number.isFinite(parts[0]) ? parts[0] : null;
	const max = Number.isFinite(parts[1]) ? parts[1] : null;

	if (min !== null && moq < min) {
		return false;
	}
	if (max !== null && moq > max) {
		return false;
	}
	return true;
}

function buildOrgMemberIndex(users = []) {
	const ownerByMember = new Map();
	const membersByOwner = new Map();

	for (const user of users) {
		const userId = String(user?.id || "");
		if (!userId) {
			continue;
		}
		const role = String(user?.role || "").toLowerCase();
		const ownerId = role === "agent" && user?.org_owner_id ? String(user.org_owner_id) : userId;
		ownerByMember.set(userId, ownerId);
		if (!membersByOwner.has(ownerId)) {
			membersByOwner.set(ownerId, new Set([ownerId]));
		}
		membersByOwner.get(ownerId).add(userId);
	}

	return { ownerByMember, membersByOwner };
}

function buildResponseTimeByOwner(messages = [], users = []) {
	const { ownerByMember } = buildOrgMemberIndex(users);
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

	const responseTimes = new Map();

	for (const msgs of messagesByMatch.values()) {
		const sorted = msgs
			.slice()
			.sort((a, b) => String(a.timestamp || "").localeCompare(String(b.timestamp || "")));
		const ownersInMatch = new Set(
			sorted
				.map((m) => ownerByMember.get(String(m.sender_id || "")) || String(m.sender_id || ""))
				.filter(Boolean),
		);

		for (const ownerId of ownersInMatch) {
			let inboundAt = null;
			for (const message of sorted) {
				const senderOwner =
					ownerByMember.get(String(message.sender_id || "")) || String(message.sender_id || "");
				if (!senderOwner || senderOwner === ownerId) {
					continue;
				}
				const ts = new Date(message.timestamp || "").getTime();
				if (!Number.isFinite(ts)) {
					continue;
				}
				inboundAt = ts;
				break;
			}
			if (!inboundAt) {
				continue;
			}

			let outboundAt = null;
			for (const message of sorted) {
				const senderOwner =
					ownerByMember.get(String(message.sender_id || "")) || String(message.sender_id || "");
				if (!senderOwner || senderOwner !== ownerId) {
					continue;
				}
				const ts = new Date(message.timestamp || "").getTime();
				if (!Number.isFinite(ts) || ts < inboundAt) {
					continue;
				}
				outboundAt = ts;
				break;
			}
			if (!outboundAt) {
				continue;
			}

			const hours = (outboundAt - inboundAt) / (1000 * 60 * 60);
			if (!responseTimes.has(ownerId)) {
				responseTimes.set(ownerId, []);
			}
			responseTimes.get(ownerId).push(hours);
		}
	}

	const averages = new Map();
	for (const [ownerId, times] of responseTimes.entries()) {
		const avg = times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0;
		averages.set(ownerId, Math.round(avg * 10) / 10);
	}

	return averages;
}

function haversineDistanceKm(lat1, lng1, lat2, lng2) {
	const toRad = (deg) => (deg * Math.PI) / 180;
	const r = 6371;
	const dLat = toRad(lat2 - lat1);
	const dLng = toRad(lng2 - lng1);
	const a =
		Math.sin(dLat / 2) ** 2 +
		Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	return r * c;
}

function bucketResponseTime(avgHours) {
	if (!Number.isFinite(avgHours) || avgHours <= 0) {
		return "unknown";
	}
	if (avgHours <= 4) {
		return "0-4h";
	}
	if (avgHours <= 12) {
		return "4-12h";
	}
	if (avgHours <= 24) {
		return "12-24h";
	}
	return "24h+";
}

function bucketYearsInBusiness(value) {
	const years = Number(value);
	if (!Number.isFinite(years) || years <= 0) {
		return "unknown";
	}
	if (years <= 2) {
		return "0-2y";
	}
	if (years <= 5) {
		return "3-5y";
	}
	if (years <= 10) {
		return "6-10y";
	}
	return "10y+";
}

function bucketTeamSeats(value) {
	const seats = Number(value);
	if (!Number.isFinite(seats) || seats <= 0) {
		return "unknown";
	}
	if (seats <= 5) {
		return "1-5";
	}
	if (seats <= 10) {
		return "6-10";
	}
	if (seats <= 20) {
		return "11-20";
	}
	return "20+";
}

function computeAuditScore(company = {}, certification = null) {
	const profile = company?.profile || {};
	const certs = Array.isArray(profile?.certifications) ? profile.certifications : [];
	let score = 0;
	// Certifications contribute up to 60 points
	score += Math.min(certs.length * 20, 60);

	// Recent audit date boosts score
	const rawAudit = String(profile?.audit_date || company?.audit_date || "").trim();
	if (rawAudit) {
		const ts = Date.parse(rawAudit);
		if (!Number.isNaN(ts)) {
			const days = (Date.now() - ts) / (1000 * 60 * 60 * 24);
			if (days <= 365) {
				score += 30;
			} else if (days <= 730) {
				score += 15;
			}
		}
	}

	// Order certification adds modest bump
	const certStatus = String(
		certification?.status || company?.order_certification_status || "",
	).toLowerCase();
	if (certStatus === "certified") {
		score += 10;
	}

	if (score > 100) {
		score = 100;
	}
	if (score <= 0) {
		return null;
	}
	return Math.round(score);
}

function topFacetEntries(counts = {}, limit = 8) {
	return Object.fromEntries(
		Object.entries(counts)
			.sort((a, b) => b[1] - a[1])
			.slice(0, limit),
	);
}

async function resolveActor(req) {
	if (req.user?.role !== "agent") {
		return req.user;
	}
	const actor = await findUserById(req.user.id);
	return actor || req.user;
}

async function enforceDailyProductLimit(user) {
	if (!user) {
		return;
	}
	const plan = await getUserPlan(user.id);
	if (plan === "premium") {
		return;
	}
	const ownerId = String(user.org_owner_id || user.id || "");
	if (!ownerId) {
		return;
	}
	const todayStart = new Date();
	todayStart.setHours(0, 0, 0, 0);
	const todayCount = await prisma.product.count({
		where: {
			company_id: ownerId,
			created_at: { gte: todayStart },
		},
	});
	const DAILY_LIMIT = 2;
	if (todayCount >= DAILY_LIMIT) {
		const err = new Error(
			`Free plan allows up to ${DAILY_LIMIT} product uploads per day. Upgrade to Premium for unlimited uploads.`,
		);
		err.status = 403;
		throw err;
	}
}

export async function postProduct(req, res) {
	try {
		const actor = await resolveActor(req);
		await enforceDailyProductLimit(actor);
		const row = await createProduct(actor, req.body);
		return res.status(201).json(row);
	} catch (error) {
		return handleControllerError(res, error);
	}
}

export async function getProducts(req, res) {
	const mine = req.query.mine === "true";
	const category = req.query.category || "";
	const actor = await resolveActor(req);
	const companyId = mine
		? actor?.role === "agent"
			? String(actor?.org_owner_id || "")
			: String(actor?.id || "")
		: "";
	if (mine && actor?.role === "agent" && !actor?.permission_matrix?.products?.edit) {
		return res.status(403).json({ error: "Forbidden" });
	}
	if (mine && actor?.role === "agent" && !companyId) {
		return res.status(403).json({ error: "Forbidden" });
	}
	return res.json(
		await listProducts({
			category,
			companyId,
			includeDrafts: mine,
			viewerId: companyId,
			viewerRole: actor?.role || "",
		}),
	);
}

export async function searchProducts(req, res) {
	await recordWorkflowEvent(
		"search_open",
		{
			search_source: "products_search",
			product_id: req.query.product_id || req.query.id || "",
		},
		{ actor_id: req.user.id },
	).catch(() => null);
	const plan = await getUserPlan(req.user.id);
	const priorityOnly = req.query.priorityOnly === "true";
	if (priorityOnly) {
		await ensureEntitlement(
			req.user,
			"priority_search_ranking",
			"Premium plan required for priority search filter.",
		);
	}

	const estimateOnly = String(req.query.estimateOnly || "").toLowerCase() === "true";
	const cursor = Number.isFinite(Number(req.query.cursor))
		? Math.max(0, Math.floor(Number(req.query.cursor)))
		: 0;
	const limitRaw = Number.isFinite(Number(req.query.limit))
		? Math.floor(Number(req.query.limit))
		: 50;
	const limit = estimateOnly ? 0 : Math.min(50, Math.max(1, limitRaw));

	const advancedFilters = extractUsedAdvancedFilters(req.query);
	const quotaPreview =
		advancedFilters.length > 0
			? await getQuotaSnapshot(req.user.id, "products_search", plan)
			: null;

	if (advancedFilters.length > 0 && !canUseAdvancedFilters(plan)) {
		return res.status(403).json(
			buildLimitError({
				code: "upgrade_required",
				message: "Advanced filters require a premium plan",
				quota: quotaPreview,
				missingFilters: advancedFilters,
				upgradeRequired: true,
			}),
		);
	}

	let quotaUse = {
		allowed: true,
		quota: { action: "products_search", plan, unlimited: true },
	};
	if (advancedFilters.length > 0) {
		if (quotaPreview && quotaPreview.remaining <= 0) {
			return res.status(429).json(
				buildLimitError({
					code: "limit_reached",
					message: "Daily product search limit reached",
					quota: quotaPreview,
				}),
			);
		}
		quotaUse = estimateOnly
			? { allowed: true, quota: quotaPreview }
			: await consumeQuota(req.user.id, "products_search", plan);
		if (!quotaUse.allowed) {
			return res.status(429).json(
				buildLimitError({
					code: "limit_reached",
					message: "Daily product search limit reached",
					quota: quotaUse.quota,
				}),
			);
		}
	}

	const sort = String(req.query.sort || "relevance")
		.trim()
		.toLowerCase();
	const q = String(req.query.q || "").trim();
	const field = String(req.query.field || "")
		.trim()
		.toLowerCase();
	const searchTokens = buildSearchTokens(q);
	const wantedIndustry = String(req.query.industry || "")
		.trim()
		.toLowerCase();
	const wantedCountry = String(req.query.country || "")
		.trim()
		.toLowerCase();
	const wantedOrgType = String(req.query.orgType || "")
		.trim()
		.toLowerCase();
	const verifiedOnly = req.query.verifiedOnly === "true";
	const moqRange = String(req.query.moqRange || "").trim();
	const priceRange = String(req.query.priceRange || "").trim();
	const priceCurrency = String(req.query.priceCurrency || req.query.currency || "")
		.trim()
		.toUpperCase();
	const wantedCategories = parseList(req.query.category);
	const wantedCertificationsRaw = String(req.query.certifications || "").trim();
	const wantedCertifications = wantedCertificationsRaw
		? wantedCertificationsRaw
				.split(",")
				.map((c) => c.trim().toLowerCase())
				.filter(Boolean)
		: [];
	const leadTimeMax = parseNumber(req.query.leadTimeMax);
	const capacityMin = parseNumber(req.query.capacityMin);
	const gsmMin = parseNumber(req.query.gsmMin);
	const gsmMax = parseNumber(req.query.gsmMax);
	const wantedFabricTypes = parseList(req.query.fabricType);
	const wantedSizeRange = String(req.query.sizeRange || "")
		.trim()
		.toLowerCase();
	const wantedColorPantone = parseList(req.query.colorPantone);
	const wantedCustomization = parseList(req.query.customization);
	const sampleAvailable = req.query.sampleAvailable === "true";
	const sampleLeadTimeMax = parseNumber(req.query.sampleLeadTime);
	const wantedPaymentTerms = parseList(req.query.paymentTerms);
	const wantedDocumentReady = parseList(req.query.documentReady);
	const wantedAuditDate = String(req.query.auditDate || "")
		.trim()
		.toLowerCase();
	const wantedLanguage = parseList(req.query.languageSupport);
	const wantedSeason = String(req.query.season || "")
		.trim()
		.toLowerCase();
	const wantedMachinery = parseList(req.query.machinery);
	const wantedStockStatus = String(req.query.stockStatus || "")
		.trim()
		.toLowerCase();
	const minRating = Number.parseFloat(String(req.query.minRating || "").trim());
	const language = String(req.query.language || "")
		.trim()
		.toLowerCase();
	const wantedIncoterms = parseList(req.query.incoterms);
	const processes = parseList(req.query.processes);
	const yearsInBusinessMin = parseNumber(req.query.yearsInBusinessMin);
	const responseTimeMax = parseNumber(req.query.responseTimeMax);
	const teamSeatsMin = parseNumber(req.query.teamSeatsMin);
	const handlesMultipleFactoriesFilter =
		req.query.handlesMultipleFactories === undefined
			? null
			: parseBoolean(req.query.handlesMultipleFactories);
	const exportPorts = parseList(req.query.exportPort);
	const hasPermissionMatrixFilter =
		req.query.hasPermissionMatrix === undefined
			? null
			: parseBoolean(req.query.hasPermissionMatrix);
	const auditScoreMin = parseNumber(req.query.auditScoreMin);
	const permissionSection = String(req.query.permissionSection || "")
		.trim()
		.toLowerCase();
	const permissionSectionEdit =
		req.query.permissionSectionEdit === undefined
			? null
			: parseBoolean(req.query.permissionSectionEdit);
	const roleSeatsRaw = String(req.query.roleSeats || "").trim();
	const roleSeatsMap = {};
	if (roleSeatsRaw) {
		for (const part of roleSeatsRaw.split(",")) {
			const [roleRaw, seatsRaw] = String(part || "")
				.split(":")
				.map((s) => (s || "").trim());
			if (!roleRaw) {
				continue;
			}
			const n = parseNumber(seatsRaw);
			if (n !== null) {
				roleSeatsMap[String(roleRaw).toLowerCase()] = n;
			}
		}
	}
	const distanceKm = parseNumber(req.query.distanceKm);
	const locationLat = parseCoordinate(req.query.locationLat);
	const locationLng = parseCoordinate(req.query.locationLng);
	const distanceFilterActive = distanceKm !== null && locationLat !== null && locationLng !== null;
	const baseCurrency = await getBaseCurrency();
	let fxStale = false;
	let priceRangeBase = "";
	if (priceRange) {
		const parsed = parseRange(priceRange);
		const fromCurrency = priceCurrency || baseCurrency;
		const minConv =
			parsed.min === null
				? { amount: null, fx_stale: false }
				: await normalizeMoney(parsed.min, fromCurrency, baseCurrency);
		const maxConv =
			parsed.max === null
				? { amount: null, fx_stale: false }
				: await normalizeMoney(parsed.max, fromCurrency, baseCurrency);
		fxStale = Boolean(
			minConv.fx_stale ||
				maxConv.fx_stale ||
				(parsed.min !== null && minConv.amount === null) ||
				(parsed.max !== null && maxConv.amount === null),
		);
		const minText = minConv.amount === null ? "" : String(minConv.amount);
		const maxText = maxConv.amount === null ? "" : String(maxConv.amount);
		priceRangeBase = [minText, maxText].filter((v, idx) => v || idx === 0).join("-");
	}

	const openSearchReady = await isOpenSearchConfigured();
	const openSearchResult = openSearchReady
		? await searchOpenSearch({
				index: "products",
				query: q,
				cursor,
				limit,
				estimateOnly,
				filters: {
					industry: wantedIndustry,
					country: wantedCountry,
					orgType: wantedOrgType,
					verifiedOnly,
					category: wantedCategories,
					moqRange,
					priceRangeBase: priceRangeBase || priceRange,
					leadTimeMax,
					gsmMin,
					gsmMax,
					capacityMin,
					yearsInBusinessMin,
					responseTimeMax,
					teamSeatsMin,
					...(handlesMultipleFactoriesFilter === null
						? {}
						: { handlesMultipleFactories: handlesMultipleFactoriesFilter }),
					...(hasPermissionMatrixFilter === null
						? {}
						: { hasPermissionMatrix: hasPermissionMatrixFilter }),
					...(auditScoreMin === null ? {} : { auditScoreMin }),
					...(permissionSection ? { permissionSection } : {}),
					...(permissionSectionEdit === null ? {} : { permissionSectionEdit }),
					...(roleSeatsRaw ? { roleSeats: roleSeatsRaw } : {}),
					fabricType: wantedFabricTypes,
					certifications: wantedCertifications,
					incoterms: wantedIncoterms,
					paymentTerms: wantedPaymentTerms,
					documentReady: wantedDocumentReady,
					languageSupport: wantedLanguage,
					processes,
					exportPort: exportPorts,
					auditDate: wantedAuditDate,
					sizeRange: wantedSizeRange,
					colorPantone: wantedColorPantone,
					customization: wantedCustomization,
					sampleAvailable,
					sampleLeadTimeMax,
					locationLat,
					locationLng,
					distanceKm,
				},
			})
		: null;
	const openSearchIds = Array.isArray(openSearchResult?.ids)
		? openSearchResult.ids.map(String)
		: [];
	const _openSearchIdSet = openSearchIds.length > 0 ? new Set(openSearchIds) : null;
	const osEngine = openSearchResult?.engine || "database";

	const qdrantReady = q ? await isQdrantConfigured() : false;
	const qdrantResult = qdrantReady
		? await searchQdrant({
				type: "products",
				query: q,
				cursor,
				limit,
				filters: {
					country: wantedCountry,
					industry: wantedIndustry,
					category: wantedCategories,
				},
			})
		: null;
	const qdrantIds = Array.isArray(qdrantResult?.ids) ? qdrantResult.ids.map(String) : [];
	const qdrantScoreMap = new Map();
	if (qdrantIds.length > 0) {
		qdrantIds.forEach((id, i) => qdrantScoreMap.set(id, qdrantResult.scores[i]));
	}

	const combinedIds =
		qdrantIds.length > 0 ? [...new Set([...openSearchIds, ...qdrantIds])] : openSearchIds;
	const combinedIdSet = combinedIds.length > 0 ? new Set(combinedIds) : null;
	const engine =
		osEngine === "opensearch" && combinedIdSet
			? "opensearch"
			: qdrantResult?.engine === "qdrant"
				? "qdrant"
				: osEngine;

	if (estimateOnly && engine === "opensearch") {
		const resolvedFacets = openSearchResult?.facets
			? {
					...openSearchResult.facets,
					category: openSearchResult.facets.category || openSearchResult.facets.categories || {},
				}
			: {};
		return res.json({
			engine,
			cursor,
			limit,
			total: Number(openSearchResult?.total || 0),
			next_cursor: null,
			items: [],
			facets: resolvedFacets,
			...(openSearchResult?.error_code ? { error_code: openSearchResult.error_code } : {}),
			...buildSearchAccessPayload({
				action: "products_search",
				plan,
				quota: quotaUse.quota,
			}),
		});
	}

	const where = {};
	if (wantedCategories.length > 0) {
		where.category = { in: wantedCategories };
	}
	if (wantedIndustry) {
		where.industry = wantedIndustry;
	}
	if (q) {
		where.OR = [
			{ title: { contains: q, mode: "insensitive" } },
			{ category: { contains: q, mode: "insensitive" } },
			{ material: { contains: q, mode: "insensitive" } },
			{ description: { contains: q, mode: "insensitive" } },
		];
	}
	if (wantedCertifications.length > 0) {
		where.certifications = { hasSome: wantedCertifications };
	}
	const postedAfter = req.query.postedAfter ? new Date(req.query.postedAfter) : null;
	const postedBefore = req.query.postedBefore ? new Date(req.query.postedBefore) : null;
	if (postedAfter || postedBefore) {
		where.created_at = {};
		if (postedAfter) {
			where.created_at.gte = postedAfter;
		}
		if (postedBefore) {
			where.created_at.lte = postedBefore;
		}
	}
	if (distanceFilterActive) {
		const offset = distanceKm / 111;
		where.location_lat = {
			gte: locationLat - offset,
			lte: locationLat + offset,
		};
		where.location_lng = {
			gte: locationLng - offset,
			lte: locationLng + offset,
		};
	}
	if (Number.isFinite(minRating) || language) {
		let candidateCompanyIds = null;
		if (Number.isFinite(minRating)) {
			const highRated = await prisma.rating.groupBy({
				by: ["profile_key"],
				_avg: { score: true },
				having: { score: { _avg: { gte: minRating } } },
			});
			candidateCompanyIds = new Set(
				highRated.map((r) => r.profile_key.replace(/^user:/, "")).filter(Boolean),
			);
		}
		if (language) {
			const matchingUsers = await prisma.user.findMany({
				where: { profile: { path: ["language"], equals: language } },
				select: { id: true },
			});
			const langUserIds = new Set(matchingUsers.map((u) => u.id));
			if (candidateCompanyIds) {
				candidateCompanyIds = new Set([...candidateCompanyIds].filter((id) => langUserIds.has(id)));
			} else {
				candidateCompanyIds = langUserIds;
			}
		}
		if (candidateCompanyIds && candidateCompanyIds.size > 0) {
			where.company_id = { in: [...candidateCompanyIds] };
		} else if (candidateCompanyIds) {
			where.company_id = { in: [] };
		}
	}
	const all = await prisma.product.findMany({
		where,
		orderBy: { created_at: "desc" },
	});
	const companyIds = [...new Set(all.map((p) => p.company_id))];
	const [users, messages, boostMap, orderCertMap] = await Promise.all([
		companyIds.length > 0 ? prisma.user.findMany({ where: { id: { in: companyIds } } }) : [],
		prisma.message.findMany({ take: 0 }),
		getActiveBoostMap("feed"),
		getOrderCertificationMap(),
	]);
	const usersById = new Map(users.map((u) => [u.id, u]));
	const responseTimeByOwner = buildResponseTimeByOwner(messages, users);

	const results = all
		.map((p) => {
			const company = usersById.get(p.company_id) || null;
			const companyPremium = String(company?.subscription_status || "").toLowerCase() === "premium";
			const certification = company ? orderCertMap.get(String(company.id)) : null;
			const authorCountry = String(company?.profile?.country || "").trim();
			const profile = company?.profile || {};
			const paidBoostMultiplier = Number(boostMap?.[String(p.company_id)] || 1);
			const premiumBoostMultiplier = companyPremium ? 1.1 : 1;
			const effectiveBoost =
				(Number.isFinite(paidBoostMultiplier) ? paidBoostMultiplier : 1) * premiumBoostMultiplier;
			const boostActive = effectiveBoost > 1;
			const priorityScore =
				(companyPremium ? 2 : 0) + (company?.verified ? 0.5 : 0) + (boostActive ? 1.25 : 0);

			return {
				...p,
				author: company
					? {
							id: company.id,
							name: company.name,
							role: company.role,
							verified: Boolean(company.verified),
							premium: companyPremium,
							country: authorCountry,
							industry: String(profile?.industry || ""),
							certifications: Array.isArray(profile?.certifications) ? profile.certifications : [],
							monthly_capacity: profile?.monthly_capacity || "",
							lead_time_days: profile?.lead_time_days || "",
							payment_terms: profile?.payment_terms || "",
							document_ready: profile?.document_ready || "",
							audit_date: profile?.audit_date || "",
							language_support: profile?.language_support || "",
							incoterms: profile?.incoterms || "",
							main_processes: Array.isArray(profile?.main_processes) ? profile.main_processes : [],
							years_in_business: profile?.years_in_business || "",
							handles_multiple_factories: Boolean(profile?.handles_multiple_factories),
							team_seats: profile?.team_seats || "",
							export_ports: Array.isArray(profile?.export_ports) ? profile.export_ports : [],
							location_lat: profile?.location_lat ?? "",
							location_lng: profile?.location_lng ?? "",
							avg_response_hours: responseTimeByOwner.get(String(company.id)) ?? null,
							order_certification_status: certification?.status || "",
							permission_matrix: profile?.permission_matrix || company?.permission_matrix || null,
							has_permission_matrix: Boolean(
								profile?.permission_matrix || company?.permission_matrix,
							),
							role_seats:
								profile?.role_seats ||
								profile?.roleSeats ||
								profile?.permission_matrix?.members?.seats ||
								null,
							audit_score: computeAuditScore(company, certification),
						}
					: {
							id: p.company_id,
							name: "Unknown company",
							role: "factory",
							verified: false,
							country: "",
						},
				profile_key: `user:${p.company_id}`,
				priority_score: priorityScore,
				priority_active: companyPremium || boostActive,
				boost_active: boostActive,
				boost_multiplier: Number.isFinite(effectiveBoost) ? Number(effectiveBoost.toFixed(2)) : 1,
			};
		})
		.filter((p) => {
			if (combinedIdSet) {
				if (!combinedIdSet.has(String(p.id))) {
					return false;
				}
				if (priorityOnly && !p.priority_active) {
					return false;
				}
				return true;
			}
			if (priorityOnly && !p.priority_active) {
				return false;
			}
			if (searchTokens.length > 0) {
				if (field === "buyer") {
					const nameText = normalizeSearchText(p.author?.name || "");
					const hit = searchTokens.every((token) => nameText.includes(token));
					if (!hit) {
						return false;
					}
				} else if (field === "company") {
					const companyText = normalizeSearchText(
						p.author?.name || p.author?.company_name || p.name || "",
					);
					const hit = searchTokens.every((token) => companyText.includes(token));
					if (!hit) {
						return false;
					}
				} else {
					const searchText = normalizeSearchText(
						`${p.title} ${p.category} ${p.material} ${p.description} ${p.color_pantone || ""} ${p.size_range || ""}`,
					);
					const hit = searchTokens.every((token) => searchText.includes(token));
					if (!hit) {
						return false;
					}
				}
			}
			if (wantedCategories.length > 0) {
				const categoryValue = String(p.category || "").toLowerCase();
				if (!wantedCategories.includes(categoryValue)) {
					return false;
				}
			}
			if (wantedIndustry) {
				const productIndustry = String(p.industry || "").toLowerCase();
				const authorIndustry = String(p.author?.industry || "").toLowerCase();
				if (productIndustry !== wantedIndustry && authorIndustry !== wantedIndustry) {
					return false;
				}
			}
			if (wantedOrgType && String(p.author?.role || "").toLowerCase() !== wantedOrgType) {
				return false;
			}
			if (wantedCountry && String(p.author?.country || "").toLowerCase() !== wantedCountry) {
				return false;
			}
			if (verifiedOnly && !p.author?.verified) {
				return false;
			}
			if (moqRange && !matchesMoqRange(moqRange, p.moq)) {
				return false;
			}
			if (priceRangeBase) {
				const normalizedMin = Number.isFinite(Number(p.priceBaseMin))
					? Number(p.priceBaseMin)
					: Number(p.priceNormalizedBase);
				const normalizedMax = Number.isFinite(Number(p.priceBaseMax))
					? Number(p.priceBaseMax)
					: Number(p.priceNormalizedBase);
				if (Number.isFinite(normalizedMin) || Number.isFinite(normalizedMax)) {
					const synthetic = `${Number.isFinite(normalizedMin) ? normalizedMin : ""}-${Number.isFinite(normalizedMax) ? normalizedMax : ""}`;
					if (!rangesOverlap(priceRangeBase, synthetic)) {
						return false;
					}
				} else if (!rangesOverlap(priceRange, p.price_range || "")) {
					return false;
				}
			}
			if (leadTimeMax !== null) {
				const lead = parseNumber(p.lead_time_days || p.author?.lead_time_days || "");
				if (lead === null || lead > leadTimeMax) {
					return false;
				}
			}
			if (capacityMin !== null) {
				const cap = parseNumber(p.author?.monthly_capacity || "");
				if (cap === null || cap < capacityMin) {
					return false;
				}
			}
			if (gsmMin !== null || gsmMax !== null) {
				const gsm = parseNumber(p.fabric_gsm || "");
				if (gsm === null) {
					return false;
				}
				if (gsmMin !== null && gsm < gsmMin) {
					return false;
				}
				if (gsmMax !== null && gsm > gsmMax) {
					return false;
				}
			}
			if (wantedCertifications.length > 0) {
				const authorCerts = Array.isArray(p.author?.certifications)
					? p.author.certifications.map((c) => String(c).toLowerCase())
					: [];
				const hit = wantedCertifications.some((c) => authorCerts.includes(c));
				if (!hit) {
					return false;
				}
			}
			if (wantedFabricTypes.length > 0) {
				const material = String(p.material || "").toLowerCase();
				const hit = wantedFabricTypes.some((fabric) => material.includes(fabric));
				if (!hit) {
					return false;
				}
			}
			if (
				wantedSizeRange &&
				!String(p.size_range || "")
					.toLowerCase()
					.includes(wantedSizeRange)
			) {
				return false;
			}
			if (wantedColorPantone.length > 0) {
				const color = String(p.color_pantone || "").toLowerCase();
				const hit = wantedColorPantone.some((code) => color.includes(code));
				if (!hit) {
					return false;
				}
			}
			if (wantedCustomization.length > 0) {
				const customization = String(p.customization_capabilities || "").toLowerCase();
				const hit = wantedCustomization.some((entry) => customization.includes(entry));
				if (!hit) {
					return false;
				}
			}
			if (sampleAvailable) {
				const available = String(p.sample_available || "").toLowerCase();
				if (!(available === "true" || available === "yes" || p.sample_lead_time_days)) {
					return false;
				}
			}
			if (sampleLeadTimeMax !== null) {
				const sampleLead = parseNumber(p.sample_lead_time_days || "");
				if (sampleLead === null || sampleLead > sampleLeadTimeMax) {
					return false;
				}
			}
			if (wantedPaymentTerms.length > 0) {
				const payment = String(p.author?.payment_terms || "").toLowerCase();
				const hit = wantedPaymentTerms.some((term) => payment.includes(term));
				if (!hit) {
					return false;
				}
			}
			if (wantedDocumentReady.length > 0) {
				const doc = String(p.author?.document_ready || "").toLowerCase();
				const hit = wantedDocumentReady.some((term) => doc.includes(term));
				if (!hit) {
					return false;
				}
			}
			if (wantedAuditDate && String(p.author?.audit_date || "").toLowerCase() !== wantedAuditDate) {
				return false;
			}
			if (wantedLanguage.length > 0) {
				const lang = String(p.author?.language_support || "").toLowerCase();
				const hit = wantedLanguage.some((term) => lang.includes(term));
				if (!hit) {
					return false;
				}
			}
			if (wantedIncoterms.length > 0) {
				const incoterm = String(p.author?.incoterms || "").toLowerCase();
				const hit = wantedIncoterms.some((term) => incoterm.includes(term));
				if (!hit) {
					return false;
				}
			}
			if (processes.length > 0) {
				const authorProcesses = Array.isArray(p.author?.main_processes)
					? p.author.main_processes.map((proc) => String(proc).toLowerCase())
					: [];
				const hit = processes.some((proc) => authorProcesses.includes(proc));
				if (!hit) {
					return false;
				}
			}
			if (yearsInBusinessMin !== null) {
				const years = parseNumber(p.author?.years_in_business || "");
				if (years === null || years < yearsInBusinessMin) {
					return false;
				}
			}
			if (teamSeatsMin !== null) {
				const seats = parseNumber(p.author?.team_seats || "");
				if (seats === null || seats < teamSeatsMin) {
					return false;
				}
			}
			if (roleSeatsMap && Object.keys(roleSeatsMap).length > 0) {
				const profileRoleSeats = p.author?.role_seats || p.author?.roleSeats || {};
				const permMemberSeats = p.author?.permission_matrix?.members?.seats || null;
				for (const [roleKey, minSeats] of Object.entries(roleSeatsMap)) {
					let ownerSeats = null;
					if (profileRoleSeats && profileRoleSeats[roleKey] !== undefined) {
						ownerSeats = parseNumber(profileRoleSeats[roleKey]);
					} else if (permMemberSeats && permMemberSeats[roleKey] !== undefined) {
						ownerSeats = parseNumber(permMemberSeats[roleKey]);
					} else {
						ownerSeats = parseNumber(p.author?.team_seats || "");
					}
					if (!Number.isFinite(ownerSeats) || ownerSeats < minSeats) {
						return false;
					}
				}
			}
			if (
				handlesMultipleFactoriesFilter !== null &&
				Boolean(p.author?.handles_multiple_factories) !== handlesMultipleFactoriesFilter
			) {
				return false;
			}
			if (hasPermissionMatrixFilter !== null) {
				const hasPerm = Boolean(p.author?.has_permission_matrix);
				if (hasPermissionMatrixFilter !== hasPerm) {
					return false;
				}
			}
			if (permissionSection) {
				const pm = p.author?.permission_matrix || null;
				const sec = pm?.[permissionSection] ? pm[permissionSection] : null;
				const hasView = Boolean(sec?.view);
				const hasEdit = Boolean(sec?.edit);
				if (permissionSectionEdit === null) {
					if (!(hasView || hasEdit)) {
						return false;
					}
				} else if (permissionSectionEdit === true) {
					if (!hasEdit) {
						return false;
					}
				} else if (permissionSectionEdit === false && !hasView) {
					return false;
				}
			}
			if (auditScoreMin !== null) {
				const score = Number(p.author?.audit_score);
				if (!Number.isFinite(score) || score < auditScoreMin) {
					return false;
				}
			}
			if (exportPorts.length > 0) {
				const authorPorts = Array.isArray(p.author?.export_ports)
					? p.author.export_ports.map((port) => String(port).toLowerCase())
					: [];
				const hit = exportPorts.some((port) => authorPorts.includes(port));
				if (!hit) {
					return false;
				}
			}
			if (responseTimeMax !== null) {
				const avg = Number(p.author?.avg_response_hours);
				if (!Number.isFinite(avg) || avg > responseTimeMax) {
					return false;
				}
			}
			if (distanceFilterActive) {
				const authorLat = parseCoordinate(p.author?.location_lat);
				const authorLng = parseCoordinate(p.author?.location_lng);
				if (authorLat !== null && authorLng !== null) {
					const distance = haversineDistanceKm(locationLat, locationLng, authorLat, authorLng);
					if (!Number.isFinite(distance) || distance > distanceKm) {
						return false;
					}
				} else if (!wantedCountry) {
					return false;
				}
			}
			if (wantedSeason) {
				const season = String(p.season || "").toLowerCase();
				if (season !== wantedSeason) {
					return false;
				}
			}
			if (wantedMachinery.length > 0) {
				const machinery = String(
					p.machinery || p.equipment || p.author?.machinery || "",
				).toLowerCase();
				const hit = wantedMachinery.some((m) => machinery.includes(m));
				if (!hit) {
					return false;
				}
			}
			if (wantedStockStatus) {
				const status = String(
					p.stock_status || p.availability || p.author?.stock_status || "",
				).toLowerCase();
				if (status !== wantedStockStatus) {
					return false;
				}
			}
			return true;
		});

	const sortedResults = results.sort((a, b) => {
		if (sort === "newest") {
			const aCreated = new Date(a.created_at || "").getTime();
			const bCreated = new Date(b.created_at || "").getTime();
			if (Number.isFinite(aCreated) && Number.isFinite(bCreated)) {
				return bCreated - aCreated;
			}
			return 0;
		}
		if (sort === "price_asc") {
			const aPrice = Number(a.priceBaseMin || a.priceNormalizedBase || 0);
			const bPrice = Number(b.priceBaseMin || b.priceNormalizedBase || 0);
			return aPrice - bPrice;
		}
		if (sort === "price_desc") {
			const aPrice = Number(a.priceBaseMin || a.priceNormalizedBase || 0);
			const bPrice = Number(b.priceBaseMin || b.priceNormalizedBase || 0);
			return bPrice - aPrice;
		}
		if (sort === "moq_asc") {
			const aMoq = Number(a.moq || 0);
			const bMoq = Number(b.moq || 0);
			return aMoq - bMoq;
		}
		if (a.priority_score !== b.priority_score) {
			return b.priority_score - a.priority_score;
		}
		const aCreated = new Date(a.created_at || "").getTime();
		const bCreated = new Date(b.created_at || "").getTime();
		if (Number.isFinite(aCreated) && Number.isFinite(bCreated)) {
			return bCreated - aCreated;
		}
		return 0;
	});

	const orderedResults = (() => {
		if (!(combinedIdSet || qdrantScoreMap.size > 0)) {
			return sortedResults;
		}

		if (qdrantScoreMap.size > 0 && !combinedIdSet) {
			return [...sortedResults].sort(
				(a, b) => (qdrantScoreMap.get(b.id) || 0) - (qdrantScoreMap.get(a.id) || 0),
			);
		}

		const byId = new Map(sortedResults.map((row) => [String(row.id), row]));
		return combinedIds.map((id) => byId.get(String(id))).filter(Boolean);
	})();

	const useReranker = q && orderedResults.length > 1 ? await isRerankerConfigured() : false;
	const rerankedResults = useReranker ? await rerankIds(q, orderedResults) : orderedResults;

	const totalMatched =
		engine === "opensearch" && !useReranker
			? Number(openSearchResult?.total || 0)
			: rerankedResults.length;
	const pagedItems =
		engine === "opensearch" && !useReranker
			? rerankedResults
			: rerankedResults.slice(cursor, cursor + limit);
	const nextCursor = estimateOnly
		? null
		: engine === "opensearch" && !useReranker
			? cursor + combinedIds.length < totalMatched
				? cursor + combinedIds.length
				: null
			: cursor + pagedItems.length < totalMatched
				? cursor + pagedItems.length
				: null;

	const facets = orderedResults.reduce(
		(acc, row) => {
			const category = String(row.category || "Other");
			const country = String(row.author?.country || "Unknown");
			acc.categories[category] = (acc.categories[category] || 0) + 1;
			acc.countries[country] = (acc.countries[country] || 0) + 1;
			acc.verified[row.author?.verified ? "verified" : "unverified"] += 1;
			const material = String(row.material || "").trim();
			if (material) {
				acc.fabricType[material] = (acc.fabricType[material] || 0) + 1;
			}
			const certifications = Array.isArray(row.author?.certifications)
				? row.author.certifications
				: [];
			certifications.forEach((cert) => {
				const key = String(cert || "Other");
				acc.certifications[key] = (acc.certifications[key] || 0) + 1;
			});
			const incoterm = String(row.author?.incoterms || "").trim();
			if (incoterm) {
				acc.incoterms[incoterm] = (acc.incoterms[incoterm] || 0) + 1;
			}
			const payment = String(row.author?.payment_terms || "").trim();
			if (payment) {
				acc.paymentTerms[payment] = (acc.paymentTerms[payment] || 0) + 1;
			}
			const documentReady = String(row.author?.document_ready || "").trim();
			if (documentReady) {
				acc.documentReady[documentReady] = (acc.documentReady[documentReady] || 0) + 1;
			}
			const language = String(row.author?.language_support || "").trim();
			if (language) {
				acc.languageSupport[language] = (acc.languageSupport[language] || 0) + 1;
			}
			const processesList = Array.isArray(row.author?.main_processes)
				? row.author.main_processes
				: [];
			processesList.forEach((proc) => {
				const key = String(proc || "Other");
				acc.processes[key] = (acc.processes[key] || 0) + 1;
			});
			const exportPortsList = Array.isArray(row.author?.export_ports)
				? row.author.export_ports
				: [];
			exportPortsList.forEach((port) => {
				const key = String(port || "Other");
				acc.export_ports[key] = (acc.export_ports[key] || 0) + 1;
			});
			const responseBucket = bucketResponseTime(Number(row.author?.avg_response_hours));
			acc.response_time[responseBucket] = (acc.response_time[responseBucket] || 0) + 1;
			const yearsBucket = bucketYearsInBusiness(row.author?.years_in_business);
			acc.years_in_business[yearsBucket] = (acc.years_in_business[yearsBucket] || 0) + 1;
			const seatsBucket = bucketTeamSeats(row.author?.team_seats);
			acc.team_seats[seatsBucket] = (acc.team_seats[seatsBucket] || 0) + 1;
			const handlesKey = row.author?.handles_multiple_factories ? "true" : "false";
			acc.handles_multiple_factories[handlesKey] =
				(acc.handles_multiple_factories[handlesKey] || 0) + 1;
			return acc;
		},
		{
			categories: {},
			countries: {},
			verified: { verified: 0, unverified: 0 },
			processes: {},
			export_ports: {},
			response_time: {},
			years_in_business: {},
			team_seats: {},
			handles_multiple_factories: {},
			fabricType: {},
			certifications: {},
			incoterms: {},
			paymentTerms: {},
			documentReady: {},
			languageSupport: {},
		},
	);

	const cappedFacets = {
		...facets,
		category: facets.categories || facets.category || {},
		processes: topFacetEntries(facets.processes, 8),
		export_ports: topFacetEntries(facets.export_ports, 8),
	};

	const resolvedFacets = openSearchResult?.facets
		? {
				...openSearchResult.facets,
				category: openSearchResult.facets.category || openSearchResult.facets.categories || {},
			}
		: cappedFacets;

	const facetCounts = { categories: [], countries: [] };
	if (orderedResults.length < 100) {
		const catCounts = {};
		const countryCounts = {};
		orderedResults.forEach((row) => {
			const cat = row.category || "Other";
			catCounts[cat] = (catCounts[cat] || 0) + 1;
			const country = row.author?.country || "Unknown";
			countryCounts[country] = (countryCounts[country] || 0) + 1;
		});
		facetCounts.categories = Object.entries(catCounts)
			.sort((a, b) => b[1] - a[1])
			.slice(0, 20)
			.map(([value, count]) => ({ value, count }));
		facetCounts.countries = Object.entries(countryCounts)
			.sort((a, b) => b[1] - a[1])
			.slice(0, 20)
			.map(([value, count]) => ({ value, count }));
	}

	return res.json({
		engine,
		cursor,
		limit,
		total: totalMatched,
		next_cursor: nextCursor,
		items: pagedItems,
		facets: resolvedFacets,
		facetCounts,
		...(openSearchResult?.error_code ? { error_code: openSearchResult.error_code } : {}),
		...buildSearchAccessPayload({
			action: "products_search",
			plan,
			quota: quotaUse.quota,
		}),
		fx: {
			base_currency: baseCurrency,
			filter_currency: priceCurrency || baseCurrency,
			fx_stale: fxStale,
		},
	});
}

export async function updateProduct(req, res) {
	const actor = await resolveActor(req);
	const updated = await updateProductById(actor, req.params.productId, req.body || {});
	if (updated === "forbidden") {
		return res.status(403).json({ error: "Forbidden" });
	}
	if (!updated) {
		return res.status(404).json({ error: "Product not found" });
	}
	return res.json(updated);
}

export async function deleteProduct(req, res) {
	const actor = await resolveActor(req);
	const removed = await removeProduct(actor, req.params.productId);
	if (removed === "forbidden") {
		return res.status(403).json({ error: "Forbidden" });
	}
	if (!removed) {
		return res.status(404).json({ error: "Product not found" });
	}
	return res.json({ ok: true });
}

export async function recordProductView(req, res) {
	const ip = extractClientIp(req);
	const geo = ip ? await locateIp(ip) : null;
	const result = await recordView(req.user.id, req.params.productId, {
		windowMinutes: 10,
		geo,
	});
	if (result === "not_found") {
		return res.status(404).json({ error: "Product not found" });
	}
	return res.status(201).json(result);
}

export async function getMyViewedProducts(req, res) {
	const cursor = Number.isFinite(Number(req.query.cursor))
		? Math.max(0, Math.floor(Number(req.query.cursor)))
		: 0;
	const limitRaw = Number.isFinite(Number(req.query.limit))
		? Math.floor(Number(req.query.limit))
		: 10;
	const limit = Math.min(50, Math.max(1, limitRaw));
	return res.json(await listMyProductViews(req.user.id, { cursor, limit }));
}
