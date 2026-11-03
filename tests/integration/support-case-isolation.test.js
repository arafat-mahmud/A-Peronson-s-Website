import fs from "node:fs";
import fsPromises from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { jest } from "@jest/globals";
import express from "express";
import request from "supertest";

// Cross-case isolation.
//
// A support case is the client's own material: the thread, the screenshots
// they attached, the investigation that ran against them and the report that
// came out of it. Two clients on the platform must never be able to reach
// each other's.
//
// These tests drive the REAL router, the REAL controller, the REAL service
// and the REAL file-authorization resolver, over an in-memory Prisma. A
// service-level test would pass even if the controller forgot to pass the
// caller along, and the caller is the whole of the rule: the ownership
// decision is made where the case row is read.
//
// The surfaces under test, and the rule each one carries:
//
//   GET  /api/support/cases/:caseId      the case, its thread, its report
//   POST /api/support/cases/:caseId/messages
//   POST /api/files/sign                 a signed url for a case's evidence
//   GET  /api/files/content              the bytes behind a signed url
//
// The file surfaces are the repo's own (server/routes/fileAccessRoutes.js);
// the case surfaces are Workstream 1's (server/routes/caseRoutes.js).

// --- the world this test runs in --------------------------------------------
//
// The intake path is offline: no provider, no network, no machine-dependent
// answer. The provider configuration is read at MODULE LOAD time by
// server/services/assistantService.js, so these have to be set before the
// imports below.
const ORIGINAL_AI_ENABLED = process.env.AI_ENABLED;
const ORIGINAL_CASE_AI_PROVIDER = process.env.CASE_AI_PROVIDER;
const ORIGINAL_SIGNING_SECRET = process.env.UPLOADS_SIGNING_SECRET;
process.env.AI_ENABLED = "false";
process.env.CASE_AI_PROVIDER = "none";
// The signed-URL surface is exercised for real, so the HMAC needs a key.
// server/utils/signedFileUrl.js refuses anything shorter than 32 characters.
process.env.UPLOADS_SIGNING_SECRET = "isolation-suite-signing-secret-0123456789";

// --- an in-memory Prisma ----------------------------------------------------
//
// The persistence underneath the routes is exercised for real too: the
// ownership check reads the case row, the sequence allocation runs, and the
// attachment rows are written. A stubbed store would let a broken ownership
// rule pass.
const state = {
	users: [],
	cases: [],
	caseMessages: [],
	attachments: [],
	investigations: [],
	documents: [],
	chatMessages: [],
	callSessions: [],
};

// Two clients and one staff member. CLIENT_A and CLIENT_B are ordinary
// buyers: neither has a role that grants anything.
const CLIENT_A = { id: "iso-client-a", role: "buyer", email: "client-a@example.test" };
const CLIENT_B = { id: "iso-client-b", role: "buyer", email: "client-b@example.test" };
const ADMIN = { id: "iso-admin", role: "admin", email: "iso-admin@example.test" };

const CASE_A = "iso-case-a";
const CASE_B = "iso-case-b";

// The secrets. Anything a client must never see carries one of these, so a
// leak is a literal string match rather than a judgement about shape.
const MESSAGE_SECRET = "CLIENT-B-PRIVATE-MESSAGE-MARKER";
const REPORT_SECRET = "CLIENT-B-PRIVATE-REPORT-MARKER";

// The evidence of each case. The public path is what a Document row stores
// and what /api/files/sign is asked for.
const EVIDENCE_A = "/uploads/support/iso-case-a-evidence.png";
const EVIDENCE_B = "/uploads/support/iso-case-b-evidence.png";

// --- the in-memory query engine --------------------------------------------
//
// Just enough of Prisma's query shape for the code under test: the equality
// filter, the `in` / `equals` / `contains` operators, the `OR` arm, and the
// JSON-path filter the file resolver uses for a contract PDF's artifact.
function equalsValue(actual, expected) {
	return String(actual ?? "") === String(expected ?? "");
}

// The operators the queries under test use. `path` is Prisma's JSON-path
// filter: { artifact: { path: ["pdf_path"], equals: "..." } }. Returns null
// when the value is not an operator object, so the caller can fall through to
// the plain equality comparison.
function matchesOperator(row, key, value) {
	if (Array.isArray(value.path)) {
		const [field] = value.path;
		const inner = row[key] && typeof row[key] === "object" ? row[key][field] : undefined;
		return equalsValue(inner, "equals" in value ? value.equals : undefined);
	}
	if (Array.isArray(value.in)) {
		return value.in.map(String).includes(String(row[key]));
	}
	if ("equals" in value) {
		return equalsValue(row[key], value.equals);
	}
	if ("contains" in value) {
		return String(row[key] ?? "").includes(String(value.contains));
	}
	if ("not" in value) {
		return !equalsValue(row[key], value.not);
	}
	return null;
}

