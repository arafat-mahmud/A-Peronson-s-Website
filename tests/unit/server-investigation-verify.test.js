import {
	applyVerification,
	buildVerifyPrompt,
} from "../../server/services/investigation/agents.js";

const CANDIDATES = [
	{ confidence: "confirmed", detail: "bug A", evidence: [{ file: "a.js" }] },
	{ confidence: "probable", detail: "bug B", evidence: [{ file: "b.js" }] },
];

describe("investigation verification (server/services/investigation/agents.js)", () => {
	test("the verify prompt includes every candidate finding", () => {
		const prompt = buildVerifyPrompt({
			description: "the feed is empty",
			candidateFindings: [
				{ confidence: "confirmed", detail: "bug A", evidence: [{ file: "a.js" }] },
				{ confidence: "probable", detail: "bug B", evidence: [] },
			],
		});
		expect(prompt).toContain("the feed is empty");
		expect(prompt).toContain("bug A");
		expect(prompt).toContain("bug B");
		expect(prompt).toMatch(/refut/i);
	});

	test("a refuted finding is downgraded to speculative", () => {
		const result = applyVerification(CANDIDATES, { refuted: ["bug A"], unsupported: [] });
		expect(result.findings[0].confidence).toBe("speculative");
		expect(result.findings[1].confidence).toBe("probable");
		expect(result.refuted).toEqual(["bug A"]);
	});

	test("an unevidenced finding never stays confirmed", () => {
		const result = applyVerification([{ confidence: "confirmed", detail: "bug C", evidence: [] }], {
			refuted: [],
			unsupported: [],
		});
		expect(result.findings[0].confidence).toBe("speculative");
	});

	test("an unevidenced finding is demoted even when the verifier endorsed it", () => {
		const result = applyVerification([{ confidence: "confirmed", detail: "bug C", evidence: [] }], {
			refuted: [],
			unsupported: [],
		});
		expect(result.findings[0].confidence).toBe("speculative");
		expect(result.refuted).toEqual([]);
	});

	test("a candidate the verifier could not refute keeps its confidence", () => {
		const result = applyVerification(CANDIDATES, { refuted: [], unsupported: [] });
		expect(result.findings[0].confidence).toBe("confirmed");
		expect(result.findings[1].confidence).toBe("probable");
		expect(result.refuted).toEqual([]);
	});

	test("`unsupported` is accepted but does not by itself demote", () => {
		// The brief defines exactly two demotions: a refuted finding, and a
		// finding with no evidence. An `unsupported` list is part of the
		// verification shape, but the contract does not give it a demotion of
		// its own, so it must not silently change a confidence.
		const result = applyVerification(CANDIDATES, { refuted: [], unsupported: ["bug B"] });
		expect(result.findings[1].confidence).toBe("probable");
		expect(result.refuted).toEqual([]);
	});

	test("the result carries exactly the finding shape, with an evidence array always", () => {
		const result = applyVerification(
			[{ confidence: "CONFIRMED", detail: "bug A", evidence: [{ file: "a.js" }] }],
			{ refuted: [], unsupported: [] },
		);
		expect(Object.keys(result).sort()).toEqual(["findings", "refuted"]);
		expect(Object.keys(result.findings[0]).sort()).toEqual(["confidence", "detail", "evidence"]);
		expect(Array.isArray(result.findings[0].evidence)).toBe(true);
	});

	test("an unknown confidence is coerced to speculative", () => {
		const result = applyVerification(
			[
				{ confidence: "CONFIRMED", detail: "bug A", evidence: [{ file: "a.js" }] },
				{ confidence: "nonsense", detail: "bug B", evidence: [{ file: "b.js" }] },
				{ detail: "bug C", evidence: [{ file: "c.js" }] },
			],
			{ refuted: [], unsupported: [] },
		);
		expect(result.findings[0].confidence).toBe("confirmed");
		expect(result.findings[1].confidence).toBe("speculative");
		expect(result.findings[2].confidence).toBe("speculative");
	});

	test("a malformed verification or candidate list does not throw", () => {
		expect(() => applyVerification(null, null)).not.toThrow();
		expect(() => applyVerification(undefined, undefined)).not.toThrow();
		expect(() => applyVerification(CANDIDATES, { refuted: "bug A" })).not.toThrow();

		const empty = applyVerification(null, null);
		expect(empty.findings).toEqual([]);
		expect(empty.refuted).toEqual([]);
	});

	test("the candidate findings are not mutated", () => {
		const candidates = [{ confidence: "confirmed", detail: "bug A", evidence: [{ file: "a.js" }] }];
		const snapshot = JSON.stringify(candidates);
		applyVerification(candidates, { refuted: ["bug A"], unsupported: [] });
		expect(JSON.stringify(candidates)).toBe(snapshot);
	});
});
