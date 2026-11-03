import fs from "node:fs/promises";
import path from "node:path";
import { jest } from "@jest/globals";
import express from "express";
import request from "supertest";

// A support case's evidence is the client's own material. It used to be
// listed to anybody who learned the case id: GET /api/documents had no
// ownership check at all, so any authenticated user could enumerate another
// user's support attachments. These tests drive the REAL controller, because
// the rule has to hold at the HTTP surface — a service-level test would pass
// even if the controller forgot to pass the caller along.

const documentFindMany = jest.fn(async () => []);
const documentCreate = jest.fn(async (args) => ({ id: "doc-new", ...args.data }));

// The upload resolves `entity_id` against the case (or the legacy ticket)
// it names, and refuses anything the caller does not own. These two mocks
// are that lookup.
const supportCaseFindUnique = jest.fn(async () => null);
const supportTicketFindUnique = jest.fn(async () => null);

jest.unstable_mockModule("../../server/utils/prisma.js", () => ({
	default: {
		document: { findMany: documentFindMany, create: documentCreate },
		supportCase: { findUnique: supportCaseFindUnique },
		supportTicket: { findUnique: supportTicketFindUnique },
	},
}));

const { getDocuments, uploadDocument } = await import(
	"../../server/controllers/documentController.js"
);

const UPLOADER = { id: "client-1", role: "buyer" };
const STRANGER = { id: "client-2", role: "buyer" };
const ADMIN = { id: "admin-1", role: "admin" };
const OWNER = { id: "owner-1", role: "owner" };

// The row the write-time path (privateDocumentService.recordPrivateUpload)
// produces for a support attachment.
const supportRow = (over = {}) => ({
	id: "doc-1",
	entity_type: "support_case",
	entity_id: "case-1",
	file_path: "/uploads/support/1700000000000-shot.png",
	uploaded_by: "client-1",
	type: "screenshot",
	...over,
});

// A row the legacy feedback client produced: the same bytes, the old type.
const legacySupportRow = (over = {}) => ({
	id: "doc-2",
	entity_type: "support_ticket",
	entity_id: "ticket-1",
	file_path: "/uploads/1700000000001-shot.png",
	uploaded_by: "client-1",
	type: "screenshot",
	...over,
});

function buildApp(user) {
	const app = express();
	app.get(
		"/api/documents",
		(req, _res, next) => {
			req.user = user;
			next();
		},
		getDocuments,
	);
	return app;
}

beforeEach(() => {
	documentFindMany.mockReset();
	documentFindMany.mockResolvedValue([]);
	documentCreate.mockReset();
	documentCreate.mockImplementation(async (args) => ({ id: "doc-new", ...args.data }));
	supportCaseFindUnique.mockReset();
	supportCaseFindUnique.mockImplementation(async ({ where }) =>
		where?.id === "case-1" ? { id: "case-1", user_id: "client-1" } : null,
	);
	supportTicketFindUnique.mockReset();
	supportTicketFindUnique.mockImplementation(async ({ where }) =>
		where?.id === "ticket-1" ? { id: "ticket-1", user_id: "client-1" } : null,
	);
});

describe("GET /api/documents — support evidence is owner-scoped", () => {
	test("a different user sees an empty collection, not somebody else's evidence", async () => {
		documentFindMany.mockResolvedValue([supportRow()]);
		const res = await request(buildApp(STRANGER))
			.get("/api/documents")
			.query({ entity_type: "support_case", entity_id: "case-1" })
			.expect(200);
		expect(Array.isArray(res.body)).toBe(true);
		expect(res.body).toEqual([]);
	});

	test("the uploader sees their own evidence", async () => {
		documentFindMany.mockResolvedValue([supportRow()]);
		const res = await request(buildApp(UPLOADER))
			.get("/api/documents")
			.query({ entity_type: "support_case", entity_id: "case-1" })
			.expect(200);
		expect(res.body).toHaveLength(1);
		expect(res.body[0]).toMatchObject({
			id: "doc-1",
			file_path: "/uploads/support/1700000000000-shot.png",
		});
	});

	test("an admin sees the full collection", async () => {
		documentFindMany.mockResolvedValue([supportRow()]);
		const res = await request(buildApp(ADMIN))
			.get("/api/documents")
			.query({ entity_type: "support_case", entity_id: "case-1" })
			.expect(200);
		expect(res.body).toHaveLength(1);
	});

	test("an owner sees the full collection", async () => {
		documentFindMany.mockResolvedValue([supportRow()]);
		const res = await request(buildApp(OWNER))
			.get("/api/documents")
			.query({ entity_type: "support_case", entity_id: "case-1" })
			.expect(200);
		expect(res.body).toHaveLength(1);
	});

	// The legacy client posts entity_type "support_ticket", and the rows it
	// produced carry that value. They are support evidence too, so they are
	// scoped the same way — otherwise the leak stays open under the old
	// spelling.
	test("the legacy support_ticket type is scoped the same way", async () => {
		documentFindMany.mockResolvedValue([legacySupportRow()]);
		const res = await request(buildApp(STRANGER))
			.get("/api/documents")
			.query({ entity_type: "support_ticket", entity_id: "ticket-1" })
			.expect(200);
		expect(res.body).toEqual([]);
	});

	// Fail closed: a request that reaches the service with no caller gets an
	// empty collection, not an unscoped one.
	test("a listing with no caller is empty", async () => {
		documentFindMany.mockResolvedValue([supportRow()]);
		const app = express();
		app.get(
			"/api/documents",
			(req, _res, next) => {
				req.user = undefined;
				next();
			},
			getDocuments,
		);
		const res = await request(app)
			.get("/api/documents")
			.query({ entity_type: "support_case", entity_id: "case-1" })
			.expect(200);
		expect(res.body).toEqual([]);
	});

	// The other document paths are NOT scoped by the uploader: verification
	// documents, payment proofs and feed media are listed by their entity id
	// and the app depends on that. Narrowing them is a different change.
	test("other entity types keep their existing listing behaviour", async () => {
		documentFindMany.mockResolvedValue([
			{ id: "doc-9", entity_type: "verification", entity_id: "u-9", uploaded_by: "u-9" },
		]);
		const res = await request(buildApp(STRANGER))
			.get("/api/documents")
			.query({ entity_type: "verification", entity_id: "u-9" })
			.expect(200);
		expect(res.body).toHaveLength(1);
	});
});

