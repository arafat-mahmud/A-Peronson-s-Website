import assert from "node:assert/strict";
import test from "node:test";
import prisma from "../../utils/prisma.js";
import { getRate, normalizeMoney } from "../currencyService.js";

function withMockedPrisma({ currencyConfig, fxRate, upsertImpl } = {}) {
	prisma.currencyConfig = {
		findFirst: async () => currencyConfig || { baseCurrency: "USD", staleToleranceMinutes: 1440 },
	};
	prisma.fxRate = {
		findUnique: async () => fxRate || null,
		upsert: upsertImpl || (async () => null),
	};
}

test("normalizeMoney converts from quote currency to base currency using live FX", async () => {
	withMockedPrisma({ fxRate: null });
	const originalFetch = global.fetch;
	global.fetch = async () => ({
		ok: true,
		async json() {
			return { rates: { EUR: 0.8 } };
		},
	});

	const converted = await normalizeMoney(80, "EUR", "USD");
	assert.equal(converted.amount, 100);
	assert.equal(converted.currency_base, "USD");
	assert.equal(converted.currency_from, "EUR");
	assert.equal(converted.fx_stale, false);
	assert.equal(converted.warning, null);

	global.fetch = originalFetch;
});

test("getRate marks cached entry stale when expired", async () => {
	withMockedPrisma({
		fxRate: {
			rate: 0.92,
			source: "cached",
			fetchedAt: new Date("2026-03-01T00:00:00.000Z"),
			expiresAt: new Date("2026-03-02T00:00:00.000Z"),
		},
	});

	const originalFetch = global.fetch;
	global.fetch = async () => {
		throw new Error("provider_down");
	};

	const rate = await getRate("USD", "GBP");
	assert.equal(rate.rate, 0.92);
	assert.equal(rate.fx_stale, true);
	assert.equal(rate.stale, true);
	assert.equal(rate.warning?.code, "fx_provider_unavailable_stale_rate");

	global.fetch = originalFetch;
});

test("normalizeMoney returns unavailable warning when no cache and provider fails", async () => {
	withMockedPrisma({ fxRate: null });

	const originalFetch = global.fetch;
	global.fetch = async () => {
		throw new Error("network_down");
	};

	const converted = await normalizeMoney(50, "NOK", "USD");
	assert.equal(converted.amount, null);
	assert.equal(converted.fx_stale, true);
	assert.equal(converted.warning?.code, "fx_rate_unavailable");

	global.fetch = originalFetch;
});
