import crypto from "node:crypto";
import prisma from "../utils/prisma.js";
import { sanitizeString } from "../utils/validators.js";
import { callLlama, listKnowledge } from "./assistantService.js";
import { addLeadNoteForMatch } from "./leadService.js";
import { createNotification } from "./notificationService.js";
import { getRequirementById, updateRequirement } from "./requirementService.js";

const QUALIFICATION_FIELDS = [
	{
		key: "quantity",
		label: "quantity",
		question: "What total quantity are you targeting?",
	},
	{
		key: "moq",
		label: "MOQ",
		question: "What MOQ per color/style do you need?",
	},
	{
		key: "price_range",
		label: "price range",
		question: "What target price range per unit should we plan for?",
	},
	{
		key: "material",
		label: "fabric/material",
		question: "Which fabric or material do you prefer?",
	},
	{
		key: "delivery_timeline",
		label: "lead time",
		question: "What delivery timeline or lead time do you need?",
	},
	{
		key: "size_range",
		label: "size range",
		question: "What size range should we support?",
	},
	{
		key: "color_pantone",
		label: "colors/Pantone",
		question: "Any target colors or Pantone references?",
	},
	{
		key: "customization_capabilities",
		label: "customization",
		question: "Do you need customization or tech pack acceptance?",
	},
];

function parseMarketplaceMatchId(matchId = "") {
	const parts = String(matchId || "").split(":");
	if (parts.length !== 2) {
		return null;
	}
	const requirementId = sanitizeString(parts[0], 120);
	const factoryId = sanitizeString(parts[1], 120);
	if (!(requirementId && factoryId)) {
		return null;
	}
	return { requirementId, factoryId };
}

function normalizeList(value) {
	if (!value) {
		return [];
	}
	if (Array.isArray(value)) {
		return value.map((v) => String(v || "").trim()).filter(Boolean);
	}
	return String(value || "")
		.split(",")
		.map((v) => v.trim())
		.filter(Boolean);
}

function buildCompanyFacts(user) {
	const profile = user?.profile || {};
	const certifications = normalizeList(
		profile.certifications || profile.certification || profile.certs,
	);
	const categories = normalizeList(profile.categories || profile.category || profile.tags);
	const capacity = sanitizeString(profile.capacity || profile.monthly_capacity || "", 120);
	const moq = sanitizeString(profile.moq || profile.minimum_order || "", 120);
	const leadTime = sanitizeString(profile.lead_time_days || profile.lead_time || "", 120);
	const country = sanitizeString(profile.country || "", 80);

	return {
		certifications,
		categories,
		capacity,
		moq,
		leadTime,
		country,
	};
}

function scoreKnowledgeMatch(questionText, entry) {
	const q = String(questionText || "").toLowerCase();
	const question = String(entry?.question || "").toLowerCase();
	const keywords = Array.isArray(entry?.keywords) ? entry.keywords : [];
	let score = 0;
	if (question && (q.includes(question) || question.includes(q))) {
		score += 3;
	}
	for (const keyword of keywords) {
		if (keyword && q.includes(String(keyword).toLowerCase())) {
			score += 1;
		}
	}
	return score;
}

function findKnowledgeAnswer(questionText, entries = []) {
	let best = null;
	let bestScore = 0;
	for (const entry of entries) {
		const score = scoreKnowledgeMatch(questionText, entry);
		if (score > bestScore) {
			best = entry;
			bestScore = score;
		}
	}
	if (!best || bestScore <= 0) {
		return null;
	}
	return { answer: best.answer, entry: best, score: bestScore };
}

function extractNumberFromText(text, pattern) {
	if (!text) {
		return null;
	}
	const match = text.match(pattern);
	if (!match) {
		return null;
	}
	const raw = String(match[1] || "").replace(/,/g, "");
	const value = Number(raw);
	return Number.isFinite(value) ? value : null;
}

function extractRangeFromText(text, pattern) {
	if (!text) {
		return null;
	}
	const match = text.match(pattern);
	if (!match) {
		return null;
	}
	const min = String(match[1] || "").replace(/,/g, "");
	const max = String(match[2] || "").replace(/,/g, "");
	const minVal = Number(min);
	const maxVal = Number(max);
	if (!Number.isFinite(minVal)) {
		return null;
	}
	if (!Number.isFinite(maxVal)) {
		return `${minVal}`;
	}
	return `${minVal}-${maxVal}`;
}

function computeMissingFields(requirement) {
	if (!requirement) {
		return [];
	}
	return QUALIFICATION_FIELDS.filter((field) => {
		const value = requirement[field.key];
		if (typeof value === "boolean") {
			return false;
		}
		return !String(value || "").trim();
	});
}

