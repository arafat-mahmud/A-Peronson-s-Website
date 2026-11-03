import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
// @babel/core is a direct devDependency and re-exports the parser and
// traverse; pnpm's strict layout does not expose @babel/parser itself.
import { traverse as _traverse, parseSync } from "@babel/core";

/**
 * Guards the signed-URL surfaces against a JSX element name that has no binding.
 *
 * Context: 31a075d swapped two RightPanel call sites to <SignedImage> and
 * deleted the LazyImage import in the same edit, but a third call site — the
 * activeAvatar in the thread header — still used it. Nothing caught it:
 *
 *   - Biome's noUndeclaredVariables is effectively inert here (it cannot resolve
 *     a JSX element name against an import), so `biome check` passed.
 *   - No test renders RightPanel.
 *   - Rollup treats an unresolved *identifier* as a global and does not even
 *     warn; the build printed "built" and exited 0 with the bug present.
 *   - The whole unit suite was green.
 *
 * Rendering these components is not an option: RightPanel alone needs a large
 * mock surface, which is not proportionate to a one-line fix. So this asserts
 * statically, by parsing.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS DOES NOT CATCH  (every behavioural bullet below is asserted by a
 * test, so a change in behaviour breaks the suite instead of silently
 * outrunning this comment)
 * ---------------------------------------------------------------------------
 *
 * 1. Identifiers used OUTSIDE a JSX tag. The scan only ever looks at
 *    JSXOpeningElement names. The incident was a missing binding on a JSX tag,
 *    which this does catch; the same mistake in an expression body — a bare
 *    `LazyImage` passed to a function, assigned to a variable — is invisible to
 *    it. That is half the failure class the guard is named after, and it is
 *    not covered. Asserted by "ignores identifiers used outside a JSX tag".
 *
 * 2. Bindings that exist at runtime but not in the lexical scope: a component
 *    installed onto `globalThis`, one created by `eval`, or a name produced by
 *    a macro. Those are reported as unbound — false positives, not false
 *    negatives. Asserted by "reports a name bound only inside a narrower scope".
 *
 * 3. A `require` performed inside a block (`if (x) { const A = require(...) }`)
 *    binds `A` in that block only, so a JSX use outside the block is reported.
 *    Same test as (2). A *conditional require at module top level* is fine and
 *    is not reported — only block-scoped ones are.
 *
 * 4. Files with no JSX at all, which cannot be inspected by a JSX-element
 *    guard. `src/hooks/useSignedSrc.js` (a hook) and `src/lib/signedFile.js`
 *    are therefore NOT in GUARDED below. An earlier revision listed
 *    useSignedSrc.js and had its probe test pass on a file where no probe was
 *    ever injected — a green test for work that never happened, which is the
 *    precise failure this guard exists to prevent.
 *
 * 5. Anything outside the five guarded files. The repo-wide
 *    `noUndeclaredVariables` / tsconfig migration remains deferred.
 *
 * HISTORY — why this parses instead of pattern-matching source text. The first
 * version blanked comments *and* strings with a regex before scanning for
 * `<Name`; an apostrophe in JSX text ("This can't be loaded") shifted the
 * string-pairing parity and blanked every later JSX tag. Measured on the
 * guarded files that destroyed 11 of 18 tags in ChatInterface and *all* of
 * them in AttachmentPreviewModal and FileAttachmentCard — so the guard passed
 * those three vacuously while a real unbound element sat in them. Parsing has
 * no such failure mode.
 */

// ESM repo: __dirname does not exist here, so derive the root from this file.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

/**
 * The signed-URL surfaces that contain JSX: everything this feature renders a
 * gated path through.
 *
 * Every entry must appear in EXPECTED_JSX_ELEMENTS below with its real, pinned
 * element count. If a file is added here without a count, its count test fails
 * loudly on `toBe(undefined)` rather than passing vacuously.
 */
const GUARDED = [
	"src/pages/chat/RightPanel.jsx",
	"src/pages/ChatInterface.jsx",
	"src/components/chat/AttachmentPreviewModal.jsx",
	"src/components/chat/FileAttachmentCard.jsx",
	"src/components/chat/SignedMedia.jsx",
];

