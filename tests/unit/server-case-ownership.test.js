import { jest } from "@jest/globals";

// The ownership rules of a support case and the round cap that ends the
// clarification loop.
//
// Two things are checked here. First: who may read a case — the client who
// opened it, or the staff who answer for the platform — and, just as
// important, who may NOT: a stranger gets a plain `false` so the controller
// can answer 403 instead of leaking the case's existence. Second: the
// count of the client's own turns, which is what the clarification cap is
// measured against.

const messageCount = jest.fn(async () => 0);

jest.unstable_mockModule("../../server/utils/prisma.js", () => ({
	default: {
		supportCaseMessage: { count: messageCount },
	},
}));

const { MAX_CLARIFICATION_ROUNDS, canReadCase, countClientMessages } = await import(
	"../../server/services/caseService.js"
);

const caseRow = { id: "case-1", user_id: "client-1", status: "collecting" };

beforeEach(() => {
	messageCount.mockReset();
	messageCount.mockResolvedValue(0);
});

describe("canReadCase", () => {
	// A case that does not exist is readable by nobody. Staff included: there
	// is nothing to give them, and answering "yes" here would have the
	// controller look up a case that does not exist.
	test("is false for a case that does not exist", () => {
		expect(canReadCase({ id: "client-1", role: "client" }, null)).toBe(false);
		expect(canReadCase({ id: "admin-1", role: "admin" }, null)).toBe(false);
		expect(canReadCase(null, null)).toBe(false);
	});

	test("is true for the client who opened the case", () => {
		expect(canReadCase({ id: "client-1", role: "client" }, caseRow)).toBe(true);
	});

	// Another signed-in user asking for someone else's case is refused.
	test("is false for a stranger", () => {
		expect(canReadCase({ id: "client-2", role: "client" }, caseRow)).toBe(false);
	});

	test("is true for an owner or an admin", () => {
		expect(canReadCase({ id: "owner-1", role: "owner" }, caseRow)).toBe(true);
		expect(canReadCase({ id: "admin-1", role: "admin" }, caseRow)).toBe(true);
	});

	// The role list belongs to server/utils/permissions.js. A member, an
	// agent or a partner are staff of one kind or another, and none of them
	// may read another client's case.
	test("is false for the other staff roles", () => {
		expect(canReadCase({ id: "member-1", role: "member" }, caseRow)).toBe(false);
		expect(canReadCase({ id: "agent-1", role: "agent" }, caseRow)).toBe(false);
		expect(canReadCase({ id: "factory-1", role: "factory" }, caseRow)).toBe(false);
	});

	// A caller with no session at all reads nothing, whatever the role says.
	test("is false for a caller with no identity", () => {
		expect(canReadCase(null, caseRow)).toBe(false);
		expect(canReadCase(undefined, caseRow)).toBe(false);
		expect(canReadCase({}, caseRow)).toBe(false);
	});

	// The id in the signed token and the id on the row are both text, but the
	// comparison is made as text so a token that carries the id in another
	// primitive type still matches its own case.
	test("matches the owner when the id arrives in another primitive type", () => {
		expect(canReadCase({ id: 42, role: "client" }, { user_id: "42" })).toBe(true);
		expect(canReadCase({ id: "42", role: "client" }, { user_id: 42 })).toBe(true);
	});

	// A row with no owner is nobody's case, and the empty string is not an
	// id that a token could carry.
	test("is false for a case with no owner", () => {
		expect(canReadCase({ id: "", role: "client" }, { user_id: "" })).toBe(false);
		expect(canReadCase({ id: "client-1", role: "client" }, { user_id: null })).toBe(false);
	});
});

describe("countClientMessages", () => {
	// A row written before the schema was fixed carries role "user" instead of
	// "client". Those rows still count toward the clarification round cap,
	// otherwise the cap would silently never fire for those cases.
	test("counts the client's own messages, including legacy 'user' rows", async () => {
		await countClientMessages("case-1");
		expect(messageCount).toHaveBeenCalledWith({
			where: { case_id: "case-1", role: { in: ["client", "user"] } },
		});
	});

	test("returns the number the database reports", async () => {
		messageCount.mockResolvedValue(4);
		await expect(countClientMessages("case-1")).resolves.toBe(4);
	});

	// A missing count is a zero, not a NaN: the round cap compares it.
	test("returns zero when the case has no messages", async () => {
		messageCount.mockResolvedValue(0);
		await expect(countClientMessages("case-1")).resolves.toBe(0);
	});
});

describe("MAX_CLARIFICATION_ROUNDS", () => {
	// The number the contract fixes. It is the point at which a case stops
	// waiting for a confirmation it is never going to get.
	test("is six", () => {
		expect(MAX_CLARIFICATION_ROUNDS).toBe(6);
	});
});
