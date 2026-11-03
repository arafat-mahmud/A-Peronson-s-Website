import crypto from "node:crypto";
import { logError, logInfo, logWarn } from "../utils/logger.js";
import prisma from "../utils/prisma.js";
import { sanitizeString } from "../utils/validators.js";
import { getAdminConfig } from "./adminConfigService.js";

function isConfigured(value) {
	return Boolean(String(value || "").trim());
}

export function isSmtpConfigured() {
	return isConfigured(process.env.SMTP_HOST) && isConfigured(process.env.SMTP_USER);
}

/**
 * Gmail over SMTP with an App Password.
 *
 * This is NOT the `gmail_api` provider: that one drives the Gmail REST API and
 * needs an OAuth2 client id, a client secret and a refresh token. An App
 * Password is a plain SMTP credential, so it gets its own transport with its
 * own settings, and it does NOT read SMTP_HOST or SMTP_USER - those belong to
 * the other transport, and a fallback would silently send "Gmail" mail
 * through Brevo.
 */
export function isGmailAppPasswordConfigured() {
	return isConfigured(process.env.GMAIL_USER) && isConfigured(process.env.GMAIL_APP_PASSWORD);
}

function isGmailConfigured() {
	return (
		isConfigured(process.env.GMAIL_CLIENT_ID) &&
		isConfigured(process.env.GMAIL_CLIENT_SECRET) &&
		isConfigured(process.env.GMAIL_REFRESH_TOKEN) &&
		isConfigured(process.env.GMAIL_SENDER)
	);
}

/**
 * The provider a send uses.
 *
 * A send may PIN its provider (the investigation report pins "gmail"), then
 * the EMAIL_PROVIDER env override, then the admin config. The env override
 * exists so the transport can be changed without a database write, but a
 * pinned provider wins over it.
 */
function resolveProvider(emailConfig, pinned) {
	return String(pinned || process.env.EMAIL_PROVIDER || emailConfig?.provider || "smtp").toLowerCase();
}

async function getEmailConfig() {
	const config = await getAdminConfig();
	const emailConfig = config?.notifications?.email || {};
	return {
		enabled: Boolean(emailConfig?.enabled),
		provider: String(emailConfig?.provider || "smtp"),
		from_name: sanitizeString(String(emailConfig?.from_name || ""), 120),
		from_email: sanitizeString(String(emailConfig?.from_email || ""), 160),
		test_recipient: sanitizeString(String(emailConfig?.test_recipient || ""), 160),
	};
}

export async function getEmailDeliveryStatus() {
	const emailConfig = await getEmailConfig();
	const provider = resolveProvider(emailConfig, null);
	const smtpConfigured = isSmtpConfigured();
	const gmailConfigured = isGmailConfigured();
	const gmailAppPasswordConfigured = isGmailAppPasswordConfigured();
	const providerConfigured =
		provider === "smtp"
			? smtpConfigured
			: provider === "gmail"
				? gmailAppPasswordConfigured
				: provider === "gmail_api"
					? gmailConfigured
					: false;

	return {
		enabled: Boolean(emailConfig.enabled),
		provider,
		provider_configured: providerConfigured,
		ready: Boolean(emailConfig.enabled && providerConfigured),
		smtp: { configured: smtpConfigured },
		gmail: { configured: gmailAppPasswordConfigured },
		gmail_api: { configured: gmailConfigured },
		from_name_set: Boolean(emailConfig.from_name),
		from_email_set: Boolean(emailConfig.from_email),
	};
}

function normalizeRecipients(to) {
	if (Array.isArray(to)) {
		return to.map((value) => sanitizeString(String(value || ""), 160)).filter(Boolean);
	}
	const value = sanitizeString(String(to || ""), 160);
	return value ? [value] : [];
}

async function queueEmail(entry) {
	await prisma.emailOutbox.create({ data: entry });
}

// Emails whose body is a credential (a one-time reset link) are logged
// without it: the log is readable by admins and anyone with database access.
const REDACTED_BODY_SOURCES = new Set(["password_reset"]);

async function logEmailToDb({ to, subject, text, html, status, source, error }) {
	if (REDACTED_BODY_SOURCES.has(source)) {
		text = "[redacted: contains a one-time password reset link]";
		html = null;
	}
	try {
		await prisma.emailLog.create({
			data: {
				to: Array.isArray(to) ? to.join(", ") : String(to || ""),
				subject: sanitizeString(String(subject || ""), 200),
				body: sanitizeString(String(text || ""), 5000),
				html: html ? String(html) : null,
				status: status || "logged",
				source: source || "email_service",
				error: error || null,
			},
		});
	} catch (dbError) {
		logError("email_log_db_failed", dbError);
	}
}

