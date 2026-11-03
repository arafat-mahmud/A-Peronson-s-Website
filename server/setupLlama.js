import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import axios from "axios";
import * as tar from "tar";
import unzipper from "unzipper";
import { logInfo, logWarn } from "./utils/logger.js";

const BASE_URL = "https://github.com/ggml-org/llama.cpp/releases/download/b8196";

function safeExec(cmd) {
	try {
		return execSync(cmd, { stdio: ["ignore", "pipe", "ignore"] })
			.toString()
			.trim();
	} catch {
		return null;
	}
}

function detectOS() {
	const platform = os.platform();
	const arch = os.arch();

	if (platform === "win32") {
		return { os: "win", arch };
	}
	if (platform === "linux") {
		return { os: "ubuntu", arch };
	}
	if (platform === "darwin") {
		return { os: "macos", arch };
	}
	throw new Error("Unsupported OS");
}

function detectCudaVersion() {
	if (process.platform === "win32") {
		const out = safeExec("nvcc --version");
		if (out) {
			const match = out.match(/release (\d+\.\d+)/);
			if (match) {
				return match[1];
			}
		}
	}

	if (process.platform === "linux") {
		const out = safeExec("nvcc --version");
		if (out) {
			const match = out.match(/release (\d+\.\d+)/);
			if (match) {
				return match[1];
			}
		}
	}

	return null;
}

function detectNvidiaDriverVersion() {
	const out = safeExec("nvidia-smi --query-gpu=driver_version --format=csv,noheader");
	return out || null;
}

function hasVulkan() {
	const out = safeExec("vulkaninfo --summary");
	return Boolean(out);
}

function detectGPUBackend() {
	if (process.platform === "darwin") {
		return "metal";
	}

	const nvidiaDriver = detectNvidiaDriverVersion();
	if (nvidiaDriver) {
		const cudaVersion = detectCudaVersion();
		if (cudaVersion) {
			return { type: "cuda", version: cudaVersion };
		}
		return { type: "cuda", version: null };
	}

	if (hasVulkan()) {
		return { type: "vulkan" };
	}

	return { type: "cpu" };
}

function buildCandidateFilenames() {
	const { os: platform, arch } = detectOS();
	const archMap = { x64: "x64", arm64: "arm64" };
	const mappedArch = archMap[arch];
	if (!mappedArch) {
		throw new Error("Unsupported architecture");
	}

	const gpu = detectGPUBackend();
	const candidates = [];

	if (platform === "win") {
		if (gpu.type === "cuda") {
			const major = gpu.version ? gpu.version.split(".")[0] : "12";
			const minor = major === "13" ? "1" : "4";
			candidates.push(`llama-b8196-bin-win-cuda-${major}.${minor}-${mappedArch}.zip`);
			candidates.push(`llama-b8196-bin-win-vulkan-${mappedArch}.zip`);
		}
		if (gpu.type === "vulkan") {
			candidates.push(`llama-b8196-bin-win-vulkan-${mappedArch}.zip`);
		}
		candidates.push(`llama-b8196-bin-win-cpu-${mappedArch}.zip`);
	}

	if (platform === "ubuntu") {
		if (gpu.type === "cuda") {
			candidates.push(`llama-b8196-bin-ubuntu-vulkan-${mappedArch}.tar.gz`);
		}
		if (gpu.type === "vulkan") {
			candidates.push(`llama-b8196-bin-ubuntu-vulkan-${mappedArch}.tar.gz`);
		}
		candidates.push(`llama-b8196-bin-ubuntu-${mappedArch}.tar.gz`);
	}

	if (platform === "macos") {
		candidates.push(`llama-b8196-bin-macos-${mappedArch}.tar.gz`);
	}

	return candidates;
}

async function downloadFile(url, outputPath) {
	const writer = fs.createWriteStream(outputPath);

	const response = await axios({
		url,
		method: "GET",
		responseType: "stream",
		validateStatus: (s) => s < 400,
	});

	response.data.pipe(writer);

	return new Promise((resolve, reject) => {
		writer.on("finish", resolve);
		writer.on("error", reject);
	});
}

async function extractFile(filePath) {
	fs.mkdirSync("./llama", { recursive: true });

	if (filePath.endsWith(".zip")) {
		await fs
			.createReadStream(filePath)
			.pipe(unzipper.Extract({ path: "./llama" }))
			.promise();
	} else if (filePath.endsWith(".tar.gz")) {
		await tar.x({ file: filePath, C: "./llama" });
	}
}

async function tryDownloadCandidates() {
	const candidates = buildCandidateFilenames();

	for (const filename of candidates) {
		const url = `${BASE_URL}/${filename}`;
		const downloadPath = path.join(process.cwd(), filename);

		try {
			logInfo("model download - trying", { filename });
			await downloadFile(url, downloadPath);

			logInfo("model download - extracting", { filename });
			await extractFile(downloadPath);

			fs.unlinkSync(downloadPath);
			logInfo("model download - success", { filename });
			return;
		} catch (err) {
			logWarn("model download - failed", { filename, error: err.message });
			if (fs.existsSync(downloadPath)) {
				fs.unlinkSync(downloadPath);
			}
		}
	}

	throw new Error("All download attempts failed.");
}

async function main() {
	await tryDownloadCandidates();
	logInfo("model download - installation complete");
}

main().catch((_err) => {});
