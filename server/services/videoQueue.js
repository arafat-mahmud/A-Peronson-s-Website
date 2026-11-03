import { logInfo } from "../utils/logger.js";
import prisma from "../utils/prisma.js";
import { compressVideo, replaceWithCompressed, validateVideo } from "./videoProcessor.js";

const QUEUE = [];
let isProcessing = false;

export function addToQueue(job) {
	QUEUE.push(job);
	if (!isProcessing) {
		processNext();
	}
}

export function queueDepth() {
	return QUEUE.length;
}

async function updateDoc(documentId, data) {
	if (!documentId) {
		return;
	}
	try {
		await prisma.document.update({ where: { id: documentId }, data });
	} catch {
		// document record may not exist (e.g. call recordings)
	}
}

async function processNext() {
	if (QUEUE.length === 0) {
		isProcessing = false;
		return;
	}

	isProcessing = true;
	const job = QUEUE.shift();
	const { filePath, documentId } = job;

	try {
		await validateVideo(filePath);
		await updateDoc(documentId, { video_status: "processing" });

		const compressedPath = await compressVideo(filePath);
		const result = replaceWithCompressed(filePath, compressedPath);

		await updateDoc(documentId, {
			video_status: result.replaced ? "processed" : "skipped",
		});
	} catch {
		await updateDoc(documentId, { video_status: "failed" });
	}

	setImmediate(processNext);
}

export function startVideoQueueWorker() {
	logInfo("Video Queue Worker started");
	if (QUEUE.length > 0 && !isProcessing) {
		processNext();
	}
}
