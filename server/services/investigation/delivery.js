// Delivery of the support investigation report, and the escalation that must
// NOT wait for it.
//
// This file exists for one reason: the case has to record the SERVER'S
// verdict, never the mail provider's optimism. `emailService.sendEmail`
// answers `{ ok: false, status: "logged_no_gmail" }` when it could only log
// the message instead of sending it, and a case that says "sent" for that is
// a lie the admin console would repeat back to a client. So every path in
// here ends in exactly one of two recorded states - "sent" or "failed" - and
// "sent" is written ONLY when sendEmail itself said ok.
//
// The two exports are deliberately independent. `deliverReport` is the mail
// path; `escalateIfNeeded` is the urgent path. A confirmed data-loss finding
// must reach the owners even when the mail provider is broken, so the
// escalation never reads the email result and the email never reads the
// escalation. The orchestrator calls both, in whatever order it likes.

import { logError, logInfo, logWarn } from "../../utils/logger.js";
import prisma from "../../utils/prisma.js";
import { escapeHtml, sanitizeString } from "../../utils/validators.js";
import { sendEmail } from "../emailService.js";
import { createNotification } from "../notificationService.js";
import { redactReportSecrets } from "./redaction.js";

// emailService truncates the plain-text body with sanitizeString(text, 2000),
// so the body is a short summary plus a link - never the report itself. The
// summary is measured against the SAME sanitizer the mail path uses, so the
// link at the end can never be cut off by the cap.
const TEXT_LIMIT = 2000;

// The measuring cap: high enough that sanitizeString never truncates while
// we are measuring, so the measurement is the real length.
const MEASURE_LIMIT = 100_000;

// How long the summary may get before it is cut short.
const SUMMARY_MAX_CHARS = 280;

// The longest subject emailService accepts.
const SUBJECT_MAX_CHARS = 200;

// The longest finding detail kept in the notification meta.
const DETAIL_MAX_CHARS = 500;

// The fallback port when neither APP_BASE_URL nor PORT is set.
const DEFAULT_PORT = 4000;

// The loop guard for the body-fitting pass.
const FIT_GUARD_MAX = 500;

// Marks the mail in the email log / outbox.
const EMAIL_SOURCE = "support_investigation_report";

/**
 * The transport the investigation report is sent through.
 *
 * Override with INVESTIGATION_REPORT_EMAIL_PROVIDER - "gmail" (SMTP with an
 * App Password), "smtp" (the generic SMTP transport) or "gmail_api" (the
 * Gmail REST API). It is PINNED here so that changing the admin config's
 * provider, or the EMAIL_PROVIDER env override, cannot silently move the
 * report off the transport the owner chose for it.
 */
const REPORT_EMAIL_PROVIDER = String(
	process.env.INVESTIGATION_REPORT_EMAIL_PROVIDER || "gmail",
).toLowerCase();

// The admin console. `/admin` is already behind the owner/admin
// ProtectedRoute in src/App.jsx, so the link is authenticated by the session
// the owner/admin already has - no token in the URL, nothing to leak.
const REPORT_LINK_PATH = "/admin";

// The notification type used for the in-app escalation ping.
const NOTIFICATION_TYPE = "support_case_escalated";

// The two recorded delivery states. There is no third one.
const STATUS_SENT = "sent";
const STATUS_FAILED = "failed";

// A base url with no scheme is not a url a mail client can open: it is a
// relative path. Render's `fromService: { property: host }` produces exactly
// that - a bare hostname - so the scheme is added back.
const SCHEME_RE = /^https?:\/\//i;

const OWNER_ADMIN_ROLES = ["owner", "admin"];

