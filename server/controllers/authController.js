import { signToken } from "../middleware/auth.js";
import { getEntitlements } from "../services/entitlementService.js";
import {
	createAuthenticationOptions,
	createRegistrationOptions,
	listUserPasskeys,
	removeUserPasskey,
	verifyAuthentication,
	verifyRegistration,
} from "../services/passkeyService.js";
import {
	findUserByEmail,
	findUserById,
	findUserByMemberId,
	registerUser,
	verifyPassword,
} from "../services/userService.js";
import { upsertSubscription } from "../services/subscriptionService.js";
import { assertCouponRedeemable, creditWallet } from "../services/walletService.js";
import { getAdminConfig } from "../services/adminConfigService.js";
import { changePassword, requestPasswordReset, resetPassword } from "../services/passwordResetService.js";
import {
	createSession,
	extendSession,
	listSessions,
	revokeAllSessions,
	revokeSession,
} from "../services/sessionService.js";
import { logError } from "../utils/logger.js";
import { passwordProblems } from "../../shared/config/passwordPolicy.js";
import {
	isValidFactorySector,
	normalizeCompanyFacts,
} from "../../shared/config/platformTaxonomy.js";
import { requireFields, validateEmail, validatePublicRole } from "../utils/validators.js";

function sanitizeUser(user) {
	if (!user) {
		return null;
	}
	const { password_hash: _passwordHash, passkeys, ...safe } = user;
	return {
		...safe,
		passkeys: Array.isArray(passkeys)
			? passkeys.map((key) => ({
					id: key.id,
					name: key.name || "",
					created_at: key.created_at || "",
					last_used_at: key.last_used_at || "",
					transports: Array.isArray(key.transports) ? key.transports : [],
				}))
			: [],
	};
}

export async function register(req, res) {
	const missing = requireFields(req.body, ["name", "email", "password", "role", "company_name"]);
	if (missing.length > 0) {
		return res.status(400).json({ error: `Missing fields: ${missing.join(", ")}` });
	}
	if (!validateEmail(req.body.email)) {
		return res.status(400).json({ error: "Invalid email" });
	}
	if (!validatePublicRole(req.body.role)) {
		return res.status(400).json({ error: "Invalid role" });
	}
	const weakPassword = passwordProblems(req.body.password);
	if (weakPassword.length > 0) {
		return res.status(400).json({ error: `Password: ${weakPassword.join(", ").toLowerCase()}.` });
	}
	if (!req.body.profile?.country) {
		return res.status(400).json({ error: "Missing field: country" });
	}
	if (!req.body.profile?.position) {
		return res.status(400).json({ error: "Missing field: position" });
	}
	if (req.body.role === "factory" && !req.body.profile?.factory_sector) {
		return res.status(400).json({ error: "Missing field: factory_sector" });
	}
	if (req.body.profile?.factory_sector && !isValidFactorySector(req.body.profile.factory_sector)) {
		return res.status(400).json({ error: "Invalid factory sector" });
	}
	if (req.body.profile?.industry && !isValidFactorySector(req.body.profile.industry)) {
		return res.status(400).json({ error: "Invalid industry" });
	}
	const companyFacts = normalizeCompanyFacts(req.body.profile || {});
	const factErrors = Object.values(companyFacts.errors);
	if (factErrors.length > 0) {
		return res.status(400).json({ error: factErrors[0], fields: companyFacts.errors });
	}

	const existing = await findUserByEmail(req.body.email);
	if (existing) {
		// BUG-038: Recovery path for orphaned users from incomplete registration.
		// If the user row exists but subscription setup didn't complete (cold-start timeout),
		// complete the missing setup and return success instead of 409.
		// Only the account's own password may resume it: without this check
		// anyone who knew the email of such an account received its token.
		const ownsAccount = await verifyPassword(existing, String(req.body.password || "")).catch(
			() => false,
		);
		if (!ownsAccount) {
			return res.status(409).json({ error: "Email already used" });
		}
		try {
			const prisma = (await import("../utils/prisma.js")).default;
			const hasSubscription = await prisma.subscription.findFirst({
				where: { user_id: existing.id },
			});
			if (!hasSubscription) {
				await upsertSubscription(existing.id, existing.subscription_status || "free", true, {
					actor_id: existing.id,
					source: "recovery",
					note: "orphan_recovery",
				});
				try {
					const config = await getAdminConfig();
					if (config?.feature_flags?.auto_credit !== false) {
						await creditWallet({
							userId: existing.id,
							amountUsd: 5,
							reason: "auto_credit",
							ref: `auto-credit-recovery:${existing.id}`,
							restricted: true,
							metadata: { source: "signup_recovery" },
						});
					}
				} catch {
					// non-blocking: auto-credit is best-effort
				}
				const session = await createSession(existing.id, req);
				const token = signToken(existing, { sessionId: session.id });
				const entitlements = await getEntitlements(existing);
				return res.status(200).json({
					user: { ...sanitizeUser(existing), entitlements },
					token,
					recovered: true,
				});
			}
		} catch {
			// If recovery infrastructure fails, fall through to 409
		}
		return res.status(409).json({ error: "Email already used" });
	}

	if (req.body?.coupon_code) {
		try {
			await assertCouponRedeemable(req.body.coupon_code);
		} catch (error) {
			return res
				.status(error.status || 400)
				.json({ error: error.message || "Invalid coupon code" });
		}
	}

	const user = await registerUser({
		...req.body,
		profile: { ...(req.body.profile || {}), ...companyFacts.value },
	});
	const session = await createSession(user.id, req);
	const token = signToken(user, { sessionId: session.id });
	const entitlements = await getEntitlements(user);
	return res.status(201).json({ user: { ...sanitizeUser(user), entitlements }, token });
}