function matchField(row, key, value) {
	if (value && typeof value === "object" && !Array.isArray(value)) {
		const matched = matchesOperator(row, key, value);
		if (matched !== null) {
			return matched;
		}
	}
	return equalsValue(row[key], value);
}

function matchesWhere(row, where) {
	if (!where || typeof where !== "object") {
		return true;
	}
	if (Array.isArray(where.OR)) {
		return where.OR.some((arm) => matchesWhere(row, arm));
	}
	return Object.entries(where).every(([key, value]) => matchField(row, key, value));
}

function sortRows(rows, orderBy) {
	if (!orderBy || typeof orderBy !== "object") {
		return rows;
	}
	const entries = Object.entries(orderBy);
	if (entries.length === 0) {
		return rows;
	}
	const [field, direction] = entries[0];
	const factor = direction === "desc" ? -1 : 1;
	return [...rows].sort((left, right) => {
		const a = left[field];
		const b = right[field];
		if (a === b) {
			return 0;
		}
		if (a === null || a === undefined) {
			return 1;
		}
		if (b === null || b === undefined) {
			return -1;
		}
		return (a < b ? -1 : 1) * factor;
	});
}

function project(row, select) {
	if (!select) {
		return { ...row };
	}
	const out = {};
	for (const [key, wanted] of Object.entries(select)) {
		if (wanted) {
			out[key] = row[key];
		}
	}
	return out;
}

function collection(rows) {
	return {
		findMany({ where, orderBy } = {}) {
			return sortRows(
				rows.filter((row) => matchesWhere(row, where)),
				orderBy,
			).map((row) => ({ ...row }));
		},
		findFirst({ where, orderBy, select } = {}) {
			const [found] = sortRows(
				rows.filter((row) => matchesWhere(row, where)),
				orderBy,
			);
			return found ? project(found, select) : null;
		},
		findUnique({ where, select } = {}) {
			const found = rows.find((row) => matchesWhere(row, where));
			return found ? project(found, select) : null;
		},
		create({ data } = {}) {
			const row = { ...data };
			rows.push(row);
			return { ...row };
		},
		update({ where, data } = {}) {
			const row = rows.find((candidate) => matchesWhere(candidate, where));
			if (!row) {
				throw new Error(`no row for ${JSON.stringify(where)}`);
			}
			Object.assign(row, data);
			return { ...row };
		},
		upsert({ where, create, update } = {}) {
			const row = rows.find((candidate) => matchesWhere(candidate, where));
			if (row) {
				Object.assign(row, update?.data ?? {});
				return { ...row };
			}
			const created = { ...(create?.data ?? {}) };
			rows.push(created);
			return { ...created };
		},
		delete({ where } = {}) {
			const index = rows.findIndex((candidate) => matchesWhere(candidate, where));
			if (index === -1) {
				throw new Error(`no row for ${JSON.stringify(where)}`);
			}
			const [removed] = rows.splice(index, 1);
			return { ...removed };
		},
		deleteMany({ where } = {}) {
			const keep = rows.filter((row) => !matchesWhere(row, where));
			const removed = rows.length - keep.length;
			rows.length = 0;
			rows.push(...keep);
			return { count: removed };
		},
		count({ where } = {}) {
			return rows.filter((row) => matchesWhere(row, where)).length;
		},
	};
}

const supportCase = collection(state.cases);

// `getCaseWithMessages` asks for the case WITH its thread, and that relation
// is the one the read route depends on.
supportCase.findUnique = ({ where, select, include } = {}) => {
	const row = state.cases.find((candidate) => matchesWhere(candidate, where));
	if (!row) {
		return null;
	}
	const out = project(row, select);
	if (include?.messages) {
		out.messages = sortRows(
			state.caseMessages.filter((message) => message.case_id === row.id),
			include.messages.orderBy,
		).map((message) => ({ ...message }));
	}
	return out;
};

// prisma/schema.prisma declares onDelete: Cascade on every child relation, so
// deleting a case takes its thread, its attachments and its investigations
// with it. The in-memory store has to behave the same way or the delete
// route's assertions would be about a fiction.
supportCase.delete = ({ where } = {}) => {
	const index = state.cases.findIndex((candidate) => matchesWhere(candidate, where));
	if (index === -1) {
		throw new Error(`no row for ${JSON.stringify(where)}`);
	}
	const [removed] = state.cases.splice(index, 1);
	for (const list of [state.caseMessages, state.attachments, state.investigations]) {
		for (let index2 = list.length - 1; index2 >= 0; index2 -= 1) {
			if (list[index2].case_id === removed.id) {
				list.splice(index2, 1);
			}
		}
	}
	return { ...removed };
};

