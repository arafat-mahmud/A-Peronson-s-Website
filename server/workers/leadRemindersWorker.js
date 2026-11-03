import { runLeadReminderSweep } from "../services/leadReminderService.js";
import { logError, logInfo } from "../utils/logger.js";

const INTERVAL_MS = Number(process.env.LEAD_REMINDER_INTERVAL_MS || 60 * 60 * 1000); // default 1 hour

async function sweepOnce() {
	try {
		const res = await runLeadReminderSweep();
		if (res?.ok) {
			logInfo("lead_reminder_sweep_completed", {
				processed: res.processed || 0,
			});
		} else {
			logError("lead_reminder_sweep_error", res?.error || "unknown");
		}
	} catch (err) {
		logError("lead_reminder_sweep_exception", err?.message || err);
	}
}

async function runLoop() {
	// initial sweep on startup
	await sweepOnce();

	// periodic sweeps
	const timer = setInterval(() => {
		sweepOnce().catch((e) => logError("lead_reminder_sweep_unhandled", e?.message || e));
	}, INTERVAL_MS);

	function shutdown() {
		clearInterval(timer);
		logInfo("lead_reminder_worker_stopping");
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
		logError("lead_reminder_worker_failed", e?.message || e);
		process.exit(1);
	});
}
