import {
	BUYER_COUNTRY_OPTIONS as BUYER_COUNTRY_OPTIONS_SOURCE,
	EU_COUNTRIES as EU_COUNTRIES_SOURCE,
	isEuCountry as isEuCountrySource,
} from "./geo.js";

const BUYER_COUNTRY_OPTIONS = BUYER_COUNTRY_OPTIONS_SOURCE;
const EU_COUNTRIES = EU_COUNTRIES_SOURCE;
const isEuCountry = isEuCountrySource;
const COUNTRY_OPTIONS = BUYER_COUNTRY_OPTIONS_SOURCE;

const PUBLIC_ACCOUNT_TYPES = [
	{ label: "Factory", value: "factory" },
	{ label: "Buying house", value: "buying_house" },
	{ label: "Buyer", value: "buyer" },
];

const ELEVATED_ACCOUNT_TYPES = [
	{ label: "Administrator", value: "admin" },
	{ label: "System Owner", value: "owner" },
	{ label: "Operational Agent", value: "agent" },
	{ label: "Buying House (Root)", value: "buying_house" },
	{ label: "Factory (Root)", value: "factory" },
	{ label: "Buyer (Root)", value: "buyer" },
];

// The stored values stay "garments" / "textile" (existing rows depend on
// them); only the label names the industry the way the trade does.
const FACTORY_SECTOR_OPTIONS = [
	{ label: "Garments Industry", value: "garments" },
	{ label: "Textile Industry", value: "textile" },
];

// Production capacity is "quantity + unit + period" so a garment factory
// (pieces) and a textile mill (meters, kilograms) are both described exactly.
const CAPACITY_UNIT_OPTIONS = [
	{ label: "Pieces", value: "pieces", sectors: ["garments"] },
	{ label: "Sets", value: "sets", sectors: ["garments"] },
	{ label: "Dozens", value: "dozens", sectors: ["garments"] },
	{ label: "Meters", value: "meters", sectors: ["textile"] },
	{ label: "Yards", value: "yards", sectors: ["textile"] },
	{ label: "Kilograms", value: "kilograms", sectors: ["textile"] },
	{ label: "Tonnes", value: "tonnes", sectors: ["textile"] },
];

const CAPACITY_PERIOD_OPTIONS = [
	{ label: "per day", value: "day" },
	{ label: "per week", value: "week" },
	{ label: "per month", value: "month" },
];

const COMMON_CERTIFICATIONS = [
	"ISO 9001",
	"ISO 14001",
	"WRAP",
	"amfori BSCI",
	"SEDEX / SMETA",
	"OEKO-TEX Standard 100",
	"GOTS",
	"GRS",
	"BCI",
	"Higg Index",
	"LEED",
	"Accord / RSC",
];

const MAX_EMPLOYEE_COUNT = 1_000_000;
const MAX_CAPACITY_QUANTITY = 1_000_000_000;

const garmentCategories = [
	"T-Shirt", "Polo", "Denim", "Hoodie", "Sportswear", "Knitwear",
	"Woven", "Outerwear", "Activewear", "Casual Wear", "Formal Wear",
	"Uniforms", "Workwear", "Sleepwear", "Undergarments", "Swimwear",
	"Childrenswear", "Accessories", "Footwear", "Bottoms", "Tops",
	"Dresses", "Suits", "Jackets", "Jeans",
];

const textileCategories = [
	"Cotton", "Polyester", "Nylon", "Silk", "Wool", "Linen",
	"Rayon", "Spandex", "Denim", "Velvet", "Satin", "Chiffon",
	"Jersey", "Fleece", "Tweed", "Canvas", "Twill", "Crepe",
	"Georgette", "Organza", "Chambray", "Flannel", "Jute",
];

