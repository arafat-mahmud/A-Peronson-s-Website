/**
 * The investigation queue.
 *
 * One support case is one job. The job starts a read-only opencode runtime,
 * gives every agent role its OWN session, runs the prompts, and writes one
 * `SupportInvestigation` row per role. The `verify` role runs LAST, over the
 * findings the specialists produced, and its verdict is applied to them.
 *
 * Three invariants are the point of this file:
 *
 *  - ONE SESSION PER ROLE. The model's own `task` delegation is denied by the
 *    runtime configuration precisely because it is a privilege-escalation path
 *    (contracts.md §6), so the queue never uses it. Each role gets its own
 *    session and the queue itself is the only thing that fans out.
 *
 *  - A PER-RUN RANDOM PASSWORD. The runtime listens on 127.0.0.1 and is
 *    authenticated with HTTP basic auth. The password is minted per run from
 *    the CSPRNG: never a constant, never reused between runs, never logged.
 *
 *  - THE RUNTIME IS ALWAYS STOPPED. The `finally` block removes the sessions
 *    and stops the runtime, whether the run succeeded, failed to parse, or
 *    threw on the way.
 *
 * The depth is the number of investigations that have been enqueued and have
 * not finished yet - waiting plus running. The media queues report the
 * waiting count only, but a media job takes seconds and an investigation
 * takes minutes: a waiting-only depth would report zero while two
 * investigations were each holding a spawned runtime.
 *
 * What lands in the database, and who reads it:
 *
 *  - The four specialist rows (`lead`, `code`, `repo`, `research`) hold the
 *    findings that role produced, with the confidence each finding carries
 *    AFTER the verification pass was applied.
 *  - The `verify` row holds the FINAL set of findings - every specialist
 *    finding, with the verification applied - together with the verifier's
 *    own summary and limitations. The report builder (Task 6) reads the
 *    verify row for the final set and the specialist rows for the per-agent
 *    log.
 *  - A role whose reply could not be parsed is recorded as `failed`, with
 *    the raw answer in `error`, and contributes NO findings. A failed parse
 *    never becomes an empty-but-successful result.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { logError, logInfo, logWarn } from "../utils/logger.js";
import prisma from "../utils/prisma.js";
import { resolveWithinUploads } from "../utils/signedFileUrl.js";
import { getCaseWithMessages } from "./caseService.js";
import {
	AGENT_ROLES,
	applyVerification,
	buildAgentPrompt,
	buildVerifyPrompt,
	DEFAULT_TOOL_BUDGET,
} from "./investigation/agents.js";
import {
	demoteUnsubstantiated,
	demoteUnverifiedReferences,
	normalizeFindings,
	parseAgentJson,
} from "./investigation/findings.js";
import { parseModelChain } from "./investigation/modelChain.js";
import {
	createInvestigationSession,
	listAvailableModels,
	REPOSITORY_ROOT,
	runAgentPrompt,
	startInvestigationRuntime,
} from "./investigation/opencodeRuntime.js";
import { redactFindingsSecrets, redactReportSecrets } from "./investigation/redaction.js";
import { buildReport } from "./investigation/report.js";
import { buildInvestigationConfig } from "./investigation/runtimeConfig.js";

/** How many investigations may run at once when nothing says otherwise. */
const DEFAULT_CONCURRENCY = 2;

/** The ceiling on `INVESTIGATION_CONCURRENCY`. Each slot holds a runtime. */
const MAX_CONCURRENCY = 16;

/**
 * How long one agent turn may take.
 *
 * A real codebase investigation is NOT a one-shot question: the agent reads a
 * file, greps, reads three more, and only then writes its answer. On a free
 * model that routinely takes several minutes. The first live end-to-end run
 * was cut off at 180s with 17 COMPLETED read-only tool calls and no answer at
 * all - every role died the same way, and the failure was misreported as
 * "the agent did not answer with JSON".
 *
 * Override with INVESTIGATION_AGENT_TIMEOUT_MS. The floor is 60s, so a typo
 * cannot quietly turn a case into a one-minute no-op.
 */
const DEFAULT_AGENT_TIMEOUT_MS = 600_000;
const MIN_AGENT_TIMEOUT_MS = 60_000;

const MIN_TOOL_BUDGET = 4;

/** The timeout one agent turn gets, in milliseconds. */
export function agentTimeoutMs() {
	const raw = Number(process.env.INVESTIGATION_AGENT_TIMEOUT_MS);
	if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_AGENT_TIMEOUT_MS;
	return Math.max(MIN_AGENT_TIMEOUT_MS, raw);
}

/**
 * How many tool calls one agent may spend before it has to answer.
 *
 * The budget is the real fix for an agent that never converges; the timeout is
 * only the backstop. Override with INVESTIGATION_AGENT_TOOL_BUDGET.
 */
export function agentToolBudget() {
	const raw = Number(process.env.INVESTIGATION_AGENT_TOOL_BUDGET);
	if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_TOOL_BUDGET;
	return Math.max(MIN_TOOL_BUDGET, Math.round(raw));
}

/** How much of a failed answer is kept in `error` for inspection. */
const MAX_ERROR_CHARS = 4000;

/** The ceiling on the description handed to an agent. */
const MAX_DESCRIPTION_CHARS = 12_000;

/** How many of the most recent case messages make it into the description. */
const MAX_CONVERSATION_MESSAGES = 20;

/** The role that runs last and tries to refute the other roles' findings. */
const VERIFY_ROLE = "verify";

/** An evidence reference that is a URL rather than a path on disk. */
const URL_REFERENCE_RE = /^https?:\/\//i;

/**
 * The statuses a case may hold when the investigation ends.
 *
 * A case that already reached a terminal status keeps it: the queue never
 * rewrites a case that somebody else has moved on.
 */
