import fs from "node:fs";
import http from "node:http";
import { fileURLToPath } from "node:url";
import { jest } from "@jest/globals";
import express from "express";
import request from "supertest";
import { resetRateLimitCounters } from "../../server/middleware/rateLimiter.js";

// The intake path is offline and deterministic in a test.
//
// `AI_ENABLED=false` and `CASE_AI_PROVIDER=none` are set BEFORE anything is
// imported, because the provider configuration is read at call time by
// server/services/caseConversationService.js and at module load time by
// server/services/assistantService.js. Set later, they would arrive too late
// for the module-load read - and a test that reached a real provider would
// depend on the developer's machine, on the network, and on the machine's
// .env.
const ORIGINAL_AI_ENABLED = process.env.AI_ENABLED;
const ORIGINAL_CASE_AI_PROVIDER = process.env.CASE_AI_PROVIDER;
process.env.AI_ENABLED = "false";
process.env.CASE_AI_PROVIDER = "none";

// --- an in-memory Prisma ----------------------------------------------------
//
// The routes are exercised for real, so the persistence underneath them is
// exercised for real too: the sequence allocation in `appendCaseMessage`,
// the client-message counter that measures the clarification round cap, and
// the ownership check all run against this store rather than being stubbed
// out. A stubbed store would let a broken round cap pass.
const state = {
	users: [],
	cases: [],
	messages: [],
	attachments: [],
	investigations: [],
	documents: [],
};

function matches(row, where) {
	if (!where || typeof where !== "object") {
		return true;
	}
	return Object.entries(where).every(([key, value]) => {
		if (value && typeof value === "object" && !Array.isArray(value) && "in" in value) {
			return Array.isArray(value.in) && value.in.includes(row[key]);
		}
		return row[key] === value;
	});
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
				rows.filter((row) => matches(row, where)),
				orderBy,
			).map((row) => ({
				...row,
			}));
		},
		findFirst({ where, orderBy, select } = {}) {
			const [found] = sortRows(
				rows.filter((row) => matches(row, where)),
				orderBy,
			);
			return found ? project(found, select) : null;
		},
		findUnique({ where, select } = {}) {
			const found = rows.find((row) => matches(row, where));
			return found ? project(found, select) : null;
		},
		create({ data } = {}) {
			const row = { ...data };
			rows.push(row);
			return { ...row };
		},
		update({ where, data } = {}) {
			const row = rows.find((candidate) => matches(candidate, where));
			if (!row) {
				throw new Error(`no row for ${JSON.stringify(where)}`);
			}
			Object.assign(row, data);
			return { ...row };
		},
		upsert({ where, create, update } = {}) {
			const row = rows.find((candidate) => matches(candidate, where));
			if (row) {
				Object.assign(row, update?.data ?? {});
				return { ...row };
			}
			const created = { ...(create?.data ?? {}) };
			rows.push(created);
			return { ...created };
		},
		delete({ where } = {}) {
			const index = rows.findIndex((candidate) => matches(candidate, where));
			if (index === -1) {
				throw new Error(`no row for ${JSON.stringify(where)}`);
			}
			const [removed] = rows.splice(index, 1);
			return { ...removed };
		},
		count({ where } = {}) {
			return rows.filter((row) => matches(row, where)).length;
		},
	};
}

const supportCase = collection(state.cases);
const supportCaseMessage = collection(state.messages);

// `getCaseWithMessages` asks for the case WITH its messages; that relation
// is the one the API's read route depends on.
supportCase.findUnique = ({ where, select, include } = {}) => {
	const row = state.cases.find((candidate) => matches(candidate, where));
	if (!row) {
		return null;
	}
	const out = project(row, select);
	if (include?.messages) {
		out.messages = sortRows(
			state.messages.filter((message) => message.case_id === row.id),
			include.messages.orderBy,
		).map((message) => ({ ...message }));
	}
	return out;
};

const prismaMock = {
	user: collection(state.users),
	document: collection(state.documents),
	supportCase,
	supportCaseMessage,
	supportCaseAttachment: collection(state.attachments),
	supportInvestigation: collection(state.investigations),
	$transaction: async (fn) => fn(prismaMock),
};

