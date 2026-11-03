import fs from "node:fs";
import path from "node:path";
import { jest } from "@jest/globals";

const documentFindMany = jest.fn();
const messageFindMany = jest.fn();
const callSessionFindMany = jest.fn();
const callSessionFindUnique = jest.fn();
const listFriendMatchIdsForUser = jest.fn(async () => new Set());

jest.unstable_mockModule("../../server/utils/prisma.js", () => ({
	default: {
		document: { findMany: documentFindMany },
		message: { findMany: messageFindMany },
		callSession: { findMany: callSessionFindMany, findUnique: callSessionFindUnique },
	},
}));
jest.unstable_mockModule("../../server/services/messageService.js", () => ({
	listFriendMatchIdsForUser,
}));

const { authorizeFilePath, canUserAccessDocument, isAdminRole } = await import(
	"../../server/services/fileAccessService.js"
);

const ADMIN = { id: "admin1", role: "admin" };
const BUYER = { id: "buyer1", role: "buyer" };
const FACTORY = { id: "factory1", role: "factory" };
const STRANGER = { id: "nobody", role: "buyer" };
const CONTRACT_PDF = "/uploads/contracts/a.pdf";

// A chat attachment row written at upload time (privateDocumentService) carries
// the public path in file_path and the file name in entity_id. The fixtures
// below cover both shapes: the write-time one, and the older rows that only
// carry entity_id.
const chatDoc = (filename) => ({
	id: "d1",
	entity_type: "chat_attachment",
	entity_id: filename,
	file_path: `/uploads/chat/${filename}`,
	uploaded_by: "u9",
});
const chatMessage = (matchId, senderId, filename) => ({
	match_id: matchId,
	sender_id: senderId,
	attachment: { name: filename, url: `/uploads/chat/${filename}` },
});
const contractRow = (over = {}) => ({
	id: "d1",
	entity_type: "contract",
	buyer_id: "buyer1",
	factory_id: "factory1",
	uploaded_by: "u9",
	file_path: CONTRACT_PDF,
	...over,
});
// A row an attacker minted through POST /documents/url: uploaded_by is their own
// id and file_path points at someone else's bytes.
const forgedRow = (over = {}) => ({
	id: "d-forged",
	uploaded_by: "nobody",
	buyer_id: "",
	factory_id: "",
	file_path: CONTRACT_PDF,
	...over,
});
const callSession = (participantIds, filename) => ({
	participant_ids: participantIds,
	created_by: "x",
	recording_url: `/uploads/calls/${filename}`,
});

// A call recording row written at upload time carries the OWNING call id in
// entity_id and the public path in file_path.
const callDoc = (filename) => ({
	id: "d1",
	entity_type: "call_recording",
	entity_id: "call-1",
	file_path: `/uploads/calls/${filename}`,
	uploaded_by: "buyer1",
});
// A search image row: written at upload time, owned by the uploader.
const searchDoc = (filename) => ({
	id: "d1",
	entity_type: "search_image",
	entity_id: filename,
	file_path: `/uploads/search/${filename}`,
	uploaded_by: "buyer1",
});
// A support case attachment row: written at upload time, anchored on the
// CASE id (entity_id) and owned by whoever attached it.
const supportDoc = (over = {}) => ({
	id: "d1",
	entity_type: "support_case",
	entity_id: "case-1",
	file_path: "/uploads/support/1700000000000-shot.png",
	uploaded_by: "buyer1",
	...over,
});

beforeEach(() => {
	documentFindMany.mockReset();
	messageFindMany.mockReset();
	callSessionFindMany.mockReset();
	callSessionFindUnique.mockReset();
	// The old recording_url implementation read this; an empty list makes a
	// regression fail on the assertion instead of on a TypeError.
	callSessionFindMany.mockResolvedValue([]);
	listFriendMatchIdsForUser.mockReset();
	listFriendMatchIdsForUser.mockResolvedValue([]);
});