// --- the upload itself ------------------------------------------------------
//
// The live bug: the support upload wrote into the ROOT of server/uploads, and
// the static mount serves the root unauthenticated. A client's support
// screenshot was world-readable, and it had no Document row of its own, so
// the authorization model never saw it at all.
//
// The files are written for real, into the real uploads tree, because the
// thing being proved is WHERE the bytes land. They are removed afterwards.

const UPLOADS_ROOT = path.join(process.cwd(), "server", "uploads");
const SUPPORT_DIR = path.join(UPLOADS_ROOT, "support");
const writtenFiles = [];

function fakeRes() {
	const res = {
		statusCode: 200,
		body: undefined,
		status(code) {
			res.statusCode = code;
			return res;
		},
		json(payload) {
			res.body = payload;
			return res;
		},
	};
	return res;
}

function uploadReq({ entityType, entityId, name, mimetype, user }) {
	return {
		user: user || { id: "client-1", role: "buyer" },
		body: { entity_type: entityType, entity_id: entityId, type: "screenshot" },
		file: {
			originalname: name,
			mimetype,
			buffer: Buffer.from("SUPPORT-EVIDENCE-BYTES"),
		},
	};
}

afterEach(async () => {
	while (writtenFiles.length) {
		const file = writtenFiles.pop();
		await fs.rm(file, { force: true }).catch(() => {});
	}
});

// The path of the file a row points at, resolved against the uploads root.
// The row's file_path is the PUBLIC path ("/uploads/support/x.png"), while
// the older rows carry a path relative to the working directory.
function onDiskPath(filePath) {
	const parts = String(filePath || "")
		.split(/[\\/]/)
		.filter(Boolean);
	if (parts[0] === "uploads" || parts[0] === "server") {
		parts.shift();
	}
	if (parts[0] === "uploads") {
		parts.shift();
	}
	return path.join(UPLOADS_ROOT, ...parts);
}

