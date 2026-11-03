import "./utils/dotenv.js";
import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import jwt from "jsonwebtoken";
import { WebSocketServer } from "ws";
import { answerFaq, formatFaqAnswer } from "../shared/assistant/faqEngine.js";
import { logHub } from "./log/logHub.js";
import { registerLogHttp, startLogTransport } from "./log/transport.js";
import viewerRouter from "./log/viewer/router.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { requestCapture } from "./middleware/requestCapture.js";
import { requestLogger } from "./middleware/requestLogger.js";
import { REALTIME_EVENTS, realtimeBus } from "./realtime/realtimeBus.js";
import adminConfigRoutes from "./routes/adminConfigRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import agentSubIdRoutes from "./routes/agentSubIdRoutes.js";
import aiRoutes from "./routes/aiRoutes.js";
import analyticsRoutes from "./routes/analyticsRoutes.js";
import assistantRoutes from "./routes/assistantRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import boostRoutes from "./routes/boostRoutes.js";
import callSessionRoutes from "./routes/callSessionRoutes.js";
import caseRoutes from "./routes/caseRoutes.js";
import certificationRoutes from "./routes/certificationRoutes.js";
import chatbotRoutes from "./routes/chatbotRoutes.js";
import conversationRoutes from "./routes/conversationRoutes.js";
import couponRoutes from "./routes/couponRoutes.js";
import crmRoutes from "./routes/crmRoutes.js";
import dealJourneyRoutes from "./routes/dealJourneyRoutes.js";
import devRoutes from "./routes/devRoutes.js";
import diagnosticsRoutes from "./routes/diagnosticsRoutes.js";
import documentRoutes from "./routes/documentRoutes.js";
import eventRoutes from "./routes/eventRoutes.js";
import exportRoutes from "./routes/exportRoutes.js";
import feedRoutes from "./routes/feedRoutes.js";
import fileAccessRoutes from "./routes/fileAccessRoutes.js";
import geoRoutes from "./routes/geoRoutes.js";
import industryRoutes from "./routes/industryRoutes.js";
import infraRoutes from "./routes/infraRoutes.js";
import joinRequestRoutes from "./routes/joinRequestRoutes.js";
import leadRoutes from "./routes/leadRoutes.js";
import linkPreviewRoutes from "./routes/linkPreviewRoutes.js";
import logRoutes from "./routes/logRoutes.js";
import memberRoutes from "./routes/memberRoutes.js";
import messageRoutes from "./routes/messageRoutes.js";
import networkRoutes from "./routes/networkRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import onboardingRoutes from "./routes/onboardingRoutes.js";
import orgRoutes from "./routes/orgRoutes.js";
import partnerNetworkRoutes from "./routes/partnerNetworkRoutes.js";
import paymentProofRoutes from "./routes/paymentProofRoutes.js";
import presenceRoutes from "./routes/presenceRoutes.js";
import presetsRoutes from "./routes/presetsRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import profileRoutes from "./routes/profileRoutes.js";
import qdrantRoutes from "./routes/qdrantRoutes.js";
import ratingsRoutes from "./routes/ratingsRoutes.js";
import reportRoutes from "./routes/reportRoutes.js";
import requirementRoutes from "./routes/requirementRoutes.js";
import searchRoutes from "./routes/searchRoutes.js";
import seoRoutes from "./routes/seoRoutes.js";
import socialRoutes from "./routes/socialRoutes.js";
import subscriptionRoutes from "./routes/subscriptionRoutes.js";
import supportRoutes from "./routes/supportRoutes.js";
import syncRoutes from "./routes/syncRoutes.js";
import systemRoutes from "./routes/systemRoutes.js";
import uploadsRoutes from "./routes/uploadsRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import verificationRoutes from "./routes/verificationRoutes.js";
import walletRoutes from "./routes/walletRoutes.js";
import workflowLifecycleRoutes from "./routes/workflowLifecycleRoutes.js";
import {
	initAllUserSessions,
	initOpencodeServer,
	streamOpencodeReply,
} from "./services/assistantService.js";
import { getCallSession } from "./services/callSessionService.js";
import { maybeGenerateBotReply } from "./services/chatbotService.js";
import { runJoinRequestReminderSweep } from "./services/companyJoinService.js";
import { refreshRates } from "./services/currencyService.js";
import { startEsignWebhookRetryWorker } from "./services/esignRetryService.js";
import { startEventQualityReporter } from "./services/eventIngestionService.js";
import { runLeadReminderSweep } from "./services/leadReminderService.js";
import { canAccessMatch, listMessagesByMatch, postMessage } from "./services/messageService.js";
import { startOpenSearchHeartbeat } from "./services/openSearchService.js";
import { enforcePartnerFreeTierLimits } from "./services/partnerNetworkService.js";
import { setUserOffline, setUserOnline, touchUser } from "./services/presenceService.js";
import { startSyslogServer } from "./services/syslogServer.js";
import { revokeExpiredVerifications } from "./services/verificationService.js";
import { recordWorkflowEvent } from "./services/workflowLifecycleService.js";
import {
	installCrashHandlers,
	recordFatalAndExit,
	setSubsystemState,
	startMemoryMonitor,
} from "./utils/crashReporter.js";
import {
	closeDatabaseConnection,
	ensureDatabaseConnection,
	isDatabaseConnected,
	startDbHeartbeat,
} from "./utils/db.js";
import { findMissingEnvVars } from "./utils/envValidation.js";
import { createGatedStaticGuard } from "./utils/gatedStaticGuard.js";
import { logError, logInfo, logWarn } from "./utils/logger.js";
import { consumePendingInvites, enqueuePendingInvites } from "./utils/pendingInvites.js";
import prisma from "./utils/prisma.js";
import { closeRedis, initRedis } from "./utils/redis.js";
import { startCaseRetentionWorker } from "./workers/caseRetentionWorker.js";

