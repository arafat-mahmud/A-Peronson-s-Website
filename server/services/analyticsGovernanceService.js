import { getAdminConfig } from "./adminConfigService.js";

export const ANALYTICS_GOVERNANCE_DEFAULTS = Object.freeze({
	enabled: true,
	min_cohort_size: 10,
	geo_granularity: "country",
	retention_days: 365,
	allow_raw_exports: false,
	export_allowed_roles: ["admin", "owner"],
	view_allowed_roles: ["admin", "owner"],
	date_granularity: "month",
});

export const ALLOWED_ANALYTICS_DIMENSIONS = Object.freeze([
	"country",
	"category",
	"price_bucket",
	"month",
	"search_category",
	"org_scope",
]);

export const DENIED_ANALYTICS_FIELDS = Object.freeze([
	"actor_id",
	"user_id",
	"buyer_id",
	"email",
	"phone",
	"ip",
	"raw_ip",
	"ip_country",
	"ip_region",
	"ip_city",
	"lat",
	"lng",
	"latitude",
	"longitude",
	"exact_lat",
	"exact_lng",
	"org_member_ids",
	"member_ids",
]);

const HIGH_RISK_JOIN_DIMENSIONS = new Set([
	"actor_id",
	"user_id",
	"buyer_id",
	"email",
	"phone",
	"ip",
	"country+category+month+price_bucket",
]);

export const SENSITIVE_BUCKETING_RULES = Object.freeze({
	country: {
		levels: ["country", "region", "global"],
		fallback: "global",
	},
	price: {
		buckets: ["0-5", "5-10", "10-20", "20-50", "50+", "unknown"],
		fallback: "unknown",
	},
	date: {
		levels: ["day", "week", "month", "quarter"],
		fallback: "month",
	},
});