jest.unstable_mockModule("../../server/utils/prisma.js", () => ({ default: prismaMock }));

// The investigation queue belongs to Workstream 2 and is NOT part of Workstream
// 1 - Workstream 1 is integrated (and gated) before Workstream 2 lands. The
// queue is therefore mocked only when it exists; the routes must not need it
// to be present to answer a message.
const QUEUE_MODULE_PATH = "../../server/services/investigationQueue.js";
const queueModuleExists = fs.existsSync(
	fileURLToPath(new URL("../../server/services/investigationQueue.js", import.meta.url)),
);
const enqueueInvestigation = jest.fn(async () => {});
// The queue's capacity, so a test can make the queue look full. The queue
// refuses the job itself when the backlog is over the limit; the controller
// asks first, so the refusal reaches the client as a 429 instead of a case
// that sits in `investigating` with nothing running behind it.
let queueCapacityResult = { depth: 0, limit: 20, accepting: true };
if (queueModuleExists) {
	jest.unstable_mockModule(QUEUE_MODULE_PATH, () => ({
		enqueueInvestigation,
		queueDepth: () => 0,
		queueCapacity: () => queueCapacityResult,
	}));
}

const { signToken } = await import("../../server/middleware/auth.js");
const { realtimeBus, CASE_EVENTS, caseEventChannel, emitCaseEvent } = await import(
	"../../server/realtime/realtimeBus.js"
);
const {
	answerClarification,
	FALLBACK_CLARIFYING_QUESTION,
	READY_REPLY,
	resetClarificationProvider,
	setClarificationProvider,
} = await import("../../server/services/caseConversationService.js");
const caseRoutes = (await import("../../server/routes/caseRoutes.js")).default;

// --- fixtures ---------------------------------------------------------------
const OWNER = { id: "case-owner", role: "buyer", email: "owner@x.com" };
const STRANGER = { id: "case-stranger", role: "buyer", email: "stranger@x.com" };
const ADMIN = { id: "case-admin", role: "admin", email: "admin@x.com" };

const AUTH = {
	owner: { Authorization: `Bearer ${signToken(OWNER)}` },
	stranger: { Authorization: `Bearer ${signToken(STRANGER)}` },
	admin: { Authorization: `Bearer ${signToken(ADMIN)}` },
};

function buildApp() {
	const app = express();
	app.use(express.json());
	app.use("/api/support/cases", caseRoutes);
	return app;
}

// contracts.md §3 fixes the RESPONSE BODIES of the six routes but not their
// success status codes, and the conventional status for "created" is 201
// while the rest of this repo's routes answer 200. Both are accepted, so the
// test pins the contract - the body and the ownership rule - and not a
// detail the contract leaves open.
function expectSuccess(res) {
	// biome-ignore lint/suspicious/noMisplacedAssertion: runs inside the caller
	expect([200, 201]).toContain(res.status);
}

async function createCase(subject = "Checkout fails") {
	const res = await request(buildApp())
		.post("/api/support/cases")
		.set(AUTH.owner)
		.send({ subject });
	// biome-ignore lint/suspicious/noMisplacedAssertion: the assertions run inside the test that called this helper
	expectSuccess(res);
	// biome-ignore lint/suspicious/noMisplacedAssertion: the assertions run inside the test that called this helper
	expect(res.body.case).toMatchObject({ user_id: OWNER.id });
	return res.body.case;
}

function postMessage(caseId, content, auth = AUTH.owner) {
	return request(buildApp())
		.post(`/api/support/cases/${caseId}/messages`)
		.set(auth)
		.send({ content });
}

