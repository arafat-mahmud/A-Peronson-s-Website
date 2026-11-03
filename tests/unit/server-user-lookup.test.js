import { jest } from "@jest/globals";

describe("public profile lookup (server/services/userService.js)", () => {
	let users;
	let prisma;

	const company = {
		id: "co-1",
		name: "Karim Textiles",
		email: "owner@karim.example",
		username: "karim_owner",
		role: "factory",
		verified: true,
		org_owner_id: null,
		profile: { organization_name: "Karim Textiles Ltd", phone: "+880100000001", country: "BD" },
	};
	const personal = {
		id: "p-9",
		name: "Rahim Uddin",
		email: "rahim@example.com",
		username: "rahim9",
		role: "factory",
		verified: false,
		org_owner_id: null,
		profile: { organization_name: "", phone: "+880100000009" },
	};
	const agent = {
		id: "ag-1",
		name: "Agent One",
		email: "ag1@example.com",
		username: "ag1",
		role: "agent",
		verified: false,
		org_owner_id: "co-1",
		profile: { phone: "+880100000011" },
	};

	beforeEach(async () => {
		jest.resetModules();
		prisma = (await import("../../server/utils/prisma.js")).default;
		prisma.user.findMany = async () => [company];
		prisma.user.count = async () => 2;
		users = await import("../../server/services/userService.js");
	});

	test("company display name prefers organization_name over personal name", () => {
		expect(users.companyDisplayName(company)).toBe("Karim Textiles Ltd");
		expect(users.companyDisplayName(personal)).toBe("Rahim Uddin");
		expect(users.companyDisplayName({})).toBe("Unknown");
	});

	test("stranger sees company data but no email/username/phone", () => {
		const out = users.shapeLookupUser({ id: "stranger", role: "buyer" }, company);
		expect(out.name).toBe("Karim Textiles Ltd");
		expect(out.email).toBeUndefined();
		expect(out.username).toBeUndefined();
		expect(out.profile.phone).toBeUndefined();
		expect(out.profile.country).toBe("BD");
		expect(out.verified).toBe(true);
	});

	test("self, platform admin, and same-org members keep contact fields", () => {
		expect(users.shapeLookupUser(company, company).email).toBe("owner@karim.example");
		expect(users.shapeLookupUser({ id: "a", role: "admin" }, company).email).toBe(
			"owner@karim.example",
		);
		expect(users.shapeLookupUser(agent, company).email).toBe("owner@karim.example");
		expect(users.shapeLookupUser(company, agent).email).toBe("ag1@example.com");
		expect(users.shapeLookupUser({ id: "stranger", role: "buyer" }, agent).email).toBeUndefined();
	});

	test("lookup attaches capacity for company accounts", async () => {
		const out = await users.lookupPublicUsers({ id: "stranger", role: "buyer" }, ["co-1"]);
		expect(out.users).toHaveLength(1);
		expect(out.users[0].capacity).toBe(2);
		expect(out.users[0].email).toBeUndefined();
	});

	test("owner-declared profile capacity wins over the agent count", async () => {
		company.profile = { ...company.profile, capacity: 450 };
		const out = await users.lookupPublicUsers({ id: "stranger", role: "buyer" }, ["co-1"]);
		expect(out.users[0].capacity).toBe(450);
	});
});