const TERMINAL_SOURCE_STATUSES = new Set(["collecting", "investigating", "reporting"]);

/** The roles that investigate, in the order they run. */
const SPECIALIST_ROLES = AGENT_ROLES.filter((role) => role !== VERIFY_ROLE);

/**
 * How many investigations may be WAITING when nothing says otherwise.
 *
 * The concurrency limit bounds how many run at once; it does not bound how
 * many are queued. Without a bound on the backlog, a client that opens a
 * thousand cases fills the queue with a thousand jobs, each of which will
 * hold a spawned runtime, five database rows and an email to every owner and
 * admin when it eventually runs. The queue refuses the work instead, and the
 * caller is told to try again shortly.
 */
const DEFAULT_MAX_QUEUE_DEPTH = 20;

/** The ceiling on the configured queue depth. */
const MAX_QUEUE_DEPTH_CEILING = 200;

/** How many random bytes the runtime password is minted from. */
const PASSWORD_BYTES = 32;

/** Every job that has been enqueued and has not finished yet. */
const QUEUE = [];

/** How many of the queued jobs are running right now. */
let runningCount = 0;

/**
 * The number of investigations that have been enqueued and have not finished
 * yet: waiting plus running.
 *
 * @returns {number}
 */
export function queueDepth() {
	return QUEUE.length;
}

/**
 * How deep the queue may get before it refuses new work.
 *
 * `INVESTIGATION_QUEUE_MAX_DEPTH` overrides the default. A value that is not
 * a positive integer falls back to the default, and a value above the ceiling
 * is clamped.
 *
 * @returns {number}
 */
export function maxQueueDepth() {
	const raw = Number.parseInt(process.env.INVESTIGATION_QUEUE_MAX_DEPTH ?? "", 10);
	if (!Number.isFinite(raw) || raw < 1) {
		return DEFAULT_MAX_QUEUE_DEPTH;
	}
	return Math.min(raw, MAX_QUEUE_DEPTH_CEILING);
}

/**
 * The queue's state, for a caller that has to decide whether to hand a job
 * over.
 *
 * @returns {{depth: number, limit: number, accepting: boolean}}
 */
export function queueCapacity() {
	const limit = maxQueueDepth();
	const depth = QUEUE.length;
	return { depth, limit, accepting: depth < limit };
}

/**
 * Queue an investigation for a support case.
 *
 * The promise resolves when the job has been ACCEPTED: the five
 * `SupportInvestigation` rows exist with `status: "queued"` and the job is on
 * the queue. The investigation itself continues in the background, because it
 * holds a spawned runtime for minutes and an HTTP caller must not wait for
 * it.
 *
 * The queue does not deduplicate. Every call is a distinct run: a re-run
 * creates a new set of rows with a higher `attempt` for the same case and
 * role, and a caller that must not run two investigations at once has to
 * guard the call itself.
 *
 * The queue is BOUNDED. When the backlog is at the limit the call is refused
 * with a 429-shaped error rather than accepted blindly: an unbounded queue is
 * a queue of work that will never be read, and every job in it will spawn a
 * runtime and mail every owner when it eventually runs.
 *
 * @param {string} caseId The support case to investigate.
 * @returns {Promise<void>}
 */
export async function enqueueInvestigation(caseId) {
	const id = typeof caseId === "string" ? caseId.trim() : "";
	if (!id) {
		throw new Error("enqueueInvestigation requires a support case id");
	}

	// The refusal happens BEFORE the rows are created: a refused job must not
	// leave five `queued` rows behind that no worker will ever pick up.
	const capacity = queueCapacity();
	if (!capacity.accepting) {
		const error = new Error("The investigation queue is full - try again shortly.");
		error.status = 429;
		error.code = "INVESTIGATION_QUEUE_FULL";
		logWarn("investigation queue is full", {
			caseId: id,
			depth: capacity.depth,
			limit: capacity.limit,
		});
		throw error;
	}

	const rows = await createQueuedRows(id);

	QUEUE.push({ caseId: id, rows, started: false });
	logInfo("investigation queued", { caseId: id, depth: QUEUE.length, roles: rows.length });

	dispatch();
}

/**
 * Start jobs until the concurrency limit is reached.
 */
function dispatch() {
	while (runningCount < concurrencyLimit()) {
		const job = QUEUE.find((entry) => !entry.started);
		if (!job) {
			return;
		}
		job.started = true;
		runningCount += 1;
		runInvestigation(job)
			.catch((error) => {
				logError("investigation job crashed", error);
			})
			.finally(() => {
				runningCount -= 1;
				const index = QUEUE.indexOf(job);
				if (index !== -1) {
					QUEUE.splice(index, 1);
				}
				logInfo("investigation job finished", { caseId: job.caseId, depth: QUEUE.length });
				dispatch();
			});
	}
}

/**
 * How many investigations may run at once.
 *
 * `INVESTIGATION_CONCURRENCY` overrides the default of 2. A value that is
 * not a positive integer falls back to the default, and a value above the
 * ceiling is clamped - each slot holds a spawned `opencode serve` process, so
 * the number is a resource limit and not a tuning preference.
 */
function concurrencyLimit() {
	const raw = Number.parseInt(process.env.INVESTIGATION_CONCURRENCY ?? "", 10);
	if (!Number.isFinite(raw) || raw < 1) {
		return DEFAULT_CONCURRENCY;
	}
	return Math.min(raw, MAX_CONCURRENCY);
}

/**
 * Create the `queued` row of every role.
 *
 * The rows are created BEFORE the job starts, so a caller that returns from
 * `enqueueInvestigation` can already show the case as queued. `attempt` counts
 * the runs of the same case and role, so a re-run is distinguishable from the
 * run it repeats.
 */