const INDUSTRY_CATEGORIES = [
	{
		label: "Garments",
		items: [
			"T-Shirt", "Polo", "Denim", "Hoodie", "Sportswear", "Knitwear",
			"Woven", "Outerwear", "Activewear", "Casual Wear", "Formal Wear",
			"Uniforms", "Workwear", "Sleepwear", "Undergarments", "Swimwear",
			"Childrenswear", "Jeans",
		],
	},
	{
		label: "Textile & Fabrics",
		items: [
			"Cotton", "Polyester", "Nylon", "Silk", "Wool", "Linen",
			"Rayon", "Spandex", "Velvet", "Satin", "Chiffon",
		],
	},
	{
		label: "Fabric Weaves & Finishes",
		items: [
			"Jersey", "Fleece", "Tweed", "Canvas", "Twill", "Crepe",
			"Georgette", "Organza", "Chambray", "Flannel", "Jute",
		],
	},
	{
		label: "Accessories & Trims",
		items: [
			"Buttons", "Zippers", "Labels & Tags", "Ribbons & Bows",
			"Elastic & Waistbands", "Laces & Cords",
		],
	},
	{
		label: "Footwear & Leather",
		items: [
			"Footwear", "Leather Goods", "Bags & Luggage", "Belts & Suspenders",
		],
	},
	{
		label: "Home Textiles & Furnishing",
		items: [
			"Bed Linen", "Curtains & Drapes", "Carpets & Rugs",
			"Towels & Towelling", "Table Linen",
		],
	},
	{
		label: "Industrial & Technical Textiles",
		items: [
			"Nonwoven Fabrics", "Geotextiles", "Medical Textiles",
			"Automotive Textiles", "Protective Wear",
		],
	},
	{
		label: "Dyeing, Printing & Finishing",
		items: [
			"Fabric Dyeing", "Screen Printing", "Digital Printing",
			"Embroidery", "Wash & Finish",
		],
	},
];

const FACTORY_SECTOR_SET = new Set(FACTORY_SECTOR_OPTIONS.map((option) => option.value));

const VERIFICATION_FIELD_LABELS = {
	company_registration: "Business Registration",
	trade_license: "Trade License",
	tin: "TIN (Tax Identification Number)",
	ein: "EIN (Employer Identification Number)",
	vat: "VAT Number",
	eori: "EORI (Economic Operators Registration and Identification)",
	ior: "IOR (Importer of Record)",
	authorized_person_nid: "Authorized Person NID",
	bank_proof: "Bank Proof",
	erc: "ERC (Export Registration Certificate)",
};

const LEGAL_ID_FIELDS = [
	"business_registration_number",
	"business_registration",
	"company_registration",
	"company_registration_id",
	"government_company_registration_id",
	"vat_number",
	"vat",
	"eori",
	"ein",
	"ior",
	"tax_id",
	"tax_registration",
];

const STRONG_EVIDENCE_FIELDS = [
	"company_name",
	"legal_name",
	"country",
	"registered_country",
	"registered_address",
	"website",
	"domain",
	"business_email",
	"phone",
	"logo_url",
	"banner_url",
];

export const VERIFICATION_REQUIREMENTS = {
	factory: [
		"company_registration",
		"trade_license",
		"tin",
		"authorized_person_nid",
		"bank_proof",
		"erc",
	],
	buying_house: [
		"company_registration",
		"trade_license",
		"tin",
		"authorized_person_nid",
		"bank_proof",
	],
	buyer: {
		EU: ["company_registration", "vat", "eori", "bank_proof"],
		USA: ["company_registration", "ein", "ior", "bank_proof"],
		OTHER: ["company_registration", "bank_proof"],
	},
};

export function getBuyerRegionFromCountry(country) {
	const value = String(country || "")
		.trim()
		.toLowerCase();
	if (!value) {
		return "OTHER";
	}
	if (isEuCountry(value)) {
		return "EU";
	}
	if (["usa", "us", "united states", "united states of america"].includes(value)) {
		return "USA";
	}
	return "OTHER";
}

export function getVerificationRequirements(role, buyerCountry = "") {
	if (role === "buyer") {
		const region = getBuyerRegionFromCountry(buyerCountry);
		return VERIFICATION_REQUIREMENTS.buyer[region] || VERIFICATION_REQUIREMENTS.buyer.OTHER;
	}
	return VERIFICATION_REQUIREMENTS[role] || [];
}

export function isValidFactorySector(value) {
	return FACTORY_SECTOR_SET.has(
		String(value || "")
			.trim()
			.toLowerCase(),
	);
}

