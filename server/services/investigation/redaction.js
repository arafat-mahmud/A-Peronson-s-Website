/**
 * Redaction of the investigation report - and of the findings that go with
 * it.
 *
 * The report is built from what the investigators read in the repository, and
 * the repository carries credentials. `render.yaml` alone holds a live
 * database connection string, a JWT secret, the admin MFA code and the admin
 * step-up code; an investigator that reads a deployment file and repeats the
 * value it found would put that value into a document that is then persisted,
 * emailed and pushed to the client over SSE.
 *
 * So the report is not trusted to be free of secrets: it is redacted on the
 * way out, and the redaction happens BEFORE the report is persisted, so the
 * database never holds the raw value either.
 *
 * The FINDINGS are redacted too, and for the same reason. The report is not
 * the only consumer of what an investigator said: the raw findings are
 * written to the investigation row and pushed to the client over SSE, and
 * the client renders the finding's detail and its evidence references as
 * they stand. A redacted report with an un-redacted finding is a secret with
 * a lid on one end.
 *
 * The rules are deliberately SHAPE-based rather than value-based. The server
 * does not know every secret the deployment holds, and a blocklist of known
 * values would rot the moment a secret is rotated. What it can recognise is
 * the SHAPE a secret takes:
 *
 *  - a connection string that carries credentials (`postgresql://user:pass@host/db`);
 *  - the value of an assignment to a secret-bearing variable
 *    (`JWT_SECRET=...`, `ADMIN_MFA_CODE=...`, `*_KEY`, `*_TOKEN`, `*_PASSWORD`);
 *  - a secret parameter inside a URL query string (`?token=...`);
 *  - a bearer token;
 *  - a service password of the shape the managed database hands out;
 *  - an AWS-style access key id (`AKIA` + sixteen characters);
 *  - a GitHub-style token (`ghp_...` and its siblings);
 *  - a long high-entropy hex or base64 blob.
 *
 * Everything else survives. The report's structure - its headings, its
 * findings, its file references, its commit hashes, its prose - is left
 * exactly as it was, because a redactor that eats the report is not a
 * redactor, it is a second way of losing the evidence.
 */

/** What a redacted value is replaced with. */
export const REDACTION_MARKER = "[redacted]";

/**
 * The marker without its closing bracket.
 *
 * The bare-value pattern stops at a `]`, so a value that is already the
 * marker is captured as `[redacted`. The prefix is what the idempotence
 * check looks for.
 */
const REDACTION_MARKER_PREFIX = "[redacted";

/**
 * A connection string that carries credentials.
 *
 * The userinfo section is required: `redis://localhost:6379` names no
 * credential and is not a secret, while `postgresql://user:pass@host/db`
 * carries the database password in clear text.
 */