const prismaMock = {
	user: collection(state.users),
	document: collection(state.documents),
	message: collection(state.chatMessages),
	callSession: collection(state.callSessions),
	supportCase,
	supportCaseMessage: collection(state.caseMessages),
	supportCaseAttachment: collection(state.attachments),
	supportInvestigation: collection(state.investigations),
	$transaction: async (fn) => fn(prismaMock),
};

jest.unstable_mockModule("../../server/utils/prisma.js", () => ({ default: prismaMock }));

// The investigation queue belongs to Workstream 2 and is not part of this
// workstream. It is mocked only when it exists, because the case routes
// must not need it to be present to answer a message.
const QUEUE_MODULE_PATH = "../../server/services/investigationQueue.js";
const queueModuleExists = fs.existsSync(
	fileURLToPath(new URL("../../server/services/investigationQueue.js", import.meta.url)),
);
const enqueueInvestigation = jest.fn(async () => {});
if (queueModuleExists) {
	jest.unstable_mockModule(QUEUE_MODULE_PATH, () => ({
		enqueueInvestigation,
		queueDepth: () => 0,
	}));
}

const { signToken } = await import("../../server/middleware/auth.js");
const caseRoutes = (await import("../../server/routes/caseRoutes.js")).default;
const fileAccessRoutes = (await import("../../server/routes/fileAccessRoutes.js")).default;
// The staff console's view of the SAME case rows. It is the only surface that
// serves the report body, so it is part of the isolation boundary: a client
// must not reach it, and an admin must.
const adminRoutes = (await import("../../server/routes/adminRoutes.js")).default;

const AUTH = {
	a: { Authorization: `Bearer ${signToken(CLIENT_A)}` },
	b: { Authorization: `Bearer ${signToken(CLIENT_B)}` },
	admin: { Authorization: `Bearer ${signToken(ADMIN)}` },
};

function buildApp() {
	const app = express();
	app.use(express.json());
	app.use("/api/support/cases", caseRoutes);
	app.use("/api/files", fileAccessRoutes);
	app.use("/api/admin", adminRoutes);
	return app;
}

// --- the evidence on disk ---------------------------------------------------
//
// The signed-URL route serves REAL bytes: it resolves the path through
// fs.realpath and refuses a path that is not there. So the files exist.
const UPLOADS_ROOT = path.resolve(process.cwd(), "server", "uploads");
const SUPPORT_DIR = path.join(UPLOADS_ROOT, "support");
const writtenFiles = [];
let createdSupportDir = false;

async function writeEvidence(publicPath, contents) {
	const abs = path.join(UPLOADS_ROOT, ...publicPath.split("/").filter(Boolean).slice(1));
	if (!fs.existsSync(SUPPORT_DIR)) {
		await fsPromises.mkdir(SUPPORT_DIR, { recursive: true });
		createdSupportDir = true;
	}
	await fsPromises.writeFile(abs, contents);
	writtenFiles.push(abs);
	return abs;
}

// --- fixtures ---------------------------------------------------------------
const NOW = new Date("2026-10-20T09:00:00.000Z");

function seed() {
	state.users.length = 0;
	state.users.push(
		{ ...CLIENT_A, status: "active", password_reset_at: null },
		{ ...CLIENT_B, status: "active", password_reset_at: null },
		{ ...ADMIN, status: "active", password_reset_at: null },
	);

	state.cases.length = 0;
	state.cases.push(
		{
			id: CASE_A,
			user_id: CLIENT_A.id,
			status: "collecting",
			subject: "Checkout fails",
			summary: null,
			ticket_id: null,
			escalated: false,
			report_status: null,
			report_delivered_at: null,
			retain: false,
			created_at: NOW,
			updated_at: NOW,
		},
		{
			id: CASE_B,
			user_id: CLIENT_B.id,
			status: "reporting",
			subject: "Export crashes",
			summary: "Export crashes on the ledger page",
			ticket_id: null,
			escalated: false,
			report_status: "ready",
			report_delivered_at: NOW,
			retain: false,
			created_at: NOW,
			updated_at: NOW,
		},
	);

	state.caseMessages.length = 0;
	state.caseMessages.push(
		{
			id: "msg-a1",
			case_id: CASE_A,
			role: "client",
			kind: "answer",
			content: "The checkout total is wrong.",
			agent: null,
			sequence: 1,
			created_at: NOW,
		},
		{
			id: "msg-b1",
			case_id: CASE_B,
			role: "client",
			kind: "answer",
			content: MESSAGE_SECRET,
			agent: null,
			sequence: 1,
			created_at: NOW,
		},
		{
			id: "msg-b2",
			case_id: CASE_B,
			role: "assistant",
			kind: "notice",
			content: "Thanks - that is enough for the investigation to start.",
			agent: null,
			sequence: 2,
			created_at: NOW,
		},
	);

	state.attachments.length = 0;
	state.attachments.push(
		{
			id: "att-a1",
			case_id: CASE_A,
			document_id: "doc-a",
			file_path: EVIDENCE_A,
			mime_type: "image/png",
			byte_size: 21,
			uploaded_by: CLIENT_A.id,
			created_at: NOW,
		},
		{
			id: "att-b1",
			case_id: CASE_B,
			document_id: "doc-b",
			file_path: EVIDENCE_B,
			mime_type: "image/png",
			byte_size: 21,
			uploaded_by: CLIENT_B.id,
			created_at: NOW,
		},
	);

	state.investigations.length = 0;
	state.investigations.push({
		id: "inv-b1",
		case_id: CASE_B,
		role: "lead",
		status: "complete",
		attempt: 1,
		model_id: null,
		prompt: null,
		report: REPORT_SECRET,
		findings: null,
		evidence: null,
		tool_log: null,
		error: null,
		started_at: NOW,
		completed_at: NOW,
		created_at: NOW,
	});

	state.documents.length = 0;
	state.documents.push(
		{
			id: "doc-a",
			entity_type: "support_case",
			entity_id: CASE_A,
			file_path: EVIDENCE_A,
			uploaded_by: CLIENT_A.id,
			type: "screenshot",
		},
		{
			id: "doc-b",
			entity_type: "support_case",
			entity_id: CASE_B,
			file_path: EVIDENCE_B,
			uploaded_by: CLIENT_B.id,
			type: "screenshot",
		},
	);

	state.chatMessages.length = 0;
	state.callSessions.length = 0;
}

