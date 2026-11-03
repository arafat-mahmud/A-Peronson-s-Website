// Container memory headroom, read from the cgroup the process runs in.
//
// Render Free gives the whole container 512 MiB. The API process alone sits
// around 200 MiB, so a helper process (the opencode server needs several
// hundred MiB while it starts) gets the container OOM-killed - the API goes
// down with it and every user sees 502/503 until Render restarts it.
// Anything that wants to spawn a large child asks here first.

import fs from "node:fs";

const MB = 1024 * 1024;

function readBytes(file) {
	try {
		const raw = fs.readFileSync(file, "utf8").trim();
		if (!raw || raw === "max") return null;
		const value = Number(raw);
		// cgroup v1 reports "no limit" as a huge number (~2^63).
		if (!Number.isFinite(value) || value <= 0 || value >= 2 ** 60) return null;
		return value;
	} catch {
		return null;
	}
}

/** { limit, usage } in bytes; null when the platform does not expose it. */
export function containerMemory() {
	const limit =
		readBytes("/sys/fs/cgroup/memory.max") ??
		readBytes("/sys/fs/cgroup/memory/memory.limit_in_bytes");
	const usage =
		readBytes("/sys/fs/cgroup/memory.current") ??
		readBytes("/sys/fs/cgroup/memory/memory.usage_in_bytes");
	return { limit, usage };
}

/**
 * May the process start a child that needs `requiredMb` more memory?
 *
 * With no readable cgroup limit (local macOS/Windows development) the answer
 * is yes. `MEMORY_GUARD=off` disables the check.
 */
export function canAffordChildProcess(requiredMb, { memory = containerMemory() } = {}) {
	if (String(process.env.MEMORY_GUARD || "").toLowerCase() === "off") {
		return { ok: true, reason: "guard_disabled" };
	}
	const { limit } = memory;
	if (!limit) {
		return { ok: true, reason: "no_container_limit" };
	}
	const usage = memory.usage ?? process.memoryUsage().rss;
	const freeMb = Math.round((limit - usage) / MB);
	const limitMb = Math.round(limit / MB);
	if (freeMb < requiredMb) {
		return { ok: false, reason: "insufficient_memory", limitMb, freeMb, requiredMb };
	}
	return { ok: true, reason: "fits", limitMb, freeMb, requiredMb };
}