const LINE_BREAK_RE = /\r?\n/;
const TRAILING_SLASH_RE = /\/+$/;
const MARKDOWN_NOISE_RE = /[*_`>#]/g;

// ---------------------------------------------------------------------------
// Recipients
// ---------------------------------------------------------------------------

/**
 * The owner/admin staff users.
 *
 * Same resolution as the ticket-created email (supportTicketService): the
 * `role in (owner, admin)` query. Returns [{ id, email }].
 *
 * @returns {Promise<Array<{id: string, email: string}>>}
 */
async function resolveStaffUsers() {
	const admins = await prisma.user.findMany({
		where: { role: { in: OWNER_ADMIN_ROLES } },
	});
	const rows = Array.isArray(admins) ? admins : [];
	const users = [];
	const seen = new Set();
	for (const row of rows) {
		const { id = "", email = "" } = row ?? {};
		const mail = String(email).trim();
		const key = mail.toLowerCase();
		if (id && mail && !seen.has(key)) {
			seen.add(key);
			users.push({ id: String(id), email: mail });
		}
	}
	return users;
}

/**
 * `ADMIN_OWNER_EMAILS` is the optional extra source of staff addresses named
 * by the design spec (section 10). It is not set in the deployed
 * configuration, so the recipient set is exactly the ticket-created email's
 * set: the owner/admin users found by the role query.
 *
 * @returns {string[]}
 */
function extraStaffEmails() {
	return String(process.env.ADMIN_OWNER_EMAILS || "")
		.split(",")
		.map((value) => value.trim())
		.filter(Boolean);
}

/**
 * The recipient email addresses for the report mail.
 *
 * @returns {Promise<string[]>}
 */
async function resolveRecipientEmails() {
	const staff = await resolveStaffUsers();
	const candidates = [...staff.map((user) => user.email), ...extraStaffEmails()];
	const emails = [];
	const seen = new Set();
	for (const candidate of candidates) {
		const mail = String(candidate || "").trim();
		const key = mail.toLowerCase();
		if (mail && !seen.has(key)) {
			seen.add(key);
			emails.push(mail);
		}
	}
	return emails;
}

// ---------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------

/**
 * The first real paragraph of the Markdown report: no headings, no blank
 * lines in the middle, stopped as soon as it is long enough to be a summary.
 *
 * @param {string} markdown
 * @returns {string}
 */
function firstMeaningfulParagraph(markdown) {
	const lines = String(markdown || "").split(LINE_BREAK_RE);
	const collected = [];
	for (const line of lines) {
		const trimmed = line.trim();
		const isBlank = trimmed.length === 0;
		const isHeading = trimmed.startsWith("#");
		if (isBlank && collected.length > 0) {
			break;
		}
		if (!(isBlank || isHeading)) {
			collected.push(trimmed);
		}
		if (collected.join(" ").length >= SUMMARY_MAX_CHARS) {
			break;
		}
	}
	return collected.join(" ").replace(MARKDOWN_NOISE_RE, "").trim();
}

/**
 * The short summary that goes into the mail body.
 *
 * @param {Object} params
 * @param {Object} params.caseRow The SupportCase row.
 * @param {string} params.report The Markdown report.
 * @returns {string}
 */
function buildSummary({ caseRow, report }) {
	const fromCase = String(caseRow?.summary || "").trim();
	if (fromCase) {
		return fromCase;
	}
	return firstMeaningfulParagraph(report) || "Investigation report ready.";
}

/**
 * The length the mail path will actually produce: emailService runs the
 * body through sanitizeString(text, 2000), which escapes HTML entities,
 * collapses whitespace and THEN truncates. Measuring with the same function
 * is the only way to know whether the link survives.
 *
 * @param {string} text
 * @returns {number}
 */
function measuredLength(text) {
	return sanitizeString(String(text || ""), MEASURE_LIMIT).length;
}

/**
 * The plain-text body: a short summary plus the authenticated link, fitted
 * under the 2000-character cap with the link LAST so it is never truncated.
 *
 * @param {Object} params
 * @returns {string}
 */
function buildPlainText({ caseRow, summary, link }) {
	const head = [
		"GarTexHub support investigation report",
		`Case: ${caseRow?.id || ""}`,
		caseRow?.subject ? `Subject: ${caseRow.subject}` : null,
		`Status: ${caseRow?.status || "unknown"}`,
		"",
	]
		.filter((line) => line !== null)
		.join("\n");
	const tail = `\n\nFull report (authenticated admin console): ${link}`;

	let body = String(summary || "");
	let text = `${head}\n${body}${tail}`;
	let guard = 0;
	while (measuredLength(text) > TEXT_LIMIT && body.length > 0 && guard < FIT_GUARD_MAX) {
		const overflow = measuredLength(text) - TEXT_LIMIT;
		const next = body.length - overflow - 1;
		body = next > 0 ? body.slice(0, next).trimEnd() : "";
		text = `${head}\n${body}${tail}`;
		guard += 1;
	}
	return text;
}

/**
 * The HTML variant. It carries the SAME link as the plain-text body.
 *
 * @param {Object} params
 * @returns {string}
 */
function buildHtml({ caseRow, summary, link }) {
	const subject = caseRow?.subject
		? `<p><strong>Subject:</strong> ${escapeHtml(String(caseRow.subject))}</p>`
		: "";
	return [
		'<div style="font-family:Segoe UI,Arial,Helvetica,sans-serif;font-size:14px;color:#0f172a">',
		'<h2 style="margin:0 0 12px">GarTexHub support investigation report</h2>',
		`<p><strong>Case:</strong> ${escapeHtml(String(caseRow?.id || ""))}</p>`,
		subject,
		`<p><strong>Status:</strong> ${escapeHtml(String(caseRow?.status || "unknown"))}</p>`,
		`<p>${escapeHtml(String(summary || ""))}</p>`,
		`<p><a href="${escapeHtml(link)}">Open the full report</a></p>`,
		"</div>",
	].join("");
}

/**
 * @param {Object} caseRow
 * @returns {string}
 */
function buildSubject(caseRow) {
	const subject = String(caseRow?.subject || "support case").trim();
	return sanitizeString(`[GarTexHub Support] Investigation report: ${subject}`, SUBJECT_MAX_CHARS);
}

// ---------------------------------------------------------------------------
// The verdict
// ---------------------------------------------------------------------------

/**
 * Turns the mail result into the server's own verdict.
 *
 * `res.ok === true` is the ONLY thing that can produce "sent". A status
 * string on its own is never enough: emailService returns
 * `{ ok: false, status: "logged_no_gmail" }` when it logged instead of
 * sending, and trusting that status would report a message nobody received
 * as delivered.
 *
 * @param {Object} res The value sendEmail resolved with.
 * @returns {{ok: boolean, status: string, error?: string}}
 */
function interpretSendResult(res) {
	if (res?.ok === true) {
		return { ok: true, status: STATUS_SENT };
	}
	const reason = String(res?.error || res?.status || "send_failed").trim() || "send_failed";
	return { ok: false, status: STATUS_FAILED, error: reason };
}

/**
 * Writes the verdict to the case. This is the only place report_status is
 * set, and it is written from the server's verdict - never from the mail
 * provider's status string.
 *
 * @param {string} caseId
 * @param {boolean} delivered
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
async function persistDelivery(caseId, delivered) {
	const now = new Date();
	try {
		await prisma.supportCase.update({
			where: { id: String(caseId) },
			data: {
				report_status: delivered ? STATUS_SENT : STATUS_FAILED,
				report_delivered_at: delivered ? now : null,
				updated_at: now,
			},
		});
		return { ok: true };
	} catch (error) {
		logError("support_report_delivery_status_write_failed", error);
		return { ok: false, error: error?.message || "status_write_failed" };
	}
}

/**
 * Sends the mail and turns the result into the server's verdict.
 *
 * @param {Object} params
 * @returns {Promise<{ok: boolean, status: string, error?: string}>}
 */
async function sendReportMail({ caseRow, text, html }) {
	try {
		const to = await resolveRecipientEmails();
		const result = await sendEmail({
			to,
			subject: buildSubject(caseRow),
			text,
			html,
			source: EMAIL_SOURCE,
			// The investigation report is PINNED to Gmail (SMTP with an App
			// Password). The other three email sources - ticket notifications,
			// lead reminders, admin actions - keep whatever transport the admin
			// config names, so pinning this one does not change the rest of
			// the app's mail.
			provider: REPORT_EMAIL_PROVIDER,
		});
		return interpretSendResult(result);
	} catch (error) {
		logError("support_report_delivery_send_failed", error);
		return {
			ok: false,
			status: STATUS_FAILED,
			error: String(error?.message || "send_failed"),
		};
	}
}

/**
 * Fires `support.case.report` on the realtime bus, if the bus exposes it.
 *
 * The emitter belongs to another workstream (contracts.md section 4), so it
 * is imported lazily and defensively: a missing emitter must never break
 * delivery.
 *
 * @param {string} caseId
 * @param {string} report
 * @param {string} reportStatus
 */
async function emitReportReady(caseId, report, reportStatus) {
	try {
		const bus = await import("../../realtime/realtimeBus.js");
		if (typeof bus?.emitCaseEvent === "function") {
			bus.emitCaseEvent(caseId, "support.case.report", { caseId, report, reportStatus });
		}
	} catch (error) {
		logWarn("support_report_event_skipped", { message: error?.message || "bus_unavailable" });
	}
}

// ---------------------------------------------------------------------------
// Escalation
// ---------------------------------------------------------------------------

// A finding with no `category` of its own is classified from its detail
// text. The security list is deliberately phrase-based rather than a bare
// word list, so an ordinary confirmed finding ("the delete button does
// nothing") never escalates.
const SECURITY_CATEGORY_RE =
	/\b(security|vulnerab\w*|exploit\w*|injection|breach|unauthori[sz]ed|unauthenticated|privilege\w*|traversal|csrf|xss|ssrf|rce|xxe|ssti|idor|leak\w*|exposure|hardcoded|plaintext|malware|ransomware|attacker)\b/;
const DATA_LOSS_CATEGORY_RE =
	/\b(data[\s_-]?(loss|leak|breach|exposure|deletion)|loss[\s_-]?of[\s_-]?data|destructive[\s_-]?(delete|operation)|integrity[\s_-]?loss)\b/;

/**
 * A finding that DENIES the harm is not evidence of the harm.
 *
 * The measured false positive: a CONFIRMED finding that correctly described
 * the API surface -
 *
 *   "The only DELETE route in documentRoutes.js is DELETE /api/documents/:documentId,
 *    which is a hard delete of a Document row and IS NOT CALLED from ContractVault."
 *
 * - was classified as a data-loss issue and escalated, because the phrase
 * "hard delete" appears in it. The finding says the OPPOSITE of an incident:
 * it says the destructive route is never reached. Escalating that pages the
 * staff for a missing feature.
 *
 * The list is deliberately narrow: it names the ways a finding says the harm
 * does not HAPPEN (not called, never called, no route, cannot delete), not the
 * ways a finding might merely mention a negative. A confirmed incident - "the
 * archive endpoint permanently deletes every contract" - contains none of
 * them and still escalates.
 *
 * "does nothing" belongs here for the same reason: "the delete button does
 * nothing when clicked" is the measured benign complaint, and it names the
 * harm in the very words a data-loss pattern looks for.
 */
const HARM_DENIAL_RE =
	/\b(?:is|are|was|were)\s+not\s+(?:called|used|wired|invoked|reached|executed|triggered|connected|linked)\b|\bnever\s+(?:called|used|wired|invoked|reached|executed|triggered|connected)\b|\bnot\s+(?:wired|connected|implemented|reachable|called\s+from|invoked\s+from|triggered\s+from)\b|\bno\s+(?:route|endpoint|button|path|server\s+endpoint|call)\b|\bcannot\s+(?:be\s+)?(?:delete|removed?|destroyed|wiped|erased|purged|leaked|exposed)\b|\bdoes\s+not\s+(?:delete|remove|destroy|wipe|erase|purge|leak|expose)\b|\bdoes\s+nothing\b|\bdoes\s+not\s+work\b|\b(?:has|have|had)\s+no\s+effect\b|\bno[\s-]?op\b/;

const DATA_NOUN_RE =
	/\b(record|records|row|rows|data|file|files|document|documents|user|users|order|orders|contract|contracts|message|messages|table|tables|entry|entries|history|payment|payments|invoice|invoices|backup|backups)\b/;
// The present and future forms matter: a finding that says the endpoint
// DELETES every contract is reporting a live harm, and only the past tense
// was matched before.
const DATA_LOSS_VERB_RE =
	/\b(delet(?:e|es|ed|ing)|remov(?:e|es|ed|ing)|wip(?:e|es|ed)|er(?:a|as)se(?:d|s)?|destroy(?:s|ed|ing)?|lost|loss|missing|gone|vanish(?:ed|es)?|disappear(?:s|ed|ing)?|corrupt(?:s|ed|ing)?|truncat(?:e|es|ed)|overwritt?(?:e|en)|clobb(?:er|ered|ering)|leak(?:s|ed|ing)?|purg(?:e|es|ed|ing)|drop(?:s|ped|ping))\b/;

const SECURITY_PATTERNS = [
	/\bsecurit(y|ies)\b/,
	/\bvulnerab(le|ility|ilities)\b/,
	/\bexploit(able|ed|s|ation)?\b/,
	/\b(sqli?|nosql|ldap|command|code|html|template|xpath|prototype|second[\s-]?order|blind)[\s-]?injection\b/,
	/\b(xss|csrf|ssrf|xxe|ssti|rce|idor|lfi|rfi)\b/,
	/\bcross[\s-]?site\b/,
	/\bremote code execution\b/,
	/\bprivilege escalation\b/,
	/\b(auth|authentication|authorization|authn|authz|access control|permission)s?\s+(check\s+)?(bypass|is bypassed|are bypassed)\b/,
	/\bbypass(es|ed|ing)?\s+(the\s+)?(auth|authentication|authorization|access control|permission|login)\b/,
	/\bmissing (authorization|authentication|access control)\b/,
	// "has no authorization check" is the same defect as "missing
	// authorization", and it is how the code under investigation words it.
	/\b(no|without|missing|lacks?|lacking|omits?|omitting)\s+(an?\s+)?(authorization|authentication|authz|authn|access[\s-]?control|permission)\b/,
	/\bunauthenticated\b/,
	/\bunauthori[sz]ed\b/,
	/\barbitrary (file|command|code|path|read|write|object)\b/,
	/\b(path|directory) traversal\b/,
	/\bworld[\s-]?readable\b/,
	/\bexposed\b[^.]{0,60}\b(api|endpoint|route|secret|key|password|credential|credentials|database|file|files|admin)\b/,
	/\b(secret|secrets|credential|credentials|password|passwords|api[\s-]?key|private key|tokens?)\b[^.]{0,60}\b(exposed|leaked|disclosed|committed|hardcoded|in the repo|in the source|plain ?text|plaintext)\b/,
	/\bhardcoded\b/,
	/\b(password|passwords|secret|secrets|credential|credentials|tokens?)\b[^.]{0,40}\bin plain ?text\b/,
	/\bunencrypted\b/,
	/\b(no|missing|without|lacks?|lacking)\s+encryption\b/,
	/\bweak (password|hash|encryption|cipher|token|secret|randomness)\b/,
	/\b(sensitive|personal|confidential|private)\s+(data|information|details|records?)\b[^.]{0,60}\b(exposed|leaked|public|world|unencrypted|unprotected|readable)\b/,
	/\b(sensitive|personal|confidential|private)\s+(data|information|details|records?)\b[^.]{0,60}\b(is|are|was|were)\s+(returned|sent|logged|printed|visible)\b/,
	/\battacker\b/,
	/\bmalicious\b/,
	/\bsession (fixation|hijack)\b/,
	/\bmfa (bypass|circumvention)\b/,
	/\b(missing|absent|broken)\s+csrf\b/,
];

const DATA_LOSS_PATTERNS = [
	/\bdata[\s-]?(loss|leak|breach|exposure|deletion)\b/,
	/\bloss of data\b/,
	// The separator is a hyphen as well as a space: the code under
	// investigation writes "hard-deletes", not "hard delete".
	/\b(permanently|hard|bulk|mass)[\s_-]?delet(?:e|es|ed|ing)\b/,
	new RegExp(`${DATA_LOSS_VERB_RE.source}[^.]{0,60}${DATA_NOUN_RE.source}`),
	new RegExp(`${DATA_NOUN_RE.source}[^.]{0,60}${DATA_LOSS_VERB_RE.source}`),
];

/**
 * Accepts the findings as an array, as the `{ summary, findings, limitations }`
 * wrapper the investigation row stores, or as a JSON string of either.
 *
 * @param {unknown} findings
 * @returns {Array<Object>}
 */
function normalizeFindings(findings) {
	if (Array.isArray(findings)) {
		return findings.filter((finding) => finding && typeof finding === "object");
	}
	if (typeof findings === "string") {
		try {
			return normalizeFindings(JSON.parse(findings));
		} catch {
			return [];
		}
	}
	if (findings && typeof findings === "object" && Array.isArray(findings.findings)) {
		return findings.findings.filter((finding) => finding && typeof finding === "object");
	}
	return [];
}

/**
 * The findings that must escalate: CONFIRMED, and a security or data-loss
 * issue. A confirmed finding of any other kind does not escalate.
 *
 * @param {unknown} findings
 * @returns {Array<{category: string, detail: string}>}
 */
function collectEscalationTriggers(findings) {
	const triggers = [];
	for (const finding of normalizeFindings(findings)) {
		const confidence = String(finding?.confidence || "").toLowerCase();
		const category = confidence === "confirmed" ? classifyFinding(finding) : null;
		if (category) {
			triggers.push({ category, detail: String(finding?.detail || "") });
		}
	}
	return triggers;
}

/**
 * Reads the case row, defensively: a missing delegate is not an error here.
 *
 * @param {string} caseId
 * @returns {Promise<Object|null>}
 */
async function readCase(caseId) {
	try {
		const row = await prisma.supportCase.findUnique({ where: { id: String(caseId) } });
		return row && typeof row === "object" ? row : null;
	} catch {
		return null;
	}
}

/**
 * Pings every owner/admin in-app. This is the notification the client sees
 * live (createNotification also emits on the realtime bus), so a confirmed
 * data-loss finding reaches the staff even when the mail never left the box.
 *
 * @param {Object} params
 */
async function notifyStaffOfEscalation({ caseId, category, detail, triggerCount, subject }) {
	const staff = await resolveStaffUsers();
	await Promise.all(
		staff.map((user) =>
			createNotification(user.id, {
				type: NOTIFICATION_TYPE,
				entity_type: "support_case",
				entity_id: caseId,
				message: `Escalated support case ${caseId}: confirmed ${category} finding`,
				meta: {
					case_id: caseId,
					subject: String(subject || ""),
					confidence: "confirmed",
					category,
					detail: sanitizeString(detail, DETAIL_MAX_CHARS),
					findings: triggerCount,
				},
			}).catch((error) => {
				logError("support_case_escalation_notification_failed", error);
			}),
		),
	);
	return staff.length;
}

// ---------------------------------------------------------------------------
// The two exports
// ---------------------------------------------------------------------------

/**
 * Sends the report to the owners/admins and records the SERVER's verdict on
 * the case.
 *
 * The plain-text body is capped at 2000 characters (emailService truncates),
 * so the body carries a short summary plus an authenticated link to the full
 * report; the HTML variant carries the same link.
 *
 * The case records "sent" ONLY when sendEmail answered ok. A send that was
 * merely logged (`{ ok: false, status: "logged_no_gmail" }`) records
 * "failed" - never "sent".
 *
 * The report is REDACTED before it is used: the investigators can read the
 * repository, and the repository holds credentials, so a report that quotes
 * one would carry it into the database, the inbox and the client's browser.
 *
 * The report event is fired either way, carrying the delivery verdict: the
 * report body is a shared artefact and the delivery verdict is a separate
 * fact, and the client has to learn both.
 *
 * @param {Object} params
 * @param {Object} params.caseRow The SupportCase row.
 * @param {string} params.report The Markdown report.
 * @returns {Promise<{ok: boolean, status: string, error?: string}>}
 */
export async function deliverReport({ caseRow, report } = {}) {
	const caseId = String(caseRow?.id || "");
	if (!caseId) {
		logWarn("support_report_delivery_without_case", {});
		return { ok: false, status: STATUS_FAILED, error: "case_row_required" };
	}

	// The report is redacted BEFORE anything reads it. The investigators can
	// read the whole repository, and the repository holds credentials, so a
	// report that quotes one would carry it into the database, into the
	// owner's inbox and into the client's browser.
	const safeReport = redactReportSecrets(String(report || ""));
	const link = buildCaseReportLink(caseId);
	const summary = redactReportSecrets(buildSummary({ caseRow, report: safeReport }));
	const text = buildPlainText({ caseRow, summary, link });
	const html = buildHtml({ caseRow, summary, link });

	const outcome = await sendReportMail({ caseRow, text, html });
	const persisted = await persistDelivery(caseId, outcome.ok);
	const errors = [outcome.error, persisted.ok ? null : `status_not_recorded: ${persisted.error}`]
		.filter(Boolean)
		.join("; ");

	// The report event is fired BEFORE the success check, and it carries the
	// delivery verdict either way. The report body is a shared artefact: the
	// client is waiting for it, and a mail provider that is down does not
	// make the report stop existing. Emitting it only on the success path
	// left the client waiting forever for a report the server had already
	// written down.
	const reportStatus = outcome.ok ? STATUS_SENT : STATUS_FAILED;
	await emitReportReady(caseId, safeReport, reportStatus);

	if (!outcome.ok) {
		logWarn("support_report_delivery_failed", {
			case_id: caseId,
			reason: outcome.error,
			report_status: STATUS_FAILED,
		});
		return { ok: false, status: STATUS_FAILED, error: errors || outcome.error };
	}

	if (!persisted.ok) {
		// The mail went out but the verdict could not be written down. The
		// case therefore does NOT know it was delivered, so this is reported
		// as a failure rather than as a success.
		logError("support_report_delivery_unrecorded", new Error(persisted.error));
		return { ok: false, status: STATUS_FAILED, error: errors };
	}

	logInfo("support_report_delivered", {
		case_id: caseId,
		report_status: STATUS_SENT,
		body_length: text.length,
	});
	return { ok: true, status: STATUS_SENT };
}

/**
 * Escalates a case when a CONFIRMED finding is a security or data-loss
 * issue.
 *
 * This path is independent of the mail path on purpose: a confirmed
 * data-loss finding must not be delayed by (or swallowed by) a mail failure.
 * It flags the case and pings every owner/admin in-app, and it returns true
 * only when it escalated.
 *
 * A confirmed finding that is neither a security nor a data-loss issue does
 * NOT escalate automatically - it stays in the report and the admin console
 * like any other finding.
 *
 * @param {string} caseId
 * @param {unknown} findings The findings array (or the investigation's findings wrapper).
 * @returns {Promise<boolean>}
 */
export async function escalateIfNeeded(caseId, findings) {
	const id = String(caseId || "");
	if (!id) {
		logWarn("support_escalation_without_case", {});
		return false;
	}

	const triggers = collectEscalationTriggers(findings);
	if (triggers.length === 0) {
		return false;
	}

	const existing = await readCase(id);
	if (existing?.escalated === true) {
		logInfo("support_case_already_escalated", { case_id: id });
		return true;
	}

	const { category, detail } = triggers[0];
	try {
		await prisma.supportCase.update({
			where: { id },
			data: { escalated: true, updated_at: new Date() },
		});
	} catch (error) {
		logError("support_case_escalation_persist_failed", error);
		return false;
	}

	const notified = await notifyStaffOfEscalation({
		caseId: id,
		category,
		detail,
		triggerCount: triggers.length,
		subject: existing?.subject,
	});

	logInfo("support_case_escalated", { case_id: id, category, notified });
	return true;
}

/**
 * The public base URL of this deployment.
 *
 * `APP_BASE_URL` is the repo-wide name for it - it is what every other link
 * the server builds uses (README, .env.example) - and `PUBLIC_APP_URL` is
 * accepted as a second name, because a link that points at `localhost` is
 * worse than no link at all: the owner reads the mail on their own machine
 * and the link opens nothing. The local port is the last resort, and it is
 * right in development and wrong everywhere else.
 *
 * `RENDER_EXTERNAL_URL` comes FIRST because it is the value Render itself
 * sets, with the scheme, and because the `APP_BASE_URL` that render.yaml
 * derives from `fromService: { property: host }` is a bare hostname. A
 * schemeless value is repaired below, but a value Render set is a better
 * value than one Render derived.
 *
 * @returns {string}
 */
function baseUrl() {
	for (const candidate of [
		process.env.RENDER_EXTERNAL_URL,
		process.env.APP_BASE_URL,
		process.env.PUBLIC_APP_URL,
	]) {
		const value = normalizeBaseUrl(candidate);
		if (value) {
			return value;
		}
	}
	return `http://localhost:${process.env.PORT || DEFAULT_PORT}`;
}