beforeEach(async () => {
	seed();
	enqueueInvestigation.mockClear();
	await writeEvidence(EVIDENCE_A, "CLIENT-A-EVIDENCE-BYTES");
	await writeEvidence(EVIDENCE_B, "CLIENT-B-EVIDENCE-BYTES");
});

afterEach(async () => {
	const files = writtenFiles.splice(0);
	await Promise.all(files.map((file) => fsPromises.rm(file, { force: true }).catch(() => {})));
	if (createdSupportDir) {
		await fsPromises.rmdir(SUPPORT_DIR).catch(() => {});
		createdSupportDir = false;
	}
});

afterAll(() => {
	if (ORIGINAL_AI_ENABLED === undefined) {
		delete process.env.AI_ENABLED;
	} else {
		process.env.AI_ENABLED = ORIGINAL_AI_ENABLED;
	}
	if (ORIGINAL_CASE_AI_PROVIDER === undefined) {
		delete process.env.CASE_AI_PROVIDER;
	} else {
		process.env.CASE_AI_PROVIDER = ORIGINAL_CASE_AI_PROVIDER;
	}
	if (ORIGINAL_SIGNING_SECRET === undefined) {
		delete process.env.UPLOADS_SIGNING_SECRET;
	} else {
		process.env.UPLOADS_SIGNING_SECRET = ORIGINAL_SIGNING_SECRET;
	}
});

// --- the rule ---------------------------------------------------------------

describe("a client cannot reach another client's case", () => {
	test("client A cannot read client B's case - 403", async () => {
		const res = await request(buildApp()).get(`/api/support/cases/${CASE_B}`).set(AUTH.a);

		expect(res.status).toBe(403);
		expect(typeof res.body.error).toBe("string");
		// The refusal is a refusal: no part of the case rides along with it.
		expect(res.body.case).toBeUndefined();
		expect(res.body.messages).toBeUndefined();
		expect(JSON.stringify(res.body)).not.toContain("Export crashes");
		expect(JSON.stringify(res.body)).not.toContain(REPORT_SECRET);
	});

	test("client A's case list holds client B's case out", async () => {
		const list = await request(buildApp()).get("/api/support/cases").set(AUTH.a).expect(200);

		expect(Array.isArray(list.body.cases)).toBe(true);
		expect(list.body.cases.map((row) => row.id)).toEqual([CASE_A]);
		expect(JSON.stringify(list.body)).not.toContain(CASE_B);
		expect(JSON.stringify(list.body)).not.toContain(REPORT_SECRET);
	});

	test("client A cannot post to client B's case - 403, and the thread is untouched", async () => {
		const posted = await request(buildApp())
			.post(`/api/support/cases/${CASE_B}/messages`)
			.set(AUTH.a)
			.send({ content: "let me in" });

		expect(posted.status).toBe(403);
		expect(typeof posted.body.error).toBe("string");

		// The refusal must not have written anything into client B's thread.
		const owner = await request(buildApp())
			.get(`/api/support/cases/${CASE_B}`)
			.set(AUTH.b)
			.expect(200);
		expect(owner.body.messages.map((message) => message.id)).toEqual(["msg-b1", "msg-b2"]);
	});

	test("client A cannot delete client B's case - 403, and the case survives", async () => {
		const deleted = await request(buildApp()).delete(`/api/support/cases/${CASE_B}`).set(AUTH.a);

		expect(deleted.status).toBe(403);

		const owner = await request(buildApp())
			.get(`/api/support/cases/${CASE_B}`)
			.set(AUTH.b)
			.expect(200);
		expect(owner.body.case).toMatchObject({ id: CASE_B });
		expect(state.cases.some((row) => row.id === CASE_B)).toBe(true);
	});

	// The non-vacuity check. Without it, every assertion above would also
	// pass against an empty database: a 403 is what you get when there is
	// nothing to show. So the same request, with the same token, must SUCCEED
	// for the client that owns the case.
	test("the owner of the case can read it - the 403 above is about the caller", async () => {
		const owner = await request(buildApp())
			.get(`/api/support/cases/${CASE_B}`)
			.set(AUTH.b)
			.expect(200);

		expect(owner.body.case).toMatchObject({ id: CASE_B, user_id: CLIENT_B.id });
		expect(owner.body.messages.map((message) => message.id)).toEqual(["msg-b1", "msg-b2"]);
	});

	// The write side needs the same non-vacuity check, and it pins the two
	// success statuses the case API answers with: 201 for a created case and
	// 201 for an appended message, 200 for everything else.
	test("the owner can open a case and post to it - 201", async () => {
		const opened = await request(buildApp())
			.post("/api/support/cases")
			.set(AUTH.b)
			.send({ subject: "Checkout fails" });

		expect(opened.status).toBe(201);
		expect(opened.body.case).toMatchObject({ user_id: CLIENT_B.id });

		const posted = await request(buildApp())
			.post(`/api/support/cases/${opened.body.case.id}/messages`)
			.set(AUTH.b)
			.send({ content: "The total is wrong at checkout" });

		expect(posted.status).toBe(201);
		expect(posted.body.message).toMatchObject({
			case_id: opened.body.case.id,
			role: "client",
			content: "The total is wrong at checkout",
		});
	});
});

