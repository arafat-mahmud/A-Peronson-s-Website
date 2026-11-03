import { callLlama } from "./assistantService.js";

export async function verifyExtraction(extracted = {}) {
	const canUseLlama = typeof fetch === "function";

	// Use Llama for intelligent verification if no remote verifier is configured
	if (canUseLlama) {
		try {
			const systemPrompt = `You are an AI verification assistant. Compare the provided extracted requirements (JSON) against the user's original intent.
Check for:
1. Accuracy: Do the extracted fields match the text?
2. Hallucinations: Did the AI make up any details not in the text?
Return a JSON object with: {"verified": boolean, "score": number (0-1), "notes": string}.`;

			const prompt = `Original Notes: ${extracted.notes || "No notes provided."}\nExtracted Data: ${JSON.stringify(extracted)}`;

			const response = await callLlama(prompt, systemPrompt);
			const match = response?.match(/\{[\s\S]*\}/);
			if (match) {
				const parsed = JSON.parse(match[0]);
				return {
					verified: Boolean(parsed.verified),
					score: Number(parsed.score || 0),
					notes: String(parsed.notes || "verified_by_llama"),
				};
			}
		} catch {
			if (process.env.NODE_ENV !== "test") {
			}
		}
	}

	// Fallback simple rule if Llama fails
	try {
		const verified = Boolean(extracted?.product_type);
		const score = verified ? 1 : 0;
		return {
			verified,
			score,
			notes: verified ? "Fallback: product_type present" : "Fallback: Missing product_type",
		};
	} catch {
		return { verified: false, score: 0, notes: "verifier_error" };
	}
}

export default { verifyExtraction };
