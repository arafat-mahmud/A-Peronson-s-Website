import crypto from "node:crypto";
import prisma from "../utils/prisma.js";
import { sanitizeString } from "../utils/validators.js";
import { createNotification } from "./notificationService.js";

const EMAIL_REGEX = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
const URL_REGEX = /(https?:\/\/|www\.)\S+/i;
const DOMAIN_REGEX =
	/\b[a-z0-9.-]+\.(com|net|org|io|me|bd|uk|co|in|pk|cn|ru|jp|sg|my|ae|sa|de|fr|it|es|nl|eu|us)\b/i;
const PHONE_REGEX = /(?:\+?\d[\d\s\-().]{8,}\d)/;

const CONTACT_KEYWORDS = [
	// English
	"whatsapp",
	"wa.me",
	"wa",
	"telegram",
	"tg",
	"imo",
	"wechat",
	"line",
	"viber",
	"signal",
	"facebook",
	"fb",
	"instagram",
	"ig",
	"messenger",
	"freelancer",
	"fiverr",
	// Bangla (best-effort)
	"হোয়াটসঅ্যাপ",
	"হোয়াটসঅ্যাপ",
	"টেলিগ্রাম",
	"ইমো",
	"উইচ্যাট",
	"ফেসবুক",
	"ইনস্টাগ্রাম",
	"মেসেঞ্জার",
];

const OBSCENE_KEYWORDS = [
	"porn",
	"xxx",
	"nude",
	"sex",
	"fuck",
	"blowjob",
	"pussy",
	"dick",
	// Bangla
	"অশ্লীল",
	"নগ্ন",
	"পর্ন",
];

function digitsOnly(value = "") {
	return String(value || "").replace(/\D/g, "");
}

const NUMBER_WORDS = new Map([
	["zero", "0"],
	["oh", "0"],
	["one", "1"],
	["two", "2"],
	["three", "3"],
	["four", "4"],
	["five", "5"],
	["six", "6"],
	["seven", "7"],
	["eight", "8"],
	["nine", "9"],
	["ten", "10"],
]);

function looksLikePhone(match = "") {
	const digits = digitsOnly(match);
	// Keep it strict-ish to avoid matching quantities: 10+ digits is usually a phone number.
	return digits.length >= 10;
}

function normalizeText(text) {
	return String(text || "").trim();
}

function lower(text) {
	return normalizeText(text).toLowerCase();
}

function normalizeNumberWords(text = "") {
	let output = lower(text);
	for (const [word, digit] of NUMBER_WORDS.entries()) {
		const pattern = new RegExp(`\\b${word}\\b`, "g");
		output = output.replace(pattern, digit);
	}
	return output;
}

function hasSplitEmailTokens(text = "") {
	const l = normalizeNumberWords(text);
	const hasAt = /\b(at|\(at\)|@)\b/.test(l);
	const hasDot = /\b(dot|\(dot\)|\.)\b/.test(l);
	const hasTld =
		/\b(com|net|org|io|me|bd|uk|co|in|pk|cn|ru|jp|sg|my|ae|sa|de|fr|it|es|nl|eu|us)\b/.test(l);
	const hasProvider = /(gmail|yahoo|hotmail|outlook|icloud)/.test(l);
	return (hasAt && hasDot && hasTld) || (hasProvider && hasAt && hasDot);
}

function scanOutsideContact(text) {
	const raw = normalizeText(text);
	if (!raw) {
		return null;
	}

	const normalized = normalizeNumberWords(raw);

	if (EMAIL_REGEX.test(raw) || EMAIL_REGEX.test(normalized)) {
		return {
			kind: "outside_contact",
			reason: "email_detected",
			signals: ["email"],
		};
	}

	if (
		URL_REGEX.test(raw) ||
		DOMAIN_REGEX.test(raw) ||
		URL_REGEX.test(normalized) ||
		DOMAIN_REGEX.test(normalized)
	) {
		return {
			kind: "outside_contact",
			reason: "url_detected",
			signals: ["url"],
		};
	}

	const phoneMatch = normalized.match(PHONE_REGEX) || raw.match(PHONE_REGEX);
	if (phoneMatch && looksLikePhone(phoneMatch[0] || "")) {
		return {
			kind: "outside_contact",
			reason: "phone_detected",
			signals: ["phone"],
		};
	}

	const l = normalized;
	const keywordHit = CONTACT_KEYWORDS.find((k) => l.includes(k));
	if (keywordHit) {
		// If the user references an outside platform AND includes an identifier-like signal, treat it as sharing.
		const identifierSignal =
			/[@.]|\b(id|username|user|handle|contact|call|dm)\b/.test(l) || looksLikePhone(l);
		return {
			kind: "outside_contact",
			reason: identifierSignal
				? `platform_contact:${keywordHit}`
				: `platform_reference:${keywordHit}`,
			signals: ["platform"],
		};
	}

	// Split email patterns (e.g., "name at gmail dot com").
	if (hasSplitEmailTokens(l)) {
		return {
			kind: "outside_contact",
			reason: "split_email_pattern",
			signals: ["split_email"],
		};
	}

	return null;
}

