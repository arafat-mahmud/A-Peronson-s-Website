import crypto from "node:crypto";
import { readLocalJson, updateLocalJson } from "../utils/localStore.js";
import { logError, logInfo } from "../utils/logger.js";
import { handleSignCallback } from "./eSignService.js";

const KEY = "esign_webhook_failures";
const DEFAULT_INTERVAL_MS = Number(process.env.ESIGN_WEBHOOK_RETRY_INTERVAL_MS || 60_000);
const MAX_ATTEMPTS = Number(process.env.ESIGN_WEBHOOK_MAX_ATTEMPTS || 5);
const BACKOFF_BASE_MS = Number(process.env.ESIGN_WEBHOOK_RETRY_BACKOFF_MS || 10_000);

export async function recordFailedWebhook({ contractId, payload = {}, headers = {}, error = "" }) {
	const id = crypto.randomUUID();
	const now = Date.now();
	await updateLocalJson(
		KEY,
		(existing = []) => {
			const arr = Array.isArray(existing) ? existing.slice() : [];
			arr.push({
				id,
				contractId: String(contractId || ""),
				payload: payload || {},
				headers: headers || {},
				attempts: 0,
				firstFailedAt: now,
				lastAttemptAt: now,
				lastError: String(error || ""),
			});
			return arr;
		},
		[],
	);
	logInfo("esign_webhook_failure_recorded", { id, contractId });
	return id;
}

export function startEsignWebhookRetryWorker() {
	const intervalMs = Math.max(10_000, DEFAULT_INTERVAL_MS);
	setInterval(async () => {
		try {
			const now = Date.now();
			const list = await readLocalJson(KEY, []);
			if (!Array.isArray(list) || list.length === 0) {
				return;
			}

			const next = [];
			for (const item of list) {
				try {
					const attempts = Number(item.attempts || 0);
					if (attempts >= MAX_ATTEMPTS) {
						logError("esign_webhook_failure_dropped", {
							id: item.id,
							contractId: item.contractId,
							attempts,
						});
						continue;
					}

					const lastAttemptAt = Number(item.lastAttemptAt || item.firstFailedAt || 0);
					const requiredDelay = BACKOFF_BASE_MS * 2 ** attempts;
					if (now - lastAttemptAt < requiredDelay) {
						next.push(item);
						continue;
					}

					// Retry by calling internal handler directly (bypasses HMAC validation)
					await handleSignCallback(item.contractId, item.payload);
					logInfo("esign_webhook_retry_success", {
						id: item.id,
						contractId: item.contractId,
					});
				} catch (err) {
					item.attempts = Number(item.attempts || 0) + 1;
					item.lastAttemptAt = now;
					item.lastError = String(err?.message || err);
					logError("esign_webhook_retry_failed", {
						id: item.id,
						contractId: item.contractId,
						attempts: item.attempts,
						error: item.lastError,
					});
					next.push(item);
				}
			}

			await updateLocalJson(KEY, () => next, []);
		} catch (err) {
			logError("esign_webhook_retry_worker_error", err);
		}
	}, intervalMs).unref();

	logInfo("esign_webhook_retry_worker_started", { intervalMs });
}

export async function queueDepth() {
	try {
		const list = await readLocalJson(KEY, []);
		return Array.isArray(list) ? list.length : 0;
	} catch {
		return 0;
	}
}

export default { recordFailedWebhook, startEsignWebhookRetryWorker, queueDepth };
