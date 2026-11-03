export function detectHallucination(extracted) {
	// Lightweight heuristics:
	// - If numeric fields contain impossible ranges, mark low confidence
	// - If extracted object is empty, flag as hallucination
	if (!extracted || typeof extracted !== "object") {
		return { hallucination: true, score: 1.0 };
	}

	const keys = Object.keys(extracted);
	if (keys.length === 0) {
		return { hallucination: true, score: 1.0 };
	}

	let score = 0.0;
	// penalty for missing core fields
	const core = ["product_type"];
	for (const k of core) {
		if (!extracted[k]) {
			score += 0.5;
		}
	}

	// numeric sanity checks for moq and target_price
	if (extracted.moq) {
		const moq =
			typeof extracted.moq === "string"
				? Number.parseInt(extracted.moq.replace(/[^0-9]/g, ""), 10)
				: Number(extracted.moq);
		if (!Number.isNaN(moq) && moq > 1_000_000) {
			score += 0.3;
		}
	}
	if (extracted.target_price) {
		const p = Number(extracted.target_price);
		if (!Number.isNaN(p) && p > 1_000_000) {
			score += 0.3;
		}
	}

	// clamp
	if (score > 1) {
		score = 1;
	}

	return { hallucination: score >= 0.7, score };
}

export default { detectHallucination };
