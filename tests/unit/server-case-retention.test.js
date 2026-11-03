import fs from "node:fs/promises";
import path from "node:path";
import { jest } from "@jest/globals";

// The retention sweep is what stops the portal from keeping every case, every
// message and every uploaded byte forever. The rules are simple to state and
// easy to get subtly wrong, so the tests below are written around what must
// NOT happen as much as around what must:
//
//   - a live case (collecting / investigating) survives however old it is;
//   - a retained case survives however old it is;
//   - a case inside the retention window survives;
//   - a swept case loses its BYTES, not just its rows;
//   - a file the sweep did not resolve from a recorded attachment row is
//     never touched, however the recorded path is spelled.
//
// The file deletion runs against the real uploads tree, because "the bytes go
// from disk" is the property under test and a mocked filesystem would prove
// nothing about it.

const supportCaseFindMany = jest.fn(async () => []);
const supportCaseDelete = jest.fn(async () => ({ id: "case-1" }));
const supportCaseFindUnique = jest.fn(async ({ where } = {}) => ({ id: where?.id ?? "case-1" }));
const attachmentFindMany = jest.fn(async () => []);
const documentDeleteMany = jest.fn(async () => ({ count: 0 }));
const logInfo = jest.fn();
const logWarn = jest.fn();
const logError = jest.fn();

// The sweep removes the case through `caseService.deleteCase`, which reads
// the row and deletes it inside ONE transaction. The store under the sweep
// therefore has to offer the transaction and the read, or every sweep ends
// in an error and sweeps nothing.
const prismaMock = {
	supportCase: {
		findMany: supportCaseFindMany,
		delete: supportCaseDelete,
		findUnique: supportCaseFindUnique,
	},
	supportCaseAttachment: { findMany: attachmentFindMany },
	document: { deleteMany: documentDeleteMany },
	$transaction: async (fn) => fn(prismaMock),
};

jest.unstable_mockModule("../../server/utils/prisma.js", () => ({ default: prismaMock }));

jest.unstable_mockModule("../../server/utils/logger.js", () => ({
	logInfo,
	logWarn,
	logError,
	logDebug: jest.fn(),
	logSuccess: jest.fn(),
	logCritical: jest.fn(),
}));

const { sweepExpiredCases, retentionDays, shouldSweep } = await import(
	"../../server/workers/caseRetentionWorker.js"
);
const { uploadsRoot } = await import("../../server/utils/signedFileUrl.js");