describe("file access authorization (server/services/fileAccessService.js)", () => {
	test("recognises admin roles", () => {
		expect(isAdminRole(ADMIN)).toBe(true);
		expect(isAdminRole({ id: "x", role: "owner" })).toBe(true);
		expect(isAdminRole(BUYER)).toBe(false);
		expect(isAdminRole(null)).toBe(false);
	});

	test("allows the contract buyer", async () => {
		expect(await canUserAccessDocument(BUYER, contractRow())).toBe(true);
	});

	test("allows the contract factory", async () => {
		expect(await canUserAccessDocument(FACTORY, contractRow())).toBe(true);
	});

	test("allows an owner or admin over any document", async () => {
		expect(await canUserAccessDocument(ADMIN, { id: "d1", entity_type: "contract" })).toBe(true);
	});

	test("denies an unrelated user the contract", async () => {
		expect(await canUserAccessDocument(STRANGER, contractRow())).toBe(false);
	});

	test("denies a system-owned orphan contract to everyone but an admin", async () => {
		const doc = { id: "d1", entity_type: "contract", uploaded_by: "system" };
		expect(await canUserAccessDocument(BUYER, doc)).toBe(false);
		expect(await canUserAccessDocument(ADMIN, doc)).toBe(true);
	});

	test("allows a chat sender", async () => {
		messageFindMany.mockResolvedValue([chatMessage("friend:aaa:bbb", "buyer1", "secret.png")]);
		listFriendMatchIdsForUser.mockResolvedValue(["friend:aaa:bbb"]);
		expect(await canUserAccessDocument(BUYER, chatDoc("secret.png"))).toBe(true);
	});

	test("allows a chat participant who is not the sender", async () => {
		messageFindMany.mockResolvedValue([chatMessage("friend:aaa:bbb", "factory1", "secret.png")]);
		listFriendMatchIdsForUser.mockResolvedValue(["friend:aaa:bbb"]);
		expect(await canUserAccessDocument(BUYER, chatDoc("secret.png"))).toBe(true);
	});

	// listFriendMatchIdsForUser returns an array at runtime, not the Set the
	// original brief assumed; .has() on it would 500 every chat request.
	test("accepts a friend-match id list returned as a Set", async () => {
		messageFindMany.mockResolvedValue([chatMessage("friend:aaa:bbb", "factory1", "secret.png")]);
		listFriendMatchIdsForUser.mockResolvedValue(new Set(["friend:aaa:bbb"]));
		expect(await canUserAccessDocument(BUYER, chatDoc("secret.png"))).toBe(true);
	});

	test("denies a third party to a chat attachment", async () => {
		messageFindMany.mockResolvedValue([chatMessage("friend:aaa:bbb", "factory1", "secret.png")]);
		listFriendMatchIdsForUser.mockResolvedValue(["friend:zzz:yyy"]);
		expect(await canUserAccessDocument(STRANGER, chatDoc("secret.png"))).toBe(false);
	});

	test("denies a chat attachment when no message claims the file", async () => {
		messageFindMany.mockResolvedValue([]);
		expect(await canUserAccessDocument(BUYER, chatDoc("secret.png"))).toBe(false);
	});

	// The thread the caller genuinely belongs to carries a *different* file; the
	// requested one exists only in a thread they are not part of. Membership must
	// not carry the grant across threads. `mine` is an array, as the real
	// service returns, not the Set the original brief assumed.
	test("denies a member of thread X a file that only exists in thread Y", async () => {
		messageFindMany.mockResolvedValue([
			chatMessage("friend:aaa:bbb", "factory1", "mine.png"),
			chatMessage("friend:zzz:yyy", "factory1", "secret.png"),
		]);
		listFriendMatchIdsForUser.mockResolvedValue(["friend:aaa:bbb"]);
		expect(await canUserAccessDocument(BUYER, chatDoc("secret.png"))).toBe(false);
	});

	test("denies a chat attachment with no resolvable filename", async () => {
		messageFindMany.mockResolvedValue([chatMessage("friend:aaa:bbb", "buyer1", "secret.png")]);
		listFriendMatchIdsForUser.mockResolvedValue(["friend:aaa:bbb"]);
		expect(await canUserAccessDocument(BUYER, { id: "d1", entity_type: "chat_attachment" })).toBe(
			false,
		);
	});

	// Unbounded per-request scans of `messages` are a DoS lever, so the caller's
	// own threads must be part of the SQL predicate, not a JS filter applied to
	// every attachment-bearing row.
	test("constrains the chat message query to the caller's own threads", async () => {
		messageFindMany.mockResolvedValue([chatMessage("friend:aaa:bbb", "factory1", "secret.png")]);
		listFriendMatchIdsForUser.mockResolvedValue(["friend:aaa:bbb"]);
		await canUserAccessDocument(BUYER, chatDoc("secret.png"));
		expect(messageFindMany).toHaveBeenCalledTimes(1);
		expect(messageFindMany.mock.calls[0][0].where.OR).toEqual([
			{ sender_id: "buyer1" },
			{ match_id: { in: ["friend:aaa:bbb"] } },
		]);
	});

	// The uploader always reaches their own attachment, even when the message
	// that carried it is no longer in the table. The row is written by the
	// upload handler, so `uploaded_by` is a fact here and not a self-assertion:
	// the only other writer of that column is POST /documents/url, which is
	// restricted to owner/admin and is authorised by the admin branch anyway.
	test("allows the uploader of a chat attachment without a message", async () => {
		messageFindMany.mockResolvedValue([]);
		const doc = { ...chatDoc("mine.png"), uploaded_by: "buyer1" };
		expect(await canUserAccessDocument(BUYER, doc)).toBe(true);
		expect(messageFindMany).not.toHaveBeenCalled();
	});

	// --- call recordings ----------------------------------------------------
	//
	// The anchor is the OWNING call session, named by entity_id. recording_url
	// is caller-supplied (PATCH /api/calls/:callId/recording stores any string
	// the caller sends) and markRecording only asks whether the caller is a
	// participant of their own session, so a url can never be the anchor.
	test("allows a call recording participant", async () => {
		callSessionFindUnique.mockResolvedValue(callSession(["buyer1"], "rec-1.webm"));
		expect(await canUserAccessDocument(BUYER, callDoc("rec-1.webm"))).toBe(true);
	});

	test("denies a call recording from a session the user is not part of", async () => {
		callSessionFindUnique.mockResolvedValue(callSession(["someone-else"], "rec-1.webm"));
		expect(await canUserAccessDocument(BUYER, callDoc("rec-1.webm"))).toBe(false);
	});

	// The C3 exploit. The attacker is a participant of their own session and
	// points that session's recording_url at the victim's recording. Under the
	// recording_url implementation they are then "a participant of a session
	// whose recording is that file", and the victim's recording opens. The row
	// names the OWNING session and the attacker is not on it.
	test("denies a recording to a caller who only pointed their own session at it", async () => {
		// The attacker's own session, carrying the victim's file name.
		callSessionFindMany.mockResolvedValue([
			{
				participant_ids: ["attacker"],
				created_by: "attacker",
				recording_url: "/uploads/calls/victim.webm",
			},
		]);
		// The session that actually owns the file.
		callSessionFindUnique.mockResolvedValue({
			participant_ids: ["victim"],
			created_by: "victim",
			recording_url: "/uploads/calls/victim.webm",
		});
		const doc = {
			id: "d1",
			entity_type: "call_recording",
			entity_id: "victim-call",
			file_path: "/uploads/calls/victim.webm",
			uploaded_by: "victim",
		};
		expect(await canUserAccessDocument({ id: "attacker", role: "buyer" }, doc)).toBe(false);
	});

	// A row with no owning call id anchors nothing. The uploads backfill used to
	// write entity_id as the file name, and a file name is not a call.
	test("denies a call recording row that names no call session", async () => {
		const doc = {
			id: "d1",
			entity_type: "call_recording",
			entity_id: "rec-1.webm",
			file_path: "/uploads/calls/rec-1.webm",
			uploaded_by: "system",
		};
		expect(await canUserAccessDocument(BUYER, doc)).toBe(false);
	});

	// The anchor is the owning session, so the lookup is a primary-key read and
	// not a scan of every session whose recording_url mentions the file.
	test("resolves the owning call session by id, not by recording_url", async () => {
		callSessionFindUnique.mockResolvedValue(callSession(["buyer1"], "rec-1.webm"));
		await canUserAccessDocument(BUYER, callDoc("rec-1.webm"));
		expect(callSessionFindUnique).toHaveBeenCalledTimes(1);
		expect(callSessionFindUnique.mock.calls[0][0].where).toEqual({ id: "call-1" });
		expect(callSessionFindMany).not.toHaveBeenCalled();
	});

	// --- search images ------------------------------------------------------
	//
	// /uploads/search is a gated prefix, so a search image needs a row of its
	// own. The "uploads" entity type the scanner used to write lands in the
	// default branch, which denies every non-admin.
	test("allows the uploader of a search image", async () => {
		expect(await canUserAccessDocument(BUYER, searchDoc("q.png"))).toBe(true);
	});

	test("denies a search image to anyone but the uploader", async () => {
		expect(await canUserAccessDocument(STRANGER, searchDoc("q.png"))).toBe(false);
	});

	// The type may only authorise the prefix it was minted for.
	test("denies a search image row that points outside the search folder", async () => {
		const doc = { ...searchDoc("victim.png"), file_path: "/uploads/chat/victim.png" };
		expect(await canUserAccessDocument(BUYER, doc)).toBe(false);
	});

	// The scanner's "uploads" type is still a hard deny for a non-admin: it
	// carries no ownership fact, so nothing grants on it.
	test("denies the scanner's uploads entity type to a non-admin", async () => {
		const doc = {
			id: "d1",
			entity_type: "uploads",
			entity_id: "q.png",
			file_path: "/uploads/search/q.png",
			uploaded_by: "buyer1",
		};
		expect(await canUserAccessDocument(BUYER, doc)).toBe(false);
	});

	// --- support evidence ---------------------------------------------------
	//
	// A support case's evidence is the client's own material, in the gated
	// /uploads/support namespace. It is anchored on the CASE id and owned by
	// whoever attached it; the staff who answer the case are owner/admin.
	test("allows the uploader of a support attachment", async () => {
		expect(await canUserAccessDocument(BUYER, supportDoc())).toBe(true);
	});

	test("denies a support attachment to anyone but the uploader", async () => {
		expect(await canUserAccessDocument(STRANGER, supportDoc())).toBe(false);
	});

	test("allows an owner over a support attachment", async () => {
		expect(await canUserAccessDocument(ADMIN, supportDoc())).toBe(true);
		expect(await canUserAccessDocument({ id: "o1", role: "owner" }, supportDoc())).toBe(true);
	});

	// A "system" row — the one the uploads registry writes for a file it
	// adopts from disk — carries no ownership fact, so it authorises an
	// admin and nobody else. Exactly like the other private namespaces.
	test("denies a system-owned support attachment to everyone but an admin", async () => {
		const doc = supportDoc({ uploaded_by: "system" });
		expect(await canUserAccessDocument(BUYER, doc)).toBe(false);
		expect(await canUserAccessDocument(ADMIN, doc)).toBe(true);
	});

	// The type may only ever authorise the prefix it was minted for, exactly
	// like the search image's branch. Without the check a `support_case` row
	// could be pointed at another namespace's bytes - a chat attachment, a
	// contract PDF - and the uploader grant would hand out a file the support
	// namespace never had any claim to.
	test("denies a support attachment whose bytes are not under /uploads/support", async () => {
		const doc = supportDoc({ file_path: "/uploads/chat/1700000000000-shot.png" });
		expect(await canUserAccessDocument(BUYER, doc)).toBe(false);
		// An admin is authorised by the admin branch, not by this one.
		expect(await canUserAccessDocument(ADMIN, doc)).toBe(true);
	});

	// The legacy rows still name the uploads ROOT. They are denied until the
	// migration moves the bytes under /uploads/support/ - the fail-closed
	// direction, and the reason the rollout note puts the deploy before the
	// migration script.
	test("denies a legacy support row whose bytes are still in the uploads root", async () => {
		const doc = supportDoc({ file_path: "/uploads/1700000000000-shot.png" });
		expect(await canUserAccessDocument(BUYER, doc)).toBe(false);
	});

	test("denies an unknown entity type to a non-admin", async () => {
		const doc = { id: "d1", entity_type: "mystery", uploaded_by: "someone-else" };
		expect(await canUserAccessDocument(BUYER, doc)).toBe(false);
	});

	// `uploaded_by` is self-asserted by anyone who can reach POST /documents/url,
	// so it is not evidence that this caller owns these bytes. Every gated prefix
	// has its own branch above; an unrecognised type has no basis to grant.
	test("denies an unknown entity type to its own claimed uploader", async () => {
		const doc = { id: "d1", entity_type: "mystery", uploaded_by: "buyer1" };
		expect(await canUserAccessDocument(BUYER, doc)).toBe(false);
	});

	// createDraftContract skips the rating check when either party is blank
	// (documentService.js:621) and persists "" for both (documentService.js:640),
	// so a blank-party contract is real. Its creator must still reach its PDF.
	test("allows a blank-party contract to the manager who created it", async () => {
		const doc = forgedRow({
			entity_type: "contract",
			uploaded_by: "buyer1",
			contract_number: "CN-7",
		});
		expect(await canUserAccessDocument(BUYER, doc)).toBe(true);
	});

	// The laundering path. A row forged through /url before that route was
	// role-restricted has uploaded_by = the attacker, blank parties and a null
	// contract_number. PATCH /contracts/:id/artifact and /signatures are guarded
	// only by canModifyContract, which trusts uploaded_by, and both write an
	// artifact — so if provenance trusted `artifact`, the attacker could mint
	// that marker after the fact and grant themselves the victim's PDF.
	test("denies a forged contract row laundered with an artifact", async () => {
		const doc = forgedRow({
			entity_type: "contract",
			contract_number: null,
			artifact: { pdf_path: CONTRACT_PDF, status: "generated", version: 1 },
		});
		expect(await canUserAccessDocument(STRANGER, doc)).toBe(false);
	});

	// A forged /url row carries a real attacker id in uploaded_by but no
	// contract_number, because registerExternalDocument never writes one and
	// registerDocumentUrl cannot inject it. It must stay denied.
	test("denies a party-less contract row to its claimed uploader", async () => {
		const doc = forgedRow({ entity_type: "contract", uploaded_by: "buyer1" });
		expect(await canUserAccessDocument(BUYER, doc)).toBe(false);
	});

	// A blank-party contract belongs to its creator and nobody else.
	test("denies a blank-party contract to an unrelated user", async () => {
		const doc = forgedRow({
			entity_type: "contract",
			uploaded_by: "buyer1",
			contract_number: "CN-7",
		});
		expect(await canUserAccessDocument(STRANGER, doc)).toBe(false);
	});

	// The uploaded_by fallback is scoped to entity_type "contract". It must not
	// leak into the default branch, which stays a hard deny.
	test("denies an unknown entity type even when it carries a contract number", async () => {
		const doc = {
			id: "d1",
			entity_type: "mystery",
			uploaded_by: "buyer1",
			contract_number: "CN-7",
		};
		expect(await canUserAccessDocument(BUYER, doc)).toBe(false);
	});

	test("refuses to sign a public path", async () => {
		expect(await authorizeFilePath(BUYER, "/uploads/feed/x.png")).toEqual({
			ok: false,
			reason: "not_gated",
		});
	});

	test("reports a path that escapes the uploads root", async () => {
		const res = await authorizeFilePath(BUYER, "/uploads/contracts/../../etc/passwd");
		expect(res).toEqual({ ok: false, reason: "outside_root" });
	});

	test("reports a missing document", async () => {
		documentFindMany.mockResolvedValue([]);
		const res = await authorizeFilePath(BUYER, "/uploads/contracts/missing.pdf");
		expect(res).toEqual({ ok: false, reason: "not_found" });
	});

	// The SQL arms are case-sensitive, so the JS re-check has to be too — the
	// two have to agree, or one of them is dead code. A case-insensitive SQL
	// match would let a row for "/uploads/chat/SECRET.png" authorize a request
	// for "/uploads/chat/secret.png": a DIFFERENT file on the case-sensitive
	// filesystem the server runs on, and the route serves the requested path.
	test("a row that differs only in case does not anchor the request", async () => {
		documentFindMany.mockResolvedValue([
			contractRow({ id: "d3", file_path: "/uploads/contracts/A.pdf" }),
		]);
		const res = await authorizeFilePath(BUYER, "/uploads/contracts/a.pdf");
		expect(res).toEqual({ ok: false, reason: "not_found" });
	});

	test("the exact stored spelling resolves", async () => {
		documentFindMany.mockResolvedValue([contractRow()]);
		const res = await authorizeFilePath(BUYER, "/uploads/contracts/a.pdf");
		expect(res.ok).toBe(true);
	});

	test("reports forbidden when the caller owns no part of the document", async () => {
		documentFindMany.mockResolvedValue([contractRow()]);
		const res = await authorizeFilePath(STRANGER, CONTRACT_PDF);
		expect(res).toEqual({ ok: false, reason: "forbidden" });
	});

	test("authorizes an owned contract end to end", async () => {
		documentFindMany.mockResolvedValue([contractRow()]);
		const res = await authorizeFilePath(BUYER, CONTRACT_PDF);
		expect(res.ok).toBe(true);
		expect(res.doc.id).toBe("d1");
	});

	// The primary use case: a contract PDF lives in artifact.pdf_path and never
	// in Document.file_path, so a file_path-only lookup denies the real buyer.
	test("authorizes a contract resolved through artifact.pdf_path", async () => {
		const pdfPath = "/uploads/contracts/CN-1-v1.pdf";
		documentFindMany.mockResolvedValue([
			contractRow({ id: "d3", file_path: null, artifact: { pdf_path: pdfPath } }),
		]);
		const res = await authorizeFilePath(BUYER, pdfPath);
		expect(res.ok).toBe(true);
		expect(res.doc.id).toBe("d3");
	});

	// The contract arm must be an equality Postgres can evaluate. Reading every
	// contract row plus its JSON blob on each request is the same whole-table
	// DoS lever the chat query had.
	test("narrows the contract lookup to artifact.pdf_path in SQL", async () => {
		documentFindMany.mockResolvedValue([]);
		await authorizeFilePath(BUYER, CONTRACT_PDF);
		expect(documentFindMany).toHaveBeenCalledTimes(1);
		const or = documentFindMany.mock.calls[0][0].where.OR;
		expect(or).toEqual([
			{ file_path: { contains: "a.pdf" } },
			{ artifact: { path: ["pdf_path"], equals: CONTRACT_PDF } },
		]);
		expect(JSON.stringify(or)).not.toContain("entity_type");
	});

	// The lookup key must come from the resolved absolute path, so a request that
	// differs from the stored string only in path shape still resolves.
	test("resolves the lookup key from the resolved path, not the raw request", async () => {
		documentFindMany.mockResolvedValue([contractRow()]);
		const res = await authorizeFilePath(BUYER, "/uploads/contracts/./a.pdf");
		expect(res.ok).toBe(true);
		expect(res.doc.id).toBe("d1");
	});

	// The forged-row attack: the attacker registers a Document pointing at a
	// victim's gated file, then requests it.
	test("denies a forged document row the attacker registered for a gated file", async () => {
		documentFindMany.mockResolvedValue([
			forgedRow({ entity_type: "mystery", file_path: "/uploads/chat/victim.png" }),
		]);
		const res = await authorizeFilePath(STRANGER, "/uploads/chat/victim.png");
		expect(res).toEqual({ ok: false, reason: "forbidden" });
	});

	test("denies a forged contract row the attacker registered for a gated file", async () => {
		documentFindMany.mockResolvedValue([forgedRow({ entity_type: "contract" })]);
		const res = await authorizeFilePath(STRANGER, CONTRACT_PDF);
		expect(res).toEqual({ ok: false, reason: "forbidden" });
	});

	// A legitimate contract keeps working even when a forged row shares its path:
	// any-grant is load-bearing now that contract PDFs legitimately have a system
	// backfill row alongside the real contract row.
	test("still authorizes the true owner when a forged row shares the path", async () => {
		documentFindMany.mockResolvedValue([forgedRow({ entity_type: "mystery" }), contractRow()]);
		const res = await authorizeFilePath(BUYER, CONTRACT_PDF);
		expect(res.ok).toBe(true);
		expect(res.doc.id).toBe("d1");
	});

	// --- the write-time registry -------------------------------------------
	//
	// A chat attachment is only reachable because the upload handler wrote a
	// Document row for it. Without that row, authorizeFilePath answers
	// "not_found" and the attachment is unreadable by everyone — the uploader
	// included — which is what the AI-moderation backfill left behind in the
	// deployed configuration.
	test("authorizes a chat attachment through its write-time row", async () => {
		documentFindMany.mockResolvedValue([chatDoc("secret.png")]);
		messageFindMany.mockResolvedValue([chatMessage("friend:aaa:bbb", "buyer1", "secret.png")]);
		listFriendMatchIdsForUser.mockResolvedValue(["friend:aaa:bbb"]);
		const res = await authorizeFilePath(BUYER, "/uploads/chat/secret.png");
		expect(res.ok).toBe(true);
		expect(res.doc.id).toBe("d1");
	});

	test("authorizes a search image through its write-time row", async () => {
		documentFindMany.mockResolvedValue([searchDoc("q.png")]);
		const res = await authorizeFilePath(BUYER, "/uploads/search/q.png");
		expect(res.ok).toBe(true);
	});

	// --- the /sign amplification lever -------------------------------------
	//
	// listFriendMatchIdsForUser scans every friend message on the platform. It
	// is user-scoped and constant within a request, so a /sign call with many
	// chat paths must fetch it once, not once per path.
	test("fetches the friend match ids once per request, not once per document", async () => {
		documentFindMany.mockResolvedValue([chatDoc("a.png"), chatDoc("b.png"), chatDoc("c.png")]);
		messageFindMany.mockResolvedValue([]);
		listFriendMatchIdsForUser.mockResolvedValue(["friend:aaa:bbb"]);
		await authorizeFilePath(BUYER, "/uploads/chat/a.png");
		expect(listFriendMatchIdsForUser).toHaveBeenCalledTimes(1);
	});

	// The `IN` list is built from the caller's own threads, but it still has to
	// be bounded: every entry is a value Postgres has to parse and plan for.
	test("caps the friend match id list used in the IN clause", async () => {
		const many = Array.from({ length: 1500 }, (_value, index) => `friend:${index}:x`);
		documentFindMany.mockResolvedValue([chatDoc("a.png")]);
		messageFindMany.mockResolvedValue([]);
		listFriendMatchIdsForUser.mockResolvedValue(many);
		await canUserAccessDocument(BUYER, chatDoc("a.png"));
		const inList = messageFindMany.mock.calls[0][0].where.OR[1].match_id.in;
		expect(inList.length).toBeLessThanOrEqual(1000);
		expect(inList.length).toBeGreaterThan(0);
	});
});

