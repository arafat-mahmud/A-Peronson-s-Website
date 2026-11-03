import { logWarn } from "../../utils/logger.js";

/**
 * Model chain for the read-only investigation runtime.
 *
 * Only FREE models are ever used. The chain is ordered: the first model that
 * the spawned server actually offers wins, the rest are fallbacks.
 *
 * The constraint is not advisory. A caller that puts a paid model or a
 * different provider into the configuration would make the portal spend money
 * on somebody else's behalf, so an entry that is not a free `opencode` model
 * is refused, loudly.
 */

const FREE_PROVIDER_ID = "opencode";

export const DEFAULT_MODEL_CHAIN = [
	"deepseek-v4.1-flash-free",
	"mimo-v2.6-flash-free",
	"glm-5.3-flash-free",
	"minimax-m3.1-flash-free",
	"nemotron-3-ultra-free",
	"longcat-2.5-preview-free",
	"nemotron-3.5-lightning-free",
	"beam-free",
	"nemotron-3.5-super-vl-free",
	"big-pickle",
].map((id) => ({ id, providerID: FREE_PROVIDER_ID }));

/** The models known to be on the free tier. */
const KNOWN_FREE_MODEL_IDS = new Set(DEFAULT_MODEL_CHAIN.map((model) => model.id));

/**
 * Is this a free model of the opencode provider?
 *
 * The provider names its free tier with a `-free` suffix (and one model,
 * `big-pickle`, without one), so a model the provider adds later is still
 * accepted, while a paid model on the same provider is not.
 */
export function isFreeOpencodeModel(id, providerID) {
	if (providerID !== FREE_PROVIDER_ID) return false;
	if (KNOWN_FREE_MODEL_IDS.has(id)) return true;
	return id.endsWith("-free") || id === "big-pickle";
}

export function parseModelChain(value) {
	if (typeof value !== "string" || !value.trim()) return [...DEFAULT_MODEL_CHAIN];
	const seen = new Set();
	const chain = [];
	for (const raw of value.split(",")) {
		const entry = raw.trim();
		if (!entry) continue;
		const slash = entry.indexOf("/");
		const providerID = slash > 0 ? entry.slice(0, slash) : FREE_PROVIDER_ID;
		const id = slash > 0 ? entry.slice(slash + 1) : entry;
		if (!id) continue;
		if (!isFreeOpencodeModel(id, providerID)) {
			logWarn("investigation model chain refused a non-free model", {
				entry,
				providerID,
				id,
				allowed: "the free opencode tier only",
			});
			continue;
		}
		if (seen.has(id)) continue;
		seen.add(id);
		chain.push({ id, providerID });
	}
	return chain.length > 0 ? chain : [...DEFAULT_MODEL_CHAIN];
}
