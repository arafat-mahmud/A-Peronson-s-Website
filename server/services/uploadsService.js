import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { logError, logInfo } from "../utils/logger.js";
import prisma from "../utils/prisma.js";
import { GATED_PREFIXES } from "../utils/signedFileUrl.js";
import { analyzeBufferWithAI, isAIAnalyticsEnabled } from "./aiModerationService.js";

const UPLOADS_ROOT = path.join(process.cwd(), "server", "uploads");

const FOLDER_CONFIG = {
	all: { label: "All Files", folder: null },
	root: { label: "Product Media", folder: "" },
	profile: { label: "Profile", folder: "profile" },
	chat: { label: "Chat", folder: "chat" },
	feed: { label: "Feed", folder: "feed" },
	calls: { label: "Calls", folder: "calls" },
	contracts: { label: "Contracts", folder: "contracts" },
	support: { label: "Support Evidence", folder: "support" },
};

const IMAGE_EXTS = new Set([
	".jpg",
	".jpeg",
	".png",
	".webp",
	".avif",
	".gif",
	".apng",
	".bmp",
	".tiff",
	".tif",
	".heic",
	".heif",
	".dcm",
	".tga",
	".svg",
	".eps",
	".pdf",
	".dng",
	".cr2",
	".cr3",
	".nef",
	".arw",
	".sr2",
	".orf",
	".raf",
	".psd",
	".ai",
	".xcf",
	".cdr",
]);
const VIDEO_EXTS = new Set([
	".mp4",
	".webm",
	".mkv",
	".flv",
	".vob",
	".ogv",
	".ogg",
	".rrc",
	".gifv",
	".mng",
	".mov",
	".avi",
	".qt",
	".wmv",
	".yuv",
	".rm",
	".asf",
	".amv",
	".m4p",
	".m4v",
	".mpg",
	".mp2",
	".mpeg",
	".mpe",
	".mpv",
	".svi",
	".3gp",
	".3g2",
	".mxf",
	".roq",
	".nsv",
	".f4v",
	".f4p",
	".f4a",
	".f4b",
	".mod",
]);
const DOC_EXTS = new Set([".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx"]);
const AUDIO_EXTS = new Set([".mp3", ".wav", ".ogg", ".m4a", ".flac"]);

function getFileType(filename) {
	const ext = path.extname(filename).toLowerCase();
	if (IMAGE_EXTS.has(ext)) {
		return "image";
	}
	if (VIDEO_EXTS.has(ext)) {
		return "video";
	}
	if (DOC_EXTS.has(ext)) {
		return "document";
	}
	if (AUDIO_EXTS.has(ext)) {
		return "audio";
	}
	return "other";
}

