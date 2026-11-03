import {
	getBuyerRegionFromCountry,
	getVerificationRequirements,
	isEuCountry,
	VERIFICATION_FIELD_LABELS,
} from "../../shared/config/platformTaxonomy.js";
import { logInfo } from "../utils/logger.js";
import prisma from "../utils/prisma.js";
import { sanitizeString } from "../utils/validators.js";
import { createNotification } from "./notificationService.js";

const fieldAliases = {
	tin: ["tin", "tin_or_ein"],
	ein: ["ein", "tin_or_ein"],
	erc: ["erc", "erc_or_eori"],
	eori: ["eori", "erc_or_eori"],
};

const REVIEW_STATUSES = new Set([
	"pending",
	"approved",
	"rejected",
	"incomplete",
	"expired",
	"duplicate_review",
]);
const DUPLICATE_FIELDS = [
	"company_registration",
	"vat",
	"ein",
	"eori",
	"bank_proof",
	"erc",
	"tin",
	"trade_license",
];

const DUPLICATE_SIGNAL_WEIGHTS = {
	name: 34,
	country: 18,
	address: 16,
	website: 14,
	email_domain: 14,
	phone: 12,
	identifier: 50,
	logo: 8,
	banner: 6,
};

const EXACT_IDENTIFIER_FIELDS = [
	"business_registration_number",
	"business_registration",
	"company_registration",
	"company_registration_id",
	"government_company_registration_id",
	"gov_company_registration_id",
	"tax_id",
	"tax_registration",
	"vat_number",
	"vat",
	"eori",
	"ein",
	"ior",
	"tin",
	"erc",
];

function normalizeReviewStatus(value, fallback = "pending") {
	const status = sanitizeString(String(value || ""), 20).toLowerCase();
	return REVIEW_STATUSES.has(status) ? status : fallback;
}

function emptyDocs() {
	return {
		company_registration: "",
		trade_license: "",
		tin: "",
		ein: "",
		vat: "",
		eori: "",
		ior: "",
		authorized_person_nid: "",
		bank_proof: "",
		erc: "",
		tin_or_ein: "",
		erc_or_eori: "",
		buyer_country: "",
		optional_licenses: [],
	};
}

function sanitizeDocsPatch(documentsPatch = {}) {
	const entries = Object.entries(documentsPatch);
	const out = {};

	for (const [key, value] of entries) {
		if (key === "optional_licenses") {
			const values = Array.isArray(value) ? value : [value];
			out.optional_licenses = values
				.map((v) => sanitizeString(String(v || ""), 240))
				.filter(Boolean);
			continue;
		}

		out[key] = sanitizeString(String(value || ""), 240);
	}

	return out;
}

function normalizeBuyerCountry(rawCountry) {
	return sanitizeString(String(rawCountry || ""), 60);
}

function validateBuyerGeography(role, docs, buyerRegion) {
	if (role !== "buyer") {
		return;
	}

	const buyerCountry = normalizeBuyerCountry(docs?.buyer_country);
	const countryIsEu = isEuCountry(buyerCountry);

	if (countryIsEu && buyerRegion !== "EU") {
		const err = new Error("Selected buyer country is in the EU. Set buyer_region to EU.");
		err.statusCode = 400;
		throw err;
	}

	if (buyerRegion === "EU" && !countryIsEu) {
		const err = new Error(
			"buyer_region=EU requires selecting a valid EU country in buyer_country.",
		);
		err.statusCode = 400;
		throw err;
	}
}

function normalizeBuyerRegion(rawRegion) {
	const region = sanitizeString(String(rawRegion || ""), 20).toUpperCase();
	return ["EU", "USA", "OTHER"].includes(region) ? region : "OTHER";
}

function hasDocument(docs, field) {
	const possibleFields = fieldAliases[field] || [field];
	return possibleFields.some((name) => Boolean(docs?.[name]));
}

function normalizeDocValue(value) {
	return sanitizeString(String(value || ""), 240).toLowerCase();
}

