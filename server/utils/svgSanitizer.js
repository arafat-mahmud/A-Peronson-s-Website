/**
 * Minimal SVG sanitizer that strips dangerous elements/attributes.
 * Does not attempt to parse XML — uses regex for speed and safety.
 */

import fs from "node:fs/promises";

const DANGEROUS_TAGS =
	/<(script|foreignObject|iframe|object|embed|form|input|textarea|select|button|link|meta|base|applet|style)(\s|>|\/)/gi;
const DANGEROUS_TAGS_CLOSE =
	/<\/(script|foreignObject|iframe|object|embed|form|input|textarea|select|button|link|meta|base|applet|style)\s*>/gi;
const EVENT_HANDLERS = /\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;
const DATA_ATTRS = /\s+data-\w[\w.-]*\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;
const JS_URLS = /(href|src|action)\s*=\s*(?:"[^"]*javascript:[^"]*"|'[^']*javascript:[^']*')/gi;
const XML_DECL = /<\?xml[^>]*\?>/gi;
const DOCTYPE = /<!DOCTYPE[^>]*>/gi;

function isSvgContent(content) {
	return /[\s\S]*<svg[\s>]/i.test(content);
}

export function sanitizeSvgBuffer(buffer) {
	let content = buffer.toString("utf8");

	if (!isSvgContent(content)) {
		return { sanitized: false, content: buffer };
	}

	content = content.replace(XML_DECL, "").replace(DOCTYPE, "");
	content = content.replace(DANGEROUS_TAGS, "<$1_BLOCKED ");
	content = content.replace(DANGEROUS_TAGS_CLOSE, "");
	content = content.replace(EVENT_HANDLERS, "");
	content = content.replace(DATA_ATTRS, "");
	content = content.replace(JS_URLS, '$1="about:blank"');

	const sanitized = Buffer.from(content, "utf8");
	return { sanitized: !sanitized.equals(buffer), content: sanitized };
}

export async function sanitizeSvgFile(filePath) {
	if (!filePath || !String(filePath).toLowerCase().endsWith(".svg")) {
		return false;
	}
	const buffer = await fs.readFile(filePath);
	let content = buffer.toString("utf8");

	if (!isSvgContent(content)) {
		return false;
	}

	content = content.replace(XML_DECL, "").replace(DOCTYPE, "");
	content = content.replace(DANGEROUS_TAGS, "<$1_BLOCKED ");
	content = content.replace(DANGEROUS_TAGS_CLOSE, "");
	content = content.replace(EVENT_HANDLERS, "");
	content = content.replace(DATA_ATTRS, "");
	content = content.replace(JS_URLS, '$1="about:blank"');

	const sanitized = Buffer.from(content, "utf8");
	if (!sanitized.equals(buffer)) {
		await fs.writeFile(filePath, sanitized);
		return true;
	}
	return false;
}
