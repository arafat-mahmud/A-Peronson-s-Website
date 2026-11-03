import fs from "node:fs/promises";
import path from "node:path";
import { deleteCase } from "../services/caseService.js";
import { PRIVATE_ENTITY_TYPE } from "../services/privateDocumentService.js";
import { logError, logInfo, logWarn } from "../utils/logger.js";
import prisma from "../utils/prisma.js";
import { uploadsRoot } from "../utils/signedFileUrl.js";

// The retention sweep.
//
// A support case is three things at once: the client's thread, the evidence
// they attached to it, and the investigation that ran against it. All three
// grow without bound, so the portal keeps a window — a case that has been
// quiet for CASE_RETENTION_DAYS (default 90) is swept away.
//
// Two rules protect a case from the sweep:
//   - a case in a LIVE status (collecting / investigating) is still being
//     worked on, so it is never swept whatever its age;
//   - a case flagged `retain` is kept, whatever its age.
//
// The evidence follows the case: the attachment BYTES are removed from disk,
// not just the attachment row. The row is cheap; the bytes are what actually
// costs disk, and they are the client's own material.
//
// The attachment's `file_path` is CLIENT-SUPPLIED — the message API posts it
// verbatim (contracts.md §3) — so it is never trusted as a path to delete. It
// is resolved against the uploads root, it must land inside the gated support
// namespace, and the resolved path is re-checked against the REAL uploads root
// before a byte is unlinked. A path that does not resolve is reported, never
// guessed at: "never delete a file you did not resolve from a recorded
// attachment row" is the whole safety rule of this file.

const SECOND_MS = 1000;
const MINUTE_MS = 60 * SECOND_MS;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

const DEFAULT_RETENTION_DAYS = 90;
const DEFAULT_INTERVAL_MS = HOUR_MS;
const MIN_INTERVAL_MS = MINUTE_MS;

// A case in one of these statuses is live work. The sweep must not take a
// thread away from the client while it is still being answered.
const LIVE_STATUSES = ["collecting", "investigating"];

// The gated namespace the case evidence lives in. Everything else under
// /uploads belongs to somebody else — chat attachments, contract PDFs, call
// recordings — and a client-supplied file_path must never be able to reach
// them.
const SUPPORT_NAMESPACE = "support";

// The legacy spelling of the same entity type: the old feedback client posted
// entity_type "support_ticket" and the rows it produced still carry it.
const LEGACY_SUPPORT_ENTITY_TYPE = "support_ticket";

const UPLOADS_PREFIX = "uploads";

// A recorded path must name a namespace and a file inside it.
const MIN_PATH_SEGMENTS = 2;

const PUBLIC_PATH_PATTERN = new RegExp(`^/?${UPLOADS_PREFIX}/`, "i");

/**
 * The retention window, in days.
 *
 * @returns {number} CASE_RETENTION_DAYS, or the 90-day default when the
 *   variable is missing or is not a usable number.
 */
export function retentionDays() {
	const raw = Number(process.env.CASE_RETENTION_DAYS);
	if (!Number.isFinite(raw)) {
		return DEFAULT_RETENTION_DAYS;
	}
	if (raw < 0) {
		return DEFAULT_RETENTION_DAYS;
	}
	return Math.floor(raw);
}

/**
 * The sweep interval, in milliseconds.
 *
 * @returns {number} CASE_RETENTION_INTERVAL_MS, or the hourly default.
 */
export function retentionIntervalMs() {
	const raw = Number(process.env.CASE_RETENTION_INTERVAL_MS);
	if (!Number.isFinite(raw)) {
		return DEFAULT_INTERVAL_MS;
	}
	if (raw <= 0) {
		return DEFAULT_INTERVAL_MS;
	}
	return Math.max(MIN_INTERVAL_MS, Math.floor(raw));
}

function normalizeNow(now) {
	if (now === undefined || now === null) {
		return new Date();
	}
	const at = now instanceof Date ? now : new Date(now);
	return Number.isFinite(at.getTime()) ? at : new Date();
}

function isLiveStatus(status) {
	return LIVE_STATUSES.includes(
		String(status ?? "")
			.trim()
			.toLowerCase(),
	);
}

function isRetained(row) {
	return Boolean(row?.retain);
}

/**
 * True when the case is older than the window and nothing protects it.
 *
 * @param {Object} row The case row.
 * @param {Date} cutoff The instant before which a case counts as expired.
 * @returns {boolean}
 */
export function shouldSweep(row, cutoff) {
	if (!row) {
		return false;
	}
	if (isLiveStatus(row.status)) {
		return false;
	}
	if (isRetained(row)) {
		return false;
	}
	const updated = new Date(row.updated_at ?? 0).getTime();
	if (!Number.isFinite(updated) || updated <= 0) {
		return false;
	}
	return updated < cutoff.getTime();
}

/**
 * True when `target` sits strictly below `root`.
 *
 * @param {string} root
 * @param {string} target
 * @returns {boolean}
 */
