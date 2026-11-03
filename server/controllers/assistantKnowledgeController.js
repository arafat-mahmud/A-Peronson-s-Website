import {
	createKnowledgeEntry,
	deleteKnowledgeEntry,
	listKnowledge,
	updateKnowledgeEntry,
} from "../services/assistantService.js";

// The platform FAQ the assistant answers from (streamOpencodeReply reads
// listKnowledge("public_ws")). The service existed but no route exposed it, so
// the Assistant Knowledge tab and the Help Center could never load or save it.
const PUBLIC_KNOWLEDGE_ORG = "public_ws";

export async function listKnowledgeHandler(_req, res) {
	const entries = await listKnowledge(PUBLIC_KNOWLEDGE_ORG);
	return res.json({ entries });
}

export async function createKnowledgeHandler(req, res) {
	const entry = await createKnowledgeEntry(PUBLIC_KNOWLEDGE_ORG, req.body || {});
	return res.status(201).json({ entry });
}

export async function updateKnowledgeHandler(req, res) {
	const entry = await updateKnowledgeEntry(PUBLIC_KNOWLEDGE_ORG, req.params.id, req.body || {});
	return res.json({ entry });
}

export async function deleteKnowledgeHandler(req, res) {
	const deleted = await deleteKnowledgeEntry(PUBLIC_KNOWLEDGE_ORG, req.params.id);
	if (!deleted) {
		return res.status(404).json({ error: "Entry not found" });
	}
	return res.json({ ok: true });
}
