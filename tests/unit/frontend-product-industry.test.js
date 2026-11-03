import { FACTORY_SECTOR_OPTIONS } from "../../shared/config/platformTaxonomy.js";
import { resolveIndustryOption } from "../../src/pages/ProductManagement.jsx";

describe("product industry dropdown contract", () => {
	test("taxonomy exposes exactly the Garments + Textile options", () => {
		expect(FACTORY_SECTOR_OPTIONS).toEqual([
			{ label: "Garments Industry", value: "garments" },
			{ label: "Textile Industry", value: "textile" },
		]);
	});

	test("empty input selects the placeholder", () => {
		expect(resolveIndustryOption("")).toEqual({ value: "", isLegacy: false });
		expect(resolveIndustryOption(null)).toEqual({ value: "", isLegacy: false });
		expect(resolveIndustryOption(undefined)).toEqual({ value: "", isLegacy: false });
	});

	test("canonical values resolve to their option", () => {
		expect(resolveIndustryOption("garments")).toEqual({ value: "garments", isLegacy: false });
		expect(resolveIndustryOption("textile")).toEqual({ value: "textile", isLegacy: false });
	});

	test("legacy label-case entries resolve case-insensitively", () => {
		expect(resolveIndustryOption("Garments")).toEqual({ value: "garments", isLegacy: false });
		expect(resolveIndustryOption("TEXTILE")).toEqual({ value: "textile", isLegacy: false });
		expect(resolveIndustryOption("  Textile  ")).toEqual({ value: "textile", isLegacy: false });
	});

	test("unlisted industries are preserved verbatim as legacy values", () => {
		expect(resolveIndustryOption("Home Textiles")).toEqual({
			value: "Home Textiles",
			isLegacy: true,
		});
		expect(resolveIndustryOption("Apparel")).toEqual({ value: "Apparel", isLegacy: true });
	});
});
