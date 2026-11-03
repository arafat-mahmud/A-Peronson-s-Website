import prisma from "../utils/prisma.js";

const DEFAULT_BASE = "USD";
const DEFAULT_STALE_TOLERANCE_MINUTES = 24 * 60;
const FX_SOURCE = "frankfurter";
const HTTP_TIMEOUT_MS = 5000;

const memoryRates = new Map();

let fxHealth = {
	last_refresh_started_at: "",
	last_refresh_completed_at: "",
	last_refresh_ok_at: "",
	last_refresh_error_at: "",
	last_refresh_error: "",
	last_refresh_result: null,
};

function nowIso() {
	return new Date().toISOString();
}

function toCurrency(code, fallback = DEFAULT_BASE) {
	const raw = String(code || fallback)
		.trim()
		.toUpperCase();
	return raw || fallback;
}

function parseNumberish(value) {
	if (value === undefined || value === null) {
		return null;
	}
	const n = Number(String(value).replace(/[^\d.-]/g, ""));
	return Number.isFinite(n) ? n : null;
}

function parseRangeAmounts(value) {
	const raw = String(value || "").trim();
	if (!raw) {
		return { min: null, max: null };
	}
	const [a, b] = raw.split("-");
	const min = parseNumberish(a);
	const max = parseNumberish(b);
	return { min, max };
}

function isFuture(iso) {
	const ts = new Date(iso || "").getTime();
	return Number.isFinite(ts) && ts > Date.now();
}

async function getCurrencyConfig() {
	try {
		const row = await prisma.currencyConfig.findFirst();
		return {
			baseCurrency: toCurrency(row?.baseCurrency || row?.defaultBaseCurrency, DEFAULT_BASE),
			staleToleranceMinutes: Math.max(
				1,
				Number(
					row?.staleToleranceMinutes ||
						row?.staleThresholdHours * 60 ||
						DEFAULT_STALE_TOLERANCE_MINUTES,
				),
			),
		};
	} catch {
		return {
			baseCurrency: DEFAULT_BASE,
			staleToleranceMinutes: DEFAULT_STALE_TOLERANCE_MINUTES,
		};
	}
}

function memoryKey(base, quote) {
	return `${base}:${quote}`;
}

async function readCachedRate(base, quote) {
	const key = memoryKey(base, quote);
	if (memoryRates.has(key)) {
		return memoryRates.get(key);
	}

	try {
		const row = await prisma.fxRate.findUnique({
			where: {
				fx_base_quote: { base, quote },
			},
		});
		if (!row) {
			return null;
		}
		const cached = {
			base,
			quote,
			rate: Number(row.rate),
			source: String(row.source || "cached"),
			fetchedAt: row.fetchedAt?.toISOString?.() || row.fetchedAt,
			expiresAt: row.expiresAt?.toISOString?.() || row.expiresAt,
			stale: !isFuture(row.expiresAt),
		};
		memoryRates.set(key, cached);
		return cached;
	} catch {
		return null;
	}
}

async function persistRate(base, quote, rate, source, staleToleranceMinutes) {
	const fetchedAt = new Date();
	const expiresAt = new Date(fetchedAt.getTime() + staleToleranceMinutes * 60 * 1000);
	const payload = {
		base,
		quote,
		rate,
		source,
		fetchedAt,
		expiresAt,
	};
	memoryRates.set(memoryKey(base, quote), {
		...payload,
		fetchedAt: fetchedAt.toISOString(),
		expiresAt: expiresAt.toISOString(),
		stale: false,
	});

	try {
		await prisma.fxRate.upsert({
			where: { fx_base_quote: { base, quote } },
			update: payload,
			create: payload,
		});
	} catch {
		// DB failures should not break reads; memory cache still works for the current process.
	}

	return {
		base,
		quote,
		rate,
		source,
		fetchedAt: fetchedAt.toISOString(),
		expiresAt: expiresAt.toISOString(),
		stale: false,
		warning: null,
	};
}

