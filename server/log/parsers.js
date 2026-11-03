// Plugin architecture: custom parsers can transform/annotate entries before they're stored.
const PARSER_PLUGINS = [];

export function registerParser(parser) {
	if (typeof parser !== "function") {
		return;
	}
	PARSER_PLUGINS.push(parser);
}

export function unregisterParser(parser) {
	const idx = PARSER_PLUGINS.indexOf(parser);
	if (idx !== -1) {
		PARSER_PLUGINS.splice(idx, 1);
	}
}

export function parserCount() {
	return PARSER_PLUGINS.length;
}

export function runParsers(entry) {
	let current = entry;
	for (const parser of PARSER_PLUGINS) {
		try {
			const result = parser(current);
			if (result && typeof result === "object") {
				current = { ...current, ...result };
			}
		} catch {
			// parser errors must never break the pipeline
		}
	}
	return current;
}