const CONNECTION_STRING_RE =
	/\b(?:postgres(?:ql)?|mysql|mariadb|mongodb(?:\+srv)?|redis|rediss|amqps?|mssql|sqlserver|s?ftp|s?ftp):\/\/[^\s"'`<>|]*:[^\s"'`<>|@/]*@[^\s"'`<>|]*/gi;

/**
 * An assignment: `NAME = value`, `NAME: value`, with the value quoted or bare.
 *
 * The name is captured loosely and checked afterwards, because the shape that
 * matters is the name's, and the regex cannot express "an environment
 * variable whose name mentions a secret" without swallowing the value of
 * every other assignment it meets.
 *
 * The whitespace on both sides of the separator is captured so it can be
 * put back: a redacted assignment keeps the shape of the text it replaced,
 * and a name and its value separated by a line break stay a line break apart.
 */
const ASSIGNMENT_RE =
	/\b([A-Za-z_][A-Za-z0-9_]*)(\s*)([=:])(\s*)(?:"([^"\n]*)"|'([^'\n]*)'|([^\s"',;)\]}]+))/g;

/** The shape of an environment variable name: upper case, digits, underscore. */
const ENV_NAME_RE = /^[A-Z][A-Z0-9_]*$/;

/** The words that make a variable name secret-bearing. */
const SECRET_NAME_WORD_RE = /(SECRET|KEY|CODE|TOKEN|PASSWORD|PASSWD|CREDENTIAL)/;

/**
 * The lower-case (and mixed-case) names that make a value a secret.
 *
 * The environment-variable shape above is only one way a secret-bearing
 * name is written. A code snippet, a log line and a URL parameter are just
 * as likely to write it in lower case - `password: hunter2`, `?token=abc` -
 * and the NAME is the only thing that tells the redactor what the value is.
 *
 * `code` is deliberately NOT in this list: `code: 500` is a status, not a
 * secret. The upper-case rule above already covers the `*_CODE` environment
 * variables that really are (`ADMIN_MFA_CODE`, `ADMIN_STEPUP_CODE`).
 */
const LOWERCASE_SECRET_NAME_RE =
	/^(?:[a-z0-9]+[_-])*(?:password|passwd|passphrase|secret|token|api[_-]?key|credential|credentials|private[_-]?key)(?:[_-][a-z0-9]+)*$/i;

/**
 * A URL-ish token: a scheme, `://`, and everything up to whitespace.
 *
 * The query string of a URL is where a secret very often hides, and the
 * assignment rule cannot reach it: `https:` reads as `name = value` and
 * swallows the rest of the URL, so the secret that sits behind the `?` is
 * never seen as an assignment at all. This pattern finds the URL FIRST, so
 * the query can be redacted on its own.
 *
 * The closing brackets are excluded so a markdown link (`[x](https://y)`)
 * keeps its parenthesis.
 */
const URL_TOKEN_RE = /\b[a-z][a-z0-9+.-]*:\/\/[^\s"'`<>|)\]}]+/gi;

/**
 * The punctuation that closes a sentence, at the end of a value.
 *
 * It is not part of the secret, so it survives the redaction.
 */
const TRAILING_PUNCTUATION_RE = /[.,;:!?]+$/;

/** `Bearer <token>`. */
const BEARER_RE = /(\bBearer\s+)[A-Za-z0-9\-._~+/]{8,}={0,2}/gi;

/**
 * The password shape the managed database service hands out.
 *
 * It is short and mixed-case, so neither the hex rule nor the base64 rule
 * would ever catch it on its own. It is caught by name because the name is
 * what makes it recognisable.
 */
const SERVICE_PASSWORD_RE = /\bAVNS_[A-Za-z0-9]{12,}/g;

/**
 * An AWS-style access key id.
 *
 * `AKIA` (or one of its siblings) followed by sixteen upper-case
 * alphanumerics: exactly twenty characters. It is too short for the base64
 * rule and it is not hex, so without this rule nothing in this module would
 * ever see it.
 */
const AWS_ACCESS_KEY_RE =
	/\b(?:AKIA|ASIA|ABIA|ACCA|AGPA|AIDA|AIPA|ANPA|ANVA|AROA)[A-Z0-9]{16}(?![A-Z0-9])/g;

/**
 * A GitHub-style token: `ghp_`, `gho_`, `ghu_`, `ghs_` or `ghr_` followed by
 * alphanumerics.
 *
 * The base64 rule cannot catch these: it demands an upper-case letter, a
 * lower-case letter AND a digit, and it refuses a blob that is preceded by
 * `_` - which is exactly what the `ghp_` prefix is.
 */
const GITHUB_TOKEN_RE = /\bgh[pousr]_[A-Za-z0-9]{16,}\b/g;

/** A GitHub fine-grained personal access token. */
const GITHUB_FINE_GRAINED_TOKEN_RE = /\bgithub_pat_[A-Za-z0-9_]{16,}\b/g;

/**
 * A long hex blob.
 *
 * The threshold is 48 characters, not 32: a git commit id is 40 hex
 * characters and the report cites commit ids in every finding, so a shorter
 * threshold would redact the evidence the report exists to carry.
 */
const HEX_BLOB_RE = /\b[0-9a-fA-F]{48,}\b/g;

/**
 * A long base64 blob.
 *
 * The blob has to carry an upper-case letter, a lower-case letter and a digit
 * to count: a run of 40 letters is a word, not a key.
 */
const BASE64_BLOB_RE =
	/(?<![A-Za-z0-9+/=_-])(?=[A-Za-z0-9+/]*[A-Z])(?=[A-Za-z0-9+/]*[a-z])(?=[A-Za-z0-9+/]*[0-9])[A-Za-z0-9+/]{40,}={0,2}(?![A-Za-z0-9+/=_-])/g;

/**
 * Is this the name of a variable whose value is a secret?
 *
 * Two shapes are accepted, and they are the two shapes a secret-bearing
 * name is written in:
 *
 *  - the environment-variable shape: an upper-case name that mentions a
 *    secret word (`JWT_SECRET`, `ADMIN_MFA_CODE`, `UPLOADS_SIGNING_SECRET`);
 *  - the lower-case shape: a name that IS a secret word, with an optional
 *    qualifier (`password`, `api_key`, `client_secret`, `passphrase`).
 *
 * @param {string} name
 * @returns {boolean}
 */
function isSecretName(name) {
	const value = String(name || "");
	if (ENV_NAME_RE.test(value)) {
		return SECRET_NAME_WORD_RE.test(value);
	}
	return LOWERCASE_SECRET_NAME_RE.test(value);
}

/**
 * Redact the secret-bearing parameters of every URL query string.
 *
 * A parameter whose NAME says what it is (`token`, `password`, `api_key`,
 * `JWT_SECRET`, `ADMIN_MFA_CODE`) loses its value; every other parameter
 * keeps it, because the name is the only thing that makes the value
 * recognisable as a secret.
 *
 * @param {string} text
 * @returns {string}
 */
function redactUrlQuerySecrets(text) {
	return text.replace(URL_TOKEN_RE, (url) => {
		const queryStart = url.indexOf("?");
		if (queryStart === -1) {
			return url;
		}
		const head = url.slice(0, queryStart);
		const rest = url.slice(queryStart + 1);
		const hashStart = rest.indexOf("#");
		const query = hashStart === -1 ? rest : rest.slice(0, hashStart);
		const tail = hashStart === -1 ? "" : rest.slice(hashStart);

		const params = query.split("&").map((param) => {
			const separator = param.indexOf("=");
			if (separator === -1) {
				return param;
			}
			const name = param.slice(0, separator);
			if (!isSecretName(name)) {
				return param;
			}
			const value = param.slice(separator + 1);
			// A value that already IS the marker is left alone, so the
			// redaction is idempotent: redacting a redacted report must not
			// grow another bracket.
			if (value.includes(REDACTION_MARKER_PREFIX)) {
				return param;
			}
			// The punctuation that closes the sentence is not part of the
			// secret, so it survives the redaction.
			const trailing = value.match(TRAILING_PUNCTUATION_RE)?.[0] || "";
			return `${param.slice(0, separator + 1)}${REDACTION_MARKER}${trailing}`;
		});

		return `${head}?${params.join("&")}${tail}`;
	});
}

/**
 * Redact the secret-shaped strings in one report.
 *
 * The report's own text is not touched: only the values that match a secret
 * shape are replaced, and each one is replaced by `[redacted]`.
 *
 * @param {string} report The Markdown report.
 * @returns {string} The redacted report.
 */
export function redactReportSecrets(report) {
	if (typeof report !== "string" || report === "") {
		return report;
	}

	let text = report;

	// A connection string first: it carries the password AND the host, and
	// replacing it whole leaves nothing of the credential behind.
	text = text.replace(CONNECTION_STRING_RE, REDACTION_MARKER);

	// A URL's query string, before the assignment rule runs. The assignment
	// rule reads `https:` as `name = value` and swallows the rest of the
	// URL, so a secret behind the `?` would never be seen as an assignment.
	text = redactUrlQuerySecrets(text);

	// A bearer token: the scheme is kept, the token is not.
	text = text.replace(BEARER_RE, `$1${REDACTION_MARKER}`);

	// The value of a secret-bearing assignment. The name and the separator
	// survive, so the report still says WHICH variable holds the secret.
	text = text.replace(
		ASSIGNMENT_RE,
		(match, name, spaceBefore, separator, spaceAfter, doubleQuoted, singleQuoted, bare) => {
			if (!isSecretName(name)) {
				return match;
			}
			// A value that already IS the marker is left alone, so the redaction
			// is idempotent: redacting a redacted report must not grow another
			// bracket.
			const value = doubleQuoted ?? singleQuoted ?? bare;
			if (typeof value === "string" && value.includes(REDACTION_MARKER_PREFIX)) {
				return match;
			}
			const head = `${name}${spaceBefore}${separator}${spaceAfter}`;
			if (typeof doubleQuoted === "string") {
				return `${head}"${REDACTION_MARKER}"`;
			}
			if (typeof singleQuoted === "string") {
				return `${head}'${REDACTION_MARKER}'`;
			}
			if (typeof bare === "string") {
				return `${head}${REDACTION_MARKER}`;
			}
			return match;
		},
	);

	// A managed-service password that is not part of an assignment.
	text = text.replace(SERVICE_PASSWORD_RE, REDACTION_MARKER);

	// A key id of a shape that has no name to be recognised by.
	text = text.replace(AWS_ACCESS_KEY_RE, REDACTION_MARKER);
	text = text.replace(GITHUB_TOKEN_RE, REDACTION_MARKER);
	text = text.replace(GITHUB_FINE_GRAINED_TOKEN_RE, REDACTION_MARKER);

	// Long high-entropy blobs.
	text = text.replace(HEX_BLOB_RE, REDACTION_MARKER);
	text = text.replace(BASE64_BLOB_RE, REDACTION_MARKER);

	return text;
}

/**
 * Redact the secret-shaped strings in ONE evidence reference.
 *
 * An evidence entry is `{ file, lines, commit, url }`, and every one of
 * those is a string the agent wrote - so every one of them can carry a
 * value the agent read out of the repository. A commit id survives: it is
 * evidence, not a secret.
 *
 * @param {unknown} entry
 * @returns {unknown} The redacted reference.
 */
function redactEvidenceEntry(entry) {
	if (typeof entry === "string") {
		return redactReportSecrets(entry);
	}
	if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
		return entry;
	}
	const redacted = { ...entry };
	for (const key of ["file", "lines", "commit", "url"]) {
		if (typeof redacted[key] === "string") {
			redacted[key] = redactReportSecrets(redacted[key]);
		}
	}
	return redacted;
}

/**
 * Redact the secret-shaped strings in ONE finding.
 *
 * The finding is `{ confidence, detail, evidence, category? }`. The detail
 * is prose the agent wrote, and the evidence entries are references the
 * agent wrote; either can quote a value the agent read in the repository.
 *
 * The input is not mutated.
 *
 * @param {unknown} finding
 * @returns {unknown} The redacted finding.
 */
export function redactFindingSecrets(finding) {
	if (!finding || typeof finding !== "object" || Array.isArray(finding)) {
		return finding;
	}
	const redacted = { ...finding };
	if (typeof redacted.detail === "string") {
		redacted.detail = redactReportSecrets(redacted.detail);
	}
	if (Array.isArray(redacted.evidence)) {
		redacted.evidence = redacted.evidence.map((entry) => redactEvidenceEntry(entry));
	}
	return redacted;
}

/**
 * Redact the secret-shaped strings in a findings payload.
 *
 * Three shapes are accepted, because three callers hold three shapes: a
 * list of findings, the `{ summary, findings, limitations }` wrapper an
 * investigation row stores, and a single finding. A list of plain strings
 * is accepted too - that is what a list of limitations is.
 *
 * The summary and the limitations are redacted too: they are the agent's
 * own prose, they sit in the same JSON payload as the findings, and the
 * admin console renders them raw.
 *
 * The input is not mutated.
 *
 * @param {unknown} payload
 * @returns {unknown} The redacted payload, in the shape it arrived in.
 */
export function redactFindingsSecrets(payload) {
	if (Array.isArray(payload)) {
		return payload.map((entry) =>
			typeof entry === "string" ? redactReportSecrets(entry) : redactFindingSecrets(entry),
		);
	}
	if (!payload || typeof payload !== "object") {
		return payload;
	}
	const redacted = { ...payload };
	if (typeof redacted.detail === "string") {
		redacted.detail = redactReportSecrets(redacted.detail);
	}
	if (typeof redacted.summary === "string") {
		redacted.summary = redactReportSecrets(redacted.summary);
	}
	if (Array.isArray(redacted.evidence)) {
		redacted.evidence = redacted.evidence.map((entry) => redactEvidenceEntry(entry));
	}
	if (Array.isArray(redacted.findings)) {
		redacted.findings = redacted.findings.map((entry) => redactFindingSecrets(entry));
	}
	if (Array.isArray(redacted.limitations)) {
		redacted.limitations = redacted.limitations.map((entry) =>
			typeof entry === "string" ? redactReportSecrets(entry) : entry,
		);
	}
	return redacted;
}
