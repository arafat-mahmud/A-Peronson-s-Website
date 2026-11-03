export const DEFAULT_CORE_FILTER_KEYS = [
	"industry",
	"category",
	"verifiedOnly",
	"incoterms",
	"moqRange",
	"priceRange",
	"orgType",
	"leadTimeMax",
];

export const ADVANCED_FILTER_KEYS = [
	"auditDate",
	"priorityOnly",
	"fabricType",
	"gsmMin",
	"gsmMax",
	"sizeRange",
	"colorPantone",
	"customization",
	"sampleAvailable",
	"sampleLeadTime",
	"certifications",
	"paymentTerms",
	"documentReady",
	"auditScoreMin",
	"languageSupport",
	"capacityMin",
	"processes",
	"yearsInBusinessMin",
	"responseTimeMax",
	"teamSeatsMin",
	"roleSeats",
	"handlesMultipleFactories",
	"hasPermissionMatrix",
	"permissionSection",
	"permissionSectionEdit",
	"exportPort",
	"distanceKm",
	"locationLat",
	"locationLng",
];

export function validateCoreFilterRenderKeys(renderedKeys = []) {
	const rendered = Array.from(new Set(renderedKeys.filter(Boolean)));
	const unknownKeys = rendered.filter((key) => !DEFAULT_CORE_FILTER_KEYS.includes(key));
	const exceededLimit = rendered.length > DEFAULT_CORE_FILTER_KEYS.length;

	return {
		rendered,
		unknownKeys,
		exceededLimit,
		isValid: unknownKeys.length === 0 && !exceededLimit,
	};
}