async function createQueuedRows(caseId) {
	const attempts = await readPreviousAttempts(caseId);
	const rows = [];

	for (const role of AGENT_ROLES) {
		const id = crypto.randomUUID();
		const attempt = (attempts.get(role) || 0) + 1;
		try {
			await prisma.supportInvestigation.create({
				data: {
					id,
					case_id: caseId,
					role,
					status: "queued",
					attempt,
				},
			});
		} catch (error) {
			throw new Error(
				`Could not queue an investigation for case ${caseId}: ${error?.message || String(error)}`,
			);
		}
		rows.push({ role, id, attempt });
	}

	return rows;
}

/**
 * The highest attempt number already recorded for each role of a case.
 */
async function readPreviousAttempts(caseId) {
	const attempts = new Map();
	try {
		const existing = await prisma.supportInvestigation.findMany({
			where: { case_id: caseId },
			select: { role: true, attempt: true },
		});
		for (const row of existing || []) {
			const attempt = Number.isFinite(row?.attempt) ? row.attempt : 0;
			if (attempt > (attempts.get(row.role) || 0)) {
				attempts.set(row.role, attempt);
			}
		}
	} catch (error) {
		logWarn("investigation queue could not read the previous attempts", {
			caseId,
			error: error?.message || String(error),
		});
	}
	return attempts;
}

/**
 * Run one investigation: the runtime, the four specialists, the verifier.
 */
async function runInvestigation(job) {
	const { caseId, rows } = job;
	const finished = new Set();
	let runtime = null;
	const sessionIDs = [];

	try {
		const context = await loadCaseContext(caseId);
		if (!context) {
			await failRows(rows, finished, "The support case was not found.");
			await setTerminalStatus(caseId, "failed");
			return;
		}

		runtime = await startInvestigationRuntime({
			cwd: REPOSITORY_ROOT,
			config: buildInvestigationConfig(),
			password: mintRuntimePassword(),
		});

		const models = await pickModels(runtime.client);
		if (!models.length) {
			await failRows(rows, finished, "No free investigation model is available on the runtime.");
			await setTerminalStatus(caseId, "failed");
			return;
		}

		const outcomes = new Map();
		let accumulated = [];

		for (const role of SPECIALIST_ROLES) {
			const prompt = buildAgentPrompt(role, {
				description: context.description,
				evidence: context.evidence,
				toolBudget: agentToolBudget(),
			});
			const outcome = await runRole({
				runtime,
				models,
				role,
				prompt,
				row: findRow(rows, role),
				caseId,
				sessionIDs,
			});
			outcomes.set(role, outcome);
			finished.add(role);
			if (outcome.status === "complete") {
				accumulated = accumulated.concat(outcome.findings);
			}
		}

		await runVerification({
			runtime,
			models,
			caseId,
			context,
			candidates: accumulated,
			outcomes,
			rows,
			finished,
			sessionIDs,
		});

		// The investigation is over: the case waits for its report now. The
		// update only moves a case that is still `investigating`, so the queue
		// can never undo a state the case has already left.
		await advanceCaseStatus(caseId, "reporting");

		// The report, the escalation, the mail and the terminal status. This
		// is the end of the job: without it the investigation would run and
		// nobody would ever read what it found.
		await finalizeInvestigation({ caseId, rows });
	} catch (error) {
		logError("investigation failed", error);
		await failRows(rows, finished, error?.message || String(error));
		await setTerminalStatus(caseId, "failed");
	} finally {
		await removeSessions(runtime, sessionIDs);
		await stopRuntime(runtime);
	}
}

/**
 * Run the verify role LAST, over the findings the specialists produced, and
 * apply its verdict to them.
 */
async function runVerification({
	runtime,
	models,
	caseId,
	context,
	candidates,
	outcomes,
	rows,
	finished,
	sessionIDs,
}) {
	const prompt = buildVerifyPrompt({
		description: context.description,
		candidateFindings: candidates,
		toolBudget: agentToolBudget(),
	});

	const outcome = await runRole({
		runtime,
		models,
		role: VERIFY_ROLE,
		prompt,
		row: findRow(rows, VERIFY_ROLE),
		caseId,
		sessionIDs,
	});
	finished.add(VERIFY_ROLE);

	// The verdict is built from what the verifier actually said. A refuted
	// candidate comes back as a finding whose detail is the candidate's exact
	// detail; an unsupported candidate comes back as its exact detail in one
	// `limitations` entry.
	const verdict = buildVerdict(outcome, candidates);
	const applied = applyVerification(candidates, verdict);

	// Every specialist row carries the confidence its finding ends up with,
	// so a refuted claim is not left behind as "confirmed" in the row it came
	// from.
	for (const role of SPECIALIST_ROLES) {
		const specialist = outcomes.get(role);
		if (!specialist || specialist.status !== "complete") {
			continue;
		}
		const adjusted = applyVerification(specialist.findings, verdict).findings;
		await updateRow(findRow(rows, role), {
			findings: {
				summary: specialist.summary,
				findings: adjusted,
				limitations: specialist.limitations,
			},
		});
	}

	// The verify row is the final row: it holds the whole set of findings
	// with the verification applied, so the report builder has one place to
	// read the outcome from.
	//
	// The findings themselves are already redacted: they are the
	// specialists' findings, which were redacted when they were recorded.
	// The verifier's OWN summary and limitations are its own prose, so they
	// are redacted here.
	await updateRow(findRow(rows, VERIFY_ROLE), {
		findings: {
			summary: outcome.status === "complete" ? redactReportSecrets(outcome.summary) : "",
			findings: applied.findings,
			limitations: outcome.status === "complete" ? redactFindingsSecrets(outcome.limitations) : [],
		},
	});

	logInfo("investigation verified", {
		caseId,
		candidates: candidates.length,
		refuted: applied.refuted.length,
	});
}