function buildQualificationQuestion(missing) {
	if (missing.length === 0) {
		return "";
	}
	const toAsk = missing.slice(0, 2).map((field) => field.question);
	if (toAsk.length === 1) {
		return toAsk[0];
	}
	return `${toAsk[0]} Also, ${toAsk[1].toLowerCase()}`;
}

function extractRequirementPatch(message, requirement) {
	const text = String(message || "");
	const lower = text.toLowerCase();
	const patch = {};
	const notes = [];

	if (!requirement?.moq) {
		const moqVal =
			extractNumberFromText(lower, /\bmoq\b[^\d]{0,10}(\d[\d,]*)/i) ??
			extractNumberFromText(lower, /\bminimum order\b[^\d]{0,10}(\d[\d,]*)/i);
		if (moqVal) {
			patch.moq = String(moqVal);
			notes.push(`MOQ: ${moqVal}`);
		}
	}

	if (!requirement?.quantity) {
		const qtyVal = extractNumberFromText(
			lower,
			/\b(qty|quantity|pcs|pieces)\b[^\d]{0,10}(\d[\d,]*)/i,
		);
		if (qtyVal) {
			patch.quantity = String(qtyVal);
			notes.push(`Quantity: ${qtyVal}`);
		}
	}

	if (!requirement?.price_range) {
		const range = extractRangeFromText(
			text,
			/\$?\s?(\d+(?:\.\d+)?)\s*(?:-|to)\s*\$?\s?(\d+(?:\.\d+)?)/i,
		);
		if (range) {
			patch.price_range = range;
			notes.push(`Price range: ${range}`);
		} else {
			const single = extractNumberFromText(text, /\bprice\b[^\d]{0,10}(\d+(?:\.\d+)?)/i);
			if (single) {
				patch.price_range = `${single}`;
				notes.push(`Price: ${single}`);
			}
		}
	}

	if (!(requirement?.delivery_timeline || requirement?.timeline_days)) {
		const lead = extractNumberFromText(
			lower,
			/\b(lead time|leadtime|delivery|timeline)\b[^\d]{0,10}(\d{1,3})/i,
		);
		if (lead) {
			patch.timeline_days = String(lead);
			notes.push(`Lead time: ${lead} days`);
		}
	}

	if (!requirement?.size_range) {
		const sizeMatch = text.match(/\b(XXS|XS|S|M|L|XL|XXL)\s*(?:-|to)\s*(XXS|XS|S|M|L|XL|XXL)\b/i);
		if (sizeMatch) {
			const sizeRange = `${sizeMatch[1].toUpperCase()}-${sizeMatch[2].toUpperCase()}`;
			patch.size_range = sizeRange;
			notes.push(`Size range: ${sizeRange}`);
		}
	}

	if (!requirement?.color_pantone) {
		const pantone = text.match(/pantone\s*([A-Za-z0-9-]+)/i);
		if (pantone) {
			patch.color_pantone = pantone[1];
			notes.push(`Pantone: ${pantone[1]}`);
		}
	}

	return { patch, notes };
}

function shouldAttemptBot({ requestState, messageCount }) {
	if (requestState?.status === "pending") {
		return true;
	}
	if (Number(messageCount || 0) <= 2) {
		return true;
	}
	return false;
}

async function findAssignedAgentForMatch(matchId, orgOwnerId) {
	const lead = await prisma.lead.findFirst({
		where: {
			match_id: String(matchId || ""),
			org_owner_id: String(orgOwnerId || ""),
		},
		select: { assigned_agent_id: true },
	});
	return lead?.assigned_agent_id ? String(lead.assigned_agent_id) : "";
}

function resolveOrgOwnerForCompany(companyUser) {
	const role = String(companyUser?.role || "").toLowerCase();
	if (role === "agent" && companyUser?.org_owner_id) {
		return String(companyUser.org_owner_id);
	}
	return String(companyUser?.id || "");
}

function sanitizeAutoReply(raw = {}) {
	const payload = raw && typeof raw === "object" ? raw : {};
	return {
		enabled: payload.enabled === undefined ? true : Boolean(payload.enabled),
		greeting: sanitizeString(payload.greeting || "", 240),
		signature: sanitizeString(payload.signature || "", 200),
		fallback: sanitizeString(payload.fallback || "", 400),
		tone: sanitizeString(payload.tone || "", 80),
		qualification_prompt: sanitizeString(payload.qualification_prompt || "", 240),
	};
}