describe("the support upload lands in the gated namespace", () => {
	test("writes the bytes into /uploads/support and anchors them with a row", async () => {
		const res = fakeRes();
		await uploadDocument(
			uploadReq({
				entityType: "support_case",
				entityId: "case-1",
				name: "shot.png",
				mimetype: "image/png",
			}),
			res,
		);

		// Registered for cleanup BEFORE the assertions, so a failing
		// assertion cannot leave a file behind in the uploads tree.
		const row = documentCreate.mock.calls[0]?.[0]?.data || {};
		const onDisk = onDiskPath(row.file_path);
		writtenFiles.push(onDisk);

		expect(res.statusCode).toBe(201);
		expect(row).toMatchObject({
			entity_type: "support_case",
			entity_id: "case-1",
			uploaded_by: "client-1",
		});
		expect(row.file_path).toMatch(/^\/uploads\/support\/.+\.png$/);

		// The bytes are where the row says they are, and nowhere else: the
		// root of the uploads tree is what the static mount publishes.
		expect(await fs.readFile(onDisk, "utf8")).toBe("SUPPORT-EVIDENCE-BYTES");
		expect(path.dirname(onDisk)).toBe(SUPPORT_DIR);
	});

	// The legacy client posts entity_type "support_ticket" (FeedbackPage.jsx,
	// SupportReports.jsx). It has to be routed into the gated namespace too,
	// or the world-readable upload stays world-readable.
	test("routes the legacy support_ticket type into the gated namespace as well", async () => {
		const res = fakeRes();
		await uploadDocument(
			uploadReq({
				entityType: "support_ticket",
				entityId: "ticket-1",
				name: "legacy.png",
				mimetype: "image/png",
			}),
			res,
		);

		const row = documentCreate.mock.calls[0]?.[0]?.data || {};
		const onDisk = onDiskPath(row.file_path);
		writtenFiles.push(onDisk);

		expect(res.statusCode).toBe(201);
		expect(row.entity_type).toBe("support_case");
		expect(row.file_path).toMatch(/^\/uploads\/support\//);
		expect(await fs.readFile(onDisk, "utf8")).toBe("SUPPORT-EVIDENCE-BYTES");
	});

	// The other document paths are public on purpose: a product photo and a
	// verification document are served straight off the static mount. They
	// must keep landing in the root, with their own row.
	test("leaves the other document paths where they were", async () => {
		const res = fakeRes();
		await uploadDocument(
			uploadReq({
				entityType: "verification",
				entityId: "u-1",
				name: "proof.png",
				mimetype: "image/png",
			}),
			res,
		);

		const row = documentCreate.mock.calls[0]?.[0]?.data || {};
		const onDisk = onDiskPath(row.file_path);
		writtenFiles.push(onDisk);

		expect(res.statusCode).toBe(201);
		expect(row.entity_type).toBe("verification");
		expect(row.file_path).not.toMatch(/^\/uploads\/support\//);
		expect(path.dirname(onDisk)).toBe(UPLOADS_ROOT);
		expect(await fs.readFile(onDisk, "utf8")).toBe("SUPPORT-EVIDENCE-BYTES");
	});
});

// --- the upload checks that the caller owns the case ------------------------
//
// `entity_id` arrives in the request body. It used to be written straight onto
// the Document row, so any authenticated caller could mint unlimited
// `support_case` rows naming an id they made up. The id is now resolved
// against a SupportCase (or, for the legacy client, a SupportTicket) and the
// caller has to own it.
describe("the support upload resolves who owns the entity", () => {
	test("a stranger cannot attach evidence to somebody else's case", async () => {
		const res = fakeRes();
		await uploadDocument(
			uploadReq({
				entityType: "support_case",
				entityId: "case-1",
				name: "stolen.png",
				mimetype: "image/png",
				user: { id: "intruder", role: "buyer" },
			}),
			res,
		);

		expect(res.statusCode).toBe(403);
		expect(typeof res.body.error).toBe("string");
		// No row was minted, and no bytes were written.
		expect(documentCreate).not.toHaveBeenCalled();
	});

	test("a stranger cannot attach evidence to somebody else's ticket", async () => {
		const res = fakeRes();
		await uploadDocument(
			uploadReq({
				entityType: "support_ticket",
				entityId: "ticket-1",
				name: "stolen.png",
				mimetype: "image/png",
				user: { id: "intruder", role: "buyer" },
			}),
			res,
		);

		expect(res.statusCode).toBe(403);
		expect(documentCreate).not.toHaveBeenCalled();
	});

	test("an entity_id that names nothing is refused", async () => {
		const res = fakeRes();
		await uploadDocument(
			uploadReq({
				entityType: "support_case",
				entityId: "made-up-id",
				name: "nowhere.png",
				mimetype: "image/png",
			}),
			res,
		);

		expect(res.statusCode).toBe(400);
		expect(typeof res.body.error).toBe("string");
		expect(documentCreate).not.toHaveBeenCalled();
	});

	test("an upload with no entity_id at all is refused", async () => {
		const res = fakeRes();
		await uploadDocument(
			uploadReq({
				entityType: "support_case",
				entityId: undefined,
				name: "nowhere.png",
				mimetype: "image/png",
			}),
			res,
		);

		expect(res.statusCode).toBe(400);
		expect(documentCreate).not.toHaveBeenCalled();
	});

	// The legacy client is load-bearing: FeedbackPage.jsx and
	// SupportReports.jsx create a TICKET and upload against its id.
	test("the legacy ticket branch still lets the ticket's own user upload", async () => {
		const res = fakeRes();
		await uploadDocument(
			uploadReq({
				entityType: "support_ticket",
				entityId: "ticket-1",
				name: "legacy.png",
				mimetype: "image/png",
			}),
			res,
		);

		const row = documentCreate.mock.calls[0]?.[0]?.data || {};
		const onDisk = onDiskPath(row.file_path);
		writtenFiles.push(onDisk);

		expect(res.statusCode).toBe(201);
		expect(row).toMatchObject({ entity_type: "support_case", entity_id: "ticket-1" });
	});
});
