import { useCallback, useEffect, useReducer } from "react";
import { apiRequest, getToken } from "../lib/auth.js";
import { subscribeToCase } from "../lib/caseRealtime.js";

// The state hook for one support investigation case.
//
// It owns the case row, the conversation, the live progress and the report,
// and it is the only thing that talks to the case API: the page renders what
// this hook returns and calls the actions it exposes.
//
// The HTTP contract is contracts.md §3 and the event contract is §4. Both
// belong to the server; this hook only reads them.

const INITIAL_CASE_STATE = {
	caseRow: null,
	messages: [],
	status: null,
	error: null,
	report: null,
	progress: [],
	findings: [],
	attachments: [],
	loading: false,
};

function compareBySequence(a, b) {
	const left = Number(a?.sequence);
	const right = Number(b?.sequence);
	if (Number.isFinite(left) && Number.isFinite(right) && left !== right) {
		return left - right;
	}
	return 0;
}

// Merges messages into a conversation, replacing a message already there.
//
// The same message arrives twice: once as the POST response and once over the
// event stream, because the server appends it and then announces it. Without
// this, every message would appear twice in the transcript.
function mergeMessages(existing, incoming) {
	const list = Array.isArray(existing) ? [...existing] : [];
	for (const message of incoming || []) {
		if (message && typeof message === "object") {
			const id = message.id ?? null;
			const index = id ? list.findIndex((entry) => entry?.id === id) : -1;
			if (index >= 0) {
				list[index] = { ...list[index], ...message };
			} else {
				list.push(message);
			}
		}
	}
	return list.sort(compareBySequence);
}

// Adds attachments to the case's attachment list, without duplicating one
// that is already there.
function mergeAttachments(existing, incoming) {
	const list = Array.isArray(existing) ? [...existing] : [];
	for (const attachment of incoming || []) {
		if (attachment?.file_path) {
			const index = list.findIndex((entry) => entry?.file_path === attachment.file_path);
			if (index >= 0) {
				list[index] = { ...list[index], ...attachment };
			} else {
				list.push(attachment);
			}
		}
	}
	return list;
}

// Puts one investigation role's progress in the list, replacing its earlier
// entry and keeping its position.
function upsertProgress(list, entry) {
	const rows = Array.isArray(list) ? [...list] : [];
	const index = rows.findIndex((row) => row?.role === entry?.role);
	if (index >= 0) {
		rows[index] = { ...rows[index], ...entry };
	} else {
		rows.push(entry);
	}
	return rows;
}

// Reduces an attachment to the three keys the message endpoint accepts.
function toAttachmentPayload(attachment) {
	const filePath = attachment?.file_path ?? null;
	if (!filePath) {
		return null;
	}
	const payload = { file_path: String(filePath) };
	if (attachment?.mime_type) {
		payload.mime_type = String(attachment.mime_type);
	}
	const byteSize = Number(attachment?.byte_size);
	if (Number.isFinite(byteSize) && byteSize > 0) {
		payload.byte_size = byteSize;
	}
	return payload;
}

function buildAttachmentPayload(attachments) {
	const payload = [];
	for (const attachment of attachments || []) {
		const entry = toAttachmentPayload(attachment);
		if (entry) {
			payload.push(entry);
		}
	}
	return payload;
}

// The case status changed.
function applyStatusEvent(state, payload) {
	const status = payload?.status ?? null;
	if (!status) {
		return state;
	}
	const summary = payload?.summary ? { summary: payload.summary } : {};
	const caseRow = state.caseRow ? { ...state.caseRow, status, ...summary } : state.caseRow;
	return { ...state, status, caseRow };
}

// The report is ready.
function applyReportEvent(state, payload) {
	const reportStatus = payload?.reportStatus ?? null;
	const caseRow = state.caseRow
		? { ...state.caseRow, report_status: reportStatus ?? state.caseRow.report_status }
		: state.caseRow;
	return {
		...state,
		report: { report: payload?.report ?? null, reportStatus },
		caseRow,
	};
}

