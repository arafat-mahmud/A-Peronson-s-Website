import {
	createWorkflowJourney,
	getWorkflowJourneyById,
	getWorkflowJourneyByMatchId,
	transitionWorkflowJourney,
} from "../services/workflowLifecycleService.js";

export async function createJourney(req, res) {
	const row = await createWorkflowJourney({
		...req.body,
		actor_id: req.user?.id,
		source: "workflow_api",
	});
	return res.status(201).json(row);
}

export async function transitionJourney(req, res) {
	const result = await transitionWorkflowJourney(req.params.id, {
		...req.body,
		actor_id: req.user?.id,
		source: "workflow_api",
	});

	if (!result?.ok) {
		return res.status(result.status || 409).json({
			error: result.error?.message || "Transition rejected",
			code: result.error?.code,
			allowed_next_states: result.error?.allowed_next_states || [],
		});
	}

	return res.json(result.journey);
}

export async function getJourney(req, res) {
	const row = await getWorkflowJourneyById(req.params.id);
	if (!row) {
		return res.status(404).json({
			error: "Workflow journey not found",
			code: "WORKFLOW_JOURNEY_NOT_FOUND",
		});
	}
	return res.json(row);
}

export async function getJourneyByMatch(req, res) {
	const row = await getWorkflowJourneyByMatchId(req.params.matchId);
	if (!row) {
		return res.status(404).json({
			error: "Workflow journey not found",
			code: "WORKFLOW_JOURNEY_NOT_FOUND",
		});
	}
	return res.json(row);
}
