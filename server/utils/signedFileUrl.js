import crypto from "node:crypto";
import path from "node:path";

// "support" is the fourth private namespace: a support case's evidence
// (screenshots, logs, exports) is the client's own material and is read only
// by whoever uploaded it and by an owner/admin. It is gated for the same
// reason the other three are — the file is unreachable without a signed url.
export const GATED_PREFIXES = ["chat", "contracts", "calls", "search", "support"];
export const DEFAULT_TTL_MS = 5 * 60 * 1000;
export const MEDIA_TTL_MS = 15 * 60 * 1000;

// Exported so consumers that must touch the filesystem itself — the /content
// route re-checking realpath containment, for instance — agree with the signing
// core about where the uploads root is, instead of re-deriving it and drifting.
export function uploadsRoot() {
	return path.resolve(process.cwd(), "server", "uploads");
}

// The signing key has to be long enough to be a key. A one-character secret
// signs and verifies just as happily as a real one, which is exactly why it
// must be refused: the secret is the only thing standing between a signed url
// and anybody who can guess the key.
export const MIN_SIGNING_SECRET_LENGTH = 32;

function readSecret() {
	const raw = process.env.UPLOADS_SIGNING_SECRET;
	if (!(raw && String(raw).trim())) return null;
	const secret = String(raw);
	if (secret.length < MIN_SIGNING_SECRET_LENGTH) return null;
	return secret;
}

// The user id is folded into the signature, so it has to be one stable string:
// callers hand us a number straight from the db while verification reads it back
// off the query string. Returns null when the id is absent or blank.
function normalizeUserId(userId) {
	if (userId === null || userId === undefined) return null;
	const uid = String(userId).trim();
	return uid ? uid : null;
}

export function isGatedPath(relPath) {
	// Lower-cased on purpose: the filesystem is case-insensitive, so
	// "/uploads/Contracts/a.pdf" names the same file as "/uploads/contracts/a.pdf".
	// Not matching a variant here means "not gated", i.e. served publicly, so
	// over-matching is the safe direction.
	const first = String(relPath || "")
		.toLowerCase()
		.replace(/^\/+/, "")
		.replace(/^uploads(?:\/|$)/, "")
		.split("/")[0];
	return GATED_PREFIXES.includes(first);
}

export function resolveWithinUploads(relPath) {
	const root = uploadsRoot();
	const rel = String(relPath || "")
		.replace(/^\/uploads\/?/, "")
		.replace(/^\/+/, "");
	if (!rel) return null;
	const abs = path.resolve(root, rel);
	// Strictly below the root. "." and aliases like "contracts/.." resolve back
	// onto the root itself, which is a directory and must never be signable.
	if (!abs.startsWith(root + path.sep)) return null;
	return abs;
}

// Exported so the authorization resolver can rebuild the canonical public path
// from an already-resolved absolute path. Duplicating the uploads-root
// derivation here would let the two disagree about what a path names.
export function toPublicPath(absPath) {
	const rel = path.relative(uploadsRoot(), absPath);
	return `/uploads/${rel.split(path.sep).join("/")}`;
}

function canonical(absPath, userId, exp) {
	// JSON array rather than "\n"-joining: a posix filename or an id may itself
	// contain a newline, which would let two different triples produce the same
	// signed string. This form must stay byte-identical to what verifySignedFile
	// computes.
	return JSON.stringify([absPath, userId, exp]);
}

export function signFileUrl({ relPath, userId, ttlMs = DEFAULT_TTL_MS }) {
	const secret = readSecret();
	if (!secret) {
		// Two different misconfigurations, two different messages: an unset
		// secret and a secret that is too short to be a key.
		throw new Error(
			process.env.UPLOADS_SIGNING_SECRET
				? `UPLOADS_SIGNING_SECRET must be at least ${MIN_SIGNING_SECRET_LENGTH} characters`
				: "UPLOADS_SIGNING_SECRET is not configured",
		);
	}
	const uid = normalizeUserId(userId);
	if (!uid) {
		throw new Error("userId is required to sign a file url");
	}
	// "Short-lived" is the premise of this file, so an unbounded ttl is refused
	// rather than silently honoured. MEDIA_TTL_MS is the ceiling.
	const ttl = Number(ttlMs);
	if (!Number.isFinite(ttl) || ttl < 0 || ttl > MEDIA_TTL_MS) {
		throw new Error(`ttlMs must be a finite number between 0 and ${MEDIA_TTL_MS}`);
	}
	const abs = resolveWithinUploads(relPath);
	if (!abs) {
		throw new Error("Path is outside the uploads root");
	}
	const exp = Date.now() + ttl;
	const sig = crypto
		.createHmac("sha256", secret)
		.update(canonical(abs, uid, exp))
		.digest("hex");
	const query = new URLSearchParams({
		path: toPublicPath(abs),
		exp: String(exp),
		uid,
		sig,
	});
	return `/api/files/content?${query.toString()}`;
}

export function verifySignedFile({ relPath, userId, exp, sig }) {
	const secret = readSecret();
	if (!secret) return { ok: false, reason: "not_configured" };

	// Ahead of the HMAC on purpose: an absent id means the caller is not
	// authenticated, which should fail loudly rather than as a bad signature.
	const uid = normalizeUserId(userId);
	if (!uid) return { ok: false, reason: "bad_user" };

	const abs = resolveWithinUploads(relPath);
	if (!abs) return { ok: false, reason: "outside_root" };

	const expNum = Number(exp);
	if (!Number.isFinite(expNum)) return { ok: false, reason: "bad_exp" };
	if (Date.now() >= expNum) return { ok: false, reason: "expired" };

	const expected = crypto
		.createHmac("sha256", secret)
		.update(canonical(abs, uid, expNum))
		.digest();
	const given = Buffer.from(String(sig || ""), "hex");
	if (given.length !== expected.length || !crypto.timingSafeEqual(expected, given)) {
		return { ok: false, reason: "bad_signature" };
	}
	return { ok: true, absPath: abs };
}