// Applies one realtime event (contracts.md §4) to the case state.
function applyCaseEvent(state, action) {
	const { eventType, payload } = action;
	switch (eventType) {
		case "support.case.message":
			return { ...state, messages: mergeMessages(state.messages, [payload?.message]) };
		case "support.case.status":
			return applyStatusEvent(state, payload);
		case "support.case.progress": {
			const role = payload?.role ?? null;
			if (!role) {
				return state;
			}
			const entry = { role, status: payload?.status ?? null, detail: payload?.detail ?? null };
			return { ...state, progress: upsertProgress(state.progress, entry) };
		}
		case "support.case.finding": {
			const finding = payload?.finding ?? null;
			if (!finding) {
				return state;
			}
			return { ...state, findings: [...state.findings, { role: payload?.role ?? null, finding }] };
		}
		case "support.case.report":
			return applyReportEvent(state, payload);
		default:
			return state;
	}
}

// Applies the answer to a posted message: the two new messages, the
// attachments that travelled with them, and the "ready" flag.
function applySent(state, action) {
	const { data, attachments } = action;
	const ready = data?.ready === true;
	const caseRow =
		ready && state.caseRow ? { ...state.caseRow, status: "investigating" } : state.caseRow;
	return {
		...state,
		messages: mergeMessages(state.messages, [data?.message, data?.reply]),
		attachments: mergeAttachments(state.attachments, attachments),
		status: ready ? "investigating" : state.status,
		caseRow,
	};
}

// Every state transition of the hook, in one place.
function caseReducer(state, action) {
	switch (action.type) {
		case "reset":
			return { ...INITIAL_CASE_STATE };
		case "load:start":
			return { ...state, loading: true, error: null };
		case "load:ok":
			return {
				...state,
				loading: false,
				error: null,
				caseRow: action.caseRow,
				messages: Array.isArray(action.messages) ? action.messages : [],
				status: action.status ?? null,
			};
		case "error:set":
			return { ...state, loading: false, error: action.error ?? null };
		case "error:clear":
			return { ...state, error: null };
		case "event":
			return applyCaseEvent(state, action);
		case "sent":
			return applySent(state, action);
		case "attached":
			return { ...state, attachments: mergeAttachments(state.attachments, [action.attachment]) };
		case "confirmed":
			return {
				...state,
				caseRow: action.caseRow,
				status: action.caseRow?.status ?? "investigating",
			};
		default:
			return state;
	}
}

// GET /support/cases/:caseId
async function loadCaseAction(caseId, dispatch) {
	if (!caseId) {
		dispatch({ type: "reset" });
		return null;
	}
	dispatch({ type: "load:start" });
	try {
		const data = await apiRequest(`/support/cases/${caseId}`, { token: getToken() });
		dispatch({
			type: "load:ok",
			caseRow: data?.case ?? null,
			messages: data?.messages,
			status: data?.case?.status ?? null,
		});
		return data?.case ?? null;
	} catch (err) {
		dispatch({ type: "error:set", error: err.message || "Unable to load this support case." });
		return null;
	}
}

// POST /support/cases/:caseId/messages
async function sendMessageAction(caseId, dispatch, content, attachmentList) {
	const text = String(content ?? "").trim();
	if (!caseId) {
		dispatch({ type: "error:set", error: "No support case is open." });
		return null;
	}
	if (!text) {
		dispatch({ type: "error:set", error: "Write a message before sending." });
		return null;
	}
	const attachments = buildAttachmentPayload(attachmentList);
	try {
		const data = await apiRequest(`/support/cases/${caseId}/messages`, {
			method: "POST",
			token: getToken(),
			body: { content: text, ...(attachments.length > 0 ? { attachments } : {}) },
		});
		dispatch({ type: "sent", data, attachments });
		return data ?? null;
	} catch (err) {
		dispatch({ type: "error:set", error: err.message || "Unable to send the message." });
		return null;
	}
}