const RECOMMENDED_ENV_VARS = [
	"REDIS_URL",
	"ADMIN_EMAIL",
	"ADMIN_TEST_EMAIL",
	"ALLOWED_WS_ORIGINS",
	"OPENAI_API_KEY",
	"VITE_API_PROXY",
];

function validateRequiredEnvVars() {
	const missing = findMissingEnvVars();
	if (missing.length > 0) {
		logError("Missing required environment variables", {
			missing: missing.join(", "),
		});
		process.exit(1);
	}
	const missingRecommended = RECOMMENDED_ENV_VARS.filter((name) => !process.env[name]);
	if (missingRecommended.length > 0) {
		logInfo("Missing recommended environment variables (using defaults)", {
			missing: missingRecommended.join(", "),
		});
	}
}

// Fatal errors are captured from here on; gracefulShutdown is a hoisted
// function declaration further down.
installCrashHandlers({
	shutdown: (reason, exitCode) => gracefulShutdown(reason, exitCode),
	logWarn,
});

validateRequiredEnvVars();

const app = express();
const PORT = process.env.PORT || 4000;

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Auto-launch the log TUI when the server comes up ──────────────────────
// Opens the live log dashboard in a fresh terminal window once the HTTP
// server is listening. Disable with LOG_TUI_AUTO=0 (or LOG_QUIET=1).
// In production (NODE_ENV=production) it stays off unless LOG_TUI_AUTO=1.
function maybeAutoLaunchLogTui() {
	const flag = String(process.env.LOG_TUI_AUTO || "").toLowerCase();
	const forceOff = ["0", "false", "off"].includes(flag);
	const forceOn = ["1", "true", "on"].includes(flag);
	if (forceOff || process.env.LOG_QUIET) {
		return;
	}
	if (!forceOn && process.env.NODE_ENV === "production") {
		return;
	}
	const tuiPath = path.join(__dirname, "tui", "index.js");
	if (!fs.existsSync(tuiPath)) {
		return;
	}
	const url = `ws://localhost:${PORT}/ws/logs`;
	const env = { ...process.env, LOG_WS_URL: url };
	const root = path.join(__dirname, "..");
	try {
		if (process.platform === "win32") {
			const batPath = path.join(os.tmpdir(), "gartex-log-tui.cmd");
			const bat = [
				"@echo off",
				"mode con cols=220 lines=55 >nul 2>&1",
				`cd /d "${root}"`,
				`set LOG_WS_URL=${url}`,
				`node "${tuiPath}"`,
				"",
			].join("\r\n");
			fs.writeFileSync(batPath, bat);
			spawn("cmd.exe", ["/c", "start", '""', "cmd", "/k", batPath], {
				cwd: root,
				env,
				detached: true,
				stdio: "ignore",
			}).unref();
		} else if (process.platform === "darwin") {
			const script = `cd ${JSON.stringify(root)} && LOG_WS_URL=${url} node ${JSON.stringify(tuiPath)}`;
			spawn("osascript", ["-e", `tell app "Terminal" to do script ${JSON.stringify(script)}`], {
				detached: true,
				stdio: "ignore",
			}).unref();
		} else {
			const terminals = ["x-terminal-emulator", "gnome-terminal", "konsole", "xfce4-terminal"];
			const term = terminals.find(
				(t) => fs.existsSync(`/usr/bin/${t}`) || fs.existsSync(`/bin/${t}`),
			);
			if (term) {
				spawn(term, ["-e", "bash", "-lc", `node ${JSON.stringify(tuiPath)}`], {
					cwd: root,
					env,
					detached: true,
					stdio: "ignore",
				}).unref();
			} else {
				spawn("node", [tuiPath], { cwd: root, env, detached: true, stdio: "ignore" }).unref();
			}
		}
		logInfo(`Auto-launched log TUI -> ${url} (set LOG_TUI_AUTO=0 to disable)`);
	} catch (err) {
		logWarn("Auto-launch log TUI failed", err);
	}
}

const FX_REFRESH_INTERVAL_MS = 60 * 60 * 1000;
refreshRates().catch(() => null);
setInterval(() => {
	refreshRates().catch(() => null);
}, FX_REFRESH_INTERVAL_MS).unref();

runJoinRequestReminderSweep().catch(() => null);
setInterval(
	() => {
		runJoinRequestReminderSweep().catch(() => null);
	},
	30 * 60 * 1000,
).unref();

startEventQualityReporter();

// CORS configuration - stricter in production.
// In development mode (NODE_ENV !== "production"), all origins are intentionally
// allowed to support local dev servers, mobile app testing, and tools like Postman.
// This is safe because:
//   1. No cookie-based sessions are used (JWT via Authorization header)
//   2. The dev server is not exposed to the public internet
//   3. CSRF is mitigated by JWT-in-Header pattern (see helmet note below)
// In production, only explicit origins in `allowedOrigins` are permitted.
const corsOptions = {
	origin(origin, callback) {
		const allowedOrigins = [
			"http://localhost:5173", // dev frontend
			"http://localhost:4173", // preview
			"http://127.0.0.1:5173",
			"https://gartexhub.onrender.com", // production
		];

		// Allow requests with no origin (curl, health checks, server-to-server, mobile apps)
		// Safe because auth is JWT-in-Header, not cookies — CSRF is not a concern.
		if (!origin) {
			callback(null, true);
			return;
		}

		if (allowedOrigins.includes(origin)) {
			callback(null, true);
		} else if (process.env.NODE_ENV === "production") {
			callback(new Error("Not allowed by CORS"));
		} else {
			callback(null, true); // Dev: allow all
		}
	},
	credentials: true,
	methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
	allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
};

