import crypto from "node:crypto";
import prisma from "../utils/prisma.js";

// Server-side record of every sign-in. A token carries its session id
// (`sid`); requireAuth rejects a token whose session was revoked or expired,
// which is what makes "log out", "log out other devices" and a password reset
// actually end access. Tokens issued before sessions existed have no `sid`
// and keep working until they expire.

const DURATIONS_MS = {
	"12h": 12 * 60 * 60 * 1000,
	"24h": 24 * 60 * 60 * 1000,
	"7d": 7 * 24 * 60 * 60 * 1000,
	"30d": 30 * 24 * 60 * 60 * 1000,
};
export const DEFAULT_SESSION_DURATION = "12h";
const TOUCH_INTERVAL_MS = 5 * 60 * 1000;

/** Only the durations offered on the login form; anything else is 12h. */
export function normalizeSessionDuration(value) {
	return Object.hasOwn(DURATIONS_MS, value) ? value : DEFAULT_SESSION_DURATION;
}

function clientIp(req) {
	const forwarded = String(req?.headers?.["x-forwarded-for"] || "")
		.split(",")[0]
		.trim();
	return (forwarded || req?.ip || req?.socket?.remoteAddress || "").slice(0, 64);
}

/** "Chrome on macOS"-style label from a User-Agent header. */
export function describeUserAgent(userAgent = "") {
	const ua = String(userAgent);
	const browser = /Edg\//.test(ua)
		? "Edge"
		: /OPR\//.test(ua)
			? "Opera"
			: /Chrome\//.test(ua)
				? "Chrome"
				: /Firefox\//.test(ua)
					? "Firefox"
					: /Safari\//.test(ua)
						? "Safari"
						: "Browser";
	const os = /Android/.test(ua)
		? "Android"
		: /iPhone|iPad|iOS/.test(ua)
			? "iOS"
			: /Windows/.test(ua)
				? "Windows"
				: /Mac OS X|Macintosh/.test(ua)
					? "macOS"
					: /Linux/.test(ua)
						? "Linux"
						: "";
	return os ? `${browser} on ${os}` : browser;
}

export async function createSession(
	userId,
	req,
	{ duration = DEFAULT_SESSION_DURATION, method = "password" } = {},
) {
	const now = new Date();
	const key = normalizeSessionDuration(duration);
	const session = await prisma.userSession.create({
		data: {
			id: crypto.randomUUID(),
			user_id: String(userId),
			created_at: now,
			last_seen_at: now,
			expires_at: new Date(now.getTime() + DURATIONS_MS[key]),
			ip: clientIp(req),
			user_agent: String(req?.headers?.["user-agent"] || "").slice(0, 255),
			auth_method: method,
		},
	});
	return { id: session.id, duration: key };
}

/** Extends a session on token refresh (same session, new expiry). */
export async function extendSession(sessionId, duration = DEFAULT_SESSION_DURATION) {
	const key = normalizeSessionDuration(duration);
	await prisma.userSession.updateMany({
		where: { id: String(sessionId), revoked_at: null },
		data: { expires_at: new Date(Date.now() + DURATIONS_MS[key]), last_seen_at: new Date() },
	});
	return key;
}

export async function findActiveSession(sessionId, userId) {
	const session = await prisma.userSession.findUnique({ where: { id: String(sessionId) } });
	if (!session || session.user_id !== String(userId) || session.revoked_at) return null;
	if (new Date(session.expires_at).getTime() <= Date.now()) return null;
	return session;
}

/** Records activity at most every few minutes; never blocks the request. */
export function touchSession(session) {
	if (!session) return;
	if (Date.now() - new Date(session.last_seen_at).getTime() < TOUCH_INTERVAL_MS) return;
	prisma.userSession
		.update({ where: { id: session.id }, data: { last_seen_at: new Date() } })
		.catch(() => {});
}

export async function listSessions(userId, currentSessionId = "") {
	const rows = await prisma.userSession.findMany({
		where: { user_id: String(userId), revoked_at: null, expires_at: { gt: new Date() } },
		orderBy: { last_seen_at: "desc" },
		take: 50,
	});
	return rows.map((row) => ({
		id: row.id,
		current: row.id === currentSessionId,
		device: describeUserAgent(row.user_agent),
		ip: row.ip || "",
		auth_method: row.auth_method || "password",
		created_at: row.created_at,
		last_active: row.last_seen_at,
		expires_at: row.expires_at,
	}));
}

export async function revokeSession(userId, sessionId) {
	const result = await prisma.userSession.updateMany({
		where: { id: String(sessionId), user_id: String(userId), revoked_at: null },
		data: { revoked_at: new Date() },
	});
	return result.count > 0;
}

export async function revokeAllSessions(userId, { exceptId = "" } = {}) {
	const result = await prisma.userSession.updateMany({
		where: {
			user_id: String(userId),
			revoked_at: null,
			...(exceptId ? { NOT: { id: String(exceptId) } } : {}),
		},
		data: { revoked_at: new Date() },
	});
	return result.count;
}