const CAPACITY_UNIT_SET = new Set(CAPACITY_UNIT_OPTIONS.map((option) => option.value));
const CAPACITY_PERIOD_SET = new Set(CAPACITY_PERIOD_OPTIONS.map((option) => option.value));

/** "garments" -> "Garments Industry"; free-text legacy values pass through. */
export function industryLabel(value) {
	const key = String(value || "").trim().toLowerCase();
	const option = FACTORY_SECTOR_OPTIONS.find((item) => item.value === key);
	if (option) return option.label;
	return String(value || "").trim();
}

/** Units that fit a sector; every unit when the sector is unknown. */
export function capacityUnitsForSector(sector) {
	const key = String(sector || "").trim().toLowerCase();
	const matching = CAPACITY_UNIT_OPTIONS.filter((unit) => unit.sectors.includes(key));
	return matching.length > 0 ? matching : CAPACITY_UNIT_OPTIONS;
}

function toWholeNumber(value) {
	if (value === null || value === undefined || value === "") return null;
	const number = Number(String(value).replace(/[,\s]/g, ""));
	return Number.isFinite(number) ? number : Number.NaN;
}

/**
 * Validates and normalizes employee count + production capacity.
 * Returns { value, errors }: `value` holds only the fields that were given,
 * `errors` maps a field to a readable message. Empty input is not an error;
 * callers decide which fields are required.
 */
export function normalizeCompanyFacts(input = {}) {
	const value = {};
	const errors = {};

	const employees = toWholeNumber(input.employee_count);
	if (employees !== null) {
		if (!Number.isInteger(employees) || employees < 1 || employees > MAX_EMPLOYEE_COUNT) {
			errors.employee_count = `Enter a whole number between 1 and ${MAX_EMPLOYEE_COUNT.toLocaleString("en-US")}.`;
		} else {
			value.employee_count = employees;
		}
	}

	const capacity = input.production_capacity;
	if (capacity && typeof capacity === "object") {
		const quantity = toWholeNumber(capacity.quantity);
		const unit = String(capacity.unit || "").trim().toLowerCase();
		const period = String(capacity.period || "").trim().toLowerCase();
		const anyGiven = quantity !== null || unit || period;
		if (anyGiven) {
			if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_CAPACITY_QUANTITY) {
				errors.production_capacity = "Enter the capacity as a whole number greater than 0.";
			} else if (!CAPACITY_UNIT_SET.has(unit)) {
				errors.production_capacity = "Choose a capacity unit.";
			} else if (!CAPACITY_PERIOD_SET.has(period)) {
				errors.production_capacity = "Choose a capacity period.";
			} else {
				value.production_capacity = { quantity, unit, period };
			}
		}
	}

	return { value, errors };
}

/** { quantity: 250000, unit: "pieces", period: "month" } -> "250,000 pieces / month". */
export function formatProductionCapacity(capacity) {
	if (!capacity || typeof capacity !== "object") return "";
	const quantity = Number(capacity.quantity);
	if (!(Number.isFinite(quantity) && quantity > 0)) return "";
	const unit = String(capacity.unit || "").trim();
	const period = String(capacity.period || "").trim();
	return `${quantity.toLocaleString("en-US")} ${unit}${period ? ` / ${period}` : ""}`.trim();
}

export function getLegalIdFields() {
	return [...LEGAL_ID_FIELDS];
}

export function getStrongEvidenceFields() {
	return [...STRONG_EVIDENCE_FIELDS];
}

export {
	BUYER_COUNTRY_OPTIONS,
	CAPACITY_PERIOD_OPTIONS,
	CAPACITY_UNIT_OPTIONS,
	COMMON_CERTIFICATIONS,
	COUNTRY_OPTIONS,
	ELEVATED_ACCOUNT_TYPES,
	EU_COUNTRIES,
	FACTORY_SECTOR_OPTIONS,
	INDUSTRY_CATEGORIES,
	LEGAL_ID_FIELDS,
	STRONG_EVIDENCE_FIELDS,
	isEuCountry,
	PUBLIC_ACCOUNT_TYPES,
	VERIFICATION_FIELD_LABELS,
	garmentCategories,
	textileCategories,
};
