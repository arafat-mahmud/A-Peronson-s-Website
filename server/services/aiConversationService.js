import prisma from "../utils/prisma.js";
import { sanitizeString } from "../utils/validators.js";
import { assistantReply } from "./assistantService.js";
import { addLeadNoteForMatch } from "./leadService.js";
import { getRequirementById } from "./requirementService.js";

const SUMMARY_PREFIX = "AI Summary:";
const NEGOTIATION_PREFIX = "AI Negotiation:";

function parseMarketplaceMatchId(matchId = "") {
	const parts = String(matchId || "").split(":");
	if (parts.length !== 2) {
		return null;
	}
	const requirementId = sanitizeString(parts[0], 120);
	const supplierId = sanitizeString(parts[1], 120);
	if (!(requirementId && supplierId)) {
		return null;
	}
	return { requirementId, supplierId };
}

function resolveOrgOwnerIdForUser(user) {
	if (!user) {
		return "";
	}
	if (String(user.role || "").toLowerCase() === "agent") {
		return sanitizeString(String(user.org_owner_id || ""), 120);
	}
	return sanitizeString(String(user.id || ""), 120);
}

function normalizeMessageLine(message, usersById) {
	const sender = usersById.get(String(message.sender_id || ""));
	const name = sanitizeString(sender?.name || sender?.email || "User", 80);
	const role = sanitizeString(sender?.role || "", 40);
	const body = sanitizeString(message.message || "", 400);
	return `${name}${role ? ` (${role})` : ""}: ${body}`;
}

function pickRecentMessages(messages = [], limit = 18) {
	const sorted = [...messages].sort(
		(a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0),
	);
	return sorted.slice(-limit);
}

function buildRequirementContext(requirement) {
	if (!requirement) {
		return "";
	}
	const lines = [];
	if (requirement.title) {
		lines.push(`Title: ${requirement.title}`);
	}
	if (requirement.request_type) {
		lines.push(`Type: ${requirement.request_type}`);
	}
	if (requirement.quantity) {
		lines.push(`Quantity: ${requirement.quantity}`);
	}
	if (requirement.moq) {
		lines.push(`MOQ: ${requirement.moq}`);
	}
	if (requirement.price_range) {
		lines.push(`Target price: ${requirement.price_range}`);
	}
	if (requirement.timeline_days || requirement.delivery_timeline) {
		lines.push(`Timeline: ${requirement.timeline_days || requirement.delivery_timeline}`);
	}
	if (requirement.material) {
		lines.push(`Material: ${requirement.material}`);
	}
	if (requirement.color_pantone) {
		lines.push(`Colors: ${requirement.color_pantone}`);
	}
	return lines.join(" | ");
}

function fallbackSummary(messages, requirement) {
	const recent = pickRecentMessages(messages, 5);
	const last = recent.at(-1);
	const lastLine = last ? sanitizeString(last.message || "", 220) : "";
	const requirementLine = buildRequirementContext(requirement);

	const bullets = [
		requirementLine ? `Buyer request: ${requirementLine}` : "Buyer request: details in chat.",
		`Recent message count: ${messages.length}. Latest note: ${lastLine || "No recent message."}`,
		"Next step: confirm pricing, MOQ, and delivery timeline before contract.",
	];

	return bullets.map((b) => `- ${b}`).join("\n");
}

async function generateAiText(prompt) {
	const response = await assistantReply("public_ws", prompt, null);
	const text = sanitizeString(response?.matched_answer || response?.answer || "", 1200);
	return text || "";
}

function extractSection(text, label) {
	const safeLabel = String(label || "").replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&");
	const pattern = new RegExp(`${safeLabel}\\s*:\\s*([\\s\\S]*?)(?=\\n[A-Za-z\\s]+\\s*:|$)`, "i");
	const match = String(text || "").match(pattern);
	return match ? sanitizeString(match[1].trim(), 600) : "";
}