describe("a client cannot reach another client's messages", () => {
	test("client A cannot read client B's messages - 403, and none of them leak", async () => {
		const res = await request(buildApp()).get(`/api/support/cases/${CASE_B}`).set(AUTH.a);

		expect(res.status).toBe(403);
		const body = JSON.stringify(res.body);
		expect(body).not.toContain(MESSAGE_SECRET);
		expect(body).not.toContain("msg-b1");
		expect(body).not.toContain("msg-b2");
		expect(res.body.messages).toBeUndefined();
	});

	test("none of client B's message text appears in ANY response client A can get", async () => {
		const app = buildApp();
		const bodies = [];

		bodies.push(
			JSON.stringify((await request(app).get(`/api/support/cases/${CASE_B}`).set(AUTH.a)).body),
		);
		bodies.push(JSON.stringify((await request(app).get("/api/support/cases").set(AUTH.a)).body));
		bodies.push(
			JSON.stringify(
				(
					await request(app)
						.post(`/api/support/cases/${CASE_B}/messages`)
						.set(AUTH.a)
						.send({ content: "let me in" })
				).body,
			),
		);
		bodies.push(
			JSON.stringify((await request(app).delete(`/api/support/cases/${CASE_B}`).set(AUTH.a)).body),
		);
		bodies.push(
			JSON.stringify(
				(
					await request(app)
						.post("/api/files/sign")
						.set(AUTH.a)
						.send({ paths: [EVIDENCE_B] })
				).body,
			),
		);

		for (const body of bodies) {
			expect(body).not.toContain(MESSAGE_SECRET);
			expect(body).not.toContain(REPORT_SECRET);
		}
	});
});

describe("a client cannot reach another client's attachments", () => {
	test("client A cannot sign client B's evidence - 403, and no url comes back", async () => {
		const res = await request(buildApp())
			.post("/api/files/sign")
			.set(AUTH.a)
			.send({ paths: [EVIDENCE_B] });

		expect(res.status).toBe(200);
		const entry = res.body.signed[EVIDENCE_B];
		expect(entry).toBeDefined();
		expect(entry.status).toBe(403);
		expect(entry.error).toBe("forbidden");
		// No url: the point of the refusal is that there is nothing to use.
		expect(entry.url).toBeUndefined();
	});

	test("client A cannot attach client B's evidence to their own case", async () => {
		const before = state.attachments.length;
		const posted = await request(buildApp())
			.post(`/api/support/cases/${CASE_A}/messages`)
			.set(AUTH.a)
			.send({
				content: "here is the screenshot I meant to send",
				attachments: [{ file_path: EVIDENCE_B, mime_type: "image/png" }],
			});

		expect(posted.status).toBe(400);
		expect(typeof posted.body.error).toBe("string");
		// No attachment row was written for the other client's bytes.
		expect(state.attachments.length).toBe(before);
		expect(
			state.attachments.some((row) => row.case_id === CASE_A && row.file_path === EVIDENCE_B),
		).toBe(false);
	});

	test("client A cannot fetch client B's evidence bytes without a signature", async () => {
		const res = await request(buildApp()).get("/api/files/content").query({ path: EVIDENCE_B });

		expect(res.status).toBe(403);
		expect(res.body.reason).toBe("bad_user");
	});

	// The non-vacuity check: the same call, with the owner of the evidence,
	// gets a url. Without this, "no url came back" would also be the answer
	// for a broken signing service.
	test("client B can sign their own evidence", async () => {
		const res = await request(buildApp())
			.post("/api/files/sign")
			.set(AUTH.b)
			.send({ paths: [EVIDENCE_B] });

		expect(res.status).toBe(200);
		const entry = res.body.signed[EVIDENCE_B];
		expect(entry.url).toContain("/api/files/content?");
		expect(entry.error).toBeUndefined();
	});
});