/**
 * Run one role, falling back through the free model chain.
 *
 * The free tier's quota is PER MODEL, so the first model of the chain can be
 * exhausted while the fourth still answers. A role that gave up on the first
 * refusal is a role that produced no findings for a reason that has nothing
 * to do with the question.
 *
 * Only two failures are worth retrying on another model: the model REFUSED
 * the request (a quota, a rate limit, a provider error) and the model
 * answered with something the parser could not read. A timeout or a wedge is
 * NOT retried - the model was working, it just needed longer, and retrying
 * would double the wall clock for the same result.
 *
 * @returns {Promise<{role: string, status: string, findings: object[], limitations: string[], summary: string, error?: string}>}
 */
async function runRole({ runtime, models, role, prompt, row, caseId, sessionIDs }) {
	if (!row) {
		return { role, status: "failed", findings: [], limitations: [], summary: "", error: "no row" };
	}

	const chain = (Array.isArray(models) ? models : [models]).filter(Boolean);
	if (!chain.length) {
		const error = "No free investigation model is available on the runtime.";
		await finishRow(row, { status: "failed", error });
		await emitProgress(caseId, role, "failed", error);
		return { role, status: "failed", findings: [], limitations: [], summary: "", error };
	}

	let lastError = "";
	const attempts = [];
	for (const model of chain) {
		const outcome = await runRoleOnce({ runtime, model, role, prompt, row, caseId, sessionIDs });
		if (outcome.status === "complete") {
			return outcome;
		}
		lastError = outcome.error || lastError;
		attempts.push(`${model.id}: ${lastError}`);
		if (!outcome.retryable) {
			return outcome;
		}
		logWarn("investigation model did not deliver; trying the next free model", {
			caseId,
			role,
			model: model.id,
			error: outcome.error,
		});
	}

	// Every attempt's failure is kept, not just the last one: the row used to
	// be OVERWRITTEN by each fallback, so the reason the FIRST model failed
	// was lost by the time anyone looked at it.
	const error = truncate(
		`Every free model in the chain failed for this role. Attempts:\n${attempts.join("\n")}`,
		MAX_ERROR_CHARS,
	);
	await finishRow(row, { status: "failed", error });
	await emitProgress(caseId, role, "failed", error);
	return { role, status: "failed", findings: [], limitations: [], summary: "", error };
}

/**
 * One attempt at one role with one model.
 *
 * @returns {Promise<{role: string, status: string, findings: object[], limitations: string[], summary: string, error?: string, retryable?: boolean}>}
 */
async function runRoleOnce({ runtime, model, role, prompt, row, caseId, sessionIDs }) {
	await updateRow(row, {
		status: "running",
		attempt: row.attempt,
		model_id: model.id,
		prompt,
		started_at: new Date(),
	});
	await emitProgress(caseId, role, "running");

	let toolCalls = [];

	try {
		const sessionID = await createInvestigationSession({
			client: runtime.client,
			title: `investigation ${role} ${caseId}`,
			model,
			directory: REPOSITORY_ROOT,
		});
		sessionIDs.push(sessionID);

		const result = await runAgentPrompt({
			client: runtime.client,
			sessionID,
			text: prompt,
			timeoutMs: agentTimeoutMs(),
		});
		toolCalls = normalizeToolCalls(result?.toolCalls);
		const rawText = typeof result?.text === "string" ? result.text : "";

		if (result?.error) {
			const error = truncate(result.error, MAX_ERROR_CHARS);
			// A model that REFUSED the request is worth retrying on the next
			// model of the chain: the free tier's quota is per model.
			const retryable = result?.errorKind === "model_refused";
			if (!retryable) {
				await finishRow(row, { status: "failed", error, tool_log: toolCalls });
				await emitProgress(caseId, role, "failed", error);
			}
			return {
				role,
				status: "failed",
				findings: [],
				limitations: [],
				summary: "",
				error,
				retryable,
			};
		}

		const parsed = parseAgentJson(rawText);
		if (!parsed.ok) {
			// The model EXPLAINED itself instead of answering in the contract.
			// That is the commonest way a free model misses the answer format:
			// "Based on my investigation, I can now provide a..." and then the
			// JSON, or a preamble and no JSON at all.
			//
			// The session still holds the work, so ONE more turn in the SAME
			// session - "reply with only the JSON object" - costs a single call
			// and recovers the answer without re-running the investigation.
			const nudged = await nudgeForJson({
				client: runtime.client,
				sessionID,
				timeoutMs: agentTimeoutMs(),
			});
			const retry = nudged ? parseAgentJson(nudged) : { ok: false, reason: "no_nudge" };
			if (retry.ok) {
				return finishRoleWithFindings({
					runtime,
					model,
					role,
					row,
					caseId,
					parsed: retry.value,
					toolCalls,
				});
			}
			// The raw answer is kept so the failure can be inspected, and NO
			// findings are recorded from a reply that could not be parsed.
			const error = truncate(
				`The agent did not answer with JSON (${parsed.reason}). Raw answer: ${rawText}`,
				MAX_ERROR_CHARS,
			);
			// A model that answered with something unreadable is worth retrying
			// on the next model of the chain: the models differ in how well they
			// follow the answer contract.
			const retryable = true;
			await finishRow(row, { status: "failed", error, tool_log: toolCalls });
			await emitProgress(caseId, role, "failed", error);
			return {
				role,
				status: "failed",
				findings: [],
				limitations: [],
				summary: "",
				error,
				retryable,
			};
		}

		return finishRoleWithFindings({
			runtime,
			model,
			role,
			row,
			caseId,
			parsed: parsed.value,
			toolCalls,
		});
	} catch (error) {
		const message = truncate(error?.message || String(error), MAX_ERROR_CHARS);
		await finishRow(row, { status: "failed", error: message, tool_log: toolCalls });
		await emitProgress(caseId, role, "failed", message);
		return { role, status: "failed", findings: [], limitations: [], summary: "", error: message };
	}
}

