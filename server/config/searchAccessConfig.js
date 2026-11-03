export const FILTER_TIERS = {
	// Core filters (project.md): always free.
	basic: [
		"q",
		"industry",
		"category",
		"moqRange",
		"priceRange",
		"verifiedOnly",
		"country",
		"leadTimeMax",
		"orgType",
		"postedAfter",
		"postedBefore",
		"language",
		"minRating",
	],
	// Advanced filters (project.md): premium gating applies here.
	advanced: [
		"fabricType",
		"gsmMin",
		"gsmMax",
		"sizeRange",
		"colorPantone",
		"customization",
		"sampleAvailable",
		"sampleLeadTime",
		"certifications",
		"incoterms",
		"paymentTerms",
		"documentReady",
		"auditDate",
		"languageSupport",
		"capacityMin",
		"processes",
		"yearsInBusinessMin",
		"responseTimeMax",
		"teamSeatsMin",
		"handlesMultipleFactories",
		"exportPort",
		"distanceKm",
		"locationLat",
		"locationLng",
	],
};

export const PLAN_DAILY_LIMITS = {
	free: {
		requirements_search: 25,
		products_search: 25,
		search_alerts_create: 5,
	},
	premium: {
		requirements_search: 400,
		products_search: 400,
		search_alerts_create: 100,
	},
};

export const PLAN_FILTER_ACCESS = {
	free: {
		allowedTiers: ["basic"],
	},
	premium: {
		allowedTiers: ["basic", "advanced"],
	},
};

export const SEARCH_CAPABILITIES = {
	free: {
		filters: {
			advanced: false,
		},
		daily_limits: PLAN_DAILY_LIMITS.free,
	},
	premium: {
		filters: {
			advanced: true,
		},
		daily_limits: PLAN_DAILY_LIMITS.premium,
	},
};