// --- the event stream -------------------------------------------------------
//
// The stream is a plain HTTP response that never ends, so supertest is the
// wrong tool for it: it waits for the response to finish. A raw http request
// against an ephemeral port is used instead, so the test can read the frames
// as they arrive and then hang up.
function openStream(path, headers = {}) {
	const server = http.createServer(buildApp());
	return new Promise((resolve, reject) => {
		server.listen(0, "127.0.0.1", () => {
			const { port } = server.address();
			let body = "";
			const waiters = [];

			const checkWaiters = () => {
				for (let index = waiters.length - 1; index >= 0; index -= 1) {
					const waiter = waiters[index];
					if (!waiter.predicate(body)) {
						continue;
					}
					clearTimeout(waiter.timer);
					waiters.splice(index, 1);
					waiter.resolve(body);
				}
			};

			const clientRequest = http.request(
				{ host: "127.0.0.1", port, path, method: "GET", headers },
				(response) => {
					response.setEncoding("utf8");
					response.on("data", (chunk) => {
						body += chunk;
						checkWaiters();
					});
					resolve({
						status: response.statusCode,
						headers: response.headers,
						get body() {
							return body;
						},
						waitFor(predicate, timeoutMs = 5000) {
							if (predicate(body)) {
								return Promise.resolve(body);
							}
							return new Promise((resolveWait, rejectWait) => {
								const waiter = {
									predicate,
									resolve: resolveWait,
									reject: rejectWait,
									timer: setTimeout(() => {
										const index = waiters.indexOf(waiter);
										if (index !== -1) {
											waiters.splice(index, 1);
										}
										rejectWait(
											new Error(`the stream never carried the expected frame; body was:\n${body}`),
										);
									}, timeoutMs),
								};
								waiters.push(waiter);
							});
						},
						close() {
							clientRequest.destroy();
							server.closeAllConnections?.();
							server.close();
						},
					});
				},
			);
			clientRequest.on("error", reject);
			clientRequest.end();
		});
	});
}

// The one frame of the stream that carries a given event type.
function frameOf(body, type) {
	return body.split("\n\n").find((chunk) => chunk.includes(`event: ${type}`));
}

beforeEach(() => {
	state.users.length = 0;
	state.users.push(
		{ ...OWNER, status: "active", password_reset_at: null },
		{ ...STRANGER, status: "active", password_reset_at: null },
		{ ...ADMIN, status: "active", password_reset_at: null },
	);
	state.cases.length = 0;
	state.messages.length = 0;
	state.attachments.length = 0;
	state.investigations.length = 0;
	state.documents.length = 0;
	enqueueInvestigation.mockClear();
	queueCapacityResult = { depth: 0, limit: 20, accepting: true };
	// The rate limiter counts in module state, so every test starts with an
	// empty budget. Otherwise the first test that spends the budget decides
	// what every later test sees.
	resetRateLimitCounters();
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
});