async function fetchLiveRate(base, quote, staleToleranceMinutes) {
	const ctrl = new AbortController();
	const timeout = setTimeout(() => ctrl.abort(), HTTP_TIMEOUT_MS);
	try {
		const url = `https://api.frankfurter.app/latest?from=${encodeURIComponent(base)}&to=${encodeURIComponent(quote)}`;
		const response = await fetch(url, { signal: ctrl.signal });
		if (!response.ok) {
			throw new Error(`fx_http_${response.status}`);
		}
		const json = await response.json();
		const rate = Number(json?.rates?.[quote]);
		if (!Number.isFinite(rate) || rate <= 0) {
			throw new Error("fx_rate_invalid");
		}
		return persistRate(base, quote, rate, FX_SOURCE, staleToleranceMinutes);
	} finally {
		clearTimeout(timeout);
	}
}

export async function getRate(base, quote, options = {}) {
	const normalizedBase = toCurrency(base);
	const normalizedQuote = toCurrency(quote);
	if (normalizedBase === normalizedQuote) {
		return {
			base: normalizedBase,
			quote: normalizedQuote,
			rate: 1,
			source: "identity",
			fetchedAt: nowIso(),
			expiresAt: null,
			stale: false,
			fx_stale: false,
			warning: null,
		};
	}

	const cfg = await getCurrencyConfig();
	const staleToleranceMinutes = Math.max(
		1,
		Number(
			options.staleToleranceMinutes || cfg.staleToleranceMinutes || DEFAULT_STALE_TOLERANCE_MINUTES,
		),
	);

	const cached = await readCachedRate(normalizedBase, normalizedQuote);
	if (cached && !cached.stale) {
		return { ...cached, fx_stale: false, warning: null };
	}

	try {
		return await fetchLiveRate(normalizedBase, normalizedQuote, staleToleranceMinutes);
	} catch {
		if (cached) {
			return {
				...cached,
				stale: true,
				fx_stale: true,
				warning: {
					code: "fx_provider_unavailable_stale_rate",
					message: "Live FX provider unavailable; using last known valid rate.",
					source: cached.source || "cached",
					fetchedAt: cached.fetchedAt || null,
					expiresAt: cached.expiresAt || null,
				},
			};
		}
		return null;
	}
}

export async function normalizeMoney(amount, from, toBase) {
	const value = parseNumberish(amount);
	if (!Number.isFinite(value)) {
		return {
			amount: null,
			rate: null,
			currency_from: toCurrency(from),
			currency_base: toCurrency(toBase),
			fx_stale: false,
			warning: null,
		};
	}

	const fromCurrency = toCurrency(from);
	const baseCurrency = toCurrency(toBase);
	if (fromCurrency === baseCurrency) {
		return {
			amount: Math.round(value * 10_000) / 10_000,
			rate: 1,
			currency_from: fromCurrency,
			currency_base: baseCurrency,
			fx_stale: false,
			warning: null,
		};
	}

	const rateEntry = await getRate(baseCurrency, fromCurrency);
	if (!(rateEntry && Number.isFinite(Number(rateEntry.rate))) || Number(rateEntry.rate) <= 0) {
		return {
			amount: null,
			rate: null,
			currency_from: fromCurrency,
			currency_base: baseCurrency,
			fx_stale: true,
			warning: {
				code: "fx_rate_unavailable",
				message: "FX rate unavailable and no valid cached fallback exists.",
			},
		};
	}

	const converted = value / Number(rateEntry.rate);
	return {
		amount: Math.round(converted * 10_000) / 10_000,
		rate: Number(rateEntry.rate),
		currency_from: fromCurrency,
		currency_base: baseCurrency,
		fx_stale: Boolean(rateEntry.fx_stale || rateEntry.stale),
		warning: rateEntry.warning || null,
	};
}

