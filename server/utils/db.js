import { logInfo, logWarn } from "../utils/logger.js";
import prisma from "./prisma.js";

let dbConnected = false;
let dbError = "";

export function getDbStatus() {
	return {
		connected: dbConnected,
		error: dbError,
	};
}

export function isDatabaseConnected() {
	return dbConnected;
}

function startupErrorMessage(error) {
	// Prisma messages can echo the connection string; keep the first line only
	// and strip credentials before it reaches the log.
	return String(error?.message || "DB connection failed")
		.split("\n")[0]
		.replace(/(postgres(?:ql)?:\/\/)[^@\s]+@/gi, "$1[REDACTED]@")
		.slice(0, 300);
}

export async function ensureDatabaseConnection() {
	const allowOffline = ["1", "true", "yes"].includes(
		String(process.env.ALLOW_DB_OFFLINE || "").toLowerCase(),
	);
	if (!process.env.DATABASE_URL) {
		if (allowOffline) {
			dbConnected = false;
			dbError = "DATABASE_URL missing (offline mode allowed)";
			return;
		}
		dbConnected = false;
		dbError = "DATABASE_URL is required to start the server (PostgreSQL)";
		throw new Error(dbError);
	}
	try {
		const safeUrl = new URL(process.env.DATABASE_URL);
		const maskedPass = safeUrl.password ? "***" : "";
		const safe = `${safeUrl.protocol}//${safeUrl.username}${maskedPass ? `:${maskedPass}` : ""}@${safeUrl.host}${safeUrl.pathname}`;
		logInfo("db Using DATABASE_URL", { url: safe });
	} catch {
		logInfo("db Using DATABASE_URL (unparsed)", { url: "[redacted]" });
	}
	// Bounded, logged retries. The old loop retried every 30s forever and in
	// silence, so an unreachable database left the port closed with no clue in
	// the logs; now the boot fails after DB_STARTUP_MAX_WAIT_MS and the crash
	// handler records why, letting the platform restart a fresh process.
	const maxWaitMs = Number(process.env.DB_STARTUP_MAX_WAIT_MS) || 120_000;
	const startedAt = Date.now();
	let attempt = 0;
	while (true) {
		attempt += 1;
		try {
			await prisma.$connect();
			dbConnected = true;
			dbError = "";
			if (attempt > 1) {
				logInfo("db Connected after retry", { attempt });
			}
			break;
		} catch (error) {
			dbConnected = false;
			dbError = startupErrorMessage(error);
			if (allowOffline) {
				return;
			}
			const elapsed = Date.now() - startedAt;
			if (elapsed >= maxWaitMs) {
				throw new Error(`Database unreachable after ${attempt} attempts: ${dbError}`);
			}
			const delay = Math.min(30_000, 2000 * 2 ** (attempt - 1), maxWaitMs - elapsed);
			logWarn("db Connection attempt failed", { attempt, retry_in_ms: delay, error: dbError });
			await new Promise((r) => setTimeout(r, delay));
		}
	}
}

export function startDbHeartbeat() {
	const HEARTBEAT_INTERVAL_MS = 30_000;

	async function checkConnection() {
		try {
			if (dbConnected) {
				await prisma.$queryRaw`SELECT 1`;
			} else {
				await prisma.$connect();
				dbConnected = true;
				dbError = "";
				logInfo("db Reconnected successfully");
			}
		} catch {
			if (dbConnected) {
				dbConnected = false;
				dbError = "Connection lost";
			}
		}
	}

	setInterval(checkConnection, HEARTBEAT_INTERVAL_MS).unref();
}

export async function closeDatabaseConnection() {
	await prisma.$disconnect();
	dbConnected = false;
}