export async function generateConversationSummary(matchId) {
	const safeMatchId = sanitizeString(String(matchId || ""), 180);
	if (!safeMatchId) {
		return null;
	}

	const [messages, users] = await Promise.all([prisma.message.findMany(), prisma.user.findMany()]);

	const threadMessages = messages.filter(
		(m) => String(m.match_id || "") === safeMatchId && String(m.message || "").trim(),
	);

	if (threadMessages.length === 0) {
		return null;
	}

	const usersById = new Map(users.map((u) => [String(u.id), u]));
	const marketplace = parseMarketplaceMatchId(safeMatchId);
	const requirement = marketplace ? await getRequirementById(marketplace.requirementId) : null;
	const summaryContext = buildRequirementContext(requirement);
	const lines = pickRecentMessages(threadMessages).map((msg) =>
		normalizeMessageLine(msg, usersById),
	);

	const prompt = [
		"Summarize this B2B buyer-supplier chat in 3 bullet points.",
		"Include current negotiation status, missing info, and a recommended next step.",
		summaryContext ? `Buyer request: ${summaryContext}` : "",
		"Conversation:",
		lines.join("\n"),
		"Return format:",
		"Summary: <short paragraph>\n",
		"Next steps: <bullets>\n",
		"Suggested reply: <1-2 sentences>",
	]
		.filter(Boolean)
		.join("\n");

	const aiText = await generateAiText(prompt);
	if (!aiText) {
		return {
			summary: fallbackSummary(threadMessages, requirement),
			suggested_reply: "",
			raw: "",
		};
	}

	const summary = extractSection(aiText, "Summary") || aiText;
	const nextSteps = extractSection(aiText, "Next steps");
	const suggestedReply = extractSection(aiText, "Suggested reply");

	const formatted = [summary ? `- ${summary}` : "", nextSteps ? `- Next steps: ${nextSteps}` : ""]
		.filter(Boolean)
		.join("\n");

	return {
		summary: formatted || aiText,
		suggested_reply: suggestedReply,
		raw: aiText,
	};
}

function pickLatestNote(notes = [], prefix = "") {
	const candidates = notes
		.filter((note) => String(note.note || "").startsWith(prefix))
		.sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
	return candidates[0] || null;
}

async function shouldAutoSummarize(matchId, orgOwnerId) {
	const lead = await prisma.lead.findFirst({
		where: {
			match_id: String(matchId || ""),
			org_owner_id: String(orgOwnerId || ""),
		},
	});

	if (!lead) {
		return false;
	}

	const notes = await prisma.leadNote.findMany({
		where: { lead_id: lead.id },
	});

	const latest = pickLatestNote(notes, SUMMARY_PREFIX);

	if (!latest) {
		return true;
	}

	const lastSummaryAt = new Date(latest.created_at || 0).getTime();
	if (!Number.isFinite(lastSummaryAt)) {
		return true;
	}

	const messages = await prisma.message.findMany();
	const threadMessages = messages.filter((m) => String(m.match_id || "") === String(matchId || ""));

	const sinceSummary = threadMessages.filter(
		(m) => new Date(m.timestamp || 0).getTime() > lastSummaryAt,
	);
	if (sinceSummary.length >= 6) {
		return true;
	}

	const hoursSince = (Date.now() - lastSummaryAt) / (1000 * 60 * 60);
	return hoursSince >= 24;
}

export async function autoSummarizeMatch({ matchId, orgOwnerId }) {
	const safeMatchId = sanitizeString(String(matchId || ""), 180);
	const safeOrgId = sanitizeString(String(orgOwnerId || ""), 120);
	if (!(safeMatchId && safeOrgId)) {
		return null;
	}

	const shouldRun = await shouldAutoSummarize(safeMatchId, safeOrgId);
	if (!shouldRun) {
		return null;
	}

	const summary = await generateConversationSummary(safeMatchId);
	if (!summary?.summary) {
		return null;
	}

	const note = `${SUMMARY_PREFIX} ${summary.summary}${summary.suggested_reply ? `\nSuggested reply: ${summary.suggested_reply}` : ""}`;
	await addLeadNoteForMatch({
		matchId: safeMatchId,
		orgOwnerId: safeOrgId,
		note,
		authorId: "system",
	});
	return summary;
}

