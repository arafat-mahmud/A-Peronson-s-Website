// The environment the server cannot boot without.
//
// UPLOADS_SIGNING_SECRET is in this list because the server used to boot
// "clean" without it: /api/files/sign answered 503 for every path, the static
// mount 404ed the gated prefixes, and every private file became unreachable by
// anyone - with no boot-time signal at all, only a per-request logWarn. It is
// the HMAC key behind every signed url, so it is required and it is required
// to be long enough to be a key.

export const REQUIRED_ENV_VARS = ["DATABASE_URL", "JWT_SECRET", "UPLOADS_SIGNING_SECRET"];

// HMAC-SHA256 keys carry no less strength than the digest they produce, and a
// 32-character key is the shortest one that cannot be brute-forced from a
// leaked sample. A one-character secret is not a key.
export const MIN_SIGNING_SECRET_LENGTH = 32;

/**
 * Lists the required environment variables that are missing or unusable.
 *
 * @param {Object} [env] The environment to inspect. Defaults to process.env.
 * @returns {string[]} The problems, empty when the environment is complete.
 */
export function findMissingEnvVars(env = process.env) {
	const problems = [];
	for (const name of REQUIRED_ENV_VARS) {
		const value = String(env?.[name] ?? "").trim();
		if (!value) {
			problems.push(name);
			continue;
		}
		if (name === "UPLOADS_SIGNING_SECRET" && value.length < MIN_SIGNING_SECRET_LENGTH) {
			problems.push(`${name} (minimum ${MIN_SIGNING_SECRET_LENGTH} characters)`);
		}
	}
	return problems;
}
