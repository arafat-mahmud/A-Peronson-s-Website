import { assistantReply } from "../services/assistantService.js";
import { getIndustrySummary } from "../services/industryService.js";
import { sanitizeString } from "../utils/validators.js";

export async function getIndustryPage(req, res) {
	const summary = await getIndustrySummary(req.params.slug);
	if (!summary) {
		return res.status(404).json({ error: "Industry not found" });
	}
	return res.json(summary);
}

export async function getIndustryAutoReply(req, res) {
	const summary = await getIndustrySummary(req.params.slug);
	if (!summary) {
		return res.status(404).json({ error: "Industry not found" });
	}

	const stats = summary.stats || {};
	const topProducts = (summary.top_products || [])
		.slice(0, 3)
		.map((p) => `${p.title}${p.moq ? ` (MOQ ${p.moq})` : ""}`)
		.join(", ");

	const prompt = [
		`Create a short auto-reply for a buyer exploring the "${summary.category}" industry page.`,
		"Keep it friendly and professional, 2-4 sentences.",
		`Stats: average MOQ ${stats.average_moq ?? "n/a"}, average lead time ${stats.average_lead_time_days ?? "n/a"} days.`,
		stats.top_countries?.length > 0
			? `Top buyer regions: ${stats.top_countries.map((c) => c.country).join(", ")}.`
			: "",
		topProducts ? `Popular products: ${topProducts}.` : "",
		"Invite the buyer to share missing requirements (MOQ, price range, lead time).",
	]
		.filter(Boolean)
		.join("\n");

	const response = await assistantReply("public_industry", prompt, null);
	const reply = sanitizeString(response?.matched_answer || response?.answer || "", 700);

	return res.json({
		ok: true,
		reply:
			reply ||
			`Thanks for exploring ${summary.category}. Share your MOQ, target price range, and lead time so we can match you quickly.`,
		stats,
	});
}
