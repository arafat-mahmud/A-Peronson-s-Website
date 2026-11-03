import {
	createFeedPost,
	deleteFeedPost,
	listFeedPosts,
	searchFeedPosts,
	updateFeedPost,
} from "../services/feedPostService.js";
import { handleControllerError } from "../utils/permissions.js";

export async function getMyFeedPosts(req, res) {
	try {
		const rows = await listFeedPosts({
			authorId: req.user?.id,
			includeDrafts: true,
			status: "",
		});
		return res.json(rows);
	} catch (error) {
		return handleControllerError(res, error);
	}
}

export async function searchFeedPostsController(req, res) {
	try {
		const { q, cursor, limit } = req.query;
		const result = await searchFeedPosts({
			query: q || "",
			cursor: Number.isFinite(Number(cursor)) ? Math.max(0, Math.floor(Number(cursor))) : 0,
			limit: Math.min(50, Math.max(1, Number(limit) || 20)),
		});
		return res.json(result);
	} catch (error) {
		return handleControllerError(res, error);
	}
}

export async function postFeedPost(req, res) {
	try {
		const row = await createFeedPost(req.user, req.body || {});
		return res.status(201).json(row);
	} catch (error) {
		return handleControllerError(res, error);
	}
}

export async function patchFeedPost(req, res) {
	try {
		const row = await updateFeedPost(req.user, req.params.postId, req.body || {});
		return res.json(row);
	} catch (error) {
		return handleControllerError(res, error);
	}
}

export async function removeFeedPost(req, res) {
	try {
		await deleteFeedPost(req.user, req.params.postId);
		return res.json({ ok: true });
	} catch (error) {
		return handleControllerError(res, error);
	}
}