function scanObscene(text) {
	const raw = normalizeText(text);
	if (!raw) {
		return null;
	}
	const l = lower(raw);
	const hit = OBSCENE_KEYWORDS.find((k) => l.includes(k));
	if (!hit) {
		return null;
	}
	return {
		kind: "obscene",
		reason: `obscene_keyword:${hit}`,
		signals: ["obscene"],
	};
}

export function scanPolicyText(text) {
	// Order matters: outside-contact is the highest business risk.
	return scanOutsideContact(text) || scanObscene(text) || null;
}

function scanOutsideContactAcrossTexts(texts = []) {
	const parts = Array.isArray(texts)
		? texts.map((t) => String(t || "").trim()).filter(Boolean)
		: [];
	if (parts.length === 0) {
		return null;
	}

	const joined = parts.join(" ");
	const l = normalizeNumberWords(joined);

	// Split phone numbers across multiple messages: joining + digit extraction catches it.
	const digits = digitsOnly(l);
	if (digits.length >= 10) {
		return {
			kind: "outside_contact",
			reason: "phone_detected_split",
			signals: ["phone_split"],
		};
	}

	// Split email patterns across messages (best-effort): "name" + "gmail" + "at" + "dot" + "com".
	if (hasSplitEmailTokens(l)) {
		return {
			kind: "outside_contact",
			reason: "split_email_pattern_across_messages",
			signals: ["split_email"],
		};
	}

	// Platform keyword split + identifier-like signals.
	const keywordHit = CONTACT_KEYWORDS.find((k) => l.includes(k));
	if (keywordHit) {
		const identifierSignal =
			/[@.]|\b(id|username|user|handle|contact|call|dm)\b/.test(l) || digits.length >= 8;
		if (identifierSignal) {
			return {
				kind: "outside_contact",
				reason: `platform_contact_split:${keywordHit}`,
				signals: ["platform"],
			};
		}
	}

	return null;
}

function penaltyForStrike(strikes) {
	// Shaun requirement (project.md):
	// - First 3 strikes: delete + warn (no restriction window).
	// - Then: 24h → 48h → 7d → ban.
	if (strikes <= 3) {
		return { action: "warn", restrict_hours: 0, ban: false };
	}
	if (strikes === 4) {
		return { action: "restrict", restrict_hours: 24, ban: false };
	}
	if (strikes === 5) {
		return { action: "restrict", restrict_hours: 48, ban: false };
	}
	if (strikes === 6) {
		return { action: "restrict", restrict_hours: 24 * 7, ban: false };
	}
	return { action: "ban", restrict_hours: 0, ban: true };
}

