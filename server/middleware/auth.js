import jwt from "jsonwebtoken";
import {
	findActiveSession,
	normalizeSessionDuration,
	touchSession,
} from "../services/sessionService.js";
import { findUserById } from "../services/userService.js";
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
		const [user, session] = await Promise.all([
			findUserById(req.user.id),
			req.user.sid ? findActiveSession(req.user.sid, req.user.id) : null,
		]);
		if (!user) {
			return res.status(401).json({ error: "Invalid token" });
		}
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
			const isAllowed = allowedWhileLocked.some(
				(r) => r.method === req.method && req.path.startsWith(r.path),
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
	} catch {
		return res.status(401).json({ error: "Invalid token" });
	}
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
		const [user, session] = await Promise.all([
			findUserById(req.user.id),
			req.user.sid ? findActiveSession(req.user.sid, req.user.id) : null,
		]);
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