// --- the contract in contracts.md §3 ---------------------------------------
describe("support case API (real router, real controller)", () => {
	test("a second user gets 403 on the case and on its messages", async () => {
		const created = await createCase();

		const read = await request(buildApp())
			.get(`/api/support/cases/${created.id}`)
			.set(AUTH.stranger);
		expect(read.status).toBe(403);
		expect(typeof read.body.error).toBe("string");

		const write = await postMessage(created.id, "can you look at this?", AUTH.stranger);
		expect(write.status).toBe(403);
		expect(typeof write.body.error).toBe("string");

		// The refusal must not have written anything: the case is still the
		// owner's, and the transcript is untouched.
		const after = await request(buildApp())
			.get(`/api/support/cases/${created.id}`)
			.set(AUTH.owner)
			.expect(200);
		expect(after.body.messages).toHaveLength(0);
	});

	test("the owner can read the case and post to it", async () => {
		const created = await createCase();

		const read = await request(buildApp())
			.get(`/api/support/cases/${created.id}`)
			.set(AUTH.owner)
			.expect(200);
		expect(read.body.case).toMatchObject({ id: created.id, user_id: OWNER.id });
		expect(Array.isArray(read.body.messages)).toBe(true);

		const posted = await postMessage(created.id, "The total is wrong at checkout");
		expectSuccess(posted);
		expect(posted.body.message).toMatchObject({
			case_id: created.id,
			role: "client",
			content: "The total is wrong at checkout",
		});
		// contracts.md §3: `reply` is the assistant's SupportCaseMessage row,
		// not the text of the reply. The text is its `content`.
		expect(posted.body.reply).toMatchObject({
			case_id: created.id,
			role: "assistant",
		});
		expect(typeof posted.body.reply.content).toBe("string");
		expect(posted.body.reply.content.length).toBeGreaterThan(0);
		expect(posted.body.ready).toBe(false);
	});

	test("the owner sees only their own cases in the list", async () => {
		const mine = await createCase("Mine");

		const list = await request(buildApp()).get("/api/support/cases").set(AUTH.owner).expect(200);
		expect(Array.isArray(list.body.cases)).toBe(true);
		expect(list.body.cases.map((row) => row.id)).toEqual([mine.id]);

		const strangerList = await request(buildApp())
			.get("/api/support/cases")
			.set(AUTH.stranger)
			.expect(200);
		expect(strangerList.body.cases).toHaveLength(0);
	});

	test("ready is true after 6 client messages", async () => {
		const created = await createCase();

		for (let round = 1; round <= 5; round += 1) {
			const res = await postMessage(created.id, `Answer number ${round}`);
			expectSuccess(res);
			expect(res.body.ready).toBe(false);
		}

		const sixth = await postMessage(created.id, "Answer number 6");
		expectSuccess(sixth);
		expect(sixth.body.ready).toBe(true);
	});

	test("confirming the summary moves the case to investigating", async () => {
		const created = await createCase();

		const confirmed = await request(buildApp())
			.post(`/api/support/cases/${created.id}/confirm`)
			.set(AUTH.owner)
			.expect(200);
		expect(confirmed.body.case).toMatchObject({ id: created.id, status: "investigating" });
	});

	// The route serves TWO intents: "start the investigation" and "this
	// report is accurate". The second one arrives when the case is `reporting`
	// or `completed`, and it must not restart anything - a literal
	// implementation would rewrite the status to `investigating` and
	// overwrite the summary the investigation was run under.
	test("confirming a case that is already being investigated changes nothing", async () => {
		const created = await createCase();

		const first = await request(buildApp())
			.post(`/api/support/cases/${created.id}/confirm`)
			.set(AUTH.owner)
			.expect(200);
		expect(first.body.case).toMatchObject({ id: created.id, status: "investigating" });
		const summary = first.body.case.summary;
		expect(typeof summary).toBe("string");

		const queued = enqueueInvestigation.mock.calls.length;

		const again = await request(buildApp())
			.post(`/api/support/cases/${created.id}/confirm`)
			.set(AUTH.owner)
			.expect(200);

		expect(again.body.case).toMatchObject({ id: created.id, status: "investigating" });
		expect(again.body.case.summary).toBe(summary);
		// No second investigation was queued for the same case.
		expect(enqueueInvestigation.mock.calls.length).toBe(queued);
	});

	test("confirming a finished case is an acknowledgement, not a restart", async () => {
		const created = await createCase();

		await request(buildApp())
			.post(`/api/support/cases/${created.id}/confirm`)
			.set(AUTH.owner)
			.expect(200);

		// The investigation finished and the report is on its way.
		const row = state.cases.find((candidate) => candidate.id === created.id);
		row.status = "completed";
		row.summary = "the summary the finished investigation was run under";

		const queued = enqueueInvestigation.mock.calls.length;

		const again = await request(buildApp())
			.post(`/api/support/cases/${created.id}/confirm`)
			.set(AUTH.owner)
			.expect(200);

		expect(again.body.case).toMatchObject({
			id: created.id,
			status: "completed",
			summary: "the summary the finished investigation was run under",
		});
		// The case did not go back to `investigating`, and the summary it was
		// investigated under survived.
		expect(row.status).toBe("completed");
		expect(row.summary).toBe("the summary the finished investigation was run under");
		expect(enqueueInvestigation.mock.calls.length).toBe(queued);
	});

	test("an owner/admin may read another client's case; a buyer may not", async () => {
		const created = await createCase();

		await request(buildApp()).get(`/api/support/cases/${created.id}`).set(AUTH.admin).expect(200);
		await request(buildApp())
			.get(`/api/support/cases/${created.id}`)
			.set(AUTH.stranger)
			.expect(403);
	});
});