describe("a signed url for one case's attachment does not resolve for another", () => {
	test("the url client A holds does not resolve for client B's attachment", async () => {
		const signed = await request(buildApp())
			.post("/api/files/sign")
			.set(AUTH.a)
			.send({ paths: [EVIDENCE_A] });

		expect(signed.status).toBe(200);
		const { url } = signed.body.signed[EVIDENCE_A];
		expect(typeof url).toBe("string");

		const parsed = new URL(url, "http://localhost");
		const params = parsed.searchParams;

		// The path is bound into the signature: swapping it for client B's
		// attachment is a different document and must not resolve.
		const swapped = await request(buildApp())
			.get("/api/files/content")
			.query({
				path: EVIDENCE_B,
				exp: params.get("exp"),
				uid: params.get("uid"),
				sig: params.get("sig"),
			});
		expect(swapped.status).toBe(403);
		expect(swapped.body.reason).toBe("bad_signature");

		// The holder is bound into the signature too: a url minted for
		// client A cannot be re-minted for client B.
		const rehomed = await request(buildApp())
			.get("/api/files/content")
			.query({
				path: EVIDENCE_A,
				exp: params.get("exp"),
				uid: CLIENT_B.id,
				sig: params.get("sig"),
			});
		expect(rehomed.status).toBe(403);
		expect(rehomed.body.reason).toBe("bad_signature");
	});

	test("client B cannot obtain a resolving url for client A's attachment", async () => {
		const signed = await request(buildApp())
			.post("/api/files/sign")
			.set(AUTH.b)
			.send({ paths: [EVIDENCE_A] });

		expect(signed.status).toBe(200);
		const entry = signed.body.signed[EVIDENCE_A];
		expect(entry.status).toBe(403);
		expect(entry.error).toBe("forbidden");
		expect(entry.url).toBeUndefined();
	});

	test("the url resolves for the client it was issued to", async () => {
		const signed = await request(buildApp())
			.post("/api/files/sign")
			.set(AUTH.a)
			.send({ paths: [EVIDENCE_A] });

		const { url } = signed.body.signed[EVIDENCE_A];
		const parsed = new URL(url, "http://localhost");
		const res = await request(buildApp())
			.get("/api/files/content")
			.query({
				path: parsed.searchParams.get("path"),
				exp: parsed.searchParams.get("exp"),
				uid: parsed.searchParams.get("uid"),
				sig: parsed.searchParams.get("sig"),
			});

		expect(res.status).toBe(200);
		// The evidence is served as a binary body (image/png), so the bytes
		// arrive in `body` as a Buffer rather than in `text`.
		const bytes = Buffer.isBuffer(res.body) ? res.body.toString("utf8") : String(res.text ?? "");
		expect(bytes).toBe("CLIENT-A-EVIDENCE-BYTES");
	});
});