export async function generateNegotiationHelper(matchId) {
	const safeMatchId = sanitizeString(String(matchId || ""), 180);
	if (!safeMatchId) {
		return null;
	}

	const [messages, users] = await Promise.all([prisma.message.findMany(), prisma.user.findMany()]);

	const threadMessages = messages.filter(
		(m) => String(m.match_id || "") === safeMatchId && String(m.message || "").trim(),
	);

	if (threadMessages.length === 0) {
		return null;
	}

	const usersById = new Map(users.map((u) => [String(u.id), u]));
	const marketplace = parseMarketplaceMatchId(safeMatchId);
	const requirement = marketplace ? await getRequirementById(marketplace.requirementId) : null;
	const summaryContext = buildRequirementContext(requirement);
	const lines = pickRecentMessages(threadMessages, 12).map((msg) =>
		normalizeMessageLine(msg, usersById),
	);

	const prompt = [
		"You are a negotiation assistant for B2B textile sourcing.",
		"Give negotiation guidance based on the chat. Provide: Key risks, Missing info, Suggested reply.",
		summaryContext ? `Buyer request: ${summaryContext}` : "",
		"Conversation:",
		lines.join("\n"),
		"Return format:",
		"Key risks: <bullets>\n",
		"Missing info: <bullets>\n",
		"Suggested reply: <1-2 sentences>\n",
		"Strategy note: <short paragraph>",
	]
		.filter(Boolean)
		.join("\n");

	const aiText = await generateAiText(prompt);
	if (!aiText) {
		return {
			guidance:
				"Focus on MOQ, pricing, and delivery timeline. Confirm materials and compliance needs before final quote.",
			suggested_reply:
				"Thanks for the details. Could you confirm MOQ, target price range, and delivery timeline so we can quote accurately?",
			raw: "",
		};
	}

	const risks = extractSection(aiText, "Key risks");
	const missing = extractSection(aiText, "Missing info");
	const reply = extractSection(aiText, "Suggested reply");
	const strategy = extractSection(aiText, "Strategy note");

	const guidance = [
		risks ? `Key risks: ${risks}` : "",
		missing ? `Missing info: ${missing}` : "",
		strategy ? `Strategy: ${strategy}` : "",
	]
		.filter(Boolean)
		.join("\n");

	return {
		guidance: guidance || aiText,
		suggested_reply: reply,
		raw: aiText,
	};
}

export async function recordNegotiationNote({ matchId, orgOwnerId, helper }) {
	const safeMatchId = sanitizeString(String(matchId || ""), 180);
	const safeOrgId = sanitizeString(String(orgOwnerId || ""), 120);
	if (!(safeMatchId && safeOrgId && helper?.guidance)) {
		return null;
	}

	const note = `${NEGOTIATION_PREFIX} ${helper.guidance}${helper.suggested_reply ? `\nSuggested reply: ${helper.suggested_reply}` : ""}`;
	await addLeadNoteForMatch({
		matchId: safeMatchId,
		orgOwnerId: safeOrgId,
		note,
		authorId: "system",
	});
	return note;
}

export async function recordSummaryNote({ matchId, orgOwnerId, summary }) {
	const safeMatchId = sanitizeString(String(matchId || ""), 180);
	const safeOrgId = sanitizeString(String(orgOwnerId || ""), 120);
	if (!(safeMatchId && safeOrgId && summary?.summary)) {
		return null;
	}

	const note = `${SUMMARY_PREFIX} ${summary.summary}${summary.suggested_reply ? `\\nSuggested reply: ${summary.suggested_reply}` : ""}`;
	await addLeadNoteForMatch({
		matchId: safeMatchId,
		orgOwnerId: safeOrgId,
		note,
		authorId: "system",
	});
	return note;
}

export async function resolveOrgOwnerFromMatch(matchId, senderId) {
	const users = await prisma.user.findMany();
	const usersById = new Map(users.map((u) => [String(u.id), u]));
	if (senderId) {
		const sender = usersById.get(String(senderId));
		const orgOwnerId = resolveOrgOwnerIdForUser(sender);
		if (orgOwnerId) {
			return orgOwnerId;
		}
	}

	const marketplace = parseMarketplaceMatchId(matchId);
	if (marketplace) {
		const supplierUser = usersById.get(String(marketplace.supplierId));
		const orgOwnerId = resolveOrgOwnerIdForUser(supplierUser);
		if (orgOwnerId) {
			return orgOwnerId;
		}
	}

	return "";
}

export function pickLatestAiSummary(notes = []) {
	return pickLatestNote(notes, SUMMARY_PREFIX);
}

export function pickLatestNegotiationNote(notes = []) {
	return pickLatestNote(notes, NEGOTIATION_PREFIX);
}
