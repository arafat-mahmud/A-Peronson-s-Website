import { jest } from "@jest/globals";

// The case service is the persistence half of the support portal: the case
// itself, the messages in it, and the attachment rows that hang off it. The
// sequence number is the thing that matters most here — the transcript is
// ordered by it, so two messages sharing a number would make the order
// ambiguous.

const supportCaseCreate = jest.fn(async (args) => ({ id: "case-1", ...args.data }));
const supportCaseFindMany = jest.fn(async () => []);
const supportCaseFindUnique = jest.fn(async () => null);
const supportCaseDelete = jest.fn(async () => ({ id: "case-1" }));
const messageFindFirst = jest.fn(async () => null);
const messageCreate = jest.fn(async (args) => ({ id: "m1", ...args.data }));
const attachmentFindMany = jest.fn(async () => []);

const transaction = jest.fn(async (fn) =>
	fn({
		supportCaseMessage: { findFirst: messageFindFirst, create: messageCreate },
		// deleteCase runs its read and its delete inside ONE transaction, so
		// the transaction's client has to carry the models it touches. Without
		// them the delete path would throw a TypeError instead of reaching
		// its assertions.
		supportCase: { findUnique: supportCaseFindUnique, delete: supportCaseDelete },
		supportCaseAttachment: { findMany: attachmentFindMany },
	}),
);

jest.unstable_mockModule("../../server/utils/prisma.js", () => ({
	default: {
		supportCase: {
			create: supportCaseCreate,
			findMany: supportCaseFindMany,
			findUnique: supportCaseFindUnique,
			delete: supportCaseDelete,
		},
		supportCaseMessage: { findFirst: messageFindFirst, create: messageCreate },
		supportCaseAttachment: { findMany: attachmentFindMany },
		$transaction: transaction,
	},
}));

const {
	appendCaseMessage,
	createCase,
	deleteCase,
	getCaseWithMessages,
	listCasesAdmin,
	listCasesForUser,
} = await import("../../server/services/caseService.js");

beforeEach(() => {
	supportCaseCreate.mockClear();
	supportCaseFindMany.mockClear();
	supportCaseFindUnique.mockClear();
	supportCaseDelete.mockClear();
	messageFindFirst.mockReset();
	messageFindFirst.mockResolvedValue(null);
	messageCreate.mockClear();
	attachmentFindMany.mockReset();
	attachmentFindMany.mockResolvedValue([]);
	transaction.mockClear();
});

describe("createCase", () => {
	test("opens the case in the collecting state", async () => {
		await createCase({ userId: "client-1", subject: "Checkout is broken" });
		expect(supportCaseCreate).toHaveBeenCalledTimes(1);
		const data = supportCaseCreate.mock.calls[0][0].data;
		expect(data).toMatchObject({
			user_id: "client-1",
			status: "collecting",
			subject: "Checkout is broken",
		});
		expect(String(data.id)).toBeTruthy();
	});

	test("a case with no subject still opens", async () => {
		await createCase({ userId: "client-1" });
		const data = supportCaseCreate.mock.calls[0][0].data;
		expect(data.subject).toBeNull();
		expect(data.status).toBe("collecting");
	});

	// A case with no owner is a case nobody can list, find or delete by
	// owner. It is refused rather than written.
	test("refuses to open a case with no owner", async () => {
		await expect(createCase({ userId: "  " })).rejects.toThrow(/userId/);
		expect(supportCaseCreate).not.toHaveBeenCalled();
	});
});