export async function getChatbotSettings(userId) {
	const user = await prisma.user.findUnique({
		where: { id: String(userId || "") },
	});
	if (!user) {
		return null;
	}
	const autoReply = sanitizeAutoReply(user.profile?.auto_reply || {});
	return {
		user_id: user.id,
		chatbot_enabled: Boolean(user.chatbot_enabled || user?.profile?.chatbot_enabled),
		handoff_mode: String(user.handoff_mode || user?.profile?.handoff_mode || "notify_agent"),
		auto_reply: autoReply,
	};
}

export async function updateChatbotSettings(userId, payload = {}) {
	const user = await prisma.user.findUnique({
		where: { id: String(userId || "") },
	});
	if (!user) {
		return null;
	}

	const current = user;
	const autoReply = sanitizeAutoReply(
		payload.auto_reply || payload.autoReply || current.profile?.auto_reply || {},
	);
	const chatbotEnabled =
		payload.chatbot_enabled === undefined
			? Boolean(current.chatbot_enabled)
			: Boolean(payload.chatbot_enabled);
	const handoffMode =
		sanitizeString(
			payload.handoff_mode || payload.handoffMode || current.handoff_mode || "notify_agent",
			80,
		) || "notify_agent";

	const nextProfile = {
		...(current.profile || {}),
		chatbot_enabled: chatbotEnabled,
		handoff_mode: handoffMode,
		auto_reply: autoReply,
	};

	await prisma.user.update({
		where: { id: String(userId || "") },
		data: {
			chatbot_enabled: chatbotEnabled,
			handoff_mode: handoffMode,
			profile: nextProfile,
			updated_at: new Date(),
		},
	});

	return {
		user_id: userId,
		chatbot_enabled: chatbotEnabled,
		handoff_mode: handoffMode,
		auto_reply: autoReply,
	};
}

export async function getChatbotProfileSummary(targetUserId) {
	const user = await prisma.user.findUnique({
		where: { id: String(targetUserId || "") },
	});
	if (!user) {
		return null;
	}

	return {
		user_id: user.id,
		chatbot_enabled: Boolean(user.chatbot_enabled || user?.profile?.chatbot_enabled),
		handoff_mode: String(user.handoff_mode || user?.profile?.handoff_mode || "notify_agent"),
	};
}

async function generateGenerativeBotReply({
	question,
	companyUser,
	knowledgeAnswer,
	qualificationQuestion,
	companyFacts,
}) {
	const orgOwnerId = resolveOrgOwnerForCompany(companyUser);
	const entries = await listKnowledge(orgOwnerId);
	const knowledgeContext = entries
		.slice(0, 5)
		.map((e) => `Q: ${e.question}\nA: ${e.answer}`)
		.join("\n\n");

	const systemPrompt = `You are a professional AI assistant for ${companyUser.name || "a textile factory"}.
Your goal is to answer buyer inquiries naturally using the provided company facts and knowledge base.

Company Facts:
- MOQ: ${companyFacts.moq || "Contact for details"}
- Capacity: ${companyFacts.capacity || "Contact for details"}
- Lead Time: ${companyFacts.leadTime || "Contact for details"}
- Certifications: ${companyFacts.certifications.join(", ") || "Available upon request"}
- Country: ${companyFacts.country || "Global"}

Knowledge Context:
${knowledgeContext}

Rules:
1. Be concise, professional, and helpful.
2. Use the company facts accurately.
3. If you don't know the answer, politely ask for more details or suggest a human agent will follow up.
4. If a qualification question is provided, integrate it naturally into your response.`;

	let userPrompt = `User Question: ${question}`;
	if (knowledgeAnswer) {
		userPrompt += `\nMatched Knowledge: ${knowledgeAnswer.answer}`;
	}
	if (qualificationQuestion) {
		userPrompt += `\nRequirement Follow-up: ${qualificationQuestion}`;
	}

	const response = await callLlama(userPrompt, systemPrompt);
	return (
		response ||
		knowledgeAnswer?.answer ||
		qualificationQuestion ||
		"I will have an agent look into your request shortly."
	);
}

