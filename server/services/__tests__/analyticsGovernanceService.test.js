import assert from "node:assert/strict";
import test from "node:test";

import {
	assertNoUnauthorizedAnalyticsJoin,
	checkAnalyticsAccessPolicy,
	sanitizePlatformAnalytics,
} from "../analyticsGovernanceService.js";

function baseReport() {
	return {
		totals: { buyer_requests: 4, repeat_buyer_rate: 25 },
		search_event_count: 12,
		search_min_events: 25,
		search_data_ready: false,
		search_data_source: "proxy_requests",
		top_categories_by_country: [
			{
				country: "Bangladesh",
				categories: [
					{ label: "Cotton", count: 4 },
					{ label: "Linen", count: 3 },
				],
			},
		],
		top_categories_global: [
			{ label: "Cotton", count: 4 },
			{ label: "Linen", count: 1 },
		],
		monthly_demand_trend: [{ month: "2026-03-01T00:00:00.000Z", count: 4 }],
		price_range_demand: [
			{ bucket: "0-5", count: 3 },
			{ bucket: "5-10", count: 1 },
		],
		top_search_categories_by_country: [
			{
				country: "Bangladesh",
				categories: [{ label: "Cotton", count: 2 }],
			},
		],
		top_search_categories_global: [{ label: "Cotton", count: 2 }],
		trending_search_categories: [{ label: "Cotton", current: 1, previous: 1, delta: 0 }],
		metadata: {
			actor_id: "user-1",
			raw_ip: "10.10.10.10",
		},
	};
}

test("suppresses cohorts below min cohort size", () => {
	const { report, suppression } = sanitizePlatformAnalytics(baseReport(), {
		enabled: true,
		min_cohort_size: 10,
		geo_granularity: "country",
	});

	assert.equal(report.top_categories_by_country[0].country, "insufficient_data");
	assert.deepEqual(report.top_categories_by_country[0].categories, [
		{ label: "insufficient_data", count: 7 },
	]);
	assert.ok(report.top_categories_global.some((row) => row.label === "insufficient_data"));
	assert.ok(suppression.suppressed_cohorts >= 1);
});

test("strips denied identifier fields from nested metadata", () => {
	const reportWithLocation = baseReport();
	reportWithLocation.metadata = {
		actor_id: "user-1",
		raw_ip: "10.10.10.10",
		exact_lat: 23.8103,
		exact_lng: 90.4125,
		ip_country: "BD",
	};

	const { report } = sanitizePlatformAnalytics(reportWithLocation, {
		enabled: true,
		min_cohort_size: 2,
	});

	assert.ok(!("metadata" in report && "actor_id" in (report.metadata || {})));
	assert.equal(JSON.stringify(report).includes("raw_ip"), false);
	assert.equal(JSON.stringify(report).includes("actor_id"), false);
	assert.equal(JSON.stringify(report).includes("exact_lat"), false);
	assert.equal(JSON.stringify(report).includes("exact_lng"), false);
	assert.equal(JSON.stringify(report).includes("ip_country"), false);
});

test("keeps stable output schema under suppression", () => {
	const expectedKeys = [
		"totals",
		"search_event_count",
		"search_min_events",
		"search_data_ready",
		"search_data_source",
		"top_categories_by_country",
		"top_categories_global",
		"monthly_demand_trend",
		"price_range_demand",
		"top_search_categories_by_country",
		"top_search_categories_global",
		"trending_search_categories",
	];

	const { report } = sanitizePlatformAnalytics(baseReport(), {
		enabled: true,
		min_cohort_size: 50,
		geo_granularity: "global",
	});

	assert.deepEqual(Object.keys(report), expectedKeys);
	assert.equal(Array.isArray(report.top_categories_by_country), true);
	assert.equal(Array.isArray(report.trending_search_categories), true);
	assert.equal(report.top_categories_by_country[0].country, "insufficient_data");
});

test("policy denies non-admin view access when governance allows only admin and owner roles", () => {
	const result = checkAnalyticsAccessPolicy(
		{ id: "agent-1", role: "agent" },
		{
			enabled: true,
			min_cohort_size: 10,
			geo_granularity: "country",
			view_allowed_roles: ["admin", "owner"],
		},
		{ mode: "view" },
	);

	assert.equal(result.allowed, false);
	assert.equal(result.reason, "analytics_view_denied");
});

test("policy denies raw export when allow_raw_exports is disabled", () => {
	const result = checkAnalyticsAccessPolicy(
		{ id: "admin-1", role: "admin" },
		{
			enabled: true,
			allow_raw_exports: false,
			export_allowed_roles: ["admin", "owner"],
		},
		{ mode: "export" },
	);

	assert.equal(result.allowed, false);
	assert.equal(result.reason, "analytics_export_denied");
});

test("blocks unauthorized analytics joins that can reveal identity", () => {
	assert.throws(
		() => assertNoUnauthorizedAnalyticsJoin(["country", "category", "month", "price_bucket"]),
		/too specific|not allowed/i,
	);
});

test("blocks direct re-identification dimensions", () => {
	assert.throws(() => assertNoUnauthorizedAnalyticsJoin(["country", "email"]), /restricted/i);
});
