/**
 * Markdown report renderer for the AI support investigation portal.
 *
 * `buildReport` turns one support case - its thread and its investigation runs -
 * into the Markdown report that the admin console renders and that the
 * delivery email links to.
 *
 * Two rules shape the output, and both exist because a plausible-looking
 * report is worse than an obviously incomplete one:
 *
 *  1. A FAILED investigation run renders as INCOMPLETE, carrying its error.
 *     It is never rendered as "no findings found". A run that crashed did not
 *     look for anything, so its silence is not an answer, and the report must
 *     not read as if it were one.
 *  2. A finding with no evidence reference renders as SPECULATIVE. The
 *     pipeline has no path that promotes an unevidenced claim, and neither
 *     has this renderer: it re-applies the demotion on the way out, so a row
 *     written by anything other than the findings pipeline cannot smuggle an
 *     unevidenced claim into the "confirmed" group.
 *
 * The renderer is total: it never throws on missing or malformed input. A
 * report that fails to render is a report nobody gets, and the failure would
 * be indistinguishable from a failed investigation.
 */

import { ALWAYS_DENIED_TOOL_NAMES, ALWAYS_DISABLED_MCP_PATTERNS } from "./runtimeConfig.js";

/** The confidence buckets, in the order they are reported. */
const CONFIDENCE_LEVELS = ["confirmed", "probable", "speculative"];

/** Anything that is not one of the three buckets is reported as speculative. */
const DEFAULT_CONFIDENCE = "speculative";

/** The agent roles, in the order the pipeline runs them. */
const ROLE_ORDER = ["lead", "code", "repo", "research", "verify"];

/**
 * The roles the CLIENT speaks under. The schema documents `client`, and
 * `caseService.appendCaseMessage` documents `user`; both are accepted so the
 * "original complaint" is found either way.
 */
const CLIENT_ROLES = new Set(["client", "user"]);

/** The line break used to split a multi-line detail. */
const LINE_BREAK = /\r?\n/;

/** The placeholder used for an absent value. */
const EMPTY = "-";

/** Fallbacks used only if `runtimeConfig.js` ever stops exporting them. */
const FALLBACK_DENIED_TOOLS = [
	"edit",
	"bash",
	"webfetch",
	"websearch",
	"question",
	"external_directory",
	"doom_loop",
	"task",
];
const FALLBACK_DISABLED_MCP = [
	"render_*",
	"chrome-devtools_*",
	"blender-mcp_*",
	"minecraft_*",
	"github_*",
	"parallel-search_*",
];

function text(value) {
	return String(value ?? "").trim();
}

function singleLine(value) {
	return text(value).replace(/\s+/g, " ");
}

function asArray(value) {
	return Array.isArray(value) ? value : [];
}

/**
 * A Prisma `Json` column arrives already parsed. A hand-built row (a test
 * fixture, a queue payload) may arrive as a JSON string, so both are read.
 */
function parseJsonColumn(value) {
	if (value === null || value === undefined) {
		return null;
	}
	if (typeof value === "string") {
		const trimmed = value.trim();
		if (trimmed === "") {
			return null;
		}
		try {
			return JSON.parse(trimmed);
		} catch {
			return trimmed;
		}
	}
	return value;
}

function formatTimestamp(value) {
	if (value === null || value === undefined || value === "") {
		return EMPTY;
	}
	const date = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(date.getTime())) {
		return singleLine(value) || EMPTY;
	}
	return date.toISOString();
}

function tableCell(value) {
	return singleLine(value).replace(/\|/g, "\\|");
}

function describeValue(value) {
	if (value === null || value === undefined) {
		return EMPTY;
	}
	if (typeof value === "object") {
		return JSON.stringify(value);
	}
	return String(value);
}

/**
 * One item of a list that may hold strings or objects. Objects are expanded
 * into their own key/value lines, so every recorded value survives into the
 * report instead of being flattened into `[object Object]`.
 */