export async function maybeGenerateBotReply({ match_id, sender_id, message }) {
	const matchId = sanitizeString(String(match_id || ""), 160);
	const senderId = sanitizeString(String(sender_id || ""), 120);
	const question = sanitizeString(String(message || ""), 1200);
	if (!(matchId && senderId && question)) {
		return { reply: null, reason: "invalid_input" };
	}

	const users = await prisma.user.findMany();
	const usersById = new Map(users.map((u) => [String(u.id), u]));

	const marketplace = parseMarketplaceMatchId(matchId);
	if (!marketplace) {
		return { reply: null, reason: "unsupported_match" };
	}

	const companyUser = usersById.get(String(marketplace.factoryId)) || null;
	if (!companyUser) {
		return { reply: null, reason: "company_missing" };
	}

	if (String(companyUser.id || "") === String(senderId || "")) {
		return { reply: null, reason: "sender_is_company" };
	}

	const enabled = Boolean(companyUser.chatbot_enabled || companyUser?.profile?.chatbot_enabled);
	if (!enabled) {
		return { reply: null, reason: "disabled" };
	}

	const autoReplySettings = sanitizeAutoReply(companyUser?.profile?.auto_reply || {});
	if (autoReplySettings.enabled === false) {
		return { reply: null, reason: "auto_reply_disabled" };
	}

	const [messages, requests] = await Promise.all([
		prisma.message.findMany(),
		prisma.messageRequest.findMany(),
	]);

	const threadMessages = messages.filter((m) => String(m.match_id || "") === matchId);
	const requestState = requests.find((r) => String(r.thread_id || "") === matchId) || null;

	if (!shouldAttemptBot({ requestState, messageCount: threadMessages.length })) {
		return { reply: null, reason: "not_initial" };
	}

	const requirement = await getRequirementById(marketplace.requirementId);
	const isBuyerSender = String(requirement?.buyer_id || "") === String(senderId || "");

	let knowledgeAnswer = null;
	try {
		const orgOwnerId = resolveOrgOwnerForCompany(companyUser);
		const entries = await listKnowledge(orgOwnerId);
		knowledgeAnswer = findKnowledgeAnswer(question, entries);
	} catch {
		knowledgeAnswer = null;
	}

	let qualificationQuestion = "";
	if (isBuyerSender && requirement) {
		const { patch, notes } = extractRequirementPatch(question, requirement);
		if (Object.keys(patch || {}).length > 0) {
			try {
				await updateRequirement(requirement.id, patch, {
					id: "system",
					role: "admin",
				});
			} catch {
				/* ignore */
			}

			await addLeadNoteForMatch({
				matchId,
				orgOwnerId: companyUser.id,
				note:
					notes.length > 0
						? `AI pre-qual captured: ${notes.join(", ")}`
						: "AI pre-qual captured details.",
				authorId: "system",
			});
		}

		const updatedRequirement =
			Object.keys(patch || {}).length > 0 ? { ...requirement, ...patch } : requirement;
		const missingFields = computeMissingFields(updatedRequirement);
		qualificationQuestion =
			autoReplySettings.qualification_prompt || buildQualificationQuestion(missingFields);
	}

	const companyFacts = buildCompanyFacts(companyUser);
	const safeReply = await generateGenerativeBotReply({
		question,
		companyUser,
		knowledgeAnswer,
		qualificationQuestion,
		companyFacts,
	});

	if (!safeReply) {
		const orgOwnerId = resolveOrgOwnerForCompany(companyUser);
		const assignedAgentId = await findAssignedAgentForMatch(matchId, orgOwnerId);

		await createNotification(orgOwnerId, {
			type: "chatbot_handoff",
			entity_type: "chat_thread",
			entity_id: matchId,
			message: `Chatbot needs human follow-up for: "${question.slice(0, 120)}"`,
			meta: { match_id: matchId, company_id: companyUser.id },
		});

		if (assignedAgentId && assignedAgentId !== orgOwnerId) {
			await createNotification(assignedAgentId, {
				type: "chatbot_handoff",
				entity_type: "chat_thread",
				entity_id: matchId,
				message: `Assigned lead needs follow-up: "${question.slice(0, 120)}"`,
				meta: { match_id: matchId, company_id: companyUser.id },
			});
		}

		return { reply: null, reason: "handoff" };
	}

	const signature = autoReplySettings.signature ? `\n\n${autoReplySettings.signature}` : "";
	const greeting = autoReplySettings.greeting ? `${autoReplySettings.greeting}\n\n` : "";
	const finalReply = `${greeting}${safeReply}${signature}`.trim();

	const entry = {
		id: crypto.randomUUID(),
		match_id: matchId,
		sender_id: String(companyUser.id),
		sender_name: sanitizeString(companyUser.name || companyUser.email || "GarTexHub Bot", 120),
		sender_role: companyUser.role || "",
		message: finalReply,
		type: "bot",
		timestamp: new Date().toISOString(),
		moderated: false,
		meta: { bot: true },
	};

	await prisma.message.create({
		data: {
			id: entry.id,
			match_id: entry.match_id,
			sender_id: entry.sender_id,
			message: entry.message,
			type: entry.type,
			timestamp: new Date(),
			moderated: entry.moderated,
		},
	});

	return { reply: entry, reason: "ok" };
}