function toObject(value) {
	return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function normalizeGovernanceConfig(config = {}) {
	const candidate = toObject(config);
	const minCohort = Number(candidate.min_cohort_size);
	const retentionDays = Number(candidate.retention_days);
	const geo = String(
		candidate.geo_granularity || ANALYTICS_GOVERNANCE_DEFAULTS.geo_granularity,
	).toLowerCase();
	const date = String(
		candidate.date_granularity || ANALYTICS_GOVERNANCE_DEFAULTS.date_granularity,
	).toLowerCase();

	return {
		enabled: candidate.enabled !== false,
		min_cohort_size:
			Number.isFinite(minCohort) && minCohort > 0
				? Math.floor(minCohort)
				: ANALYTICS_GOVERNANCE_DEFAULTS.min_cohort_size,
		geo_granularity: SENSITIVE_BUCKETING_RULES.country.levels.includes(geo)
			? geo
			: ANALYTICS_GOVERNANCE_DEFAULTS.geo_granularity,
		retention_days:
			Number.isFinite(retentionDays) && retentionDays > 0
				? Math.floor(retentionDays)
				: ANALYTICS_GOVERNANCE_DEFAULTS.retention_days,
		allow_raw_exports: Boolean(candidate.allow_raw_exports),
		export_allowed_roles:
			Array.isArray(candidate.export_allowed_roles) && candidate.export_allowed_roles.length > 0
				? candidate.export_allowed_roles
						.map((role) => String(role || "").toLowerCase())
						.filter(Boolean)
				: ANALYTICS_GOVERNANCE_DEFAULTS.export_allowed_roles,
		view_allowed_roles:
			Array.isArray(candidate.view_allowed_roles) && candidate.view_allowed_roles.length > 0
				? candidate.view_allowed_roles
						.map((role) => String(role || "").toLowerCase())
						.filter(Boolean)
				: ANALYTICS_GOVERNANCE_DEFAULTS.view_allowed_roles,
		date_granularity: SENSITIVE_BUCKETING_RULES.date.levels.includes(date)
			? date
			: ANALYTICS_GOVERNANCE_DEFAULTS.date_granularity,
	};
}

export async function getAnalyticsGovernanceConfig() {
	const config = await getAdminConfig();
	return normalizeGovernanceConfig(config?.analytics?.governance);
}

export function checkAnalyticsAccessPolicy(
	user,
	config = ANALYTICS_GOVERNANCE_DEFAULTS,
	{ mode = "view" } = {},
) {
	const governance = normalizeGovernanceConfig(config);
	const role = String(user?.role || "").toLowerCase();
	const deniedReason = mode === "export" ? "analytics_export_denied" : "analytics_view_denied";

	if (!governance.enabled) {
		return { allowed: true, governance, mode, role };
	}

	if (mode === "export") {
		if (!governance.allow_raw_exports) {
			return { allowed: false, governance, mode, role, reason: deniedReason };
		}
		if (!governance.export_allowed_roles.includes(role)) {
			return { allowed: false, governance, mode, role, reason: deniedReason };
		}
		return { allowed: true, governance, mode, role };
	}

	if (!governance.view_allowed_roles.includes(role)) {
		return { allowed: false, governance, mode, role, reason: deniedReason };
	}
	return { allowed: true, governance, mode, role };
}

export function assertNoUnauthorizedAnalyticsJoin(requestedDimensions = []) {
	const dims = Array.isArray(requestedDimensions)
		? requestedDimensions
				.map((value) =>
					String(value || "")
						.trim()
						.toLowerCase(),
				)
				.filter(Boolean)
		: [];
	const unique = [...new Set(dims)];
	const joined = unique.slice().sort().join("+");

	if (HIGH_RISK_JOIN_DIMENSIONS.has(joined)) {
		const error = new Error("Requested analytics join is not allowed by data governance policy");
		error.status = 403;
		error.code = "ANALYTICS_JOIN_BLOCKED";
		throw error;
	}

	const directBlocked = unique.find((dimension) => HIGH_RISK_JOIN_DIMENSIONS.has(dimension));
	if (directBlocked) {
		const error = new Error(`Requested dimension "${directBlocked}" is restricted`);
		error.status = 403;
		error.code = "ANALYTICS_DIMENSION_BLOCKED";
		throw error;
	}

	if (
		unique.length >= 4 &&
		unique.includes("country") &&
		unique.includes("category") &&
		unique.includes("month")
	) {
		const error = new Error(
			"Requested analytics slice is too specific and risks re-identification",
		);
		error.status = 403;
		error.code = "ANALYTICS_REIDENTIFICATION_BLOCKED";
		throw error;
	}

	return unique;
}

function noiseForCount(count, seed) {
	if (!Number.isFinite(count) || count <= 0) {
		return 0;
	}
	const hash = String(seed || "seed")
		.split("")
		.reduce((acc, char) => acc + char.charCodeAt(0), 0);
	return hash % 2 === 0 ? 1 : -1;
}

function applyNoiseToLabeledRows(rows, governance, suppression, seedPrefix = "row") {
	return rows.map((row, index) => {
		const count = Number(row?.count || 0);
		const seed = `${seedPrefix}:${row?.label || row?.bucket || "unknown"}:${index}`;
		const sparse = count > 0 && count < governance.min_cohort_size * 2;
		if (!sparse) {
			return row;
		}
		const noisy = Math.max(0, count + noiseForCount(count, seed));
		if (noisy !== count) {
			suppression.noise_injected = true;
		}
		return { ...row, count: noisy };
	});
}

function sanitizeCountry(country, granularity) {
	const raw = String(country || "Unknown").trim() || "Unknown";
	if (granularity === "country") {
		return raw;
	}
	if (granularity === "region") {
		return "regional";
	}
	return "global";
}

function toMonth(isoValue) {
	const ts = new Date(String(isoValue || "")).getTime();
	if (!Number.isFinite(ts)) {
		return null;
	}
	const date = new Date(ts);
	return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function toQuarter(isoValue) {
	const ts = new Date(String(isoValue || "")).getTime();
	if (!Number.isFinite(ts)) {
		return null;
	}
	const date = new Date(ts);
	const quarter = Math.floor(date.getUTCMonth() / 3) + 1;
	return `${date.getUTCFullYear()}-Q${quarter}`;
}

function bucketDate(value, granularity) {
	if (granularity === "quarter") {
		return toQuarter(value);
	}
	return toMonth(value);
}

function toPriceBucket(bucket) {
	const normalized = String(bucket || "")
		.trim()
		.toLowerCase();
	if (SENSITIVE_BUCKETING_RULES.price.buckets.includes(normalized)) {
		return normalized;
	}
	return SENSITIVE_BUCKETING_RULES.price.fallback;
}

function stripDeniedFields(value, deniedFields) {
	if (Array.isArray(value)) {
		return value.map((item) => stripDeniedFields(item, deniedFields));
	}
	if (!value || typeof value !== "object") {
		return value;
	}

	return Object.fromEntries(
		Object.entries(value)
			.filter(([key]) => !deniedFields.has(String(key).toLowerCase()))
			.map(([key, nested]) => [key, stripDeniedFields(nested, deniedFields)]),
	);
}

function suppressLabeledItems(items = [], minCohort = 10, suppression = { suppressed_values: 0 }) {
	const kept = [];
	let suppressedCount = 0;

	for (const item of items) {
		const count = Number(item?.count || 0);
		if (count > 0 && count < minCohort) {
			suppressedCount += count;
			suppression.suppressed_values += 1;
			continue;
		}
		kept.push({
			...item,
			label: String(item?.label || "unknown"),
			count,
		});
	}

	if (suppressedCount > 0) {
		kept.push({ label: "insufficient_data", count: suppressedCount });
	}

	return kept;
}

function suppressTrendItems(items = [], minCohort = 10, suppression = { suppressed_values: 0 }) {
	return items.map((item) => {
		const current = Number(item?.current || 0);
		const previous = Number(item?.previous || 0);
		const label =
			current + previous < minCohort ? "insufficient_data" : String(item?.label || "unknown");
		if (label === "insufficient_data") {
			suppression.suppressed_values += 1;
		}
		return {
			label,
			current,
			previous,
			delta: Number(item?.delta || current - previous),
		};
	});
}

function sanitizeCountryCategoryRows(rows, governance, suppression) {
	const merged = new Map();

	for (const row of rows) {
		const countryKey = sanitizeCountry(row?.country, governance.geo_granularity);
		if (!merged.has(countryKey)) {
			merged.set(countryKey, new Map());
		}
		const categories = merged.get(countryKey);

		const rowCategories = Array.isArray(row?.categories) ? row.categories : [];
		for (const category of rowCategories) {
			const label = String(category?.label || "Other");
			categories.set(label, (categories.get(label) || 0) + Number(category?.count || 0));
		}
	}

	const output = [];
	for (const [country, categories] of merged.entries()) {
		const categoryRows = [...categories.entries()]
			.map(([label, count]) => ({ label, count }))
			.sort((a, b) => b.count - a.count)
			.slice(0, 5);

		const cohortSize = categoryRows.reduce((sum, row) => sum + Number(row.count || 0), 0);
		if (cohortSize > 0 && cohortSize < governance.min_cohort_size) {
			suppression.suppressed_cohorts += 1;
			output.push({
				country: "insufficient_data",
				categories: [{ label: "insufficient_data", count: cohortSize }],
			});
			continue;
		}

		output.push({
			country,
			categories: suppressLabeledItems(categoryRows, governance.min_cohort_size, suppression),
		});
	}

	return output;
}

export function sanitizePlatformAnalytics(raw = {}, config = ANALYTICS_GOVERNANCE_DEFAULTS) {
	const governance = normalizeGovernanceConfig(config);
	if (!governance.enabled) {
		return {
			report: stripDeniedFields(raw, new Set(DENIED_ANALYTICS_FIELDS)),
			suppression: { suppressed_values: 0, suppressed_cohorts: 0 },
			governance,
		};
	}

	const suppression = {
		suppressed_values: 0,
		suppressed_cohorts: 0,
		noise_injected: false,
	};
	const monthlyTrend = (
		Array.isArray(raw.monthly_demand_trend) ? raw.monthly_demand_trend : []
	).map((entry) => ({
		month: bucketDate(entry?.month, governance.date_granularity) || "unknown",
		count: Number(entry?.count || 0),
	}));

	function sanitizeMonthlyByLabelRows(rows = []) {
		if (!Array.isArray(rows)) {
			return [];
		}
		const out = [];
		for (const row of rows) {
			const series = Array.isArray(row?.series) ? row.series : [];
			const total = series.reduce((s, e) => s + Number(e?.count || 0), 0);
			if (total > 0 && total < governance.min_cohort_size) {
				suppression.suppressed_cohorts += 1;
				out.push({
					label: "insufficient_data",
					series: [{ month: "insufficient_data", count: total }],
				});
				continue;
			}

			const buckets = {};
			for (const s of series) {
				const monthKey = bucketDate(s?.month, governance.date_granularity) || "unknown";
				buckets[monthKey] = (buckets[monthKey] || 0) + Number(s?.count || 0);
			}

			const seriesArray = Object.entries(buckets)
				.sort(([a], [b]) => a.localeCompare(b))
				.map(([month, count]) => ({ month, count }));

			const noisy = applyNoiseToLabeledRows(
				seriesArray.map((r) => ({ label: r.month, count: r.count })),
				governance,
				suppression,
				`monthly:${String(row?.label || "unknown")}`,
			).map((r) => ({ month: r.label, count: r.count }));

			out.push({ label: String(row?.label || "unknown"), series: noisy });
		}
		return out;
	}

	const priceRangeDemand = suppressLabeledItems(
		(Array.isArray(raw.price_range_demand) ? raw.price_range_demand : []).map((row) => ({
			label: toPriceBucket(row?.bucket),
			count: Number(row?.count || 0),
		})),
		governance.min_cohort_size,
		suppression,
	).map((row) => ({ bucket: row.label, count: row.count }));

	const report = {
		totals: {
			buyer_requests: Number(raw?.totals?.buyer_requests || 0),
			repeat_buyer_rate: Number(raw?.totals?.repeat_buyer_rate || 0),
		},
		search_event_count: Number(raw?.search_event_count || 0),
		search_min_events: Number(raw?.search_min_events || governance.min_cohort_size),
		search_data_ready: Boolean(raw?.search_data_ready),
		search_data_source: String(raw?.search_data_source || "unknown"),
		top_categories_by_country: sanitizeCountryCategoryRows(
			raw?.top_categories_by_country,
			governance,
			suppression,
		),
		top_categories_global: applyNoiseToLabeledRows(
			suppressLabeledItems(raw?.top_categories_global, governance.min_cohort_size, suppression),
			governance,
			suppression,
			"top_categories_global",
		),
		monthly_demand_trend: monthlyTrend,
		monthly_demand_by_category: sanitizeMonthlyByLabelRows(raw?.monthly_demand_by_category),
		monthly_demand_by_product: sanitizeMonthlyByLabelRows(raw?.monthly_demand_by_product),
		price_range_demand: applyNoiseToLabeledRows(
			priceRangeDemand,
			governance,
			suppression,
			"price_range_demand",
		),
		top_search_categories_by_country: sanitizeCountryCategoryRows(
			raw?.top_search_categories_by_country,
			governance,
			suppression,
		),
		top_search_categories_global: applyNoiseToLabeledRows(
			suppressLabeledItems(
				raw?.top_search_categories_global,
				governance.min_cohort_size,
				suppression,
			),
			governance,
			suppression,
			"top_search_categories_global",
		),
		trending_search_categories: applyNoiseToLabeledRows(
			suppressTrendItems(
				raw?.trending_search_categories,
				governance.min_cohort_size,
				suppression,
			).map((row) => ({
				...row,
				count: Number(row?.current || 0),
			})),
			governance,
			suppression,
			"trending_search_categories",
		).map((row) => ({
			label: row.label,
			current: row.count,
			previous: Number(row.previous || 0),
			delta: Number(row.count || 0) - Number(row.previous || 0),
		})),
	};

	return {
		report: stripDeniedFields(report, new Set(DENIED_ANALYTICS_FIELDS)),
		suppression,
		governance,
	};
}
