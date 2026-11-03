import fs from "node:fs";
import path from "node:path";
import {
	findMissingEnvVars,
	MIN_SIGNING_SECRET_LENGTH,
	REQUIRED_ENV_VARS,
} from "../../server/utils/envValidation.js";

// The signing secret is the HMAC key behind every private-file url, and the
// server used to boot without it: /api/files/sign answered 503 for every
// path, the static mount 404ed the gated prefixes, and every private file
// became unreachable by anyone - with no boot-time signal at all.

const SECRET = "a".repeat(64);

describe("required environment variables (server/utils/envValidation.js)", () => {
	test("the signing secret is required", () => {
		expect(REQUIRED_ENV_VARS).toContain("UPLOADS_SIGNING_SECRET");
	});

	test("a complete environment has no problems", () => {
		const env = {
			DATABASE_URL: "postgresql://x",
			JWT_SECRET: "y".repeat(32),
			UPLOADS_SIGNING_SECRET: SECRET,
		};
		expect(findMissingEnvVars(env)).toEqual([]);
	});

	test("an unset signing secret is a boot failure, not a warning", () => {
		const env = { DATABASE_URL: "postgresql://x", JWT_SECRET: "y".repeat(32) };
		expect(findMissingEnvVars(env)).toContain("UPLOADS_SIGNING_SECRET");
	});

	test("a blank signing secret is a boot failure", () => {
		const env = {
			DATABASE_URL: "postgresql://x",
			JWT_SECRET: "y".repeat(32),
			UPLOADS_SIGNING_SECRET: "   ",
		};
		expect(findMissingEnvVars(env)).toContain("UPLOADS_SIGNING_SECRET");
	});

	// A one-character secret signs and verifies just as happily as a real one.
	// The length floor is what makes it a key.
	test("a signing secret below the minimum length is a boot failure", () => {
		const env = {
			DATABASE_URL: "postgresql://x",
			JWT_SECRET: "y".repeat(32),
			UPLOADS_SIGNING_SECRET: "a".repeat(MIN_SIGNING_SECRET_LENGTH - 1),
		};
		const problems = findMissingEnvVars(env);
		expect(problems).toHaveLength(1);
		expect(problems[0]).toMatch(/UPLOADS_SIGNING_SECRET/);
		expect(problems[0]).toMatch(/32/);
	});

	test("a signing secret at exactly the minimum length is accepted", () => {
		const env = {
			DATABASE_URL: "postgresql://x",
			JWT_SECRET: "y".repeat(32),
			UPLOADS_SIGNING_SECRET: "a".repeat(MIN_SIGNING_SECRET_LENGTH),
		};
		expect(findMissingEnvVars(env)).toEqual([]);
	});

	// The deploy manifest is the only place the secret is declared for the
	// hosted environment. If it is missing from render.yaml, the first deploy
	// boots without the secret and every private file is unreachable.
	test("render.yaml declares the signing secret", () => {
		const yaml = fs.readFileSync(path.join(process.cwd(), "render.yaml"), "utf8");
		expect(yaml).toMatch(/- key: UPLOADS_SIGNING_SECRET/);
		expect(yaml).toMatch(/generateValue: true/);
	});
});