function renderItemList(items, indent = "") {
	const lines = [];
	for (const item of asArray(items).filter((entry) => entry !== null && entry !== undefined)) {
		if (typeof item === "object" && !Array.isArray(item)) {
			const entries = Object.entries(item).filter(
				([, value]) => value !== null && value !== undefined && text(value) !== "",
			);
			if (entries.length > 0) {
				const [firstKey, firstValue] = entries[0];
				lines.push(`${indent}- ${firstKey}: ${describeValue(firstValue)}`);
				for (const [key, value] of entries.slice(1)) {
					lines.push(`${indent}  - ${key}: ${describeValue(value)}`);
				}
			}
		} else {
			const value = singleLine(describeValue(item));
			if (value !== "") {
				lines.push(`${indent}- ${value}`);
			}
		}
	}
	return lines;
}

/**
 * Coerce a recorded confidence to one of the three buckets. Anything
 * unrecognised becomes speculative - there is no fourth bucket and no path
 * that promotes an unknown value.
 */
function normalizeConfidence(value) {
	const candidate = singleLine(value).toLowerCase();
	return CONFIDENCE_LEVELS.includes(candidate) ? candidate : DEFAULT_CONFIDENCE;
}

/**
 * Normalize one evidence reference. The recorded shape is
 * `{ file, lines, commit, url }`; a bare string is accepted as a file.
 */
function normalizeEvidenceEntry(entry) {
	if (entry === null || entry === undefined) {
		return null;
	}
	if (typeof entry === "string") {
		const value = entry.trim();
		return value === "" ? null : { file: value, lines: "", commit: "", url: "" };
	}
	if (typeof entry !== "object" || Array.isArray(entry)) {
		return null;
	}
	const normalized = {
		file: text(entry.file ?? entry.path ?? entry.file_path ?? entry.name),
		lines: text(entry.lines ?? entry.line ?? entry.range),
		commit: text(entry.commit ?? entry.sha ?? entry.commit_sha),
		url: text(entry.url ?? entry.link ?? entry.href),
	};
	const hasAny = normalized.file || normalized.lines || normalized.commit || normalized.url;
	return hasAny ? normalized : null;
}

function renderEvidenceEntry(entry) {
	const parts = [];
	if (entry.file) {
		parts.push(entry.file);
	}
	if (entry.lines) {
		parts.push(`lines ${entry.lines}`);
	}
	if (entry.commit) {
		parts.push(`commit ${entry.commit}`);
	}
	if (entry.url) {
		parts.push(entry.url);
	}
	return parts.join(" - ");
}

/**
 * The evidence list of a finding. It is always an array, but a single
 * reference object is accepted so one reference is not read as "unevidenced".
 */
function asEvidenceList(value) {
	if (Array.isArray(value)) {
		return value;
	}
	if (value && typeof value === "object") {
		return [value];
	}
	return [];
}

/**
 * Normalize one finding and re-apply the evidence demotion.
 *
 * A finding whose evidence list is empty is reported as speculative even if
 * the row claims otherwise.
 */
function normalizeFinding(raw) {
	if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
		return null;
	}
	const detail = text(raw.detail ?? raw.summary ?? raw.text ?? raw.description);
	if (detail === "") {
		return null;
	}
	const evidence = asEvidenceList(raw.evidence).map(normalizeEvidenceEntry).filter(Boolean);
	const recorded = normalizeConfidence(raw.confidence);
	const confidence = evidence.length === 0 ? DEFAULT_CONFIDENCE : recorded;
	const unverifiedReferences = asArray(raw.unverified_references)
		.map((value) => singleLine(value))
		.filter(Boolean);
	return {
		confidence,
		recordedConfidence: recorded,
		demoted: evidence.length === 0 && recorded !== DEFAULT_CONFIDENCE,
		unverifiedReferences,
		detail,
		evidence,
	};
}