describe("a client cannot reach another client's report", () => {
	test("client A cannot read client B's report - 403", async () => {
		const res = await request(buildApp()).get(`/api/support/cases/${CASE_B}`).set(AUTH.a);

		expect(res.status).toBe(403);
		expect(JSON.stringify(res.body)).not.toContain(REPORT_SECRET);
	});

	// The report body lives on the case's investigation rows and is a STAFF
	// artifact: the client-facing case payload is fixed by contracts.md §3 to
	// `{ case, messages }`, so no client - not even the owner - can pull the
	// report body through it. The staff surface is the admin console route.
	test("the client-facing case payload carries no report body at all", async () => {
		const owner = await request(buildApp())
			.get(`/api/support/cases/${CASE_B}`)
			.set(AUTH.b)
			.expect(200);

		expect(owner.body.report).toBeUndefined();
		expect(owner.body.investigations).toBeUndefined();
		expect(JSON.stringify(owner.body)).not.toContain(REPORT_SECRET);
	});

	test("the report is not readable through the signed-file surface either", async () => {
		const res = await request(buildApp())
			.post("/api/files/sign")
			.set(AUTH.a)
			.send({ paths: [EVIDENCE_B] });

		expect(res.status).toBe(200);
		expect(JSON.stringify(res.body)).not.toContain(REPORT_SECRET);
	});

	// The report BODY lives on the case's investigation rows, and the staff
	// console route is the only surface that serves them. A client is not
	// staff: the admin guard chain refuses the request outright, so the
	// report of another client's case is 403 for them - here and through
	// every other client-facing route above.
	test("client A cannot read client B's report on the staff console route - 403", async () => {
		const res = await request(buildApp()).get(`/api/admin/support/cases/${CASE_B}`).set(AUTH.a);

		expect(res.status).toBe(403);
		expect(JSON.stringify(res.body)).not.toContain(REPORT_SECRET);
	});

	// The non-vacuity check for that one: the route DOES serve the report to
	// staff, so the 403 above is about the caller and not about an empty
	// payload.
	test("an admin can read client B's report on the staff console route", async () => {
		const res = await request(buildApp()).get(`/api/admin/support/cases/${CASE_B}`).set(AUTH.admin);

		expect(res.status).toBe(200);
		expect(res.body.case).toMatchObject({ id: CASE_B, user_id: CLIENT_B.id });
		expect(JSON.stringify(res.body)).toContain(REPORT_SECRET);
	});
});

describe("staff can read any case", () => {
	test("an admin can read another client's case and its messages", async () => {
		const res = await request(buildApp()).get(`/api/support/cases/${CASE_B}`).set(AUTH.admin);

		expect(res.status).toBe(200);
		expect(res.body.case).toMatchObject({ id: CASE_B, user_id: CLIENT_B.id });
		expect(res.body.messages.map((message) => message.id)).toEqual(["msg-b1", "msg-b2"]);
	});

	test("an admin can read either client's case", async () => {
		const reads = await Promise.all(
			[CASE_A, CASE_B].map(async (caseId) => ({
				caseId,
				res: await request(buildApp())
					.get(`/api/support/cases/${caseId}`)
					.set(AUTH.admin)
					.expect(200),
			})),
		);

		for (const { caseId, res } of reads) {
			expect(res.body.case).toMatchObject({ id: caseId });
		}
	});

	test("an admin can sign another client's evidence", async () => {
		const res = await request(buildApp())
			.post("/api/files/sign")
			.set(AUTH.admin)
			.send({ paths: [EVIDENCE_B] });

		expect(res.status).toBe(200);
		const entry = res.body.signed[EVIDENCE_B];
		expect(entry.error).toBeUndefined();
		expect(entry.url).toContain("/api/files/content?");
	});

	// The non-vacuity check for the whole file: the refusals above are about
	// WHO is asking, not about a broken store. Client B's own evidence is
	// readable by client B.
	test("client B can still read their own evidence", async () => {
		const res = await request(buildApp())
			.post("/api/files/sign")
			.set(AUTH.b)
			.send({ paths: [EVIDENCE_B] });

		expect(res.status).toBe(200);
		expect(res.body.signed[EVIDENCE_B].url).toContain("/api/files/content?");
	});
});

