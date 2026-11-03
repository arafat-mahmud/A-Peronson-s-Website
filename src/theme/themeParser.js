/**
 * Strict Tailwind color-class parser for the Blue Theme migration.
 *
 * Independent of the token generator: this module is the validation-side
 * implementation (sections 9/19/20 of the migration spec). It parses one
 * utility class (with optional variant prefixes like `dark:` / `hover:`)
 * and returns a structured description, or null when the class carries no
 * color information.
 *
 * Supported (regression) cases:
 *  - border-rose-200 / border-blue-400 / border-red-500 (full prefixes;
 *    NOT confused with border-r-/border-l-/border-t-/border-b- sides)
 *  - shadow-sky-500/20 / shadow-black/20 / shadow-blue-500 (+ base shadows)
 *  - every gradient instance preserved (from/via/to incl. arbitrary stops)
 *  - transparent, text-inherit
 *  - arbitrary alpha: bg-white/[0.03]
 *  - arbitrary color + opacity: bg-[#3b82f6]/10, ring-[#3b82f6]/35,
 *    dark:bg-[#0b1627]/80
 *  - multi-stop arbitrary gradients (full expression, never truncated)
 */

const COLOR_PREFIXES = new Set([
	"bg",
	"text",
	"border",
	"ring-offset",
	"ring",
	"outline",
	"decoration",
	"divide",
	"placeholder",
	"accent",
	"caret",
	"from",
	"via",
	"to",
	"shadow",
]);

/** Known prefixes, longest first so ring-offset wins over ring. */
const SORTED_PREFIXES = [...COLOR_PREFIXES].sort((a, b) => b.length - a.length);

const BORDER_SIDES = new Set(["r", "l", "t", "b", "x", "y", "s", "e"]);

/** Suffixes that carry no color (font sizes, alignment, elevation, custom shadows). */
const NON_COLOR_SUFFIXES = new Set([
	"xs",
	"sm",
	"md",
	"base",
	"lg",
	"xl",
	"2xl",
	"3xl",
	"4xl",
	"5xl",
	"6xl",
	"7xl",
	"8xl",
	"9xl",
	"left",
	"center",
	"right",
	"justify",
	"start",
	"end",
	"truncate",
	"wrap",
	"nowrap",
	"balance",
	"pretty",
	"ellipsis",
	"clip",
	"inner",
	"none",
	"borderless",
]);
const CUSTOM_SHADOW_PREFIXES = ["borderless", "divider"];

/** Split `dark:hover:bg-sky-500/20` into { variants, body }. */
export function splitVariants(cls) {
	const parts = String(cls).split(":");
	return { variants: parts.slice(0, -1), body: parts[parts.length - 1] };
}

/**
 * Parse a single Tailwind utility class.
 * @returns {null | {prefix:string, color:string|null, alpha:string|null, raw:string, variants:string[]}}
 */
export function parseColorClass(cls) {
	const input = String(cls).trim();
	if (!input) return null;
	const { variants, body } = splitVariants(input);

	// Bare keywords.
	if (body === "transparent")
		return { prefix: "color", color: "transparent", alpha: null, raw: input, variants };
	if (body === "inherit" || body === "text-inherit")
		return { prefix: "text", color: "inherit", alpha: null, raw: input, variants };

	const match = SORTED_PREFIXES.find((p) => body === p || body.startsWith(`${p}-`));
	if (!match) return null;
	const prefix = match;
	const rest = body.slice(prefix.length + 1);
	if (!rest) return null;

	// Gradient direction utilities carry no color: bg-gradient-to-r, bg-gradient-to-br.
	if (rest.startsWith("gradient")) return null;

	// ring-offset widths (ring-offset-2) carry no color; ring-offset-transparent does.
	if (prefix === "ring-offset" && /^\d+$/.test(rest.split("/")[0])) return null;

	// Non-color utilities sharing a prefix (text-sm/md, shadow-lg/md, shadow-borderless, …).
	const head = rest.startsWith("[") ? null : rest.split("/")[0];
	if (
		head &&
		(NON_COLOR_SUFFIXES.has(head) || CUSTOM_SHADOW_PREFIXES.some((p) => head.startsWith(p)))
	)
		return null;

	// Border sides are widths, not colors: border-r-2, border-t, border-x-0, …
	if (
		prefix === "border" &&
		BORDER_SIDES.has(rest.split("-")[0]) &&
		!rest.includes("#") &&
		!rest.includes("[color")
	) {
		const side = rest.split("-")[0];
		// `border-r-red-500` is not a real utility; treat side-led classes as non-color
		// unless the remainder is itself a parseable color after the side (defensive: still parse it).
		const after = rest.slice(side.length + 1);
		if (!after) return null;
		if (
			!/^(red|rose|blue|sky|cyan|slate|white|black|emerald|amber)-/.test(after) &&
			!after.startsWith("[")
		)
			return null;
		return {
			prefix: `border-${side}`,
			color: after.split("/")[0],
			alpha: after.includes("/") ? after.split("/").slice(1).join("/") : null,
			raw: input,
			variants,
		};
	}

	// Arbitrary value: bg-[#3b82f6]/10, bg-white/[0.03], shadow-[0_0_30px_rgba(...)]
	if (rest.startsWith("[")) {
		const close = rest.lastIndexOf("]");
		const color = rest.slice(0, close + 1);
		const alpha = rest.length > close + 1 && rest[close + 1] === "/" ? rest.slice(close + 2) : null;
		return { prefix, color, alpha, raw: input, variants };
	}

	// Standard color with optional /alpha: sky-500/20, black/20, white/5
	const slash = rest.indexOf("/");
	const colorHead = slash === -1 ? rest : rest.slice(0, slash);
	const alpha = slash === -1 ? null : rest.slice(slash + 1);
	return { prefix, color: colorHead, alpha, raw: input, variants };
}

/** True when the class is a side-width border (border-r-2), not a color. */
export function isBorderSideClass(cls) {
	const { body } = splitVariants(String(cls));
	if (!body.startsWith("border-")) return false;
	const segs = body.split("-");
	return segs.length >= 2 && BORDER_SIDES.has(segs[1]) && parseColorClass(cls) === null;
}

/** Extract every gradient stop utility (from/via/to) from a class list string. */
export function extractGradients(classList) {
	const out = [];
	const re = /(?<!gradient-)\b(?:[a-z-]+:)*(from|via|to)-(\[[^\]]+\]|[^\s"']+)/g;
	let m;
	while ((m = re.exec(classList)) !== null) out.push(m[0]);
	return out;
}
