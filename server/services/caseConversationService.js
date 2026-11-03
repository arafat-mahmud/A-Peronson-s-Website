import { logInfo, logWarn } from "../utils/logger.js";
import { sanitizeString } from "../utils/validators.js";
import { MAX_CLARIFICATION_ROUNDS } from "./caseService.js";

// The clarification conversation.
//
// A client opens a case and answers questions until the case has enough to be
// investigated. This module answers exactly ONE question per client message.
//
// Two properties are load-bearing and are enforced here rather than left to
// the caller:
//
// 1. It NEVER throws. The message route's response depends on this answer,
//    and a case that cannot be answered must still be answerable: a thrown
//    error would turn "the AI is down" into "the case is broken".
// 2. It NEVER hangs. A clarification round is a user-facing spinner. A
//    provider that never answers must not hold the request open, so the call
//    is raced against a timeout AND carries an abort signal.
//
// When no provider is configured - or the provider fails, times out, or
// answers with nothing usable - the service falls back to a fixed clarifying
// question and reports `ready: false`. The fallback is deliberately dull and
// always true: a wrong question costs the client one round, whereas an
// invented "ready" would start an investigation on a problem nobody
// described.
//
// It is a SELF-CONTAINED module on purpose. `assistantService.js` is the
// general-purpose chat assistant: it imports the Gemini SDK and the opencode
// client, it spawns an opencode server, and its default provider is a local
// Ollama that is "available" whether or not anything is listening on it.
// None of that belongs on the intake path, where the only acceptable
// outcome is a question or a graceful fallback.

const MAX_REPLY_CHARS = 2000;
const MAX_HISTORY_MESSAGES = 12;
const DEFAULT_TIMEOUT_MS = 8000;
const TRAILING_SLASHES = /\/+$/;

/**
 * The question asked when the assistant cannot produce one.
 *
 * It asks for the three things a support investigation cannot proceed
 * without: what was expected, what happened, and where. It is a constant so
 * that the fallback is deterministic - the same case produces the same
 * question every time, which is what makes the offline path testable.
 */
const FALLBACK_CLARIFYING_QUESTION =
	"Could you describe the problem in a little more detail - what you expected to happen, what actually happened, and which page or workflow you were on when it went wrong?";

/** The message sent once the case has enough to be investigated. */
const READY_REPLY =
	"Thanks - that is enough for the investigation team to start. The case is moving to investigation now; each step will appear here as it happens.";

const CLARIFICATION_SYSTEM_PROMPT = [
	"You are the intake assistant for GarTexHub support investigations.",
	"You read the client's description of a problem and ask ONE short clarifying question.",
	"Rules:",
	"- Ask exactly one question. Never ask two at once.",
	"- Never ask again for something the client has already told you.",
	"- Prefer the question whose answer would remove the most ambiguity.",
	"- Never reveal source code, configuration, credentials, internal identifiers, or implementation details.",
	"- Never promise a fix, a refund, or a timeline.",
	"- If the client says they do not know, ask a different question.",
	"- Reply with the question itself. No preamble, no bullet list, no sign-off.",
].join("\n");

function text(value) {
	return String(value ?? "").trim();
}

/**
 * Counts the client's own turns, which is what the round cap measures.
 *
 * The count is taken from the transcript. When the current message is not
 * already the last client turn in the transcript it is counted as well, so
 * the service gives the same answer whether the caller passes the history
 * before or after appending the message.
 *
 * @param {Array<Object>} history The transcript, oldest first.
 * @param {string} clientMessage The message the client just sent.
 * @returns {number} How many client turns the case holds.
 */
function countClientTurns(history = [], clientMessage = "") {
	const list = Array.isArray(history) ? history : [];
	let count = list.filter((message) => message?.role === "client").length;
	const current = text(clientMessage);
	if (current) {
		const last = list.at(-1);
		const lastIsCurrent = last?.role === "client" && text(last?.content) === current;
		if (!lastIsCurrent) {
			count += 1;
		}
	}
	return count;
}

