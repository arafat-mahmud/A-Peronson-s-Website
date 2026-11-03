import {
	buildInvestigationConfig,
	resolveEffectivePermission,
} from "../../server/services/investigation/runtimeConfig.js";

/**
 * Every effect string in a permission block, at any depth.
 *
 * A permission block is a map of action -> effect, where the effect is either
 * a string ("allow" / "deny" / "ask") or a nested map of resource pattern ->
 * effect. The nested map is a resource-scoped rule set, and its leaves are
 * effects exactly like the top-level values are.
 *
 * This walker is written here, in the test, and NOT taken from the module
 * under test: a walker that only descended one level would find no "allow" in
 * a nested rule set and wave it through.
 */
function leafEffects(value, found = []) {
	if (typeof value === "string") {
		found.push(value);
		return found;
	}
	if (value && typeof value === "object") {
		for (const nested of Object.values(value)) {
			leafEffects(nested, found);
		}
	}
	return found;
}

describe("investigation runtime config (server/services/investigation/runtimeConfig.js)", () => {
	test("uses the singular 'permission' key in object syntax", () => {
		const config = buildInvestigationConfig();
		expect(config.permission).toBeDefined();
		expect(config.permissions).toBeUndefined();
		expect(typeof config.permission).toBe("object");
	});

	test("denies everything first, then allows only read-only tools", () => {
		const { permission } = buildInvestigationConfig();
		expect(permission["*"]).toBe("deny");
		expect(permission.read).toEqual({
			"*": "allow",
			"*.env": "deny",
			"*.env.*": "deny",
			// The `**/` forms deny the file at ANY depth. opencode matches
			// these patterns as globs and a glob's `*` does not cross a `/`,
			// so `*.env` alone would leave a `server/.env` readable.
			"**/.env": "deny",
			"**/.env.*": "deny",
			"*.env.example": "allow",
		});
		expect(permission.glob).toBe("allow");
		expect(permission.grep).toBe("allow");
		expect(permission.list).toBe("allow");
	});

	test("denies every mutating or ambient capability", () => {
		const { permission } = buildInvestigationConfig();
		for (const key of [
			"edit",
			"bash",
			"webfetch",
			"websearch",
			"question",
			"external_directory",
			"doom_loop",
			"task",
		]) {
			expect(permission[key]).toBe("deny");
		}
	});

	// The `tools` block disables the TOOLS of a named MCP server, not the
	// server itself. The containment that actually removes the servers is the
	// isolated config directory the runtime is spawned with, and that is proved
	// live by the spike gate (`mcp.list()` is empty).
	test("disables the tools of the named MCP servers by tool glob", () => {
		const config = buildInvestigationConfig();
		expect(config.tools["render_*"]).toBe(false);
		expect(config.tools["chrome-devtools_*"]).toBe(false);
		expect(config.tools["blender-mcp_*"]).toBe(false);
		expect(config.tools["minecraft_*"]).toBe(false);
		expect(config.tools["github_*"]).toBe(false);
	});

	test("disables the tools of an explicitly requested extra MCP server too", () => {
		const config = buildInvestigationConfig({ mcpTools: ["my-server_*"] });
		expect(config.tools["my-server_*"]).toBe(false);
	});

	test("ships an investigator agent that also denies edit and bash", () => {
		const { permission, agents } = buildInvestigationConfig();
		expect(agents.investigator.mode).toBe("primary");
		// Composed, not shape-based: a nested `edit: { "*.txt": "deny" }` is a
		// NARROWING and must not be rejected for not being the string "deny".
		for (const action of ["edit", "bash", "task"]) {
			expect(
				resolveEffectivePermission([permission, agents.investigator.permission], action, "*"),
			).toBe("deny");
		}
		expect(buildInvestigationConfig().default_agent).toBe("investigator");
	});

	// The NON-LIVE gate. The live spike proves the behaviour; this proves the
	// CONFIG, so a regression in the permission set fails an ordinary commit
	// instead of waiting for a night-time run of the spike.
	describe("the resolved permission set", () => {
		const { permission, agents } = buildInvestigationConfig();

		test("denies every mutating tool", () => {
			for (const action of ["edit", "write", "patch", "bash", "shell", "task", "subagent"]) {
				expect(resolveEffectivePermission(permission, action, "*")).toBe("deny");
			}
		});

		test("denies every ambient capability", () => {
			for (const action of [
				"webfetch",
				"websearch",
				"question",
				"external_directory",
				"doom_loop",
				"todowrite",
				"skill",
				"lsp",
			]) {
				expect(resolveEffectivePermission(permission, action, "*")).toBe("deny");
			}
		});

		test("allows exactly the read-only tools", () => {
			for (const action of ["read", "glob", "grep", "list"]) {
				expect(resolveEffectivePermission(permission, action, "server/server.js")).toBe("allow");
			}
		});

		test("denies reading .env and everything that looks like one", () => {
			expect(resolveEffectivePermission(permission, "read", ".env")).toBe("deny");
			expect(resolveEffectivePermission(permission, "read", "*.env")).toBe("deny");
			expect(resolveEffectivePermission(permission, "read", "*.env.local")).toBe("deny");
			expect(resolveEffectivePermission(permission, "read", "*.env.production")).toBe("deny");
		});

		// The `**/` patterns are what deny the file at a DEPTH. opencode
		// matches them as globs, and a glob's `*` does not cross a `/`, so
		// `*.env` denies the root `.env` only and a `server/.env` would be
		// readable without them.
		test("denies reading a .env at a depth", () => {
			for (const resource of [
				"server/.env",
				"server/.env.local",
				"server/services/.env",
				"server/services/.env.production",
				"src/.env",
			]) {
				expect(resolveEffectivePermission(permission, "read", resource)).toBe("deny");
			}
		});

		test("still allows the committed example file", () => {
			expect(resolveEffectivePermission(permission, "read", "*.env.example")).toBe("allow");
		});

		test("denies a tool that is not named at all", () => {
			expect(resolveEffectivePermission(permission, "some_unknown_tool", "*")).toBe("deny");
		});

		// The agent's own permission block is resolved AFTER the global one, so
		// it has the last word. Widening it - "write": "allow", or a read rule
		// that re-opens "*.env" - would hand the investigator a capability the
		// global map denies, and the global map alone would not notice.
		//
		// The assertions below are made against the COMPOSED effective
		// permission, not against the shape of the config object. A shape check
		// only sees the top level: `edit: { "*.txt": "allow" }` is an object, so
		// a top-level "is it the string allow" test waves it through, and the
		// server would grant `edit` for every .txt file.
		//
		// Every expected value below is a literal in this file. Nothing is
		// imported from the module under test except the resolver, so the
		// assertions cannot be satisfied by the module and the test agreeing
		// with each other.
		const MUTATING_ACTIONS = [
			"edit",
			"write",
			"patch",
			"multi_edit",
			"bash",
			"shell",
			"task",
			"subagent",
			"webfetch",
			"websearch",
			"external_directory",
			"question",
			"doom_loop",
		];

		// A sweep, not just "*": a resource-scoped rule in the agent block only
		// bites on the resources it names.
		const RESOURCE_SWEEP = [
			"*",
			"*.txt",
			"*.sh",
			"*.js",
			"*.jsx",
			"*.ts",
			"*.tsx",
			"*.md",
			"*.pdf",
			"*.csv",
			"*.json",
			".env",
			"*.env",
			"*.env.local",
			"*.env.production",
			"server/server.js",
			"src/App.jsx",
			"package.json",
		];

		const SENSITIVE_RESOURCES = [".env", "*.env", "*.env.local", "*.env.production"];

		/**
		 * THE GATE. An agent permission block is acceptable only if it is
		 * restrictive. Three rules, each asserted on its own so a failure says
		 * WHICH rule was broken:
		 *
		 *  1. it contains no "allow" at any depth - a nested object is a
		 *     resource-scoped rule set and its leaves are effects too;
		 *  2. composed with the global map, every mutating action is still
		 *     denied on every swept resource;
		 *  3. composed with the global map, a denied read is STILL denied.
		 *
		 * Rule 3 is "deny" VERBATIM, the same treatment rule 2 gives a
		 * mutating action, and NOT "not allow".
		 *
		 * The reason is that "ask" is not a neutral middle ground on the read
		 * side. opencode v2's own default is `read *.env -> ask`, so the
		 * explicit "deny" this config carries is a deliberate STRENGTHENING
		 * of the default. A rule that accepted "ask" would permit weakening
		 * that denial back to the default - a hard deny silently downgraded
		 * to a prompt - and upstream has reports of an "ask" being
		 * auto-approved in some configurations (anomalyco/opencode issues
		 * #55593 and #54790). A denial that can be turned into a prompt is
		 * not a denial, so the composed effect on a sensitive resource has to
		 * be exactly "deny".
		 */
		function expectNoAllowAtAnyDepth(agentPermission) {
			expect(leafEffects(agentPermission)).not.toContain("allow");
		}

		function expectMutatingActionsStillDenied(agentPermission) {
			for (const action of MUTATING_ACTIONS) {
				for (const resource of RESOURCE_SWEEP) {
					expect(resolveEffectivePermission([permission, agentPermission], action, resource)).toBe(
						"deny",
					);
				}
			}
		}

		function expectSensitiveReadsStillDenied(agentPermission) {
			for (const resource of SENSITIVE_RESOURCES) {
				expect(resolveEffectivePermission([permission, agentPermission], "read", resource)).toBe(
					"deny",
				);
			}
		}

		test("the investigator's own permission set contains no allow at any depth", () => {
			expectNoAllowAtAnyDepth(agents.investigator.permission);
		});

		test("the investigator's own permission set does not widen a denied action", () => {
			expectMutatingActionsStillDenied(agents.investigator.permission);
		});

		test("the investigator's own permission set does not downgrade a denied read", () => {
			expectSensitiveReadsStillDenied(agents.investigator.permission);
		});

		test("the global map denies every mutating action on every swept resource", () => {
			for (const action of MUTATING_ACTIONS) {
				for (const resource of RESOURCE_SWEEP) {
					expect(resolveEffectivePermission(permission, action, resource)).toBe("deny");
				}
			}
		});

		test("the global map denies reading .env and everything that looks like one", () => {
			for (const resource of SENSITIVE_RESOURCES) {
				expect(resolveEffectivePermission(permission, "read", resource)).toBe("deny");
			}
		});

		test("the global map allows exactly the read-only tools", () => {
			for (const action of ["read", "glob", "grep", "list"]) {
				expect(resolveEffectivePermission(permission, action, "server/server.js")).toBe("allow");
			}
		});

		test("an 'ask' entry is a narrowing and does not trip the gate", () => {
			// The same three rules, applied to a block that ASKS instead of
			// granting. The base is a literal on purpose: this test is about the
			// GATE's rules, and it must not be affected by a change to the
			// shipped config.
			//
			// "ask" narrows only where the global map ALLOWS. For the sensitive
			// resources the global map DENIES, so an "ask" there is not a
			// narrowing at all: it downgrades a hard deny to a prompt, which
			// is the hole this rule was tightened to close. The sensitive
			// patterns are therefore re-denied explicitly, and that is the
			// honest form of "ask is a narrowing".
			const asking = {
				edit: "deny",
				bash: "deny",
				webfetch: "deny",
				task: "deny",
				read: { "*": "ask", "*.env": "deny", "*.env.*": "deny" },
			};
			expectNoAllowAtAnyDepth(asking);
			expectMutatingActionsStillDenied(asking);
			expectSensitiveReadsStillDenied(asking);

			// The narrowing is real: an ordinary source file is ASKED for, not
			// granted.
			expect(resolveEffectivePermission([permission, asking], "read", "server/server.js")).toBe(
				"ask",
			);

			// The negative control for rule 3: the SAME helper rejects the
			// form that downgrades the hard deny. Without it, rule 3 could be
			// weakened back to "not allow" and nothing in this file would
			// notice - which is precisely the weakening that was found.
			//
			// The expected message is matched too, so the control cannot pass
			// on an unrelated error: it has to be the "deny" assertion that
			// failed.
			const downgrading = { read: "ask" };
			expect(resolveEffectivePermission([permission, downgrading], "read", ".env")).toBe("ask");
			expect(() => expectSensitiveReadsStillDenied(downgrading)).toThrow(/Expected: "deny"/);
		});
	});
});