export async function login(req, res) {
	// UX: login uses a single field on the client ("Email or Agent ID").
	// For backwards compatibility we still accept `email`, but the preferred field is `identifier`.
	const missing = requireFields(req.body, ["password"]);
	if (missing.length > 0) {
		return res.status(400).json({ error: `Missing fields: ${missing.join(", ")}` });
	}

	const identifierRaw = String(req.body?.identifier || req.body?.email || "").trim();
	if (!identifierRaw) {
		return res.status(400).json({ error: "Missing fields: identifier" });
	}

	// If identifier looks like an email -> normal user login. Otherwise -> agent login by `member_id`.
	const user = identifierRaw.includes("@")
		? await findUserByEmail(identifierRaw)
		: await findUserByMemberId(identifierRaw);
	if (!user) {
		return res.status(401).json({ error: "Invalid credentials" });
	}
	if (String(user.status || "").toLowerCase() === "deleted") {
		return res.status(403).json({ error: "Account deleted" });
	}

	const ok = await verifyPassword(user, req.body.password);
	if (!ok) {
		return res.status(401).json({ error: "Invalid credentials" });
	}

	const session = await createSession(user.id, req, { duration: req.body?.expiresIn });
	const token = signToken(user, {
		authViaPasskey: false,
		expiresIn: session.duration,
		sessionId: session.id,
	});
	const entitlements = await getEntitlements(user);
	return res.json({ user: { ...sanitizeUser(user), entitlements }, token });
}

export async function me(req, res) {
	const user = await findUserById(req.user.id);
	if (!user) {
		return res.status(404).json({ error: "User not found" });
	}
	const entitlements = await getEntitlements(user);
	return res.json({ user: { ...sanitizeUser(user), entitlements } });
}

export async function logout(req, res) {
	// The session row is what makes the token stop working server-side.
	if (req.user?.sid) {
		await revokeSession(req.user.id, req.user.sid);
	}
	return res.json({ ok: true });
}

export async function listMySessions(req, res) {
	const sessions = await listSessions(req.user.id, req.user.sid || "");
	return res.json({ sessions, current_session_tracked: Boolean(req.user.sid) });
}

export async function revokeMySession(req, res) {
	if (String(req.params.sessionId) === String(req.user.sid || "")) {
		return res.status(400).json({ error: "Use Logout to end the current session." });
	}
	const revoked = await revokeSession(req.user.id, req.params.sessionId);
	if (!revoked) {
		return res.status(404).json({ error: "Session not found" });
	}
	return res.json({ ok: true });
}

export async function revokeOtherSessions(req, res) {
	const count = await revokeAllSessions(req.user.id, { exceptId: req.user.sid || "" });
	return res.json({ ok: true, revoked: count });
}

export async function forgotPassword(req, res) {
	const email = String(req.body?.email || "").trim();
	if (!validateEmail(email)) {
		return res.status(400).json({ error: "Enter a valid email address." });
	}
	// Same answer and no waiting on the email either way: the response must not
	// reveal whether the address has an account.
	requestPasswordReset(email).catch((error) => logError("password_reset_request_failed", error));
	return res.json({
		ok: true,
		message: "If an account exists for that email, a reset link has been sent. It expires in 30 minutes.",
	});
}

export async function changeMyPassword(req, res) {
	const result = await changePassword(req.user.id, req.body?.current_password, req.body?.new_password, {
		keepSessionId: req.user.sid || "",
	});
	return res.json({ ok: true, message: "Password changed. Other devices were signed out.", ...result });
}

