import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { logError, logInfo, logWarn } from "../utils/logger.js";

const VENV_DIR = process.env.VENV_DIR || "";

const HARAM_DETECTION_DIR = process.env.HARAM_DETECTION_DIR;
const aiAvailable = Boolean(HARAM_DETECTION_DIR);

if (!aiAvailable) {
}

let _dirChecked = false;
function ensureDir() {
	if (_dirChecked) {
		return HARAM_DETECTION_DIR;
	}
	_dirChecked = true;
	return HARAM_DETECTION_DIR;
}

export function isAIAnalyticsEnabled() {
	const val = process.env.AI_HARAM_ANALYTICS_ENABLED;
	if (val === undefined || val === null) {
		return true;
	}
	return val === "true" || val === "1";
}

function getVenvDir() {
	const dir = ensureDir();
	return dir ? path.join(dir, ".venv") : null;
}

function getVenvPython() {
	const venvDir = getVenvDir();
	if (!venvDir) {
		return null;
	}
	if (process.platform === "win32") {
		const p = path.join(venvDir, "Scripts", "python.exe");
		if (fs.existsSync(p)) {
			return p;
		}
	}
	const p = path.join(venvDir, "bin", "python");
	if (fs.existsSync(p)) {
		return p;
	}
	return null;
}

function getVenvUv() {
	const venvDir = getVenvDir();
	if (!venvDir) {
		return "uv";
	}
	if (process.platform === "win32") {
		const p = path.join(venvDir, "Scripts", "uv.exe");
		if (fs.existsSync(p)) {
			return p;
		}
	}
	return "uv";
}

async function runSync(command, args, cwd = HARAM_DETECTION_DIR, timeoutMs = 300_000) {
	return new Promise((resolve, reject) => {
		const proc = spawn(command, args, { cwd, windowsHide: true });
		let stdout = "";
		let stderr = "";
		proc.stdout?.on("data", (d) => {
			stdout += d.toString();
		});
		proc.stderr?.on("data", (d) => {
			stderr += d.toString();
		});
		const timer = setTimeout(() => {
			try {
				proc.kill();
			} catch {
				/* ignore */
			}
			reject(new Error("timeout"));
		}, timeoutMs);
		proc.on("close", (code) => {
			clearTimeout(timer);
			if (code === 0) {
				resolve(stdout);
			} else {
				reject(new Error(stderr || `exit code ${code}`));
			}
		});
		proc.on("error", (err) => {
			clearTimeout(timer);
			reject(err);
		});
	});
}

export async function ensureVenv() {
	if (!aiAvailable) {
		return;
	}
	if (!isAIAnalyticsEnabled()) {
		return;
	}
	const pyExe = getVenvPython();
	if (pyExe) {
		try {
			await runSync(pyExe, ["-c", "import numpy; import torch"], HARAM_DETECTION_DIR, 30_000);
			logInfo("AI Moderation venv Python ready with all packages");
			return;
		} catch {
			logInfo("AI Moderation venv exists but packages missing, installing...");
		}
	}

	if (!fs.existsSync(VENV_DIR)) {
		logInfo("AI Moderation Creating venv with Python 3.11...");
		try {
			await runSync("uv", ["venv", "--python", "3.11", VENV_DIR], HARAM_DETECTION_DIR);
			logInfo("AI Moderation venv created");
		} catch (err) {
			logError("AI Moderation venv creation failed", err);
			return;
		}
	}

	logInfo("AI Moderation Running uv sync...");
	try {
		await runSync("uv", ["sync"], HARAM_DETECTION_DIR, 600_000);
	} catch (err) {
		logWarn("AI Moderation uv sync warning", { error: err.message });
	}

	const venvPy = getVenvPython();
	if (venvPy) {
		logInfo("AI Moderation Installing torch CPU...");
		try {
			await runSync(
				getVenvUv(),
				[
					"pip",
					"install",
					"torch",
					"torchvision",
					"--index-url",
					"https://download.pytorch.org/whl/cpu",
				],
				HARAM_DETECTION_DIR,
				600_000,
			);
		} catch (err) {
			logWarn("AI Moderation torch install warning", { error: err.message });
		}
	}

	logInfo("AI Moderation venv setup complete");
}