// CSRF is mitigated by JWT-in-Authorization-header pattern + strict CORS.
// No cookie-based sessions are used; state-changing operations require
// a Bearer token which browsers do not auto-attach cross-origin.
app.use(
	helmet({
		contentSecurityPolicy: {
			directives: {
				defaultSrc: ["'self'"],
				scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
				styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
				imgSrc: ["'self'", "data:", "blob:", "https:"],
				connectSrc: ["'self'", "wss:", "https:"],
				fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
				objectSrc: ["'none'"],
				mediaSrc: ["'self'", "blob:"],
				frameSrc: ["'none'"],
			},
		},
		referrerPolicy: { policy: "strict-origin-when-cross-origin" },
	}),
);
app.use(cors(corsOptions));
app.use(express.json({ limit: "5mb" }));

const uploadsRoot = path.join(process.cwd(), "server", "uploads");
const chatUploadsRoot = path.join(uploadsRoot, "chat");
const feedUploadsRoot = path.join(uploadsRoot, "feed");
const profileUploadsRoot = path.join(uploadsRoot, "profile");
const supportUploadsRoot = path.join(uploadsRoot, "support");
if (!fs.existsSync(uploadsRoot)) {
	fs.mkdirSync(uploadsRoot, { recursive: true });
}
if (!fs.existsSync(chatUploadsRoot)) {
	fs.mkdirSync(chatUploadsRoot, { recursive: true });
}
if (!fs.existsSync(feedUploadsRoot)) {
	fs.mkdirSync(feedUploadsRoot, { recursive: true });
}
if (!fs.existsSync(profileUploadsRoot)) {
	fs.mkdirSync(profileUploadsRoot, { recursive: true });
}
if (!fs.existsSync(supportUploadsRoot)) {
	fs.mkdirSync(supportUploadsRoot, { recursive: true });
}

// Signed-file access is registered ahead of the static mount so that no later
// rearrangement can interpose something that serves /uploads directly. Its own
// requestLogger instance is registered here too because the shared one for
// /api/* is installed further down, below this block.
app.use(
	"/api/files",
	requestLogger({ timeoutMs: Number(process.env.REQUEST_TIMEOUT_MS || 45_000) }),
);
app.use("/api/files", fileAccessRoutes);

// Private namespaces (chat, contracts, calls, search) are reachable only through
// the signature-checked /api/files/content route. The guard sits immediately in
// front of express.static, which has no opinion about who is asking, and answers
// 404 rather than falling through — so a future mount rearrangement cannot
// silently reopen them. See server/utils/gatedStaticGuard.js for why the
// classification has to decode and normalize before deciding.
app.use("/uploads", createGatedStaticGuard({ root: uploadsRoot }));
app.use("/uploads", express.static(uploadsRoot));

const distRoot = path.join(process.cwd(), "dist");
const serveDist = process.env.SERVE_DIST === "true";
if (serveDist) {
	logInfo("SERVE_DIST=true", { distExists: fs.existsSync(distRoot) });
}
const MIME_TYPES = {
	".js": "application/javascript",
	".mjs": "application/javascript",
	".css": "text/css",
	".html": "text/html",
	".svg": "image/svg+xml",
	".png": "image/png",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".webp": "image/webp",
	".ico": "image/x-icon",
	".woff2": "font/woff2",
	".json": "application/json",
	".map": "application/json",
	".xml": "application/xml",
	".txt": "text/plain; charset=utf-8",
};

if (serveDist && fs.existsSync(distRoot)) {
	app.use(async (req, res, next) => {
		const ext = path.extname(req.path).toLowerCase();
		const contentType = MIME_TYPES[ext];
		if (!contentType) {
			return next();
		}
		const filePath = path.join(distRoot, req.path);
		try {
			const content = await fs.promises.readFile(filePath);
			// Strip helmet CSP from static file responses — Google sitemap
			// fetcher rejects XML with frame-src 'none' in CSP headers.
			res.removeHeader("content-security-policy");
			// Only Vite's content-hashed /assets/* files never change under the
			// same URL. index.html, sw.js and manifest.json keep their names
			// across deploys, so caching them for a year pinned browsers to a
			// shell whose chunk names no longer exist ("Failed to load page").
			const immutable = req.path.startsWith("/assets/");
			res.writeHead(200, {
				"Content-Type": contentType,
				"Content-Length": Buffer.byteLength(content),
				"Cache-Control": immutable ? "public, max-age=31536000, immutable" : "no-cache",
			});
			res.end(content);
		} catch {
			next();
		}
	});
}

app.use(requestCapture());
app.use("/api", requestLogger({ timeoutMs: Number(process.env.REQUEST_TIMEOUT_MS || 45_000) }));