/**
 * One base url candidate, made usable.
 *
 * A value with no scheme is a hostname, and a hostname is only an address
 * once it says how to reach it: `gartexhub.onrender.com` opens nothing in a
 * mail client, `https://gartexhub.onrender.com` opens the console. The
 * scheme that is added is `https`, because a public deployment that is
 * reachable at all is reachable over TLS.
 *
 * @param {unknown} candidate
 * @returns {string} The normalised url, or "" when there is none.
 */
function normalizeBaseUrl(candidate) {
	const value = String(candidate || "")
		.trim()
		.replace(TRAILING_SLASH_RE, "");
	if (!value) {
		return "";
	}
	if (SCHEME_RE.test(value)) {
		return value;
	}
	return `https://${value}`;
}

/**
 * The authenticated admin link to the full report.
 *
 * The link is `/admin?case=<caseId>`: the admin console reads the `case`
 * query parameter and opens that case, so the link and the console agree on
 * one spelling of the deep link.
 *
 * @param {string} caseId
 * @returns {string}
 */
export function buildCaseReportLink(caseId) {
	return `${baseUrl()}${REPORT_LINK_PATH}?case=${encodeURIComponent(String(caseId || ""))}`;
}

/**
 * Classifies a finding as a security issue, a data-loss issue, or neither.
 *
 * Exported so the admin console (and the tests) can ask the same question
 * the escalation path asks.
 *
 * @param {Object} finding
 * @returns {"security"|"data_loss"|null}
 */
export function classifyFinding(finding) {
	const explicit = String(finding?.category || finding?.type || "").toLowerCase();
	if (explicit) {
		if (DATA_LOSS_CATEGORY_RE.test(explicit)) {
			return "data_loss";
		}
		if (SECURITY_CATEGORY_RE.test(explicit)) {
			return "security";
		}
	}
	const haystack = String(finding?.detail || finding?.text || "").toLowerCase();
	if (!haystack) {
		return null;
	}
	// The finding says the harmful thing is not reached. It is describing a
	// CAPABILITY, not reporting an incident, so it must not page anybody.
	if (HARM_DENIAL_RE.test(haystack)) {
		return null;
	}
	// SECURITY is tested FIRST. A finding that says "any authenticated user
	// can delete another user's contract" matches BOTH sets - the access
	// control is the defect, the deletion is the consequence - and the defect
	// is the more precise classification.
	if (SECURITY_PATTERNS.some((pattern) => pattern.test(haystack))) {
		return "security";
	}
	if (DATA_LOSS_PATTERNS.some((pattern) => pattern.test(haystack))) {
		return "data_loss";
	}
	return null;
}