function formatHistory(history = []) {
	const list = Array.isArray(history) ? history : [];
	return list
		.slice(-MAX_HISTORY_MESSAGES)
		.map((message) => {
			const role = text(message?.role) || "client";
			const content = text(message?.content);
			return content ? `${role}: ${content}` : "";
		})
		.filter(Boolean)
		.join("\n");
}

/**
 * Builds the prompt for the clarification question.
 *
 * @param {Object} params
 * @param {string} [params.subject] The case subject.
 * @param {Array<Object>} [params.history] The transcript, oldest first.
 * @param {string} [params.clientMessage] The message the client just sent.
 * @returns {string} The prompt.
 */
function buildClarificationPrompt({ subject, history, clientMessage } = {}) {
	const sections = [];
	const caseSubject = text(subject);
	if (caseSubject) {
		sections.push(`CASE SUBJECT: ${caseSubject}`);
	}
	const transcript = formatHistory(history);
	if (transcript) {
		sections.push(`CONVERSATION SO FAR:\n${transcript}`);
	}
	sections.push(`CLIENT SAYS: ${text(clientMessage)}`);
	sections.push("Ask one clarifying question.");
	return sections.join("\n\n");
}

function lastClientContent(history = []) {
	for (let index = history.length - 1; index >= 0; index -= 1) {
		if (history[index]?.role === "client") {
			return history[index].content;
		}
	}
	return "";
}

/**
 * Normalises the caller's arguments.
 *
 * The controller that owns the message route may describe the turn either as
 * a `history` plus a `clientMessage`, or as a `messages` transcript that
 * already contains the client's turn, or as a `round` number. All three
 * describe the same thing, so all three are accepted: the service and the
 * controller must not have to agree on a spelling to work.
 *
 * @param {Object} options
 * @returns {Object} The normalised turn.
 */
function normalizeOptions(options = {}) {
	let rawHistory = [];
	if (Array.isArray(options.history)) {
		rawHistory = options.history;
	} else if (Array.isArray(options.messages)) {
		rawHistory = options.messages;
	}
	const history = rawHistory
		.map((message) => ({
			role: text(message?.role) || "client",
			content: text(message?.content),
		}))
		.filter((message) => message.content);
	const rounds = Number(options.maxRounds);
	return {
		subject: text(options.subject),
		history,
		clientMessage: text(options.clientMessage) || lastClientContent(history),
		maxRounds: Number.isFinite(rounds) && rounds > 0 ? rounds : MAX_CLARIFICATION_ROUNDS,
		ready: typeof options.ready === "boolean" ? options.ready : undefined,
	};
}

/**
 * Reads the provider configuration from the environment.
 *
 * A provider is used only when it is explicitly configured: a key for
 * OpenRouter or Gemini, or an explicit `OLLAMA_HOST`. The general assistant
 * treats a local Ollama at 127.0.0.1:11434 as "available" by default, which
 * would mean an unanswered intake request on a machine with no model server -
 * a 45-second wait for a connection refusal.
 *
 * `CASE_AI_PROVIDER` names one explicitly ("openrouter", "gemini", "ollama")
 * or turns the AI off ("none"). `AI_ENABLED=false` turns it off for the
 * whole platform.
 *
 * @returns {{ name: string }} The provider to use, or `{ name: "none" }`.
 */
function resolveClarificationProvider() {
	if (process.env.AI_ENABLED === "false") {
		return { name: "none" };
	}
	const explicit = text(process.env.CASE_AI_PROVIDER).toLowerCase();
	if (explicit === "none") {
		return { name: "none" };
	}
	if (explicit === "openrouter" || explicit === "gemini" || explicit === "ollama") {
		return { name: explicit };
	}
	if (text(process.env.OPENROUTER_API_KEY)) {
		return { name: "openrouter" };
	}
	if (text(process.env.GEMINI_API_KEY)) {
		return { name: "gemini" };
	}
	if (text(process.env.OLLAMA_HOST)) {
		return { name: "ollama" };
	}
	return { name: "none" };
}

