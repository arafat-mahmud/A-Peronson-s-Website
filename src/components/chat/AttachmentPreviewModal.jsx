import DOMPurify from "dompurify";
import { Download, File, X } from "lucide-react";
import Prism from "prismjs";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Atom } from "react-loading-indicators";
import { useSignedSrcState } from "../../hooks/useSignedSrc.js";
import {
	describeSignFailure,
	isThirdPartySafe,
	signAndDownloadWithReason,
	signAndOpen,
	signEntry,
} from "../../lib/signedFile.js";
import LazyImage from "../ui/LazyImage.jsx";
import MarkdownMessage from "./MarkdownMessage.jsx";

// Prism theme CSS is intentionally inlined (per repo styling policy: no external CSS imports).
const PRISM_TOMORROW_CSS = `/**
 * prism.js tomorrow night eighties for JavaScript, CoffeeScript, CSS and HTML
 * Based on https://github.com/chriskempson/tomorrow-theme
 * @author Rose Pritchard
 */

.prism-scope code[class*="language-"],
.prism-scope pre[class*="language-"] {
\tcolor: #ccc;
\tbackground: none;
\tfont-family: Consolas, Monaco, 'Andale Mono', 'Ubuntu Mono', monospace;
\tfont-size: 1em;
\ttext-align: left;
\twhite-space: pre;
\tword-spacing: normal;
\tword-break: normal;
\tword-wrap: normal;
\tline-height: 1.5;

\t-moz-tab-size: 4;
\t-o-tab-size: 4;
\ttab-size: 4;

\t-webkit-hyphens: none;
\t-moz-hyphens: none;
\t-ms-hyphens: none;
\thyphens: none;

}

/* Code blocks */
.prism-scope pre[class*="language-"] {
\tpadding: 1em;
\tmargin: .5em 0;
\toverflow: auto;
}

.prism-scope :not(pre) > code[class*="language-"],
.prism-scope pre[class*="language-"] {
\tbackground: #2d2d2d;
}

/* Inline code */
.prism-scope :not(pre) > code[class*="language-"] {
\tpadding: .1em;
\tborder-radius: .3em;
\twhite-space: normal;
}

.prism-scope .token.comment,
.prism-scope .token.block-comment,
.prism-scope .token.prolog,
.prism-scope .token.doctype,
.prism-scope .token.cdata {
\tcolor: #999;
}

.prism-scope .token.punctuation {
\tcolor: #ccc;
}

.prism-scope .token.tag,
.prism-scope .token.attr-name,
.prism-scope .token.namespace,
.prism-scope .token.deleted {
\tcolor: #e2777a;
}

.prism-scope .token.function-name {
\tcolor: #6196cc;
}

.prism-scope .token.boolean,
.prism-scope .token.number,
.prism-scope .token.function {
\tcolor: #f08d49;
}

.prism-scope .token.property,
.prism-scope .token.class-name,
.prism-scope .token.constant,
.prism-scope .token.symbol {
\tcolor: #f8c555;
}

.prism-scope .token.selector,
.prism-scope .token.important,
.prism-scope .token.atrule,
.prism-scope .token.keyword,
.prism-scope .token.builtin {
\tcolor: #cc99cd;
}

.prism-scope .token.string,
.prism-scope .token.char,
.prism-scope .token.attr-value,
.prism-scope .token.regex,
.prism-scope .token.variable {
\tcolor: #7ec699;
}

.prism-scope .token.operator,
.prism-scope .token.entity,
.prism-scope .token.url {
\tcolor: #67cdcc;
}

.prism-scope .token.important,
.prism-scope .token.bold {
\tfont-weight: bold;
}
.prism-scope .token.italic {
\tfont-style: italic;
}

.prism-scope .token.entity {
\tcursor: help;
}

.prism-scope .token.inserted {
\tcolor: green;
}
`;

const IMAGE_EXTS = new Set([
	"jpg",
	"jpeg",
	"png",
	"webp",
	"avif",
	"gif",
	"apng",
	"bmp",
	"tiff",
	"tif",
	"heic",
	"heif",
	"dcm",
	"tga",
	"svg",
	"eps",
	"pdf",
	"dng",
	"cr2",
	"cr3",
	"nef",
	"arw",
	"sr2",
	"orf",
	"raf",
	"psd",
	"ai",
	"xcf",
	"cdr",
]);
const VIDEO_EXTS = new Set([
	"mp4",
	"webm",
	"mkv",
	"flv",
	"vob",
	"ogv",
	"ogg",
	"rrc",
	"gifv",
	"mng",
	"mov",
	"avi",
	"qt",
	"wmv",
	"yuv",
	"rm",
	"asf",
	"amv",
	"m4p",
	"m4v",
	"mpg",
	"mp2",
	"mpeg",
	"mpe",
	"mpv",
	"svi",
	"3gp",
	"3g2",
	"mxf",
	"roq",
	"nsv",
	"f4v",
	"f4p",
	"f4a",
	"f4b",
	"mod",
]);
const MARKDOWN_EXTS = new Set(["md", "markdown"]);
const OFFICE_EXTS = new Set(["doc", "docx"]);
const SPREADSHEET_EXTS = new Set(["xls", "xlsx", "csv"]);
const PRESENTATION_EXTS = new Set(["ppt", "pptx"]);
const RTF_EXTS = new Set(["rtf"]);
const ODT_EXTS = new Set(["odt"]);
const HTML_EXTS = new Set(["html", "htm"]);
const XML_EXTS = new Set(["xml"]);
const CODE_EXTS = new Set([
	"c",
	"cpp",
	"h",
	"hpp",
	"java",
	"py",
	"js",
	"jsx",
	"ts",
	"tsx",
	"cs",
	"php",
	"go",
	"rb",
	"sql",
	"sh",
	"asm",
	"css",
	"json",
	"jsonc",
	"yml",
	"yaml",
	"kt",
	"ps1",
	"bat",
]);
const TEXT_EXTS = new Set([
	"txt",
	"log",
	"csv",
	"tsv",
	"json",
	"jsonc",
	"xml",
	"sln",
	"cbp",
	"html",
	"htm",
	"css",
	"js",
	"jsx",
	"ts",
	"tsx",
	"py",
	"java",
	"c",
	"cpp",
	"h",
	"hpp",
	"sql",
	"yml",
	"yaml",
	...MARKDOWN_EXTS,
]);

