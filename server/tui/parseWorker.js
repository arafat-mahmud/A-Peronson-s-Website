import { parentPort, workerData } from "node:worker_threads";

const PORT = parentPort;

// colorize: syntax-highlight a JSON string into ANSI 24-bit sequences.
function colorize(text, color) {
	try {
		const obj = JSON.parse(text);
		const out = format(obj, color, 0);
		PORT.postMessage({ id: workerData.id, result: { ok: true, html: out } });
	} catch {
		PORT.postMessage({ id: workerData.id, result: { ok: false, error: "invalid json" } });
	}
}

function esc(s, color) {
	return `\x1b[${color}m${s}\x1b[0m`;
}

function format(v, color, depth) {
	const indent = "  ".repeat(depth);
	if (v === null) {
		return esc("null", "90");
	}
	if (Array.isArray(v)) {
		if (v.length === 0) {
			return esc("[]", "90");
		}
		const lines = v.map((item) => `${indent}${format(item, color, depth + 1)}`);
		return `[\n${lines.join(",\n")}\n${"  ".repeat(Math.max(0, depth - 1))}]`;
	}
	if (typeof v === "object") {
		const keys = Object.keys(v);
		if (keys.length === 0) {
			return esc("{}", "90");
		}
		const lines = keys.map((k) => {
			const key = esc(`"${k}"`, "36");
			return `${indent}${key}: ${format(v[k], color, depth + 1)}`;
		});
		return `{\n${lines.join(",\n")}\n${indent.slice(0, -2)}}`;
	}
	if (typeof v === "string") {
		return v.includes("@") ? esc(`"${v}"`, "33") : esc(`"${v}"`, "32");
	}
	if (typeof v === "number") {
		return esc(String(v), "35");
	}
	if (typeof v === "boolean") {
		return esc(String(v), "96");
	}
	return esc(String(v), "97");
}

function scan(entries, pattern) {
	let re;
	try {
		re = new RegExp(pattern);
	} catch {
		PORT.postMessage({
			id: workerData.id,
			result: { ok: true, hits: [], error: new Error("invalid regex") },
		});
		return;
	}
	const hits = [];
	for (const e of entries) {
		const hay = `${e.message || ""} ${JSON.stringify(e.data || "")} ${JSON.stringify(e.meta || "")}`;
		if (re.test(hay)) {
			hits.push({ id: e.id, message: e.message });
			re.lastIndex = 0;
		}
	}
	PORT.postMessage({ id: workerData.id, result: { ok: true, hits } });
}

PORT.on("message", (msg) => {
	if (msg.id === undefined) {
		return;
	}
	if (msg.job === "colorize") {
		colorize(msg.payload.text);
	} else if (msg.job === "scan") {
		scan(msg.payload.entries || [], msg.payload.pattern);
	}
});
