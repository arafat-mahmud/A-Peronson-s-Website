import fs from "node:fs";
import path from "node:path";
import { jest } from "@jest/globals";
import { renderHook, waitFor } from "@testing-library/react";

const apiRequest = jest.fn();
const getToken = jest.fn(() => "test-token");
// The helper imports both symbols; an ESM mock factory that omits one fails at
// link time with "does not provide an export named 'getToken'".
jest.unstable_mockModule("../../src/lib/auth.js", () => ({ apiRequest, getToken }));

const {
	isThirdPartySafe,
	signAndAssign,
	signAndDownload,
	signAndOpen,
	signOne,
	signOneWithTtl,
	signPaths,
} = await import("../../src/lib/signedFile.js");
// Imported dynamically for the same reason: it reaches the mocked auth module
// through signedFile.js, so it must be linked after the mock is registered.
const { useSignedSrc } = await import("../../src/hooks/useSignedSrc.js");

/** Captures anchor clicks so signAndDownload can be asserted without navigating. */
function captureAnchorClicks() {
	const clicks = [];
	const original = HTMLAnchorElement.prototype.click;
	HTMLAnchorElement.prototype.click = function capture() {
		clicks.push({ href: this.getAttribute("href"), download: this.download });
	};
	return {
		clicks,
		restore() {
			HTMLAnchorElement.prototype.click = original;
		},
	};
}

beforeEach(() => {
	apiRequest.mockReset();
	getToken.mockClear();
});

