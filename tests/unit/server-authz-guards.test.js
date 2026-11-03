import { jest } from "@jest/globals";

// The e-sign provider webhook is public; it must not accept unsigned calls in
// production when ESIGN_WEBHOOK_SECRET is missing (anyone could mark a contract signed).
const handleSignCallback = jest.fn(async () => ({ id: "c-1" }));
jest.unstable_mockModule("../../server/services/eSignService.js", () => ({
	createSignSession: jest.fn(),
	handleSignCallback,
}));

const { createContractSignCallback } = await import(
	"../../server/controllers/documentController.js"
);

function call(headers = {}) {
	const res = {
		statusCode: 200,
		body: null,
		status(code) {
			this.statusCode = code;
			return this;
		},
		json(body) {
			this.body = body;
			return this;
		},
	};
	const req = { params: { contractId: "c-1" }, headers, query: {}, body: { buyer_signed: true } };
	return createContractSignCallback(req, res).then(() => res);
}

describe("e-sign webhook guard (documentController)", () => {
	const saved = { env: process.env.NODE_ENV, secret: process.env.ESIGN_WEBHOOK_SECRET };
	afterEach(() => {
		process.env.NODE_ENV = saved.env;
		if (saved.secret === undefined) delete process.env.ESIGN_WEBHOOK_SECRET;
		else process.env.ESIGN_WEBHOOK_SECRET = saved.secret;
		handleSignCallback.mockClear();
	});

	test("production without a secret refuses every call", async () => {
		process.env.NODE_ENV = "production";
		delete process.env.ESIGN_WEBHOOK_SECRET;
		const res = await call();
		expect(res.statusCode).toBe(503);
		expect(handleSignCallback).not.toHaveBeenCalled();
	});

	test("with a secret, a wrong static secret is refused", async () => {
		process.env.NODE_ENV = "production";
		process.env.ESIGN_WEBHOOK_SECRET = "test-webhook-secret";
		const res = await call({ "x-esign-secret": "wrong" });
		expect(res.statusCode).toBe(403);
		expect(handleSignCallback).not.toHaveBeenCalled();
	});

	test("with a secret, the matching static secret is accepted", async () => {
		process.env.NODE_ENV = "production";
		process.env.ESIGN_WEBHOOK_SECRET = "test-webhook-secret";
		const res = await call({ "x-esign-secret": "test-webhook-secret" });
		expect(res.statusCode).toBe(200);
		expect(handleSignCallback).toHaveBeenCalledWith(
			"c-1",
			expect.objectContaining({ buyer_signed: true }),
		);
	});
});

describe("self-service subscription changes", () => {
	test("a user cannot grant themselves Premium; cancelling still works", async () => {
		jest.resetModules();
		const upsertSubscription = jest.fn(async (userId, plan) => ({ user_id: userId, plan }));
		jest.unstable_mockModule("../../server/services/subscriptionService.js", () => ({
			getSubscription: jest.fn(),
			upsertSubscription,
			renewPremiumMonthly: jest.fn(),
			getRemainingDays: jest.fn(),
			isSubscriptionValid: jest.fn(),
		}));
		const { updateMySubscription } = await import(
			"../../server/controllers/subscriptionController.js"
		);
		const res = {
			statusCode: 200,
			status(code) {
				this.statusCode = code;
				return this;
			},
			json(body) {
				this.body = body;
				return this;
			},
		};

		await updateMySubscription({ user: { id: "u-1" }, body: { plan: "premium" } }, res);
		expect(res.statusCode).toBe(402);
		expect(upsertSubscription).not.toHaveBeenCalled();

		res.statusCode = 200;
		await updateMySubscription(
			{ user: { id: "u-1" }, body: { plan: "free", auto_renew: false } },
			res,
		);
		expect(res.statusCode).toBe(200);
		expect(upsertSubscription).toHaveBeenCalledWith("u-1", "free", false, expect.any(Object));
	});
});

describe("contract signatures (documentService.updateContractSignatures)", () => {
	const contract = {
		id: "k-1",
		entity_type: "contract",
		buyer_id: "buyer-1",
		factory_id: "factory-1",
	};

	test("a party cannot sign the other party's side", async () => {
		jest.resetModules();
		jest.unstable_mockModule("../../server/utils/prisma.js", () => ({
			default: { document: { findFirst: async () => ({ ...contract }) } },
		}));
		const { updateContractSignatures } = await import("../../server/services/documentService.js");
		const buyer = { id: "buyer-1", role: "buyer" };
		const factory = { id: "factory-1", role: "factory" };

		await expect(
			updateContractSignatures("k-1", { factory_signature_state: "signed" }, buyer),
		).resolves.toBe("forbidden");
		await expect(
			updateContractSignatures("k-1", { buyer_signature_state: "signed" }, factory),
		).resolves.toBe("forbidden");
		await expect(
			updateContractSignatures(
				"k-1",
				{ buyer_signature_state: "signed" },
				{ id: "someone", role: "buyer" },
			),
		).resolves.toBe("forbidden");
	});
});

describe("boost purchase (boostService.purchaseBoost)", () => {
	test("the client cannot choose the price or an arbitrary duration", async () => {
		jest.resetModules();
		const debitWallet = jest.fn(async () => ({ ok: true }));
		jest.unstable_mockModule("../../server/utils/prisma.js", () => ({
			default: { boost: { findFirst: async () => null, create: async ({ data }) => data } },
		}));
		jest.unstable_mockModule("../../server/services/walletService.js", () => ({ debitWallet }));
		jest.unstable_mockModule("../../server/services/eventTrackingService.js", () => ({
			trackEvent: async () => {},
		}));
		const { purchaseBoost } = await import("../../server/services/boostService.js");

		const cheap = await purchaseBoost("u-1", {
			scope: "feed",
			duration_days: 3650,
			price_usd: 0.01,
		});
		expect(debitWallet).toHaveBeenLastCalledWith(expect.objectContaining({ amountUsd: 9.99 }));
		expect(cheap.ends_at.getTime() - cheap.starts_at.getTime()).toBe(7 * 24 * 60 * 60 * 1000);

		const month = await purchaseBoost("u-1", { scope: "profile", duration_days: 30, price_usd: 1 });
		expect(debitWallet).toHaveBeenLastCalledWith(expect.objectContaining({ amountUsd: 42.81 }));
		expect(month.price_usd).toBe(42.81);
	});
});
