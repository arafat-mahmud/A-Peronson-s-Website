import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const COMPRESSED_SUFFIX = ".compressed";

const SHARP_FORMATS = new Set([
	".jpg",
	".jpeg",
	".png",
	".webp",
	".avif",
	".gif",
	".tiff",
	".tif",
	".svg",
	".heic",
	".heif",
]);

const IMAGEMAGICK_FORMATS = new Set([
	".bmp",
	".dcm",
	".tga",
	".eps",
	".psd",
	".ai",
	".xcf",
	".cdr",
	".dng",
	".cr2",
	".cr3",
	".nef",
	".arw",
	".sr2",
	".orf",
	".raf",
	".apng",
]);

export function isImageFile(mime, originalName) {
	const mimeLower = String(mime || "").toLowerCase();
	if (mimeLower.startsWith("image/")) {
		return true;
	}
	const imgExts = new Set([
		".jpg",
		".jpeg",
		".png",
		".webp",
		".avif",
		".gif",
		".apng",
		".bmp",
		".tiff",
		".tif",
		".heic",
		".heif",
		".dcm",
		".tga",
		".svg",
		".eps",
		".pdf",
		".dng",
		".cr2",
		".cr3",
		".nef",
		".arw",
		".sr2",
		".orf",
		".raf",
		".psd",
		".ai",
		".xcf",
		".cdr",
	]);
	const ext = path.extname(String(originalName || "")).toLowerCase();
	return imgExts.has(ext);
}

export async function compressImage(inputPath) {
	const ext = path.extname(inputPath).toLowerCase();
	const _dir = path.dirname(inputPath);
	const base = path.basename(inputPath, ext);
	const outputExt = ext === ".jpg" ? ".jpg" : ".jpg";
	const outputPath = path.join(os.tmpdir(), `${base}${COMPRESSED_SUFFIX}${outputExt}`);

	if (SHARP_FORMATS.has(ext)) {
		await compressWithSharp(inputPath, outputPath);
	} else if (ext === ".pdf") {
		await compressPdf(inputPath, outputPath);
	} else if (IMAGEMAGICK_FORMATS.has(ext)) {
		await compressWithImageMagick(inputPath, outputPath);
	} else {
		throw new Error(`No compressor available for ${ext}`);
	}

	return outputPath;
}

async function compressWithSharp(inputPath, outputPath) {
	const { default: sharp } = await import("sharp");
	let pipeline = sharp(inputPath).rotate();

	const ext = path.extname(inputPath).toLowerCase();
	if ([".jpg", ".jpeg"].includes(ext)) {
		pipeline = pipeline.jpeg({ quality: 80, mozjpeg: true });
	} else if (ext === ".png") {
		pipeline = pipeline.png({ quality: 80, compressionLevel: 9 });
	} else if (ext === ".webp") {
		pipeline = pipeline.webp({ quality: 80 });
	} else if (ext === ".avif") {
		pipeline = pipeline.avif({ quality: 65 });
	} else if (ext === ".gif") {
		pipeline = pipeline.gif();
	} else if ([".tiff", ".tif"].includes(ext)) {
		pipeline = pipeline.tiff({ quality: 80 });
	} else if ([".heic", ".heif"].includes(ext)) {
		pipeline = pipeline.heif({ quality: 80 });
	} else {
		pipeline = pipeline.jpeg({ quality: 80, mozjpeg: true });
	}

	await pipeline.toFile(outputPath);
}

async function compressWithImageMagick(inputPath, outputPath) {
	return new Promise((resolve, reject) => {
		const proc = spawn("convert", [
			inputPath,
			"-quality",
			"80%",
			"-resize",
			"1920x1920>",
			outputPath,
		]);
		let stderr = "";
		proc.stderr.on("data", (chunk) => {
			stderr += chunk.toString();
		});
		proc.on("close", (code) => {
			if (code === 0) {
				resolve();
			} else {
				reject(new Error(`ImageMagick failed (code ${code}): ${stderr.slice(-200)}`));
			}
		});
		proc.on("error", () => reject(new Error("ImageMagick (convert) not available")));
	});
}

async function compressPdf(inputPath, outputPath) {
	return new Promise((resolve, reject) => {
		const proc = spawn("gs", [
			"-sDEVICE=pdfwrite",
			"-dCompatibilityLevel=1.4",
			"-dPDFSETTINGS=/ebook",
			"-dNOPAUSE",
			"-dQUIET",
			"-dBATCH",
			`-sOutputFile=${outputPath}`,
			inputPath,
		]);
		let stderr = "";
		proc.stderr.on("data", (chunk) => {
			stderr += chunk.toString();
		});
		proc.on("close", (code) => {
			if (code === 0) {
				resolve();
			} else {
				reject(new Error(`Ghostscript failed (code ${code}): ${stderr.slice(-200)}`));
			}
		});
		proc.on("error", () => reject(new Error("Ghostscript (gs) not available")));
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
