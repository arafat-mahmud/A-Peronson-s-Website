import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const COMPRESSED_SUFFIX = ".compressed.mp4";

export function validateVideo(filePath) {
	return new Promise((resolve, reject) => {
		const proc = spawn("ffprobe", [
			"-v",
			"error",
			"-show_entries",
			"format=format_name",
			"-of",
			"default=noprint_wrappers=1",
			filePath,
		]);

		let stdout = "";
		let stderr = "";

		proc.stdout.on("data", (chunk) => {
			stdout += chunk.toString();
		});
		proc.stderr.on("data", (chunk) => {
			stderr += chunk.toString();
		});

		proc.on("close", (code) => {
			if (code === 0) {
				resolve(stdout.trim());
			} else {
				reject(
					new Error(
						`Invalid or corrupt video file: ${stderr.trim() || "ffprobe returned non-zero"}`,
					),
				);
			}
		});

		proc.on("error", (err) => {
			reject(new Error(`ffprobe not found: ${err.message}`));
		});
	});
}

export function compressVideo(inputPath) {
	return new Promise((resolve, reject) => {
		const ext = path.extname(inputPath).toLowerCase();
		const _dir = path.dirname(inputPath);
		const base = path.basename(inputPath, ext);
		const outputPath = path.join(os.tmpdir(), `${base}${COMPRESSED_SUFFIX}`);

		const args = [
			"-i",
			inputPath,
			"-vcodec",
			"libx264",
			"-crf",
			"23",
			"-preset",
			"ultrafast",
			"-movflags",
			"+faststart",
			"-c:a",
			"aac",
			"-b:a",
			"128k",
			"-y",
			outputPath,
		];

		const proc = spawn("ffmpeg", args);
		let stderr = "";

		proc.stderr.on("data", (chunk) => {
			stderr += chunk.toString();
		});

		proc.on("close", (code) => {
			if (code !== 0) {
				reject(new Error(`FFmpeg failed (code ${code}): ${stderr.slice(-300)}`));
				return;
			}
			resolve(outputPath);
		});

		proc.on("error", (err) => {
			reject(new Error(`ffmpeg not found: ${err.message}`));
		});
	});
}

export function replaceWithCompressed(originalPath, compressedPath) {
	const originalSize = fs.statSync(originalPath).size;
	const compressedSize = fs.statSync(compressedPath).size;

	if (compressedSize >= originalSize) {
		fs.unlinkSync(compressedPath);
		return { replaced: false, originalSize, compressedSize };
	}

	const backupPath = `${originalPath}.bak`;
	fs.renameSync(originalPath, backupPath);
	fs.renameSync(compressedPath, originalPath);
	fs.unlinkSync(backupPath);

	return { replaced: true, originalSize, compressedSize };
}

export function isVideoFile(mime, originalName) {
	const mimeLower = String(mime || "").toLowerCase();
	if (mimeLower.startsWith("video/")) {
		return true;
	}
	const videoExts = new Set([
		".mp4",
		".webm",
		".mkv",
		".flv",
		".vob",
		".ogv",
		".ogg",
		".rrc",
		".gifv",
		".mng",
		".mov",
		".avi",
		".qt",
		".wmv",
		".yuv",
		".rm",
		".asf",
		".amv",
		".m4p",
		".m4v",
		".mpg",
		".mp2",
		".mpeg",
		".mpe",
		".mpv",
		".svi",
		".3gp",
		".3g2",
		".mxf",
		".roq",
		".nsv",
		".f4v",
		".f4p",
		".f4a",
		".f4b",
		".mod",
	]);
	const ext = path.extname(String(originalName || "")).toLowerCase();
	return videoExts.has(ext);
}
