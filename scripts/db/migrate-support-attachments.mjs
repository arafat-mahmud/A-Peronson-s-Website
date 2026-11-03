import fs from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// One-time migration: the support evidence namespace.
//
// A support case's evidence used to be written into the ROOT of
// server/uploads, which the static mount serves unauthenticated, and the row
// that described it carried entity_type "support_ticket" — a type the
// authorization resolver has no branch for, so it fell into the hard-deny
// default. This script moves the bytes into the gated /uploads/support
// prefix and re-points the rows at it.
//
// The rules this script follows, in order of importance:
//
//   1. It NEVER deletes a file it cannot move. An unmovable file is left
//      exactly where it is and reported; the row is left alone too, because
//      a row that points at a file that is not there is a row that
//      authorizes nothing.
//   2. It never overwrites an existing file. A name that is already taken
//      gets a suffix rather than the bytes being clobbered.
//   3. It only touches rows whose entity_type is a support one. Every other
//      document — verification documents, payment proofs, feed media — is
//      left exactly as it is.
//
// The entity_type is normalised to "support_case" in the same pass, because
// the resolver has exactly one branch for the namespace and an unrecognised
// type is a hard deny: a file moved into the gated prefix but left under the
// old type would be unreachable for everyone, the uploader included.
//
// --- the --dry-run flag ----------------------------------------------------
//
// `--dry-run` prints the plan and changes NOTHING: no file is moved, no row
// is retyped, no row is deleted, and the target directory is not even
// created. It reads the rows and stats the files, which is the only way to
// know what the real run would do.
//
// The flag matters because of WHERE the script has to run. It resolves its
// paths from `process.cwd()`, so it must be run on the host that actually
// holds the served files: run from a laptop against a production database it
// reports every row unmovable, moves nothing, and raises no error — which
// looks exactly like a successful no-op. See
// docs/rollout/2026-10-20-support-attachment-migration.md.

const DRY_RUN = process.argv.includes("--dry-run") || process.argv.includes("-n");

const SUPPORT_ENTITY_TYPES = ["support_ticket", "support_case"];
const TARGET_ENTITY_TYPE = "support_case";
const UPLOADS_ROOT = path.join(process.cwd(), "server", "uploads");
const SUPPORT_DIR = path.join(UPLOADS_ROOT, "support");
const SUPPORT_PREFIX = "/uploads/support/";
const MAX_NAME_ATTEMPTS = 1000;

function text(value) {
	return String(value ?? "").trim();
}

