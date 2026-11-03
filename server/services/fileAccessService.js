import path from "node:path";
import { logWarn } from "../utils/logger.js";
import { canAccessContract, isOwnerOrAdmin } from "../utils/permissions.js";
import prisma from "../utils/prisma.js";
import { isGatedPath, resolveWithinUploads, toPublicPath } from "../utils/signedFileUrl.js";
import { listFriendMatchIdsForUser } from "./messageService.js";

// Strips "?v=2" style suffixes before the filename tail is compared.
const URL_QUERY_SPLIT = /[?#]/;

// The `IN` list of friend match ids is built from the caller's own threads, so
// it is bounded by how many conversations the caller has — but "unbounded" is
// still a lever that scales with the platform, and every entry is a value
// Postgres has to parse and plan for. Capped: a caller past the cap keeps
// access to their own uploads (the uploader grant below) and to the first
// MAX_FRIEND_MATCH_IDS threads, and the truncation is logged, not silent.
const MAX_FRIEND_MATCH_IDS = 1000;

function text(value) {
	return String(value ?? "").trim();
}

function idList(value) {
	if (Array.isArray(value)) return value.map(String);
	if (typeof value === "string") return [value];
	return [];
}

// The file name a document row points at.
//
// The write-time rows (privateDocumentService) store the public path in
// file_path and the file name in entity_id, so both carry the same tail. The
// stored path is preferred: it is the thing authorizeFilePath already matched
// the request against, so it cannot name a different file than the one being
// served. entity_id is the fallback for rows that predate the write-time
// registry.
function docFilename(doc) {
	const fromPath = text(doc?.file_path).split("/").pop() || "";
	if (fromPath) {
		return fromPath.toLowerCase();
	}
	const fromEntity = text(doc?.entity_id).split("/").pop() || "";
	return fromEntity ? fromEntity.toLowerCase() : "";
}

// Attachment is a Json column. messageService posts {name, url, mime_type,
// size}; older rows may hold a bare string or an array of either. Compare the
// lower-cased tail so "/uploads/chat/a.png" and "a.png" name the same file on
// a case-insensitive filesystem.
function attachmentFilenames(attachment) {
	const raw = Array.isArray(attachment) ? attachment : [attachment];
	const names = [];
	for (const entry of raw) {
		const source = typeof entry === "string" ? entry : entry?.url || entry?.path || entry?.name;
		const tail = text(source).split(URL_QUERY_SPLIT)[0].split("/").pop() || "";
		if (tail) {
			names.push(tail.toLowerCase());
		}
	}
	return names;
}

function matchesId(value, userId) {
	const left = text(value);
	const right = text(userId);
	return left !== "" && left === right;
}

// listFriendMatchIdsForUser hands back an array today, but callers may pass a
// Set. Normalising either way keeps the .has() lookup below total; getting this
// wrong throws a TypeError and turns every chat authorization into a 500.
function toIdSet(value) {
	if (Array.isArray(value)) return new Set(value.map(String));
	if (value instanceof Set) return new Set(Array.from(value, String));
	return new Set();
}

// A real contract names its two parties. A Document row whose only claim is a
// self-asserted `uploaded_by` cannot be one, and must not inherit
// canAccessContract's trust in that field — see the note in authorizeFilePath
// for how that field can be forged.
function hasPartyClaim(doc) {
	return text(doc?.buyer_id) !== "" || text(doc?.factory_id) !== "";
}

// The discriminator between a row the contract flow minted and a row an attacker
// minted through POST /documents/url.
//
// createDraftContract assigns `payload.contract_number || "CN-${Date.now()}"`
// (documentService.js:636), so the contract flow guarantees a non-empty value
// from a server-generated default rather than from caller input.
// registerExternalDocument never writes the field, registerDocumentUrl only
// forwards entity_type / entity_id / url / type, so no caller can inject it, and
// no update path writes it afterwards — the admin contract patch only touches
// is_draft. That makes it stable provenance that a pre-existing forged row cannot
// retroactively acquire.
//
// Rejected alternatives, for the record:
//   title       — also always non-empty, but it is free-form caller text and is
//                 editable later, so it is a weaker identity signal.
//   is_draft    — mutated by the signature and artifact patches and by the admin
//                 contract update; a status flag, not an identity marker.
//   lifecycle_status — derived rather than always stored (listContracts computes
//                 it on read at documentService.js:728), so it can be null.
//
// artifact was briefly a second marker here, on the grounds that
// registerExternalDocument never writes it. That was wrong: it is caller-reachable
// after the fact. PATCH /contracts/:id/artifact and PATCH /contracts/:id/signatures
// are requireAuth-only and guarded solely by canModifyContract, which trusts
// uploaded_by, and both write `artifact` — updateContractArtifact does so
// unconditionally (documentService.js:928) and updateContractSignatures even
// generates a real one on double-signature (:812). A row forged through /url before
// that route was role-restricted could therefore mint the marker after creation and
// grant itself the victim's PDF. A marker is only provenance if nothing can write
// it, and artifact can be written. contract_number can be written by nothing.
function hasContractProvenance(doc) {
	return text(doc?.contract_number) !== "";
}

// Contract PDFs are referenced through artifact.pdf_path, never through
// Document.file_path, so both have to be consulted to resolve one.
//
// The stored path is compared EXACTLY. The SQL arms are case-sensitive
// (a `contains` LIKE and an `equals`), so the JS re-check has to be too — the
// two have to agree, or one of them is dead code.
//
// The alternative, `mode: "insensitive"` on the file_path arm, was rejected on
// purpose: the row that matches is not the row that names the file that is
// served. The route serves the path the REQUEST asked for, and a row for
// "/uploads/chat/SECRET.png" would authorize a request for
// "/uploads/chat/secret.png" — a different file on a case-sensitive
// filesystem, which is what the server runs on. That is a cross-file grant,
// and it is a worse defect than the spurious 404 it fixes: the client always
// asks for the exact path the server gave it, so the case-insensitive lookup
// buys nothing in practice.
function artifactPdfPath(doc) {
	const raw = doc?.artifact?.pdf_path;
	return typeof raw === "string" ? text(raw) : "";
}

// Does this row actually anchor the requested file? file_path is caller-supplied
// through POST /documents/url, so a row that merely *claims* the path proves
// nothing — the row must be one the server itself wrote for these bytes.
//
// The comparison is case-sensitive, matching the SQL arms exactly. See
// artifactPdfPath above for why the case-insensitive alternative was rejected:
// a row that differs only in case names a DIFFERENT file on the filesystem the
// server runs on, and the route serves the requested path, not the row's.
function rowAnchorsPath(doc, key) {
	return text(doc?.file_path) === key || artifactPdfPath(doc) === key;
}

// The caller's friend match ids, fetched at most once per request.
//
// listFriendMatchIdsForUser scans every friend message on the platform, so
// calling it once per document turns a /sign call with 50 chat paths into 50
// platform-wide scans. It is user-scoped and constant within a request, so it
// is hoisted into the request context and shared.
async function friendMatchIdsFor(user, context) {
	if (!context) {
		return toIdSet(await listFriendMatchIdsForUser(user.id));
	}
	if (!context.friendMatchIds) {
		context.friendMatchIds = Promise.resolve(listFriendMatchIdsForUser(user.id)).then(toIdSet);
	}
	return context.friendMatchIds;
}

async function canAccessChatAttachment(user, doc, context) {
	const filename = docFilename(doc);
	if (!filename) return false;

	const mine = await friendMatchIdsFor(user, context);
	const all = [...mine];
	let threadIds = all;
	if (all.length > MAX_FRIEND_MATCH_IDS) {
		threadIds = all.slice(0, MAX_FRIEND_MATCH_IDS);
		logWarn("friend match id list truncated for chat authorization", {
			user_id: text(user.id),
			total: all.length,
			cap: MAX_FRIEND_MATCH_IDS,
		});
	}
	// Both filters belong in SQL. `match_id` and `sender_id` are indexed, so this
	// avoids scanning every attachment-bearing message on the platform on each
	// authorization request.
	const messages = await prisma.message.findMany({
		where: {
			attachment: { not: null },
			OR: [{ sender_id: text(user.id) }, { match_id: { in: threadIds } }],
		},
		select: { match_id: true, sender_id: true, attachment: true },
	});

	// Both axes are required: the message must reference *this* file, and it must
	// sit in a thread the caller is party to. Checking membership alone hands
	// every chat file to anyone who has ever had one conversation, including other
	// people's conversations.
	return messages.some((message) => {
		if (!attachmentFilenames(message.attachment).includes(filename)) {
			return false;
		}
		return matchesId(message.sender_id, user.id) || mine.has(String(message.match_id));
	});
}

// The call recording is authorized against the session that OWNS it.
//
// It used to be authorized against `recording_url`: the route found every
// CallSession whose recording_url mentioned the file name and asked whether
// the caller was a participant of one of those sessions. But recording_url is
// caller-supplied — PATCH /api/calls/:callId/recording is requireAuth-only
// and stores whatever string the caller sends — and markRecording only
// requires the caller to be a participant of their own session. So a caller
// could point their own session at any recording path and then be "a
// participant of a session whose recording is that file".
//
// entity_id carries the call id the recording was uploaded for (written by the
// upload handler, which has already checked participation), and that session's
// participant list is the fact the caller has to be on. A caller-writable url
// is never consulted.
async function canAccessCallRecording(user, doc) {
	const callId = text(doc?.entity_id);
	if (!callId) return false;

	const call = await prisma.callSession.findUnique({
		where: { id: callId },
		select: { participant_ids: true, created_by: true },
	});
	if (!call) return false;

	const participants = idList(call.participant_ids);
	return matchesId(call.created_by, user.id) || participants.includes(text(user.id));
}

// A search image belongs to whoever uploaded it.
//
// The upload route is authenticated (POST /api/search/image is requireAuth), so
// the uploader is a real party to the file and the row can carry it. The image
// is the requester's own query input; nobody else has a claim on it.
function canAccessSearchImage(user, doc) {
	if (!matchesId(doc?.uploaded_by, user.id)) return false;
	// The type may only ever authorise the prefix it was minted for, so a row
	// of this type cannot be pointed at another folder's bytes.
	return text(doc?.file_path).toLowerCase().startsWith("/uploads/search/");
}

// A support case's evidence belongs to whoever attached it.
//
// The same shape as the search image's branch, and for the same reason: the
// type may only ever authorise the prefix it was minted for. Without the
// prefix check a `support_case` row could be pointed at another namespace's
// bytes - a chat attachment, a contract PDF - and the uploader grant would
// then hand out a file the support namespace never had any claim to.
//
// The rows the legacy client produced (entity_type "support_ticket", the
// bytes still in the uploads root) are NOT reachable through this branch
// until the migration script has moved them under /uploads/support/. That is
// the fail-closed direction: the bytes stop being readable through the
// resolver before they stop being readable through the static mount.
function canAccessSupportEvidence(user, doc) {
	if (!matchesId(doc?.uploaded_by, user.id)) return false;
	return text(doc?.file_path).toLowerCase().startsWith("/uploads/support/");
}

export function isAdminRole(user) {
	// permissions.js already owns the owner/admin set; re-declaring it here would
	// be a second source of truth for "who is privileged".
	return isOwnerOrAdmin(user);
}

export async function canUserAccessDocument(user, doc, context) {
	if (!(user && doc)) return false;
	if (isAdminRole(user)) return true;
	if (!text(user.id)) return false;

	switch (doc.entity_type) {
		case "contract":
			// canAccessContract trusts `uploaded_by`, which any caller of
			// POST /documents/url could self-assert against an arbitrary
			// file_path. So the row must also be structurally a contract: either it
			// names a party, or it carries a contract identity and the caller is
			// its uploader. The second clause is what keeps a blank-party draft
			// reachable for the manager who created it — createDraftContract skips
			// the rating check when either party is blank and persists "" for both —
			// without re-opening the forged-row hole.
			return (
				canAccessContract(user, doc) &&
				(hasPartyClaim(doc) || (matchesId(doc.uploaded_by, user.id) && hasContractProvenance(doc)))
			);

		case "chat_attachment":
			// The uploader always reaches their own attachment. `uploaded_by` is
			// written by the upload handler (privateDocumentService) and, for the
			// rows that predate it, by the uploads backfill as "system" — only
			// POST /documents/url can assert it for itself, and that route is
			// restricted to owner/admin, who are authorised by the admin branch
			// above anyway.
			if (matchesId(doc.uploaded_by, user.id)) return true;
			return canAccessChatAttachment(user, doc, context);

		case "call_recording":
			return canAccessCallRecording(user, doc);

		case "search_image":
			return canAccessSearchImage(user, doc);

		case "support_case":
			// A support case's evidence belongs to whoever attached it, and to
			// the staff who answer the case. The uploader grant is the same
			// shape as the chat attachment's: `uploaded_by` is written by the
			// upload handler, and the only other writer of that column
			// (POST /documents/url) is restricted to owner/admin, who are
			// authorised by the admin branch above anyway.
			//
			// A case is anchored on the CASE id (entity_id), not on the file
			// name: the case is the fact the file belongs to, and the file name
			// is not.
			//
			// The branch also requires the row's own bytes to live under
			// /uploads/support/, so a row of this type cannot be pointed at
			// another namespace's bytes. The admin grant is NOT repeated here:
			// it already happened at the top of this function.
			return canAccessSupportEvidence(user, doc);

		default:
			// Unknown type. `uploaded_by` is self-asserted by anyone who can reach
			// POST /documents/url, so it is not evidence that this caller owns these
			// bytes. Every gated prefix (chat, contracts, calls, search, support)
			// is a private namespace with its own branch above, so an unrecognised
			// type has no legitimate basis to grant. Deny, and let an admin read it.
			return false;
	}
}

export async function authorizeFilePath(user, relPath) {
	if (!isGatedPath(relPath)) {
		return { ok: false, reason: "not_gated" };
	}
	const abs = resolveWithinUploads(relPath);
	if (!abs) {
		return { ok: false, reason: "outside_root" };
	}

	// Key off the resolved path rather than the raw request string: clients send
	// "/uploads/x" and "/uploads/./x" for the same bytes, and only the first form
	// is what Document.file_path and artifact.pdf_path store.
	const key = toPublicPath(abs);
	const basename = path.posix.basename(key);

	// file_path can never be trusted as an authorization anchor on its own — it is
	// caller-supplied through POST /documents/url — so candidates are collected
	// here and re-checked by rowAnchorsPath before any grant. Both arms are
	// equalities Postgres evaluates on the column: the second uses Prisma's JSON
	// path filter (already used at productController.js:814) because contract PDFs
	// live only in artifact.pdf_path. The previous `{ artifact: { not: null } }`
	// shape pulled every contract row and its JSON blob on each request, which is
	// the same whole-table lever the chat query had.
	const candidates = await prisma.document.findMany({
		where: {
			OR: [
				{ file_path: { contains: basename } },
				{ artifact: { path: ["pdf_path"], equals: key } },
			],
		},
	});
	const docs = candidates.filter((doc) => rowAnchorsPath(doc, key));

	// No Document row means the path never resolved, so it denies rather than
	// falling through to the public file handler.
	if (!docs.length) {
		return { ok: false, reason: "not_found" };
	}

	// Several rows can legitimately share one path — a real contract row plus the
	// `system` backfill row the uploads scanner writes. Any-grant is what keeps the
	// true owner working in that case, so it must not become every-grant.
	//
	// The context is shared by every row in this request: the friend-match id
	// list is user-scoped and constant within a request, so it is fetched once
	// here rather than once per document.
	const context = { friendMatchIds: null };
	const grants = await Promise.all(docs.map((doc) => canUserAccessDocument(user, doc, context)));
	const granted = grants.indexOf(true);
	if (granted === -1) {
		return { ok: false, reason: "forbidden" };
	}
	return { ok: true, doc: docs[granted] };
}
