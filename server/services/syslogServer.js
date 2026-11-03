import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import tls from "node:tls";
import { logError, logInfo, logWarn } from "../utils/logger.js";

const SYSLOG_PORT = Number.parseInt(process.env.SYSLOG_PORT || "6514", 10);
const CERT_DIR = process.env.SYSLOG_CERT_DIR || path.join(process.cwd(), "server", "ssl");
const LOG_DIR = path.join(process.cwd(), "server", "logs", "syslog");

function ensureDir(p) {
	if (!fs.existsSync(p)) {
		fs.mkdirSync(p, { recursive: true });
	}
}

function parseRfc5424(raw) {
	const str = typeof raw === "string" ? raw : raw.toString("utf-8").trim();
	if (!str) {
		return null;
	}

	const match = str.match(/^<(\d+)>(1)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(.*)$/);
	if (!match) {
		return { raw: str, pri: null, version: null, message: str };
	}

	const [, pri, version, timestamp, hostname, appName, procId, msgId, , msg] = match;
	return {
		raw: str,
		pri: Number.parseInt(pri, 10),
		severity: pri & 7,
		facility: pri >> 3,
		version: Number.parseInt(version, 10),
		timestamp,
		hostname,
		appName,
		procId,
		msgId,
		message: msg,
	};
}

function formatSyslogEntry(parsed) {
	if (!parsed) {
		return "";
	}
	const ts = parsed.timestamp || new Date().toISOString();
	const sev =
		parsed.severity === null
			? "info"
			: ["emerg", "alert", "crit", "error", "warn", "notice", "info", "debug"][parsed.severity];
	const tag = parsed.appName ? `[${parsed.appName}]` : "";
	const inst = parsed.procId && parsed.procId !== "-" ? `(${parsed.procId})` : "";
	return `[SYSLOG:${sev}] ${ts} ${tag}${inst} ${parsed.hostname || "-"}: ${parsed.message || parsed.raw || ""}`;
}

function writeLogFile(entry) {
	ensureDir(LOG_DIR);
	const date = new Date().toISOString().slice(0, 10);
	const filePath = path.join(LOG_DIR, `syslog-${date}.log`);
	fs.appendFile(filePath, `${entry}\n`, (err) => {
		if (err) {
			logError("syslog_write_failed", err);
		}
	});
}

function generateSelfSignedCert() {
	ensureDir(CERT_DIR);
	const keyPath = path.join(CERT_DIR, "syslog-key.pem");
	const certPath = path.join(CERT_DIR, "syslog-cert.pem");

	if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
		return { key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) };
	}

	logInfo("Generating self-signed TLS cert for syslog server...");
	const subj = process.env.SYSLOG_CERT_SUBJ || "/CN=gartexhub-syslog";
	execSync(
		`openssl req -x509 -newkey rsa:2048 -keyout "${keyPath}" -out "${certPath}" -days 3650 -nodes -subj "${subj}" 2>/dev/null`,
	);

	return { key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) };
}

let server = null;

export function startSyslogServer() {
	try {
		if (server) {
			return;
		}

		ensureDir(CERT_DIR);

		let credentials;
		try {
			credentials = generateSelfSignedCert();
		} catch (err) {
			logWarn("Syslog cert not available, skipping syslog server", err.message);
			return;
		}

		server = tls.createServer(credentials, (socket) => {
			const remote = `${socket.remoteAddress || "unknown"}:${socket.remotePort || "?"}`;

			socket.on("data", (data) => {
				const chunks = data.toString("utf-8").split("\n").filter(Boolean);
				for (const chunk of chunks) {
					const parsed = parseRfc5424(chunk);
					const formatted = formatSyslogEntry(parsed);
					logInfo("syslog entry", { entry: formatted });
					writeLogFile(formatted);
				}
			});

			socket.on("error", (err) => {
				logError("syslog_socket_error", { remote, error: err.message });
			});
		});

		server.on("error", (err) => {
			if (err.code === "EADDRINUSE") {
				logWarn(`Syslog port ${SYSLOG_PORT} in use, skipping syslog server`);
			} else {
				logWarn("Syslog server error, skipping", err.message);
			}
			server = null;
		});

		server.listen(SYSLOG_PORT, () => {
			logInfo(`Syslog server listening on port ${SYSLOG_PORT} (TLS)`);
		});
	} catch (err) {
		logWarn("Syslog server not available, continuing without it", err.message);
	}
}

export function stopSyslogServer() {
	if (!server) {
		return;
	}
	server.close();
	server = null;
	logInfo("Syslog server stopped");
}