/**
 * Record a role's findings and tell everybody.
 *
 * The demotions run FIRST, on what the agent actually said: the resolver has
 * to see the cited path, not the redacted text.
 *
 * Then the redaction runs, and it runs on the WHOLE payload - the detail, the
 * evidence references, the summary and the limitations. The report is not the
 * only consumer of a finding: the raw findings are stored on the row and
 * pushed to the client over SSE, and the client renders `finding.detail` as it
 * stands. A redacted report with an un-redacted finding is a secret with a lid
 * on one end.
 */
async function finishRoleWithFindings({ role, row, caseId, parsed, toolCalls }) {
	const findings = redactFindingsSecrets(
		demoteUnverifiedReferences(demoteUnsubstantiated(normalizeFindings(parsed)), {
			isResolvable: resolvesInsideRepository,
		}),
	);
	const limitations = redactFindingsSecrets(toStringList(parsed?.limitations));
	const summary = redactReportSecrets(typeof parsed?.summary === "string" ? parsed.summary : "");

	await finishRow(row, {
		status: "complete",
		findings: { summary, findings, limitations },
		evidence: buildEvidence(findings, toolCalls),
		tool_log: toolCalls,
	});

	for (const finding of findings) {
		await emitFinding(caseId, role, finding);
	}
	await emitProgress(caseId, role, "complete");

	return { role, status: "complete", findings, limitations, summary };
}

/**
 * Ask the model, in the SAME session, to give the answer as JSON.
 *
 * A free model that explained itself instead of answering in the contract has
 * usually ALREADY DONE the work - the answer is one formatting step away, and
 * the session still holds the context. One more turn costs a single call and
 * does not re-run the investigation.
 *
 * @returns {Promise<string|null>} The nudged text, or null if the nudge failed.
 */
async function nudgeForJson({ client, sessionID, timeoutMs }) {
	const nudge = [
		"Your previous reply was not a JSON object.",
		"Reply with ONLY the JSON object itself: it must start with { and end with }.",
		"No prose before it, no prose after it, no explanation, no code fence.",
		"Use exactly this shape: {summary, findings:[{confidence, detail, evidence:[{file, lines, commit, url}]}], limitations}",
		"confidence is one of confirmed, probable, speculative.",
	].join(" ");

	try {
		const result = await runAgentPrompt({ client, sessionID, text: nudge, timeoutMs });
		if (result?.error) {
			return null;
		}
		const text = typeof result?.text === "string" ? result.text : "";
		return text.trim() ? text : null;
	} catch {
		return null;
	}
}

/**
 * Build the verifier's verdict out of what it said.
 *
 * A refuted candidate comes back as a finding whose `detail` is the
 * candidate's exact `detail`; an unsupported candidate comes back as its exact
 * `detail` string in one `limitations` entry.
 */
function buildVerdict(outcome, candidates) {
	const refuted = [];
	const unsupported = [];

	if (outcome?.status === "complete") {
		for (const finding of outcome.findings) {
			const detail = normalizeDetail(finding?.detail);
			if (!detail) {
				continue;
			}
			if (matchesCandidate(detail, candidates) && !refuted.includes(detail)) {
				refuted.push(detail);
			}
		}
		for (const limitation of outcome.limitations) {
			const detail = normalizeDetail(limitation);
			if (!detail) {
				continue;
			}
			if (matchesCandidate(detail, candidates) && !unsupported.includes(detail)) {
				unsupported.push(detail);
			}
		}
	}

	return { refuted, unsupported };
}

/**
 * Is this detail one of the candidates' details?
 */
function matchesCandidate(detail, candidates) {
	return candidates.some((candidate) => normalizeDetail(candidate?.detail) === detail);
}

/**
 * Read the case and turn it into the context the agents are given.
 */
async function loadCaseContext(caseId) {
	const caseRow = await getCaseWithMessages(caseId);
	if (!caseRow) {
		return null;
	}

	let attachments = [];
	try {
		attachments =
			(await prisma.supportCaseAttachment.findMany({ where: { case_id: caseId } })) || [];
	} catch (error) {
		logWarn("investigation queue could not read the case attachments", {
			caseId,
			error: error?.message || String(error),
		});
	}

	const messages = Array.isArray(caseRow.messages) ? caseRow.messages : [];

	return {
		description: buildDescription(caseRow, messages),
		evidence: buildEvidenceList(caseRow, attachments),
	};
}

/**
 * The description handed to every agent: the subject, the summary the client
 * confirmed, and the conversation.
 */
function buildDescription(caseRow, messages) {
	const parts = [];

	const subject = typeof caseRow.subject === "string" ? caseRow.subject.trim() : "";
	if (subject) {
		parts.push(`Subject: ${subject}`);
	}

	const summary = typeof caseRow.summary === "string" ? caseRow.summary.trim() : "";
	if (summary) {
		parts.push(`Confirmed summary:\n${summary}`);
	}

	const recent = messages.slice(-MAX_CONVERSATION_MESSAGES);
	if (recent.length > 0) {
		const lines = recent.map((message) => {
			const who = typeof message?.role === "string" ? message.role : "unknown";
			const content = typeof message?.content === "string" ? message.content.trim() : "";
			return content ? `[${who}] ${content}` : "";
		});
		const conversation = lines.filter(Boolean).join("\n");
		if (conversation) {
			parts.push(`Conversation:\n${conversation}`);
		}
	}

	const description = parts.join("\n\n");
	return description.length > MAX_DESCRIPTION_CHARS
		? description.slice(0, MAX_DESCRIPTION_CHARS)
		: description;
}

