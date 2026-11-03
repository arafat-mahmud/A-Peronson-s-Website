import { getAdminAuthConfig } from "../services/securityService.js";
import { logInfo, logWarn } from "../utils/logger.js";
import { deny, hasRole } from "../utils/permissions.js";

function normalizeIp(ip = "") {
	const value = String(ip || "").trim();
	if (!value) {
		return "";
	}
	if (value.startsWith("::ffff:")) {
		return value.replace("::ffff:", "");
	}
	return value;
}

function isAllowedIp(req, allowlist) {
	if (!allowlist || allowlist === "*") {
		return true;
	}
	const clientIp = normalizeIp(req.ip);
	if (!clientIp) {
		return false;
	}
	const entries = String(allowlist)
		.split(",")
		.map((e) => e.trim())
		.filter(Boolean);
	for (const entry of entries) {
		if (entry === "*") {
			return true;
		}
		if (entry === clientIp) {
			return true;
		}
		if (entry.includes("/")) {
			const [rangeIp, bitsStr] = entry.split("/");
			const bits = Number.parseInt(bitsStr, 10);
			if (!Number.isNaN(bits) && bits >= 0 && bits <= 32) {
				const ipLong = ip4ToLong(clientIp);
				const rangeLong = ip4ToLong(rangeIp);
				if (ipLong !== null && rangeLong !== null) {
					const mask = ~0 << (32 - bits);
					if ((ipLong & mask) === (rangeLong & mask)) {
						return true;
					}
				}
			}
		}
	}
	return false;
}

function ip4ToLong(ip) {
	const parts = String(ip).trim().split(".");
	if (parts.length !== 4) {
		return null;
	}
	const nums = parts.map(Number);
	if (nums.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
		return null;
	}
	return ((nums[0] << 24) | (nums[1] << 16) | (nums[2] << 8) | nums[3]) >>> 0;
}

function isAllowedDevice(req, allowlist) {
	if (!allowlist || allowlist === "*") {
		return true;
	}
	const deviceId = String(req.headers["x-device-id"] || req.headers["user-agent"] || "").trim();
	if (!deviceId) {
		return false;
	}
	const entries = String(allowlist)
		.split(",")
		.map((e) => e.trim())
		.filter(Boolean);
	return entries.some((entry) => entry === "*" || entry === deviceId);
}

export async function requireAdminSecurity(req, res, next) {
	const u = req.user;
	logInfo("adminSecurity check", { userId: u?.id, role: u?.role, ip: req.ip });

	if (!(req.user && hasRole(req.user, "owner", "admin"))) {
		logWarn("adminSecurity DENY: no user or wrong role", { role: req.user?.role });
		return deny(res);
	}

	const authConfig = await getAdminAuthConfig();

	// DEV MODE: Allow localhost/local network without further checks
	const clientIp = normalizeIp(req.ip);
	logInfo("adminSecurity clientIp", { clientIp });
	if (
		clientIp === "127.0.0.1" ||
		clientIp === "::1" ||
		clientIp.startsWith("192.168.") ||
		clientIp.startsWith("10.")
	) {
		logInfo("adminSecurity ALLOW: localhost");
		return next();
	}

	// Allow both owner and admin roles through without owner allowlist requirement
	logInfo("adminSecurity not localhost, checking role");
	if (hasRole(req.user, "owner", "admin")) {
		logInfo("adminSecurity ALLOW: owner/admin role");
		return next();
	}

	// 1. IP Check (Always required if configured)
	if (!isAllowedIp(req, authConfig.ip_allowlist)) {
		return res.status(403).json({ error: "Admin access denied from this IP." });
	}

	// 2. OR Logic: Any of these satisfy the security requirement
	const passkeyLogin = Boolean(req.user?.auth_via_passkey);
	const hasPasskeyHeader =
		Array.isArray(authConfig.passkeys) &&
		authConfig.passkeys.length > 0 &&
		authConfig.passkeys.includes(String(req.headers["x-admin-passkey"] || "").trim());

	const requiredMfa = String(authConfig.mfa_code || "").trim();
	const hasValidMfa =
		requiredMfa && String(req.headers["x-admin-mfa"] || "").trim() === requiredMfa;

	const stepUpCode = String(process.env.ADMIN_STEPUP_CODE || "").trim();
	const hasValidStepUp =
		stepUpCode && String(req.headers["x-admin-stepup"] || "").trim() === stepUpCode;

	const isApprovedDevice = isAllowedDevice(req, authConfig.device_allowlist);

	// If the device is already on the allowlist AND no MFA/StepUp is globally enforced, allow.
	// Otherwise, require at least one proof of identity.
	const anyProofProvided = passkeyLogin || hasPasskeyHeader || hasValidMfa || hasValidStepUp;

	if (isApprovedDevice || anyProofProvided) {
		return next();
	}

	return res.status(403).json({
		error: "Admin security verification required. Use MFA, Passkey, or Setup code to unlock.",
	});
}
