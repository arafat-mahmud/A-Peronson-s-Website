const TOKEN_RE = /(?:[^\s"']+|"[^"]*"|'[^']*')+/g;
const KEYWORD_RE =
	/^(?:(level|category|user|role|request|path|stack|json|bookmarked|pinned|from|to|regex):|(-))(.*)$/;

const LEVEL_WORDS = /^(error|err|warn|warning|info|debug|critical|success|fatal|ok)$/;
const CATEGORY_WORDS =
	/^(requests?|redis|prisma|syslog|worker|workers|assistant|image[-_ ]?queue|audit|analytics|auth|frontend)$/;
const AGO_RE = /^(\d+)(m|h|d)$/i;
const FIELD_RE = /^(level|category|user|role|request|path):(.+)$/i;
const AGO_MS = { m: 60_000, h: 3_600_000, d: 86_400_000 };

function normalizeLevelWord(token) {
	return token
		.toLowerCase()
		.replace(/^(err|warning)$/, (s) => (s === "err" ? "error" : "warn"))
		.replace(/^ok$/, "success")
		.replace(/^fatal$/, "critical");
}

function normalizeCategoryWord(token) {
	return token
		.toLowerCase()
		.replace(/^requests?$/, "requests")
		.replace(/^workers?$/, "workers")
		.replace(/^image[-_ ]?queue$/, "image_queue");
}

// Parse a single query token into the accumulator; returns true if consumed.
function consumeToken(state, token) {
	if (token.startsWith("regex:")) {
		try {
			let src = token.slice(6);
			if (src.startsWith("/") && src.endsWith("/") && src.length > 2) {
				src = src.slice(1, -1);
			}
			state.regex = new RegExp(src);
		} catch {
			// invalid regex ignored
		}
		return true;
	}
	if (token.startsWith("from:")) {
		state.from = token.slice(5);
		return true;
	}
	if (token.startsWith("to:")) {
		state.to = token.slice(3);
		return true;
	}
	if (consumeSimple(state, token)) {
		return true;
	}
	if (consumeAgo(state, token)) {
		return true;
	}
	if (consumeField(state, token)) {
		return true;
	}
	if (consumeWord(state, token)) {
		return true;
	}
	if (token.startsWith("-") && token.length > 1) {
		state.exclusions.push(token.slice(1).toLowerCase());
		return true;
	}
	state.terms.push(token.toLowerCase());
	return true;
}

function consumeSimple(state, token) {
	const map = {
		stack: "hasStack",
		json: "hasJson",
		bookmarked: "bookmarkedOnly",
		pinned: "pinnedOnly",
		today: "hasToday",
	};
	const key = map[token];
	if (!key) {
		return false;
	}
	state[key] = true;
	return true;
}

function consumeAgo(state, token) {
	const m = String(token).match(AGO_RE);
	if (!m) {
		return false;
	}
	state.agoMs = Math.min(
		state.agoMs ?? Number.POSITIVE_INFINITY,
		Number.parseInt(m[1], 10) * (AGO_MS[m[2].toLowerCase()] || 0),
	);
	return true;
}

function consumeField(state, token) {
	const m = token.match(FIELD_RE);
	if (!m) {
		return false;
	}
	state.fields[m[1].toLowerCase()] = m[2].toLowerCase();
	return true;
}

function consumeWord(state, token) {
	if (LEVEL_WORDS.test(token.toLowerCase())) {
		state.fields.level = state.fields.level || normalizeLevelWord(token);
		return true;
	}
	if (CATEGORY_WORDS.test(token.toLowerCase())) {
		state.fields.category = state.fields.category || normalizeCategoryWord(token);
		return true;
	}
	return false;
}

function parseQuery(q) {
	const raw = String(q || "").trim();
	if (!raw) {
		return { tokens: [], matcher: () => true };
	}
	const state = {
		terms: [],
		exclusions: [],
		fields: {},
		regex: null,
		hasStack: false,
		hasJson: false,
		from: null,
		to: null,
		bookmarkedOnly: false,
		pinnedOnly: false,
		hasToday: false,
		agoMs: null,
	};
	const tokens = raw.match(TOKEN_RE) || [];
	for (const tokenRaw of tokens) {
		consumeToken(state, tokenRaw.replace(/^["']|["']$/g, ""));
	}
	const matcher = buildMatcher(state);
	return {
		tokens,
		matcher,
		terms: state.terms,
		fields: state.fields,
		exclusions: state.exclusions,
		regex: state.regex,
	};
}

// Compose a predicate list — each tiny check keeps cognitive complexity low.
function buildMatcher(state) {
	const checks = [];
	if (state.hasStack) {
		checks.push((e) => !!e.stack);
	}
	if (state.hasJson) {
		checks.push((e) => !!(e.data || e.meta));
	}
	if (state.bookmarkedOnly) {
		checks.push((e) => !!e.bookmarked);
	}
	if (state.pinnedOnly) {
		checks.push((e) => !!e.pinned);
	}
	if (state.hasToday) {
		checks.push((e) => {
			const d = new Date();
			d.setHours(0, 0, 0, 0);
			return e.t >= d.getTime();
		});
	}
	if (state.agoMs !== null) {
		checks.push((e) => e.t >= Date.now() - state.agoMs);
	}
	if (state.regex) {
		checks.push((e) => state.regex.test(e.message || ""));
	}
	checks.push(...timeChecks(state));
	checks.push(...fieldChecks(state));
	checks.push(...textChecks(state));
	return (entry) => checks.every((check) => check(entry));
}

function timeChecks(state) {
	const checks = [];
	if (state.from) {
		checks.push((e) => {
			const f = parseTime(state.from);
			return Number.isNaN(f) || e.t >= f;
		});
	}
	if (state.to) {
		checks.push((e) => {
			const t = parseTime(state.to);
			return Number.isNaN(t) || e.t <= t;
		});
	}
	return checks;
}

function fieldChecks(state) {
	const checks = [];
	if (state.fields.level) {
		checks.push((e) => e.level.toLowerCase() === state.fields.level);
	}
	if (state.fields.category) {
		checks.push((e) => e.category.toLowerCase() === state.fields.category);
	}
	if (state.fields.path) {
		checks.push((e) =>
			(e.meta?.path || e.data?.path || "").toLowerCase().includes(state.fields.path),
		);
	}
	if (state.fields.request) {
		checks.push((e) =>
			(e.request_id || e.meta?.request_id || "").toLowerCase().includes(state.fields.request),
		);
	}
	if (state.fields.user) {
		checks.push((e) => {
			const userVal = String(
				e.meta?.user_id || e.data?.user_id || e.meta?.userId || e.data?.userId || "",
			).toLowerCase();
			return userVal.includes(state.fields.user);
		});
	}
	if (state.fields.role) {
		checks.push((e) =>
			String(e.meta?.role || e.data?.role || "")
				.toLowerCase()
				.includes(state.fields.role),
		);
	}
	return checks;
}

function textChecks(state) {
	const checks = [];
	const haystackOf = (e) =>
		`${e.message || ""} ${JSON.stringify(e.data || "")} ${JSON.stringify(e.meta || "")}`.toLowerCase();
	if (state.terms.length) {
		const terms = state.terms;
		checks.push((e) => {
			const hay = haystackOf(e);
			return terms.every((t) => hay.includes(t));
		});
	}
	if (state.exclusions.length) {
		const exclusions = state.exclusions;
		checks.push((e) => {
			const hay = haystackOf(e);
			return !exclusions.some((t) => hay.includes(t));
		});
	}
	return checks;
}

function parseTime(v) {
	if (typeof v === "number") {
		return v;
	}
	const s = String(v);
	if (/^\d+$/.test(s)) {
		return Number.parseInt(s, 10);
	}
	if (/^today$/i.test(s)) {
		const d = new Date();
		d.setHours(0, 0, 0, 0);
		return d.getTime();
	}
	const m = s.match(/^(\d+)([smhd])$/);
	if (m) {
		const mult = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[m[2]];
		return Date.now() - Number.parseInt(m[1], 10) * mult;
	}
	return Number.NaN;
}

export function matchQuery(q) {
	return parseQuery(q).matcher;
}

// Extract the plain search "words" that should be highlighted (message/field
// substring terms plus regex), ignoring parsed operators.
export function highlightTerms(query) {
	const { terms, exclusions, regex } = parseQuery(query);
	const words = [...terms, ...exclusions];
	const re = regex ? regex.source : null;
	if (!(words.length || re)) {
		return null;
	}
	return { words, regex: re };
}

export function highlightTokens(query, text) {
	const { terms, exclusions, regex } = parseQuery(query);
	const words = [...terms, ...exclusions];
	if (!(words.length || regex)) {
		return text;
	}
	return text;
}
