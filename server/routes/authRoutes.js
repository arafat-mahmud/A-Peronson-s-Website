import { Router } from "express";
import {
	changeMyPassword,
	completePasswordReset,
	forgotPassword,
	listMySessions,
	login,
	logout,
	me,
	passkeyList,
	passkeyLoginOptions,
	passkeyLoginVerify,
	passkeyRegistrationOptions,
	passkeyRegistrationVerify,
	passkeyRemove,
	refreshToken,
	register,
	revokeMySession,
	revokeOtherSessions,
} from "../controllers/authController.js";
import { requireAuth } from "../middleware/auth.js";
import { authLimiter, passkeyLimiter } from "../middleware/rateLimiter.js";

const router = Router();

router.post("/register", authLimiter, register);
router.post("/login", authLimiter, login);
router.post("/refresh", requireAuth, refreshToken);
router.post("/passkey/login/options", passkeyLimiter, passkeyLoginOptions);
router.post("/passkey/login/verify", passkeyLimiter, passkeyLoginVerify);
router.post("/passkey/registration/options", requireAuth, passkeyRegistrationOptions);
router.post("/passkey/registration/verify", requireAuth, passkeyRegistrationVerify);
router.get("/passkeys", requireAuth, passkeyList);
router.delete("/passkeys/:credentialId", requireAuth, passkeyRemove);
router.get("/me", requireAuth, me);
router.post("/logout", requireAuth, logout);
router.get("/sessions", requireAuth, listMySessions);
router.delete("/sessions/:sessionId", requireAuth, revokeMySession);
router.post("/sessions/revoke-others", requireAuth, revokeOtherSessions);
router.put("/password", requireAuth, authLimiter, changeMyPassword);
router.post("/password/forgot", authLimiter, forgotPassword);
router.post("/password/reset", authLimiter, completePasswordReset);

export default router;