// ---------------------------------------------------------------------------
// The staff actions on a case: escalate and re-run.
//
// Both routes are behind the admin guard chain, so the isolation rule holds
// for them as well: a client cannot escalate another client's case, and a
// client cannot start an investigation of one either.
// ---------------------------------------------------------------------------
describe("the staff actions on a case", () => {
	test("an admin can escalate a case, and the case records it", async () => {
		const res = await request(buildApp())
			.post(`/api/admin/support/cases/${CASE_B}/escalate`)
			.set(AUTH.admin)
			.send({ reason: "confirmed data loss" });

		expect(res.status).toBe(200);
		expect(res.body.ok).toBe(true);
		expect(res.body.case).toMatchObject({ id: CASE_B, escalated: true });

		// The flag is on the ROW, not only in the answer.
		const row = state.cases.find((candidate) => candidate.id === CASE_B);
		expect(row.escalated).toBe(true);

		// The escalation is traceable: it is written into the thread.
		const messages = state.caseMessages.filter((message) => message.case_id === CASE_B);
		const note = messages.find((message) => message.role === "admin");
		expect(note).toBeDefined();
		expect(note.content).toContain("confirmed data loss");
	});

	test("a client cannot escalate a case - 403, and the case is not escalated", async () => {
		const res = await request(buildApp())
			.post(`/api/admin/support/cases/${CASE_B}/escalate`)
			.set(AUTH.b)
			.send({ reason: "let me in" });

		expect(res.status).toBe(403);
		const row = state.cases.find((candidate) => candidate.id === CASE_B);
		expect(row.escalated).toBe(false);
	});

	test("an admin can re-run a case, and a new investigation is queued", async () => {
		const res = await request(buildApp())
			.post(`/api/admin/support/cases/${CASE_B}/rerun`)
			.set(AUTH.admin)
			.send({});

		expect(res.status).toBe(200);
		expect(res.body).toMatchObject({ ok: true, queued: true, case_id: CASE_B });

		// The job was handed to the queue.
		expect(enqueueInvestigation).toHaveBeenCalledWith(CASE_B);

		// A re-run starts the case over, so the queue - which only moves a
		// case that is `investigating` - can pick it up.
		const row = state.cases.find((candidate) => candidate.id === CASE_B);
		expect(row.status).toBe("investigating");
	});

	// The previous run's DELIVERY status is cleared with the re-run. A failed
	// re-run would otherwise leave the case reading "sent" next to a failed
	// status, and the admin console would show a report that was never
	// delivered as one that was.
	test("a re-run clears the previous run's delivery status", async () => {
		const before = state.cases.find((candidate) => candidate.id === CASE_B);
		expect(before.report_status).toBe("ready");
		expect(before.report_delivered_at).toBeTruthy();

		const res = await request(buildApp())
			.post(`/api/admin/support/cases/${CASE_B}/rerun`)
			.set(AUTH.admin)
			.send({});

		expect(res.status).toBe(200);

		const row = state.cases.find((candidate) => candidate.id === CASE_B);
		expect(row.status).toBe("investigating");
		expect(row.report_status).toBeNull();
		expect(row.report_delivered_at).toBeNull();
	});

	test("a client cannot re-run a case - 403, and nothing is queued", async () => {
		const res = await request(buildApp())
			.post(`/api/admin/support/cases/${CASE_B}/rerun`)
			.set(AUTH.b)
			.send({});

		expect(res.status).toBe(403);
		expect(enqueueInvestigation).not.toHaveBeenCalled();
	});

	// The investigation queue is BOUNDED, so it can refuse the work with a
	// 429. The refusal has to reach the admin as a 429, and it must not
	// leave the case claiming that an investigation is running when none was
	// started.
	test("a re-run the queue refuses is a 429, and the case is put back", async () => {
		const before = state.cases.find((candidate) => candidate.id === CASE_B);
		expect(before.status).toBe("reporting");
		expect(before.report_status).toBe("ready");

		enqueueInvestigation.mockRejectedValueOnce(
			Object.assign(new Error("The investigation queue is full - try again shortly."), {
				status: 429,
				code: "INVESTIGATION_QUEUE_FULL",
			}),
		);

		const res = await request(buildApp())
			.post(`/api/admin/support/cases/${CASE_B}/rerun`)
			.set(AUTH.admin)
			.send({});

		expect(res.status).toBe(429);
		expect(res.body.error).toMatch(/queue is full/i);

		// The case does not claim that a run is happening: it is exactly the
		// way it was before the re-run was refused.
		const row = state.cases.find((candidate) => candidate.id === CASE_B);
		expect(row.status).toBe("reporting");
		expect(row.report_status).toBe("ready");
		expect(row.report_delivered_at).toBe(before.report_delivered_at);
	});

	// The refusal is reported, not swallowed into a 500, and the admin is
	// not left with a case that says "investigating" and nothing running.
	test("a re-run the queue refuses does not leave the case investigating", async () => {
		enqueueInvestigation.mockRejectedValueOnce(
			Object.assign(new Error("The investigation queue is full - try again shortly."), {
				status: 429,
			}),
		);

		const res = await request(buildApp())
			.post(`/api/admin/support/cases/${CASE_B}/rerun`)
			.set(AUTH.admin)
			.send({});

		expect(res.status).toBe(429);
		const row = state.cases.find((candidate) => candidate.id === CASE_B);
		expect(row.status).not.toBe("investigating");
	});

	// The investigation queue belongs to another workstream and may not be in
	// the tree. The route has to say so - 503 - instead of pretending it
	// queued a run that will never happen.
	test("a re-run reports that the runtime is not available - 503", async () => {
		// The queue module is re-registered WITHOUT its enqueue function and
		// the router is imported again into a fresh module registry, so the
		// route sees a checkout that has no investigation runtime in it.
		jest.resetModules();
		jest.unstable_mockModule(QUEUE_MODULE_PATH, () => ({ queueDepth: () => 0 }));
		const isolatedAdminRoutes = (await import("../../server/routes/adminRoutes.js")).default;
		const app = express();
		app.use(express.json());
		app.use("/api/admin", isolatedAdminRoutes);

		const res = await request(app)
			.post(`/api/admin/support/cases/${CASE_B}/rerun`)
			.set(AUTH.admin)
			.send({});

		expect(res.status).toBe(503);
		expect(typeof res.body.error).toBe("string");

		// The mock registration is shared by the whole module registry, so the
		// original factory goes back for the tests that follow.
		jest.unstable_mockModule(QUEUE_MODULE_PATH, () => ({
			enqueueInvestigation,
			queueDepth: () => 0,
		}));
	});
});