const NOW = new Date("2026-10-21T12:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1000;
const SUPPORT_DIR = path.join(uploadsRoot(), "support");
const probes = [];

function daysAgo(days) {
	return new Date(NOW.getTime() - days * DAY_MS);
}

function caseRow(overrides = {}) {
	return {
		id: "case-1",
		user_id: "client-1",
		status: "completed",
		retain: false,
		created_at: daysAgo(120),
		updated_at: daysAgo(100),
		attachments: [],
		...overrides,
	};
}

/**
 * Writes a probe file and remembers it for cleanup.
 *
 * @param {string} name The file name.
 * @param {string} [dir] The directory. Defaults to the support namespace.
 * @returns {Promise<string>} The absolute path of the file.
 */
async function writeProbe(name, dir = SUPPORT_DIR) {
	await fs.mkdir(dir, { recursive: true });
	const target = path.join(dir, name);
	await fs.writeFile(target, "probe bytes", "utf8");
	probes.push(target);
	return target;
}

function stillThere(target) {
	return fs.stat(target).then(
		() => true,
		() => false,
	);
}

beforeEach(() => {
	supportCaseFindMany.mockReset();
	supportCaseFindMany.mockResolvedValue([]);
	supportCaseDelete.mockReset();
	supportCaseDelete.mockResolvedValue({ id: "case-1" });
	attachmentFindMany.mockReset();
	attachmentFindMany.mockResolvedValue([]);
	documentDeleteMany.mockReset();
	documentDeleteMany.mockResolvedValue({ count: 0 });
	logInfo.mockClear();
	logWarn.mockClear();
	logError.mockClear();
	delete process.env.CASE_RETENTION_DAYS;
});

afterEach(async () => {
	await Promise.all(probes.splice(0).map((target) => fs.rm(target, { force: true })));
});

afterAll(async () => {
	// Leave the tree the way it was found: the support namespace is created
	// for the probes and removed again when it is empty.
	try {
		const entries = await fs.readdir(SUPPORT_DIR);
		if (entries.length === 0) {
			await fs.rm(SUPPORT_DIR, { recursive: true, force: true });
		}
	} catch {
		// The directory never existed: nothing to clean up.
	}
});

describe("retentionDays", () => {
	test("defaults to 90 days", () => {
		expect(retentionDays()).toBe(90);
	});

	test("honours CASE_RETENTION_DAYS", () => {
		process.env.CASE_RETENTION_DAYS = "7";
		expect(retentionDays()).toBe(7);
	});

	// A broken value must not silently become "sweep everything" or "sweep
	// nothing": it falls back to the default window.
	test("falls back to the default when the value is unusable", () => {
		process.env.CASE_RETENTION_DAYS = "not-a-number";
		expect(retentionDays()).toBe(90);
		process.env.CASE_RETENTION_DAYS = "-5";
		expect(retentionDays()).toBe(90);
	});
});

describe("sweepExpiredCases", () => {
	test("sweeps an old terminal case and removes its bytes", async () => {
		const file = await writeProbe("old-case.png");
		supportCaseFindMany.mockResolvedValue([
			caseRow({
				attachments: [
					{ id: "att-1", case_id: "case-1", file_path: "/uploads/support/old-case.png" },
				],
			}),
		]);

		const result = await sweepExpiredCases(NOW);

		expect(result.swept).toBe(1);
		expect(supportCaseDelete).toHaveBeenCalledWith({ where: { id: "case-1" } });
		// The row is not the point: the bytes are the evidence.
		expect(await stillThere(file)).toBe(false);
	});

	test("returns the attachment paths it removed", async () => {
		await writeProbe("returned.png");
		supportCaseFindMany.mockResolvedValue([
			caseRow({
				attachments: [
					{ id: "att-1", case_id: "case-1", file_path: "/uploads/support/returned.png" },
				],
			}),
		]);

		const result = await sweepExpiredCases(NOW);

		expect(result.removed).toEqual(["/uploads/support/returned.png"]);
		expect(result.removedFiles).toHaveLength(1);
		expect(result.removedFiles[0]).toContain("returned.png");
	});

	test("does not sweep a live case, and keeps its bytes", async () => {
		const file = await writeProbe("live.png");
		supportCaseFindMany.mockResolvedValue([
			caseRow({
				id: "case-live",
				status: "collecting",
				attachments: [
					{ id: "att-1", case_id: "case-live", file_path: "/uploads/support/live.png" },
				],
			}),
		]);

		const result = await sweepExpiredCases(NOW);

		expect(result.swept).toBe(0);
		expect(result.skipped).toBe(1);
		expect(supportCaseDelete).not.toHaveBeenCalled();
		expect(await stillThere(file)).toBe(true);
	});

	test("does not sweep a case that is still being investigated", async () => {
		supportCaseFindMany.mockResolvedValue([
			caseRow({ id: "case-live-2", status: "investigating" }),
		]);

		const result = await sweepExpiredCases(NOW);

		expect(result.swept).toBe(0);
		expect(result.skipped).toBe(1);
		expect(supportCaseDelete).not.toHaveBeenCalled();
	});

	test("does not sweep a retained case, and keeps its bytes", async () => {
		const file = await writeProbe("retained.png");
		supportCaseFindMany.mockResolvedValue([
			caseRow({
				id: "case-retained",
				retain: true,
				attachments: [
					{ id: "att-1", case_id: "case-retained", file_path: "/uploads/support/retained.png" },
				],
			}),
		]);

		const result = await sweepExpiredCases(NOW);

		expect(result.swept).toBe(0);
		expect(result.skipped).toBe(1);
		expect(supportCaseDelete).not.toHaveBeenCalled();
		expect(await stillThere(file)).toBe(true);
	});

	test("does not sweep a case that is inside the retention window", async () => {
		const file = await writeProbe("recent.png");
		supportCaseFindMany.mockResolvedValue([
			caseRow({
				id: "case-recent",
				updated_at: daysAgo(10),
				attachments: [
					{ id: "att-1", case_id: "case-recent", file_path: "/uploads/support/recent.png" },
				],
			}),
		]);

		const result = await sweepExpiredCases(NOW);

		expect(result.swept).toBe(0);
		expect(result.skipped).toBe(1);
		expect(supportCaseDelete).not.toHaveBeenCalled();
		expect(await stillThere(file)).toBe(true);
	});

	test("a case exactly at the window edge is still inside it", async () => {
		supportCaseFindMany.mockResolvedValue([
			caseRow({ id: "case-edge", updated_at: new Date(NOW.getTime() - 90 * DAY_MS) }),
		]);

		const result = await sweepExpiredCases(NOW);

		expect(result.swept).toBe(0);
		expect(result.skipped).toBe(1);
	});

	test("asks the database only for cases older than the window", async () => {
		await sweepExpiredCases(NOW);
		expect(supportCaseFindMany).toHaveBeenCalledTimes(1);
		const [[args]] = supportCaseFindMany.mock.calls;
		expect(args.where.updated_at.lt.getTime()).toBe(NOW.getTime() - 90 * DAY_MS);
	});

	test("uses the configured window", async () => {
		process.env.CASE_RETENTION_DAYS = "30";
		await sweepExpiredCases(NOW);
		const [[args]] = supportCaseFindMany.mock.calls;
		expect(args.where.updated_at.lt.getTime()).toBe(NOW.getTime() - 30 * DAY_MS);
	});

	test("sweeps a case with no attachments at all", async () => {
		supportCaseFindMany.mockResolvedValue([caseRow({ id: "case-bare", attachments: [] })]);

		const result = await sweepExpiredCases(NOW);

		expect(result.swept).toBe(1);
		expect(result.removed).toEqual([]);
		expect(supportCaseDelete).toHaveBeenCalledWith({ where: { id: "case-bare" } });
	});

	test("reports the sweep to the log hub", async () => {
		supportCaseFindMany.mockResolvedValue([caseRow()]);
		await sweepExpiredCases(NOW);
		expect(logInfo).toHaveBeenCalledWith(
			"case_retention_sweep_completed",
			expect.objectContaining({ swept: 1, skipped: 0, retentionDays: 90 }),
		);
	});

	// The bytes belong to the case, and the case is gone. A file that is
	// already missing is not an error: the evidence is gone either way.
	test("treats an attachment whose file is already gone as removed", async () => {
		supportCaseFindMany.mockResolvedValue([
			caseRow({
				attachments: [
					{ id: "att-1", case_id: "case-1", file_path: "/uploads/support/never-existed.png" },
				],
			}),
		]);

		const result = await sweepExpiredCases(NOW);

		expect(result.swept).toBe(1);
		expect(result.removed).toEqual(["/uploads/support/never-existed.png"]);
	});
});

describe("the sweep never touches a file it did not resolve from an attachment row", () => {
	test("a file no attachment names survives", async () => {
		const stray = await writeProbe("stray.png");
		await writeProbe("known.png");
		supportCaseFindMany.mockResolvedValue([
			caseRow({
				attachments: [{ id: "att-1", case_id: "case-1", file_path: "/uploads/support/known.png" }],
			}),
		]);

		const result = await sweepExpiredCases(NOW);

		expect(result.swept).toBe(1);
		expect(await stillThere(stray)).toBe(true);
	});

	// The attachment's file_path is posted by the client, so it can name any
	// file the server can see. Only the support namespace is this portal's to
	// delete.
	test("a path outside the support namespace is refused", async () => {
		const chatFile = await writeProbe("someone-elses-chat.png", path.join(uploadsRoot(), "chat"));
		supportCaseFindMany.mockResolvedValue([
			caseRow({
				attachments: [
					{ id: "att-1", case_id: "case-1", file_path: "/uploads/chat/someone-elses-chat.png" },
				],
			}),
		]);

		const result = await sweepExpiredCases(NOW);

		expect(result.swept).toBe(1);
		expect(await stillThere(chatFile)).toBe(true);
		expect(result.retained).toEqual(["/uploads/chat/someone-elses-chat.png"]);
		expect(result.removed).toEqual([]);
	});

	test("a path that climbs out of the uploads root is refused", async () => {
		const outside = await writeProbe("outside.txt", uploadsRoot());
		supportCaseFindMany.mockResolvedValue([
			caseRow({
				attachments: [
					{
						id: "att-1",
						case_id: "case-1",
						file_path: "/uploads/support/../../../../outside.txt",
					},
				],
			}),
		]);

		const result = await sweepExpiredCases(NOW);

		expect(result.swept).toBe(1);
		expect(await stillThere(outside)).toBe(true);
		expect(result.retained).toHaveLength(1);
	});

	// A path that does not even name an upload is not ours to resolve.
	test("a path that is not an upload path is refused", async () => {
		const serverFile = path.resolve(process.cwd(), "server", "server.js");
		supportCaseFindMany.mockResolvedValue([
			caseRow({
				attachments: [{ id: "att-1", case_id: "case-1", file_path: "/etc/passwd" }],
			}),
		]);

		const result = await sweepExpiredCases(NOW);

		expect(result.swept).toBe(1);
		expect(await stillThere(serverFile)).toBe(true);
		expect(result.retained).toEqual(["/etc/passwd"]);
	});
});

describe("shouldSweep", () => {
	test("an old terminal case is sweepable", () => {
		expect(shouldSweep(caseRow(), daysAgo(90))).toBe(true);
	});

	test("a case with no timestamp is never swept", () => {
		expect(shouldSweep({ id: "x", status: "completed", updated_at: null }, daysAgo(90))).toBe(
			false,
		);
	});
});