describe("external document registration route (server/routes/documentRoutes.js)", () => {
	// Read as source rather than imported: the route graph pulls in the whole
	// controller chain and a Prisma client, which this unit suite must not load.
	const source = fs.readFileSync(
		path.join(process.cwd(), "server", "routes", "documentRoutes.js"),
		"utf8",
	);

	test("POST /url requires a privileged role", () => {
		const line = source.split("\n").find((l) => l.includes('router.post("/url"'));
		expect(line).toBeDefined();
		expect(line).toMatch(/allowRoles\(\s*"(owner|admin)"/);
	});

	// The role restriction is an API change, so it has to be written down
	// somewhere a reader will find it - and it has to STAY written down. A
	// revert of the docs alone would be as invisible as a revert of the code.
	test("the role restriction is recorded in the spec, the plan and AGENTS.md", () => {
		const documents = {
			"design spec": fs.readFileSync(
				path.join(
					process.cwd(),
					"docs",
					"superpowers",
					"specs",
					"2026-10-18-upload-access-control-design.md",
				),
				"utf8",
			),
			plan: fs.readFileSync(
				path.join(process.cwd(), "docs", "plans", "2026-10-18-upload-access-control.md"),
				"utf8",
			),
			"AGENTS.md": fs.readFileSync(path.join(process.cwd(), "AGENTS.md"), "utf8"),
		};
		for (const [name, text] of Object.entries(documents)) {
			expect({
				name,
				mentions: /documents\/url/.test(text) && /allowRoles/.test(text),
			}).toEqual({ name, mentions: true });
		}
	});
});