app.use("/api", diagnosticsRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/requirements", requirementRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/verification", verificationRoutes);
app.use("/api/subscriptions", subscriptionRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/admin", adminConfigRoutes);
app.use("/api/admin", uploadsRoutes);
app.use("/api/feed", feedRoutes);
app.use("/api/link-preview", linkPreviewRoutes);
app.use("/api/products", productRoutes);
app.use("/api/onboarding", onboardingRoutes);
app.use("/api/assistant", assistantRoutes);
app.use("/api/conversations", conversationRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/leads", leadRoutes);

app.use("/api/system", systemRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/join-requests", joinRequestRoutes);

app.use("/api/social", socialRoutes);
app.use("/api/sync", syncRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/qdrant", qdrantRoutes);
app.use("/api/presets", presetsRoutes);
app.use("/api/partners", partnerNetworkRoutes);
app.use("/api/agents/subids", agentSubIdRoutes);
app.use("/api/calls", callSessionRoutes);
app.use("/api/org", orgRoutes);
app.use("/api/members", memberRoutes);
app.use("/api/ratings", ratingsRoutes);
app.use("/api/presence", presenceRoutes);
app.use("/api/profiles", profileRoutes);
app.use("/api/chatbot", chatbotRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/boosts", boostRoutes);
app.use("/api/geo", geoRoutes);
app.use("/api/industry", industryRoutes);
app.use("/api/payment-proofs", paymentProofRoutes);
app.use("/api/coupons", couponRoutes);
// The support-case API (contracts.md §3). It is mounted BEFORE the general
// `/api/support` router so the more specific prefix is matched first.
app.use("/api/support/cases", caseRoutes);
app.use("/api/support", supportRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/certifications", certificationRoutes);
app.use("/api/crm", crmRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/deal-journeys", dealJourneyRoutes);
app.use("/api/workflow", workflowLifecycleRoutes);
app.use("/api/infra", infraRoutes);
app.use("/api/network", networkRoutes);
app.use("/api/exports", exportRoutes);
app.use("/api/logs", logRoutes);
app.use("/log-viewer", viewerRouter);
// E-sign sandbox: lets the caller mark any contract signed, so never in production.
if (process.env.NODE_ENV !== "production") app.use("/api/dev", devRoutes);
app.use(seoRoutes);
// Liveness: the process is up and the event loop answers. Deliberately no
// database or provider calls - a slow dependency must not get a healthy
// process restarted (Render's healthCheckPath points here).
app.get("/health", (_req, res) => {
	if (shuttingDown) {
		return res.status(503).json({ status: "shutting_down" });
	}
	res.status(200).json({ status: "ok", uptime: process.uptime(), timestamp: Date.now() });
});

// Readiness: can this instance serve requests that need the database?
app.get("/ready", async (_req, res) => {
	res.set("Cache-Control", "no-store");
	if (shuttingDown) {
		return res.status(503).json({ status: "not_ready", reason: "shutting_down" });
	}
	let timer = null;
	try {
		await Promise.race([
			prisma.$queryRaw`SELECT 1`,
			new Promise((_resolve, reject) => {
				timer = setTimeout(() => reject(new Error("timeout")), 1500);
			}),
		]);
		return res.status(200).json({ status: "ready", database: "up" });
	} catch {
		return res.status(503).json({
			status: "not_ready",
			database: isDatabaseConnected() ? "slow" : "down",
		});
	} finally {
		if (timer) clearTimeout(timer);
	}
});

app.use(errorHandler);

if (serveDist && fs.existsSync(distRoot)) {
	app.get(/.*/, (req, res) => {
		if (req.path.match(/\.\w+$/)) {
			return res.status(404).end();
		}
		res.sendFile(path.join(distRoot, "index.html"));
	});
}

const server = http.createServer(app);
let shuttingDown = false;
server.on("error", (error) => {
	// EADDRINUSE / EACCES and the like: the API cannot serve - record and exit
	// so the supervisor (local) or Render restarts a clean process.
	void recordFatalAndExit(error, "httpServerError");
});
server.on("close", () => {
	if (!shuttingDown) {
		void recordFatalAndExit(new Error("HTTP server closed unexpectedly"), "httpServerClosed");
	}
});
const ALLOWED_WS_ORIGINS = (
	process.env.ALLOWED_WS_ORIGINS || "http://localhost:5173,http://localhost:4000"
)
	.split(",")
	.map((s) => s.trim());
const wsServer = new WebSocketServer({
	noServer: true,
	verifyClient: (info, cb) => {
		const origin = info.origin || info.req.headers.origin || "";
		const host = info.req.headers.host || "";
		const allowed = ALLOWED_WS_ORIGINS.some(
			(o) =>
				origin === o ||
				origin.startsWith(`${o}/`) ||
				origin === `https://${host}` ||
				origin === `http://${host}`,
		);
		if (allowed || !origin) {
			cb(true);
		} else {
			cb(false, 403, "Forbidden");
		}
	},
});
function isLogWsPath(req) {
	try {
		return new URL(req.url || "/", "http://localhost").pathname === "/ws/logs";
	} catch {
		return false;
	}
}
function upgradeRouter(req, socket, head) {
	if (isLogWsPath(req)) {
		return;
	}
	wsServer.handleUpgrade(req, socket, head, (ws) => {
		wsServer.emit("connection", ws, req);
	});
}

export { upgradeRouter };

const upgradeRouterForLogs = () => null;
const recentGreetingByIp = new Map();
const callRooms = new Map();
const chatRooms = new Map();
const socketsByUserId = new Map();
if (!process.env.JWT_SECRET) {
	process.exit(1);
}
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_ISSUER = process.env.JWT_ISSUER || "gartexhub-api";
const JWT_AUDIENCE = process.env.JWT_AUDIENCE || "gartexhub-client";

function sendWs(socket, payload) {
	if (socket.readyState !== 1) {
		return;
	}
	socket.send(JSON.stringify(payload));
}

function registerSocketUser(socket, userId) {
	if (!userId) {
		return;
	}
	if (!socketsByUserId.has(userId)) {
		socketsByUserId.set(userId, new Set());
	}
	socketsByUserId.get(userId).add(socket);
}

function unregisterSocketUser(socket, userId) {
	if (!userId) {
		return;
	}
	const set = socketsByUserId.get(userId);
	if (!set) {
		return;
	}
	set.delete(socket);
	if (set.size === 0) {
		socketsByUserId.delete(userId);
	}
}

function broadcastToUsers(userIds, payload) {
	const undelivered = [];
	userIds.forEach((userId) => {
		const sockets = socketsByUserId.get(userId);
		if (!sockets || sockets.size === 0) {
			undelivered.push(userId);
			return;
		}
		sockets.forEach((sock) => sendWs(sock, payload));
	});
	return undelivered;
}

realtimeBus.on(REALTIME_EVENTS.notificationCreated, ({ userId, notification }) => {
	broadcastToUsers([String(userId)], {
		type: "notification_created",
		notification,
	});
});

realtimeBus.on(REALTIME_EVENTS.notificationRead, ({ userId, id }) => {
	broadcastToUsers([String(userId)], { type: "notification_read", id });
});

function leaveCallRoom(socket) {
	const callId = socket.callRoomId;
	if (!callId) {
		return;
	}

	const room = callRooms.get(callId);
	if (!room) {
		socket.callRoomId = null;
		return;
	}

	room.delete(socket);
	for (const peer of room) {
		sendWs(peer, {
			type: "participant_left",
			call_id: callId,
			participant_id: socket.participantId || null,
		});
	}

	if (room.size === 0) {
		callRooms.delete(callId);
	}
	socket.callRoomId = null;
}

function leaveChatRoom(socket) {
	const matchId = socket.chatRoomId;
	if (!matchId) {
		return;
	}

	const room = chatRooms.get(matchId);
	if (!room) {
		socket.chatRoomId = null;
		return;
	}

	room.delete(socket);

	for (const peer of room) {
		sendWs(peer, {
			type: "chat_participant_left",
			match_id: matchId,
			participant_id: socket.userId || null,
		});
	}

	if (room.size === 0) {
		chatRooms.delete(matchId);
	}
	socket.chatRoomId = null;

	if (socket.userId) {
		setUserOffline(socket.userId);
	}
	if (socket.userId) {
		unregisterSocketUser(socket, socket.userId);
	}
}

function parseSocketUser(token) {
	if (!token) {
		return null;
	}
	try {
		return jwt.verify(String(token), JWT_SECRET, {
			issuer: JWT_ISSUER,
			audience: JWT_AUDIENCE,
		});
	} catch {
		return null;
	}
}

async function joinChatRoom(socket, payload) {
	const matchId = String(payload?.match_id || "").trim();
	const user = parseSocketUser(payload?.token);

	if (!matchId) {
		sendWs(socket, {
			type: "chat_error",
			error: "match_id is required to join chat room",
		});
		return;
	}

	if (!user?.id) {
		sendWs(socket, {
			type: "chat_error",
			error: "Valid token is required to join chat room",
		});
		return;
	}

	const canJoin = await canAccessMatch(matchId, user.id);
	if (!canJoin) {
		sendWs(socket, {
			type: "chat_error",
			error: "Forbidden: thread access denied",
		});
		return;
	}

	leaveChatRoom(socket);

	if (!chatRooms.has(matchId)) {
		chatRooms.set(matchId, new Set());
	}

	socket.userId = user.id;
	registerSocketUser(socket, user.id);
	setUserOnline(user.id);

	const room = chatRooms.get(matchId);
	const participants = [...room]
		.map((participantSocket) => participantSocket.userId)
		.filter(Boolean);
	room.add(socket);
	socket.chatRoomId = matchId;
	touchUser(user.id);
	await recordWorkflowEvent(
		"chat_started",
		{
			match_id: matchId,
			requirement_id: payload?.requirement_id,
			product_id: payload?.product_id,
		},
		{ actor_id: user.id, source: "ws.join_chat_room" },
	).catch(() => null);

	const history = await listMessagesByMatch(matchId);
	sendWs(socket, {
		type: "joined_chat_room",
		match_id: matchId,
		participant_id: user.id,
		participants,
		messages: history,
	});

	for (const peer of room) {
		if (peer === socket) {
			continue;
		}
		sendWs(peer, {
			type: "chat_participant_joined",
			match_id: matchId,
			participant_id: user.id,
		});
	}
}

async function relayChatMessage(socket, payload) {
	const matchId = socket.chatRoomId;
	if (!(matchId && socket.userId)) {
		sendWs(socket, {
			type: "chat_error",
			error: "Join a chat room before sending messages",
		});
		return;
	}

	const canSend = await canAccessMatch(matchId, socket.userId);
	if (!canSend) {
		sendWs(socket, {
			type: "chat_error",
			error: "Forbidden: thread access denied",
		});
		return;
	}

	const room = chatRooms.get(matchId);
	if (!room) {
		return;
	}

	const messageText = String(payload?.message || "").trim();
	if (!messageText) {
		return;
	}

	try {
		const created = await postMessage(
			matchId,
			socket.userId,
			messageText,
			payload?.message_type || "text",
			null,
			{
				source_type: payload?.source_type,
				source_id: payload?.source_id,
				source_label: payload?.source_label,
			},
		);

		const policyStatus = String(created?.policy_status || "delivered");
		const shouldBroadcast = policyStatus === "delivered";
		const peers = shouldBroadcast ? [...room] : [socket];
		for (const peer of peers) {
			sendWs(peer, {
				type: "chat_message",
				match_id: matchId,
				message: created,
			});
		}

		if (!shouldBroadcast) {
			sendWs(socket, {
				type: "chat_policy_status",
				match_id: matchId,
				status: policyStatus,
				reason: created?.policy_reason || null,
				queue_rank: created?.policy_priority || null,
				retry_after_seconds: Number(created?.retry_after_seconds || 0),
			});
		}

		await recordWorkflowEvent(
			"chat_message_sent",
			{
				match_id: matchId,
			},
			{ actor_id: socket.userId, source: "ws.chat_message" },
		).catch(() => null);

		try {
			const botResult = await maybeGenerateBotReply({
				match_id: matchId,
				sender_id: socket.userId,
				message: messageText,
			});
			if (botResult?.reply) {
				for (const peer of room) {
					sendWs(peer, {
						type: "chat_message",
						match_id: matchId,
						message: botResult.reply,
					});
				}
			}
		} catch {
			// silent
		}
	} catch (error) {
		logError("chat_message_failed", error);
		const policyReason = error?.policy?.reason || null;
		const retryAfter = Number(error?.policy?.retry_after_seconds || 0);
		sendWs(socket, {
			type: "chat_error",
			error: error?.message || "Unable to send message",
			reason: policyReason,
			retry_after_seconds: retryAfter,
		});
	}
}

async function joinCallRoom(socket, payload) {
	const callId = String(payload?.call_id || "").trim();
	const tokenUser = parseSocketUser(payload?.token);
	const participantId =
		String(payload?.participant_id || "").trim() || tokenUser?.id || `anon-${Date.now()}`;
	if (!callId) {
		sendWs(socket, {
			type: "call_error",
			error: "call_id is required to join room",
		});
		return;
	}

	if (!tokenUser?.id) {
		sendWs(socket, {
			type: "call_error",
			error: "Valid token is required to join call room",
		});
		return;
	}

	const call = await getCallSession(callId, tokenUser.id);
	if (!call || call === "forbidden") {
		sendWs(socket, {
			type: "call_error",
			error: "Forbidden: call access denied",
		});
		return;
	}

	leaveCallRoom(socket);

	if (!callRooms.has(callId)) {
		callRooms.set(callId, new Set());
	}

	const room = callRooms.get(callId);
	const existingParticipants = [...room].map((s) => s.participantId).filter(Boolean);
	room.add(socket);
	socket.callRoomId = callId;
	socket.participantId = participantId;
	socket.userId = tokenUser.id;
	registerSocketUser(socket, tokenUser.id);

	sendWs(socket, {
		type: "joined_call_room",
		call_id: callId,
		participant_id: participantId,
		participants: existingParticipants,
		should_offer: existingParticipants.length > 0,
	});

	for (const peer of room) {
		if (peer === socket) {
			continue;
		}
		sendWs(peer, {
			type: "participant_joined",
			call_id: callId,
			participant_id: participantId,
		});
	}
}

function relaySignal(socket, payload) {
	const callId = socket.callRoomId;
	if (!callId) {
		return;
	}
	const room = callRooms.get(callId);
	if (!room) {
		return;
	}

	const signalType = String(payload?.signal?.type || "");
	if (signalType && signalType !== "candidate") {
		logInfo("webrtc_signal", {
			call_id: callId,
			from_user_id: socket.userId || null,
			from_participant_id: socket.participantId || null,
			signal_type: signalType,
		});
	}

	for (const peer of room) {
		if (peer === socket) {
			continue;
		}
		sendWs(peer, {
			type: "webrtc_signal",
			call_id: callId,
			from: socket.participantId || null,
			signal: payload?.signal || null,
		});
	}
}

wsServer.on("error", (error) => {
	logError("websocket_server_error", error);
});

wsServer.on("connection", (socket, req) => {
	logInfo("Assistant WebSocket connected");
	let lastQuestion = "";
	let lastQuestionAt = 0;

	function sendReply(payload) {
		const answer = payload?.matched_answer || payload?.answer || payload?.message || "";
		sendWs(socket, {
			...payload,
			matched_answer: answer,
			answer,
			message: answer,
		});
	}

	const clientIp = req?.socket?.remoteAddress || "unknown";
	const now = Date.now();
	const lastGreetingAt = Number(recentGreetingByIp.get(clientIp) || 0);
	if (now - lastGreetingAt > 5000) {
		recentGreetingByIp.set(clientIp, now);
		sendReply({
			type: "reply",
			question: null,
			matched_answer:
				"Hello! I am your GarTex Assistant (WS). How can I help you with your textile business today?",
			source: "system:greeting",
			metadata: {
				matched_source: "system:greeting",
				matched_type: "system",
				confidence: 1,
				fallback_reason: null,
			},
		});
	}

	socket.on("message", async (rawMessage) => {
		let payload;
		try {
			payload = JSON.parse(String(rawMessage || ""));
		} catch {
			sendReply({
				type: "reply",
				question: null,
				matched_answer:
					'Invalid message format. Please send JSON like {"type":"ask","question":"..."}.',
				source: "ws:error",
				metadata: {
					matched_source: "ws:error",
					matched_type: "error",
					confidence: 0,
					fallback_reason: "invalid_json",
				},
			});
			return;
		}

		if (payload?.type === "join_call_room") {
			await joinCallRoom(socket, payload);
			return;
		}

		if (payload?.type === "webrtc_signal") {
			relaySignal(socket, payload);
			return;
		}

		if (payload?.type === "identify") {
			const tokenUser = parseSocketUser(payload?.token);
			if (!tokenUser?.id) {
				return;
			}
			socket.userId = tokenUser.id;
			registerSocketUser(socket, tokenUser.id);
			const queued = consumePendingInvites(tokenUser.id);
			if (queued.length > 0) {
				queued.forEach((invite) => sendWs(socket, invite));
			}
			return;
		}

		if (payload?.type === "call_invite") {
			const tokenUser = parseSocketUser(payload?.token);
			if (!tokenUser?.id) {
				return;
			}
			const participantIds = Array.isArray(payload?.participant_ids)
				? payload.participant_ids.map((id) => String(id))
				: [];
			if (participantIds.length === 0) {
				return;
			}
			const caller = await prisma.user.findUnique({
				where: { id: tokenUser.id },
			});
			const callerPayload = caller
				? {
						id: caller.id,
						name: caller.name || "",
						email: caller.email || "",
						avatar: caller.avatar_url || caller.avatar || "",
						role: caller.role || "",
					}
				: { id: tokenUser.id };

			const targets = participantIds.filter((id) => id && id !== tokenUser.id);
			if (targets.length === 0) {
				return;
			}
			const invitePayload = {
				type: "incoming_call",
				call_id: payload?.call_id || null,
				match_id: payload?.match_id || null,
				from: callerPayload,
			};
			const undelivered = broadcastToUsers(targets, invitePayload);
			enqueuePendingInvites(undelivered, [invitePayload]);
			return;
		}

		if (payload?.type === "join_chat_room") {
			await joinChatRoom(socket, payload);
			return;
		}

		if (payload?.type === "chat_message") {
			await relayChatMessage(socket, payload);
			return;
		}

		if (payload?.type !== "ask") {
			return;
		}

		const question = String(payload?.question || "");

		// Deterministic FAQ answer: what guests get (there is no AI session
		// without an account) and what anyone gets when the AI cannot answer.
		const sendFaqReply = (reason) => {
			const faq = answerFaq(question);
			sendReply({
				type: "reply",
				request_id: payload?.request_id || null,
				question,
				matched_answer: formatFaqAnswer(faq),
				source: "faq",
				metadata: {
					matched_source: "faq",
					matched_type: faq.matched ? "faq" : "unknown",
					intent: faq.id,
					confidence: faq.confidence,
					fallback_reason: reason,
				},
			});
		};

		if (!socket.userId) {
			sendFaqReply("guest");
			return;
		}

		const messageNow = Date.now();
		if (question && question === lastQuestion && messageNow - lastQuestionAt < 1500) {
			return;
		}
		lastQuestion = question;
		lastQuestionAt = messageNow;
		logInfo("Assistant WebSocket ask received", {
			question_chars: question.length,
		});

		let faqTimer = null;
		let settledByFaq = false;
		try {
			const userId = socket?.userId || null;
			const requestId = payload?.request_id || null;

			let streamedText = "";
			let _streamError = null;
			let streamDone = false;
			// Once the FAQ has answered (slow or failed AI), late AI output is
			// dropped so the visitor never gets two answers.
			faqTimer = setTimeout(() => {
				if (!(streamDone || streamedText)) {
					settledByFaq = true;
					sendFaqReply("ai_slow");
				}
			}, Number(process.env.ASSISTANT_FAQ_FALLBACK_MS) || 20_000);

			const gotChunk = (delta, fullText) => {
				if (settledByFaq) return;
				streamedText = fullText;
				sendReply({
					type: "chunk",
					request_id: requestId,
					question,
					delta,
					text: fullText,
					done: false,
				});
			};

			const gotComplete = (answer, error) => {
				streamDone = true;
				_streamError = error;
				clearTimeout(faqTimer);
				if (settledByFaq) return;
				if (error) {
					if (answer) {
						sendReply({
							type: "reply",
							request_id: requestId,
							question,
							matched_answer: answer,
							source: "ws:stream_error",
							metadata: {
								matched_source: "ws:stream_error",
								matched_type: "error",
								confidence: 0,
								fallback_reason: error,
							},
						});
					} else {
						sendFaqReply(`ai_error:${error}`);
					}
				} else {
					sendReply({
						type: "reply",
						request_id: requestId,
						question,
						matched_answer: answer || "I could not find a response right now. Please try again.",
						source: "ws:stream",
						metadata: {
							matched_source: "ws:stream",
							matched_type: "ai_generated",
							confidence: 2,
							fallback_reason: null,
						},
					});
				}
			};

			await streamOpencodeReply(question, userId, gotChunk, gotComplete);
			clearTimeout(faqTimer);

			if (!(streamDone || settledByFaq)) {
				if (!streamedText) {
					sendFaqReply("stream_not_started");
					return;
				}
				sendReply({
					type: "reply",
					request_id: requestId,
					question,
					matched_answer: streamedText,
					source: "ws:fallback",
					metadata: {
						matched_source: "ws:fallback",
						matched_type: "unknown",
						confidence: 0,
						fallback_reason: "stream_not_started",
					},
				});
			}
		} catch (error) {
			clearTimeout(faqTimer);
			logError("Assistant WebSocket ask failed", error);
			if (!settledByFaq) sendFaqReply("assistant_exception");
		}
	});

	const keepaliveTimer = setInterval(() => {
		if (socket.readyState === 1) {
			socket.ping();
		} else {
			clearInterval(keepaliveTimer);
		}
	}, 25_000);

	socket.on("close", () => {
		clearInterval(keepaliveTimer);
		leaveCallRoom(socket);
		leaveChatRoom(socket);
		unregisterSocketUser(socket, socket.userId);
		socket.userId = undefined;
	});

	socket.on("error", () => {
		clearInterval(keepaliveTimer);
		leaveCallRoom(socket);
		leaveChatRoom(socket);
		unregisterSocketUser(socket, socket.userId);
		socket.userId = undefined;
	});
});

async function start() {
	setSubsystemState("database", "connecting");
	await ensureDatabaseConnection();
	setSubsystemState("database", "connected");
	startDbHeartbeat();
	// Redis caching (optional - only if REDIS_URL is set)
	await initRedis();
	startOpenSearchHeartbeat();
	// Verification renewals: keep badges in sync with subscription validity.
	revokeExpiredVerifications().catch((error) =>
		logError("verification_expiry_check_failed", error),
	);
	enforcePartnerFreeTierLimits().catch((error) => logError("partner_limit_check_failed", error));
	runLeadReminderSweep().catch((error) => logError("lead_reminder_sweep_failed", error));
	setInterval(
		() => {
			revokeExpiredVerifications().catch((error) =>
				logError("verification_expiry_check_failed", error),
			);
			enforcePartnerFreeTierLimits().catch((error) =>
				logError("partner_limit_check_failed", error),
			);
		},
		6 * 60 * 60 * 1000,
	);

	setInterval(
		() => {
			runLeadReminderSweep().catch((error) => logError("lead_reminder_sweep_failed", error));
		},
		5 * 60 * 1000,
	);

	initOpencodeServer()
		.then(() => initAllUserSessions())
		.catch((err) => logError("init_opencode_failed", err));

	// Log hub + live transport (WS + HTTP).
	startLogTransport(server);
	server.on("upgrade", upgradeRouter);
	registerLogHttp(app);

	server.listen(PORT, () => {
		logInfo(`Verification MVP API running on http://localhost:${PORT}`);
		maybeAutoLaunchLogTui();
	});

	// Feed live runtime metrics (redis/workers/queue depths) to the log hub.
	const startedWorkers = new Set();
	const markWorker = (name) => startedWorkers.add(name);
	setInterval(() => {
		try {
			import("./utils/redis.js")
				.then(({ isRedisConnected }) => {
					logHub.setRuntimeMetrics({ redis: isRedisConnected() ? "connected" : "down" });
				})
				.catch(() => {});
		} catch {
			// ignore
		}
		try {
			Promise.all([
				import("./services/videoQueue.js"),
				import("./services/imageQueue.js"),
				import("./services/esignRetryService.js"),
			])
				.then(([vq, iq, es]) => {
					const workQ = Number(vq.queueDepth?.() || 0) + Number(iq.queueDepth?.() || 0);
					return es.queueDepth().then((n) =>
						logHub.setRuntimeMetrics({
							workers: startedWorkers.size,
							workQ: workQ + Number(n || 0),
						}),
					);
				})
				.catch(() => {});
		} catch {
			// ignore
		}
	}, 5000);

	try {
		startSyslogServer();
		markWorker("syslog");
	} catch (err) {
		logError("start_syslog_server_failed", err);
	}

	try {
		startEsignWebhookRetryWorker();
		markWorker("esign_retry");
	} catch (err) {
		logError("start_esign_retry_worker_failed", err);
	}

	// The support-case retention sweep. A case that has been quiet for the
	// retention window is swept away - thread, evidence rows and the evidence
	// BYTES - so it runs on the same schedule as the other worker loops.
	try {
		startCaseRetentionWorker();
		markWorker("case_retention");
	} catch (err) {
		logError("start_case_retention_worker_failed", err);
	}

	import("./services/videoQueue.js")
		.then(({ startVideoQueueWorker }) => {
			startVideoQueueWorker();
			markWorker("video_queue");
		})
		.catch((err) => logError("start_video_queue_worker_failed", err));

	import("./services/imageQueue.js")
		.then(({ startImageQueueWorker }) => {
			startImageQueueWorker();
			markWorker("image_queue");
		})
		.catch((err) => logError("start_image_queue_worker_failed", err));

	import("./services/aiModerationService.js")
		.then(({ ensureVenv, isAIAnalyticsEnabled }) => {
			import("./services/uploadsService.js")
				.then(({ ensureDocumentRowsForExistingFiles, scanAndAnalyzeExistingFiles }) => {
					setTimeout(async () => {
						// The registry pass is not part of the AI-moderation feature:
						// a file with no Document row is unreachable, whatever the
						// moderation flag says. It therefore runs first and always.
						try {
							await ensureDocumentRowsForExistingFiles();
						} catch (err) {
							logError("ensureDocumentRowsForExistingFiles failed", err);
						}
						if (!isAIAnalyticsEnabled()) {
							logInfo(
								"AI Moderation disabled via AI_HARAM_ANALYTICS_ENABLED — skipping venv setup and scan",
							);
							return;
						}
						ensureVenv().catch((err) => logError("ensureVenv_failed", err));
						scanAndAnalyzeExistingFiles().catch((err) => logError("scanExistingFiles_failed", err));
					}, 5000);
				})
				.catch((err) => logError("server: uploadsService import failed", err));
		})
		.catch((err) => logError("server: aiModerationService import failed", err));
}

start()
	.then(() => {
		setSubsystemState("startup", "listening");
		startMemoryMonitor({ logWarn, logInfo }).catch(() => {});
	})
	.catch((error) => {
		logError("Failed to start server", error);
		setSubsystemState("startup", "failed");
		void recordFatalAndExit(error, "startupFailure");
	});

// Graceful shutdown: stop accepting work, let in-flight requests finish for a
// short grace period, close realtime sockets, then release Redis and the
// database. SIGTERM (Render deploy/restart) and SIGINT exit 0 and are not
// crashes; fatal errors reuse this path and exit 1. Bounded by
// SHUTDOWN_TIMEOUT_MS so it always ends well inside Render's shutdown window.
let shutdownPromise = null;
async function gracefulShutdown(reason, exitCode = 0) {
	if (shutdownPromise) return shutdownPromise;
	shuttingDown = true;
	setSubsystemState("startup", "shutting_down");
	const graceMs = Number(process.env.SHUTDOWN_TIMEOUT_MS) || 8000;
	logInfo("shutdown_started", { reason, exit_code: exitCode, grace_ms: graceMs });
	const hardStop = setTimeout(() => process.exit(exitCode), graceMs + 2000);
	hardStop.unref();

	shutdownPromise = (async () => {
		const closed = new Promise((resolve) => {
			if (!server.listening) return resolve();
			server.close(() => resolve());
			server.closeIdleConnections?.();
		});
		for (const client of wsServer.clients) {
			try {
				client.close(1001, "Server restarting");
			} catch {
				// already closing
			}
		}
		const grace = new Promise((resolve) => setTimeout(resolve, graceMs).unref());
		await Promise.race([closed, grace]);
		// Long-lived streams (SSE, sockets that ignored the close frame) are
		// cut once the grace period is over.
		server.closeAllConnections?.();
		for (const client of wsServer.clients) {
			try {
				client.terminate();
			} catch {
				// gone
			}
		}
		await closeRedis().catch(() => {});
		await closeDatabaseConnection().catch(() => {});
		logInfo("shutdown_complete", { reason, exit_code: exitCode });
	})()
		.catch((error) => logError("shutdown_failed", error))
		.finally(() => process.exit(exitCode));
	return shutdownPromise;
}

process.on("SIGTERM", () => {
	void gracefulShutdown("SIGTERM", 0);
});
process.on("SIGINT", () => {
	void gracefulShutdown("SIGINT", 0);
});
