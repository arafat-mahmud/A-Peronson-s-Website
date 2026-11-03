import { jest } from "@jest/globals";

describe("member free agent limit (server/services/memberService.js)", () => {
	let members;

	beforeEach(async () => {
		jest.resetModules();
		jest.unstable_mockModule("../../server/services/adminConfigService.js", () => ({
			getAdminConfig: async () => ({}),
		}));
		jest.unstable_mockModule("../../server/services/entitlementService.js", () => ({
			getPlanForUser: async () => "free",
		}));
		members = await import("../../server/services/memberService.js");
	});

	test("free member limit defaults to 3 when no admin config is stored", async () => {
		const constraints = await members.getMemberConstraints(null);
		expect(constraints.free_member_limit).toBe(3);
	});
});