function normalizeLooseText(value) {
	return sanitizeString(String(value || ""), 240)
		.toLowerCase()
		.replace(/[\u2018\u2019\u201a\u201b]/g, "'")
		.replace(/[\u201c\u201d\u201e]/g, '"')
		.replace(/[^a-z0-9@.+/_&\- ]+/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

function normalizeComparableName(value) {
	return normalizeLooseText(value)
		.replace(
			/\b(the|and|co|company|inc|ltd|limited|llc|corp|corporation|group|international)\b/g,
			" ",
		)
		.replace(/\s+/g, " ")
		.trim();
}

function extractDomain(value) {
	const raw = normalizeLooseText(value);
	if (!raw) {
		return "";
	}
	const withProtocol = raw.includes("://") ? raw : `https://${raw}`;
	try {
		return new URL(withProtocol).hostname.replace(/^www\./, "").toLowerCase();
	} catch {
		const match = raw.match(/([a-z0-9.-]+\.[a-z]{2,})(?:\/|$)/i);
		return match ? match[1].replace(/^www\./, "").toLowerCase() : "";
	}
}

function normalizePhone(value) {
	return String(value || "").replace(/\D+/g, "");
}

function normalizeEmailDomain(value) {
	const email = normalizeLooseText(value);
	const parts = email.split("@");
	return parts.length === 2 ? parts[1].replace(/^www\./, "").trim() : "";
}

function collapseSpaces(value) {
	return String(value || "")
		.replace(/\s+/g, " ")
		.trim();
}

function levenshteinDistance(a = "", b = "") {
	const left = String(a || "");
	const right = String(b || "");
	const m = left.length;
	const n = right.length;
	if (!m) {
		return n;
	}
	if (!n) {
		return m;
	}
	const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
	for (let i = 0; i <= m; i += 1) {
		dp[i][0] = i;
	}
	for (let j = 0; j <= n; j += 1) {
		dp[0][j] = j;
	}
	for (let i = 1; i <= m; i += 1) {
		for (let j = 1; j <= n; j += 1) {
			dp[i][j] =
				left[i - 1] === right[j - 1]
					? dp[i - 1][j - 1]
					: 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
		}
	}
	return dp[m][n];
}

function similarityScore(a = "", b = "") {
	const left = normalizeComparableName(a);
	const right = normalizeComparableName(b);
	if (!(left && right)) {
		return 0;
	}
	if (left === right) {
		return 1;
	}
	const max = Math.max(left.length, right.length);
	if (!max) {
		return 0;
	}
	const distance = levenshteinDistance(left, right);
	return Math.max(0, 1 - distance / max);
}

function getUserCompanyName(user = {}) {
	return collapseSpaces(
		user?.profile?.brand_name ||
			user?.profile?.organization_name ||
			user?.company_name ||
			user?.name ||
			"",
	);
}

function getUserCompanySnapshot(user = {}) {
	const profile = user?.profile || {};
	return {
		id: String(user?.id || ""),
		name: getUserCompanyName(user),
		company_name: getUserCompanyName(user),
		role: String(user?.role || ""),
		verified: Boolean(user?.verified),
		country: collapseSpaces(profile.country || user?.country || user?.region || ""),
		address: collapseSpaces(
			profile.registered_address ||
				profile.business_address ||
				profile.address ||
				profile.company_address ||
				"",
		),
		website: extractDomain(
			profile.brand_website || profile.website || profile.company_website || "",
		),
		email_domain: normalizeEmailDomain(
			user?.email || profile.business_email || profile.contact_email || "",
		),
		phone: normalizePhone(profile.phone || profile.account_manager_phone || user?.phone || ""),
		logo: String(profile.brand_logo_url || profile.logo_url || profile.avatar_url || ""),
		banner: String(profile.brand_cover_url || profile.banner_url || ""),
		identifiers: {
			business_registration_number: collapseSpaces(
				profile.business_registration_number ||
					profile.business_registration ||
					profile.company_registration ||
					"",
			),
			vat_number: collapseSpaces(profile.vat_number || profile.vat || ""),
			eori: collapseSpaces(profile.eori || ""),
			ein: collapseSpaces(profile.ein || ""),
			ior: collapseSpaces(profile.ior || ""),
			tax_id: collapseSpaces(profile.tax_id || profile.tax_registration || ""),
			government_company_registration_id: collapseSpaces(
				profile.government_company_registration_id || profile.company_registration_id || "",
			),
		},
	};
}

function normalizeIdentifierValue(value) {
	return normalizeLooseText(value).replace(/[\s-]/g, "");
}

function buildVerificationIdentifierMap(documents = {}, profile = {}) {
	const values = {
		business_registration_number:
			documents.business_registration_number ||
			documents.business_registration ||
			documents.company_registration ||
			profile.business_registration_number ||
			profile.business_registration ||
			profile.company_registration ||
			"",
		business_registration:
			documents.business_registration ||
			documents.business_registration_number ||
			documents.company_registration ||
			profile.business_registration ||
			profile.business_registration_number ||
			profile.company_registration ||
			"",
		company_registration:
			documents.company_registration ||
			documents.company_registration_id ||
			profile.company_registration ||
			profile.company_registration_id ||
			"",
		company_registration_id:
			documents.company_registration_id ||
			profile.company_registration_id ||
			profile.government_company_registration_id ||
			"",
		government_company_registration_id:
			documents.government_company_registration_id ||
			profile.government_company_registration_id ||
			profile.company_registration_id ||
			"",
		gov_company_registration_id:
			documents.gov_company_registration_id || profile.gov_company_registration_id || "",
		tax_id:
			documents.tax_id ||
			documents.tax_registration ||
			profile.tax_id ||
			profile.tax_registration ||
			"",
		tax_registration:
			documents.tax_registration ||
			documents.tax_id ||
			profile.tax_registration ||
			profile.tax_id ||
			"",
		vat_number: documents.vat_number || documents.vat || profile.vat_number || profile.vat || "",
		vat: documents.vat || documents.vat_number || profile.vat || profile.vat_number || "",
		eori: documents.eori || profile.eori || "",
		ein: documents.ein || profile.ein || "",
		ior: documents.ior || profile.ior || "",
		tin: documents.tin || profile.tin || "",
		erc: documents.erc || profile.erc || "",
	};

	return Object.fromEntries(
		Object.entries(values)
			.map(([key, value]) => [key, normalizeIdentifierValue(value)])
			.filter(([, value]) => Boolean(value)),
	);
}

function getExactMatchFields(applicantMap, candidateMap) {
	return EXACT_IDENTIFIER_FIELDS.filter((field) => {
		const left = applicantMap[field];
		const right = candidateMap[field];
		return Boolean(left && right && left === right);
	});
}

function computeCompanyDuplicateMatch(applicantUser, candidateUser, verificationRecord) {
	const applicantProfile = applicantUser?.profile || {};
	const candidateProfile = candidateUser?.profile || {};
	const applicantDocs = verificationRecord?.documents || {};
	const candidateVerification = candidateUser?.verification || {};
	const candidateDocs = candidateVerification?.documents || {};
	const applicantIdentifierMap = buildVerificationIdentifierMap(applicantDocs, applicantProfile);
	const candidateIdentifierMap = buildVerificationIdentifierMap(candidateDocs, candidateProfile);
	const exactFields = getExactMatchFields(applicantIdentifierMap, candidateIdentifierMap);
	if (exactFields.length > 0) {
		const bestField = exactFields[0];
		return {
			tier: "exact",
			score: 100,
			field: bestField,
			reason: "exact_legal_identifier_match",
			matched_fields: exactFields,
		};
	}

	const applicantName = getUserCompanyName(applicantUser);
	const candidateName = getUserCompanyName(candidateUser);
	const nameScore = similarityScore(applicantName, candidateName);
	if (!nameScore) {
		return null;
	}

	const checks = {
		name: nameScore,
		country:
			normalizeComparableName(applicantProfile.country || verificationRecord?.buyer_region || "") &&
			normalizeComparableName(
				applicantProfile.country || verificationRecord?.buyer_region || "",
			) === normalizeComparableName(candidateProfile.country || candidateUser?.country || ""),
		address: similarityScore(
			applicantProfile.registered_address ||
				applicantProfile.business_address ||
				applicantProfile.address ||
				applicantProfile.company_address ||
				"",
			candidateProfile.registered_address ||
				candidateProfile.business_address ||
				candidateProfile.address ||
				candidateProfile.company_address ||
				"",
		),
		website:
			extractDomain(
				applicantProfile.brand_website ||
					applicantProfile.website ||
					applicantProfile.company_website ||
					"",
			) &&
			extractDomain(
				applicantProfile.brand_website ||
					applicantProfile.website ||
					applicantProfile.company_website ||
					"",
			) ===
				extractDomain(
					candidateProfile.brand_website ||
						candidateProfile.website ||
						candidateProfile.company_website ||
						"",
				),
		email_domain:
			normalizeEmailDomain(
				applicantUser?.email ||
					applicantProfile.business_email ||
					applicantProfile.contact_email ||
					"",
			) &&
			normalizeEmailDomain(
				applicantUser?.email ||
					applicantProfile.business_email ||
					applicantProfile.contact_email ||
					"",
			) ===
				normalizeEmailDomain(
					candidateUser?.email ||
						candidateProfile.business_email ||
						candidateProfile.contact_email ||
						"",
				),
		phone:
			normalizePhone(applicantProfile.phone || applicantProfile.account_manager_phone || "") &&
			normalizePhone(applicantProfile.phone || applicantProfile.account_manager_phone || "") ===
				normalizePhone(candidateProfile.phone || candidateProfile.account_manager_phone || ""),
		logo:
			String(applicantProfile.brand_logo_url || applicantProfile.logo_url || "") &&
			String(applicantProfile.brand_logo_url || applicantProfile.logo_url || "") ===
				String(candidateProfile.brand_logo_url || candidateProfile.logo_url || ""),
		banner:
			String(applicantProfile.brand_cover_url || applicantProfile.banner_url || "") &&
			String(applicantProfile.brand_cover_url || applicantProfile.banner_url || "") ===
				String(candidateProfile.brand_cover_url || candidateProfile.banner_url || ""),
	};

	const positiveSignals = ["country", "website", "email_domain", "phone", "logo", "banner"].filter(
		(key) => Boolean(checks[key]),
	).length;

	const strongMatch =
		nameScore >= 0.96 &&
		positiveSignals >= 3 &&
		(Boolean(checks.country) || Boolean(checks.website) || Boolean(checks.email_domain));

	if (strongMatch) {
		return {
			tier: "strong",
			score: Math.round(Math.min(99, nameScore * 100 + positiveSignals * 3)),
			field: positiveSignals >= 4 ? "multi-field" : "name",
			reason: "strong_duplicate_signal",
			matched_fields: Object.entries(checks)
				.filter(([, value]) => Boolean(value))
				.map(([key]) => key),
		};
	}

	if (nameScore >= 0.82) {
		return {
			tier: "weak",
			score: Math.round(nameScore * 100),
			field: "name",
			reason: "weak_name_similarity",
			matched_fields: ["name"],
		};
	}

	return null;
}

export async function findCompanyDuplicateCandidate(user, verificationRecord) {
	const applicantSnapshot = getUserCompanySnapshot(user);
	if (!applicantSnapshot.name) {
		return null;
	}

	const [users, verifications] = await Promise.all([
		prisma.user.findMany({
			where: {
				verified: true,
				status: { not: "deleted" },
				role: { in: ["buyer", "factory", "buying_house"] },
			},
		}),
		prisma.verification.findMany({
			where: { verified: true },
		}),
	]);

	const verificationByUserId = new Map(
		verifications.map((row) => [String(row.user_id || ""), row]),
	);

	let bestMatch = null;

	for (const candidateUser of users) {
		if (String(candidateUser.id || "") === String(user.id || "")) {
			continue;
		}
		if (String(candidateUser.role || "").toLowerCase() === "agent") {
			continue;
		}
		const candidate = {
			...candidateUser,
			verification: verificationByUserId.get(String(candidateUser.id || "")) || null,
		};
		const match = computeCompanyDuplicateMatch(user, candidate, verificationRecord);
		if (!match) {
			continue;
		}
		if (!bestMatch || match.score > bestMatch.match.score) {
			bestMatch = {
				user_id: String(candidateUser.id || ""),
				name: getUserCompanyName(candidateUser),
				logo:
					String(
						candidateUser?.profile?.brand_logo_url || candidateUser?.profile?.logo_url || "",
					) || "",
				banner:
					String(
						candidateUser?.profile?.brand_cover_url || candidateUser?.profile?.banner_url || "",
					) || "",
				email: String(candidateUser?.email || ""),
				company_role: String(candidateUser?.role || ""),
				country: collapseSpaces(candidateUser?.profile?.country || candidateUser?.country || ""),
				website: extractDomain(
					candidateUser?.profile?.brand_website ||
						candidateUser?.profile?.website ||
						candidateUser?.profile?.company_website ||
						"",
				),
				match,
			};
		}
	}

	return bestMatch;
}

function buildCredibility(required, docs) {
	const completedRequired = required.filter((field) => hasDocument(docs, field)).length;
	const requiredTotal = required.length;
	const optionalLicenses = Array.isArray(docs?.optional_licenses)
		? docs.optional_licenses.filter(Boolean)
		: [];
	const requiredCompletionPct = requiredTotal > 0 ? (completedRequired / requiredTotal) * 100 : 100;

	const requiredScore = requiredCompletionPct * 0.85;
	const optionalScore = Math.min(optionalLicenses.length, 5) * 3;
	const score = Math.min(100, Math.round(requiredScore + optionalScore));

	let badge = "Basic credibility";
	if (score >= 90) {
		badge = "High credibility";
	} else if (score >= 70) {
		badge = "Strong credibility";
	} else if (score >= 40) {
		badge = "Moderate credibility";
	}

	return {
		score,
		badge,
		completeness: `${completedRequired}/${requiredTotal} required documents submitted`,
		required_completed: completedRequired,
		required_total: requiredTotal,
		optional_licenses_count: optionalLicenses.length,
	};
}

function hasAnyDocument(docs) {
	if (!docs) {
		return false;
	}
	const keys = Object.keys(docs);
	return keys.some((key) => {
		if (key === "optional_licenses") {
			return Array.isArray(docs.optional_licenses) && docs.optional_licenses.some(Boolean);
		}
		return Boolean(String(docs[key] || "").trim());
	});
}

function toPublicFileUrl(filePath = "") {
	if (!filePath) {
		return "";
	}
	const normalized = String(filePath).replace(/\\/g, "/");
	if (normalized.startsWith("/uploads/")) {
		return normalized;
	}
	const idx = normalized.indexOf("server/uploads/");
	if (idx >= 0) {
		return `/uploads/${normalized.slice(idx + "server/uploads/".length)}`;
	}
	return normalized.startsWith("uploads/") ? `/${normalized}` : normalized;
}

export async function getVerification(userId) {
	return prisma.verification.findUnique({ where: { user_id: userId } });
}

function diffDaysFromNow(endDate) {
	const endTime = new Date(endDate || "").getTime();
	if (!Number.isFinite(endTime)) {
		return 0;
	}
	const diffMs = endTime - Date.now();
	if (diffMs <= 0) {
		return 0;
	}
	return Math.ceil(diffMs / (24 * 60 * 60 * 1000));
}

export async function isVerificationSubscriptionValid(userId) {
	const rec = await getVerification(userId);
	if (!rec?.subscription_valid_until) {
		return false;
	}
	return diffDaysFromNow(rec.subscription_valid_until) > 0;
}

export async function setVerificationSubscription(userId, endDate) {
	const nextEnd = endDate || "";
	const remainingDays = diffDaysFromNow(nextEnd);
	const expiringSoon = remainingDays > 0 && remainingDays <= 7;

	const existing = await prisma.verification.findUnique({
		where: { user_id: userId },
	});

	if (!existing) {
		return prisma.verification.create({
			data: {
				user_id: userId,
				role: "",
				buyer_region: "",
				documents: emptyDocs(),
				verified: false,
				subscription_valid_until: nextEnd,
				subscription_remaining_days: remainingDays,
				expiring_soon: expiringSoon,
				missing_required: [],
				credibility: buildCredibility([], emptyDocs()),
				review_status: "pending",
				review_reason: "",
			},
		});
	}

	const verification_status = existing.verified
		? expiringSoon
			? "expiring_soon"
			: "verified_active"
		: remainingDays > 0
			? "pending_review"
			: "expired";

	return prisma.verification.update({
		where: { user_id: userId },
		data: {
			subscription_valid_until: nextEnd,
			subscription_remaining_days: remainingDays,
			expiring_soon: expiringSoon,
			verification_status,
			updated_at: new Date(),
		},
	});
}

function addDaysFrom(baseDate, days = 30) {
	const now = Date.now();
	const base = new Date(baseDate || "").getTime();
	const start = Number.isFinite(base) && base > now ? base : now;
	return new Date(start + days * 24 * 60 * 60 * 1000).toISOString();
}

export async function extendVerificationSubscription(userId, days = 30) {
	const rec = await getVerification(userId);
	const nextEnd = addDaysFrom(rec?.subscription_valid_until, days);
	return setVerificationSubscription(userId, nextEnd);
}

function normalizeCountryCode(value) {
	return sanitizeString(String(value || ""), 80).trim();
}

function inferBuyerRegion(user, record) {
	if (record?.buyer_region) {
		return record.buyer_region;
	}
	const docsCountry = normalizeBuyerCountry(record?.documents?.buyer_country);
	const profileCountry = normalizeCountryCode(user?.profile?.country);
	const candidate = docsCountry || profileCountry;
	return getBuyerRegionFromCountry(candidate);
}

export function getVerificationPublicSummary(user, record) {
	const role = user?.role || record?.role || "";
	const buyerRegion = role === "buyer" ? inferBuyerRegion(user, record) : "";
	const required = getVerificationRequirements(role, buyerRegion);
	const docs = record?.documents || emptyDocs();
	const credibility = record?.credibility || buildCredibility(required, docs);

	const required_checklist = required.map((key) => ({
		key,
		label: VERIFICATION_FIELD_LABELS[key] || key,
		submitted: hasDocument(docs, key),
	}));

	const optionalLicenses = Array.isArray(docs?.optional_licenses)
		? docs.optional_licenses.filter(Boolean)
		: [];

	return {
		verified: Boolean(record?.verified),
		buyer_region: buyerRegion,
		credibility,
		required_checklist,
		optional_licenses_count: optionalLicenses.length,
	};
}

export async function upsertVerification(user, documentsPatch) {
	const existing = await prisma.verification.findUnique({
		where: { user_id: user.id },
	});

	const docs = {
		...(existing?.documents || emptyDocs()),
		...sanitizeDocsPatch(documentsPatch || {}),
	};

	const buyerRegion =
		user.role === "buyer"
			? normalizeBuyerRegion(documentsPatch?.buyer_region || existing?.buyer_region)
			: "";

	validateBuyerGeography(user.role, docs, buyerRegion);

	const duplicate_candidate = await findCompanyDuplicateCandidate(user, {
		...(existing || {}),
		documents: docs,
		buyer_region: buyerRegion,
	});

	const required = getVerificationRequirements(user.role, buyerRegion);
	const missing_required = required.filter((key) => !hasDocument(docs, key));
	const credibility = buildCredibility(required, docs);

	const shouldKeepApproved = Boolean(existing?.verified) && missing_required.length === 0;
	const duplicateTier = duplicate_candidate?.match?.tier || "";
	const nextReviewStatus =
		duplicateTier === "exact" || duplicateTier === "strong"
			? "duplicate_review"
			: shouldKeepApproved
				? "approved"
				: missing_required.length > 0
					? "incomplete"
					: "pending";

	const record = {
		user_id: user.id,
		role: user.role,
		buyer_region: buyerRegion,
		documents: docs,
		verified: shouldKeepApproved,
		verified_at: shouldKeepApproved ? existing?.verified_at || null : null,
		subscription_valid_until: existing?.subscription_valid_until || null,
		missing_required,
		credibility,
		review_status: nextReviewStatus,
		review_reason:
			duplicateTier === "exact" || duplicateTier === "strong"
				? sanitizeString(
						`${duplicate_candidate.match?.reason || "duplicate_match"}:${duplicate_candidate.name || ""}`,
						240,
					)
				: duplicateTier === "weak"
					? "weak_duplicate_signal"
					: nextReviewStatus === "rejected"
						? sanitizeString(String(existing?.review_reason || ""), 240)
						: "",
		reviewed_at: shouldKeepApproved ? existing?.reviewed_at || null : null,
		updated_at: new Date(),
	};

	const result = await prisma.verification.upsert({
		where: { user_id: user.id },
		update: record,
		create: record,
	});

	logInfo("Verification documents updated", {
		user_id: user.id,
		buyer_region: buyerRegion,
		missing_required: missing_required.length,
		credibility_score: credibility.score,
		duplicate_review: Boolean(duplicate_candidate),
	});
	if (duplicate_candidate) {
		result.duplicate_candidate = duplicate_candidate;
		result.duplicate_match_tier = duplicate_candidate.match?.tier || "";

		if (
			duplicate_candidate.match?.tier === "exact" ||
			duplicate_candidate.match?.tier === "strong"
		) {
			const companyOwnerId = duplicate_candidate.user_id;
			if (companyOwnerId) {
				const orgMembers = await prisma.user.findMany({
					where: {
						OR: [{ id: companyOwnerId }, { org_owner_id: companyOwnerId }],
						role: { in: ["owner", "admin"] },
					},
				});
				const recipientIds = [...new Set([companyOwnerId, ...orgMembers.map((m) => String(m.id))])];
				for (const recipientId of recipientIds) {
					try {
						await createNotification(recipientId, {
							type: "duplicate_company_detected",
							entity_type: "verification",
							entity_id: String(user.id),
							message: `A new verification submission matches your company (${duplicate_candidate.name || "your company"}). Match type: ${duplicate_candidate.match?.tier || "unknown"}.`,
							meta: {
								matched_company_id: companyOwnerId,
								matched_company_name: duplicate_candidate.name || "",
								applicant_id: String(user.id),
								applicant_name: sanitizeString(String(user.name || ""), 120),
								match_tier: duplicate_candidate.match?.tier || "",
								match_reason: duplicate_candidate.match?.reason || "",
								matched_fields: duplicate_candidate.match?.matched_fields || [],
							},
						});
					} catch {
						// non-critical: notification failure should not block verification
					}
				}
			}
		}
	}
	return result;
}

export async function adminApproveVerification(userId) {
	const existing = await prisma.verification.findUnique({
		where: { user_id: userId },
	});
	if (!existing) {
		return null;
	}

	const validSub = await isVerificationSubscriptionValid(userId);
	if (!validSub) {
		return prisma.verification.update({
			where: { user_id: userId },
			data: {
				verified: false,
				missing_required: [
					...(existing.missing_required || []),
					"premium_subscription_required_for_verification",
				],
			},
		});
	}

	if ((existing.missing_required || []).length > 0) {
		return prisma.verification.update({
			where: { user_id: userId },
			data: {
				verified: false,
				review_status: "incomplete",
				review_reason: "missing_required_documents",
				reviewed_at: new Date(),
			},
		});
	}

	logInfo("Verification approved", { user_id: userId });
	return prisma.verification.update({
		where: { user_id: userId },
		data: {
			verified: true,
			verified_at: new Date(),
			review_status: "approved",
			review_reason: "",
			reviewed_at: new Date(),
			subscription_valid_until: existing.subscription_valid_until || null,
		},
	});
}

export async function adminRejectVerification(userId, reason = "") {
	const existing = await prisma.verification.findUnique({
		where: { user_id: userId },
	});
	if (!existing) {
		return null;
	}

	logInfo("Verification rejected", { user_id: userId, reason });
	return prisma.verification.update({
		where: { user_id: userId },
		data: {
			verified: false,
			verified_at: null,
			review_status: "rejected",
			review_reason: sanitizeString(String(reason || "rejected_by_admin"), 240),
			reviewed_at: new Date(),
		},
	});
}

export async function revokeExpiredVerifications() {
	const all = await prisma.verification.findMany({ where: { verified: true } });
	const now = Date.now();

	for (const rec of all) {
		const subEnd = rec.subscription_valid_until;
		if (!subEnd || new Date(subEnd).getTime() <= now) {
			await prisma.verification.update({
				where: { user_id: rec.user_id },
				data: {
					verified: false,
					review_status: "expired",
					review_reason: "subscription_expired",
					reviewed_at: new Date(),
					subscription_remaining_days: 0,
					expiring_soon: false,
					verification_status: "expired",
				},
			});
		}
	}

	return prisma.verification.findMany();
}

export async function listVerificationQueue({ status } = {}) {
	const [all, users, documents] = await Promise.all([
		prisma.verification.findMany(),
		prisma.user.findMany(),
		prisma.document.findMany({
			where: { entity_type: "verification" },
		}),
	]);

	const usersById = new Map(users.map((u) => [String(u.id), u]));
	const docsByUser = new Map();

	for (const doc of documents) {
		const ownerId = String(doc.entity_id || doc.uploaded_by || "");
		if (!ownerId) {
			continue;
		}
		if (!docsByUser.has(ownerId)) {
			docsByUser.set(ownerId, []);
		}
		docsByUser.get(ownerId).push({
			...doc,
			public_url: toPublicFileUrl(doc.file_path || doc.url || ""),
		});
	}

	const duplicateIndex = {};
	DUPLICATE_FIELDS.forEach((field) => {
		duplicateIndex[field] = new Map();
	});

	for (const rec of all) {
		const docs = rec?.documents || {};
		DUPLICATE_FIELDS.forEach((field) => {
			const aliasFields = fieldAliases[field] || [field];
			const value = aliasFields.map((key) => docs?.[key]).find(Boolean);
			if (!value) {
				return;
			}
			const normalized = normalizeDocValue(value);
			if (!normalized) {
				return;
			}
			const bucket = duplicateIndex[field];
			if (!bucket.has(normalized)) {
				bucket.set(normalized, new Set());
			}
			bucket.get(normalized).add(String(rec.user_id || ""));
		});
	}

	const filtered = all.filter((rec) => {
		const reviewStatus = normalizeReviewStatus(
			rec.review_status,
			rec.verified ? "approved" : "pending",
		);
		if (status) {
			return reviewStatus === status;
		}
		if (!hasAnyDocument(rec.documents)) {
			return false;
		}
		return reviewStatus !== "approved";
	});

	return filtered
		.map((rec) => {
			const user = usersById.get(String(rec.user_id || "")) || null;
			const summary = getVerificationPublicSummary(user || {}, rec);
			const duplicate_flags = DUPLICATE_FIELDS.reduce((flags, field) => {
				const aliasFields = fieldAliases[field] || [field];
				const value = aliasFields.map((key) => rec?.documents?.[key]).find(Boolean);
				if (!value) {
					return flags;
				}
				const normalized = normalizeDocValue(value);
				if (!normalized) {
					return flags;
				}
				const bucket = duplicateIndex[field];
				const matchedUsers = bucket.get(normalized);
				if (matchedUsers && matchedUsers.size > 1) {
					flags.push({
						field,
						value,
						user_ids: Array.from(matchedUsers),
					});
				}
				return flags;
			}, []);
			return {
				...rec,
				review_status: normalizeReviewStatus(
					rec.review_status,
					rec.verified ? "approved" : "pending",
				),
				user: user
					? {
							id: user.id,
							name: user.name,
							email: user.email,
							role: user.role,
							verified: Boolean(user.verified),
							subscription_status: user.subscription_status,
							country: user.profile?.country || "",
						}
					: null,
				required_checklist: summary.required_checklist,
				credibility: summary.credibility,
				duplicate_flags,
				uploaded_documents: docsByUser.get(String(rec.user_id || "")) || [],
			};
		})
		.sort((a, b) => String(b.updated_at || "").localeCompare(String(a.updated_at || "")));
}

export async function listExpiringVerifications(thresholdDays = 7) {
	return prisma.verification.findMany({
		where: {
			verified: true,
			subscription_remaining_days: { gt: 0, lte: thresholdDays },
		},
	});
}

export async function markVerificationExpiringSoon(userId, remainingDays, thresholdDays = 7) {
	const existing = await prisma.verification.findUnique({
		where: { user_id: userId },
	});
	if (!existing) {
		return null;
	}

	const nextRemainingDays = Math.max(0, Number(remainingDays) || 0);
	const isExpiringSoon =
		existing.verified && nextRemainingDays > 0 && nextRemainingDays <= thresholdDays;

	const verification_status = existing.verified
		? isExpiringSoon
			? "expiring_soon"
			: "verified_active"
		: "expired";

	return prisma.verification.update({
		where: { user_id: userId },
		data: {
			subscription_remaining_days: nextRemainingDays,
			expiring_soon: isExpiringSoon,
			verification_status,
			updated_at: new Date(),
		},
	});
}