function safeExt(value = "") {
	const raw = String(value || "").trim();
	if (!raw) {
		return "";
	}
	const cleaned = raw.split("*")[0].split("#")[0];
	const tail = cleaned.split("/").pop() || cleaned;
	const match = tail.match(/\.([a-z0-9]+)$/i);
	return match ? match[1].toLowerCase() : "";
}

function classifyAttachment(file) {
	const mime = String(file?.mimeType || file?.mime_type || "")
		.trim()
		.toLowerCase();
	const ext = safeExt(file?.name) || safeExt(file?.url);

	if (mime.startsWith("image/")) {
		return "image";
	}
	if (mime.startsWith("video/")) {
		return "video";
	}
	if (mime === "application/pdf" || ext === "pdf") {
		return "pdf";
	}
	if (OFFICE_EXTS.has(ext)) {
		return "office";
	}
	if (SPREADSHEET_EXTS.has(ext)) {
		return "spreadsheet";
	}
	if (PRESENTATION_EXTS.has(ext)) {
		return "presentation";
	}
	if (RTF_EXTS.has(ext)) {
		return "rtf";
	}
	if (ODT_EXTS.has(ext)) {
		return "odt";
	}
	if (HTML_EXTS.has(ext)) {
		return "html";
	}
	if (XML_EXTS.has(ext)) {
		return "xml";
	}
	if (mime.includes("markdown") || MARKDOWN_EXTS.has(ext)) {
		return "markdown";
	}
	if (CODE_EXTS.has(ext)) {
		return "code";
	}
	if (mime.startsWith("text/")) {
		return "text";
	}
	if (IMAGE_EXTS.has(ext)) {
		return "image";
	}
	if (VIDEO_EXTS.has(ext)) {
		return "video";
	}
	if (TEXT_EXTS.has(ext)) {
		return MARKDOWN_EXTS.has(ext) ? "markdown" : "text";
	}
	return "file";
}

