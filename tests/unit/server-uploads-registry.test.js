import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { jest } from "@jest/globals";

// The Document row is the authorization key for every gated uploads prefix.
// The AI-moderation backfill used to be the only producer of those rows, and it
// is disabled in the deployed configuration (AI_HARAM_ANALYTICS_ENABLED=false)
// and only ever covered image/video. So chat attachments, call recordings and
// search images had no row, and authorizeFilePath answered "not_found" for
// everyone — including the person who uploaded the file.
//
// The registry pass is the part of the scanner that is NOT part of the
// moderation feature: it runs whatever the flag says, and it covers every file
// type. These tests drive it against a temporary tree, never the real uploads
// root.

const documentCreate = jest.fn(async (args) => ({ id: "doc-1", ...args.data }));
const documentFindMany = jest.fn(async () => []);

jest.unstable_mockModule("../../server/utils/prisma.js", () => ({
	default: {
		document: { create: documentCreate, findMany: documentFindMany },
	},
}));

const { ensureDocumentRowsForExistingFiles } = await import(
	"../../server/services/uploadsService.js"
);

let root;

beforeEach(() => {
	documentCreate.mockClear();
	documentFindMany.mockClear();
	documentFindMany.mockResolvedValue([]);
	root = fs.mkdtempSync(path.join(os.tmpdir(), "uploads-registry-"));
	for (const folder of ["chat", "calls", "contracts", "search", "feed", "profile"]) {
		fs.mkdirSync(path.join(root, folder), { recursive: true });
	}
	fs.writeFileSync(path.join(root, "chat", "1700000000000-notes.txt"), "notes");
	fs.writeFileSync(path.join(root, "chat", "1700000000001-photo.png"), "png");
	fs.writeFileSync(path.join(root, "search", "1700000000002-q.png"), "png");
	fs.writeFileSync(path.join(root, "contracts", "1700000000003-cn.pdf"), "pdf");
	fs.writeFileSync(path.join(root, "feed", "1700000000004-public.png"), "png");
	fs.writeFileSync(path.join(root, "root-level.png"), "png");
});

afterEach(() => {
	fs.rmSync(root, { recursive: true, force: true });
});

function createdRow(fileName) {
	// mock.calls is an array of calls, each call an array of arguments.
	const call = documentCreate.mock.calls.find((callArgs) =>
		callArgs[0]?.data?.file_path?.endsWith(fileName),
	);
	return call ? call[0].data : null;
}

// The row for one exact public path. The basename helper above cannot tell
// two files with the same name in two directories apart, which is the whole
// point of the collision tests below.
function createdRowAt(publicUrl) {
	const call = documentCreate.mock.calls.find(
		(callArgs) => callArgs[0]?.data?.file_path === publicUrl,
	);
	return call ? call[0].data : null;
}

