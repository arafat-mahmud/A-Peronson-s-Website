import crypto from "node:crypto";
import { CASE_EVENTS, emitCaseEvent } from "../realtime/realtimeBus.js";
import { isOwnerOrAdmin } from "../utils/permissions.js";
import prisma from "../utils/prisma.js";

// A support case is the PARENT of a ticket: the thread a client opens, the
// evidence attached to it, and the investigations run against it. The rows
// live in support_cases / support_case_messages / support_investigations /
// support_case_attachments (see prisma/schema.prisma).
//
// The case id is generated here rather than by a database default, because
// the id is also the anchor the evidence rows carry (entity_id on the
// Document row) and the client is handed it immediately.

const DEFAULT_STATUS = "collecting";

// The role a message carries when the client wrote it. The round cap counts
// these and only these: the assistant's own questions, the system notices and
// the staff replies are not the client thinking again.
const CLIENT_ROLE = "client";
// Legacy rows were written with role "user" before the schema was fixed. A row stored
// that way still counts toward the clarification round cap, otherwise the cap would
// silently never fire for those cases.
const LEGACY_CLIENT_ROLE = "user";

function text(value) {
	return String(value ?? "").trim();
}

// How many client messages the client may send before the case is
// investigated without an explicit confirmation.
//
// The cap is what stops a clarification loop from running forever: past six
// client turns the assistant stops asking and the case is handed to the
// investigators with whatever was collected. It lives here — next to the
// message counter that measures it — so that the service that reads the
// transcript and the controller that computes `ready` cannot disagree about
// the number. WS1-A re-exports it from the controller for the API surface.
export const MAX_CLARIFICATION_ROUNDS = 6;

/**
 * Opens a case for a user.
 *
 * @param {Object} params
 * @param {string} params.userId The id of the user the case belongs to.
 * @param {string} [params.subject] A one-line summary of the problem.
 * @returns {Promise<Object>} The created case row.
 */
export async function createCase({ userId, subject }) {
	const owner = text(userId);
	if (!owner) {
		throw new Error("userId is required to create a case");
	}
	return prisma.supportCase.create({
		data: {
			id: crypto.randomUUID(),
			user_id: owner,
			// Written here as well as in the schema default: the status is part
			// of the case's contract, and a caller that reads the row back must
			// not depend on a database default it cannot see.
			status: DEFAULT_STATUS,
			subject: text(subject) || null,
		},
	});
}

/**
 * Appends one message to a case.
 *
 * The sequence is allocated inside a transaction: two appends that race (the
 * investigator runtime and the client, at the same moment) would otherwise
 * read the same "last sequence" and both write the same number, and the
 * messages are ordered by it.
 *
 * @param {Object} params
 * @param {string} params.caseId The case the message belongs to.
 * @param {string} params.role Who said it ("user", "assistant", "system").
 * @param {string} [params.kind] What kind of message it is.
 * @param {string} params.content The message body.
 * @param {string} [params.agent] The agent that produced it, if any.
 * @returns {Promise<Object>} The created message row.
 */
export async function appendCaseMessage({ caseId, role, kind = "answer", content, agent = null }) {
	const created = await prisma.$transaction(async (tx) => {
		const last = await tx.supportCaseMessage.findFirst({
			where: { case_id: caseId },
			orderBy: { sequence: "desc" },
			select: { sequence: true },
		});
		return tx.supportCaseMessage.create({
			data: {
				id: crypto.randomUUID(),
				case_id: caseId,
				role,
				kind,
				content,
				agent,
				sequence: (last?.sequence || 0) + 1,
			},
		});
	});

	// Announced only after the transaction committed. An event for a message
	// that was rolled back would put a row on the wire that no reader can
	// find, and a listener that re-reads the case would see a shorter thread
	// than the event claims.
	//
	// This is the single funnel every message goes through - the client's
	// turns, the assistant's questions, the notices - so `support.case.message`
	// cannot be forgotten by one of the callers.
	emitCaseEvent(caseId, CASE_EVENTS.message, { message: created });
	return created;
}

/**
 * Reads a case and its messages, oldest first.
 *
 * @param {string} caseId
 * @returns {Promise<Object|null>} The case row, or null when there is none.
 */
