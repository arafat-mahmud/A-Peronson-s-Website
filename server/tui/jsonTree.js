import blessed from "blessed";

function isExpandable(v) {
	return v !== null && typeof v === "object";
}

function truncate(s, max = 60) {
	const str = String(s);
	if (str.length <= max) {
		return str;
	}
	return `${str.slice(0, max - 1)}…`;
}

function primitiveTag(value) {
	if (value === null) {
		return "{gray-fg}null{/}";
	}
	if (value === undefined) {
		return "{gray-fg}undefined{/}";
	}
	if (typeof value === "boolean") {
		return `{magenta-fg}${value}{/}`;
	}
	if (typeof value === "number") {
		return `{cyan-fg}${value}{/}`;
	}
	if (typeof value === "string") {
		if (value.includes("@")) {
			return `{yellow-fg}"${truncate(value)}"{/}`;
		}
		return `{white-fg}"${truncate(value)}"{/}`;
	}
	return `{white-fg}${truncate(value)}{/}`;
}

export function buildJsonTree(
	value,
	{ prefix = "", expanded = new Set(), depth = 0, maxDepth = 12 } = {},
) {
	const lines = [];
	const indent = "  ".repeat(depth);

	if (!isExpandable(value)) {
		lines.push(`${indent}${primitiveTag(value)}`);
		return lines;
	}

	const isArr = Array.isArray(value);
	const keys = isArr ? value.map((_, i) => i) : Object.keys(value);
	if (keys.length === 0) {
		lines.push(`${indent}{gray-fg}${isArr ? "[]" : "{}"}{/}`);
		return lines;
	}

	const path = prefix;
	const isOpen = expanded.has(path) || depth < 2;

	const label = isArr ? `Array(${keys.length})` : `{${Object.keys(value).length}}`;
	const toggle = isOpen ? "{cyan-fg}▼{/}" : "{cyan-fg}▶{/}";
	const openBrace = isArr ? "{gray-fg}[{/}" : "{gray-fg}{{/}";

	if (depth > maxDepth) {
		lines.push(`${indent}${toggle} ${label} ${openBrace}{gray-fg}…{/}`);
		return lines;
	}

	lines.push(`${indent}${toggle} {blue-fg}${isArr ? "Array" : "Object"}{/} ${openBrace}`);

	if (isOpen) {
		for (const key of keys.slice(0, 200)) {
			const child = value[key];
			const childPath = `${path}/${String(key)}`;
			if (isExpandable(child)) {
				lines.push(
					...buildJsonTree(child, { prefix: childPath, expanded, depth: depth + 1, maxDepth }),
				);
			} else {
				lines.push(`${indent}  {gray-fg}${key}{/}: ${primitiveTag(child)}`);
			}
		}
		if (keys.length > 200) {
			lines.push(`${indent}  {gray-fg}… ${keys.length - 200} more keys{/}`);
		}
	}

	lines.push(`${indent}${isArr ? "{gray-fg}]{/}" : "{gray-fg}}{/}"}`);
	return lines;
}

export function extractJson(pathSegments, root) {
	let node = root;
	for (const seg of pathSegments) {
		if (node === null || node === undefined) {
			return;
		}
		if (Array.isArray(node)) {
			const idx = Number.parseInt(seg, 10);
			node = Number.isNaN(idx) ? undefined : node[idx];
		} else {
			node = node[seg];
		}
	}
	return node;
}
