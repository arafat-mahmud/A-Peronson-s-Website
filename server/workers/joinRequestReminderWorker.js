import { runJoinRequestReminderSweep } from "../services/companyJoinService.js";
import { logError, logInfo } from "../utils/logger.js";

const INTERVAL_MS = Number(process.env.JOIN_REQUEST_REMINDER_INTERVAL_MS || 30 * 60 * 1000);

async function sweepOnce() {
	try {
		const res = await runJoinRequestReminderSweep();
		if (res?.ok) {
			logInfo("join_request_reminder_sweep_completed", {
				processed: res.processed || 0,
			});
		} else {
			logError("join_request_reminder_sweep_error", res?.error || "unknown");
		}
	} catch (err) {
		logError("join_request_reminder_sweep_exception", err?.message || err);
	}
}

async function runLoop() {
	await sweepOnce();

	const timer = setInterval(() => {
		sweepOnce().catch((e) => logError("join_request_reminder_sweep_unhandled", e?.message || e));
	}, INTERVAL_MS);

	function shutdown() {
		clearInterval(timer);
		logInfo("join_request_reminder_worker_stopping");
		process.exit(0);
	}

	process.on("SIGINT", shutdown);
	process.on("SIGTERM", shutdown);
}

if (process.argv.includes("--once")) {
	(async () => {
		await sweepOnce();
		process.exit(0);
	})();
} else {
	runLoop().catch((e) => {
		logError("join_request_reminder_worker_failed", e?.message || e);
		process.exit(1);
	});
}