export async function getCaseWithMessages(caseId) {
	return prisma.supportCase.findUnique({
		where: { id: caseId },
		include: { messages: { orderBy: { sequence: "asc" } } },
	});
}

/**
 * Lists the cases a user opened, most recently touched first.
 *
 * @param {string} userId
 * @returns {Promise<Object[]>}
 */
export async function listCasesForUser(userId) {
	return prisma.supportCase.findMany({
		where: { user_id: userId },
		orderBy: { updated_at: "desc" },
	});
}

/**
 * Lists every case, most recently touched first. Staff view.
 *
 * @returns {Promise<Object[]>}
 */
export async function listCasesAdmin() {
	return prisma.supportCase.findMany({ orderBy: { updated_at: "desc" } });
}

/**
 * Deletes a case and everything hanging off it.
 *
 * The attachment rows go with it (the relation cascades), and they are
 * RETURNED so the caller can clean up the bytes and the Document rows that
 * anchor them — those are not part of the case's foreign key, so the database
 * cannot remove them.
 *
 * A case that is not there is not an error: the contract says this returns
 * the attachments, and a missing case has none. `prisma.supportCase.delete`
 * raises P2025 for a missing row, so the row is read first and an absent
 * case returns `[]` instead of throwing.
 *
 * The read and the delete share ONE transaction. Without it a concurrent
 * delete can slip between them: this call reads the attachments, the other
 * call deletes the case (and the attachments with it), and this call then
 * fails on a row that is already gone — or worse, returns an attachment list
 * for a case that no longer exists.
 *
 * @param {string} caseId
 * @returns {Promise<Object[]>} The attachment rows that were removed.
 */
export async function deleteCase(caseId) {
	return prisma.$transaction(async (tx) => {
		const attachments = await tx.supportCaseAttachment.findMany({
			where: { case_id: caseId },
		});

		const existing = await tx.supportCase.findUnique({
			where: { id: caseId },
			select: { id: true },
		});
		if (!existing) {
			return [];
		}

		try {
			await tx.supportCase.delete({ where: { id: caseId } });
		} catch (error) {
			// The case was deleted by somebody else between the read and the
			// delete. Its attachments went with it (the relation cascades), so
			// there is nothing left for the caller to clean up.
			if (error?.code === "P2025") {
				return [];
			}
			throw error;
		}

		return attachments;
	});
}

/**
 * Decides whether a user may read a case.
 *
 * A case is the client's: their problem, their evidence, their transcript.
 * Nobody else reads it — a stranger gets `false` and the controller turns that
 * into a 403, not a 404 (a 404 would hide the fact that the case exists,
 * and the contract asks for a 403).
 *
 * Staff are the exception: an owner or an admin can read any case, because
 * they are the ones who answer for the platform when a client is stuck. The
 * role check is delegated to `isOwnerOrAdmin` in server/utils/permissions.js
 * — the same helper the rest of the server uses — so the role list is
 * defined once and cannot drift from the rest of the codebase.
 *
 * @param {Object|null} [user] The caller.
 * @param {Object|null} [caseRow] The case, or null when there is none.
 * @returns {boolean} True when the caller may read the case.
 */
export function canReadCase(user, caseRow) {
	// A case that does not exist is readable by nobody, staff included.
	if (!caseRow) {
		return false;
	}
	if (isOwnerOrAdmin(user)) {
		return true;
	}
	const userId = user?.id;
	const ownerId = caseRow.user_id;
	if (userId === undefined || userId === null || userId === "") {
		return false;
	}
	if (ownerId === undefined || ownerId === null) {
		return false;
	}
	// The ids are strings on both sides (the case row and the signed token),
	// but they are compared as text so that a caller whose token carries the
	// id in another primitive type is not locked out of their own case.
	return String(ownerId) === String(userId);
}

/**
 * Counts the messages the client has sent in a case.
 *
 * This is the number the clarification round cap is measured against: it is
 * the count of the client's own turns, so a case whose six turns are spent is
 * ready for investigation even when the client never confirmed the summary.
 *
 * @param {string} caseId
 * @returns {Promise<number>} How many client messages the case holds.
 */
export async function countClientMessages(caseId) {
	const count = await prisma.supportCaseMessage.count({
		where: { case_id: caseId, role: { in: [CLIENT_ROLE, LEGACY_CLIENT_ROLE] } },
	});
	return Number(count) || 0;
}