function restrictionUntil(hours) {
	if (!hours || hours <= 0) {
		return null;
	}
	return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

export function assertMessagingAllowed(user) {
	if (!user) {
		return;
	}
	const status = String(user.status || "active").toLowerCase();
	if (status === "banned") {
		const err = new Error("Your account has been banned due to repeated policy violations.");
		err.status = 403;
		err.code = "ACCOUNT_BANNED";
		throw err;
	}

	const untilRaw = String(user.messaging_restricted_until || "").trim();
	if (!untilRaw) {
		return;
	}
	const until = new Date(untilRaw);
	if (Number.isNaN(until.getTime())) {
		return;
	}
	if (until.getTime() <= Date.now()) {
		return;
	}

	const err = new Error(
		`Messaging is restricted until ${until.toLocaleString()}. Please review policy notifications.`,
	);
	err.status = 403;
	err.code = "MESSAGING_RESTRICTED";
	err.restricted_until = untilRaw;
	throw err;
}

export async function recordPolicyViolation({
	actor_id,
	kind,
	reason,
	entity_type = "",
	entity_id = "",
	content = "",
	metadata = {},
}) {
	const actorId = sanitizeString(String(actor_id || ""), 120);
	if (!actorId) {
		return null;
	}

	const user = await prisma.user.findUnique({ where: { id: actorId } });
	if (!user) {
		return null;
	}

	const prevStrikes = Number(user.policy_strikes || 0);
	const strikes = Math.max(0, prevStrikes) + 1;
	const penalty = penaltyForStrike(strikes);
	const nextRestrictionUntil = penalty.restrict_hours
		? restrictionUntil(penalty.restrict_hours)
		: null;

	const currentUntil = user.messaging_restricted_until;
	const keepUntil = (() => {
		if (!currentUntil) {
			return nextRestrictionUntil;
		}
		if (!nextRestrictionUntil) {
			return currentUntil;
		}
		return new Date(nextRestrictionUntil).getTime() > new Date(currentUntil).getTime()
			? new Date(nextRestrictionUntil)
			: currentUntil;
	})();

	await prisma.user.update({
		where: { id: actorId },
		data: {
			policy_strikes: strikes,
			messaging_restricted_until: keepUntil || null,
			status: penalty.ban ? "banned" : user.status || "active",
			policy_updated_at: new Date(),
		},
	});

	const row = await prisma.policyViolation.create({
		data: {
			id: crypto.randomUUID(),
			actor_id: actorId,
			kind: sanitizeString(String(kind || ""), 60),
			reason: sanitizeString(String(reason || ""), 120),
			entity_type: sanitizeString(String(entity_type || ""), 60),
			entity_id: sanitizeString(String(entity_id || ""), 160),
			snippet: sanitizeString(String(content || ""), 240),
			strikes,
			action: penalty.action,
			restrict_hours: penalty.restrict_hours,
			messaging_restricted_until: keepUntil || null,
			meta: metadata && typeof metadata === "object" ? metadata : {},
			created_at: new Date(),
		},
	});

	const guidance =
		"Sharing phone numbers, emails, WhatsApp/Telegram, social links, or outside contact methods is not allowed on GarTexHub. Use the built-in chat/call system.";
	const escalation =
		"Enforcement ladder: 3 warnings → 24h restriction → 48h restriction → 7d restriction → permanent ban.";
	const penaltyLine = penalty.ban
		? "Your account is now banned due to repeated violations."
		: keepUntil
			? `Messaging restricted until ${keepUntil}.`
			: "This is a warning. Repeated violations will lead to restrictions/bans.";

	await createNotification(actorId, {
		type: "policy_violation",
		entity_type: entity_type || "policy",
		entity_id: entity_id || actorId,
		message: `Policy violation detected (${row.reason}). Content removed. ${penaltyLine} ${escalation}`,
		meta: {
			strikes,
			kind: row.kind,
			guidance,
			escalation,
			messaging_restricted_until: keepUntil,
		},
	});

	const users = await prisma.user.findMany();
	const adminTargets = users.filter((u) =>
		["owner", "admin"].includes(String(u.role || "").toLowerCase()),
	);
	await Promise.all(
		adminTargets.map((admin) =>
			createNotification(admin.id, {
				type: "policy_violation_admin",
				entity_type: entity_type || "policy",
				entity_id: entity_id || actorId,
				message: `Policy violation by ${user.name || user.email || actorId} (${row.reason}). Strike ${strikes}. Action: ${penalty.action}.`,
				meta: {
					actor_id: actorId,
					strikes,
					action: penalty.action,
					messaging_restricted_until: keepUntil,
				},
			}),
		),
	);

	return row;
}

export async function moderateTextOrRedact({ actor, text, entity_type = "", entity_id = "" }) {
	const raw = normalizeText(text);
	const scan = scanPolicyText(raw);
	if (!scan) {
		return { text: raw, moderated: false, reason: "" };
	}

	await recordPolicyViolation({
		actor_id: actor?.id,
		kind: scan.kind,
		reason: scan.reason,
		entity_type,
		entity_id,
		content: raw,
	});

	const redacted =
		scan.kind === "outside_contact"
			? "[Removed: outside contact sharing is not allowed]"
			: "[Removed: content violates platform policy]";

	return { text: redacted, moderated: true, reason: scan.reason };
}

export async function moderateTextOrRedactWithContext({
	actor,
	text,
	context_texts = [],
	entity_type = "",
	entity_id = "",
}) {
	// First run the single-message scan.
	const single = await moderateTextOrRedact({
		actor,
		text,
		entity_type,
		entity_id,
	});
	if (single.moderated) {
		return single;
	}

	// Then run a "conversation-level" scan (project.md): catch split outside-contact sharing tricks.
	const scan = scanOutsideContactAcrossTexts([
		...(Array.isArray(context_texts) ? context_texts : []),
		single.text,
	]);
	if (!scan) {
		return single;
	}

	await recordPolicyViolation({
		actor_id: actor?.id,
		kind: scan.kind,
		reason: scan.reason,
		entity_type,
		entity_id,
		content: single.text,
		metadata: {
			signals: scan.signals,
			context_window: Math.min(6, (context_texts || []).length + 1),
		},
	});

	return {
		text: "[Removed: outside contact sharing is not allowed]",
		moderated: true,
		reason: scan.reason,
	};
}
