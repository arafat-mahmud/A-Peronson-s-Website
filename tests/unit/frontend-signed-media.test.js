import { jest } from "@jest/globals";
import { render } from "@testing-library/react";

/**
 * The class plumbing of the signed media (src/components/chat/SignedMedia.jsx).
 *
 * The fix wave changed `className={className}` to `class={className}` on both
 * the <LazyImage> and the <video>. React 19 accepts `class` on a DOM element,
 * so the <video> kept working - but LazyImage reads `className` and spreads
 * everything else onto the <img> it renders, so `class` fell through
 * `...rest` and landed on the <img> as a SECOND class attribute, replacing
 * the `transition-opacity duration-200 opacity-0/100` classes LazyImage sets.
 * The fade-in was gone, and React logged "Invalid DOM property `class`" for
 * every <img> it rendered.
 *
 * The hook is mocked so the test is about the class and nothing else: the
 * signing path has its own suite (tests/unit/frontend-signed-file.test.js).
 */

const SIGNED = "https://api.example.com/api/files/content?path=%2Fuploads%2Fchat%2Fa.png&sig=abc";

jest.unstable_mockModule("../../src/hooks/useSignedSrc.js", () => ({
	useSignedSrc: () => SIGNED,
	useSignedSrcState: () => ({ src: SIGNED, error: null }),
}));
jest.unstable_mockModule("../../src/lib/auth.js", () => ({
	apiRequest: jest.fn(),
	getToken: () => "test-token",
}));

const { SignedImage, SignedVideo } = await import("../../src/components/chat/SignedMedia.jsx");

/** Every `class` attribute node on an element. */
function classAttributesOf(element) {
	return [...element.attributes].filter((attribute) => attribute.name === "class");
}

/**
 * Records every attribute React writes while `fn` runs.
 *
 * React writes attributes through setAttribute, so this is the attribute
 * stream the DOM actually sees - which is the only place a SECOND class
 * attribute can be observed. The DOM itself keeps one attribute per name, so
 * a duplicate is invisible in `element.attributes`; the overwrite it causes
 * is visible in the VALUE.
 *
 * @param {() => void} fn - The render.
 * @returns {Array<[string, string]>} The attribute writes, in order.
 */
function recordAttributeWrites(fn) {
	const writes = [];
	const original = Element.prototype.setAttribute;
	Element.prototype.setAttribute = function patched(name, value) {
		writes.push([name, String(value)]);
		return original.call(this, name, value);
	};
	try {
		fn();
	} finally {
		Element.prototype.setAttribute = original;
	}
	return writes;
}

// React's "Invalid DOM property" warning is deduplicated per property name
// for the lifetime of the module, so it is collected across the whole file
// and asserted once, at the end. A per-test assertion would pass on every
// test but the first - a green test for a warning nobody saw.
const consoleErrors = [];
let consoleErrorSpy;

beforeEach(() => {
	consoleErrorSpy = jest.spyOn(console, "error").mockImplementation((...args) => {
		consoleErrors.push(args.map(String).join(" "));
	});
});

afterEach(() => {
	consoleErrorSpy.mockRestore();
});

afterAll(() => {
	expect(consoleErrors.join("\n")).not.toMatch(/Invalid DOM property/);
});

describe("the signed media (src/components/chat/SignedMedia.jsx)", () => {
	test("the caller's classes reach the rendered image, together with LazyImage's own", () => {
		const { container } = render(
			<SignedImage
				src="/uploads/chat/a.png"
				alt="Shared image"
				width={600}
				height={400}
				className="max-h-64 w-full object-cover"
			/>,
		);
		const img = container.querySelector("img");
		expect(img).not.toBeNull();

		// The caller's classes and LazyImage's own have to be in the SAME
		// value. A second class attribute silently replaces the first, and the
		// one it replaced here was the fade.
		const classAttributes = classAttributesOf(img);
		expect(classAttributes).toHaveLength(1);

		const value = classAttributes[0].value;
		expect(value).toContain("max-h-64 w-full object-cover");
		expect(value).toContain("transition-opacity");
		expect(value).toContain("duration-200");
		expect(value).toContain("opacity-0");
	});

	test("the class attribute is written once, not twice", () => {
		// The literal form of the defect: `class` used to reach the <img>
		// through LazyImage's `...rest`, so React wrote the class attribute
		// twice and the second write won.
		const writes = recordAttributeWrites(() => {
			render(
				<SignedImage
					src="/uploads/chat/a.png"
					alt="Shared image"
					width={600}
					height={400}
					className="max-h-64 w-full object-cover"
				/>,
			);
		});
		const classWrites = writes.filter(([name]) => name === "class");
		expect(classWrites).toHaveLength(1);
		expect(classWrites[0][1]).toContain("max-h-64 w-full object-cover");
		expect(classWrites[0][1]).toContain("transition-opacity");
	});

	test("the video carries the caller's classes in one class attribute", () => {
		const { container } = render(
			<SignedVideo src="/uploads/calls/r.webm" className="max-h-64 w-full object-cover" />,
		);
		const video = container.querySelector("video");
		expect(video).not.toBeNull();

		const classAttributes = classAttributesOf(video);
		expect(classAttributes).toHaveLength(1);
		expect(classAttributes[0].value).toBe("max-h-64 w-full object-cover");
	});
});
