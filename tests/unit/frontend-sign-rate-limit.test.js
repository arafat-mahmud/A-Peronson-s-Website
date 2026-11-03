import { jest } from "@jest/globals";
import { render, renderHook, screen, waitFor } from "@testing-library/react";

/**
 * The client's side of the /sign budget (src/lib/signedFile.js).
 *
 * Two things were wrong:
 *
 *   1. The client asked the server for ONE PATH PER REQUEST. A chat thread
 *      with fifty images was fifty requests against a per-user budget of
 *      sixty a minute, and every preview modal spent another one. The server
 *      accepts up to 50 paths in a single request, so the paths a client wants
 *      at the same moment now go together.
 *
 *   2. A 429 was swallowed. `signPaths` caught every failure and returned an
 *      empty object, so a rate-limited sign and a refused sign were
 *      indistinguishable: the thumbnail or the download simply did not
 *      appear, with nothing on screen to say why and no backoff to let the
 *      server recover.
 *
 * This file is separate from tests/unit/frontend-signed-file.test.js on
 * purpose: the rate-limit cooldown is module state, so a 429 in one test
 * would slow every later sign request in the same file. One file, one
 * module registry, one cooldown.
 */

const apiRequest = jest.fn();
const getToken = jest.fn(() => "test-token");
jest.unstable_mockModule("../../src/lib/auth.js", () => ({ apiRequest, getToken }));

const { SIGN_RATE_LIMITED, describeSignFailure, signEntry, signOne, signRateLimitWaitMs } =
	await import("../../src/lib/signedFile.js");
const { useSignedSrcState } = await import("../../src/hooks/useSignedSrc.js");
// The real hook, the real component: the point of these tests is the WHOLE
// chain from the server's answer to the words on the screen, because the
// defect lived at the seam between them.
const { SignedImage } = await import("../../src/components/chat/SignedMedia.jsx");

/** An error shaped like the one apiRequest throws for a non-2xx response. */
function rateLimitError() {
	const error = new Error("Too many requests, please try again later.");
	error.status = 429;
	return error;
}

beforeEach(() => {
	apiRequest.mockReset();
	apiRequest.mockResolvedValue({ signed: {} });
});

describe("the batching of sign requests (src/lib/signedFile.js)", () => {
	test("signs many paths in ONE request", async () => {
		// The whole point: a thread with fifty images was fifty requests
		// against a budget of sixty a minute.
		const paths = Array.from({ length: 25 }, (_, index) => `/uploads/chat/a${index}.png`);
		await Promise.all(paths.map((path) => signOne(path)));

		expect(apiRequest).toHaveBeenCalledTimes(1);
		expect(apiRequest.mock.calls[0][1].body.paths).toHaveLength(25);
	});

	test("never sends more paths than the server accepts in one request", async () => {
		// The server slices the body to 50 paths and answers for a prefix of
		// the list, so an over-long body would quietly lose paths.
		const paths = Array.from({ length: 60 }, (_, index) => `/uploads/chat/a${index}.png`);
		await Promise.all(paths.map((path) => signOne(path)));

		expect(apiRequest).toHaveBeenCalledTimes(2);
		for (const call of apiRequest.mock.calls) {
			expect(call[1].body.paths.length).toBeLessThanOrEqual(50);
		}
	});

	test("the same path asked for twice in one turn is sent once", async () => {
		await Promise.all([signOne("/uploads/chat/a.png"), signOne("/uploads/chat/a.png")]);
		expect(apiRequest).toHaveBeenCalledTimes(1);
	});
});

