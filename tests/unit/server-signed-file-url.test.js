import {
	DEFAULT_TTL_MS,
	GATED_PREFIXES,
	isGatedPath,
	MEDIA_TTL_MS,
	MIN_SIGNING_SECRET_LENGTH,
	resolveWithinUploads,
	signFileUrl,
	verifySignedFile,
} from "../../server/utils/signedFileUrl.js";

// 32 characters is the floor the server enforces on the signing key, so the
// fixture has to clear it: a secret this module accepted but the server
// refused would make every test here prove the wrong thing.
const SECRET = "test-signing-secret-value-0123456789";
const ORIGINAL_SECRET = process.env.UPLOADS_SIGNING_SECRET;

// Freezes Date.now for the duration of `fn` so ttl arithmetic is exact instead of
// "one or two milliseconds ago, depending on how slow the runner is".
function withFakeNow(value, fn) {
	const real = Date.now;
	Date.now = () => value;
	try {
		return fn();
	} finally {
		Date.now = real;
	}
}

beforeEach(() => {
	process.env.UPLOADS_SIGNING_SECRET = SECRET;
});

afterAll(() => {
	if (ORIGINAL_SECRET === undefined) delete process.env.UPLOADS_SIGNING_SECRET;
	else process.env.UPLOADS_SIGNING_SECRET = ORIGINAL_SECRET;
});