describe("signed file helper (src/lib/signedFile.js)", () => {
	test("returns the server payload for each path", async () => {
		apiRequest.mockResolvedValue({
			signed: { "/uploads/contracts/a.pdf": { url: "/api/files/content?x=1" } },
		});
		const out = await signPaths(["/uploads/contracts/a.pdf"]);
		expect(out["/uploads/contracts/a.pdf"].url).toBe("/api/files/content?x=1");
	});

	test("sends the bearer token, the method and the path list", async () => {
		apiRequest.mockResolvedValue({ signed: {} });
		await signPaths(["/uploads/contracts/a.pdf"]);
		expect(apiRequest).toHaveBeenCalledWith("/files/sign", {
			method: "POST",
			token: "test-token",
			body: { paths: ["/uploads/contracts/a.pdf"] },
		});
	});

	test("normalises an absolute url to its pathname before signing", async () => {
		// With VITE_API_URL set, toAbsoluteAssetUrl() hands us an absolute url.
		// The server's path helpers only strip a leading "uploads/", so an
		// absolute url used to arrive as the first segment "http:" and be
		// reported not_gated.
		apiRequest.mockResolvedValue({ signed: {} });
		await signPaths(["https://api.example.com/uploads/chat/a.png"]);
		expect(apiRequest).toHaveBeenCalledWith(
			"/files/sign",
			expect.objectContaining({ body: { paths: ["/uploads/chat/a.png"] } }),
		);
	});

	test("keys the result by the normalised path, not the path passed in", async () => {
		apiRequest.mockResolvedValue({
			signed: { "/uploads/chat/a.png": { url: "/api/files/content?z=3" } },
		});
		const out = await signPaths(["https://api.example.com/uploads/chat/a.png"]);
		expect(out["/uploads/chat/a.png"].url).toBe("/api/files/content?z=3");
		expect(await signOne("https://api.example.com/uploads/chat/a.png")).toBe(
			"/api/files/content?z=3",
		);
	});

	test("returns false when the server refuses the path", async () => {
		apiRequest.mockResolvedValue({
			signed: { "/uploads/contracts/a.pdf": { error: "forbidden" } },
		});
		expect(await signAndOpen("/uploads/contracts/a.pdf")).toBe(false);
	});

	test("returns false on a network failure", async () => {
		apiRequest.mockRejectedValue(new Error("offline"));
		expect(await signAndOpen("/uploads/contracts/a.pdf")).toBe(false);
	});

	test("opens the signed url", async () => {
		apiRequest.mockResolvedValue({
			signed: { "/uploads/contracts/a.pdf": { url: "/api/files/content?x=1" } },
		});
		// Assigning `globalThis.window` is a no-op under jsdom — `window` is a
		// non-writable self-reference — so shadow `open` on the real window and
		// restore it afterwards.
		const open = jest.fn();
		const originalOpen = window.open;
		window.open = open;
		try {
			expect(await signAndOpen("/uploads/contracts/a.pdf")).toBe(true);
			expect(open).toHaveBeenCalledWith("/api/files/content?x=1", "_blank");
		} finally {
			window.open = originalOpen;
		}
	});

	test("assigns the signed url to a setter", async () => {
		apiRequest.mockResolvedValue({
			signed: { "/uploads/chat/b.png": { url: "/api/files/content?y=2" } },
		});
		const setter = jest.fn();
		expect(await signAndAssign("/uploads/chat/b.png", setter)).toBe(true);
		expect(setter).toHaveBeenCalledWith("/api/files/content?y=2");
	});

	test("never calls the setter when the server refuses the path", async () => {
		// The DOM-sink invariant: a rendered src is only ever assigned a value the
		// server will accept, so a refusal must leave the sink empty rather than
		// fall back to the raw path.
		apiRequest.mockResolvedValue({
			signed: { "/uploads/chat/b.png": { error: "forbidden", status: 403 } },
		});
		const setter = jest.fn();
		expect(await signAndAssign("/uploads/chat/b.png", setter)).toBe(false);
		expect(setter).not.toHaveBeenCalled();
	});

	test("never calls the setter when the sign request fails outright", async () => {
		apiRequest.mockRejectedValue(new Error("offline"));
		const setter = jest.fn();
		expect(await signAndAssign("/uploads/chat/b.png", setter)).toBe(false);
		expect(setter).not.toHaveBeenCalled();
	});

	test("signOne returns the url, or null when refused", async () => {
		apiRequest.mockResolvedValue({
			signed: { "/uploads/chat/b.png": { url: "/api/files/content?y=2" } },
		});
		expect(await signOne("/uploads/chat/b.png")).toBe("/api/files/content?y=2");

		apiRequest.mockResolvedValue({ signed: { "/uploads/chat/b.png": { error: "forbidden" } } });
		expect(await signOne("/uploads/chat/b.png")).toBeNull();

		expect(await signOne("")).toBeNull();
		expect(await signOne(null)).toBeNull();
	});

	test("signAndDownload clicks an anchor carrying the download attribute", async () => {
		apiRequest.mockResolvedValue({
			signed: { "/uploads/chat/report.pdf": { url: "/api/files/content?d=4" } },
		});
		const capture = captureAnchorClicks();
		try {
			expect(await signAndDownload("/uploads/chat/report.pdf", "report.pdf")).toBe(true);
		} finally {
			capture.restore();
		}
		expect(capture.clicks).toEqual([{ href: "/api/files/content?d=4", download: "report.pdf" }]);
		// The synthetic anchor must not be left behind in the document.
		expect(document.querySelectorAll("a")).toHaveLength(0);
	});

	test("signAndDownload clicks nothing when the server refuses the path", async () => {
		apiRequest.mockResolvedValue({
			signed: { "/uploads/chat/report.pdf": { error: "forbidden" } },
		});
		const capture = captureAnchorClicks();
		try {
			expect(await signAndDownload("/uploads/chat/report.pdf", "report.pdf")).toBe(false);
		} finally {
			capture.restore();
		}
		expect(capture.clicks).toEqual([]);
		expect(document.querySelectorAll("a")).toHaveLength(0);
	});
});

