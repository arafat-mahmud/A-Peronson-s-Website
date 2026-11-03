/**
 * Read-only opencode configuration for the AI support investigation portal.
 *
 * The read-only lever is the SINGULAR `permission` key, in object syntax, keyed
 * by tool name. Wildcards apply to the tool's input; the last matching rule wins.
 *
 * Two traps this file exists to avoid (both verified live against opencode v2):
 *  - The array form `permissions: [{ action, resource, effect }]` is silently
 *    ignored by opencode v2 and FAILS OPEN. Never convert this to that shape.
 *  - `task` (subagent delegation) is a privilege-escalation path: with no write
 *    tool of its own, an investigator can delegate the write to a subagent.
 *    `task: "deny"` is therefore mandatory, not optional.
 */

const ALWAYS_DENIED_TOOLS = [
	"edit",
	"bash",
	"webfetch",
	"websearch",
	"question",
	"external_directory",
	"doom_loop",
	"task",
];

const ALWAYS_DISABLED_MCP_TOOLS = [
	"render_*",
	"chrome-devtools_*",
	"blender-mcp_*",
	"minecraft_*",
	"github_*",
	"parallel-search_*",
];

export function buildInvestigationConfig({ mcpTools = [] } = {}) {
	const permission = {
		"*": "deny",
		read: {
			"*": "allow",
			// The `.env` denies come in TWO shapes, because opencode matches
			// these patterns as GLOBS and a glob's `*` does not cross a `/`.
			// `*.env` therefore denies `.env` in the root only, and a
			// `server/.env` would slip through it. The `**/` forms deny the
			// file at any depth.
			"*.env": "deny",
			"*.env.*": "deny",
			"**/.env": "deny",
			"**/.env.*": "deny",
			// The example file is a template, not a secret, and it is allowed
			// LAST so that it wins over the denies above.
			"*.env.example": "allow",
		},
		glob: "allow",
		grep: "allow",
		list: "allow",
	};
	for (const tool of ALWAYS_DENIED_TOOLS) {
		permission[tool] = "deny";
	}

	const tools = {};
	for (const pattern of [...ALWAYS_DISABLED_MCP_TOOLS, ...mcpTools]) {
		tools[pattern] = false;
	}

	return {
		default_agent: "investigator",
		permission,
		tools,
		agents: {
			investigator: {
				mode: "primary",
				description:
					"Read-only codebase investigator. Reads and searches source files. Cannot modify files, run commands, delegate to subagents, or use MCP integrations.",
				permission: {
					edit: "deny",
					bash: "deny",
					webfetch: "deny",
					task: "deny",
				},
			},
		},
	};
}

export const ALWAYS_DENIED_TOOL_NAMES = ALWAYS_DENIED_TOOLS;
export const ALWAYS_DISABLED_MCP_PATTERNS = ALWAYS_DISABLED_MCP_TOOLS;

/**
 * Does a permission pattern match a value? `*` matches everything, and `*`
 * inside a pattern matches any run of characters.
 */
function matchesPattern(pattern, value) {
	if (pattern === "*") return true;
	const escaped = String(pattern)
		.replace(/[.+^${}()|[\]\\]/g, "\\$&")
		.replace(/\*/g, ".*");
	return new RegExp(`^${escaped}$`).test(String(value));
}

/**
 * Resolve the EFFECT opencode would apply to one tool action on one resource.
 *
 * opencode's own rule is "last matching rule wins", and it normalises the
 * singular `permission` object into an ordered rule list: the catch-all `*`
 * rule first, then the rules of the named action, in the order they were
 * written. This mirrors that, so the same answer can be reached from the
 * config the runtime is about to send and from the rule list the server
 * resolved from it.
 *
 * Accepts either shape:
 *  - the object form  `{ "*": "deny", read: { "*": "allow", "*.env": "deny" } }`
 *  - the array form   `[{ action, resource, effect }]`
 *
 * An ARRAY OF SOURCES is also accepted, and is how the agent's own permission
 * block is composed with the global one: `[{...global}, {...agent}]`. The
 * later source wins, exactly as it does on the server, where the agent's
 * rules are resolved after the global ones.
 */
export function resolveEffectivePermission(permission, action, resource = "*") {
	const rules = normalizePermissionSources(permission);
	let effect = null;
	for (const rule of rules) {
		if (!matchesPattern(rule.action, action)) continue;
		if (!matchesPattern(rule.resource, resource)) continue;
		effect = rule.effect;
	}
	return effect;
}

/**
 * Turn a permission source (or a list of them) into the ordered rule list
 * opencode would resolve.
 */
function normalizePermissionSources(permission) {
	if (!permission) return [];

	if (Array.isArray(permission)) {
		// A rule list, or a list of permission sources.
		const isRuleList =
			permission.length > 0 &&
			permission.every((entry) => entry && typeof entry === "object" && "effect" in entry);
		if (isRuleList) {
			return permission.map((rule) => ({
				action: rule.action ?? "*",
				resource: rule.resource ?? "*",
				effect: rule.effect,
			}));
		}
		return permission.flatMap((source) => normalizePermissionSources(source));
	}

	if (typeof permission !== "object") return [];

	const rules = [];
	const wildcard = permission["*"];
	if (typeof wildcard === "string") {
		rules.push({ action: "*", resource: "*", effect: wildcard });
	}
	for (const [action, value] of Object.entries(permission)) {
		if (action === "*") continue;
		if (typeof value === "string") {
			rules.push({ action, resource: "*", effect: value });
		} else if (value && typeof value === "object") {
			for (const [pattern, effect] of Object.entries(value)) {
				rules.push({ action, resource: pattern, effect });
			}
		}
	}
	return rules;
}