export async function normalizePriceRange({ min, max, currency, baseCurrency } = {}) {
	const minConv = await normalizeMoney(min, currency, baseCurrency);
	const maxConv = await normalizeMoney(max, currency, baseCurrency);

	return {
		priceOriginalMin: Number.isFinite(min) ? Number(min) : null,
		priceOriginalMax: Number.isFinite(max) ? Number(max) : null,
		priceBaseMin: minConv.amount,
		priceBaseMax: maxConv.amount,
		fx_stale: Boolean(minConv.fx_stale || maxConv.fx_stale),
		warnings: [minConv.warning, maxConv.warning].filter(Boolean),
	};
}

export async function getBaseCurrency() {
	const cfg = await getCurrencyConfig();
	return toCurrency(cfg.baseCurrency, DEFAULT_BASE);
}

export function extractOriginalPrice(payload = {}) {
	const currency = toCurrency(
		payload.currency || payload.currencyOriginal || payload.currency_original || DEFAULT_BASE,
	);

	const directMin = parseNumberish(
		payload.priceOriginalMin ?? payload.price_min ?? payload.priceMin,
	);
	const directMax = parseNumberish(
		payload.priceOriginalMax ?? payload.price_max ?? payload.priceMax,
	);
	if (Number.isFinite(directMin) || Number.isFinite(directMax)) {
		const min = Number.isFinite(directMin) ? directMin : directMax;
		const max = Number.isFinite(directMax) ? directMax : directMin;
		return {
			priceOriginalMin: Number.isFinite(min) ? min : null,
			priceOriginalMax: Number.isFinite(max) ? max : null,
			currency,
		};
	}

	const directSingle = parseNumberish(payload.priceOriginal ?? payload.price);
	if (Number.isFinite(directSingle)) {
		return {
			priceOriginalMin: directSingle,
			priceOriginalMax: directSingle,
			currency,
		};
	}

	const parsed = parseRangeAmounts(
		payload.price_range || payload.priceRange || payload.target_price || payload.target_fob_price,
	);
	return {
		priceOriginalMin: Number.isFinite(parsed.min) ? parsed.min : null,
		priceOriginalMax: Number.isFinite(parsed.max)
			? parsed.max
			: Number.isFinite(parsed.min)
				? parsed.min
				: null,
		currency,
	};
}

export function getFxHealth() {
	return { ...fxHealth };
}

export async function refreshRates() {
	fxHealth = { ...fxHealth, last_refresh_started_at: nowIso() };
	try {
		const base = await getBaseCurrency();
		const [products, requirements] = await Promise.all([
			prisma.product.findMany(),
			prisma.requirement.findMany(),
		]);

		const currencies = new Set([base]);
		[
			...(Array.isArray(products) ? products : []),
			...(Array.isArray(requirements) ? requirements : []),
		].forEach((row) => {
			const code = toCurrency(
				row?.currency || row?.currencyOriginal || row?.currency_original || "",
			);
			if (code) {
				currencies.add(code);
			}
		});

		const targets = [...currencies].filter((code) => code && code !== base);
		const refreshed = [];
		let fx_stale = false;

		for (const quote of targets) {
			const entry = await getRate(base, quote);
			if (!entry) {
				fx_stale = true;
				continue;
			}
			if (entry.fx_stale || entry.stale) {
				fx_stale = true;
			}
			refreshed.push({
				quote,
				rate: entry.rate,
				stale: Boolean(entry.fx_stale || entry.stale),
			});
		}

		const result = {
			base,
			refreshed_count: refreshed.length,
			refreshed,
			fx_stale,
		};
		fxHealth = {
			...fxHealth,
			last_refresh_completed_at: nowIso(),
			last_refresh_ok_at: nowIso(),
			last_refresh_result: result,
			last_refresh_error: fx_stale ? "partial_stale_rates" : "",
			...(fx_stale ? { last_refresh_error_at: nowIso() } : {}),
		};
		return result;
	} catch (error) {
		fxHealth = {
			...fxHealth,
			last_refresh_completed_at: nowIso(),
			last_refresh_error_at: nowIso(),
			last_refresh_error: error?.message || "fx_refresh_failed",
		};
		throw error;
	}
}