/** The `{ summary, findings, limitations }` payload of an investigation. */
function readFindingsPayload(investigation) {
	const raw = parseJsonColumn(investigation?.findings);
	if (Array.isArray(raw)) {
		// A bare list of findings is accepted: dropping it silently would turn
		// a populated investigation into an empty one.
		return { summary: "", findings: raw, limitations: [] };
	}
	if (!raw || typeof raw !== "object") {
		return { summary: "", findings: [], limitations: [] };
	}
	return {
		summary: text(raw.summary),
		findings: asArray(raw.findings),
		limitations: asArray(raw.limitations),
	};
}

/** The `{ files, commits, queries, failures }` payload of an investigation. */
function readEvidencePayload(investigation) {
	const raw = parseJsonColumn(investigation?.evidence);
	if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
		return { files: [], commits: [], queries: [], failures: [] };
	}
	return {
		files: asArray(raw.files),
		commits: asArray(raw.commits),
		queries: asArray(raw.queries),
		failures: asArray(raw.failures),
	};
}

/** The `[{ tool, status, error }]` payload of an investigation. */
function readToolLog(investigation) {
	return asArray(parseJsonColumn(investigation?.tool_log)).map((entry) => {
		if (typeof entry === "string") {
			return { tool: entry, status: "unknown", error: "" };
		}
		if (!entry || typeof entry !== "object") {
			return { tool: "unknown", status: "unknown", error: "" };
		}
		return {
			tool: text(entry.tool ?? entry.name ?? "unknown"),
			status: text(entry.status ?? "unknown"),
			error: text(entry.error ?? entry.message),
		};
	});
}

function orderMessages(messages) {
	return asArray(messages)
		.filter((message) => message && typeof message === "object")
		.map((message, index) => ({ message, index }))
		.sort((a, b) => {
			const left = Number(a.message.sequence);
			const right = Number(b.message.sequence);
			const leftUsable = Number.isFinite(left);
			const rightUsable = Number.isFinite(right);
			if (leftUsable && rightUsable && left !== right) {
				return left - right;
			}
			if (leftUsable && !rightUsable) {
				return -1;
			}
			if (!leftUsable && rightUsable) {
				return 1;
			}
			return a.index - b.index;
		})
		.map((entry) => entry.message);
}

/**
 * Order the runs so the report reads in the order the pipeline runs them:
 * lead, code, repo, research, verify. A retry of a role stays with its role.
 */
function orderInvestigations(investigations) {
	return asArray(investigations)
		.filter((investigation) => investigation && typeof investigation === "object")
		.map((investigation, index) => ({ investigation, index }))
		.sort(
			(a, b) =>
				roleRank(a.investigation.role) - roleRank(b.investigation.role) || a.index - b.index,
		)
		.map((entry) => entry.investigation);
}

function roleRank(role) {
	const index = ROLE_ORDER.indexOf(singleLine(role).toLowerCase());
	return index === -1 ? ROLE_ORDER.length : index;
}

/**
 * Reduce one investigation row to everything the report needs to say about
 * it. The `failed` flag is derived here and used everywhere else, so a failed
 * run can never be rendered as a clean one by accident.
 */
function readInvestigation(investigation) {
	const { id, role, status, attempt, model_id, error, report, started_at, completed_at } =
		investigation;
	const normalizedStatus = singleLine(status).toLowerCase() || "unknown";
	const findingsPayload = readFindingsPayload(investigation);
	const evidencePayload = readEvidencePayload(investigation);
	const attemptNumber = Number(attempt);
	return {
		id: text(id),
		role: singleLine(role).toLowerCase() || "unknown",
		status: normalizedStatus,
		failed: normalizedStatus === "failed",
		error: text(error),
		modelId: text(model_id),
		attempt: Number.isFinite(attemptNumber) ? attemptNumber : 0,
		startedAt: formatTimestamp(started_at),
		completedAt: formatTimestamp(completed_at),
		summary: findingsPayload.summary,
		limitations: findingsPayload.limitations,
		findings: findingsPayload.findings.map(normalizeFinding).filter(Boolean),
		toolLog: readToolLog(investigation),
		files: evidencePayload.files,
		commits: evidencePayload.commits,
		queries: evidencePayload.queries,
		failures: evidencePayload.failures,
		report: text(report),
	};
}