// The stored path has been written in three shapes over the years:
//
//   "server/uploads/1700-photo.png"  - path.relative(cwd, target), Windows
//                                      separators included
//   "server/uploads/1700-photo.png"  - the same, posix separators
//   "/uploads/1700-photo.png"        - the public form the gated prefixes use
//
// so the source is resolved by taking the path relative to the uploads root,
// whichever of those three shapes it is written in.
function resolveSource(filePath) {
	const raw = text(filePath).replace(/\\/g, "/");
	if (!raw) return null;
	const withoutUploads = raw
		.replace(/^\/+/, "")
		.replace(/^server\/uploads\//, "")
		.replace(/^uploads\//, "");
	if (!withoutUploads) return null;
	return path.join(UPLOADS_ROOT, ...withoutUploads.split("/").filter(Boolean));
}

function isAlreadyMoved(filePath) {
	const raw = text(filePath).replace(/\\/g, "/").toLowerCase();
	return raw.startsWith(SUPPORT_PREFIX);
}

async function fileExists(target) {
	return fs
		.stat(target)
		.then((stat) => stat.isFile())
		.catch(() => false);
}

// A name that is already taken in the target directory must not be
// overwritten: two support attachments can share a file name, and the
// second one is not the first one's bytes.
async function freeTargetName(name) {
	let counter = 1;
	let candidate = name;
	while (counter < MAX_NAME_ATTEMPTS) {
		const taken = await fileExists(path.join(SUPPORT_DIR, candidate));
		if (!taken) return candidate;
		const ext = path.extname(name);
		const stem = ext ? name.slice(0, -ext.length) : name;
		candidate = `${stem}-${counter}${ext}`;
		counter += 1;
	}
	return null;
}

// Moves one file, and never removes the source unless a complete copy of it
// has already landed in the target. A rename across devices fails with EXDEV
// and a locked file fails with EPERM/EBUSY, so the copy path is the fallback
// and the unlink is the last step.
async function moveFile(source, target) {
	try {
		await fs.rename(source, target);
		return { ok: true };
	} catch (error) {
		try {
			await fs.copyFile(source, target);
		} catch (copyError) {
			return {
				ok: false,
				reason: `could not move the file: ${error.message} / ${copyError.message}`,
			};
		}
		try {
			await fs.unlink(source);
		} catch (unlinkError) {
			return {
				ok: false,
				reason: `copied but the original could not be removed: ${unlinkError.message}`,
			};
		}
		return { ok: true };
	}
}

// One row, one outcome. The row is only re-pointed when the bytes actually
// moved: a row that points at a file that is not there authorizes nothing.
//
// With `dryRun` the outcome is the same, computed the same way, but nothing
// is written: the file is not moved, the row is not retyped, the row is not
// deleted.
async function processRow(row, { dryRun = false } = {}) {
	const filePath = text(row.file_path);
	if (!filePath) {
		return {
			outcome: "unmovable",
			id: row.id,
			file_path: row.file_path,
			reason: "no file_path on the row",
		};
	}
	if (isAlreadyMoved(filePath)) {
		if (row.entity_type === TARGET_ENTITY_TYPE) {
			return { outcome: "skipped", id: row.id, file_path: filePath };
		}
		if (dryRun) {
			return {
				outcome: "would-retype",
				id: row.id,
				file_path: filePath,
				from: row.entity_type,
			};
		}
		await prisma.document.update({
			where: { id: row.id },
			data: { entity_type: TARGET_ENTITY_TYPE },
		});
		return { outcome: "retyped", id: row.id, file_path: filePath, from: row.entity_type };
	}

	const source = resolveSource(filePath);
	if (!source) {
		return {
			outcome: "unmovable",
			id: row.id,
			file_path: filePath,
			reason: "path does not name a file",
		};
	}

	// Only a file that sits DIRECTLY in the uploads root is moved. A support
	// row that points into another namespace (chat/, contracts/, …) names
	// bytes another row also anchors, and moving them would break that other
	// row's anchor. Such a row is reported, not moved.
	if (path.dirname(source).toLowerCase() !== UPLOADS_ROOT.toLowerCase()) {
		return {
			outcome: "unmovable",
			id: row.id,
			file_path: filePath,
			reason: "the file is not in the uploads root; another row may anchor it",
		};
	}

	if (!(await fileExists(source))) {
		// The row points at bytes that are not there. Nothing is moved and
		// nothing is deleted; the row is reported so an operator can look.
		return {
			outcome: "unmovable",
			id: row.id,
			file_path: filePath,
			reason: "no file at that path",
		};
	}

	const targetName = await freeTargetName(path.basename(source));
	if (!targetName) {
		return {
			outcome: "unmovable",
			id: row.id,
			file_path: filePath,
			reason: "no free name in the target",
		};
	}

	if (dryRun) {
		// The plan, and nothing else: the bytes stay where they are and the
		// row keeps pointing at them.
		return {
			outcome: "would-move",
			id: row.id,
			from: filePath,
			to: `${SUPPORT_PREFIX}${targetName}`,
			uploaded_by: row.uploaded_by,
		};
	}

	const moved = await moveFile(source, path.join(SUPPORT_DIR, targetName));
	if (!moved.ok) {
		return { outcome: "unmovable", id: row.id, file_path: filePath, reason: moved.reason };
	}

	try {
		await prisma.document.update({
			where: { id: row.id },
			data: {
				file_path: `${SUPPORT_PREFIX}${targetName}`,
				entity_type: TARGET_ENTITY_TYPE,
			},
		});
	} catch (error) {
		// The bytes are in the gated namespace but the row still names the old
		// path, so the file is unreachable until the row is fixed. The file is
		// NOT deleted — the registry pass adopts it as a "system" row, which
		// authorises an admin, and an operator can re-point the row by hand.
		return {
			outcome: "unmovable",
			id: row.id,
			file_path: filePath,
			reason: `the file was moved but the row could not be updated: ${error.message}`,
		};
	}

	return {
		outcome: "moved",
		id: row.id,
		from: filePath,
		to: `${SUPPORT_PREFIX}${targetName}`,
		uploaded_by: row.uploaded_by,
	};
}

async function run({ dryRun = false } = {}) {
	// The target directory is created only for a real run. A dry run must not
	// touch the filesystem at all.
	if (!dryRun) {
		await fs.mkdir(SUPPORT_DIR, { recursive: true });
	}

	const rows = await prisma.document.findMany({
		where: { entity_type: { in: SUPPORT_ENTITY_TYPES } },
		select: { id: true, entity_type: true, entity_id: true, file_path: true, uploaded_by: true },
	});

	const moved = [];
	const retyped = [];
	const unmovable = [];
	let skipped = 0;

	for (const row of rows) {
		// The rows are handled one at a time on purpose: each move touches the
		// filesystem and then the database, and doing them concurrently would
		// make the name-collision check racy.
		// biome-ignore lint/performance/noAwaitInLoops: the moves must be sequential
		const result = await processRow(row, { dryRun });
		if (result.outcome === "moved" || result.outcome === "would-move") moved.push(result);
		else if (result.outcome === "retyped" || result.outcome === "would-retype")
			retyped.push(result);
		else if (result.outcome === "unmovable") unmovable.push(result);
		else skipped += 1;
	}

	const mode = dryRun ? " (DRY RUN)" : "";
	console.log(`support attachment migration${mode}: ${rows.length} support row(s) examined`);
	console.log(`  ${dryRun ? "would move" : "moved  "} : ${moved.length}`);
	for (const item of moved) {
		console.log(`    ${item.from} -> ${item.to} (row ${item.id})`);
	}
	console.log(`  ${dryRun ? "would retype" : "retyped "} : ${retyped.length}`);
	for (const item of retyped) {
		console.log(`    ${item.file_path} (row ${item.id}: ${item.from} -> ${TARGET_ENTITY_TYPE})`);
	}
	console.log(`  skipped : ${skipped} (already in ${SUPPORT_PREFIX})`);
	console.log(`  UNMOVABLE: ${unmovable.length} (left in place, NOT deleted)`);
	for (const item of unmovable) {
		console.log(`    row ${item.id} ${item.file_path} — ${item.reason}`);
	}
	if (unmovable.length > 0) {
		console.log("  the unmovable files above were NOT deleted and their rows were NOT changed;");
		console.log("  move them into server/uploads/support by hand and re-run this script.");
	}
	if (dryRun) {
		console.log("");
		console.log("  DRY RUN: nothing was moved, retyped or deleted, and no file was written.");
		console.log("  Re-run without --dry-run to apply this plan.");
	}
}

run({ dryRun: DRY_RUN })
	.then(() => prisma.$disconnect())
	.catch((err) => {
		console.error(err);
		return prisma.$disconnect().then(() => process.exit(1));
	});