/**
 * Does the cited evidence file resolve to a file inside the repository?
 *
 * A finding that cites a path that was never opened - or that points outside
 * the tree - is an unverified reference, not evidence, and it may not keep
 * the confidence the agent gave it. The check is deliberately narrow: the
 * path has to resolve to a real FILE under the canonical repository root.
 *
 * A path that carries a line range (`server/server.js:120`) is accepted when
 * the path without the range resolves, because that is how an agent writes
 * a reference when it puts the line in the file field.
 *
 * A URL is a legitimate reference and is NOT demoted for not being a file:
 * the demotion is a claim that the reference does not resolve, and a URL
 * resolves by being a URL - it is verified by the reference existing in the
 * report, not by a filesystem lookup. Only a filesystem path that does not
 * exist is demoted.
 *
 * @param {string} file The cited path.
 * @returns {boolean}
 */
export function resolvesInsideRepository(file) {
	const reference = String(file || "").trim();
	if (!reference) {
		return false;
	}
	if (URL_REFERENCE_RE.test(reference)) {
		return true;
	}
	const candidates = [reference, reference.replace(/:\d+(?:-\d+)?$/, "")];
	for (const candidate of candidates) {
		const relative = candidate.replace(/\\/g, "/").trim();
		if (!relative) {
			continue;
		}
		const resolved = path.resolve(REPOSITORY_ROOT, relative);
		if (resolved !== REPOSITORY_ROOT && !resolved.startsWith(`${REPOSITORY_ROOT}${path.sep}`)) {
			continue;
		}
		try {
			if (fs.statSync(resolved).isFile()) {
				return true;
			}
		} catch {
			// not a file, or not readable
		}
	}
	return false;
}

/**
 * The evidence handed to every agent: what the client attached, and the
 * ticket the case belongs to.
 */