function isStrictlyInside(root, target) {
	if (!(root && target)) {
		return false;
	}
	const rel = path.relative(root, target);
	if (!rel) {
		return false;
	}
	if (rel.startsWith("..")) {
		return false;
	}
	return !path.isAbsolute(rel);
}

/**
 * Turns a recorded public path into the segments below the uploads root.
 *
 * Only "/uploads/<namespace>/<name>" is accepted: anything else is not a
 * file this portal wrote.
 *
 * @param {string} filePath The recorded public path.
 * @returns {string[]|null} The path segments, or null when it is not ours.
 */
function publicPathSegments(filePath) {
	const raw = String(filePath ?? "").trim();
	if (!raw) {
		return null;
	}
	const normalized = raw.replace(/\\/g, "/");
	if (!PUBLIC_PATH_PATTERN.test(normalized)) {
		return null;
	}
	const rel = normalized.replace(PUBLIC_PATH_PATTERN, "");
	const parts = rel.split("/").filter((part) => part && part !== ".");
	if (parts.length < MIN_PATH_SEGMENTS) {
		return null;
	}
	return parts;
}

/**
 * Resolves a recorded public path to a file that may be deleted.
 *
 * Three checks, in order, and all of them must pass:
 *   1. the path is under /uploads and names at least a namespace and a file;
 *   2. it resolves to an absolute path strictly below the uploads root, so
 *      "../" traversal cannot walk out;
 *   3. the REAL path (symlinks and Windows short names resolved) is still
 *      strictly below the REAL uploads root, so a link planted inside the
 *      tree cannot aim the unlink somewhere else.
 *
 * @param {string} filePath The recorded public path.
 * @returns {Promise<Object>} { ok, abs?, real?, missing?, reason? }
 */
async function resolveEvidenceFile(filePath) {
	const parts = publicPathSegments(filePath);
	if (!parts) {
		return { ok: false, reason: "not_an_uploads_path" };
	}
	if (parts[0].toLowerCase() !== SUPPORT_NAMESPACE) {
		return { ok: false, reason: "outside_support_namespace" };
	}

	const root = uploadsRoot();
	const abs = path.resolve(root, ...parts);
	if (!isStrictlyInside(root, abs)) {
		return { ok: false, reason: "outside_uploads_root", abs };
	}

	let realRoot;
	let real;
	try {
		realRoot = await fs.realpath(root);
		real = await fs.realpath(abs);
	} catch (error) {
		if (error.code === "ENOENT") {
			return { ok: true, missing: true, abs };
		}
		return { ok: false, reason: "unresolvable", abs };
	}
	if (!isStrictlyInside(realRoot, real)) {
		return { ok: false, reason: "outside_uploads_root", abs };
	}
	return { ok: true, missing: false, abs, real };
}

/**
 * Removes the bytes behind one attachment.
 *
 * @param {Object} attachment The attachment row.
 * @returns {Promise<Object>} { removed: boolean, publicPath, abs?, reason? }
 */
async function removeAttachmentBytes(attachment) {
	const publicPath = String(attachment?.file_path ?? "").trim();
	const resolved = await resolveEvidenceFile(publicPath);
	if (!resolved.ok) {
		return { removed: false, publicPath, reason: resolved.reason };
	}
	if (resolved.missing) {
		// The bytes are already gone. The evidence is gone either way; the row
		// is the only thing left to clean up.
		return { removed: true, publicPath, missing: true };
	}
	try {
		const stats = await fs.lstat(resolved.abs);
		if (stats.isDirectory()) {
			return { removed: false, publicPath, reason: "is_a_directory" };
		}
		// Unlink the RECORDED path, not the resolved one: the recorded path is
		// what the attachment row names, and unlinking a symlink removes the
		// link rather than whatever it points at.
		await fs.unlink(resolved.abs);
		return { removed: true, publicPath, abs: resolved.abs };
	} catch (error) {
		if (error.code === "ENOENT") {
			return { removed: true, publicPath, missing: true };
		}
		return { removed: false, publicPath, reason: error.message || "unlink_failed" };
	}
}

/**
 * Drops the Document rows that anchor the files this sweep removed.
 *
 * The Document row is the authorization key for a gated file, and it is not
 * part of the case's foreign key — the database cannot cascade it away, so
 * the caller has to. The scope is deliberately tight: only support-evidence
 * rows, named either by the id the attachment recorded or by one of the exact
 * public paths that were just removed from disk.
 *
 * @param {Object} params
 * @param {string} params.caseId The case the rows belonged to.
 * @param {string[]} params.documentIds The Document ids the attachments named.
 * @param {string[]} params.publicPaths The public paths that were removed.
 * @returns {Promise<number>} How many rows went.
 */