function renderToolLog(toolLog) {
	if (toolLog.length === 0) {
		return ["_No tool calls were recorded._"];
	}
	const lines = ["| Tool | Status | Error |", "|---|---|---|"];
	for (const entry of toolLog) {
		lines.push(
			`| ${tableCell(entry.tool)} | ${tableCell(entry.status)} | ${tableCell(entry.error || EMPTY)} |`,
		);
	}
	return lines;
}

function renderEvidenceList(title, items) {
	const rendered = renderItemList(items);
	if (rendered.length === 0) {
		return [`**${title}**`, "", "_None recorded._", ""];
	}
	return [`**${title}**`, "", ...rendered, ""];
}

function renderRunFindings(run) {
	if (run.failed) {
		return [
			"**Findings (0)**",
			"",
			"_This run failed before its findings could be verified, so nothing is attributed to it._",
			"",
		];
	}
	if (run.findings.length === 0) {
		return ["**Findings (0)**", "", "_None recorded._", ""];
	}
	const lines = [`**Findings (${run.findings.length})**`, ""];
	for (const finding of run.findings) {
		const marker = finding.demoted
			? " (demoted to speculative: no evidence reference)"
			: finding.unverifiedReferences.length > 0
				? ` (demoted to speculative: cited evidence does not resolve - ${finding.unverifiedReferences.join(", ")})`
				: "";
		lines.push(`- ${finding.confidence} - ${finding.detail}${marker}`);
	}
	lines.push("");
	return lines;
}

function renderInvestigationBlock(run) {
	const lines = [];
	const heading = run.failed
		? `### ${run.role} - ${run.status} (INCOMPLETE)`
		: `### ${run.role} - ${run.status}`;
	lines.push(heading, "");
	lines.push(`- **Status:** ${run.status}${run.failed ? " - INCOMPLETE" : ""}`);
	lines.push(`- **Model:** ${run.modelId || EMPTY}`);
	lines.push(`- **Attempt:** ${run.attempt}`);
	lines.push(`- **Started:** ${run.startedAt}`);
	lines.push(`- **Completed:** ${run.completedAt}`);
	if (run.failed) {
		lines.push(`- **Error:** ${run.error || "no error message was recorded"}`);
		lines.push("");
		lines.push(
			"> This run failed. It did not complete its investigation, so its silence is not an answer and nothing is credited to it.",
		);
		lines.push("");
	} else {
		lines.push("");
	}
	if (run.summary !== "") {
		lines.push("**Summary**", "", run.summary, "");
	}
	lines.push("**Tool log**", "", ...renderToolLog(run.toolLog), "");
	lines.push(...renderEvidenceList("Files", run.files));
	lines.push(...renderEvidenceList("Commits", run.commits));
	lines.push(...renderEvidenceList("Queries", run.queries));
	lines.push(...renderEvidenceList("Failures", run.failures));
	lines.push(...renderRunFindings(run));
	if (run.report !== "") {
		lines.push("**Agent report**", "", run.report, "");
	}
	return lines;
}

function renderFindingBlock(finding, source) {
	const lines = [];
	lines.push(`- **Confidence:** ${finding.confidence}`);
	lines.push(`- **Source role:** ${source.role}`);
	if (source.failed) {
		lines.push("- **Run status:** INCOMPLETE - this finding comes from a failed run");
	}
	if (finding.demoted) {
		lines.push(
			"- **Note:** recorded as confirmed or probable but carries no evidence reference, so it is reported as speculative",
		);
	}
	if (finding.unverifiedReferences.length > 0) {
		lines.push(
			`- **Note:** recorded as ${finding.recordedConfidence} but cites evidence that does not resolve inside the repository (${finding.unverifiedReferences.join(", ")}), so it is reported as speculative - an unverified reference`,
		);
	}
	lines.push(...renderDetailBullet(finding.detail));
	lines.push("- **Evidence:**");
	if (finding.evidence.length === 0) {
		lines.push("  - none recorded - an unevidenced claim cannot be confirmed");
	} else {
		for (const entry of finding.evidence) {
			lines.push(`  - ${renderEvidenceEntry(entry)}`);
		}
	}
	return lines;
}