/**
 * The endpoint, headers and model of the configured provider.
 *
 * @param {string} name One of "openrouter", "gemini", "ollama".
 * @returns {Object|null} The settings, or null when the provider is not configured.
 */
function providerSettings(name) {
	if (name === "openrouter") {
		return openrouterSettings();
	}
	if (name === "gemini") {
		return geminiSettings();
	}
	if (name === "ollama") {
		return ollamaSettings();
	}
	return null;
}

function openrouterSettings() {
	const apiKey = text(process.env.OPENROUTER_API_KEY);
	if (!apiKey) {
		return null;
	}
	return {
		style: "chat",
		endpoint:
			text(process.env.OPENROUTER_BASE_URL) || "https://openrouter.ai/api/v1/chat/completions",
		model: text(process.env.OPENROUTER_MODEL) || "meta-llama/llama-3.1-8b-instruct",
		headers: {
			Authorization: `Bearer ${apiKey}`,
			"HTTP-Referer": text(process.env.OPENROUTER_REFERER) || "https://gartexhub.com",
			"X-Title": text(process.env.OPENROUTER_APP_TITLE) || "GarTexHub",
		},
	};
}

function geminiSettings() {
	const apiKey = text(process.env.GEMINI_API_KEY);
	if (!apiKey) {
		return null;
	}
	const model = text(process.env.GEMINI_MODEL) || "gemini-2.0-flash-lite";
	return {
		style: "gemini",
		endpoint: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
		model,
		headers: { "x-goog-api-key": apiKey },
	};
}

function ollamaSettings() {
	const host = text(process.env.OLLAMA_HOST);
	if (!host) {
		return null;
	}
	const base = host.replace(TRAILING_SLASHES, "");
	return {
		style: "chat",
		endpoint: text(process.env.OLLAMA_CHAT_ENDPOINT) || `${base}/v1/chat/completions`,
		model: text(process.env.OLLAMA_MODEL) || "llama3",
		headers: {},
	};
}

function providerRequest(settings, prompt, systemPrompt) {
	if (settings.style === "gemini") {
		return {
			system_instruction: { parts: [{ text: systemPrompt }] },
			contents: [{ role: "user", parts: [{ text: prompt }] }],
			generationConfig: { temperature: 0.2, maxOutputTokens: 300 },
		};
	}
	return {
		model: settings.model,
		messages: [
			{ role: "system", content: systemPrompt },
			{ role: "user", content: prompt },
		],
		temperature: 0.2,
		max_tokens: 300,
	};
}

function providerAnswer(payload, settings) {
	if (settings.style === "gemini") {
		return text(payload?.candidates?.[0]?.content?.parts?.[0]?.text);
	}
	return text(payload?.choices?.[0]?.message?.content);
}

function timeoutMs() {
	const configured = Number(process.env.CASE_AI_TIMEOUT_MS);
	if (Number.isFinite(configured) && configured > 0) {
		return configured;
	}
	return DEFAULT_TIMEOUT_MS;
}

async function fetchJson(url, options, ms) {
	const response = await fetch(url, { ...options, signal: AbortSignal.timeout(ms) });
	if (!response.ok) {
		throw new Error(`provider responded ${response.status}`);
	}
	return response.json();
}

function callConfiguredProvider(prompt, systemPrompt) {
	const { name } = resolveClarificationProvider();
	if (name === "none") {
		logInfo("No AI provider configured for the clarification conversation");
		return null;
	}
	const settings = providerSettings(name);
	if (!settings) {
		return null;
	}
	const ms = timeoutMs();
	return fetchJson(
		settings.endpoint,
		{
			method: "POST",
			headers: { "Content-Type": "application/json", ...settings.headers },
			body: JSON.stringify(providerRequest(settings, prompt, systemPrompt)),
		},
		ms,
	).then((payload) => providerAnswer(payload, settings));
}

