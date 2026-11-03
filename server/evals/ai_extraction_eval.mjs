import fs from "node:fs";
import path from "node:path";
import { extractRequirementFromText } from "../services/aiOrchestrationService.js";

const examplesPath = path.join(process.cwd(), "server", "evals", "examples.json");
let examples = [];
try {
	examples = JSON.parse(fs.readFileSync(examplesPath, "utf8"));
} catch {
	examples = [];
}

function scoreField(pred, gold) {
	if (gold === null || gold === undefined || gold === "") {
		return null;
	}
	if (pred === null || pred === undefined || pred === "") {
		return 0;
	}
	if (typeof gold === "number" || typeof pred === "number") {
		return Number(pred) === Number(gold) ? 1 : 0;
	}
	if (Array.isArray(gold)) {
		const set = new Set((pred || []).map(String));
		const hit = gold.filter((g) => set.has(String(g)));
		return hit.length / Math.max(1, gold.length);
	}
	return String(pred).toLowerCase().trim() === String(gold).toLowerCase().trim() ? 1 : 0;
}

async function run() {
	if (examples.length === 0) {
		process.exit(1);
	}
	const fieldNames = [
		"product_type",
		"category",
		"moq",
		"target_price",
		"timeline",
		"incoterm",
		"certifications",
	];
	const totals = {};
	const hits = {};
	fieldNames.forEach((f) => {
		totals[f] = 0;
		hits[f] = 0;
	});

	for (const ex of examples) {
		const text = ex.text || "";
		const gold = ex.fields || {};
		const res = await extractRequirementFromText(text);
		const pred = res.extracted || {};
		fieldNames.forEach((f) => {
			if (gold[f] !== undefined && gold[f] !== null && gold[f] !== "") {
				totals[f] += 1;
				hits[f] += scoreField(pred[f], gold[f]);
			}
		});
	}

	const results = {};
	fieldNames.forEach((f) => {
		results[f] = {
			examples: totals[f],
			precision_recall_score: totals[f] ? hits[f] / totals[f] : null,
		};
	});
}

run().catch((_e) => {
	process.exit(2);
});
