import path from "node:path";
import { jest } from "@jest/globals";

// The Document row is the authorization key for every gated uploads prefix.
// authorizeFilePath refuses to serve a path that no row anchors, so a file
// without a row is not public — it is unreachable, for everyone, the uploader
// included.
//
// These tests drive the real controllers and assert that the row is written at
// upload time, with the ownership fact the authorization needs. They fail
// against the previous code, which wrote no row at all on the upload path (the
// only producer was the AI-moderation backfill, and that is disabled in the
// deployed configuration).

const documentCreate = jest.fn(async (args) => ({ id: "doc-1", ...args.data }));
const documentFindMany = jest.fn(async () => []);
const messageFindMany = jest.fn(async () => []);
const callSessionFindUnique = jest.fn(async () => null);

jest.unstable_mockModule("../../server/utils/prisma.js", () => ({
	default: {
		document: { create: documentCreate, findMany: documentFindMany },
		message: { findMany: messageFindMany },
		callSession: { findUnique: callSessionFindUnique },
	},
}));

const canAccessMatch = jest.fn(async () => true);
const postMessage = jest.fn(async () => ({ id: "m1" }));
jest.unstable_mockModule("../../server/services/messageService.js", () => ({
	canAccessMatch,
	postMessage,
	listFriendMatchIdsForUser: jest.fn(async () => []),
	listMatchesForFactory: jest.fn(async () => []),
	listMatchesForRequirements: jest.fn(async () => []),
	acceptMessageRequest: jest.fn(),
	rejectMessageRequest: jest.fn(),
	listMessagesByMatch: jest.fn(async () => []),
	markThreadRead: jest.fn(),
	postFriendMessage: jest.fn(),
	tieredInbox: jest.fn(async () => []),
}));

jest.unstable_mockModule("../../server/services/chatbotService.js", () => ({
	maybeGenerateBotReply: jest.fn(async () => ({ reply: null })),
}));
jest.unstable_mockModule("../../server/services/communicationPolicyService.js", () => ({
	adjustSenderReputation: jest.fn(),
	getCommunicationPolicyConfig: jest.fn(),
	getWeeklyDecisionQualityReport: jest.fn(),
	listMessageQueueItems: jest.fn(async () => []),
	listPolicyFalsePositiveCandidates: jest.fn(async () => []),
	markPolicyDecisionFalsePositive: jest.fn(),
	upsertCommunicationPolicyConfig: jest.fn(),
}));
jest.unstable_mockModule("../../server/services/imageProcessor.js", () => ({
	isImageFile: jest.fn(() => false),
}));
jest.unstable_mockModule("../../server/services/videoProcessor.js", () => ({
	isVideoFile: jest.fn(() => false),
}));
jest.unstable_mockModule("../../server/services/imageQueue.js", () => ({
	addImageToQueue: jest.fn(),
}));
jest.unstable_mockModule("../../server/services/videoQueue.js", () => ({
	addToQueue: jest.fn(),
}));
jest.unstable_mockModule("../../server/utils/svgSanitizer.js", () => ({
	sanitizeSvgFile: jest.fn(async () => null),
}));

const getCallSession = jest.fn(async () => ({
	id: "call-1",
	recording_status: "pending",
	participant_ids: ["buyer1", "factory1"],
}));
const markRecording = jest.fn(async () => ({
	id: "call-1",
	recording_status: "available",
	recording_url: "/uploads/calls/rec-1.webm",
}));
jest.unstable_mockModule("../../server/services/callSessionService.js", () => ({
	createScheduledCallSession: jest.fn(),
	endCallSession: jest.fn(),
	findOrCreateCallSession: jest.fn(),
	getCallSession,
	getRecordingMetadata: jest.fn(),
	listCallHistory: jest.fn(async () => []),
	listCallsByContract: jest.fn(async () => []),
	markRecording,
	markRecordingViewed: jest.fn(),
	startCallSession: jest.fn(),
}));
jest.unstable_mockModule("../../server/services/friendService.js", () => ({
	buildFriendMatchId: jest.fn(() => "friend:a:b"),
	isFriendConnected: jest.fn(async () => true),
}));
jest.unstable_mockModule("../../server/services/userService.js", () => ({
	findUserById: jest.fn(async () => ({ id: "buyer1", name: "Buyer" })),
}));
jest.unstable_mockModule("../../server/services/webrtcService.js", () => ({
	buildIceServers: jest.fn(() => []),
}));
jest.unstable_mockModule("../../server/utils/pendingInvites.js", () => ({
	consumePendingInvites: jest.fn(() => []),
	enqueuePendingInvites: jest.fn(),
}));

