// Boost price is computed, never taken from the client: the configured base
// price covers BOOST_BASE_DURATION_DAYS and longer boosts are pro-rated.
export const BOOST_DURATION_OPTIONS = [7, 14, 30];
export const BOOST_BASE_PRICE_USD = 9.99;
export const BOOST_BASE_DURATION_DAYS = 7;

export function normalizeBoostDuration(days) {
	const value = Number(days);
	return BOOST_DURATION_OPTIONS.includes(value) ? value : BOOST_BASE_DURATION_DAYS;
}

export function boostPriceUsd(days, basePriceUsd = BOOST_BASE_PRICE_USD) {
	const duration = normalizeBoostDuration(days);
	return Math.round(basePriceUsd * (duration / BOOST_BASE_DURATION_DAYS) * 100) / 100;
}
