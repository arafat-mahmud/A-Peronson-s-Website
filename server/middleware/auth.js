import jwt from "jsonwebtoken";
import {
	findActiveSession,
	normalizeSessionDuration,
	touchSession,
} from "../services/sessionService.js";
import { findUserById } from "../services/userService.js";
import { cachedSession, cachedUser } from "../utils/authCache.js";
import { logWarn } from "../utils/logger.js";
import { deny, hasRole } from "../utils/permissions.js";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
	throw new Error(
		"FATAL: JWT_SECRET environment variable is not set. A secure JWT_SECRET is required.",
	);
}
const JWT_ISSUER = process.env.JWT_ISSUER || "gartexhub-api";
const JWT_AUDIENCE = process.env.JWT_AUDIENCE || "gartexhub-client";

export function signToken(user, options = {}) {
	const payload = {
		id: user.id,
		role: user.role,
		email: user.email,
		org_owner_id: user.org_owner_id || "",
		member_id: user.member_id || "",
		auth_via_passkey: Boolean(options.authViaPasskey),
		passkey_verified_at: options.authViaPasskey ? new Date().toISOString() : "",
		...(options.sessionId ? { sid: String(options.sessionId) } : {}),
	};

	const tokenOptions = {
		issuer: JWT_ISSUER,
		audience: JWT_AUDIENCE,
		subject: user.id,
	};

	// Only the session lengths offered at login. A string such as "7d" used to
	// skip both branches here, so those tokens were issued with no expiry.
	tokenOptions.expiresIn = normalizeSessionDuration(options.expiresIn);

	return jwt.sign(payload, JWT_SECRET, tokenOptions);
}

/** The user and session behind a verified token (cached briefly; writes invalidate it). */
function loadAuthRows(claims) {
	return Promise.all([
		cachedUser(claims.id, () => findUserById(claims.id)),
		claims.sid
			? cachedSession(claims.sid, () => findActiveSession(claims.sid, claims.id)).then((session) =>
					// The cache holds the row; expiry and ownership are re-checked every time.
					session &&
					session.user_id === String(claims.id) &&
					!session.revoked_at &&
					new Date(session.expires_at).getTime() > Date.now()
						? session
						: null,
				)
			: null,
	]);
}

/**
 * A database that is slow or down is NOT a bad token. Answering 401 there
 * made the browser throw away a perfectly valid session ("Invalid token")
 * whenever the API was struggling; 503 tells it to retry instead.
 */
function backendUnavailable(res, error) {
	logWarn("auth_backend_unavailable", {
		name: error?.name,
		code: error?.code,
		message: String(error?.message || "").slice(0, 200),
	});
	res.set("Retry-After", "3");
	return res.status(503).json({
		error: "Service temporarily unavailable. Please try again.",
		code: "AUTH_BACKEND_UNAVAILABLE",
	});
}

export async function requireAuth(req, res, next) {
	const authHeader = req.headers.authorization || "";
	const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
	if (!token) {
		return res.status(401).json({ error: "Unauthorized" });
	}

	try {
		req.user = jwt.verify(token, JWT_SECRET, {
			issuer: JWT_ISSUER,
			audience: JWT_AUDIENCE,
		});
	} catch {
		return res.status(401).json({ error: "Invalid token", code: "INVALID_TOKEN" });
	}

	let user;
	let session;
	try {
		[user, session] = await loadAuthRows(req.user);
	} catch (error) {
		return backendUnavailable(res, error);
	}

	if (!user) {
		return res.status(401).json({ error: "Invalid token", code: "INVALID_TOKEN" });
	}
	// The row this request was authenticated with; handlers that only need the
	// current user read it here instead of querying for it again.
	req.authUser = user;
	// A token tied to a session dies with it (logout, revoke, password reset).
	if (req.user.sid && !session) {
		return res.status(401).json({ error: "Session expired" });
	}
	touchSession(session);
	if (user.password_reset_at) {
		const tokenIssuedAt = Number(req.user.iat || 0) * 1000;
		const resetAt = new Date(user.password_reset_at).getTime();
		if (Number.isFinite(resetAt) && tokenIssuedAt && tokenIssuedAt < resetAt) {
			return res.status(401).json({ error: "Session expired" });
		}
	}
	if (user.status === "locked") {
		const allowedWhileLocked = [
			{ method: "DELETE", path: "/api/users/me/lock" },
			{ method: "POST", path: "/api/auth/logout" },
		];
		// Full path: inside a router (mounted at /api/users) req.path is only
		// "/me/lock", so comparing it with "/api/users/me/lock" never matched and
		// a locked account could not unlock itself.
		const fullPath = req.originalUrl
			? String(req.originalUrl).split("?")[0]
			: `${req.baseUrl || ""}${req.path || ""}`;
		const isAllowed = allowedWhileLocked.some(
			(r) => r.method === req.method && fullPath.startsWith(r.path),
		);
		if (!isAllowed) {
			return res.status(403).json({
				error: "Account locked",
				code: "ACCOUNT_LOCKED",
				message: "Your account is currently locked. Unlock it to regain access.",
			});
		}
	}
	return next();
}

export async function optionalAuth(req, _res, next) {
	// Allows endpoints to accept both authenticated and anonymous requests.
	// If a JWT is provided and valid, we populate `req.user`. Otherwise we continue with `req.user = null`.
	const authHeader = req.headers.authorization || "";
	const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

	if (!token) {
		req.user = null;
		return next();
	}

	try {
		req.user = jwt.verify(token, JWT_SECRET, {
			issuer: JWT_ISSUER,
			audience: JWT_AUDIENCE,
		});
		const [user, session] = await loadAuthRows(req.user);
		if (req.user.sid && !session) {
			req.user = null;
			return next();
		}
		if (user?.password_reset_at) {
			const tokenIssuedAt = Number(req.user.iat || 0) * 1000;
			const resetAt = new Date(user.password_reset_at).getTime();
			if (Number.isFinite(resetAt) && tokenIssuedAt && tokenIssuedAt < resetAt) {
				req.user = null;
			}
		}
	} catch {
		req.user = null;
	}

	return next();
}

export function allowRoles(...roles) {
	return (req, res, next) => {
		if (!(req.user && hasRole(req.user, ...roles))) {
			return deny(res);
		}
		return next();
	};
}