function formatBytes(bytes) {
	if (bytes === 0) {
		return "0 B";
	}
	const k = 1024;
	const sizes = ["B", "KB", "MB", "GB"];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return `${Number.parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
}

function isMediaFile(type) {
	return type === "image" || type === "video";
}

function isAutoApprovedLabel(label) {
	return label === "SAFE" || label === "QUESTIONABLE";
}

async function runAIAnalysisOnFile(fullPath, docId) {
	if (!isAIAnalyticsEnabled()) {
		return;
	}
	try {
		const buffer = await fs.readFile(fullPath);
		const filename = path.basename(fullPath);
		const result = await analyzeBufferWithAI(buffer, filename);

		const label = result?.label || "UNKNOWN";
		const score = result?.score || 0;
		const confidence = result?.confidence || "low";
		const signals = result?.signals || [];
		const details = result?.details || {};
		const timing = result?.timing || {};
		const severity = result?.severity || null;
		const earlyExit = result?.is_early_exit;
		const autoApproved = isAutoApprovedLabel(label);

		await prisma.document.update({
			where: { id: docId },
			data: {
				ai_label: label,
				ai_score: score,
				ai_confidence: confidence,
				ai_signals: signals,
				ai_details: details,
				ai_timing: timing,
				ai_severity: severity,
				ai_early_exit: earlyExit,
				ai_analyzed_at: new Date(),
				ai_auto_approved: autoApproved,
				moderation_status: autoApproved ? "auto_approved" : "pending_review",
			},
		});

		logInfo("AI Moderation scanned file", { filename, label, score });
	} catch (err) {
		logError("AI Moderation file scan failed", new Error(`${fullPath}: ${err.message}`));
	}
}

const SCAN_QUEUE = [];
let SCAN_RUNNING = false;
const MAX_CONCURRENT = 2;

async function processQueue() {
	while (SCAN_QUEUE.length > 0) {
		const batch = SCAN_QUEUE.splice(0, MAX_CONCURRENT);
		await Promise.all(
			batch.map(({ fullPath, docId }) =>
				runAIAnalysisOnFile(fullPath, docId).catch((err) =>
					logError("AI Moderation queue item failed", err),
				),
			),
		);
	}
	SCAN_RUNNING = false;
}

function enqueueScan(fullPath, docId) {
	SCAN_QUEUE.push({ fullPath, docId });
	if (!SCAN_RUNNING) {
		SCAN_RUNNING = true;
		processQueue().catch((err) => logError("AI Moderation queue processing failed", err));
	}
}

// The folders the scanner walks, and the entity type a row for a file in that
// folder carries.
//
// "search" is here because /uploads/search is a gated prefix: without a row a
// search image is unreachable by everyone, including the person who uploaded
// it. A row adopted from disk carries uploaded_by "system", so it authorises
// only an admin — the write-time row (privateDocumentService) is the one that
// carries the real uploader.
//
// "support" is here for the same reason: a support case's evidence is private,
// and a row adopted from disk authorises an admin only. The write-time row
// (entity_type "support_case") is the one that carries the uploader.
const SCAN_SUBFOLDERS = ["profile", "feed", "chat", "calls", "contracts", "search", "support", ""];

const SUBFOLDER_ENTITY_TYPES = {
	feed: "feed_media",
	profile: "profile_pic",
	chat: "chat_attachment",
	calls: "call_recording",
	contracts: "contract",
	search: "search_image",
	support: "support_case",
};

function entityTypeForFolder(subfolder) {
	return SUBFOLDER_ENTITY_TYPES[subfolder] || "uploads";
}

/**
 * The key a file on disk is known by.
 *
 * It used to be the BASENAME. That is wrong: "a.pdf" in chat/ and "a.pdf" in
 * contracts/ are two different files, and matching on the name meant the
 * second one never got a row of its own. A file with no Document row is not
 * public, it is UNREACHABLE — authorizeFilePath answers "not_found" and
 * nobody, including the parties entitled to the file, can read it. So a name
 * collision silently locked a real file away, which is the same defect class
 * as the missing-row bug this pass exists to fix.
 *
 * The key is the full public path, normalised, so a row written with a
 * different spelling of the same path still counts as "known" while a
 * different path never does.
 *
 * @param {string} publicPath - A public path, e.g. "/uploads/chat/a.pdf".
 * @returns {string} The normalised key, or "" when there is nothing to key.
 */
function knownKeyOf(publicPath) {
	const raw = String(publicPath || "").trim();
	if (!raw) return "";
	const withLeadingSlash = raw.startsWith("/") ? raw : `/${raw}`;
	// path.posix.normalize collapses "." and ".." segments; the lower case
	// matches the case-insensitive filesystem the uploads tree lives on.
	return path.posix.normalize(withLeadingSlash).replace(/\/+$/, "").toLowerCase();
}

/**
 * Creates a Document row for every file on disk that does not have one.
 *
 * Row creation is NOT part of the AI-moderation feature. The moderation scan
 * is gated behind AI_HARAM_ANALYTICS_ENABLED, which is false in the deployed
 * configuration, and it only ever covered image/video — so gating row creation
 * on it left every chat attachment, every call recording and every search
 * image without the row the authorization model keys on. Such a file is not
 * public: authorizeFilePath answers "not_found" and nobody, including its
 * uploader, can read it.
 *
 * This pass runs regardless of the moderation flag. It creates rows for every
 * file type, not just media.
 *
 * The rows it creates are "system" rows: they record that the bytes exist and
 * where they live, but they carry no ownership fact, so they authorise only an
 * admin. Ownership-bearing rows are written at upload time.
 */
export async function ensureDocumentRowsForExistingFiles({ root = UPLOADS_ROOT } = {}) {
	let created = 0;
	try {
		const rows = await prisma.document.findMany({
			where: { file_path: { not: null } },
			select: { file_path: true },
		});
		// Matched on the FULL PATH, not on the file name. The name alone
		// cannot tell two files apart: the same name in two directories is two
		// files, and the second one would never get a row — and a file with no
		// row is unreachable for everyone. A different spelling of the same
		// path still counts as "known", because the key is normalised.
		const known = new Set(rows.map((row) => knownKeyOf(row.file_path)));

		for (const subfolder of SCAN_SUBFOLDERS) {
			const scanPath = subfolder ? path.join(root, subfolder) : root;
			const items = await fs.readdir(scanPath, { withFileTypes: true }).catch(() => []);
			for (const item of items) {
				if (item.isDirectory()) {
					continue;
				}
				const publicUrl = `/uploads${subfolder ? `/${subfolder}` : ""}/${item.name}`;
				const key = knownKeyOf(publicUrl);
				if (known.has(key)) {
					continue;
				}
				try {
					await prisma.document.create({
						data: {
							id: crypto.randomUUID(),
							uploaded_by: "system",
							entity_type: entityTypeForFolder(subfolder),
							entity_id: item.name,
							file_path: publicUrl,
							type: getFileType(item.name),
						},
					});
					known.add(key);
					created += 1;
				} catch (err) {
					logError("AI Moderation row creation failed", new Error(`${publicUrl}: ${err.message}`));
				}
			}
		}
		if (created > 0) {
			logInfo("Uploads registry: created Document rows for untracked files", { created });
		}
	} catch (err) {
		logError("Uploads registry scan error", err);
	}
	return created;
}

export async function scanAndAnalyzeExistingFiles() {
	if (!isAIAnalyticsEnabled()) {
		logInfo("AI Moderation skipping scan — AI_HARAM_ANALYTICS_ENABLED is false");
		return;
	}
	logInfo("AI Moderation scanning existing uploads for unanalyzed media...");
	try {
		const basePath = UPLOADS_ROOT;
		const subfolders = SCAN_SUBFOLDERS;

		for (const subfolder of subfolders) {
			const scanPath = subfolder ? path.join(basePath, subfolder) : basePath;
			try {
				const items = await fs.readdir(scanPath, { withFileTypes: true });
				for (const item of items) {
					if (item.isDirectory()) {
						continue;
					}
					const fullPath = path.join(scanPath, item.name);
					const type = getFileType(item.name);
					if (!isMediaFile(type)) {
						continue;
					}

					const existing = await prisma.document.findFirst({
						where: { file_path: { endsWith: item.name } },
					});

					const alreadyAnalyzed =
						existing?.ai_analyzed_at &&
						existing.ai_label &&
						!["PENDING", "ANALYZING"].includes(existing.ai_label);
					if (alreadyAnalyzed) {
						continue;
					}

					if (existing) {
						enqueueScan(fullPath, existing.id);
					} else {
						const docId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
						const publicUrl = `/uploads${subfolder ? `/${subfolder}` : ""}/${item.name}`;
						const entityType = entityTypeForFolder(subfolder);

						const created = await prisma.document.create({
							data: {
								id: docId,
								uploaded_by: "system",
								entity_type: entityType,
								entity_id: item.name,
								file_path: publicUrl,
								type,
								moderation_status: "pending_review",
								ai_label: "ANALYZING",
								ai_score: 0,
							},
						});

						enqueueScan(fullPath, created.id);
					}
				}
			} catch {
				/* ignore folder */
			}
		}
		logInfo("AI Moderation scan queued. Waiting for analysis...");
	} catch (err) {
		logError("AI Moderation scan error", err);
	}
}

async function _getDocumentUsages(filename) {
	const usages = [];
	const normalizedName = filename.toLowerCase();
	try {
		const docs = await prisma.document.findMany({
			where: { file_path: { not: null } },
			select: {
				id: true,
				file_path: true,
				entity_type: true,
				entity_id: true,
				moderation_status: true,
			},
		});
		for (const doc of docs || []) {
			const docPath = doc.file_path || "";
			const docName = docPath.split("/").pop() || "";
			if (
				docName.toLowerCase().includes(normalizedName) ||
				normalizedName.includes(docName.toLowerCase())
			) {
				usages.push({
					entity_type: doc.entity_type,
					entity_id: doc.entity_id,
					doc_id: doc.id,
					moderation_status: doc.moderation_status,
				});
			}
		}
	} catch {
		/* ignore */
	}
	return usages;
}

async function _getProductUsages(filename) {
	const usages = [];
	const normalizedName = filename.toLowerCase();
	try {
		const products = await prisma.product.findMany({
			where: {
				OR: [
					{ image_urls: { not: null } },
					{ cover_image_url: { not: null } },
					{ video_url: { not: null } },
				],
			},
			select: {
				id: true,
				title: true,
				image_urls: true,
				cover_image_url: true,
				video_url: true,
			},
		});
		for (const product of products || []) {
			const images = Array.isArray(product.image_urls) ? product.image_urls : [];
			for (const img of images) {
				const imgName =
					(typeof img === "string" ? img : img.url || img.path || "").split("/").pop() || "";
				if (
					imgName.toLowerCase().includes(normalizedName) ||
					normalizedName.includes(imgName.toLowerCase())
				) {
					usages.push({
						entity_type: "product",
						entity_id: product.id,
						field: "images",
						title: product.title,
					});
				}
			}
			const coverName = (product.cover_image_url || "").split("/").pop() || "";
			if (
				coverName &&
				(coverName.toLowerCase().includes(normalizedName) ||
					normalizedName.includes(coverName.toLowerCase()))
			) {
				usages.push({
					entity_type: "product",
					entity_id: product.id,
					field: "cover_image_url",
					title: product.title,
				});
			}
			const vidName = (product.video_url || "").split("/").pop() || "";
			if (
				vidName &&
				(vidName.toLowerCase().includes(normalizedName) ||
					normalizedName.includes(vidName.toLowerCase()))
			) {
				usages.push({
					entity_type: "product",
					entity_id: product.id,
					field: "video_url",
					title: product.title,
				});
			}
		}
	} catch {
		/* ignore */
	}
	return usages;
}

async function _getUserAvatarUsages(filename) {
	const usages = [];
	const normalizedName = filename.toLowerCase();
	try {
		const users = await prisma.user.findMany({
			where: { profile: { not: null } },
			select: { id: true, name: true, profile: true },
		});
		for (const user of users || []) {
			const profile = user.profile || {};
			const avatar = profile.avatar || profile.avatar_url || "";
			const avatarName = avatar.split("/").pop() || "";
			if (
				avatarName &&
				(avatarName.toLowerCase().includes(normalizedName) ||
					normalizedName.includes(avatarName.toLowerCase()))
			) {
				usages.push({
					entity_type: "user",
					entity_id: user.id,
					field: "avatar",
					name: user.name,
				});
			}
		}
	} catch {
		/* ignore */
	}
	return usages;
}

async function _getFeedUsages(filename) {
	const usages = [];
	const normalizedName = filename.toLowerCase();
	try {
		const feeds = await prisma.feedPost.findMany({
			where: { media: { not: null } },
			select: { id: true, title: true, media: true },
		});
		for (const post of feeds || []) {
			const media = Array.isArray(post.media) ? post.media : [];
			for (const m of media) {
				const mName = (typeof m === "string" ? m : m.url || m.path || "").split("/").pop() || "";
				if (
					mName.toLowerCase().includes(normalizedName) ||
					normalizedName.includes(mName.toLowerCase())
				) {
					usages.push({
						entity_type: "feed_post",
						entity_id: post.id,
						title: post.title,
					});
				}
			}
		}
	} catch {
		/* ignore */
	}
	return usages;
}

async function _getChatUsages(filename) {
	const usages = [];
	const normalizedName = filename.toLowerCase();
	try {
		const messages = await prisma.message.findMany({
			where: { attachment: { not: null } },
			select: { id: true, match_id: true, attachment: true },
			take: 1000,
		});
		for (const msg of messages || []) {
			const attachments = Array.isArray(msg.attachment)
				? msg.attachment
				: [msg.attachment].filter(Boolean);
			for (const att of attachments) {
				const attName =
					(typeof att === "string" ? att : att.url || att.path || "").split("/").pop() || "";
				if (
					attName &&
					(attName.toLowerCase().includes(normalizedName) ||
						normalizedName.includes(attName.toLowerCase()))
				) {
					usages.push({
						entity_type: "message",
						entity_id: msg.id,
						thread_id: msg.match_id,
					});
				}
			}
		}
	} catch {
		/* ignore */
	}
	return usages;
}

async function _getCallUsages(filename) {
	const usages = [];
	const normalizedName = filename.toLowerCase();
	try {
		const calls = await prisma.callSession.findMany({
			where: { recording_url: { not: null } },
			select: { id: true, title: true, recording_url: true },
		});
		for (const call of calls || []) {
			const recName = (call.recording_url || "").split("/").pop() || "";
			if (
				recName &&
				(recName.toLowerCase().includes(normalizedName) ||
					normalizedName.includes(recName.toLowerCase()))
			) {
				usages.push({
					entity_type: "call_session",
					entity_id: call.id,
					title: call.title,
				});
			}
		}
	} catch {
		/* ignore */
	}
	return usages;
}

async function _getContractUsages(filename) {
	const usages = [];
	const normalizedName = filename.toLowerCase();
	try {
		const contracts = await prisma.document.findMany({
			where: {
				entity_type: "contract",
				OR: [{ artifact: { not: null } }],
			},
			select: { id: true, title: true, artifact: true },
		});
		for (const contract of contracts || []) {
			const pdfPath = contract.artifact?.pdf_path || "";
			const pdfName = pdfPath.split("/").pop() || "";
			if (
				pdfName &&
				(pdfName.toLowerCase().includes(normalizedName) ||
					normalizedName.includes(pdfName.toLowerCase()))
			) {
				usages.push({
					entity_type: "contract",
					entity_id: contract.id,
					title: contract.title,
				});
			}
		}
	} catch {
		/* ignore */
	}
	return usages;
}

function getFolderCategory(relativePath) {
	const parts = relativePath.split(path.sep);
	if (parts.length === 1) {
		return "root";
	}
	const subfolder = parts[0];
	const catMap = {
		profile: "profile",
		chat: "chat",
		feed: "feed",
		calls: "calls",
		contracts: "contracts",
		support: "support",
	};
	return catMap[subfolder] || "other";
}

async function scanFolder(folderPath, basePath) {
	const entries = [];
	try {
		const items = await fs.readdir(folderPath, { withFileTypes: true });
		for (const item of items) {
			const fullPath = path.join(folderPath, item.name);
			if (item.isDirectory()) {
				const sub = await scanFolder(fullPath, basePath);
				entries.push(...sub);
			} else if (item.isFile()) {
				try {
					const stat = await fs.stat(fullPath);
					const relative = path.relative(basePath, fullPath);
					const category = getFolderCategory(relative);
					entries.push({
						filename: item.name,
						path: `/${relative.replace(/\\/g, "/")}`,
						size: stat.size,
						size_formatted: formatBytes(stat.size),
						created: stat.birthtime.toISOString(),
						modified: stat.mtime.toISOString(),
						type: getFileType(item.name),
						category,
					});
				} catch {
					/* ignore file stat errors */
				}
			}
		}
	} catch {
		/* ignore folder scan errors */
	}
	return entries;
}

export async function getUploadsListing(folderFilter = "all") {
	const basePath = UPLOADS_ROOT;
	const allFiles = [];

	try {
		const exists = await fs
			.access(basePath)
			.then(() => true)
			.catch(() => false);
		if (!exists) {
			await fs.mkdir(basePath, { recursive: true });
		}

		const scanOptions =
			folderFilter === "all" || folderFilter === null
				? Object.values(FOLDER_CONFIG)
						.map((c) => c.folder)
						.filter(Boolean)
				: [FOLDER_CONFIG[folderFilter]?.folder].filter(Boolean);

		for (const subfolder of scanOptions) {
			const scanPath = subfolder ? path.join(basePath, subfolder) : basePath;
			const files = await scanFolder(scanPath, basePath);
			allFiles.push(...files);
		}
	} catch {
		/* ignore scan errors */
	}

	allFiles.sort((a, b) => new Date(b.modified) - new Date(a.modified));

	await flagUnclaimedPrivateFiles(allFiles);

	return { files: allFiles, total: allFiles.length };
}

// scanFolder emits `path` relative to UPLOADS_ROOT ("/contracts/a.pdf"), not a
// `folder` field, so the top-level segment is read back out of it. Lower-cased
// because the filesystem is case-insensitive and GATED_PREFIXES is matched the
// same way by isGatedPath.
function topFolderOf(file) {
	return String(file?.path || "")
		.toLowerCase()
		.replace(/^\/+/, "")
		.split("/")[0];
}

// The private prefixes are now unreachable without a signed url, which is the
// point — but it also means a file nothing links to becomes invisible rather
// than merely locked. Marking the orphans lets an admin find and claim them
// instead of assuming they no longer exist.
//
// Three anchors count as "claimed", matching how fileAccessService resolves
// ownership: Document.file_path (what the folder scanner writes), Document.entity_id
// (the bare filename it also writes), and artifact.pdf_path (where a real
// contract names its PDF — fileAccessService is explicit that this is often the
// only anchor there is).
async function flagUnclaimedPrivateFiles(allFiles) {
	const privateFiles = allFiles.filter((file) => GATED_PREFIXES.includes(topFolderOf(file)));
	if (!privateFiles.length) {
		return;
	}

	// One pass over the table rather than a query per file: the listing already
	// scans the whole uploads tree, and N+1 lookups would make an admin page that
	// lists hundreds of files unusable.
	let ownedNames = new Set();
	try {
		const rows = await prisma.document.findMany({
			where: { OR: [{ file_path: { not: null } }, { entity_id: { not: null } }] },
			select: { file_path: true, entity_id: true, artifact: true },
		});
		ownedNames = new Set();
		for (const row of rows || []) {
			for (const anchor of [row.file_path, row.entity_id, row.artifact?.pdf_path]) {
				const tail = String(anchor ?? "")
					.split(/[\\/]/)
					.pop()
					.toLowerCase();
				if (tail) {
					ownedNames.add(tail);
				}
			}
		}
	} catch (err) {
		// Advisory only. Access control does not depend on this flag, so a
		// database hiccup must not take the admin listing down with it.
		logError("uploads listing ownership lookup failed", err);
		return;
	}

	for (const file of privateFiles) {
		file.unclaimed = !ownedNames.has(String(file.filename || "").toLowerCase());
	}
}

export async function deleteUploadFile(filePath) {
	const fullPath = path.join(UPLOADS_ROOT, filePath.replace(/^\//, "").replace(/\//g, path.sep));
	try {
		await fs.unlink(fullPath);
		return { ok: true };
	} catch (err) {
		return { error: err.message };
	}
}

export async function getUploadsStats() {
	const { files: allFiles } = await getUploadsListing("all", 0, 10_000);
	const byCategory = {};
	let totalSize = 0;

	for (const file of allFiles) {
		byCategory[file.category] = (byCategory[file.category] || 0) + 1;
		totalSize += file.size;
	}

	return {
		total_files: allFiles.length,
		total_size: totalSize,
		total_size_formatted: formatBytes(totalSize),
		by_category: byCategory,
		by_type: allFiles.reduce((acc, f) => {
			acc[f.type] = (acc[f.type] || 0) + 1;
			return acc;
		}, {}),
	};
}

export { FOLDER_CONFIG, formatBytes };
