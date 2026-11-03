import {
	createRating,
	getAggregateForProfile,
	getProfileRatingsSummary,
	getRatingsForProfiles,
	getSearchRatingCards,
	listPendingFeedbackRequestsForUser,
	recordMilestone,
} from "../services/ratingsService.js";

export async function getProfileRatings(req, res) {
	const summary = await getProfileRatingsSummary(req.params.profileKey);
	return res.json(summary);
}

export async function getProfileRatingsBatch(req, res) {
	const keys = String(req.query.profile_keys || "")
		.split(",")
		.map((entry) => entry.trim())
		.filter(Boolean);
	return res.json(await getRatingsForProfiles(keys));
}

export async function getProfileRatingsAggregate(req, res) {
	return res.json(await getAggregateForProfile(req.params.profileKey));
}

export async function getSearchRatings(req, res) {
	const keys = String(req.query.profile_keys || "")
		.split(",")
		.map((entry) => entry.trim())
		.filter(Boolean);
	return res.json(await getSearchRatingCards(keys));
}

export async function submitRating(req, res) {
	const row = await createRating({
		profileKey: req.params.profileKey,
		fromUserId: req.user.id,
		interactionType: req.body?.interaction_type,
		score: req.body?.score,
		comment: req.body?.comment,
		categories: req.body?.categories || {},
		reliabilityFlags: req.body?.reliability_flags || {},
	});
	return res.status(201).json(row);
}

export async function getFeedbackRequests(req, res) {
	const rows = await listPendingFeedbackRequestsForUser(req.user?.id);
	return res.json({ items: rows });
}

export async function completeMilestone(req, res) {
	const response = await recordMilestone({
		profileKey: req.body?.profile_key,
		counterpartyId: req.body?.counterparty_id,
		interactionType: req.body?.interaction_type,
		milestone: req.body?.milestone,
		actorId: req.user.id,
	});

	if (!response) {
		return res.status(400).json({
			error: "profile_key, counterparty_id and milestone are required",
		});
	}
	return res.status(201).json(response);
}