// --- the cost of a case ------------------------------------------------------
//
// A case is not a cheap request. It can spawn an opencode process, write
// five database rows, mail every owner and admin and raise a staff
// notification. The case API used to be `requireAuth` and nothing else, so
// one client could open cases without limit and fill the investigation
// queue with work nobody asked for.
describe("the cost of a case", () => {
	test("the write routes are rate limited per user", async () => {
		const created = await createCase();

		let refused = null;
		// The write budget is 30 a minute. The limiter counts the CALLER, so
		// the requests below are all the same user.
		for (let attempt = 0; attempt < 60; attempt += 1) {
			// biome-ignore lint: the requests are deliberately sequential
			const res = await postMessage(created.id, `Answer number ${attempt}`);
			if (res.status === 429) {
				refused = res;
				break;
			}
		}

		expect(refused).not.toBeNull();
		expect(refused.status).toBe(429);
		expect(typeof refused.body.error).toBe("string");
	});

	test("the rate limit is counted per user, not per address", async () => {
		const created = await createCase();

		let refused = null;
		for (let attempt = 0; attempt < 60; attempt += 1) {
			// biome-ignore lint: the requests are deliberately sequential
			const res = await postMessage(created.id, "Answer", AUTH.owner);
			if (res.status === 429) {
				refused = res;
				break;
			}
		}
		expect(refused).not.toBeNull();

		// The other user is not affected by the owner's budget.
		const other = await request(buildApp()).get("/api/support/cases").set(AUTH.stranger);
		expect(other.status).toBe(200);
	});

	test("a full investigation queue is refused with a clear 429", async () => {
		const created = await createCase();
		queueCapacityResult = { depth: 20, limit: 20, accepting: false };

		const confirmed = await request(buildApp())
			.post(`/api/support/cases/${created.id}/confirm`)
			.set(AUTH.owner);

		expect(confirmed.status).toBe(429);
		expect(String(confirmed.body.error)).toMatch(/queue is full/i);
		expect(String(confirmed.body.error)).toMatch(/try again shortly/i);
	});

	test("a refused case is left where it was", async () => {
		const created = await createCase();
		queueCapacityResult = { depth: 20, limit: 20, accepting: false };

		await request(buildApp())
			.post(`/api/support/cases/${created.id}/confirm`)
			.set(AUTH.owner)
			.expect(429);

		const row = state.cases.find((candidate) => candidate.id === created.id);
		expect(row.status).toBe("collecting");
		expect(enqueueInvestigation).not.toHaveBeenCalled();
	});

	test("one user cannot open more cases than the cap allows", async () => {
		for (let index = 0; index < 10; index += 1) {
			// biome-ignore lint: the cases are deliberately sequential
			const res = await request(buildApp())
				.post("/api/support/cases")
				.set(AUTH.owner)
				.send({ subject: `Case ${index}` });
			expectSuccess(res);
		}

		const refused = await request(buildApp())
			.post("/api/support/cases")
			.set(AUTH.owner)
			.send({ subject: "One too many" });

		expect(refused.status).toBe(429);
		expect(String(refused.body.error)).toMatch(/open support cases/i);
	});

	test("a closed case does not count against the cap", async () => {
		for (let index = 0; index < 10; index += 1) {
			// biome-ignore lint: the cases are deliberately sequential
			await request(buildApp())
				.post("/api/support/cases")
				.set(AUTH.owner)
				.send({ subject: `Case ${index}` });
		}
		// One of them is finished, so it is not open any more.
		state.cases[0].status = "completed";

		const res = await request(buildApp())
			.post("/api/support/cases")
			.set(AUTH.owner)
			.send({ subject: "Now there is room" });

		expectSuccess(res);
	});
});

