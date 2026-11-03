/**
 * Findings parsing, normalisation and demotion.
 *
 * An investigation agent is a language model, so its "JSON" arrives as prose
 * with a JSON object somewhere inside it, and its fields arrive with the
 * wrong type about as often as not. This module is the boundary that turns
 * that into the fixed `Finding` shape of contracts.md §5:
 *
 *   { confidence: "confirmed | probable | speculative",
 *     detail: "string",
 *     evidence: [ { file, lines, commit, url } ] }
 *
 * Three invariants, and they are the point of the module:
 *
 *  1. `parseAgentJson` NEVER THROWS. A model that answers with an apology
 *     instead of JSON is an expected outcome, not an exception, and a thrown
 *     error inside the investigation queue would take down the run that was
 *     otherwise fine.
 *  2. `normalizeFindings` NEVER emits an undefined field. Every finding it
 *     returns has all three keys, and `evidence` is always an array - even
 *     an empty one. A `findings` column holding `undefined` is how a report
 *     ends up with a hole in it.
 *  3. There is NO PATH THAT PROMOTES AN UNEVIDENCED CLAIM. A finding with an
 *     empty `evidence` array is `speculative`, and `demoteUnsubstantiated`
 *     makes that true of a list that arrives from anywhere else.
 */

/** The three permitted confidences, weakest last. */
const CONFIDENCE_VALUES = ["confirmed", "probable", "speculative"];

/** What a confidence becomes when it is missing or unrecognised. */
const DEFAULT_CONFIDENCE = "speculative";

/** The evidence keys of contracts.md §5, in order. */
const EVIDENCE_KEYS = ["file", "lines", "commit", "url"];

/** A bare-string evidence entry that is a URL rather than a file path. */
const URL_PATTERN = /^https?:\/\//i;