/**
 * Real element counts, measured with countJsxElements() and pinned.
 *
 * These are the guard's anti-vacuity anchor. The previous revision asserted
 * `toBeGreaterThanOrEqual(0)`, which is true of every number, so a scanner that
 * had stopped finding JSX in a file — the round-2 failure mode, where three of
 * six files had *zero* surviving tags — passed that test. Pinning the count
 * means a regression in what the scanner can see fails here, loudly.
 *
 * Bump these when the file legitimately gains or loses an element; a mismatch
 * is the signal, not noise.
 */
const EXPECTED_JSX_ELEMENTS = {
	"src/pages/chat/RightPanel.jsx": 63,
	"src/pages/ChatInterface.jsx": 55,
	"src/components/chat/AttachmentPreviewModal.jsx": 100,
	"src/components/chat/FileAttachmentCard.jsx": 20,
	"src/components/chat/SignedMedia.jsx": 5,
};

const traverse = _traverse.default ?? _traverse;

function parseJsx(src) {
	return parseSync(src, {
		babelrc: false,
		configFile: false,
		sourceType: "unambiguous",
		parserOpts: { allowReturnOutsideFunction: true, plugins: ["jsx"] },
	});
}

function readSource(relative) {
	return fs.readFileSync(path.join(ROOT, relative), "utf8");
}

/**
 * Capitalised JSX element names with no *lexical* binding anywhere in scope.
 *
 * The narrowing is `getBinding`, not `hasBinding`, and the reason is not the
 * `{ noGlobals: true }` argument: `Scope#getBinding(name)` takes ONE
 * parameter and ignores the second one. The narrowing works because
 * `getBinding` never consults the runtime's globals - it walks the lexical
 * scopes only - so a name the runtime provides comes back *unbound* and is
 * reported. `scope.hasBinding(name)` does consult the globals, so with
 * hasBinding alone `<Map />`, `<Error />`, `<Promise />`, `<Math />` and 23
 * other globals came back "bound" and escaped.
 *
 * Measured over the 32 capitalised globals in GLOBAL_PROBE_NAMES: with
 * getBinding, 32 are flagged and 0 escape; with hasBinding alone, 5 are
 * flagged and 27 escape. Every name that escapes is a plausible typo target -
 * a deleted import called `Map` is exactly as broken as one called
 * `LazyImage`. Asserted by "flags a JSX name that resolves only to a runtime
 * global" and by "measures the global-name escape rate".
 *
 * The cost of the narrowing is caveat 2/3 in the header: names that exist only
 * at runtime are now reported instead of silently accepted. That is the right
 * direction to fail for a guard whose entire job is a loud ReferenceError.
 */
function findUnboundJsxNames(src) {
	const missing = new Set();
	traverse(parseJsx(src), {
		JSXOpeningElement(nodePath) {
			// <Icons.Star /> binds Icons, not Star.
			let root = nodePath.node.name;
			while (root && root.type === "JSXMemberExpression") root = root.object;
			if (!root || root.type !== "JSXIdentifier") return;
			const name = root.name;
			// Intrinsic elements (div, span, input...) are lowercase by
			// convention and are never variable references.
			if (!/^[A-Z]/.test(name)) return;
			if (!nodePath.scope.getBinding(name, { noGlobals: true })) missing.add(name);
		},
	});
	return [...missing];
}

/**
 * The capitalised runtime globals the guard is probed against.
 *
 * Pinned so the numbers in the docblock above are reproducible: the test
 * "measures the global-name escape rate" measures exactly this list. Lowercase
 * globals are excluded on purpose - the guard only reports capitalised names,
 * so a lowercase global is out of scope for it.
 */
const GLOBAL_PROBE_NAMES = [
	"Map",
	"Set",
	"WeakMap",
	"WeakSet",
	"Error",
	"TypeError",
	"Promise",
	"Symbol",
	"Array",
	"Object",
	"Number",
	"String",
	"Boolean",
	"Math",
	"JSON",
	"Atomics",
	"Proxy",
	"Reflect",
	"Date",
	"RegExp",
	"Function",
	"BigInt",
	"Intl",
	"ArrayBuffer",
	"DataView",
	"URL",
	"URLSearchParams",
	"TextEncoder",
	"TextDecoder",
	"AbortController",
	"NaN",
	"Infinity",
];

