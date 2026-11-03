import fs from "node:fs/promises";
import path from "node:path";
import { GATED_PREFIXES } from "./signedFileUrl.js";

const GATED = new Set(GATED_PREFIXES);

const PARENT_SEGMENT = `..${path.sep}`;

// One definition of "gated", used for both the textual and the resolved check,
// so the two cannot drift into disagreeing — which is the entire defect class
// this file exists to close.
function isGatedRelative(relPath) {
	return GATED.has(relPath.split(path.sep)[0].toLowerCase());
}

function escapesRoot(relPath) {
	return relPath === ".." || relPath.startsWith(PARENT_SEGMENT);
}

/**
 * Mount in front of `express.static(uploadsRoot)` so the private namespaces
 * (chat, contracts, calls, search) are unreachable over plain HTTP.
 *
 * The classification has to be performed in the *same* order the downstream
 * static handler performs it in, or the thing that decides to deny and the
 * thing that opens the file disagree. serve-static hands its raw, still
 * percent-encoded pathname to send@1.x, which percent-decodes it and then
 * textually normalizes it *before* touching the filesystem. `req.path` at a
 * mounted middleware is likewise undecoded, so classifying it as-is — the
 * obvious reading — leaves the two sides out of step and lets
 * `/uploads/%63ontracts/x.pdf`, `/uploads/./contracts/x.pdf` and
 * `/uploads/feed/../contracts/x.pdf` walk straight past the guard.
 *
 * Textual resolution is not sufficient on its own either. NTFS mints 8.3
 * short names for entries longer than eight characters, so `contracts` is also
 * reachable as `CONTRA~1` — a different, non-gated string the filesystem happily
 * resolves back to the gated directory. `contracts` is the only gated prefix
 * long enough to get an alias (chat, calls and search are not), but that is a
 * property of this list today rather than a guarantee. So a request that clears
 * the textual check is re-classified against its resolved path before it is
 * allowed through.
 *
 * Two properties that re-check must not break, and are covered by tests:
 *   - A public file must still serve. The resolved-path check costs one
 *     additional syscall per request that reaches next(); express.static does its
 *     own stat immediately afterwards, so this roughly doubles rather than
 *     multiplies the filesystem work on the public path.
 *   - `fs.realpath` throws for anything that is not there. When it does, the
 *     guard steps aside and lets static answer, because static is the thing that
 *     knows whether a missing file is missing and that a directory wants a
 *     trailing-slash redirect. A guard that 404'd there would be inventing
 *     answers of its own.
 *
 * Backslashes are folded to `/` before normalizing. On Windows that is exactly
 * what the filesystem would do anyway; on POSIX a backslash is a legal
 * filename character, so this is a *stricter* reading than send would take
 * (it would look for a single file named `contracts\x.pdf`). Erring toward a
 * 404 is the correct direction for this control.
 */
export function createGatedStaticGuard({ root }) {
	const uploadsRoot = path.resolve(root);

	// Resolved once and reused. The requested path and the resolved path have to
	// be compared in the same coordinate system — on a host where the uploads
	// root sits under a symlink or junction the two differ — and resolving the
	// root per request would double the syscalls. A failed resolution is not
	// cached, so a root that appears later is still picked up.
	let realRootPromise;
	function realRoot() {
		realRootPromise ??= fs.realpath(uploadsRoot);
		return realRootPromise.catch(() => {
			realRootPromise = undefined;
			return uploadsRoot;
		});
	}

	/**
	 * True only when the request must be refused. Any error resolving the path
	 * resolves to false — the caller then hands the request on, leaving the
	 * decision to express.static.
	 */
	async function resolvedTargetIsPrivate(target) {
		let rootReal;
		let targetReal;
		try {
			rootReal = await realRoot();
			targetReal = await fs.realpath(target);
		} catch {
			// Does not exist, or is not reachable: not the guard's call to make.
			return false;
		}
		const rel = path.relative(rootReal, targetReal);
		// The uploads root itself.
		if (rel === "") return false;
		if (escapesRoot(rel)) {
			// A link inside the uploads tree pointing out of it. send's containment
			// check is lexical on the requested path, so it would not catch this
			// and the bytes would be served from wherever the link points. The real
			// uploads tree currently holds no symlinks at all, so this refuses
			// nothing that exists today.
			return true;
		}
		return isGatedRelative(rel);
	}

	return function gatedStaticGuard(req, res, next) {
		let decoded;
		try {
			decoded = decodeURIComponent(req.path);
		} catch {
			return res.status(404).json({ error: "Not found" });
		}
		// A NUL cannot appear in a name send would serve; refuse rather than let
		// the two sides disagree about it.
		if (decoded.includes("\0")) {
			return res.status(404).json({ error: "Not found" });
		}

		// Textual normalization first — collapse separators, resolve "." and "..",
		// drop the leading slash — then join with the platform separator. Doing it
		// in that order means "." and "%2e" are indistinguishable by the time the
		// classification runs, which is the whole point.
		const trimmed = decoded.replace(/\\/g, "/").replace(/\/+/g, "/").replace(/^\/+/, "");
		const target = path.resolve(uploadsRoot, path.posix.normalize(trimmed));

		const rel = path.relative(uploadsRoot, target);
		if (rel === "") {
			// The uploads root itself. Not gated, and not ours to change here —
			// hand it to the static handler's existing behaviour.
			return next();
		}
		if (escapesRoot(rel)) {
			return res.status(404).json({ error: "Not found" });
		}
		// Lower-cased: the filesystem is case-insensitive, so "/uploads/Contracts"
		// names the same file as "/uploads/contracts", and missing that variant
		// would mean "public".
		if (isGatedRelative(rel)) {
			return res.status(404).json({ error: "Not found" });
		}

		// Cleared the textual check, so it may still be private once the filesystem
		// has had its say (8.3 aliases). Deliberately async and deliberately
		// fs.promises: on Windows only the promise form resolves a short name back
		// to its long one — realpathSync returns "CONTRA~1" unchanged, which would
		// leave this re-check silently inert while still looking correct.
		resolvedTargetIsPrivate(target).then(
			(isPrivate) => {
				if (isPrivate) {
					res.status(404).json({ error: "Not found" });
					return;
				}
				next();
			},
			() => next(),
		);
	};
}

export default createGatedStaticGuard;
