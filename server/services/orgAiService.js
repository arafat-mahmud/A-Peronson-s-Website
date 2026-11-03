import prisma from "../utils/prisma.js";

const DEFAULTS = {
	auto_reply_enabled: false,
	allow_numeric_commitments: false,
	auto_reply_rate_limit_per_hour: 20,
	ai_handoff_threshold: Number.parseFloat(process.env.AI_HANDOFF_THRESHOLD || "0.65"),
	ai_hallucination_threshold: Number.parseFloat(process.env.AI_HALLUCINATION_THRESHOLD || "0.7"),
};

export async function getOrgAiSettings(orgOwnerId = "") {
	const found = await prisma.orgAiSetting.findFirst({
		where: { org_owner_id: String(orgOwnerId || "") },
	});
	return { ...DEFAULTS, ...(found || {}) };
}

export default { getOrgAiSettings };