// A file name the browser will accept as a download name: no path separators
// and no characters that would change where the file lands. Mirrors the helper
// in FileAttachmentCard.
function safeDownloadName(name = "") {
	const cleaned = String(name || "").trim();
	if (!cleaned) {
		return;
	}
	return cleaned.replace(/[\\/:?"<>|]+/g, "_");
}

function downloadAttachmentMetadata(file) {
	if (!file) return;
	const url = String(file.url || "");
	const name = String(file.name || url.split("/").pop() || "download");
	const base = name.includes(".") ? name.slice(0, name.lastIndexOf(".")) : name;
	const payload = {
		exported_at: new Date().toISOString(),
		file: {
			name,
			mime_type: file.mime_type || file.mimeType || "",
			size_bytes: file.size || null,
			url,
			extension: name.includes(".") ? name.split(".").pop() : "",
		},
		sender: file.sender || null,
		message_id: file.message_id || file.id || null,
		uploaded_at: file.uploaded_at || file.created_at || null,
	};
	const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
	const blobUrl = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = blobUrl;
	a.download = `${base}_metadata.json`;
	document.body.appendChild(a);
	a.click();
	a.remove();
	URL.revokeObjectURL(blobUrl);
}

function asAbsoluteUrl(url = "") {
	const raw = String(url || "").trim();
	if (!raw) {
		return "";
	}
	try {
		return new URL(raw, window.location.origin).toString();
	} catch {
		return raw;
	}
}

function isPrivateHostname(hostname = "") {
	const lower = String(hostname || "")
		.trim()
		.toLowerCase();
	if (!lower) {
		return true;
	}
	if (lower === "localhost" || lower === "127.0.0.1") {
		return true;
	}
	if (lower.endsWith(".local")) {
		return true;
	}

	// Private IPv4 ranges
	if (/^\\d+\\.\\d+\\.\\d+\\.\\d+$/.test(lower)) {
		const parts = lower.split(".").map((v) => Number(v));
		if (parts.length === 4 && parts.every((n) => Number.isFinite(n))) {
			if (parts[0] === 10) {
				return true;
			}
			if (parts[0] === 192 && parts[1] === 168) {
				return true;
			}
			if (parts[0] === 169 && parts[1] === 254) {
				return true;
			}
			if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) {
				return true;
			}
		}
	}
	return false;
}

function officeViewerEmbedUrl(fileUrl = "") {
	const absolute = asAbsoluteUrl(fileUrl);
	if (!absolute) {
		return "";
	}
	return `https://view.officeapps.live.com/op/embed.aspx*src=${encodeURIComponent(absolute)}`;
}

function prismLanguageForExt(ext = "") {
	const normalized = String(ext || "")
		.trim()
		.toLowerCase();
	if (!normalized) {
		return "";
	}
	if (normalized === "js") {
		return "javascript";
	}
	if (normalized === "jsx") {
		return "jsx";
	}
	if (normalized === "ts") {
		return "typescript";
	}
	if (normalized === "tsx") {
		return "tsx";
	}
	if (normalized === "py") {
		return "python";
	}
	if (normalized === "rb") {
		return "ruby";
	}
	if (normalized === "kt") {
		return "kotlin";
	}
	if (normalized === "json" || normalized === "jsonc") {
		return "json";
	}
	if (normalized === "yml" || normalized === "yaml") {
		return "yaml";
	}
	if (normalized === "sh") {
		return "bash";
	}
	if (normalized === "ps1") {
		return "powershell";
	}
	if (normalized === "bat") {
		return "batch";
	}
	if (normalized === "asm") {
		return "nasm";
	}
	if (normalized === "h" || normalized === "hpp" || normalized === "cpp") {
		return "cpp";
	}
	if (normalized === "c") {
		return "c";
	}
	if (normalized === "cs") {
		return "csharp";
	}
	return normalized;
}

const PRISM_LOADERS = {
	markup: async () => {
		await import("prismjs/components/prism-markup.js");
	},
	css: async () => {
		await import("prismjs/components/prism-css.js");
	},
	clike: async () => {
		await import("prismjs/components/prism-clike.js");
	},
	javascript: async () => {
		await PRISM_LOADERS.clike();
		await import("prismjs/components/prism-javascript.js");
	},
	jsx: async () => {
		await PRISM_LOADERS.javascript();
		await import("prismjs/components/prism-jsx.js");
	},
	typescript: async () => {
		await PRISM_LOADERS.javascript();
		await import("prismjs/components/prism-typescript.js");
	},
	tsx: async () => {
		await PRISM_LOADERS.typescript();
		await import("prismjs/components/prism-tsx.js");
	},
	json: async () => {
		await import("prismjs/components/prism-json.js");
	},
	yaml: async () => {
		await import("prismjs/components/prism-yaml.js");
	},
	python: async () => {
		await import("prismjs/components/prism-python.js");
	},
	java: async () => {
		await PRISM_LOADERS.clike();
		await import("prismjs/components/prism-java.js");
	},
	c: async () => {
		await PRISM_LOADERS.clike();
		await import("prismjs/components/prism-c.js");
	},
	cpp: async () => {
		await PRISM_LOADERS.clike();
		await import("prismjs/components/prism-cpp.js");
	},
	csharp: async () => {
		await PRISM_LOADERS.clike();
		await import("prismjs/components/prism-csharp.js");
	},
	php: async () => {
		await PRISM_LOADERS.clike();
		await PRISM_LOADERS.javascript();
		await import("prismjs/components/prism-php.js");
	},
	go: async () => {
		await import("prismjs/components/prism-go.js");
	},
	ruby: async () => {
		await import("prismjs/components/prism-ruby.js");
	},
	sql: async () => {
		await import("prismjs/components/prism-sql.js");
	},
	bash: async () => {
		await import("prismjs/components/prism-bash.js");
	},
	powershell: async () => {
		await import("prismjs/components/prism-powershell.js");
	},
	batch: async () => {
		await import("prismjs/components/prism-batch.js");
	},
	kotlin: async () => {
		await PRISM_LOADERS.clike();
		await import("prismjs/components/prism-kotlin.js");
	},
	nasm: async () => {
		await import("prismjs/components/prism-nasm.js");
	},
};

async function ensurePrismLanguage(lang = "") {
	const normalized = String(lang || "")
		.trim()
		.toLowerCase();
	if (!normalized) {
		return "";
	}
	if (normalized === "xml" || normalized === "html") {
		return ensurePrismLanguage("markup");
	}
	if (Prism?.languages?.[normalized]) {
		return normalized;
	}
	const loader = PRISM_LOADERS[normalized];
	if (!loader) {
		return normalized;
	}
	try {
		await loader();
	} catch {
		// Ignore missing/failed language chunks.
	}
	return normalized;
}

function escapeHtml(value = "") {
	return String(value || "")
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;");
}

function sanitizeHtml(html = "") {
	return DOMPurify.sanitize(String(html || ""), {
		ALLOWED_TAGS: [
			"p",
			"br",
			"strong",
			"em",
			"u",
			"a",
			"ul",
			"li",
			"ol",
			"pre",
			"code",
			"span",
			"div",
			"h1",
			"h2",
			"h3",
			"h4",
			"h5",
			"h6",
			"table",
			"thead",
			"tbody",
			"tr",
			"th",
			"td",
			"blockquote",
			"hr",
			"img",
			"figure",
			"figcaption",
			"dl",
			"dt",
			"dd",
			"sub",
			"sup",
		],
		ALLOWED_ATTR: ["href", "target", "src", "alt", "class", "id", "style"],
	});
}

function formatXml(xmlText = "") {
	const raw = String(xmlText || "").trim();
	if (!raw) {
		return "";
	}
	try {
		const parser = new DOMParser();
		const xmlDoc = parser.parseFromString(raw, "text/xml");
		const parseError = xmlDoc.getElementsByTagName("parsererror")?.[0];
		if (parseError) {
			return raw;
		}

		const serializer = new XMLSerializer();
		const serialized = serializer.serializeToString(xmlDoc);

		const withLines = serialized.replace(/(>)(<)(\/*)/g, "$1\n$2$3");
		const lines = withLines
			.split("\n")
			.map((line) => line.trim())
			.filter(Boolean);

		let indent = 0;
		const formatted = lines
			.map((line) => {
				const isClosing = /^<\//.test(line);
				const isSelfClosing = /\/>$/.test(line) || /^<\*xml/.test(line) || /^<!/.test(line);
				if (isClosing) {
					indent = Math.max(indent - 1, 0);
				}
				const pad = "  ".repeat(indent);
				if (!(isClosing || isSelfClosing) && /^<[^!*/][^>]*>$/.test(line)) {
					indent += 1;
				}
				return `${pad}${line}`;
			})
			.join("\n");

		return formatted;
	} catch {
		return raw;
	}
}

