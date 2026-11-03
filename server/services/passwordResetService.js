import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { passwordProblems } from "../../shared/config/passwordPolicy.js";
import { logWarn } from "../utils/logger.js";
import prisma from "../utils/prisma.js";
import { sendEmail } from "./emailService.js";
import { revokeAllSessions } from "./sessionService.js";
import { findUserByEmail, findUserById } from "./userService.js";

// Self-service password reset.
// - The emailed token is 32 random bytes; only its SHA-256 is stored.
// - It expires after RESET_TTL_MINUTES and works once.
// - The request endpoint answers the same way whether or not the email has
//   an account (no account enumeration), and sends at most one email a minute.
// - A completed reset revokes every session and every older token.

export const RESET_TTL_MINUTES = 30;
const RESEND_COOLDOWN_MS = 60 * 1000;
const INVALID_LINK = "This reset link is invalid or has expired. Request a new one.";

function hashToken(token) {
	return crypto.createHash("sha256").update(String(token)).digest("hex");
}

function appBaseUrl() {
	for (const candidate of [process.env.RENDER_EXTERNAL_URL, process.env.APP_BASE_URL]) {
		const value = String(candidate || "")
			.trim()
			.replace(/\/+$/, "");
		if (value) return /^https?:\/\//i.test(value) ? value : `https://${value}`;
	}
	return `http://localhost:${process.env.PORT || 4000}`;
}

function resetEmail(link) {
	const text = [
		"We received a request to reset your GarTexHub password.",
		"",
		`Open this link within ${RESET_TTL_MINUTES} minutes to choose a new password:`,
		link,
		"",
		"If you did not ask for this, ignore this email - your password stays the same.",
	].join("\n");
	const html = `<p>We received a request to reset your GarTexHub password.</p>
<p><a href="${link}">Choose a new password</a> (the link works once and expires in ${RESET_TTL_MINUTES} minutes).</p>
<p>If you did not ask for this, ignore this email - your password stays the same.</p>`;
	return { text, html };
}

/** Always resolves; never reveals whether the email belongs to an account. */
export async function requestPasswordReset(email) {
	const user = await findUserByEmail(String(email || "").trim());
	if (!user || String(user.status || "").toLowerCase() === "deleted") return;

	const recent = await prisma.passwordResetToken.findFirst({
		where: { user_id: user.id, created_at: { gt: new Date(Date.now() - RESEND_COOLDOWN_MS) } },
	});
	if (recent) return;

	const token = crypto.randomBytes(32).toString("base64url");
	const now = new Date();
	await prisma.passwordResetToken.updateMany({
		where: { user_id: user.id, used_at: null },
		data: { used_at: now },
	});
	await prisma.passwordResetToken.create({
		data: {
			id: crypto.randomUUID(),
			user_id: user.id,
			token_hash: hashToken(token),
			expires_at: new Date(now.getTime() + RESET_TTL_MINUTES * 60 * 1000),
			created_at: now,
		},
	});
	const link = `${appBaseUrl()}/reset-password?token=${encodeURIComponent(token)}`;
	const { text, html } = resetEmail(link);
	const result = await sendEmail({
		to: user.email,
		subject: "Reset your GarTexHub password",
		text,
		html,
		source: "password_reset",
	});
	if (!result?.ok) {
		logWarn("password_reset_email_not_sent", { status: result?.status || "unknown" });
	}
}

export async function resetPassword(token, newPassword) {
	const problems = passwordProblems(newPassword);
	if (problems.length > 0) {
		const error = new Error(`Password: ${problems.join(", ").toLowerCase()}.`);
		error.status = 400;
		throw error;
	}
	const invalid = () =>
		Object.assign(new Error(INVALID_LINK), { status: 400, code: "RESET_LINK_INVALID" });
	if (!token || String(token).length > 200) throw invalid();

	const row = await prisma.passwordResetToken.findUnique({
		where: { token_hash: hashToken(token) },
	});
	if (!row || row.used_at || new Date(row.expires_at).getTime() <= Date.now()) throw invalid();

	// Whole seconds: requireAuth compares token `iat` (seconds) with this, and a
	// login in the same second as the reset must not be rejected.
	const now = new Date(Math.floor(Date.now() / 1000) * 1000);
	// Claim the token first: of two concurrent requests only one can win.
	const claimed = await prisma.passwordResetToken.updateMany({
		where: { id: row.id, used_at: null },
		data: { used_at: now },
	});
	if (claimed.count !== 1) throw invalid();

	const passwordHash = await bcrypt.hash(String(newPassword), 10);
	await prisma.user.update({
		where: { id: row.user_id },
		data: { password_hash: passwordHash, password_reset_at: now },
	});
	await prisma.passwordResetToken.updateMany({
		where: { user_id: row.user_id, used_at: null },
		data: { used_at: now },
	});
	await revokeAllSessions(row.user_id);
	return { userId: row.user_id };
}

// Signed-in password change (Settings -> Security). Requires the current
// password; keeps the caller's session and signs out every other one.
export async function changePassword(
	userId,
	currentPassword,
	newPassword,
	{ keepSessionId = "" } = {},
) {
	const user = await findUserById(userId);
	const matches = user?.password_hash
		? await bcrypt.compare(String(currentPassword || ""), user.password_hash)
		: false;
	if (!matches) {
		throw Object.assign(new Error("Current password is incorrect."), {
			status: 400,
			code: "CURRENT_PASSWORD_INCORRECT",
		});
	}
	const problems = passwordProblems(newPassword);
	if (problems.length > 0) {
		throw Object.assign(new Error(`Password: ${problems.join(", ").toLowerCase()}.`), {
			status: 400,
		});
	}
	if (String(newPassword) === String(currentPassword)) {
		throw Object.assign(new Error("Choose a password different from the current one."), {
			status: 400,
		});
	}
	const passwordHash = await bcrypt.hash(String(newPassword), 10);
	await prisma.user.update({ where: { id: user.id }, data: { password_hash: passwordHash } });
	const revoked = await revokeAllSessions(user.id, { exceptId: keepSessionId });
	return { revokedSessions: revoked };
}
