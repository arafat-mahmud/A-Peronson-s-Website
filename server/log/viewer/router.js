import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Router } from "express";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOG_DIR = path.resolve(process.env.LOG_DIR || path.join(process.cwd(), "log"));
const PUBLIC_DIR = path.join(__dirname, "public");
const MAX_CHUNK_BYTES = 2 * 1024 * 1024;

const MIME = {
	".html": "text/html; charset=utf-8",
	".js": "text/javascript; charset=utf-8",
	".css": "text/css; charset=utf-8",
	".json": "application/json; charset=utf-8",
	".svg": "image/svg+xml",
	".ico": "image/x-icon",
};

function safeLogPath(name) {
	const clean = path.basename(String(name || ""));
	if (!clean || clean !== String(name)) throw new Error("Invalid log filename");
	const full = path.resolve(LOG_DIR, clean);
	if (!full.startsWith(LOG_DIR + path.sep) && full !== LOG_DIR)
		throw new Error("Path traversal blocked");
	return full;
}

function listLogs() {
	return fs
		.readdirSync(LOG_DIR, { withFileTypes: true })
		.filter((e) => e.isFile())
		.map((e) => {
			const full = path.join(LOG_DIR, e.name);
			const st = fs.statSync(full);
			return { name: e.name, size: st.size, modified: st.mtimeMs };
		})
		.sort((a, b) => b.modified - a.modified);
}

function readChunk(file, start, size) {
	return new Promise((resolve, reject) => {
		fs.open(file, "r", (err, fd) => {
			if (err) return reject(err);
			fs.fstat(fd, (statErr, st) => {
				if (statErr) return fs.close(fd, () => reject(statErr));
				if (start >= st.size)
					return fs.close(fd, () =>
						resolve({ text: "", nextOffset: start, eof: true, size: st.size }),
					);
				const end = Math.min(start + size, st.size);
				const length = end - start;
				const buf = Buffer.allocUnsafe(length);
				fs.read(fd, buf, 0, length, start, (readErr, bytesRead) => {
					fs.close(fd, () => {});
					if (readErr) return reject(readErr);
					resolve({
						text: buf.subarray(0, bytesRead).toString("utf8"),
						nextOffset: start + bytesRead,
						eof: start + bytesRead >= st.size,
						size: st.size,
					});
				});
			});
		});
	});
}

const router = Router();

router.get("/api/logs", (req, res) => {
	res.json({ logs: listLogs() });
});

router.get("/api/logs/:name/meta", (req, res) => {
	try {
		const file = safeLogPath(decodeURIComponent(req.params.name));
		const st = fs.statSync(file);
		res.json({ name: path.basename(file), size: st.size, modified: st.mtimeMs });
	} catch (err) {
		const status = err.code === "ENOENT" ? 404 : 400;
		res.status(status).json({ error: err.message });
	}
});

router.get("/api/logs/:name/chunk", async (req, res) => {
	try {
		const file = safeLogPath(decodeURIComponent(req.params.name));
		const offset = Number(req.query.offset || 0);
		const requested = Number(req.query.size || 512 * 1024);
		const size = Math.min(MAX_CHUNK_BYTES, Math.max(1, requested));
		if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isFinite(size)) {
			return res.status(400).json({ error: "Invalid offset/size" });
		}
		const result = await readChunk(file, offset, size);
		res.json({
			offset,
			nextOffset: result.nextOffset,
			eof: result.eof,
			size: result.size,
			text: result.text,
		});
	} catch (err) {
		const status = err.code === "ENOENT" ? 404 : 400;
		res.status(status).json({ error: err.message });
	}
});

router.get("/", (req, res) => {
	const indexPath = path.join(PUBLIC_DIR, "index.html");
	if (!fs.existsSync(indexPath)) {
		return res.status(404).send("Log viewer not found");
	}
	res.sendFile(indexPath);
});

export default router;