/**
 * The same scan, using hasBinding instead of getBinding.
 *
 * This is the instrument for the mechanism claim: it is what the guard would
 * report if it used hasBinding, and the difference between the two scanners
 * is exactly why the globals are caught.
 */
function findUnboundJsxNamesWithHasBinding(src) {
	const missing = new Set();
	traverse(parseJsx(src), {
		JSXOpeningElement(nodePath) {
			let root = nodePath.node.name;
			while (root && root.type === "JSXMemberExpression") root = root.object;
			if (!root || root.type !== "JSXIdentifier") return;
			const name = root.name;
			if (!/^[A-Z]/.test(name)) return;
			if (!nodePath.scope.hasBinding(name)) missing.add(name);
		},
	});
	return [...missing];
}

/** A source with one JSX element per probed global name. */
function globalProbeSource(names) {
	return [
		"export function Panel() {",
		"\treturn (",
		"\t\t<div>",
		...names.map((name) => `\t\t\t<${name} />`),
		"\t\t</div>",
		"\t);",
		"}",
	].join("\n");
}
function countJsxElements(src) {
	let count = 0;
	traverse(parseJsx(src), {
		JSXElement() {
			count += 1;
		},
	});
	return count;
}

/** "Icons.Star" for a member expression, "LazyImage" for a plain name. */
function jsxNameToString(node) {
	if (node.type === "JSXIdentifier") return node.name;
	if (node.type === "JSXMemberExpression") {
		const object = jsxNameToString(node.object);
		const property = jsxNameToString(node.property);
		return object && property ? `${object}.${property}` : null;
	}
	return null;
}

/**
 * Plants a distinct unbound probe at EVERY JSX position in the source.
 *
 * One probe per element, named ZzzUnboundProbe0..N, each with its own name, so
 * a single scan of the mutated file must return all N of them. That is
 * stronger than injecting one at a time: a scanner that visited only the first
 * element, or skipped any single position, returns a shorter list and fails.
 * The previous revision injected exactly one probe per file while its test
 * title claimed "at any position"; one-at-a-time over all positions cost 29 s
 * of wall clock, and the batch form proves the same property for 5 parses.
 *
 * Guided by the AST so every mutation is syntactically valid. Two shapes exist:
 * an element with a closing tag gets the probe as its first child, and a
 * self-closing element (`<X />`, which Babel models as
 * JSXElement{openingElement, selfClosing: true} — there is no
 * JSXSelfClosingElement node) is opened up so the probe has somewhere legal to
 * go. Edits are applied back-to-front so earlier offsets stay valid.
 */
function injectProbes(src) {
	const elements = [];
	traverse(parseJsx(src), {
		JSXElement(nodePath) {
			elements.push(nodePath.node);
		},
	});

	const edits = [];
	const names = [];
	elements.forEach((element, index) => {
		const opening = element.openingElement;
		const tag = jsxNameToString(opening.name);
		if (tag === null) return;
		const name = `ZzzUnboundProbe${index}`;
		names.push(name);
		if (opening.selfClosing) {
			edits.push({
				start: element.end - 2, // drop the trailing "/>"
				end: element.end,
				text: `><${name} /></${tag}>`,
			});
			return;
		}
		edits.push({ start: opening.end, end: opening.end, text: `<${name} />` });
	});

	let mutated = src;
	for (const edit of edits.sort((a, b) => b.start - a.start)) {
		mutated = mutated.slice(0, edit.start) + edit.text + mutated.slice(edit.end);
	}
	return { names, src: mutated };
}

/**
 * A synthetic file with every JSX shape the injector has to survive:
 *   0 <div>   container with children      -> probe becomes the first child
 *   1 <Card/> self-closing, plain name      -> opened up, probe nested
 *   2 <span>  container with children      -> probe becomes the first child
 *   3 <Icons.Star/>  self-closing, member  -> opened up, probe nested
 *   4 <p></p>  closing tag, no children    -> probe becomes the only child
 * The answer is known by hand (5 elements), so the two instruments below are
 * pinned independently of the real files — a per-file test that weakens its own
 * assertion cannot quietly un-guard the instrument that feeds it.
 */