describe("appendCaseMessage", () => {
	test("the first message of a case is sequence 1", async () => {
		messageFindFirst.mockResolvedValue(null);
		await appendCaseMessage({ caseId: "case-1", role: "user", content: "hello" });
		expect(messageCreate.mock.calls[0][0].data).toMatchObject({
			case_id: "case-1",
			role: "user",
			kind: "answer",
			content: "hello",
			sequence: 1,
		});
	});

	test("the sequence continues from the last message", async () => {
		messageFindFirst.mockResolvedValue({ sequence: 4 });
		await appendCaseMessage({ caseId: "case-1", role: "assistant", content: "an answer" });
		expect(messageCreate.mock.calls[0][0].data.sequence).toBe(5);
	});

	// The sequence is allocated from the last message's number, so two
	// appends that race would read the same number and both write it. The
	// allocation therefore has to be inside a transaction.
	test("allocates the sequence inside a transaction", async () => {
		await appendCaseMessage({ caseId: "case-1", role: "user", content: "hello" });
		expect(transaction).toHaveBeenCalledTimes(1);
	});

	test("reads the last sequence of the case, highest first", async () => {
		await appendCaseMessage({ caseId: "case-1", role: "user", content: "hello" });
		expect(messageFindFirst.mock.calls[0][0]).toMatchObject({
			where: { case_id: "case-1" },
			orderBy: { sequence: "desc" },
		});
	});
});

describe("getCaseWithMessages", () => {
	test("reads the case with its messages, oldest first", async () => {
		await getCaseWithMessages("case-1");
		expect(supportCaseFindUnique).toHaveBeenCalledWith({
			where: { id: "case-1" },
			include: { messages: { orderBy: { sequence: "asc" } } },
		});
	});
});

describe("listCasesForUser", () => {
	test("lists only the cases that user opened", async () => {
		await listCasesForUser("client-1");
		expect(supportCaseFindMany).toHaveBeenCalledWith({
			where: { user_id: "client-1" },
			orderBy: { updated_at: "desc" },
		});
	});
});

describe("listCasesAdmin", () => {
	test("lists every case, most recently touched first", async () => {
		await listCasesAdmin();
		expect(supportCaseFindMany).toHaveBeenCalledWith({ orderBy: { updated_at: "desc" } });
	});
});

describe("deleteCase", () => {
	beforeEach(() => {
		// The case is there unless a test says otherwise: the delete reads the
		// row first and returns an empty list when it is not.
		supportCaseFindUnique.mockReset();
		supportCaseFindUnique.mockResolvedValue({ id: "case-1" });
	});

	test("returns the attachments it removed", async () => {
		attachmentFindMany.mockResolvedValue([
			{ id: "att-1", case_id: "case-1", file_path: "/uploads/support/a.png" },
			{ id: "att-2", case_id: "case-1", file_path: "/uploads/support/b.png" },
		]);
		const removed = await deleteCase("case-1");
		expect(removed).toHaveLength(2);
		expect(supportCaseDelete).toHaveBeenCalledWith({ where: { id: "case-1" } });
	});

	// The attachment rows go with the case (the relation cascades), so the
	// caller gets them back to clean up the bytes and the Document rows that
	// anchor them — the database cannot remove those.
	test("collects the attachments before the case goes", async () => {
		attachmentFindMany.mockResolvedValue([]);
		await deleteCase("case-1");
		expect(attachmentFindMany).toHaveBeenCalledWith({ where: { case_id: "case-1" } });
	});

	// A case that is not there is not an error: the contract says this
	// returns the attachments, and a missing case has none.
	// prisma.supportCase.delete raises P2025 for a missing row, so the row is
	// read first.
	test("returns an empty list for a case that is not there", async () => {
		supportCaseFindUnique.mockResolvedValue(null);
		const removed = await deleteCase("case-missing");
		expect(removed).toEqual([]);
		expect(supportCaseDelete).not.toHaveBeenCalled();
	});

	// A case deleted by somebody else between the read and the delete makes
	// Prisma raise P2025. That is not a failure either: the attachments went
	// with the case, so there is nothing left to clean up.
	test("returns an empty list when the case was deleted concurrently", async () => {
		supportCaseFindUnique.mockResolvedValue({ id: "case-1" });
		supportCaseDelete.mockImplementationOnce(async () => {
			const error = new Error("Record to delete does not exist.");
			error.code = "P2025";
			throw error;
		});
		const removed = await deleteCase("case-1");
		expect(removed).toEqual([]);
	});

	// Without one transaction a concurrent delete can slip between the read
	// and the delete, and the attachment list is lost.
	test("reads and deletes inside one transaction", async () => {
		attachmentFindMany.mockResolvedValue([]);
		await deleteCase("case-1");
		expect(transaction).toHaveBeenCalledTimes(1);
	});
});
