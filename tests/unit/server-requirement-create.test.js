import fs from "node:fs";
import { jest } from "@jest/globals";

// Field name -> Prisma type, read from schema.prisma (the generated client's
// DMMF is not available under the jsdom test environment).
function requirementFields() {
	const schema = fs.readFileSync("prisma/schema.prisma", "utf8");
	const block = schema.match(/\nmodel Requirement \{([\s\S]*?)\n\}/)[1];
	const fields = new Map();
	for (const line of block.split(/\r?\n/)) {
		const match = line.match(/^\s+(\w+)\s+(\w+)/);
		if (match) fields.set(match[1], { type: match[2] });
	}
	return fields;
}

// Regression: POST /api/requirements answered HTTP 500 for every buyer request.
// The service wrote fields the Requirement model does not have (match_id) or
// had no column for yet (priority_tier/priority_until), and "" into the
// DateTime column assigned_at, so Prisma rejected the insert.
describe("buyer requirement insert matches the Prisma model", () => {
	test("every written field exists and DateTime fields hold dates", async () => {
		jest.resetModules();
		const fields = requirementFields();
		expect(fields.has("buyer_id")).toBe(true);

		let written = null;
		const capture = async ({ data }) => {
			written = data;
			throw new Error("stop after capture");
		};
		// Stub client: every model answers empty; the transaction runs its
		// callback so the insert data can be inspected.
		const models = new Map();
		const stub = new Proxy(
			{},
			{
				get: (_target, prop) => {
					if (prop === "$transaction")
						return async (fn) => fn({ requirement: { create: capture } });
					if (typeof prop !== "string" || prop.startsWith("$")) return async () => undefined;
					if (!models.has(prop)) {
						models.set(prop, {
							findMany: async () => [],
							findUnique: async () => null,
							findFirst: async () => null,
							count: async () => 0,
							create: async () => ({}),
							update: async () => ({}),
							upsert: async () => ({}),
						});
					}
					return models.get(prop);
				},
			},
		);
		jest.unstable_mockModule("../../server/utils/prisma.js", () => ({ default: stub }));
		const { createRequirement } = await import("../../server/services/requirementService.js");
		await createRequirement("buyer-1", {
			title: "Cotton crew neck t-shirt",
			category: "T-Shirt",
			genderTarget: "Men",
			season: "Summer",
			totalQuantity: "2000",
			unit: "pcs",
			targetFobPrice: "2.5",
			incoterm: "FOB",
			exFactoryDate: "2027-03-01",
			paymentTerms: "LC at sight",
		}).catch(() => {});

		expect(written).not.toBeNull();
		const unknown = Object.keys(written).filter((key) => !fields.has(key));
		expect(unknown).toEqual([]);
		for (const [key, value] of Object.entries(written)) {
			if (fields.get(key).type === "DateTime" && value !== null && value !== undefined) {
				expect(Number.isNaN(Date.parse(value))).toBe(false);
			}
		}
	});
});
