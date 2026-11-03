import { jest } from "@jest/globals";

describe("entitlement service (server/services/entitlementService.js)", () => {
	let entitlements;
	let prisma;

	beforeEach(async () => {
		jest.resetModules();
		prisma = (await import("../../server/utils/prisma.js")).default;
		// Default: no subscription rows, no users, default admin config.
		prisma.user.findUnique = async () => null;
		prisma.user.count = async () => 0;
		jest.unstable_mockModule("../../server/services/subscriptionService.js", () => ({
			getSubscription: async () => null,
		}));
		jest.unstable_mockModule("../../server/services/adminConfigService.js", () => ({
			getAdminConfig: async () => ({}),
		}));
		entitlements = await import("../../server/services/entitlementService.js");
	});

	test("free users get a free plan with locked premium features", async () => {
		const user = { id: "u-free", role: "buyer", subscription_status: "free" };
		expect(await entitlements.getPlanForUser(user)).toBe("free");
		expect(await entitlements.isPremiumUser(user)).toBe(false);
		const got = await entitlements.getEntitlements(user);
		expect(got.plan).toBe("free");
		expect(got.premium).toBe(false);
		expect(got.premium_features).toContain("advanced_search_filters");
		expect(got.features.advanced_search_filters).toBe(false);
	});

	test("premium subscription_status upgrades the plan", async () => {
		const user = { id: "u-prem", role: "factory", subscription_status: "premium" };
		expect(await entitlements.getPlanForUser(user)).toBe("premium");
		const got = await entitlements.getEntitlements(user);
		expect(got.features.profile_boost).toBe(true);
	});

	test("ensureEntitlement resolves for granted features and throws PREMIUM_REQUIRED otherwise", async () => {
		const premium = { id: "u-p", role: "buyer", subscription_status: "premium" };
		await expect(
			entitlements.ensureEntitlement(premium, "advanced_search_filters"),
		).resolves.toBeDefined();

		const free = { id: "u-f", role: "buyer", subscription_status: "free" };
		const err = await entitlements
			.ensureEntitlement(free, "advanced_search_filters")
			.catch((e) => e);
		expect(err.code).toBe("PREMIUM_REQUIRED");
		expect(err.status).toBe(403);
	});

	test("owner and admin on premium get team_access_management", async () => {
		for (const role of ["owner", "admin"]) {
			const got = await entitlements.getEntitlements({
				id: `u-${role}`,
				role,
				subscription_status: "premium",
			});
			expect(got.features.team_access_management).toBe(true);
		}
	});

	test("unknown roles get an empty feature map instead of crashing", async () => {
		const got = await entitlements.getEntitlements({
			id: "u-x",
			role: "mystery",
			subscription_status: "free",
		});
		expect(got.features).toEqual({});
		expect(got.role).toBe("mystery");
	});

	test("null user resolves to the free plan", async () => {
		expect(await entitlements.getPlanForUser(null)).toBe("free");
	});
});
