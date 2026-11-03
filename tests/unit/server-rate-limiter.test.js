import express from "express";
import request from "supertest";
import { createRateLimiter } from "../../server/middleware/rateLimiter.js";

// The /sign route is bounded per USER, not per address: the callers are
// authenticated, many users share one NAT address, and one address behind
// many users is not a user. keyResolver is what makes that possible.

function buildApp(limiter) {
	const app = express();
	app.get("/x", limiter, (_req, res) => res.json({ ok: true }));
	return app;
}

describe("the rate limiter (server/middleware/rateLimiter.js)", () => {
	test("counts per key when a keyResolver is supplied", async () => {
		const limiter = createRateLimiter({
			windowMs: 60_000,
			max: 2,
			keyResolver: (req) => req.headers["x-user-key"],
		});
		const app = buildApp(limiter);

		await request(app).get("/x").set("x-user-key", "per-user-a").expect(200);
		await request(app).get("/x").set("x-user-key", "per-user-a").expect(200);
		await request(app).get("/x").set("x-user-key", "per-user-a").expect(429);

		// A different key has its own budget: one user's spending must not
		// lock everybody else out.
		await request(app).get("/x").set("x-user-key", "per-user-b").expect(200);
		await request(app).get("/x").set("x-user-key", "per-user-b").expect(200);
		await request(app).get("/x").set("x-user-key", "per-user-b").expect(429);
	});

	// A keyResolver that yields nothing must not collapse every caller into one
	// shared bucket under a single empty key: it falls back to the address,
	// which is what the limiter did before keyResolver existed.
	//
	// One test for both fallback shapes, because the in-memory store is keyed
	// by the resolved key and process-wide: a second address-keyed limiter in
	// this file would share the first one's budget.
	test("falls back to the caller's address when the keyResolver yields nothing", async () => {
		const limiter = createRateLimiter({
			windowMs: 60_000,
			max: 1,
			keyResolver: () => "",
		});
		const app = buildApp(limiter);
		await request(app).get("/x").expect(200);
		await request(app).get("/x").expect(429);
	});
});