// POST /documents - the file lands in the gated /uploads/support namespace and
// is served only through a signed url. The document row is anchored on the
// CASE, and it is written at upload time, which is the only moment the
// uploader is known.
async function attachFileAction(caseId, dispatch, file) {
	if (!caseId) {
		dispatch({ type: "error:set", error: "No support case is open." });
		return null;
	}
	if (!file) {
		dispatch({ type: "error:set", error: "No file was chosen." });
		return null;
	}
	const form = new FormData();
	form.append("file", file);
	form.append("entity_type", "support_case");
	form.append("entity_id", caseId);
	form.append("type", "attachment");
	try {
		const doc = await apiRequest("/documents", {
			method: "POST",
			token: getToken(),
			body: form,
		});
		const descriptor = toAttachmentPayload({
			file_path: doc?.file_path,
			mime_type: file.type || null,
			byte_size: file.size,
		});
		if (!descriptor) {
			dispatch({
				type: "error:set",
				error: "The file was uploaded but the server did not return a path.",
			});
			return null;
		}
		dispatch({ type: "attached", attachment: descriptor });
		return descriptor;
	} catch (err) {
		dispatch({ type: "error:set", error: err.message || "Unable to upload the attachment." });
		return null;
	}
}

// POST /support/cases/:caseId/confirm
async function confirmCaseAction(caseId, dispatch) {
	if (!caseId) {
		dispatch({ type: "error:set", error: "No support case is open." });
		return null;
	}
	try {
		const data = await apiRequest(`/support/cases/${caseId}/confirm`, {
			method: "POST",
			token: getToken(),
		});
		const caseRow = data?.case ?? null;
		dispatch({ type: "confirmed", caseRow });
		return caseRow;
	} catch (err) {
		dispatch({ type: "error:set", error: err.message || "Unable to confirm the case." });
		return null;
	}
}

/**
 * Loads one case and keeps it live.
 *
 * @param {string | { caseId?: string }} [caseIdInput] - The support case id,
 *   either directly or as `{ caseId }`. With no id the hook is inert: it
 *   exposes the same actions and they report that no case is open.
 * @returns {Object} The case state and its actions.
 */
function useSupportCase(caseIdInput = null) {
	const caseId = typeof caseIdInput === "string" ? caseIdInput : (caseIdInput?.caseId ?? null);
	const [state, dispatch] = useReducer(caseReducer, INITIAL_CASE_STATE);

	const clearError = useCallback(() => {
		dispatch({ type: "error:clear" });
	}, []);

	const refresh = useCallback(() => loadCaseAction(caseId, dispatch), [caseId]);

	const send = useCallback(
		(content, attachmentList) => sendMessageAction(caseId, dispatch, content, attachmentList),
		[caseId],
	);

	const attach = useCallback((file) => attachFileAction(caseId, dispatch, file), [caseId]);

	const confirm = useCallback(() => confirmCaseAction(caseId, dispatch), [caseId]);

	useEffect(() => {
		refresh();
		if (!caseId) {
			return;
		}
		const unsubscribe = subscribeToCase(caseId, (eventType, payload) => {
			dispatch({ type: "event", eventType, payload });
		});
		return () => {
			unsubscribe?.();
		};
	}, [caseId, refresh]);

	return {
		caseRow: state.caseRow,
		messages: state.messages,
		status: state.status,
		error: state.error,
		report: state.report,
		progress: state.progress,
		findings: state.findings,
		attachments: state.attachments,
		loading: state.loading,
		send,
		attach,
		confirm,
		refresh,
		clearError,
	};
}

export {
	buildAttachmentPayload,
	caseReducer,
	mergeAttachments,
	mergeMessages,
	toAttachmentPayload,
	upsertProgress,
	useSupportCase,
};