function buildEvidenceList(caseRow, attachments) {
	const evidence = [];

	const ticket = typeof caseRow.ticket_id === "string" ? caseRow.ticket_id.trim() : "";
	if (ticket) {
		evidence.push(`Ticket: ${ticket}`);
	}

	for (const attachment of attachments || []) {
		const filePath = typeof attachment?.file_path === "string" ? attachment.file_path.trim() : "";
		if (!filePath) {
			continue;
		}
		const mime = typeof attachment?.mime_type === "string" ? attachment.mime_type.trim() : "";
		// The agent's read tool is rooted at the REPOSITORY, so the PUBLIC path
		// (/uploads/support/x.png) cannot be opened: the agent resolves it
		// against the repository root and gets "File not found". The second
		// live end-to-end run lost the client's screenshot that way - the
		// `lead` role spent a tool call on a path that does not exist. Give it
		// the absolute path it can actually open.
		const absolute = resolveWithinUploads(filePath);
		const label = absolute ?? filePath;
		evidence.push(mime ? `${label} (${mime})` : label);
	}

	if (evidence.some((entry) => /image\//i.test(entry))) {
		evidence.push(
			"(A binary image may not be readable as text. If you cannot open one, say so in `limitations` - do not guess at what it shows.)",
		);
	}

	return evidence;
}

/**
 * The `evidence` column of a row: the files and commits the findings cite,
 * and the tool calls that failed.
 *
 * `queries` stays empty: the runtime reports a tool call as
 * `{tool, status, error?}` and carries no query text, so there is nothing to
 * record without inventing it.
 */
function buildEvidence(findings, toolCalls) {
	const files = [];
	const commits = [];
	const failures = [];

	for (const finding of findings || []) {
		for (const entry of finding?.evidence || []) {
			if (typeof entry?.file === "string" && entry.file && !files.includes(entry.file)) {
				files.push(entry.file);
			}
			if (typeof entry?.commit === "string" && entry.commit && !commits.includes(entry.commit)) {
				commits.push(entry.commit);
			}
		}
	}

	for (const call of toolCalls || []) {
		if (call?.status === "error" && call.error) {
			failures.push(`${call.tool}: ${call.error}`);
		}
	}

	return { files, commits, queries: [], failures };
}

/**
 * The tool log of a row: exactly `{ tool, status, error? }` per call.
 */
function normalizeToolCalls(toolCalls) {
	if (!Array.isArray(toolCalls)) {
		return [];
	}
	return toolCalls.map((call) => {
		const entry = {
			tool: typeof call?.tool === "string" ? call.tool : "unknown",
			status: typeof call?.status === "string" ? call.status : "unknown",
		};
		if (typeof call?.error === "string" && call.error) {
			entry.error = call.error;
		}
		return entry;
	});
}

/**
 * Every model of the chain the runtime actually offers, IN ORDER.
 *
 * The chain holds free models only (see investigation/modelChain.js), so the
 * portal never spends somebody else's money on an investigation.
 *
 * The ORDER matters, because the free tier's quota is PER MODEL. Measured
 * against a live runtime on an exhausted account: deepseek-v4.1-flash-free,
 * mimo-v2.6-flash-free and glm-5.3-flash-free all answered HTTP 429
 * "provider.quota" while minimax-m3.1-flash-free answered normally. A chain
 * that is only used to PICK the first model buys nothing - it has to be used
 * to FALL BACK.
 */
async function pickModels(client) {
	const available = await listAvailableModels(client);
	const chain = parseModelChain(process.env.OPENCODE_INVESTIGATION_MODELS);
	return chain.filter((candidate) =>
		(available || []).some(
			(model) => model?.id === candidate.id && model?.providerID === candidate.providerID,
		),
	);
}

/**
 * Mint the password of one runtime run.
 *
 * It is random, it is different for every run, and it exists only for the
 * lifetime of the runtime process.
 */
function mintRuntimePassword() {
	return crypto.randomBytes(PASSWORD_BYTES).toString("hex");
}

/**
 * Find the row of one role.
 */
function findRow(rows, role) {
	return (rows || []).find((row) => row.role === role) || null;
}

/**
 * Update one row, ignoring a row that is not there.
 */
async function updateRow(row, data) {
	if (!row?.id) {
		return;
	}
	try {
		await prisma.supportInvestigation.update({ where: { id: row.id }, data });
	} catch (error) {
		logWarn("investigation queue could not update a row", {
			role: row.role,
			error: error?.message || String(error),
		});
	}
}

/**
 * Update one row and stamp the end of its run.
 */
async function finishRow(row, data) {
	await updateRow(row, { ...data, completed_at: new Date() });
}

/**
 * Record the failure of every role that has not finished.
 */
async function failRows(rows, finished, message) {
	for (const row of rows || []) {
		if (finished.has(row.role)) {
			continue;
		}
		await finishRow(row, { status: "failed", error: truncate(message, MAX_ERROR_CHARS) });
	}
}

/**
 * The end of the investigation: the report, the escalation, the delivery and
 * the terminal status of the case.
 *
 * The order is the point, and two of the steps are deliberately independent:
 *
 *  - The REPORT is written before the mail goes out, so a mail that never
 *    leaves the box still leaves a report the admin console can read.
 *  - The ESCALATION does not wait for the mail. A confirmed security or
 *    data-loss finding must reach the owners even when the mail provider is
 *    broken, so the escalation runs first, on its own, and its outcome is
 *    never read by the mail path (or the other way round).
 *  - Every step is contained. A step that fails is logged and the next one
 *    still runs: a broken mail provider must not cost the owner the
 *    escalation, and a broken escalation must not cost the owner the report.
 *
 * @param {Object} params
 * @param {string} params.caseId The case the run belongs to.
 * @param {Array<{role: string, id: string, attempt: number}>} params.rows The
 *   rows THIS run created.
 * @returns {Promise<void>}
 */
async function finalizeInvestigation({ caseId, rows }) {
	const found = await getCaseWithMessages(caseId);
	const caseRow = found && typeof found === "object" ? found : null;
	const messages = Array.isArray(found?.messages) ? found.messages : [];

	// The rows that go INTO the report have their own `report` column
	// blanked: the report quotes the rows, and a row that already holds a
	// report would put the previous report inside the new one.
	const investigations = (await readRunRows(caseId, rows)).map((row) => ({
		...row,
		report: null,
	}));

	let report = "";
	try {
		report = buildReport({ caseRow, messages, investigations });
	} catch (error) {
		logError("investigation report build failed", error);
	}
	// The report is redacted BEFORE it is written down. The investigators can
	// read the whole repository, and the repository holds credentials: a
	// report that quotes one would put it into the database, and from there
	// into the owner's inbox and the client's browser.
	const safeReport = redactReportSecrets(report);
	await persistReport(rows, safeReport);

	await escalate(caseId, finalFindings(investigations));
	await deliver(caseRow, safeReport);
	await setTerminalStatus(caseId, "completed");
}

/**
 * The rows of THIS run.
 *
 * A case holds one set of rows per attempt, so a re-run leaves the previous
 * run's rows behind. The report describes the run that just happened, so
 * only this run's rows are read.
 *
 * @param {string} caseId
 * @param {Array<{id: string}>} rows
 * @returns {Promise<Array<Object>>}
 */
async function readRunRows(caseId, rows) {
	const ids = new Set((rows || []).map((row) => row?.id).filter(Boolean));
	if (ids.size === 0) {
		return [];
	}
	try {
		const all = await prisma.supportInvestigation.findMany({ where: { case_id: caseId } });
		return (all || []).filter((row) => ids.has(row?.id));
	} catch (error) {
		logWarn("investigation queue could not read the run rows", {
			caseId,
			error: error?.message || String(error),
		});
		return [];
	}
}

/**
 * The FINAL set of findings of the run: the verify row's findings, which
 * hold every specialist finding with the verification applied.
 *
 * @param {Array<Object>} investigations
 * @returns {{summary: string, findings: Array<Object>, limitations: Array<string>}}
 */
function finalFindings(investigations) {
	const verify = (investigations || []).find((row) => row?.role === VERIFY_ROLE);
	const payload = verify?.findings;
	if (payload && typeof payload === "object" && !Array.isArray(payload)) {
		return payload;
	}

	// No verify row (the verification run itself failed): the specialists'
	// own findings are what is left.
	const findings = [];
	for (const row of investigations || []) {
		const rowPayload = row?.findings;
		if (Array.isArray(rowPayload)) {
			findings.push(...rowPayload);
		} else if (Array.isArray(rowPayload?.findings)) {
			findings.push(...rowPayload.findings);
		}
	}
	return { summary: "", findings, limitations: [] };
}

/**
 * Write the report to the verify row of this run.
 *
 * The report is stored on ONE row - the verify row, the one that holds the
 * final set of findings - because that is where the admin console reads it
 * from, and because a report that is copied onto every row would be copied
 * five times.
 *
 * @param {Array<{role: string, id: string}>} rows
 * @param {string} report
 * @returns {Promise<boolean>}
 */
async function persistReport(rows, report) {
	const verify = findRow(rows, VERIFY_ROLE);
	if (!verify?.id || typeof report !== "string" || report === "") {
		return false;
	}
	try {
		await prisma.supportInvestigation.update({
			where: { id: verify.id },
			data: { report },
		});
		return true;
	} catch (error) {
		logWarn("investigation queue could not persist the report", {
			role: verify.role,
			error: error?.message || String(error),
		});
		return false;
	}
}

/**
 * The delivery module, loaded on demand.
 *
 * It belongs to the report workstream and pulls the mail service in with it,
 * so it is loaded lazily: a checkout without it must still finish the
 * investigation and write the report.
 *
 * @returns {Promise<Object|null>}
 */
async function loadDeliveryModule() {
	try {
		return await import("./investigation/delivery.js");
	} catch (error) {
		logWarn("investigation delivery module is not available", {
			error: error?.message || String(error),
		});
		return null;
	}
}

/**
 * Escalate the case when the final findings call for it.
 *
 * This path never reads the mail result: a confirmed security finding must
 * not wait for (or be swallowed by) a mail failure.
 *
 * @param {string} caseId
 * @param {unknown} findings The final findings of the run.
 * @returns {Promise<boolean>}
 */
async function escalate(caseId, findings) {
	try {
		const delivery = await loadDeliveryModule();
		if (typeof delivery?.escalateIfNeeded !== "function") {
			return false;
		}
		return await delivery.escalateIfNeeded(caseId, findings);
	} catch (error) {
		logError("investigation escalation failed", error);
		return false;
	}
}

/**
 * Mail the report to the owners and record the verdict on the case.
 *
 * @param {Object} caseRow
 * @param {string} report
 * @returns {Promise<{ok: boolean, status?: string, error?: string}>}
 */
async function deliver(caseRow, report) {
	try {
		const delivery = await loadDeliveryModule();
		if (typeof delivery?.deliverReport !== "function") {
			return { ok: false, status: "failed", error: "delivery_unavailable" };
		}
		return await delivery.deliverReport({ caseRow, report });
	} catch (error) {
		logError("investigation report delivery failed", error);
		return { ok: false, status: "failed", error: error?.message || String(error) };
	}
}

/**
 * Move the case to its terminal status.
 *
 * The transition is forward-only: a case that already reached a terminal
 * status keeps it, and a case that is still live work is moved. The read is
 * a guard, not the decision - the write is unconditional, so two runs that
 * finish at the same time cannot leave the case in between.
 *
 * @param {string} caseId
 * @param {string} status "completed" or "failed".
 * @returns {Promise<boolean>}
 */
async function setTerminalStatus(caseId, status) {
	try {
		const found = await getCaseWithMessages(caseId);
		const current = String(found?.status || "");
		if (!TERMINAL_SOURCE_STATUSES.has(current)) {
			return false;
		}
		await prisma.supportCase.update({
			where: { id: caseId },
			data: { status, updated_at: new Date() },
		});
		await emitCaseStatus(caseId, status);
		return true;
	} catch (error) {
		logWarn("investigation queue could not set the terminal case status", {
			caseId,
			status,
			error: error?.message || String(error),
		});
		return false;
	}
}

/**
 * Move the case on, but only forwards.
 *
 * The update is conditional on the case still being `investigating`, so the
 * queue can never move a case back to a state it has already left.
 */
async function advanceCaseStatus(caseId, status) {
	try {
		const result = await prisma.supportCase.updateMany({
			where: { id: caseId, status: "investigating" },
			data: { status },
		});
		if (result?.count) {
			await emitCaseStatus(caseId, status);
		}
	} catch (error) {
		logWarn("investigation queue could not advance the case status", {
			caseId,
			status,
			error: error?.message || String(error),
		});
	}
}

/**
 * Remove the sessions the run created.
 *
 * They are removed before the runtime is stopped: after the stop there is no
 * server left to answer the request.
 */
async function removeSessions(runtime, sessionIDs) {
	if (!runtime?.client) {
		return;
	}
	for (const sessionID of sessionIDs || []) {
		try {
			await runtime.client.session.remove({ sessionID });
		} catch (error) {
			logWarn("investigation queue could not remove a session", {
				sessionID,
				error: error?.message || String(error),
			});
		}
	}
}

/**
 * Stop the runtime. It holds a spawned process and a port.
 */
async function stopRuntime(runtime) {
	if (!runtime) {
		return;
	}
	try {
		await runtime.stop();
	} catch (error) {
		logWarn("investigation queue could not stop the runtime", {
			error: error?.message || String(error),
		});
	}
}

/**
 * The case event emitter, if the realtime bus has one.
 *
 * `emitCaseEvent` belongs to the case API workstream, and it may not exist
 * yet when this module runs, so it is looked up through the module namespace
 * instead of a static import: a missing export is not a reason for the whole
 * investigation to fail.
 */
async function getCaseEventEmitter() {
	try {
		const module = await import("../realtime/realtimeBus.js");
		return typeof module.emitCaseEvent === "function" ? module.emitCaseEvent : null;
	} catch {
		return null;
	}
}

async function emitCaseEvent(type, payload) {
	const emitter = await getCaseEventEmitter();
	if (!emitter) {
		return;
	}
	try {
		emitter(payload.caseId, type, payload);
	} catch (error) {
		logWarn("investigation queue could not emit a case event", {
			type,
			error: error?.message || String(error),
		});
	}
}

function emitProgress(caseId, role, status, detail) {
	return emitCaseEvent("support.case.progress", { caseId, role, status, detail });
}

function emitFinding(caseId, role, finding) {
	return emitCaseEvent("support.case.finding", { caseId, role, finding });
}

function emitCaseStatus(caseId, status) {
	return emitCaseEvent("support.case.status", { caseId, status });
}

/**
 * Trim a string without touching its content.
 *
 * `sanitizeString` (server/utils/validators.js) escapes HTML, which would
 * corrupt the raw agent answer the `error` column exists to keep readable.
 */
function truncate(value, max) {
	const text = typeof value === "string" ? value : String(value ?? "");
	return text.length > max ? text.slice(0, max) : text;
}

function toStringList(value) {
	if (!Array.isArray(value)) {
		return [];
	}
	return value
		.filter((entry) => typeof entry === "string" && entry.trim())
		.map((entry) => entry.trim());
}

function normalizeDetail(value) {
	return typeof value === "string" ? value.trim() : "";
}