/**
 * The detail of a finding, as one list item. A multi-line detail keeps its
 * line breaks and stays inside the item.
 */
function renderDetailBullet(detail) {
	const parts = String(detail ?? "").split(LINE_BREAK);
	const lines = [`- **Detail:** ${parts[0] ?? ""}`];
	for (const part of parts.slice(1)) {
		lines.push(`  ${part}`);
	}
	return lines;
}

function renderNextSteps(grouped, failedRuns) {
	const lines = [];
	lines.push(
		"_Everything in this section is a recommendation. The investigation runtime is read-only: no code change, configuration change, deployment, or data change was made by this investigation._",
		"",
	);
	const steps = [];
	const { confirmed, probable, speculative } = grouped;
	if (confirmed.length > 0) {
		steps.push("**Confirmed - review and act on these:**", "");
		for (const entry of confirmed) {
			steps.push(`1. ${entry.finding.detail} (reported by the ${entry.source.role} agent)`);
		}
		steps.push("");
	}
	if (probable.length > 0) {
		steps.push("**Probable - verify these before acting:**", "");
		for (const entry of probable) {
			steps.push(`1. ${entry.finding.detail} (reported by the ${entry.source.role} agent)`);
		}
		steps.push("");
	}
	if (speculative.length > 0) {
		steps.push("**Speculative - gather evidence for these first:**", "");
		for (const entry of speculative) {
			steps.push(`1. ${entry.finding.detail} (reported by the ${entry.source.role} agent)`);
		}
		steps.push("");
	}
	for (const run of failedRuns) {
		steps.push(
			`**Re-run the failed ${run.role} investigation:** it did not complete (${run.error || "no error message was recorded"}), so the questions it was asked are still open.`,
			"",
		);
	}
	if (steps.length === 0) {
		steps.push("_No findings found._");
	}
	lines.push(...steps, "");
	return lines;
}

function renderSafeguards() {
	const denied = asArray(ALWAYS_DENIED_TOOL_NAMES);
	const disabledMcp = asArray(ALWAYS_DISABLED_MCP_PATTERNS);
	const deniedTools = denied.length > 0 ? denied : FALLBACK_DENIED_TOOLS;
	const disabledTools = disabledMcp.length > 0 ? disabledMcp : FALLBACK_DISABLED_MCP;
	return [
		"The investigation runtime ran with a read-only configuration. These safeguards were in force for every run:",
		"",
		`- **Tools denied outright:** ${deniedTools.join(", ")}`,
		'- **Tools allowed:** read (excluding ".env" files), glob, grep, list',
		'- **Secrets:** ".env" files were denied; only ".env.example" was readable',
		`- **MCP integrations disabled:** ${disabledTools.join(", ")}`,
		"- **Subagent delegation:** denied, so no agent could hand a denied action to another agent",
		"- **Scope:** the runtime could read the repository root only; any other directory was refused",
		"- **Models:** free-tier models only; a keyed or paid provider is never used",
		"- **Changes made:** none - the investigation did not modify the repository",
	];
}

function renderMetadataSection(row) {
	const {
		id,
		subject,
		status,
		created_at,
		updated_at,
		user_id,
		ticket_id,
		summary,
		escalated,
		report_status,
		report_delivered_at,
		retain,
	} = row;
	return [
		"## 1. Case metadata",
		"",
		"| Field | Value |",
		"|---|---|",
		`| Case ID | ${tableCell(id) || EMPTY} |`,
		`| Subject | ${tableCell(subject) || EMPTY} |`,
		`| Status | ${tableCell(status) || EMPTY} |`,
		`| Created | ${tableCell(formatTimestamp(created_at))} |`,
		`| Updated | ${tableCell(formatTimestamp(updated_at))} |`,
		`| User | ${tableCell(user_id) || EMPTY} |`,
		`| Ticket | ${tableCell(ticket_id) || EMPTY} |`,
		`| Confirmed summary | ${tableCell(summary) || EMPTY} |`,
		`| Escalated | ${escalated ? "yes" : "no"} |`,
		`| Report status | ${tableCell(report_status) || EMPTY} |`,
		`| Report delivered at | ${tableCell(formatTimestamp(report_delivered_at))} |`,
		`| Evidence retained | ${retain ? "yes" : "no"} |`,
		"",
	];
}