// --- the contract in contracts.md §4 ---------------------------------------
describe("case events on the realtime bus", () => {
	test("a posted message produces a support.case.message event", async () => {
		const created = await createCase();
		const events = [];
		const listener = (payload) => events.push(payload);
		const channel = caseEventChannel(CASE_EVENTS.message, created.id);
		realtimeBus.on(channel, listener);

		try {
			const posted = await postMessage(created.id, "The upload button does nothing");
			expectSuccess(posted);

			const mine = events.filter((event) => event.caseId === created.id);
			expect(mine.length).toBeGreaterThan(0);
			const clientEvent = mine.find((event) => event.message?.id === posted.body.message?.id);
			expect(clientEvent).toBeDefined();
			expect(clientEvent.message).toMatchObject({
				case_id: created.id,
				role: "client",
				content: "The upload button does nothing",
			});
		} finally {
			realtimeBus.off(channel, listener);
		}
	});

	test("a case that starts being investigated fires a support.case.status event", async () => {
		const created = await createCase();
		const events = [];
		const listener = (payload) => events.push(payload);
		const channel = caseEventChannel(CASE_EVENTS.status, created.id);
		realtimeBus.on(channel, listener);

		try {
			await request(buildApp())
				.post(`/api/support/cases/${created.id}/confirm`)
				.set(AUTH.owner)
				.expect(200);
			const mine = events.filter((event) => event.caseId === created.id);
			expect(mine.length).toBeGreaterThan(0);
			expect(mine.at(-1)).toMatchObject({ status: "investigating" });
			expect(typeof mine.at(-1).summary).toBe("string");
		} finally {
			realtimeBus.off(channel, listener);
		}
	});

	test("emitCaseEvent publishes each of the five fixed event types", () => {
		const seen = [];
		const listeners = Object.entries(CASE_EVENTS).map(([key, type]) => {
			const listener = (payload) => seen.push({ key, type, payload });
			const channel = caseEventChannel(type, "case-1");
			realtimeBus.on(channel, listener);
			return { channel, listener };
		});

		try {
			emitCaseEvent("case-1", CASE_EVENTS.message, { message: { id: "m1" } });
			emitCaseEvent("case-1", CASE_EVENTS.status, { status: "investigating" });
			emitCaseEvent("case-1", CASE_EVENTS.progress, { role: "code", status: "running" });
			emitCaseEvent("case-1", CASE_EVENTS.finding, { role: "code", finding: { detail: "x" } });
			emitCaseEvent("case-1", CASE_EVENTS.report, { report: "# report", reportStatus: "ready" });

			expect(seen.map((entry) => entry.key)).toEqual([
				"message",
				"status",
				"progress",
				"finding",
				"report",
			]);
			for (const entry of seen) {
				expect(entry.payload.caseId).toBe("case-1");
			}
			expect(seen[0].payload.message).toEqual({ id: "m1" });
			expect(seen[1].payload.status).toBe("investigating");
			expect(seen[2].payload).toMatchObject({ role: "code", status: "running" });
			expect(seen[3].payload.finding).toEqual({ detail: "x" });
			expect(seen[4].payload).toMatchObject({ report: "# report", reportStatus: "ready" });
		} finally {
			for (const { channel, listener } of listeners) {
				realtimeBus.off(channel, listener);
			}
		}
	});

	// The report payload is the whole Markdown report. Published on a
	// process-global channel, every listener on that channel - today or in
	// future - receives every case's report body. It is published on the
	// case's own channel instead.
	test("a report event does not reach a listener on the bare event type", () => {
		const seen = [];
		const listener = (payload) => seen.push(payload);
		realtimeBus.on(CASE_EVENTS.report, listener);

		try {
			emitCaseEvent("case-1", CASE_EVENTS.report, { report: "# secret report" });
			emitCaseEvent("case-2", CASE_EVENTS.report, { report: "# another report" });

			expect(seen).toHaveLength(0);
		} finally {
			realtimeBus.off(CASE_EVENTS.report, listener);
		}
	});

	test("a report event reaches a listener on that case's channel", () => {
		const seen = [];
		const listener = (payload) => seen.push(payload);
		const channel = caseEventChannel(CASE_EVENTS.report, "case-1");
		realtimeBus.on(channel, listener);

		try {
			emitCaseEvent("case-1", CASE_EVENTS.report, { report: "# secret report" });
			emitCaseEvent("case-2", CASE_EVENTS.report, { report: "# another report" });

			expect(seen).toHaveLength(1);
			expect(seen[0].report).toBe("# secret report");
		} finally {
			realtimeBus.off(channel, listener);
		}
	});

	test("emitCaseEvent ignores a missing case or type", () => {
		const seen = [];
		const listener = (payload) => seen.push(payload);
		const channel = caseEventChannel(CASE_EVENTS.message, "case-1");
		realtimeBus.on(channel, listener);
		try {
			emitCaseEvent("", CASE_EVENTS.message, { message: { id: "m1" } });
			emitCaseEvent("case-1", "", { message: { id: "m1" } });
			expect(seen).toHaveLength(0);
		} finally {
			realtimeBus.off(channel, listener);
		}
	});
});