function AttachmentPreviewModal({ open = false, attachment = null, onClose = null }) {
	const file = attachment || null;
	const kind = classifyAttachment(file);
	const fileExt = useMemo(() => safeExt(file?.name) || safeExt(file?.url), [file?.name, file?.url]);
	const [textState, setTextState] = useState({
		loading: false,
		error: "",
		content: "",
	});
	const [highlightState, setHighlightState] = useState({
		loading: false,
		error: "",
		html: "",
		language: "",
		content: "",
	});
	const workbookRef = useRef(null);
	const xlsxUtilsRef = useRef(null);
	const [spreadsheetState, setSpreadsheetState] = useState({
		loading: false,
		error: "",
		sheetNames: [],
		activeSheet: "",
		rows: [],
	});
	const [rtfState, setRtfState] = useState({
		loading: false,
		error: "",
		html: "",
		meta: null,
	});
	const [videoError, setVideoError] = useState(false);
	const [actionError, setActionError] = useState("");
	const [pdfState, setPdfState] = useState({
		loading: false,
		error: "",
		blobUrl: "",
	});
	// The only url allowed to reach an <img>/<video>/<iframe> src. It stays ""
	// until the server hands back a signature, and stays "" if it refuses, so an
	// unsigned private path is never rendered. It re-signs on the schedule the
	// server itself dictates (half the signature's lifetime), because this
	// modal can sit open far longer than one signature lasts.
	// The error half matters as much as the url half: a sign that failed
	// because the server is rate limiting the caller will not resolve on its
	// own, and a preview that silently does not appear is a preview the user
	// cannot act on.
	const { src: signedSrc, error: signError } = useSignedSrcState(open ? file?.url || "" : "");
	// Whether this document may be handed to the Office viewer. The server
	// answers that, because it owns the gated-prefix list; a client-side copy
	// of the list drifts, and a private document's signed url reaching
	// view.officeapps.live.com is a third party fetching and retaining it.
	// null = not answered yet, false = not safe (the default until the server
	// says otherwise), true = safe. The embed is suppressed unless it is true.
	const [thirdPartySafe, setThirdPartySafe] = useState(null);

	useEffect(() => {
		if (!(open && file?.url)) {
			setThirdPartySafe(null);
			return;
		}
		let alive = true;
		void isThirdPartySafe(file.url).then((safe) => {
			if (alive) {
				setThirdPartySafe(safe === true);
			}
		});
		return () => {
			alive = false;
		};
	}, [open, file?.url]);
	useEffect(() => {
		if (!open) {
			return;
		}
		const handler = (event) => {
			if (event.key === "Escape") {
				onClose?.();
			}
		};
		window.addEventListener("keydown", handler);
		return () => window.removeEventListener("keydown", handler);
	}, [open, onClose]);

	useEffect(() => {
		// eslint-disable-next-line react-hooks/set-state-in-effect
		setVideoError(false);
	}, []);

	// Removed: the hook above now owns signing for this modal, including the
	// re-sign on the refresh interval. The download and "open in new tab"
	// actions still sign in their click handlers, so nothing here is spent on an
	// action that may not happen for another hour.

	useEffect(() => {
		if (
			!(open && file?.url) ||
			(kind !== "text" &&
				kind !== "markdown" &&
				kind !== "code" &&
				kind !== "xml" &&
				kind !== "html")
		) {
			// eslint-disable-next-line react-hooks/set-state-in-effect
			setTextState({ loading: false, error: "", content: "" });
			return;
		}

		let alive = true;
		const controller = new AbortController();

		async function load() {
			setTextState({ loading: true, error: "", content: "" });
			try {
				const entry = await signEntry(file.url);
				if (!entry?.url) {
					throw new Error(describeSignFailure(entry));
				}
				const signed = entry.url;
				const response = await fetch(signed, { signal: controller.signal });
				if (!response.ok) {
					throw new Error(`Unable to load preview (${response.status})`);
				}

				const len = Number(response.headers.get("content-length") || "0");
				if (len && len > 600_000) {
					setTextState({
						loading: false,
						error: "File is too large to preview. Please download it.",
						content: "",
					});
					return;
				}

				const content = await response.text();
				const clipped =
					content.length > 200_000 ? `${content.slice(0, 200_000)}\n\n...(truncated)` : content;
				if (!alive) {
					return;
				}
				setTextState({ loading: false, error: "", content: clipped });
			} catch (error) {
				if (!alive) {
					return;
				}
				if (error?.name === "AbortError") {
					return;
				}
				setTextState({
					loading: false,
					error: error?.message || "Unable to load preview",
					content: "",
				});
			}
		}

		load();

		return () => {
			alive = false;
			controller.abort();
		};
	}, [open, file?.url, kind]);

	useEffect(() => {
		if (!(open && file?.url) || (kind !== "code" && kind !== "xml")) {
			// eslint-disable-next-line react-hooks/set-state-in-effect
			setHighlightState({
				loading: false,
				error: "",
				html: "",
				language: "",
				content: "",
			});
			return;
		}

		if (textState.loading) {
			setHighlightState({
				loading: true,
				error: "",
				html: "",
				language: "",
				content: "",
			});
			return;
		}

		if (textState.error) {
			setHighlightState({
				loading: false,
				error: textState.error,
				html: "",
				language: "",
				content: "",
			});
			return;
		}

		const raw = String(textState.content || "");
		if (!raw.trim()) {
			setHighlightState({
				loading: false,
				error: "",
				html: "",
				language: "",
				content: "",
			});
			return;
		}

		let alive = true;

		async function highlight() {
			setHighlightState({
				loading: true,
				error: "",
				html: "",
				language: "",
				content: "",
			});
			try {
				const source = kind === "xml" ? formatXml(raw) : raw;
				const targetLang = kind === "xml" ? "markup" : prismLanguageForExt(fileExt) || "markup";
				const lang = await ensurePrismLanguage(targetLang);
				const grammar = Prism?.languages?.[lang] || Prism?.languages?.markup;
				const html = grammar ? Prism.highlight(source, grammar, lang) : escapeHtml(source);
				if (!alive) {
					return;
				}
				setHighlightState({
					loading: false,
					error: "",
					html,
					language: lang,
					content: source,
				});
			} catch (error) {
				if (!alive) {
					return;
				}
				setHighlightState({
					loading: false,
					error: error?.message || "Unable to highlight preview",
					html: escapeHtml(kind === "xml" ? formatXml(raw) : raw),
					language: "",
					content: kind === "xml" ? formatXml(raw) : raw,
				});
			}
		}

		highlight();

		return () => {
			alive = false;
		};
	}, [open, file?.url, kind, fileExt, textState.loading, textState.error, textState.content]);

	useEffect(() => {
		if (!(open && file?.url) || kind !== "spreadsheet") {
			workbookRef.current = null;
			xlsxUtilsRef.current = null;
			// eslint-disable-next-line react-hooks/set-state-in-effect
			setSpreadsheetState({
				loading: false,
				error: "",
				sheetNames: [],
				activeSheet: "",
				rows: [],
			});
			return;
		}

		let alive = true;
		const controller = new AbortController();

		function sheetToRows(sheet, utils) {
			if (!(sheet && utils)) {
				return [];
			}
			const rawRows = utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" }) || [];
			const limitedRows = rawRows
				.slice(0, 200)
				.map((row) => (Array.isArray(row) ? row.slice(0, 40) : []));
			return limitedRows;
		}

		async function loadSpreadsheet() {
			setSpreadsheetState({
				loading: true,
				error: "",
				sheetNames: [],
				activeSheet: "",
				rows: [],
			});
			try {
				const entry = await signEntry(file.url);
				if (!entry?.url) {
					throw new Error(describeSignFailure(entry));
				}
				const signed = entry.url;
				const response = await fetch(signed, { signal: controller.signal });
				if (!response.ok) {
					throw new Error(`Unable to load spreadsheet (${response.status})`);
				}

				const len = Number(response.headers.get("content-length") || "0");
				if (len && len > 25_000_000) {
					setSpreadsheetState({
						loading: false,
						error: "Spreadsheet is too large to preview. Please download it.",
						sheetNames: [],
						activeSheet: "",
						rows: [],
					});
					return;
				}

				const buffer = await response.arrayBuffer();
				const xlsx = await import("xlsx");
				const workbook = xlsx.read(buffer, { type: "array" });
				const utils = xlsx.utils;

				workbookRef.current = workbook;
				xlsxUtilsRef.current = utils;

				const sheetNames = workbook?.SheetNames || [];
				const activeSheet = sheetNames[0] || "";
				const sheet = activeSheet ? workbook?.Sheets?.[activeSheet] : null;
				const rows = sheetToRows(sheet, utils);

				if (!alive) {
					return;
				}
				setSpreadsheetState({
					loading: false,
					error: "",
					sheetNames,
					activeSheet,
					rows,
				});
			} catch (error) {
				if (!alive) {
					return;
				}
				if (error?.name === "AbortError") {
					return;
				}
				setSpreadsheetState({
					loading: false,
					error: error?.message || "Unable to preview spreadsheet",
					sheetNames: [],
					activeSheet: "",
					rows: [],
				});
			}
		}

		loadSpreadsheet();

		return () => {
			alive = false;
			controller.abort();
			workbookRef.current = null;
			xlsxUtilsRef.current = null;
		};
	}, [open, file?.url, kind]);

	useEffect(() => {
		if (!(open && file?.url) || kind !== "rtf") {
			// eslint-disable-next-line react-hooks/set-state-in-effect
			setRtfState({ loading: false, error: "", html: "", meta: null });
			return;
		}

		let alive = true;
		const controller = new AbortController();

		async function loadRtf() {
			setRtfState({ loading: true, error: "", html: "", meta: null });
			try {
				const entry = await signEntry(file.url);
				if (!entry?.url) {
					throw new Error(describeSignFailure(entry));
				}
				const signed = entry.url;
				const response = await fetch(signed, { signal: controller.signal });
				if (!response.ok) {
					throw new Error(`Unable to load RTF (${response.status})`);
				}

				const len = Number(response.headers.get("content-length") || "0");
				if (len && len > 5_000_000) {
					setRtfState({
						loading: false,
						error: "RTF file is too large to preview. Please download it.",
						html: "",
						meta: null,
					});
					return;
				}

				const buffer = await response.arrayBuffer();
				let EMFJS;
				let RTFJS;
				let WMFJS;
				try {
					({ EMFJS, RTFJS, WMFJS } = await import("rtf.js"));
				} catch {
					setRtfState({
						loading: false,
						error: "RTF preview is not available (missing library). Please download the file.",
						html: "",
						meta: null,
					});
					return;
				}

				// Disable noisy logging in production.
				try {
					RTFJS.loggingEnabled(false);
				} catch {
					/* noop */
				}
				try {
					WMFJS.loggingEnabled(false);
				} catch {
					/* noop */
				}
				try {
					EMFJS.loggingEnabled(false);
				} catch {
					/* noop */
				}

				const doc = new RTFJS.Document(buffer);
				const meta = doc.metadata?.() || null;
				const htmlElements = await doc.render();

				const wrapper = document.createElement("div");
				(htmlElements || []).forEach((el) => {
					try {
						wrapper.appendChild(el);
					} catch {
						/* noop */
					}
				});

				if (!alive) {
					return;
				}
				setRtfState({
					loading: false,
					error: "",
					html: wrapper.innerHTML,
					meta,
				});
			} catch (error) {
				if (!alive) {
					return;
				}
				if (error?.name === "AbortError") {
					return;
				}
				setRtfState({
					loading: false,
					error: error?.message || "Unable to preview RTF",
					html: "",
					meta: null,
				});
			}
		}

		loadRtf();

		return () => {
			alive = false;
			controller.abort();
		};
	}, [open, file?.url, kind]);

	useEffect(() => {
		if (!(open && file?.url) || kind !== "pdf") {
			// eslint-disable-next-line react-hooks/set-state-in-effect
			setPdfState({ loading: false, error: "", blobUrl: "" });
			return;
		}

		let alive = true;
		const controller = new AbortController();
		let blobUrl = "";

		async function loadPdf() {
			setPdfState({ loading: true, error: "", blobUrl: "" });
			try {
				const entry = await signEntry(file.url);
				if (!entry?.url) {
					throw new Error(describeSignFailure(entry));
				}
				const signed = entry.url;
				const response = await fetch(signed, { signal: controller.signal });
				if (!response.ok) {
					throw new Error(`Unable to load PDF (${response.status})`);
				}

				const len = Number(response.headers.get("content-length") || "0");
				if (len && len > 25_000_000) {
					setPdfState({
						loading: false,
						error: "PDF is too large to preview. Please download it.",
						blobUrl: "",
					});
					return;
				}

				const blob = await response.blob();
				blobUrl = URL.createObjectURL(blob);
				if (!alive) {
					URL.revokeObjectURL(blobUrl);
					return;
				}
				setPdfState({ loading: false, error: "", blobUrl });
			} catch (error) {
				if (!alive) {
					return;
				}
				if (error?.name === "AbortError") {
					return;
				}
				setPdfState({
					loading: false,
					error: error?.message || "Unable to load PDF preview",
					blobUrl: "",
				});
			}
		}

		loadPdf();

		return () => {
			alive = false;
			controller.abort();
			if (blobUrl) {
				URL.revokeObjectURL(blobUrl);
			}
		};
	}, [open, file?.url, kind]);

	if (!(open && file?.url)) {
		return null;
	}

	const title = String(file.name || "Attachment");
	const subtitle = String(file.mimeType || file.mime_type || "").trim();
	// Diagnostic only - the private-hostname check below and the "your url is
	// private" notice both need to know the host. Never used as an href, a src
	// or a fetch target; those all go through signedSrc or a click-time sign.
	const absoluteFileUrl = asAbsoluteUrl(file.url);
	// A signed url is a bearer credential with a five-minute life, and the Office
	// viewer is a third party: pointing it at a gated document lets Microsoft
	// fetch and retain a private file. So the embed is suppressed unless the
	// SERVER says the path is not gated, and only ever built from the plain url
	// of a public document.
	const officeEmbed =
		(kind === "office" || kind === "presentation") && thirdPartySafe
			? officeViewerEmbedUrl(file.url)
			: "";
	const officeIsPrivate = (() => {
		if (kind !== "office" && kind !== "presentation") {
			return false;
		}
		try {
			const host = new URL(absoluteFileUrl).hostname;
			return isPrivateHostname(host);
		} catch {
			return true;
		}
	})();

	function selectSpreadsheetSheet(nextSheet) {
		const wb = workbookRef.current;
		const utils = xlsxUtilsRef.current;
		if (!(wb && utils)) {
			return;
		}
		const sheet = wb?.Sheets?.[nextSheet];
		const rawRows = utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" }) || [];
		const rows = rawRows.slice(0, 200).map((row) => (Array.isArray(row) ? row.slice(0, 40) : []));
		setSpreadsheetState((prev) => ({ ...prev, activeSheet: nextSheet, rows }));
	}

	return (
		<div
			class="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4"
			onMouseDown={(event) => {
				if (event.target === event.currentTarget) {
					onClose?.();
				}
			}}
		>
			<style>{PRISM_TOMORROW_CSS}</style>
			<div
				class="prism-scope w-full max-w-4xl overflow-hidden rounded-2xl shadow-borderless dark:shadow-borderlessDark bg-[var(--theme-custom-0f0d22)] shadow-2xl"
				onMouseDown={(event) => event.stopPropagation()}
			>
				<div class="flex items-center justify-between gap-3 shadow-dividerB dark:shadow-dividerBDark px-4 py-3">
					<div class="min-w-0">
						<div class="truncate text-sm font-semibold text-white">{title}</div>
						{subtitle ? <div class="truncate text-[11px] text-slate-400">{subtitle}</div> : null}
					</div>
					<div class="flex items-center gap-2">
						<button
							type="button"
							onClick={() => downloadAttachmentMetadata(attachment)}
							class="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-white/20"
							title="Download file + metadata"
						>
							<Download size={14} />
							<span class="hidden sm:inline">Download</span>
						</button>
						<button
							type="button"
							onClick={() => {
								// signAndDownload, not signAndOpen: window.open renders the
								// document inline in a new tab, it does not save it. A
								// download needs the synthesised anchor that
								// signAndDownload clicks, because a signed url cannot carry
								// a download attribute.
								//
								// The reason-aware form is used so a download that could
								// not start says so. A rate-limited download and a
								// refused one used to be the same silence.
								void signAndDownloadWithReason(file.url, safeDownloadName(file.name)).then(
									(outcome) => {
										setActionError(outcome.ok ? "" : outcome.error);
									},
								);
							}}
							class="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-white/20"
							title="Download"
						>
							<Download size={14} />
							<span class="hidden sm:inline">Download</span>
						</button>
						<button
							type="button"
							onClick={() => onClose?.()}
							class="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-white transition-colors hover:bg-white/20"
							title="Close"
						>
							<X size={16} />
						</button>
					</div>
				</div>

				<div data-lenis-prevent={true} class="max-h-[75vh] overflow-auto p-4">
					{signError ? (
						<div class="rounded-xl bg-yellow-500/10 p-4 text-sm text-yellow-100" role="status">
							{describeSignFailure(signError)}
						</div>
					) : null}

					{actionError ? (
						<div class="rounded-xl bg-red-500/10 p-4 text-sm text-red-200" role="status">
							{actionError}
						</div>
					) : null}

					{kind === "image" ? (
						<div class="flex justify-center">
							<LazyImage
								src={signedSrc || undefined}
								alt={file.name || "Preview"}
								width={800}
								height={600}
								class="max-h-[70vh] w-auto max-w-full rounded-xl object-contain"
							/>
						</div>
					) : null}

					{kind === "video" ? (
						<div class="space-y-3">
							{videoError ? (
								<div class="rounded-xl shadow-borderless dark:shadow-borderlessDark bg-white/5 p-4 text-sm text-slate-200">
									This video format can't be previewed in your browser. Please download the file to
									play it.
								</div>
							) : (
								<video
									src={signedSrc || undefined}
									controls={true}
									autoPlay={true}
									playsInline={true}
									class="w-full max-h-[70vh] rounded-xl bg-black"
									onError={() => setVideoError(true)}
								/>
							)}
						</div>
					) : null}

					{kind === "pdf" ? (
						<div class="space-y-3">
							{pdfState.loading ? (
								<div class="text-sm text-slate-300">
									<Atom
										color="#337ab0"
										size="small"
										text="Loading preview..."
										textColor="#94a3b8"
									/>
								</div>
							) : null}
							{pdfState.error ? (
								<div class="rounded-xl shadow-borderless dark:shadow-borderlessDark bg-red-500/10 p-4 text-sm text-red-200">
									{pdfState.error}
								</div>
							) : null}
							{pdfState.loading || pdfState.error || !pdfState.blobUrl ? null : (
								<div class="h-[70vh] overflow-hidden rounded-xl shadow-borderless dark:shadow-borderlessDark bg-white/5">
									{/* biome-ignore lint/security/useIframeSandbox: a sandboxed iframe cannot run the browser's PDF viewer for this blob: URL */}
									<iframe
										src={pdfState.blobUrl}
										title={file.name || "PDF Preview"}
										class="h-full w-full"
									/>
								</div>
							)}
							<button
								type="button"
								onClick={() => {
									void signAndOpen(file.url);
								}}
								class="inline-flex text-xs font-semibold text-blue-200 underline underline-offset-2 hover:text-blue-100"
							>
								Open in new tab
							</button>
						</div>
					) : null}

					{kind === "office" || kind === "presentation" ? (
						<div class="space-y-3">
							{officeIsPrivate ? (
								<div class="rounded-xl shadow-borderless dark:shadow-borderlessDark bg-yellow-500/10 p-4 text-sm text-yellow-100">
									Microsoft Office Web Viewer needs a publicly reachable URL. Your file URL looks
									local/private ({absoluteFileUrl}). Please use Cloudflare Tunnel / a public domain,
									or download the file.
								</div>
							) : null}
							{thirdPartySafe === false ? (
								<div class="rounded-xl shadow-borderless dark:shadow-borderlessDark bg-yellow-500/10 p-4 text-sm text-yellow-100">
									This document is not handed to the Microsoft Office viewer. Use "Open in new tab"
									below instead — that link is signed for you alone and expires within five minutes.
								</div>
							) : null}
							{!officeIsPrivate && officeEmbed ? (
								<div class="h-[70vh] overflow-hidden rounded-xl shadow-borderless dark:shadow-borderlessDark bg-white/5">
									{/* biome-ignore lint/security/useIframeSandbox: the Office Online viewer needs scripts, same-origin storage and popups; sandboxing it breaks the preview */}
									<iframe
										src={officeEmbed}
										title={file.name || "Office Preview"}
										class="h-full w-full"
									/>
								</div>
							) : null}
							<button
								type="button"
								onClick={() => {
									void signAndOpen(file.url);
								}}
								class="inline-flex text-xs font-semibold text-blue-200 underline underline-offset-2 hover:text-blue-100"
							>
								Open in new tab
							</button>
						</div>
					) : null}

					{kind === "spreadsheet" ? (
						<div class="space-y-3">
							{spreadsheetState.loading ? (
								<div class="text-sm text-slate-300">
									<Atom
										color="#337ab0"
										size="small"
										text="Loading preview..."
										textColor="#94a3b8"
									/>
								</div>
							) : null}
							{spreadsheetState.error ? (
								<div class="rounded-xl shadow-borderless dark:shadow-borderlessDark bg-red-500/10 p-4 text-sm text-red-200">
									{spreadsheetState.error}
								</div>
							) : null}

							{spreadsheetState.loading || spreadsheetState.error ? null : (
								<div class="space-y-3">
									{spreadsheetState.sheetNames.length > 1 ? (
										<div class="flex flex-wrap items-center gap-2">
											<label class="text-[11px] font-semibold text-slate-300">Sheet</label>
											<select
												value={spreadsheetState.activeSheet}
												onChange={(event) => selectSpreadsheetSheet(event.target.value)}
												class="rounded-lg shadow-borderless dark:shadow-borderlessDark bg-white/5 px-2 py-1 text-[11px] text-white outline-none"
											>
												{spreadsheetState.sheetNames.map((name) => (
													<option key={name} value={name}>
														{name}
													</option>
												))}
											</select>
											<div class="text-[11px] text-slate-400">
												Showing up to 200 rows × 40 columns
											</div>
										</div>
									) : (
										<div class="text-[11px] text-slate-400">
											Showing up to 200 rows × 40 columns
										</div>
									)}

									<div class="max-h-[70vh] overflow-x-auto rounded-xl shadow-borderless dark:shadow-borderlessDark bg-black/40">
										<table class="min-w-full text-[12px] text-slate-100 shadow-borderless dark:shadow-borderlessDark">
											<tbody>
												{(spreadsheetState.rows || []).map((row, rowIndex) => (
													<tr key={rowIndex} class={rowIndex === 0 ? "bg-white/5" : ""}>
														{(row || []).map((cell, cellIndex) => (
															<td
																key={cellIndex}
																class="shadow-borderless dark:shadow-borderlessDark px-2 py-1 align-top"
															>
																{String(cell ?? "")}
															</td>
														))}
													</tr>
												))}
											</tbody>
										</table>
									</div>
								</div>
							)}
						</div>
					) : null}

					{kind === "rtf" ? (
						<div class="space-y-3">
							{rtfState.loading ? (
								<div class="text-sm text-slate-300">
									<Atom
										color="#337ab0"
										size="small"
										text="Loading preview..."
										textColor="#94a3b8"
									/>
								</div>
							) : null}
							{rtfState.error ? (
								<div class="rounded-xl shadow-borderless dark:shadow-borderlessDark bg-red-500/10 p-4 text-sm text-red-200">
									{rtfState.error}
								</div>
							) : null}
							{rtfState.loading || rtfState.error ? null : (
								<div class="rounded-xl shadow-borderless dark:shadow-borderlessDark bg-white/5 p-4 text-slate-100">
									<div
										class="prose prose-invert max-w-none text-[13px] leading-relaxed"
										dangerouslySetInnerHTML={{
											__html: sanitizeHtml(rtfState.html || ""),
										}}
									/>
								</div>
							)}
						</div>
					) : null}

					{kind === "odt" ? (
						<div class="rounded-xl shadow-borderless dark:shadow-borderlessDark bg-white/5 p-4 text-sm text-slate-200">
							ODT preview requires WebODF, which is not included in this build. Please download the
							file to view it.
						</div>
					) : null}

					{kind === "html" ? (
						<div class="space-y-3">
							{textState.loading ? (
								<div class="text-sm text-slate-300">
									<Atom
										color="#337ab0"
										size="small"
										text="Loading preview..."
										textColor="#94a3b8"
									/>
								</div>
							) : null}
							{textState.error ? (
								<div class="rounded-xl shadow-borderless dark:shadow-borderlessDark bg-red-500/10 p-4 text-sm text-red-200">
									{textState.error}
								</div>
							) : null}
							{textState.loading || textState.error ? null : (
								<div class="h-[70vh] overflow-hidden rounded-xl shadow-borderless dark:shadow-borderlessDark bg-white/5">
									<iframe
										title={file.name || "HTML Preview"}
										sandbox=""
										referrerPolicy="no-referrer"
										class="h-full w-full bg-white"
										srcDoc={String(textState.content || "")}
									/>
								</div>
							)}
							<button
								type="button"
								onClick={() => {
									void signAndOpen(file.url);
								}}
								class="inline-flex text-xs font-semibold text-blue-200 underline underline-offset-2 hover:text-blue-100"
							>
								Open file URL in new tab
							</button>
						</div>
					) : null}

					{kind === "xml" ? (
						<div class="space-y-3">
							{textState.loading ? (
								<div class="text-sm text-slate-300">
									<Atom
										color="#337ab0"
										size="small"
										text="Loading preview..."
										textColor="#94a3b8"
									/>
								</div>
							) : null}
							{textState.error ? (
								<div class="rounded-xl shadow-borderless dark:shadow-borderlessDark bg-red-500/10 p-4 text-sm text-red-200">
									{textState.error}
								</div>
							) : null}
							{highlightState.loading ? (
								<div class="text-sm text-slate-300">
									<Atom
										color="#337ab0"
										size="small"
										text="Formatting and highlighting..."
										textColor="#94a3b8"
									/>
								</div>
							) : null}
							{highlightState.error ? (
								<div class="rounded-xl shadow-borderless dark:shadow-borderlessDark bg-yellow-500/10 p-4 text-sm text-yellow-100">
									{highlightState.error}
								</div>
							) : null}
							{textState.loading || textState.error || highlightState.loading ? null : (
								<pre
									data-lenis-prevent={true}
									class="language-markup overflow-auto rounded-xl shadow-borderless dark:shadow-borderlessDark bg-black/40 p-4 text-[12px] leading-relaxed text-slate-100"
								>
									<code
										dangerouslySetInnerHTML={{
											__html: sanitizeHtml(
												highlightState.html || escapeHtml(formatXml(textState.content || "")),
											),
										}}
									/>
								</pre>
							)}
						</div>
					) : null}

					{kind === "code" ? (
						<div class="space-y-3">
							{textState.loading ? (
								<div class="text-sm text-slate-300">
									<Atom
										color="#337ab0"
										size="small"
										text="Loading preview..."
										textColor="#94a3b8"
									/>
								</div>
							) : null}
							{textState.error ? (
								<div class="rounded-xl shadow-borderless dark:shadow-borderlessDark bg-red-500/10 p-4 text-sm text-red-200">
									{textState.error}
								</div>
							) : null}
							{highlightState.loading ? (
								<div class="text-sm text-slate-300">
									<Atom color="#337ab0" size="small" text="Highlighting..." textColor="#94a3b8" />
								</div>
							) : null}
							{highlightState.error ? (
								<div class="rounded-xl shadow-borderless dark:shadow-borderlessDark bg-yellow-500/10 p-4 text-sm text-yellow-100">
									{highlightState.error}
								</div>
							) : null}
							{textState.loading || textState.error || highlightState.loading ? null : (
								<pre
									data-lenis-prevent={true}
									class={`language-${highlightState.language || prismLanguageForExt(fileExt) || "markup"}overflow-auto rounded-xl shadow-borderless dark:shadow-borderlessDark bg-black/40 p-4 text-[12px] leading-relaxed text-slate-100`}
								>
									<code
										dangerouslySetInnerHTML={{
											__html: sanitizeHtml(
												highlightState.html || escapeHtml(textState.content || ""),
											),
										}}
									/>
								</pre>
							)}
						</div>
					) : null}

					{kind === "markdown" ? (
						<div class="space-y-3">
							{textState.loading ? (
								<div class="text-sm text-slate-300">
									<Atom
										color="#337ab0"
										size="small"
										text="Loading preview..."
										textColor="#94a3b8"
									/>
								</div>
							) : null}
							{textState.error ? (
								<div class="rounded-xl shadow-borderless dark:shadow-borderlessDark bg-red-500/10 p-4 text-sm text-red-200">
									{textState.error}
								</div>
							) : null}
							{textState.loading || textState.error ? null : (
								<div class="rounded-xl shadow-borderless dark:shadow-borderlessDark bg-white/5 p-4">
									<MarkdownMessage text={textState.content} />
								</div>
							)}
						</div>
					) : null}

					{kind === "text" ? (
						<div class="space-y-3">
							{textState.loading ? (
								<div class="text-sm text-slate-300">
									<Atom
										color="#337ab0"
										size="small"
										text="Loading preview..."
										textColor="#94a3b8"
									/>
								</div>
							) : null}
							{textState.error ? (
								<div class="rounded-xl shadow-borderless dark:shadow-borderlessDark bg-red-500/10 p-4 text-sm text-red-200">
									{textState.error}
								</div>
							) : null}
							{textState.loading || textState.error ? null : (
								<pre class="whitespace-pre-wrap break-words rounded-xl shadow-borderless dark:shadow-borderlessDark bg-black/40 p-4 text-[12px] leading-relaxed text-slate-100">
									{textState.content}
								</pre>
							)}
						</div>
					) : null}

					{kind === "file" ? (
						<div class="flex flex-col items-center justify-center gap-3 rounded-2xl shadow-borderless dark:shadow-borderlessDark bg-white/5 p-10 text-center">
							<div class="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-white">
								<File size={26} />
							</div>
							<div class="max-w-lg text-sm text-slate-200">
								Preview isn't available for this file type. You can still download it.
							</div>
						</div>
					) : null}
				</div>
			</div>
		</div>
	);
}

export default memo(AttachmentPreviewModal);