function buildPythonScript(filePath) {
	const safeDir = JSON.stringify(HARAM_DETECTION_DIR);
	const safePath = JSON.stringify(filePath);
	return `import sys\nimport json\nimport os\nsys.path.insert(0, ${safeDir})\nos.environ['PYTHONWARNINGS']='ignore'\nos.environ['KMP_DUPLICATE_LIB_OK']='TRUE'\nimport warnings;warnings.filterwarnings('ignore')\nfrom src.api import create_api\napi=create_api()\nresult=api.check_file(${safePath})\nprint(json.dumps(result))`;
}

function runPython(script) {
	const py = getVenvPython() || "python3";
	return new Promise((resolve, reject) => {
		const proc = spawn(py, ["-c", script], {
			cwd: HARAM_DETECTION_DIR,
			windowsHide: true,
		});
		let stdout = "";
		let stderr = "";
		proc.stdout?.on("data", (d) => {
			stdout += d.toString();
		});
		proc.stderr?.on("data", (d) => {
			stderr += d.toString();
		});
		const timer = setTimeout(() => {
			try {
				proc.kill();
			} catch {
				/* ignore - process may already be gone */
			}
			reject(new Error("timeout"));
		}, 300_000);
		proc.on("close", (code) => {
			clearTimeout(timer);
			if (code === 0) {
				try {
					resolve(JSON.parse(stdout.trim()));
				} catch {
					reject(new Error("parse error"));
				}
			} else {
				reject(new Error(stderr || `exit ${code}`));
			}
		});
		proc.on("error", (err) => {
			clearTimeout(timer);
			reject(err);
		});
	});
}

export async function analyzeImageWithAI(filePath) {
	if (!aiAvailable) {
		throw new Error("AI moderation unavailable (HARAM_DETECTION_DIR not set)");
	}
	if (!isAIAnalyticsEnabled()) {
		throw new Error("AI Haram Analytics is disabled via AI_HARAM_ANALYTICS_ENABLED");
	}
	await ensureVenv();
	return runPython(buildPythonScript(filePath));
}

export function isAutoApprovedLabel(label) {
	return label === "SAFE" || label === "QUESTIONABLE";
}

export async function runImageFileAnalysis(filePath) {
	if (!aiAvailable) {
		return { label: "UNKNOWN", score: 0, confidence: "low", signals: [], details: {} };
	}
	if (!isAIAnalyticsEnabled()) {
		return { label: "UNKNOWN", score: 0, confidence: "low", signals: [], details: {} };
	}
	try {
		if (!fs.existsSync(filePath)) {
			return { label: "UNKNOWN", score: 0, confidence: "low", signals: [], details: {} };
		}
		const buffer = fs.readFileSync(filePath);
		const result = await analyzeBufferWithAI(buffer, path.basename(filePath));
		return {
			label: result?.label || "UNKNOWN",
			score: result?.score || 0,
			confidence: result?.confidence || "low",
			signals: result?.signals || [],
			details: result?.details || {},
			timing: result?.timing || {},
			severity: result?.severity || null,
			is_early_exit: result?.is_early_exit,
			autoApproved: isAutoApprovedLabel(result?.label),
		};
	} catch (err) {
		logError("runImageFileAnalysis failed", err);
		return {
			label: "ERROR",
			score: 0,
			confidence: "low",
			signals: [],
			details: {},
			error: err.message,
		};
	}
}

export async function analyzeBufferWithAI(buffer, filename = "image.jpg") {
	if (!aiAvailable) {
		throw new Error("AI moderation unavailable (HARAM_DETECTION_DIR not set)");
	}
	if (!isAIAnalyticsEnabled()) {
		throw new Error("AI Haram Analytics is disabled via AI_HARAM_ANALYTICS_ENABLED");
	}
	await ensureVenv();
	const tempDir = os.tmpdir();
	const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "");
	const tempFile = path.join(tempDir, `haram_${crypto.randomUUID()}_${safeFilename}`);

	return new Promise((resolve, reject) => {
		try {
			fs.writeFileSync(tempFile, buffer);
		} catch (err) {
			return reject(err);
		}

		const cleanup = () => {
			try {
				fs.unlinkSync(tempFile);
			} catch {
				/* ignore if already gone */
			}
		};

		runPython(buildPythonScript(tempFile))
			.then((result) => {
				cleanup();
				resolve(result);
			})
			.catch((err) => {
				cleanup();
				reject(err);
			});
	});
}