describe("uploads registry (server/services/uploadsService.js)", () => {
	test("creates a row for a file that has none, whatever the moderation flag says", async () => {
		// The flag is the whole point: the moderation scan is off in the deployed
		// configuration, and gating row creation on it is what left every private
		// file unreachable.
		const previous = process.env.AI_HARAM_ANALYTICS_ENABLED;
		process.env.AI_HARAM_ANALYTICS_ENABLED = "false";
		try {
			await ensureDocumentRowsForExistingFiles({ root });
		} finally {
			if (previous === undefined) {
				delete process.env.AI_HARAM_ANALYTICS_ENABLED;
			} else {
				process.env.AI_HARAM_ANALYTICS_ENABLED = previous;
			}
		}

		const row = createdRow("1700000000000-notes.txt");
		expect(row).not.toBeNull();
		expect(row).toMatchObject({
			uploaded_by: "system",
			entity_type: "chat_attachment",
			entity_id: "1700000000000-notes.txt",
			file_path: "/uploads/chat/1700000000000-notes.txt",
		});
	});

	// The old backfill skipped anything that was not image/video, which is how a
	// chat .pdf/.txt/.html ended up with no row at all.
	test("creates a row for a non-media file", async () => {
		await ensureDocumentRowsForExistingFiles({ root });
		const row = createdRow("1700000000000-notes.txt");
		expect(row).not.toBeNull();
		expect(row.type).toBe("other");
	});

	// /uploads/search is a gated prefix, so it needs a row of its own; the
	// scanner's subfolder list omitted "search" entirely, which made a search
	// image permanently unreachable.
	test("creates a row for a search image", async () => {
		await ensureDocumentRowsForExistingFiles({ root });
		expect(createdRow("1700000000002-q.png")).toMatchObject({
			entity_type: "search_image",
			file_path: "/uploads/search/1700000000002-q.png",
		});
	});

	test("creates a row for a contract pdf and for a public feed file", async () => {
		await ensureDocumentRowsForExistingFiles({ root });
		expect(createdRow("1700000000003-cn.pdf")).toMatchObject({
			entity_type: "contract",
			file_path: "/uploads/contracts/1700000000003-cn.pdf",
		});
		expect(createdRow("1700000000004-public.png")).toMatchObject({
			entity_type: "feed_media",
			file_path: "/uploads/feed/1700000000004-public.png",
		});
	});

	test("creates a row for a file sitting directly in the uploads root", async () => {
		await ensureDocumentRowsForExistingFiles({ root });
		expect(createdRow("root-level.png")).toMatchObject({
			entity_type: "uploads",
			file_path: "/uploads/root-level.png",
		});
	});

	// One query for the whole tree, and no second row for a file that already
	// has one.
	test("does not create a second row for a file that is already registered", async () => {
		documentFindMany.mockResolvedValue([{ file_path: "/uploads/chat/1700000000001-photo.png" }]);
		await ensureDocumentRowsForExistingFiles({ root });
		expect(documentFindMany).toHaveBeenCalledTimes(1);
		expect(createdRow("1700000000001-photo.png")).toBeNull();
		expect(createdRow("1700000000000-notes.txt")).not.toBeNull();
	});

	// A row written with a different SPELLING of the same path still counts as
	// known. The key is the normalised path, not the raw string.
	test("recognises a row written with a different spelling of the same path", async () => {
		documentFindMany.mockResolvedValue([{ file_path: "/uploads/./chat/1700000000001-photo.png" }]);
		await ensureDocumentRowsForExistingFiles({ root });
		expect(createdRowAt("/uploads/chat/1700000000001-photo.png")).toBeNull();
	});
});

// The same name in two directories is two files.
//
// The registry pass used to match on the BASENAME, so the second file was
// never adopted and never got a Document row. A file with no row is not
// public, it is UNREACHABLE: authorizeFilePath answers "not_found" and nobody
// — not even the parties entitled to the file — can read it. So a name
// collision silently locked a real file away, which is the same defect class
// as the missing-row bug this pass exists to fix.
describe("uploads registry: a name that collides across directories", () => {
	const COLLIDE = "1700000000009-collide.pdf";

	test("adopts the file in each directory under its OWN path", async () => {
		fs.writeFileSync(path.join(root, "chat", COLLIDE), "pdf");
		fs.writeFileSync(path.join(root, "contracts", COLLIDE), "pdf");

		await ensureDocumentRowsForExistingFiles({ root });

		expect(createdRowAt(`/uploads/chat/${COLLIDE}`)).toMatchObject({
			entity_type: "chat_attachment",
			file_path: `/uploads/chat/${COLLIDE}`,
		});
		expect(createdRowAt(`/uploads/contracts/${COLLIDE}`)).toMatchObject({
			entity_type: "contract",
			file_path: `/uploads/contracts/${COLLIDE}`,
		});
	});

	test("a row for one directory does not suppress the same name in another", async () => {
		// The sharpest form: the chat file is already registered, and the
		// contracts file with the same name still has to be adopted.
		documentFindMany.mockResolvedValue([{ file_path: `/uploads/chat/${COLLIDE}` }]);
		fs.writeFileSync(path.join(root, "contracts", COLLIDE), "pdf");

		await ensureDocumentRowsForExistingFiles({ root });

		expect(createdRowAt(`/uploads/contracts/${COLLIDE}`)).not.toBeNull();
	});
});