// multer writes to disk; the search controller only needs the file it was
// handed, so the storage engine is replaced with a pass-through.
const multerMock = Object.assign(
	() => ({
		single: () => (req, res, cb) => cb(null),
		array: () => (req, res, cb) => cb(null),
	}),
	{ diskStorage: () => ({}), memoryStorage: () => ({}) },
);
jest.unstable_mockModule("multer", () => ({ default: multerMock }));

const { uploadMessageAttachment } = await import("../../server/controllers/messageController.js");
const { uploadRecordingFile } = await import("../../server/controllers/callSessionController.js");
const { uploadSearchImage } = await import("../../server/controllers/searchController.js");

function fakeRes() {
	const res = {
		statusCode: 200,
		body: undefined,
		status(code) {
			res.statusCode = code;
			return res;
		},
		json(payload) {
			res.body = payload;
			return res;
		},
	};
	return res;
}

const UPLOADS = path.join(process.cwd(), "server", "uploads");

beforeEach(() => {
	documentCreate.mockClear();
	canAccessMatch.mockClear();
	postMessage.mockClear();
	getCallSession.mockClear();
	markRecording.mockClear();
});

describe("chat attachment upload writes its Document row", () => {
	test("writes a chat_attachment row naming the uploader and the file", async () => {
		const res = fakeRes();
		await uploadMessageAttachment(
			{
				file: {
					path: path.join(UPLOADS, "chat", "1700000000000-photo.png"),
					originalname: "photo.png",
					mimetype: "image/png",
					size: 42,
				},
				params: { matchId: "friend:buyer1:factory1" },
				body: {},
				user: { id: "buyer1", role: "buyer" },
			},
			res,
		);

		expect(res.statusCode).toBe(201);
		expect(documentCreate).toHaveBeenCalledTimes(1);
		const row = documentCreate.mock.calls[0][0].data;
		expect(row).toMatchObject({
			uploaded_by: "buyer1",
			entity_type: "chat_attachment",
			entity_id: "1700000000000-photo.png",
			file_path: "/uploads/chat/1700000000000-photo.png",
		});
	});

	// The row must be written for every accepted file type, not only media. The
	// backfill only ever covered image/video, which is how a chat .pdf/.txt/.html
	// ended up with no row at all and unreachable for everyone.
	test("writes the row for a non-media attachment too", async () => {
		await uploadMessageAttachment(
			{
				file: {
					path: path.join(UPLOADS, "chat", "1700000000001-notes.pdf"),
					originalname: "notes.pdf",
					mimetype: "application/pdf",
					size: 42,
				},
				params: { matchId: "friend:buyer1:factory1" },
				body: {},
				user: { id: "buyer1", role: "buyer" },
			},
			fakeRes(),
		);

		expect(documentCreate).toHaveBeenCalledTimes(1);
		expect(documentCreate.mock.calls[0][0].data).toMatchObject({
			entity_type: "chat_attachment",
			entity_id: "1700000000001-notes.pdf",
			file_path: "/uploads/chat/1700000000001-notes.pdf",
		});
	});
});

describe("call recording upload writes its Document row", () => {
	test("writes a call_recording row naming the owning call and the uploader", async () => {
		const res = fakeRes();
		await uploadRecordingFile(
			{
				file: {
					path: path.join(UPLOADS, "calls", "1700000000002-rec.webm"),
					originalname: "rec.webm",
					mimetype: "video/webm",
					size: 1024,
				},
				params: { callId: "call-1" },
				body: {},
				user: { id: "buyer1", role: "buyer" },
			},
			res,
		);

		expect(res.statusCode).toBe(201);
		expect(documentCreate).toHaveBeenCalledTimes(1);
		const row = documentCreate.mock.calls[0][0].data;
		expect(row).toMatchObject({
			uploaded_by: "buyer1",
			entity_type: "call_recording",
			// The owning call id, NOT the file name: the recording_url column is
			// caller-supplied, so the session has to be named by a fact the
			// caller cannot write.
			entity_id: "call-1",
			file_path: "/uploads/calls/1700000000002-rec.webm",
		});
	});
});

describe("search image upload writes its Document row", () => {
	test("writes a search_image row naming the uploader", async () => {
		const res = fakeRes();
		await uploadSearchImage(
			{
				file: {
					path: path.join(UPLOADS, "search", "1700000000003-q.png"),
					filename: "1700000000003-q.png",
					originalname: "q.png",
					mimetype: "image/png",
					size: 512,
				},
				body: {},
				user: { id: "buyer1", role: "buyer" },
			},
			res,
		);

		expect(res.statusCode).toBe(200);
		expect(documentCreate).toHaveBeenCalledTimes(1);
		expect(documentCreate.mock.calls[0][0].data).toMatchObject({
			uploaded_by: "buyer1",
			entity_type: "search_image",
			entity_id: "1700000000003-q.png",
			file_path: "/uploads/search/1700000000003-q.png",
		});
	});
});
