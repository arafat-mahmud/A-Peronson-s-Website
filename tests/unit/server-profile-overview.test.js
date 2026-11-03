import { jest } from "@jest/globals";

// Regression: GET /api/profiles/:id returned HTTP 500 for every non-admin user
// viewing another company's profile (client report 02/11/2026, IMG-20261102-WA0038):
// `relationship` was read before its `const` declaration.
describe("profile overview (server/services/profileService.js)", () => {
	let prisma;
	let profiles;
	let calls;

	const factoryA = {
		id: "fac-a",
		name: "Alice",
		role: "factory",
		verified: false,
		profile: { organization_name: "Alpha Knit", phone: "+8801000", factory_sector: "garments" },
	};
	const factoryB = {
		id: "fac-b",
		name: "Bob",
		role: "factory",
		verified: true,
		profile: {
			organization_name: "Beta Textiles",
			phone: "+8802000",
			factory_sector: "textile",
			employee_count: 450,
			production_capacity: { quantity: 250000, unit: "meters", period: "month" },
			certifications: ["ISO 9001", "WRAP"],
		},
	};
	const admin = { id: "adm", name: "Admin", role: "admin", profile: {} };
	const usersById = { [factoryA.id]: factoryA, [factoryB.id]: factoryB, [admin.id]: admin };

	beforeEach(async () => {
		jest.resetModules();
		calls = { connections: [], whole: 0 };
		prisma = (await import("../../server/utils/prisma.js")).default;
		prisma.user.findUnique = async ({ where }) => usersById[where.id] || null;
		prisma.userConnection.findMany = async (args) => {
			if (!args?.where) calls.whole += 1;
			calls.connections.push(args);
			return [];
		};
		prisma.requirement.count = async () => 2;
		prisma.product.count = async () => 3;
		prisma.partnerRequest.count = async () => 1;
		for (const model of ["requirement", "product", "partnerRequest"]) {
			prisma[model].findMany = async () => {
				calls.whole += 1;
				return [];
			};
		}
		profiles = await import("../../server/services/profileService.js");
	});

	test("a company can open another company's profile (no 500)", async () => {
		const data = await profiles.getProfileOverview(factoryA.id, factoryB.id);
		expect(data).not.toBe("not_found");
		expect(data.relationship).toEqual({ following: false, friend_status: "none" });
		expect(data.profile_private).toBeUndefined();
		expect(data.user.profile.phone).toBeUndefined();
		expect(data.counts).toEqual({ requests: 2, products: 3, connected_factories: null });
	});

	test("only the viewer/profile pair is read - never whole tables", async () => {
		await profiles.getProfileOverview(factoryA.id, factoryB.id);
		expect(calls.whole).toBe(0);
		expect(calls.connections).toHaveLength(1);
		expect(JSON.stringify(calls.connections[0].where)).toContain(factoryA.id);
	});

	test("self and admin views keep private fields", async () => {
		const self = await profiles.getProfileOverview(factoryB.id, factoryB.id);
		expect(self.relationship.friend_status).toBe("self");
		expect(self.profile_private).toBeDefined();
		const byAdmin = await profiles.getProfileOverview(admin.id, factoryB.id);
		expect(byAdmin.viewer_permissions.is_admin).toBe(true);
		expect(byAdmin.profile_private).toBeDefined();
	});

	test("public profile carries the company facts the profile design shows", async () => {
		const { user } = await profiles.getProfileOverview(factoryA.id, factoryB.id);
		expect(user.profile.organization_name).toBe("Beta Textiles");
		expect(user.profile.industry_label).toBe("Textile Industry");
		expect(user.profile.employee_count).toBe(450);
		expect(user.profile.production_capacity_label).toBe("250,000 meters / month");
		expect(user.profile.certifications).toEqual(["ISO 9001", "WRAP"]);
	});

	test("unknown profile id stays a 404 signal", async () => {
		expect(await profiles.getProfileOverview(factoryA.id, "missing")).toBe("not_found");
	});
});

describe("company facts taxonomy (shared/config/platformTaxonomy.js)", () => {
	test("normalizes employee count and capacity, rejects bad input", async () => {
		const tax = await import("../../shared/config/platformTaxonomy.js");
		expect(
			tax.normalizeCompanyFacts({
				employee_count: "1,200",
				production_capacity: { quantity: "50000", unit: "pieces", period: "week" },
			}),
		).toEqual({
			value: {
				employee_count: 1200,
				production_capacity: { quantity: 50000, unit: "pieces", period: "week" },
			},
			errors: {},
		});
		const bad = tax.normalizeCompanyFacts({
			employee_count: 0,
			production_capacity: { quantity: 10, unit: "bananas", period: "month" },
		});
		expect(Object.keys(bad.errors).sort()).toEqual(["employee_count", "production_capacity"]);
		expect(tax.normalizeCompanyFacts({}).errors).toEqual({});
		expect(tax.industryLabel("garments")).toBe("Garments Industry");
		expect(tax.formatProductionCapacity({ quantity: 1000, unit: "kilograms", period: "day" })).toBe(
			"1,000 kilograms / day",
		);
	});
});

describe("organization name rename rules (server/services/userService.js updateProfile)", () => {
	let prisma;
	let users;
	let stored;

	async function load(user) {
		jest.resetModules();
		stored = { ...user };
		prisma = (await import("../../server/utils/prisma.js")).default;
		prisma.user.findUnique = async () => stored;
		prisma.user.update = async ({ data }) => {
			stored = { ...stored, ...data };
			return stored;
		};
		users = await import("../../server/services/userService.js");
	}

	const base = { id: "u-1", role: "factory", verified: false, subscription_status: "free" };

	test("settings' display_name updates organization_name and protected keys are ignored", async () => {
		await load({ ...base, profile: { organization_name: "Old Co", mfa_setup_code: "keep" } });
		await users.updateProfile("u-1", { display_name: "New Co", mfa_setup_code: "attacker" });
		expect(stored.profile.organization_name).toBe("New Co");
		expect(stored.profile.mfa_setup_code).toBe("keep");
		expect(stored.profile.display_name).toBeUndefined();
	});

	test("after onboarding a rename is locked for 90 days", async () => {
		const recent = new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString();
		await load({
			...base,
			profile: {
				organization_name: "Old Co",
				onboarding_completed: "true",
				organization_name_changed_at: recent,
			},
		});
		await expect(
			users.updateProfile("u-1", { organization_name: "Another Co" }),
		).rejects.toMatchObject({
			status: 409,
			code: "ORG_NAME_LOCKED",
		});
	});

	test("verified companies must re-verify to rename; same name is not a rename", async () => {
		await load({
			...base,
			verified: true,
			profile: { organization_name: "Old Co", onboarding_completed: "true" },
		});
		await expect(
			users.updateProfile("u-1", { organization_name: "Renamed" }),
		).rejects.toMatchObject({
			code: "ORG_NAME_REVERIFY_REQUIRED",
		});
		await expect(users.updateProfile("u-1", { organization_name: "old co" })).resolves.toBeTruthy();
	});

	test("first rename after onboarding is allowed and timestamped", async () => {
		await load({ ...base, profile: { organization_name: "Old Co", onboarding_completed: "true" } });
		await users.updateProfile("u-1", { organization_name: "Fresh Co" });
		expect(stored.profile.organization_name).toBe("Fresh Co");
		expect(Date.parse(stored.profile.organization_name_changed_at)).toBeGreaterThan(0);
	});
});