async function removeAnchoringDocuments({ caseId, documentIds, publicPaths }) {
	const entityTypes = { in: [PRIVATE_ENTITY_TYPE.SUPPORT_CASE, LEGACY_SUPPORT_ENTITY_TYPE] };
	const clauses = [];
	if (documentIds.length > 0) {
		clauses.push({ id: { in: documentIds }, entity_type: entityTypes });
	}
	if (publicPaths.length > 0) {
		clauses.push({ file_path: { in: publicPaths }, entity_type: entityTypes });
	}
	if (clauses.length === 0) {
		return 0;
	}
	try {
		const result = await prisma.document.deleteMany({ where: { OR: clauses } });
		return Number(result?.count ?? 0);
	} catch (error) {
		// The bytes are gone; only the key is left. That is not worth failing
		// the sweep over, but it is worth saying out loud.
		logWarn("case_retention_document_rows_failed", { caseId, message: error.message });
		return 0;
	}
}

/**
 * Sweeps one expired case: its bytes first, then its rows.
 *
 * The order matters. The bytes go first because a failed row deletion can be
 * retried on the next sweep, while a failed byte deletion after the row is
 * gone leaves an orphan nobody can find any more.
 *
 * @param {Object} row The case row, with its attachments.
 * @param {Object} result The accumulator the sweep returns.
 * @returns {Promise<boolean>} True when the case was swept.
 */
async function sweepCase(row, result) {
	const attachments = Array.isArray(row.attachments) ? row.attachments : [];
	const documentIds = [];
	const publicPaths = [];

	for (const attachment of attachments) {
		const outcome = await removeAttachmentBytes(attachment);
		if (outcome.removed) {
			publicPaths.push(outcome.publicPath);
			result.removed.push(outcome.publicPath);
			if (outcome.abs) {
				result.removedFiles.push(outcome.abs);
			}
			const documentId = String(attachment?.document_id ?? "").trim();
			if (documentId) {
				documentIds.push(documentId);
			}
		} else {
			result.retained.push(outcome.publicPath);
			logWarn("case_retention_file_not_removed", {
				caseId: row.id,
				filePath: outcome.publicPath,
				reason: outcome.reason,
			});
		}
	}

	await removeAnchoringDocuments({ caseId: row.id, documentIds, publicPaths });

	try {
		// The case row goes with its messages, investigations and attachment
		// rows: the relations cascade.
		await deleteCase(row.id);
	} catch (error) {
		result.errors.push(`${row.id}: ${error.message || "delete_failed"}`);
		logError("case_retention_case_delete_failed", error.message || error);
		return false;
	}
	return true;
}

/**
 * Removes every case that has outlived the retention window.
 *
 * @param {Date|number|string} [now] The instant to measure from. Injectable
 *   so a test does not have to wait 90 days for the window to close.
 * @returns {Promise<{ swept: number, skipped: number, removed: string[],
 *   removedFiles: string[], retained: string[], errors: string[] }>}
 */
export async function sweepExpiredCases(now) {
	const at = normalizeNow(now);
	const days = retentionDays();
	const cutoff = new Date(at.getTime() - days * DAY_MS);
	const result = { swept: 0, skipped: 0, removed: [], removedFiles: [], retained: [], errors: [] };

	const candidates = await prisma.supportCase.findMany({
		where: { updated_at: { lt: cutoff } },
		include: { attachments: true },
	});

	for (const row of Array.isArray(candidates) ? candidates : []) {
		// The rules are applied here, not left to the query: the query is an
		// optimisation that keeps the whole table out of memory, and the
		// decision is the worker's to make.
		if (shouldSweep(row, cutoff)) {
			const swept = await sweepCase(row, result);
			if (swept) {
				result.swept += 1;
			}
		} else {
			result.skipped += 1;
		}
	}

	logInfo("case_retention_sweep_completed", {
		swept: result.swept,
		skipped: result.skipped,
		removed: result.removed.length,
		retained: result.retained.length,
		errors: result.errors.length,
		retentionDays: days,
	});

	return result;
}

/**
 * Starts the periodic sweep.
 *
 * The shape follows the other worker loops: one sweep on startup, then one
 * per interval, each failure contained so a bad sweep never takes the loop
 * down.
 *
 * @param {Object} [params]
 * @param {number} [params.intervalMs] Overrides CASE_RETENTION_INTERVAL_MS.
 * @returns {{ stop: () => void, intervalMs: number }} A handle to stop it.
 */
export function startCaseRetentionWorker({ intervalMs } = {}) {
	const requested = Number(intervalMs);
	const every = Number.isFinite(requested)
		? Math.max(MIN_INTERVAL_MS, Math.floor(requested))
		: retentionIntervalMs();

	const run = () => {
		sweepExpiredCases().catch((error) => {
			logError("case_retention_sweep_unhandled", error?.message || error);
		});
	};

	logInfo("case_retention_worker_started", {
		intervalMs: every,
		retentionDays: retentionDays(),
	});
	run();

	const timer = setInterval(run, every);

	return {
		intervalMs: every,
		stop() {
			clearInterval(timer);
			logInfo("case_retention_worker_stopping");
		},
	};
}