/** The language marker of a fenced code block, e.g. the `json` of ```json. */
const FENCE_LANGUAGE_PATTERN = /^[A-Za-z0-9_+#.-]+[ \t]*\r?\n/;

/** Is this a plain object (and not null, and not an array)? */
function isPlainObject(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Coerce a detail to a string. Never undefined, never an object.
 */
function coerceDetail(value) {
	if (typeof value === "string") {
		return value;
	}
	if (typeof value === "number" && Number.isFinite(value)) {
		return String(value);
	}
	return "";
}

/**
 * Coerce one evidence value to a string, or to null when it carries no
 * reference at all.
 */
function coerceEvidenceValue(value) {
	if (typeof value === "string") {
		const trimmed = value.trim();
		return trimmed ? trimmed : null;
	}
	if (typeof value === "number" && Number.isFinite(value)) {
		return String(value);
	}
	if (typeof value === "boolean") {
		return String(value);
	}
	return null;
}

/**
 * Normalise one evidence entry to the contracts.md §5 shape.
 *
 * A bare string is tolerated and read as a reference: an http(s) URL becomes
 * `url`, anything else becomes `file`. An entry that carries none of the four
 * known keys carries no reference at all and is dropped - a finding whose
 * evidence is `[{}]` is exactly as unevidenced as one whose evidence is `[]`,
 * and must be demoted like it.
 */
function normalizeEvidenceEntry(entry) {
	if (typeof entry === "string") {
		const trimmed = entry.trim();
		if (!trimmed) {
			return null;
		}
		return URL_PATTERN.test(trimmed) ? { url: trimmed } : { file: trimmed };
	}
	if (!isPlainObject(entry)) {
		return null;
	}

	const normalized = {};
	for (const key of EVIDENCE_KEYS) {
		const coerced = coerceEvidenceValue(entry[key]);
		if (coerced !== null) {
			normalized[key] = coerced;
		}
	}
	return Object.keys(normalized).length > 0 ? normalized : null;
}

/**
 * Normalise an evidence list. Always an array, possibly empty.
 */
function normalizeEvidence(value) {
	if (!Array.isArray(value)) {
		return [];
	}
	const evidence = [];
	for (const entry of value) {
		const normalized = normalizeEvidenceEntry(entry);
		if (normalized) {
			evidence.push(normalized);
		}
	}
	return evidence;
}

/**
 * Normalise one raw finding into the fixed `Finding` shape.
 *
 * A bare string is tolerated as a detail ("the claim") with no evidence, so
 * a model that answers with a list of sentences still yields findings rather
 * than nothing. Anything that is neither an object nor a string carries no
 * claim and is dropped.
 */
function normalizeFinding(entry) {
	if (typeof entry === "string") {
		return {
			confidence: DEFAULT_CONFIDENCE,
			detail: entry,
			evidence: [],
		};
	}
	if (!isPlainObject(entry)) {
		return null;
	}
	const finding = {
		confidence: coerceConfidence(entry.confidence),
		detail: coerceDetail(entry.detail),
		evidence: normalizeEvidence(entry.evidence),
	};
	// `category` is OPTIONAL in the finding shape (contracts.md 5). It is what
	// escalation classifies on when the agent supplies it, so it has to survive
	// normalisation - otherwise escalation can only ever guess from the text.
	const category = coerceDetail(entry.category);
	if (category) {
		finding.category = category;
	}
	return finding;
}

/**
 * Find the list of findings inside whatever the caller passed.
 *
 * Three shapes are accepted, because the queue hands over the parsed agent
 * object (`{ summary, findings, limitations }`) while other callers hold a
 * bare array, and a single finding is a shape a model produces by accident.
 */
function extractFindingsList(raw) {
	if (Array.isArray(raw)) {
		return raw;
	}
	if (!isPlainObject(raw)) {
		return [];
	}
	if (Array.isArray(raw.findings)) {
		return raw.findings;
	}
	if ("confidence" in raw || "detail" in raw) {
		return [raw];
	}
	return [];
}

/**
 * The body of a fenced code block, with its language marker removed.
 */
function stripFenceLanguage(body) {
	const trimmed = body.trim();
	if (!trimmed) {
		return [];
	}
	const candidates = [trimmed];
	const withoutLanguage = trimmed.replace(FENCE_LANGUAGE_PATTERN, "");
	if (withoutLanguage !== trimmed && withoutLanguage.trim()) {
		candidates.push(withoutLanguage.trim());
	}
	return candidates;
}

/**
 * Every fenced code block in the text, in order, with its language marker
 * removed. A fence with no language marker is kept - the content is still
 * worth trying to parse.
 */
function collectFencedCandidates(text) {
	const candidates = [];
	const fencePattern = /```([\s\S]*?)```/g;
	let match = fencePattern.exec(text);
	while (match !== null) {
		for (const candidate of stripFenceLanguage(match[1])) {
			candidates.push(candidate);
		}
		match = fencePattern.exec(text);
	}
	return candidates;
}

/**
 * Advance the bracket scanner by one character.
 *
 * Braces inside strings do not count as brackets, and neither does the
 * character after an escaped backslash.
 */
function stepScan(state, char, open, close) {
	if (state.escaped) {
		state.escaped = false;
		return;
	}
	if (char === "\\") {
		state.escaped = state.inString;
		return;
	}
	if (char === '"') {
		state.inString = !state.inString;
		return;
	}
	if (state.inString) {
		return;
	}
	if (char === open) {
		state.depth += 1;
		return;
	}
	if (char === close) {
		state.depth -= 1;
	}
}

/**
 * The substring from `start` to the bracket that closes the one at `start`,
 * or null when the brackets never balance.
 */
function extractBalanced(text, start) {
	const open = text[start];
	const close = open === "{" ? "}" : "]";
	const state = { depth: 0, inString: false, escaped: false };

	for (let i = start; i < text.length; i += 1) {
		stepScan(state, text[i], open, close);
		if (state.depth === 0 && i > start) {
			return text.slice(start, i + 1);
		}
		if (state.depth < 0) {
			return null;
		}
	}
	return null;
}

/**
 * Every balanced top-level group in the text, in order, for one kind of
 * bracket.
 *
 * All of them, not just the first: the first one is often a fragment of
 * prose that only looks like JSON, and the real answer may be the second.
 * The scan steps past each group it finds, so nested groups are not
 * collected a second time.
 */
function collectBalanced(text, open) {
	const candidates = [];
	let i = 0;
	while (i < text.length) {
		if (text[i] === open) {
			const candidate = extractBalanced(text, i);
			if (candidate === null) {
				i += 1;
			} else {
				candidates.push(candidate);
				i += candidate.length;
			}
		} else {
			i += 1;
		}
	}
	return candidates;
}

/**
 * Parse a candidate, without throwing.
 *
 * `parsed` says whether the candidate was JSON at all; `value` holds it.
 */
function tryParseJson(candidate) {
	try {
		return { parsed: true, value: JSON.parse(candidate) };
	} catch {
		return { parsed: false, value: undefined };
	}
}

/**
 * Coerce a confidence to one of the three permitted values.
 *
 * Case and surrounding whitespace are forgiven - a model that writes
 * "CONFIRMED" means confirmed. Anything else, including a missing value or
 * a confidence level invented by the model, becomes `speculative`. There is
 * no promotion path here either: an unrecognised value is not a probable
 * one, it is the weakest one.
 */
export function coerceConfidence(value) {
	if (typeof value !== "string") {
		return DEFAULT_CONFIDENCE;
	}
	const lowered = value.trim().toLowerCase();
	return CONFIDENCE_VALUES.includes(lowered) ? lowered : DEFAULT_CONFIDENCE;
}

/**
 * Normalise raw findings into the fixed `Finding` shape.
 *
 * `raw` may be the parsed agent object (`{ findings: [...] }`), an array of
 * findings, or a single finding. The result is always an array of findings
 * with all three keys present and no undefined value anywhere.
 */
export function normalizeFindings(raw) {
	const list = extractFindingsList(raw);
	const findings = [];
	for (const entry of list) {
		const finding = normalizeFinding(entry);
		if (finding) {
			findings.push(finding);
		}
	}
	return findings;
}

/**
 * Demote every finding that has no evidence to `speculative`.
 *
 * This is the demotion rule of contracts.md §5, applied to a list that
 * arrived from anywhere: the queue after the agents answered, the verifier's
 * output, or a caller that built a finding by hand. A finding with evidence
 * keeps its confidence; one without it is `speculative`, whatever it claimed
 * to be. The input is not mutated.
 *
 * `findings` may be an array of findings or the parsed agent object, which
 * carries them under `findings`.
 */
export function demoteUnsubstantiated(findings) {
	const list = extractFindingsList(findings);

	return list.map((finding) => {
		if (!isPlainObject(finding)) {
			return finding;
		}
		const evidence = Array.isArray(finding.evidence) ? finding.evidence : [];
		const confidence =
			evidence.length > 0 ? coerceConfidence(finding.confidence) : DEFAULT_CONFIDENCE;
		return { ...finding, confidence, evidence: [...evidence] };
	});
}

/**
 * Demote every finding that cites a file that does not resolve.
 *
 * The empty-evidence demotion above is not enough on its own. A finding that
 * cites `{ file: "does-not-exist.js" }` HAS evidence, so it keeps the
 * confidence the agent gave it - and the report's "Confirmed findings"
 * section then reads stronger than the finding is. Such a finding can also
 * trip the escalation classifier, which is a security outcome decided by a
 * path that was never opened.
 *
 * So the cited file has to RESOLVE inside the repository before the finding
 * is allowed to keep its confidence. A finding that cites a file which does
 * not resolve is demoted to `speculative` and carries the unresolvable
 * references in `unverified_references`, so the report can say WHY it was
 * demoted instead of leaving the reader to guess.
 *
 * The two demotions of contracts.md §5 - refuted, and empty evidence - are
 * untouched: this is a third one, and it only ever weakens a claim.
 *
 * The resolver is injected, so this module stays free of the filesystem and
 * the test can drive it with a list of known paths.
 *
 * @param {unknown} findings The findings, in any of the accepted shapes.
 * @param {{ isResolvable?: (file: string) => boolean }} [options]
 * @returns {object[]} The findings, demoted where the evidence does not resolve.
 */
export function demoteUnverifiedReferences(findings, { isResolvable } = {}) {
	const list = extractFindingsList(findings);
	if (typeof isResolvable !== "function") {
		return list.map((finding) => finding);
	}

	return list.map((finding) => {
		if (!isPlainObject(finding)) {
			return finding;
		}
		const evidence = Array.isArray(finding.evidence) ? finding.evidence : [];
		const files = [];
		for (const entry of evidence) {
			const file = typeof entry === "string" ? entry : isPlainObject(entry) ? entry.file : null;
			const value = typeof file === "string" ? file.trim() : "";
			if (value && !files.includes(value)) {
				files.push(value);
			}
		}
		if (files.length === 0) {
			return { ...finding, evidence: [...evidence] };
		}
		const unverified = files.filter((file) => !isResolvable(file));
		if (unverified.length === 0) {
			return { ...finding, evidence: [...evidence] };
		}
		return {
			...finding,
			confidence: DEFAULT_CONFIDENCE,
			evidence: [...evidence],
			unverified_references: unverified,
		};
	});
}

/**
 * Parse the JSON an agent replied with.
 *
 * A fenced ```json block wins; otherwise the first balanced top-level object
 * in the text is used. The function NEVER THROWS - a malformed reply is
 * reported as `{ ok: false, reason }`, so the caller records the failure and
 * carries on with the other agents.
 *
 * @param {string} text the raw agent reply
 * @returns {{ ok: true, value: object } | { ok: false, reason: string }}
 */
export function parseAgentJson(text) {
	if (typeof text !== "string" || !text.trim()) {
		return { ok: false, reason: "empty_text" };
	}

	const candidates = [
		...collectFencedCandidates(text),
		...collectBalanced(text, "{"),
		...collectBalanced(text, "["),
	];

	let sawParsedNonObject = false;
	let sawInvalidJson = false;

	for (const candidate of candidates) {
		const attempt = tryParseJson(candidate);
		if (!attempt.parsed) {
			sawInvalidJson = true;
		} else if (isPlainObject(attempt.value)) {
			return { ok: true, value: attempt.value };
		} else {
			sawParsedNonObject = true;
		}
	}

	if (sawParsedNonObject) {
		return { ok: false, reason: "not_an_object" };
	}
	if (sawInvalidJson) {
		return { ok: false, reason: "invalid_json" };
	}
	return { ok: false, reason: "no_json_found" };
}
