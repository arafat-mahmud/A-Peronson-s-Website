import { jest } from "@jest/globals";

// The e-sign provider webhook is public; it must not accept unsigned calls in
// production when ESIGN_WEBHOOK_SECRET is missing (anyone could mark a contract signed).
const handleSignCallback = jest.fn(async () => ({ id: "c-1" }));
jest.unstable_mockModule("../../server/services/eSignService.js", () => ({
	createSignSession: jest.fn(),
	handleSignCallback,
}));

const { createContractSignCallback } = await import("../../server/controllers/documentController.js");

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
		expect(handleSignCallback).toHaveBeenCalledWith("c-1", expect.objectContaining({ buyer_signed: true }));
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
		const { updateMySubscription } = await import("../../server/controllers/subscriptionController.js");
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
		await updateMySubscription({ user: { id: "u-1" }, body: { plan: "free", auto_renew: false } }, res);
		expect(res.statusCode).toBe(200);
		expect(upsertSubscription).toHaveBeenCalledWith("u-1", "free", false, expect.any(Object));
	});
});