export async function completePasswordReset(req, res) {
	await resetPassword(req.body?.token, req.body?.password);
	return res.json({ ok: true, message: "Password updated. Sign in with your new password." });
}

// BUG-033: Token refresh endpoint - issues a new JWT if the current one is about to expire.
export async function refreshToken(req, res) {
	const user = await findUserById(req.user.id);
	if (!user) {
		return res.status(401).json({ error: "User not found" });
	}
	if (String(user.status || "").toLowerCase() === "deleted") {
		return res.status(403).json({ error: "Account deleted" });
	}
	if (user.status === "locked") {
		return res.status(403).json({ error: "Account locked", code: "ACCOUNT_LOCKED" });
	}
	// Same session, new expiry; a pre-session token is moved onto a session.
	let sessionId = req.user.sid || "";
	let duration;
	if (sessionId) {
		duration = await extendSession(sessionId);
	} else {
		const session = await createSession(user.id, req);
		sessionId = session.id;
		duration = session.duration;
	}
	const token = signToken(user, { sessionId, expiresIn: duration });
	const entitlements = await getEntitlements(user);
	return res.json({ user: { ...sanitizeUser(user), entitlements }, token });
}

export async function passkeyRegistrationOptions(req, res) {
	try {
		const { options } = await createRegistrationOptions({
			userId: req.user.id,
			req,
			rpName: process.env.PASSKEY_RP_NAME || "GartexHub",
		});
		return res.json({ options });
	} catch (err) {
		return res
			.status(err.status || 400)
			.json({ error: err.message || "Unable to create passkey options" });
	}
}

export async function passkeyRegistrationVerify(req, res) {
	try {
		const credential = req.body?.credential;
		if (!credential) {
			return res.status(400).json({ error: "Missing credential" });
		}
		const nickname = req.body?.nickname || "";
		const passkeys = await verifyRegistration({
			userId: req.user.id,
			req,
			credential,
			nickname,
		});
		return res.json({ passkeys });
	} catch (err) {
		return res
			.status(err.status || 400)
			.json({ error: err.message || "Passkey registration failed" });
	}
}

export async function passkeyLoginOptions(req, res) {
	try {
		const identifier = req.body?.identifier;
		const { options } = await createAuthenticationOptions({ identifier, req });
		return res.json({ options });
	} catch (err) {
		return res
			.status(err.status || 400)
			.json({ error: err.message || "Unable to create passkey options" });
	}
}

export async function passkeyLoginVerify(req, res) {
	try {
		const identifier = req.body?.identifier;
		const credential = req.body?.credential;
		const purpose = String(req.body?.purpose || "")
			.trim()
			.toLowerCase();
		if (!credential) {
			return res.status(400).json({ error: "Missing credential" });
		}
		const result = await verifyAuthentication({ identifier, req, credential });
		const user = result?.user;
		const passkey = result?.passkey || null;
		if (String(user.status || "").toLowerCase() === "deleted") {
			return res.status(403).json({ error: "Account deleted" });
		}
		if (purpose === "admin_security") {
			const role = String(user?.role || "").toLowerCase();
			if (!["owner", "admin"].includes(role)) {
				return res.status(403).json({
					error: "Only admin/owner accounts can use passkey for admin security.",
				});
			}
		}
		const expiresIn = req.body?.expiresIn || "12h";
		const session = await createSession(user.id, req, { duration: expiresIn, method: "passkey" });
		const token = signToken(user, {
			authViaPasskey: true,
			expiresIn: session.duration,
			sessionId: session.id,
		});
		const entitlements = await getEntitlements(user);
		return res.json({
			user: { ...sanitizeUser(user), entitlements },
			token,
			passkey,
		});
	} catch (err) {
		return res.status(err.status || 400).json({ error: err.message || "Passkey login failed" });
	}
}

export async function passkeyList(req, res) {
	try {
		const passkeys = await listUserPasskeys(req.user.id);
		return res.json({ passkeys });
	} catch (err) {
		return res.status(err.status || 400).json({ error: err.message || "Unable to load passkeys" });
	}
}

export async function passkeyRemove(req, res) {
	try {
		const credentialId = String(req.params.credentialId || "").trim();
		if (!credentialId) {
			return res.status(400).json({ error: "Missing credential id" });
		}
		const passkeys = await removeUserPasskey(req.user.id, credentialId);
		return res.json({ passkeys });
	} catch (err) {
		return res.status(err.status || 400).json({ error: err.message || "Unable to remove passkey" });
	}
}