function renderComplaintSection(messages) {
	const lines = ["## 2. Original complaint", ""];
	const complaint = messages.find((message) =>
		CLIENT_ROLES.has(singleLine(message.role).toLowerCase()),
	);
	if (complaint) {
		const { role, kind, content, created_at } = complaint;
		lines.push(
			`_First ${singleLine(role) || "client"} message, kind ${singleLine(kind) || "answer"}, logged ${formatTimestamp(created_at)}._`,
			"",
		);
		lines.push(text(content) || "_empty_", "");
	} else {
		lines.push("_No client message was recorded for this case._", "");
	}
	return lines;
}

function renderConversationSection(messages) {
	const lines = ["## 3. Conversation log", ""];
	if (messages.length === 0) {
		lines.push("_No messages were recorded for this case._", "");
		return lines;
	}
	messages.forEach((message, index) => {
		const { role, kind, agent, content, created_at } = message;
		const header = [
			`### ${index + 1}. ${singleLine(role) || "unknown"} - ${singleLine(kind) || "answer"}`,
		];
		if (text(agent) !== "") {
			header.push(` (agent: ${text(agent)})`);
		}
		header.push(` - ${formatTimestamp(created_at)}`);
		lines.push(header.join(""), "", text(content) || "_empty_", "");
	});
	return lines;
}

function renderInvestigationsSection(runs) {
	const lines = ["## 4. Investigation log", ""];
	if (runs.length === 0) {
		lines.push("_No investigation runs were recorded for this case._", "");
		return lines;
	}
	for (const run of runs) {
		lines.push(...renderInvestigationBlock(run));
	}
	return lines;
}

function renderFindingsSection(grouped, runs) {
	const lines = ["## 5. Findings", ""];
	lines.push(
		"_Every finding is grouped by confidence: **confirmed**, **probable**, or **speculative**. A finding without an evidence reference is reported as speculative, and so is one whose cited evidence file does not resolve inside the repository; the pipeline has no path that promotes an unevidenced claim._",
		"",
	);
	for (const level of CONFIDENCE_LEVELS) {
		const entries = grouped[level];
		lines.push(
			`### ${level.charAt(0).toUpperCase()}${level.slice(1)} findings (${entries.length})`,
			"",
		);
		if (entries.length === 0) {
			lines.push("_None._", "");
		} else {
			entries.forEach((entry, index) => {
				lines.push(`#### ${index + 1}. ${singleLine(entry.finding.detail)}`, "");
				lines.push(...renderFindingBlock(entry.finding, entry.source), "");
			});
		}
	}
	const limitationLines = [];
	for (const run of runs) {
		for (const limitation of asArray(run.limitations)) {
			const value = singleLine(describeValue(limitation));
			if (value !== "") {
				limitationLines.push(`- [${run.role}] ${value}`);
			}
		}
	}
	lines.push("### Limitations", "");
	if (limitationLines.length === 0) {
		lines.push("_None recorded._", "");
	} else {
		lines.push(...limitationLines, "");
	}
	return lines;
}

