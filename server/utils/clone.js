import v8 from "node:v8";

/**
 * Deep copy of plain data (objects, arrays, Dates). `structuredClone` where the
 * runtime has it; the jsdom test environment does not, so fall back to the same
 * algorithm through v8 serialization.
 */
export const deepClone =
	typeof globalThis.structuredClone === "function"
		? (value) => globalThis.structuredClone(value)
		: (value) => v8.deserialize(v8.serialize(value));