describe("signed file urls (server/utils/signedFileUrl.js)", () => {
	test("classifies gated and public prefixes", () => {
		expect(GATED_PREFIXES).toEqual(["chat", "contracts", "calls", "search", "support"]);
		expect(isGatedPath("/uploads/contracts/a.pdf")).toBe(true);
		expect(isGatedPath("chat/b.png")).toBe(true);
		// A support case's evidence is private too.
		expect(isGatedPath("/uploads/support/shot.png")).toBe(true);
		expect(isGatedPath("/uploads/feed/c.png")).toBe(false);
		expect(isGatedPath("/uploads/profile/d.png")).toBe(false);
	});

	test("classifies gated prefixes case-insensitively", () => {
		// The filesystem is case-insensitive, so these name the same files as the
		// lowercase forms. Missing them here means "not gated" => served publicly.
		expect(isGatedPath("/uploads/Contracts/a.pdf")).toBe(true);
		expect(isGatedPath("/UPLOADS/contracts/a.pdf")).toBe(true);
		expect(isGatedPath("CONTRACTS/b.pdf")).toBe(true);
		expect(isGatedPath("/uploads/Chat/c.png")).toBe(true);
		// ...but the uploads root strip stays boundary-anchored.
		expect(isGatedPath("uploadsx/contracts/a.pdf")).toBe(false);
		expect(isGatedPath("/uploadsx/contracts/a.pdf")).toBe(false);
	});

	test("resolves paths inside the uploads root", () => {
		const abs = resolveWithinUploads("/uploads/contracts/a.pdf");
		expect(abs).toContain("contracts");
		expect(abs.endsWith("a.pdf")).toBe(true);
	});

	test("refuses to escape the uploads root", () => {
		expect(resolveWithinUploads("/uploads/../../.env")).toBeNull();
		expect(resolveWithinUploads("../../../../etc/passwd")).toBeNull();
		expect(resolveWithinUploads("")).toBeNull();
	});

	test("refuses to resolve the uploads root itself", () => {
		// "." and its aliases all land on the root, which is a directory and must
		// never be a signable target.
		expect(resolveWithinUploads(".")).toBeNull();
		expect(resolveWithinUploads("./")).toBeNull();
		expect(resolveWithinUploads("contracts/..")).toBeNull();
		expect(resolveWithinUploads("/uploads/")).toBeNull();
		expect(() => signFileUrl({ relPath: ".", userId: "u1" })).toThrow(/outside the uploads root/);
	});

	test("signs a path into a verifiable url", () => {
		const url = signFileUrl({ relPath: "/uploads/contracts/a.pdf", userId: "u1" });
		expect(url.startsWith("/api/files/content?")).toBe(true);
		const q = new URL(url, "http://x").searchParams;
		expect(q.get("path")).toBe("/uploads/contracts/a.pdf");
		expect(q.get("uid")).toBe("u1");
		expect(Number(q.get("exp"))).toBeGreaterThan(Date.now());
	});

	test("accepts a freshly minted signature", () => {
		const url = signFileUrl({ relPath: "/uploads/contracts/a.pdf", userId: "u1" });
		const q = new URL(url, "http://x").searchParams;
		const res = verifySignedFile({
			relPath: q.get("path"),
			userId: q.get("uid"),
			exp: q.get("exp"),
			sig: q.get("sig"),
		});
		expect(res.ok).toBe(true);
		expect(res.absPath).toContain("contracts");
	});

	test("round-trips a numeric user id", () => {
		// uid arrives back from the query string as a string, so signing must
		// normalise the caller id before it is folded into the signature.
		const url = signFileUrl({ relPath: "/uploads/contracts/a.pdf", userId: 42 });
		const q = new URL(url, "http://x").searchParams;
		expect(q.get("uid")).toBe("42");
		const res = verifySignedFile({
			relPath: q.get("path"),
			userId: q.get("uid"),
			exp: q.get("exp"),
			sig: q.get("sig"),
		});
		expect(res.ok).toBe(true);
	});

	test("rejects a tampered user id", () => {
		const url = signFileUrl({ relPath: "/uploads/contracts/a.pdf", userId: "u1" });
		const q = new URL(url, "http://x").searchParams;
		const res = verifySignedFile({
			relPath: q.get("path"),
			userId: "attacker",
			exp: q.get("exp"),
			sig: q.get("sig"),
		});
		expect(res.ok).toBe(false);
		expect(res.reason).toBe("bad_signature");
	});

	test("refuses to sign without a user id", () => {
		const sign = (userId) => () => signFileUrl({ relPath: "/uploads/contracts/a.pdf", userId });
		expect(sign(undefined)).toThrow(/userId/);
		expect(sign(null)).toThrow(/userId/);
		expect(sign("")).toThrow(/userId/);
		expect(sign("   ")).toThrow(/userId/);
	});

	test("rejects a blank user id before hashing", () => {
		// The signature here is genuinely valid for "u1"; a blank id must still be
		// refused, which proves the check runs ahead of the HMAC comparison.
		const url = signFileUrl({ relPath: "/uploads/contracts/a.pdf", userId: "u1" });
		const q = new URL(url, "http://x").searchParams;
		for (const userId of [undefined, null, "", "   "]) {
			expect(
				verifySignedFile({
					relPath: q.get("path"),
					userId,
					exp: q.get("exp"),
					sig: q.get("sig"),
				}),
			).toEqual({ ok: false, reason: "bad_user" });
		}
	});

	test("rejects a swapped path", () => {
		const url = signFileUrl({ relPath: "/uploads/contracts/a.pdf", userId: "u1" });
		const q = new URL(url, "http://x").searchParams;
		const res = verifySignedFile({
			relPath: "/uploads/contracts/secret-b.pdf",
			userId: q.get("uid"),
			exp: q.get("exp"),
			sig: q.get("sig"),
		});
		expect(res.ok).toBe(false);
	});

	test("rejects an expired url", () => {
		const url = signFileUrl({ relPath: "/uploads/contracts/a.pdf", userId: "u1" });
		const q = new URL(url, "http://x").searchParams;
		const exp = Number(q.get("exp"));
		const res = withFakeNow(exp + 1, () =>
			verifySignedFile({
				relPath: q.get("path"),
				userId: q.get("uid"),
				exp: q.get("exp"),
				sig: q.get("sig"),
			}),
		);
		expect(res).toEqual({ ok: false, reason: "expired" });
	});

	test("treats the exact expiry millisecond as already expired", () => {
		const url = signFileUrl({ relPath: "/uploads/contracts/a.pdf", userId: "u1" });
		const q = new URL(url, "http://x").searchParams;
		const exp = Number(q.get("exp"));
		const res = withFakeNow(exp, () =>
			verifySignedFile({
				relPath: q.get("path"),
				userId: q.get("uid"),
				exp: q.get("exp"),
				sig: q.get("sig"),
			}),
		);
		expect(res).toEqual({ ok: false, reason: "expired" });
	});

	test("rejects a ttl outside the short-lived window", () => {
		const sign = (ttlMs) => () =>
			signFileUrl({ relPath: "/uploads/contracts/a.pdf", userId: "u1", ttlMs });
		// "short-lived" is the premise of this file; an unbounded ttl is refused
		// rather than silently honoured.
		expect(sign(Number.MAX_VALUE)).toThrow(/ttlMs/);
		expect(sign(Number.POSITIVE_INFINITY)).toThrow(/ttlMs/);
		expect(sign(Number.NaN)).toThrow(/ttlMs/);
		expect(sign(-1)).toThrow(/ttlMs/);
		expect(sign(MEDIA_TTL_MS + 1)).toThrow(/ttlMs/);
	});

	test("accepts the media ttl ceiling", () => {
		const fixed = 1_792_352_923_010;
		const url = withFakeNow(fixed, () =>
			signFileUrl({ relPath: "/uploads/contracts/a.pdf", userId: "u1", ttlMs: MEDIA_TTL_MS }),
		);
		const q = new URL(url, "http://x").searchParams;
		expect(Number(q.get("exp"))).toBe(fixed + MEDIA_TTL_MS);
	});

	test("falls back to the default ttl when none is given", () => {
		const fixed = 1_792_352_923_010;
		const url = withFakeNow(fixed, () =>
			signFileUrl({ relPath: "/uploads/contracts/a.pdf", userId: "u1", ttlMs: undefined }),
		);
		const q = new URL(url, "http://x").searchParams;
		expect(Number(q.get("exp"))).toBe(fixed + DEFAULT_TTL_MS);
	});

	test("rejects a truncated signature without throwing", () => {
		const url = signFileUrl({ relPath: "/uploads/contracts/a.pdf", userId: "u1" });
		const q = new URL(url, "http://x").searchParams;
		const res = verifySignedFile({
			relPath: q.get("path"),
			userId: q.get("uid"),
			exp: q.get("exp"),
			sig: "abc",
		});
		expect(res).toEqual({ ok: false, reason: "bad_signature" });
	});

	test("fails closed when the secret is unset", () => {
		delete process.env.UPLOADS_SIGNING_SECRET;
		expect(() => signFileUrl({ relPath: "/uploads/contracts/a.pdf", userId: "u1" })).toThrow(
			/UPLOADS_SIGNING_SECRET/,
		);
		expect(
			verifySignedFile({
				relPath: "/uploads/contracts/a.pdf",
				userId: "u1",
				exp: Date.now() + 1000,
				sig: "x",
			}),
		).toEqual({ ok: false, reason: "not_configured" });
	});

	// A one-character secret used to sign and verify just as happily as a real
	// one. It is the only thing standing between a signed url and anybody who
	// can guess the key, so it has to be refused.
	test("fails closed when the secret is shorter than the minimum length", () => {
		process.env.UPLOADS_SIGNING_SECRET = "a".repeat(MIN_SIGNING_SECRET_LENGTH - 1);
		expect(() => signFileUrl({ relPath: "/uploads/contracts/a.pdf", userId: "u1" })).toThrow(
			/at least 32 characters/,
		);
		expect(
			verifySignedFile({
				relPath: "/uploads/contracts/a.pdf",
				userId: "u1",
				exp: Date.now() + 1000,
				sig: "x",
			}),
		).toEqual({ ok: false, reason: "not_configured" });
	});

	test("signs with a secret at exactly the minimum length", () => {
		process.env.UPLOADS_SIGNING_SECRET = "b".repeat(MIN_SIGNING_SECRET_LENGTH);
		const url = signFileUrl({ relPath: "/uploads/contracts/a.pdf", userId: "u1" });
		const q = new URL(url, "http://x").searchParams;
		const res = verifySignedFile({
			relPath: q.get("path"),
			userId: q.get("uid"),
			exp: q.get("exp"),
			sig: q.get("sig"),
		});
		expect(res.ok).toBe(true);
	});

	test("honours the media ttl for large files", () => {
		expect(MEDIA_TTL_MS).toBeGreaterThan(DEFAULT_TTL_MS);
	});
});