const INSTRUMENT_SOURCE = [
	'import Card from "./Card.jsx";',
	'import * as Icons from "./icons.jsx";',
	"export function Panel({ url }) {",
	"\treturn (",
	"\t\t<div>",
	"\t\t\t<Card src={url} />",
	"\t\t\t<span>",
	"\t\t\t\t<Icons.Star />",
	"\t\t\t</span>",
	"\t\t\t<p></p>",
	"\t\t</div>",
	"\t);",
	"}",
].join("\n");

describe("JSX elements resolve to a binding (signed-url surfaces)", () => {
	// The scanner is the guard, so the guard is tested. Without these, a
	// silently broken scanner would make the real assertions vacuous.
	test("counts every JSX element, whatever its shape", () => {
		expect(countJsxElements(INSTRUMENT_SOURCE)).toBe(5);
	});

	test("plants one distinct probe at every JSX position", () => {
		const { names, src: mutated } = injectProbes(INSTRUMENT_SOURCE);
		expect(names).toEqual([
			"ZzzUnboundProbe0",
			"ZzzUnboundProbe1",
			"ZzzUnboundProbe2",
			"ZzzUnboundProbe3",
			"ZzzUnboundProbe4",
		]);
		// One probe per element, and every one of them is findable.
		expect(countJsxElements(mutated)).toBe(10);
		expect(findUnboundJsxNames(mutated).sort()).toEqual([...names].sort());
	});

	test("flags a JSX name that is never bound", () => {
		const src = [
			'import Button from "./Button.jsx";',
			"export function Card() {",
			"\treturn (",
			"\t\t<div>",
			"\t\t\t<Button />",
			"\t\t\t<LazyImage src={avatar} />",
			"\t\t</div>",
			"\t);",
			"}",
		].join("\n");
		expect(findUnboundJsxNames(src)).toEqual(["LazyImage"]);
	});

	// Regression guard for the blanking failure in the header. The regex
	// implementation returned [] here: the apostrophe in "can't" flipped string
	// pairing, so the probe that follows was itself blanked before it was ever
	// scanned.
	test("finds an unbound element after an apostrophe in JSX text", () => {
		const src = [
			'import Card from "./Card.jsx";',
			"export function Panel() {",
			"\treturn (",
			"\t\t<div>",
			"\t\t\t<p>This can't be loaded, isn't it?</p>",
			"\t\t\t<p>It hasn't a binding either</p>",
			"\t\t\t<ZzzUnboundProbe />",
			"\t\t</div>",
			"\t);",
			"}",
		].join("\n");
		expect(findUnboundJsxNames(src)).toEqual(["ZzzUnboundProbe"]);
	});

	test("does not flag bound, local, member or commented-out names", () => {
		const src = [
			'import { SignedImage, SignedVideo } from "./SignedMedia.jsx";',
			'import * as Icons from "./icons.jsx";',
			"function Local() {",
			"\treturn null;",
			"}",
			"export function Panel() {",
			"\treturn (",
			"\t\t<div>",
			"\t\t\t<SignedImage />",
			"\t\t\t<SignedVideo />",
			"\t\t\t<Icons.Star />",
			"\t\t\t<Local />",
			"\t\t\t{/* <CommentedOut /> */}",
			"\t\t\t<span />",
			"\t\t</div>",
			"\t);",
			"}",
		].join("\n");
		expect(findUnboundJsxNames(src)).toEqual([]);
	});

	// Header caveat 1, asserted rather than asserted-in-prose: a global resolves
	// through scope.hasBinding(), so with hasBinding every one of these came
	// back clean. 27 of the 32 capitalised names in GLOBAL_PROBE_NAMES escape
	// that way - measured by "hasBinding alone would let the runtime globals
	// through".
	test("flags a JSX name that resolves only to a runtime global", () => {
		const src = [
			"export function Panel() {",
			"\treturn (",
			"\t\t<div>",
			"\t\t\t<Map />",
			"\t\t\t<Error />",
			"\t\t\t<Promise />",
			"\t\t\t<Math />",
			"\t\t</div>",
			"\t);",
			"}",
		].join("\n");
		expect(findUnboundJsxNames(src)).toEqual(["Map", "Error", "Promise", "Math"]);
	});

	// The measurement in the docblock, reproduced from a pinned list. The
	// numbers quoted there are these numbers, and they are the reason the
	// docblock quotes them at all.
	test("measures the global-name escape rate", () => {
		expect(GLOBAL_PROBE_NAMES).toHaveLength(32);
		const src = globalProbeSource(GLOBAL_PROBE_NAMES);
		const flagged = findUnboundJsxNames(src);
		expect(flagged).toHaveLength(32);
		expect(GLOBAL_PROBE_NAMES.filter((name) => !flagged.includes(name))).toEqual([]);
	});

	// The mechanism, measured rather than asserted in prose: getBinding never
	// consults the runtime's globals, so every global comes back unbound, while
	// hasBinding consults them and reports them as bound. The guard uses
	// getBinding, and that is the whole reason the globals are caught.
	test("hasBinding alone would let the runtime globals through", () => {
		const src = globalProbeSource(GLOBAL_PROBE_NAMES);
		const flagged = findUnboundJsxNamesWithHasBinding(src);
		expect(flagged).toHaveLength(5);
		expect(GLOBAL_PROBE_NAMES.filter((name) => !flagged.includes(name))).toHaveLength(27);
	});

	// Header caveat 1 again, from the other direction: the same unbound name is
	// missed in an expression and caught as a tag, in one source. This is the
	// honest limit of the guard — a bare `LazyImage` in an expression body, the
	// other half of the original incident, is NOT found.
	test("ignores identifiers used outside a JSX tag", () => {
		const src = [
			"export function Panel({ url }) {",
			"\tconst node = LazyImage;",
			"\tconst alsoMissing = SignedVideo;",
			"\treturn (",
			"\t\t<div>",
			"\t\t\t<LazyImage />",
			"\t\t\t{String(node)}",
			"\t\t\t{String(alsoMissing)}",
			"\t\t</div>",
			"\t);",
			"}",
		].join("\n");
		expect(findUnboundJsxNames(src)).toEqual(["LazyImage"]);
	});

	// Header caveats 2 and 3: names that exist at runtime or only inside a
	// block are reported as unbound. False positives, pinned so that the
	// narrowing in findUnboundJsxNames cannot silently acquire new ones.
	test("reports a name bound only inside a narrower scope", () => {
		const src = [
			"if (globalThis.__ALLOW__) {",
			'\tconst LazyImage = require("./LazyImage.jsx").default;',
			"\treturn <div><LazyImage /></div>;",
			"}",
			"globalThis.Widget = function Widget() {",
			"\treturn null;",
			"};",
			"export function Panel() {",
			"\treturn <div><LazyImage /><Widget /></div>;",
			"}",
		].join("\n");
		expect(findUnboundJsxNames(src)).toEqual(["LazyImage", "Widget"]);
	});

	// The real-surface proof: a probe is planted at every JSX position in the
	// real file and every one of them must come back. probes.length is asserted
	// against the pinned element count, so a file whose JSX stopped being seen
	// fails here instead of "detecting" zero probes successfully.
	test.each(GUARDED)("%s detects an unbound element injected at every JSX position", (relative) => {
		const { names, src: mutated } = injectProbes(readSource(relative));
		expect(names.length).toBe(EXPECTED_JSX_ELEMENTS[relative]);
		expect(names.length).toBeGreaterThan(0);
		expect(findUnboundJsxNames(mutated).sort()).toEqual([...names].sort());
	});

	// Pinning the counts is what makes the tests above non-vacuous: if the
	// scanner cannot see the JSX any more, the count changes and this fails.
	test.each(GUARDED)("%s has the pinned JSX element count", (relative) => {
		expect(countJsxElements(readSource(relative))).toBe(EXPECTED_JSX_ELEMENTS[relative]);
	});

	test.each(GUARDED)("%s has no unbound JSX element", (relative) => {
		expect(findUnboundJsxNames(readSource(relative))).toEqual([]);
	});
});
