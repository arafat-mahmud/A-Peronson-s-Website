import { logger } from "../utils/logger.js";

const QUEUE = [];
let isProcessing = false;

function processNext() {
	const item = QUEUE.shift();
	if (!item) {
		isProcessing = false;
		return;
	}
	logger.info(`[Image Queue] Processing item: ${item}`);
	processNext();
}

export function addImageToQueue(item) {
	QUEUE.push(item);
	logger.info(`[Image Queue] Enqueued item: ${JSON.stringify(item)}`);
	if (!isProcessing) {
		isProcessing = true;
		processNext();
	}
}

export function queueDepth() {
	return QUEUE.length;
}

export function startImageQueueWorker() {
	logger.info("[Image Queue] Worker started");
	if (QUEUE.length > 0 && !isProcessing) {
		isProcessing = true;
		processNext();
	}
}