export async function sendEmail({ to, subject, text, html, source, provider: pinnedProvider }) {
	const recipients = normalizeRecipients(to);
	if (recipients.length === 0) {
		return { ok: false, status: "no_recipients" };
	}

	const emailConfig = await getEmailConfig();

	const payload = {
		id: crypto.randomUUID(),
		to: recipients,
		subject: sanitizeString(String(subject || "Notification"), 200),
		text: sanitizeString(String(text || ""), 2000),
		html: html ? String(html) : "",
		created_at: new Date().toISOString(),
		status: "queued",
		error: "",
	};

	if (!emailConfig.enabled) {
		await logEmailToDb({
			to: recipients,
			subject: payload.subject,
			text: payload.text,
			html: payload.html,
			status: "logged_disabled",
			source,
		});
		logWarn("email_logged_disabled", { to: recipients, subject: payload.subject });
		return { ok: false, status: "logged_disabled" };
	}

	const provider = resolveProvider(emailConfig, pinnedProvider);
	if (provider === "smtp" || provider === "gmail") {
		const configured = provider === "gmail" ? isGmailAppPasswordConfigured() : isSmtpConfigured();
		if (!configured) {
			await logEmailToDb({
				to: recipients,
				subject: payload.subject,
				text: payload.text,
				html: payload.html,
				status: provider === "gmail" ? "logged_no_gmail" : "logged_no_smtp",
				source,
			});
			logWarn(
				provider === "gmail" ? "email_logged_no_gmail" : "email_logged_no_smtp",
				{ to: recipients, subject: payload.subject },
			);
			return { ok: false, status: provider === "gmail" ? "logged_no_gmail" : "logged_no_smtp" };
		}
	} else if (provider === "gmail_api") {
		if (!isGmailConfigured()) {
			await logEmailToDb({
				to: recipients,
				subject: payload.subject,
				text: payload.text,
				html: payload.html,
				status: "logged_no_gmail",
				source,
			});
			logWarn("email_logged_no_gmail", { to: recipients, subject: payload.subject });
			return { ok: false, status: "logged_no_gmail" };
		}
	} else {
		await logEmailToDb({
			to: recipients,
			subject: payload.subject,
			text: payload.text,
			html: payload.html,
			status: "logged_unsupported",
			source,
		});
		logWarn("email_logged_unsupported", { to: recipients, subject: payload.subject });
		return { ok: false, status: "logged_unsupported" };
	}

	try {
		const fromName = emailConfig.from_name || "GarTexHub";
		const isGmail = provider === "gmail";
		const fromEmail =
			emailConfig.from_email ||
			(isGmail
				? process.env.GMAIL_SENDER || process.env.GMAIL_USER
				: process.env.SMTP_FROM || process.env.SMTP_USER) ||
			process.env.GMAIL_SENDER ||
			"noreply@gartexhub.local";

		if (provider === "smtp" || provider === "gmail") {
			const nodemailer = await import("nodemailer");
			// The Gmail transport has its OWN settings and its OWN credentials.
			// It must not fall back to SMTP_HOST or SMTP_USER: those belong to
			// the other transport, and a fallback would send "Gmail" mail
			// through a different provider and call it a day.
			const host = isGmail
				? process.env.GMAIL_SMTP_HOST || "smtp.gmail.com"
				: process.env.SMTP_HOST;
			const port = Number(
				isGmail ? process.env.GMAIL_SMTP_PORT || 465 : process.env.SMTP_PORT || 587,
			);
			const secure = isGmail
				? String(process.env.GMAIL_SMTP_SECURE || "").toLowerCase() === "true" || port === 465
				: String(process.env.SMTP_SECURE || "").toLowerCase() === "true" || port === 465;
			const user = isGmail ? process.env.GMAIL_USER || "" : process.env.SMTP_USER;
			const pass = isGmail
				? process.env.GMAIL_APP_PASSWORD || ""
				: process.env.SMTP_PASS || "";
			const transport = nodemailer.createTransport({
				host,
				port,
				secure,
				auth: {
					user,
					pass,
				},
			});

			await transport.sendMail({
				from: `${fromName} <${fromEmail}>`,
				to: recipients.join(","),
				subject: payload.subject,
				text: payload.text,
				html: payload.html || undefined,
			});
		}

		if (provider === "gmail_api") {
			const { google } = await import("googleapis");
			const oauth2Client = new google.auth.OAuth2(
				process.env.GMAIL_CLIENT_ID,
				process.env.GMAIL_CLIENT_SECRET,
			);
			oauth2Client.setCredentials({
				refresh_token: process.env.GMAIL_REFRESH_TOKEN,
			});
			const gmail = google.gmail({ version: "v1", auth: oauth2Client });
			const messageLines = [
				`From: ${fromName} <${fromEmail}>`,
				`To: ${recipients.join(",")}`,
				`Subject: ${payload.subject}`,
				"MIME-Version: 1.0",
				payload.html
					? "Content-Type: text/html; charset=UTF-8"
					: "Content-Type: text/plain; charset=UTF-8",
				"",
				payload.html ? payload.html : payload.text,
			];
			const message = messageLines.join("\r\n");
			const encodedMessage = Buffer.from(message)
				.toString("base64")
				.replace(/\+/g, "-")
				.replace(/\//g, "_")
				.replace(/[=]+$/, "");
			await gmail.users.messages.send({
				userId: process.env.GMAIL_SENDER,
				requestBody: { raw: encodedMessage },
			});
		}

		await queueEmail({ ...payload, status: "sent" });
		await logEmailToDb({
			to: recipients,
			subject: payload.subject,
			text: payload.text,
			html: payload.html,
			status: "sent",
			source,
		});
		logInfo("email_sent", { to: recipients });
		return { ok: true, status: "sent" };
	} catch (error) {
		const message = error?.message || "smtp_error";
		await queueEmail({ ...payload, status: "failed", error: message });
		await logEmailToDb({
			to: recipients,
			subject: payload.subject,
			text: payload.text,
			html: payload.html,
			status: "failed",
			source,
			error: message,
		});
		logError("email_send_failed", error);
		return { ok: false, status: "failed", error: message };
	}
}