describe("a rate-limited sign (src/lib/signedFile.js)", () => {
	test("reports the rate limit instead of a silent miss", async () => {
		apiRequest.mockRejectedValue(rateLimitError());

		const entry = await signEntry("/uploads/chat/a.png");

		// Before the fix this was an empty object, which is what a refused
		// path looks like too.
		expect(entry).toMatchObject({ error: SIGN_RATE_LIMITED, status: 429 });
	});

	test("still fails closed: no url, and never the raw path", async () => {
		apiRequest.mockRejectedValue(rateLimitError());
		expect(await signOne("/uploads/chat/a.png")).toBeNull();
	});

	test("backs off before the next request", async () => {
		apiRequest.mockRejectedValue(rateLimitError());
		await signEntry("/uploads/chat/a.png");
		expect(signRateLimitWaitMs()).toBeGreaterThan(0);

		// The next request waits out the remainder of the cooldown instead of
		// adding to the load the limiter is shedding.
		apiRequest.mockResolvedValue({ signed: {} });
		const started = Date.now();
		await signOne("/uploads/chat/b.png");
		expect(Date.now() - started).toBeGreaterThanOrEqual(400);
	});

	test("the surface can say WHY the preview did not load", async () => {
		apiRequest.mockRejectedValue(rateLimitError());
		const entry = await signEntry("/uploads/chat/a.png");

		const message = describeSignFailure(entry);
		expect(message).toMatch(/rate limiting/i);
		// A refusal is a different fact and says something different.
		expect(describeSignFailure({ error: "forbidden", status: 403 })).toMatch(/access/i);
	});
});

describe("the signed-src hook (src/hooks/useSignedSrc.js)", () => {
	test("reports the rate limit so a surface can show it", async () => {
		apiRequest.mockRejectedValue(rateLimitError());

		const { result } = renderHook(() => useSignedSrcState("/uploads/chat/a.png"));

		// The url stays empty - the fail-closed value - but the REASON is
		// reported, which is what was missing.
		await waitFor(() => expect(result.current.error).not.toBeNull(), { timeout: 5000 });
		// The failure is reported in the SERVER'S OWN SHAPE, so a surface can
		// hand it to describeSignFailure unchanged. It used to be renamed to
		// `reason`, which is a dropped reason: describeSignFailure reads
		// `error`, so a rate limit read as the generic "could not be loaded".
		expect(result.current.error).toMatchObject({ error: SIGN_RATE_LIMITED, status: 429 });
		expect(result.current.src).toBe("");
	});

	test("a failure with no reported reason is still a failure", async () => {
		// The request failed outright: signEntry resolves null, and the surface
		// must still say something rather than render a hole.
		apiRequest.mockRejectedValue(new Error("network down"));

		const { result } = renderHook(() => useSignedSrcState("/uploads/chat/a.png"));

		await waitFor(() => expect(result.current.error).not.toBeNull(), { timeout: 5000 });
		expect(result.current.error).toMatchObject({ error: null, status: null });
		expect(result.current.src).toBe("");
	});
});

describe("the thumbnail placeholder (src/components/chat/SignedMedia.jsx)", () => {
	test("a rate-limited sign says the server is rate limiting", async () => {
		apiRequest.mockRejectedValue(rateLimitError());

		render(<SignedImage src="/uploads/chat/a.png" alt="Shared image" />);

		// The placeholder is the ONLY thing the user can read here, so it has
		// to name the reason. It used to say the generic "could not be
		// loaded", because the hook renamed the server's `error` to `reason`
		// and describeSignFailure reads `error`.
		await waitFor(() => expect(screen.getByRole("status")).toBeInTheDocument(), { timeout: 5000 });
		expect(screen.getByRole("status")).toHaveTextContent(/rate limiting/i);
	});

	test("a refused sign says the file is not accessible, and says something DIFFERENT", async () => {
		apiRequest.mockResolvedValue({
			signed: { "/uploads/chat/a.png": { error: "forbidden", status: 403 } },
		});

		render(<SignedImage src="/uploads/chat/a.png" alt="Shared image" />);

		await waitFor(() => expect(screen.getByRole("status")).toBeInTheDocument(), { timeout: 5000 });
		expect(screen.getByRole("status")).toHaveTextContent(/access/i);

		// Distinguishable: a refusal is not a rate limit, and the two must not
		// read as the same sentence.
		const refusalMessage = screen.getByRole("status").textContent;
		const rateLimitMessage = describeSignFailure({ error: SIGN_RATE_LIMITED, status: 429 });
		expect(refusalMessage).not.toBe(rateLimitMessage);
		expect(refusalMessage).not.toMatch(/rate limiting/i);
	});
});