/**
 * Races a promise against a timeout.
 *
 * The timeout is belt and braces: the fetch already carries an abort signal,
 * but a provider that ignores the signal (or a caller-supplied provider that
 * hangs) must not hold the request open either.
 *
 * @param {Promise<any>} promise
 * @param {number} ms
 * @returns {Promise<any>} The promise's value, or a rejection on timeout.
 */
async function withTimeout(promise, ms) {
	let timer = null;
	try {
		return await Promise.race([
			promise,
			new Promise((_resolve, reject) => {
				timer = setTimeout(() => reject(new Error("clarification provider timed out")), ms);
			}),
		]);
	} finally {
		if (timer) {
			clearTimeout(timer);
		}
	}
}

// A provider may be injected for a test (or for a future in-process model)
// without touching the environment. It is module state on purpose: the
// controller calls this service without knowing anything about providers.
let providerOverride = null;

/**
 * Installs a provider used by every later call.
 *
 * @param {Function|null} provider `async (prompt, systemPrompt) => string|null`.
 * @returns {void}
 */
function setClarificationProvider(provider) {
	providerOverride = typeof provider === "function" ? provider : null;
}

/**
 * Removes the installed provider.
 *
 * @returns {void}
 */
function resetClarificationProvider() {
	providerOverride = null;
}

/**
 * Answers one client message with a clarifying question.
 *
 * The caller owns `ready`: pass it when the controller has already decided
 * (the client confirmed, or the round cap is spent) and this service will
 * not ask a question at all. When it is not passed, the service derives it
 * from the transcript with the same round cap the controller uses.
 *
 * @param {Object} [options]
 * @param {string} [options.subject] The case subject.
 * @param {Array<Object>} [options.history] The transcript, oldest first.
 * @param {Array<Object>} [options.messages] The transcript, under its other name.
 * @param {string} [options.clientMessage] The message the client just sent.
 * @param {boolean} [options.ready] Whether the case is already ready.
 * @param {number} [options.maxRounds] The clarification round cap.
 * @param {Function} [options.provider] `async (prompt, systemPrompt) => string|null`.
 * @returns {Promise<{ reply: string, ready: boolean }>} Never rejects.
 */
async function answerClarification(options = {}) {
	const turn = normalizeOptions(options);
	const turns = countClientTurns(turn.history, turn.clientMessage);
	const isReady = typeof turn.ready === "boolean" ? turn.ready : turns >= turn.maxRounds;

	if (isReady) {
		// Nothing left to clarify. Asking a question here would push the case
		// back into a round the client has already spent.
		return { reply: READY_REPLY, ready: true };
	}

	const call = options.provider || providerOverride || callConfiguredProvider;
	if (!call) {
		return { reply: FALLBACK_CLARIFYING_QUESTION, ready: false };
	}

	try {
		const prompt = buildClarificationPrompt(turn);
		const answer = await withTimeout(
			Promise.resolve().then(() => call(prompt, CLARIFICATION_SYSTEM_PROMPT)),
			timeoutMs(),
		);
		const reply = sanitizeString(text(answer), MAX_REPLY_CHARS);
		if (!reply) {
			return { reply: FALLBACK_CLARIFYING_QUESTION, ready: false };
		}
		return { reply, ready: false };
	} catch (error) {
		// A failed provider is not an error for the client: the case still
		// works, it just asks the fixed question instead.
		logWarn("Clarification provider failed; falling back to the fixed question", {
			message: String(error),
		});
		return { reply: FALLBACK_CLARIFYING_QUESTION, ready: false };
	}
}

export {
	answerClarification,
	buildClarificationPrompt,
	CLARIFICATION_SYSTEM_PROMPT,
	countClientTurns,
	FALLBACK_CLARIFYING_QUESTION,
	READY_REPLY,
	resetClarificationProvider,
	resolveClarificationProvider,
	setClarificationProvider,
};
