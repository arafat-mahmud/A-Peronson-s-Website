import { EventEmitter } from "node:events";

export const REALTIME_EVENTS = {
	notificationCreated: "notification:created",
	notificationRead: "notification:read",
	feedPostCreated: "feed:post:created",
	feedPostUpdated: "feed:post:updated",
	feedPostDeleted: "feed:post:deleted",
	syncInvalidated: "sync:invalidated",
	feedInvalidated: "feed:invalidated",
};

export const realtimeBus = new EventEmitter();
realtimeBus.setMaxListeners(100);

// --- Support investigation cases -----------------------------------------
//
// The five event types are fixed by contracts.md §4 and are the wire format
// the client (Task 7) subscribes to over SSE. They are published here as
// their own names - on a channel per case - so a listener can subscribe to
// exactly the events it cares about instead of filtering one channel by
// type.
//
// The payload keys per type are also fixed by that section:
//
//   support.case.message  -> { message }
//   support.case.status   -> { caseId, status, summary? }
//   support.case.progress -> { caseId, role, status, detail? }
//   support.case.finding  -> { caseId, role, finding }
//   support.case.report   -> { caseId, report, reportStatus }
//
// `emitCaseEvent` always carries the case id in the envelope, so the
// `support.case.message` event - whose own payload is just the message row -
// still tells a listener which case it belongs to. The envelope is a
// superset of the keys above; it never removes one.
//
// The events are published on a PER-CASE CHANNEL, not on the bare type
// string. The `support.case.report` payload is the whole Markdown report,
// and a report is a case's own business: published on a process-global
// channel, every listener on that channel - today or in future - receives
// every case's report body. The channel name is `<type>:<caseId>`, so a
// listener has to ask for one case's events on purpose.
//
// The channel name is INTERNAL. The five type strings are the wire format
// (contracts.md §4) and they do not change: the SSE handler still writes
// `event: support.case.report`.
export const CASE_EVENTS = {
	message: "support.case.message",
	status: "support.case.status",
	progress: "support.case.progress",
	finding: "support.case.finding",
	report: "support.case.report",
};

/**
 * The bus channel one case's events are published on.
 *
 * @param {string} type One of the five `CASE_EVENTS` type strings.
 * @param {string} caseId The case the events belong to.
 * @returns {string} The channel name.
 */
export function caseEventChannel(type, caseId) {
	return `${String(type)}:${String(caseId)}`;
}

/**
 * Publishes one support-case event on the realtime bus.
 *
 * The event name IS the type string, so `emitCaseEvent(id, "support.case.status", {...})`
 * and `emitCaseEvent(id, CASE_EVENTS.status, {...})` are the same call.
 *
 * @param {string} caseId The case the event belongs to.
 * @param {string} type One of the five `CASE_EVENTS` type strings.
 * @param {Object} [payload] The type's payload.
 * @returns {void}
 */
export function emitCaseEvent(caseId, type, payload) {
	if (!(caseId && type)) {
		return;
	}
	const body = payload && typeof payload === "object" ? { ...payload } : {};
	// The case id in the envelope always wins over one inside the payload:
	// a listener routes on it, and a payload that disagreed with the emitter
	// would send the event to the wrong case.
	realtimeBus.emit(caseEventChannel(type, caseId), { ...body, caseId: String(caseId) });
}

export function emitNotificationCreated(userId, notification) {
	if (!(userId && notification)) {
		return;
	}
	realtimeBus.emit(REALTIME_EVENTS.notificationCreated, {
		userId: String(userId),
		notification,
	});
}

export function emitNotificationRead(userId, notificationId) {
	if (!(userId && notificationId)) {
		return;
	}
	realtimeBus.emit(REALTIME_EVENTS.notificationRead, {
		userId: String(userId),
		id: String(notificationId),
	});
}

export function emitFeedPostCreated(post) {
	if (!post) {
		return;
	}
	realtimeBus.emit(REALTIME_EVENTS.feedPostCreated, { post });
}

export function emitFeedPostUpdated(post) {
	if (!post) {
		return;
	}
	realtimeBus.emit(REALTIME_EVENTS.feedPostUpdated, { post });
}

export function emitFeedPostDeleted(postId) {
	if (!postId) {
		return;
	}
	realtimeBus.emit(REALTIME_EVENTS.feedPostDeleted, { postId });
}

// HyperCache Phase 3 — generic invalidation fan-out. Emitted best-effort
// by changeLogService.emitAfterCommit AFTER the ledger transaction commits.
// Existing feed:post:* events are preserved untouched.
//
// Canonical path: callers emit ONLY sync:invalidated via emitSyncInvalidated.
// The forwarder below re-emits the same payload on feed:invalidated so the
// SSE controller (subscribed to feed:invalidated) receives every change.
// seq is numeric on both sides (matches syncService.getDelta seqNumber);
// parseInvalidateEvent passes seq through untouched, so Numbers flow fine.
export function emitSyncInvalidated({
	seq = null,
	entity_type,
	entity_id,
	operation,
	entity_version,
	content_hash = null,
} = {}) {
	if (!(entity_type && entity_id)) {
		return;
	}
	const seqNum = seq == null ? null : Number(seq);
	realtimeBus.emit(REALTIME_EVENTS.syncInvalidated, {
		type: "invalidate",
		seq: Number.isFinite(seqNum) ? seqNum : null,
		entity: String(entity_type),
		id: String(entity_id),
		operation: operation ? String(operation) : null,
		version: entity_version == null ? null : Number(entity_version),
		hash: content_hash ? String(content_hash) : null,
	});
}

// Forward sync:invalidated to feed:invalidated listeners (canonical path).
// Registered once at module load; covers direct realtimeBus.emit calls too.
realtimeBus.on(REALTIME_EVENTS.syncInvalidated, (payload) => {
	realtimeBus.emit(REALTIME_EVENTS.feedInvalidated, payload);
});