describe("the third-party decision (src/lib/signedFile.js)", () => {
	// The Office viewer fetches and retains whatever url it is given, so a
	// private document must never reach it. Whether a path is private is the
	// SERVER's answer: the client used to keep its own copy of the gated-prefix
	// list, and a prefix added to the server without updating that copy left the
	// embed unsuppressed and handed a private document to Microsoft.
	test("reports the server's answer for a public path", async () => {
		apiRequest.mockResolvedValue({
			signed: { "/uploads/feed/poster.png": { error: "not_gated", thirdPartySafe: true } },
		});
		expect(await isThirdPartySafe("/uploads/feed/poster.png")).toBe(true);
	});

	test("reports the server's answer for a private path", async () => {
		apiRequest.mockResolvedValue({
			signed: { "/uploads/contracts/a.pdf": { error: "not_gated", thirdPartySafe: false } },
		});
		expect(await isThirdPartySafe("/uploads/contracts/a.pdf")).toBe(false);
	});

	// Fails closed: an answer that is missing, or a request that fails, is not
	// permission to hand a document to a third party.
	test("is false when the server does not answer", async () => {
		apiRequest.mockResolvedValue({ signed: {} });
		expect(await isThirdPartySafe("/uploads/contracts/a.pdf")).toBe(false);
	});

	test("is false when the request fails outright", async () => {
		apiRequest.mockRejectedValue(new Error("offline"));
		expect(await isThirdPartySafe("/uploads/contracts/a.pdf")).toBe(false);
	});

	test("is false for an empty path", async () => {
		expect(await isThirdPartySafe("")).toBe(false);
		expect(await isThirdPartySafe(null)).toBe(false);
		expect(apiRequest).not.toHaveBeenCalled();
	});

	// The mirror itself. A second copy of the gated-prefix list in the client is
	// the defect: nothing detects it when the server changes, and the
	// consequence is a private document handed to a third party.
	test("the client keeps no copy of the server's gated-prefix list", () => {
		const source = fs.readFileSync(path.join(process.cwd(), "src", "lib", "signedFile.js"), "utf8");
		expect(source).not.toMatch(/GATED_PREFIXES/);
		for (const prefix of ["chat", "contracts", "calls", "search"]) {
			expect(source).not.toMatch(new RegExp(`"${prefix}"`));
		}
	});

	// The same drift, in the other direction: the ttl used to be mirrored as a
	// client-side constant. The server returns the lifetime it actually used.
	test("the client keeps no copy of the server's signature lifetime", () => {
		const source = fs.readFileSync(path.join(process.cwd(), "src", "lib", "signedFile.js"), "utf8");
		expect(source).not.toMatch(/SIGNED_URL_TTL_MS/);
		expect(source).not.toMatch(/SIGNED_URL_REFRESH_MS/);
	});

	// The modal is the surface that hands a url to the Office viewer, so it is
	// the one that has to ask the server rather than decide for itself.
	test("the preview modal asks the server instead of deciding locally", () => {
		const source = fs.readFileSync(
			path.join(process.cwd(), "src", "components", "chat", "AttachmentPreviewModal.jsx"),
			"utf8",
		);
		expect(source).toMatch(/isThirdPartySafe/);
		expect(source).not.toMatch(/isGatedAssetPath/);
	});

	// "Download" has to download. window.open renders the document in a new
	// tab; a download needs the synthesised anchor that signAndDownload clicks,
	// because a signed url cannot carry a download attribute.
	//
	// The reason-aware form is the one the modal uses: a download that could
	// not start has to say why, and a rate-limited download is not the same
	// failure as a refused one.
	test("the preview modal downloads instead of opening a tab", () => {
		const source = fs.readFileSync(
			path.join(process.cwd(), "src", "components", "chat", "AttachmentPreviewModal.jsx"),
			"utf8",
		);
		expect(source).toMatch(/signAndDownloadWithReason\(file\.url/);
		// The preview <img> must not be rendered with a null src: React omits the
		// attribute for null, and the browser may then re-request the current
		// document. The <video> path already used undefined; the image has to
		// match.
		expect(source).not.toMatch(/src=\{signedSrc \|\| null\}/);
		expect(source).toMatch(/src=\{signedSrc \|\| undefined\}/);
	});
});

describe("the signature lifetime (src/lib/signedFile.js)", () => {
	test("signOneWithTtl returns the url and the server's ttl", async () => {
		apiRequest.mockResolvedValue({
			signed: { "/uploads/calls/r.webm": { url: "/api/files/content?m=1", ttlMs: 900_000 } },
		});
		expect(await signOneWithTtl("/uploads/calls/r.webm")).toEqual({
			url: "/api/files/content?m=1",
			ttlMs: 900_000,
		});
	});

	test("signOneWithTtl returns null when the path is refused", async () => {
		apiRequest.mockResolvedValue({
			signed: { "/uploads/contracts/a.pdf": { error: "forbidden" } },
		});
		expect(await signOneWithTtl("/uploads/contracts/a.pdf")).toBeNull();
	});
});

describe("useSignedSrc (src/hooks/useSignedSrc.js)", () => {
	test("returns an empty string until the server hands back a url", async () => {
		apiRequest.mockResolvedValue({
			signed: { "/uploads/chat/a.png": { url: "/api/files/content?h=1" } },
		});
		const { result } = renderHook(() => useSignedSrc("/uploads/chat/a.png"));
		expect(result.current).toBe("");
		await waitFor(() => expect(result.current).toBe("/api/files/content?h=1"));
	});

	test("stays empty when the server refuses the path", async () => {
		apiRequest.mockResolvedValue({ signed: { "/uploads/chat/a.png": { error: "forbidden" } } });
		const { result } = renderHook(() => useSignedSrc("/uploads/chat/a.png"));
		await waitFor(() => expect(apiRequest).toHaveBeenCalledTimes(1));
		expect(result.current).toBe("");
	});

	test("clears and re-signs when the url changes", async () => {
		apiRequest.mockResolvedValue({
			signed: {
				"/uploads/chat/a.png": { url: "/api/files/content?h=1" },
				"/uploads/chat/b.png": { url: "/api/files/content?h=2" },
			},
		});
		const { result, rerender } = renderHook(({ url }) => useSignedSrc(url), {
			initialProps: { url: "/uploads/chat/a.png" },
		});
		await waitFor(() => expect(result.current).toBe("/api/files/content?h=1"));
		rerender({ url: "/uploads/chat/b.png" });
		expect(result.current).toBe("");
		await waitFor(() => expect(result.current).toBe("/api/files/content?h=2"));
	});

	test("re-signs on the refresh interval so a long-lived surface does not outlive its signature", async () => {
		apiRequest.mockResolvedValue({
			signed: { "/uploads/chat/a.png": { url: "/api/files/content?h=1" } },
		});
		// The interval is wide on purpose: the assertion below is that the
		// FIRST sign happened before any refresh, and the sign is now queued
		// with the other paths of the same turn, so the first observation of
		// it is one poll of waitFor away.
		renderHook(() => useSignedSrc("/uploads/chat/a.png", { refreshMs: 500 }));
		await waitFor(() => expect(apiRequest).toHaveBeenCalledTimes(1));
		await waitFor(() => expect(apiRequest.mock.calls.length).toBeGreaterThan(1));
	});

	// The refresh interval follows the SERVER's lifetime, not a client-side
	// constant: half of the ttl the server actually handed out.
	test("re-signs at half the lifetime the server reported", async () => {
		apiRequest.mockResolvedValue({
			signed: { "/uploads/chat/a.png": { url: "/api/files/content?h=1", ttlMs: 1000 } },
		});
		renderHook(() => useSignedSrc("/uploads/chat/a.png"));
		await waitFor(() => expect(apiRequest).toHaveBeenCalledTimes(1));
		await waitFor(() => expect(apiRequest.mock.calls.length).toBeGreaterThan(1));
	});

	// A decorative thumbnail must not re-sign: every refresh swaps the
	// element's src, which visibly reloads an <img> and restarts a <video>.
	test("does not re-sign when the caller asks for no refresh", async () => {
		apiRequest.mockResolvedValue({
			signed: { "/uploads/chat/a.png": { url: "/api/files/content?h=1", ttlMs: 20 } },
		});
		renderHook(() => useSignedSrc("/uploads/chat/a.png", { refreshMs: 0 }));
		await waitFor(() => expect(apiRequest).toHaveBeenCalledTimes(1));
		await new Promise((resolve) => setTimeout(resolve, 60));
		expect(apiRequest).toHaveBeenCalledTimes(1);
	});

	test("does not sign when the url is empty", async () => {
		const { result } = renderHook(() => useSignedSrc(""));
		await waitFor(() => expect(result.current).toBe(""));
		expect(apiRequest).not.toHaveBeenCalled();
	});
});