function renderAuditSection(row, runs, grouped, generated) {
	const { id, report_status, report_delivered_at, escalated } = row;
	const failedRuns = runs.filter((run) => run.failed);
	const findingCount =
		grouped.confirmed.length + grouped.probable.length + grouped.speculative.length;
	return [
		"## 7. Audit and delivery",
		"",
		"### Read-only safeguards in force",
		"",
		...renderSafeguards(),
		"",
		"### Generation",
		"",
		`- **Report generated at:** ${generated}`,
		`- **Case ID:** ${text(id) || EMPTY}`,
		`- **Investigation runs rendered:** ${runs.length} (${runs.length - failedRuns.length} not failed, ${failedRuns.length} failed)`,
		`- **Findings rendered:** ${findingCount}`,
		"- **Changes made by this investigation:** none - the runtime is read-only",
		"",
		"### Delivery status",
		"",
		`- **Report status:** ${text(report_status) || "not recorded yet"}`,
		`- **Delivered at:** ${report_delivered_at ? formatTimestamp(report_delivered_at) : "not delivered"}`,
		`- **Escalated:** ${escalated ? "yes" : "no"}`,
		"- **Note:** the delivery status above is the status recorded on the case row; it is not asserted by this renderer.",
		"",
	];
}

/**
 * The identity of a finding.
 *
 * The same claim, with the same confidence and the same evidence, is ONE
 * finding however many runs report it.
 *
 * @param {Object} finding A normalized finding.
 * @returns {string}
 */
function findingKey(finding) {
	return JSON.stringify([
		finding.detail,
		finding.confidence,
		(finding.evidence || []).map((entry) => [entry.file, entry.lines, entry.commit, entry.url]),
	]);
}

/**
 * Build the Markdown report for one support case.
 *
 * @param {Object} params
 * @param {Object} [params.caseRow] A `SupportCase` row.
 * @param {Object[]} [params.messages] `SupportCaseMessage` rows, any order.
 * @param {Object[]} [params.investigations] `SupportInvestigation` rows, any order.
 * @param {Date|string} [params.generatedAt] Override the generation time.
 * @returns {string} The Markdown report.
 */
export function buildReport({ caseRow, messages, investigations, generatedAt } = {}) {
	const row = caseRow && typeof caseRow === "object" ? caseRow : {};
	const messageRows = orderMessages(messages);
	const runs = orderInvestigations(investigations).map(readInvestigation);
	const failedRuns = runs.filter((run) => run.failed);
	const generated = formatTimestamp(generatedAt ?? new Date());

	const grouped = { confirmed: [], probable: [], speculative: [] };
	// The verify run holds the FINAL set of findings - every specialist
	// finding with the verification applied - and each specialist run holds
	// its own copy of the findings it produced. The same finding therefore
	// arrives twice, and counting it twice would report twice as many
	// findings as the investigation produced.
	//
	// Each finding is counted ONCE, under the run that first reported it:
	// the specialist that found it, not the verifier that checked it.
	const counted = new Set();
	for (const run of runs) {
		for (const finding of run.findings) {
			const key = findingKey(finding);
			if (counted.has(key)) {
				continue;
			}
			counted.add(key);
			grouped[finding.confidence].push({ finding, source: run });
		}
	}

	const lines = [];
	lines.push("# Support investigation report", "");
	lines.push(`- **Case:** ${text(row.id) || EMPTY}`);
	lines.push(`- **Generated:** ${generated}`);
	lines.push(`- **Status:** ${text(row.status) || EMPTY}`);
	lines.push("");

	if (failedRuns.length > 0) {
		const failedRoles = failedRuns.map((run) => run.role).join(", ");
		lines.push(
			`> **This report is INCOMPLETE.** ${failedRuns.length} of ${runs.length} investigation run(s) failed (${failedRoles}). A failed run is not a clean result: it did not look for anything, so its silence is not an answer. See section 4.`,
			"",
		);
	}

	lines.push(...renderMetadataSection(row));
	lines.push(...renderComplaintSection(messageRows));
	lines.push(...renderConversationSection(messageRows));
	lines.push(...renderInvestigationsSection(runs));
	lines.push(...renderFindingsSection(grouped, runs));
	lines.push("## 6. Recommended next steps", "");
	lines.push(...renderNextSteps(grouped, failedRuns));
	lines.push(...renderAuditSection(row, runs, grouped, generated));

	return lines.join("\n");
}
