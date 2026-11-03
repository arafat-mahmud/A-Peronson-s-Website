// One password policy for the signup form and the API (client 02/11/2026:
// "three or four main conditions", IMG-20261102-WA0036). Passphrases with
// spaces and any symbols are welcome; case/symbol rules are not imposed.

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

export const PASSWORD_RULES = [
	{ id: "length", label: `At least ${PASSWORD_MIN_LENGTH} characters`, test: (value) => value.length >= PASSWORD_MIN_LENGTH },
	{ id: "letter", label: "Includes a letter", test: (value) => /\p{L}/u.test(value) },
	{ id: "number", label: "Includes a number", test: (value) => /\p{N}/u.test(value) },
];

/** Labels of the rules the password does not meet (empty = acceptable). */
export function passwordProblems(password) {
	const value = String(password ?? "");
	const problems = PASSWORD_RULES.filter((rule) => !rule.test(value)).map((rule) => rule.label);
	if (value.length > PASSWORD_MAX_LENGTH) {
		problems.push(`At most ${PASSWORD_MAX_LENGTH} characters`);
	}
	return problems;
}

/** 0 = too weak, 1 = fair, 2 = good, 3 = strong. A hint, not a rule. */
export function passwordStrength(password) {
	const value = String(password ?? "");
	if (passwordProblems(value).length > 0) return 0;
	const variety = [/\p{Ll}/u, /\p{Lu}/u, /\p{N}/u, /[^\p{L}\p{N}]/u].filter((re) => re.test(value)).length;
	let score = 1;
	if (value.length >= 12 || variety >= 3) score += 1;
	if (value.length >= 16 || (value.length >= 12 && variety >= 3)) score += 1;
	return Math.min(3, score);
}