// --- the case event stream (contracts.md §4's wire format) -----------------
describe("the case event stream", () => {
	test("a stranger is refused with a 403", async () => {
		const created = await createCase();
		const stream = await openStream(`/api/support/cases/${created.id}/stream`, AUTH.stranger);
		try {
			expect(stream.status).toBe(403);
		} finally {
			stream.close();
		}
	});

	test("an unknown case is a 404", async () => {
		const stream = await openStream("/api/support/cases/no-such-case/stream", AUTH.owner);
		try {
			expect(stream.status).toBe(404);
		} finally {
			stream.close();
		}
	});

	test("the owner gets an event stream with the retry hint on it", async () => {
		const created = await createCase();
		const stream = await openStream(`/api/support/cases/${created.id}/stream`, AUTH.owner);
		try {
			expect(stream.status).toBe(200);
			expect(stream.headers["content-type"]).toContain("text/event-stream");
			await stream.waitFor((body) => body.includes("retry: 3000"));
			expect(stream.body).toContain("retry: 3000");
		} finally {
			stream.close();
		}
	});

	// The wire format of contracts.md §4:
	//
	//   event: support.case.message
	//   data: {"caseId":"<case id>","message":{...}}
	//
	// so the frame names one of the five fixed types and the envelope always
	// carries the case id.
	test("an event arrives as a frame whose envelope carries the case id", async () => {
		const created = await createCase();
		const stream = await openStream(`/api/support/cases/${created.id}/stream`, AUTH.owner);
		try {
			emitCaseEvent(created.id, CASE_EVENTS.message, {
				message: { id: "m-1", role: "client", content: "hello" },
			});
			const body = await stream.waitFor((text) => frameOf(text, CASE_EVENTS.message));

			const frame = frameOf(body, CASE_EVENTS.message);
			expect(frame).toBeDefined();
			expect(frame).toMatch(/^id: \d+\nevent: support\.case\.message\ndata: \{/);

			const data = JSON.parse(frame.split("data: ")[1]);
			expect(data.caseId).toBe(created.id);
			expect(data.message).toMatchObject({ id: "m-1", role: "client" });
		} finally {
			stream.close();
		}
	});

	// The bus is shared by every case, so the stream has to drop the events
	// that belong to another one.
	test("an event for another case is not forwarded", async () => {
		const created = await createCase();
		const other = await createCase("Another case");
		const stream = await openStream(`/api/support/cases/${created.id}/stream`, AUTH.owner);
		try {
			// A frame for THIS case first, so the stream is known to be live.
			emitCaseEvent(created.id, CASE_EVENTS.message, { message: { id: "mine" } });
			await stream.waitFor((text) => frameOf(text, CASE_EVENTS.message));

			emitCaseEvent(other.id, CASE_EVENTS.status, { status: "investigating" });
			await new Promise((resolve) => setTimeout(resolve, 50));

			expect(frameOf(stream.body, CASE_EVENTS.status)).toBeUndefined();
		} finally {
			stream.close();
		}
	});

	// A closed stream must not leave a listener on the bus, or every case
	// that ever streamed would keep the process alive.
	test("the stream stops listening when the client hangs up", async () => {
		const created = await createCase();
		const channel = caseEventChannel(CASE_EVENTS.message, created.id);
		const before = realtimeBus.listenerCount(channel);
		const stream = await openStream(`/api/support/cases/${created.id}/stream`, AUTH.owner);
		expect(realtimeBus.listenerCount(channel)).toBe(before + 1);

		stream.close();
		await new Promise((resolve) => setTimeout(resolve, 50));
		expect(realtimeBus.listenerCount(channel)).toBe(before);
	});
});

// --- the clarification answerer (ws1-brief Part 3C) -----------------------
//
// The service has three promises, and each of them is a promise about what
// does NOT happen: it does not throw, it does not hang, and it does not
// invent readiness. Each one gets its own test, because a service that only
// answers when the provider is healthy is not the service the intake path
// needs.
describe("the clarification answerer (server/services/caseConversationService.js)", () => {
	afterEach(() => {
		resetClarificationProvider();
	});

	test("with no provider configured it asks the fixed question and is not ready", async () => {
		const answer = await answerClarification({
			subject: "Checkout fails",
			messages: [{ role: "client", content: "The total is wrong" }],
		});
		expect(answer).toEqual({ reply: FALLBACK_CLARIFYING_QUESTION, ready: false });
	});

	test("a provider that throws falls back instead of failing the request", async () => {
		setClarificationProvider(() => Promise.reject(new Error("provider is down")));
		const answer = await answerClarification({
			subject: "Checkout fails",
			messages: [{ role: "client", content: "The total is wrong" }],
		});
		expect(answer).toEqual({ reply: FALLBACK_CLARIFYING_QUESTION, ready: false });
	});

	test("a provider that never answers does not hang the request", async () => {
		const previous = process.env.CASE_AI_TIMEOUT_MS;
		process.env.CASE_AI_TIMEOUT_MS = "150";
		setClarificationProvider(() => new Promise(() => {}));
		try {
			const answer = await answerClarification({
				subject: "Checkout fails",
				messages: [{ role: "client", content: "The total is wrong" }],
			});
			expect(answer).toEqual({ reply: FALLBACK_CLARIFYING_QUESTION, ready: false });
		} finally {
			if (previous === undefined) {
				delete process.env.CASE_AI_TIMEOUT_MS;
			} else {
				process.env.CASE_AI_TIMEOUT_MS = previous;
			}
		}
	});

	test("a provider's answer is used when it works", async () => {
		const provider = jest.fn(async () => "Which browser were you using?");
		setClarificationProvider(provider);
		const answer = await answerClarification({
			subject: "Checkout fails",
			messages: [{ role: "client", content: "The total is wrong" }],
		});
		expect(answer).toEqual({ reply: "Which browser were you using?", ready: false });
		expect(provider).toHaveBeenCalledTimes(1);
		// The prompt must carry the case subject and the client's own words,
		// or the question is asked blind.
		const [prompt, systemPrompt] = provider.mock.calls[0];
		expect(prompt).toContain("Checkout fails");
		expect(prompt).toContain("The total is wrong");
		expect(typeof systemPrompt).toBe("string");
		expect(systemPrompt.length).toBeGreaterThan(0);
	});

	test("a ready case gets the hand-over notice and no question", async () => {
		const provider = jest.fn(async () => "Which browser were you using?");
		setClarificationProvider(provider);
		const answer = await answerClarification({
			subject: "Checkout fails",
			messages: [{ role: "client", content: "The total is wrong" }],
			ready: true,
		});
		expect(answer).toEqual({ reply: READY_REPLY, ready: true });
		expect(provider).not.toHaveBeenCalled();
	});

	test("the round cap is read from the transcript when the caller does not say", async () => {
		const history = Array.from({ length: 6 }, (_unused, index) => ({
			role: "client",
			content: `Answer ${index + 1}`,
		}));
		const answer = await answerClarification({ subject: "Checkout fails", messages: history });
		expect(answer.ready).toBe(true);
	});
});
