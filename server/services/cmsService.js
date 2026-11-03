import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { readLocalJson, updateLocalJson } from "../utils/localStore.js";
import { logError } from "../utils/logger.js";

const STATE_FILE = "cms_state.json";
const DEFAULT_STATE = {
	articles: [],
	pages: [],
	media: [],
	versions: [],
	theme: {
		active: "",
		options: [],
	},
	seo: {
		default_title: "",
		meta_description: "",
		social_image: "",
	},
	cache: {
		last_cleared_at: "",
	},
	env: {
		vars: {},
	},
	deployments: [],
	backups: [],
	cron_scripts: [],
};

const CONTENT_DIR = path.join(process.cwd(), "server", "content");
const MEDIA_DIR = path.join(process.cwd(), "server", "uploads");

function entryIdFromTitle(title = "") {
	return (
		String(title || "content")
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "")
			.slice(0, 40) || "content"
	);
}

async function listContentFiles() {
	try {
		const entries = await fs.readdir(CONTENT_DIR, { withFileTypes: true });
		return entries.filter(
			(e) => e.isFile() && [".md", ".html"].includes(path.extname(e.name).toLowerCase()),
		);
	} catch {
		return [];
	}
}

async function readContentFile(fileName) {
	try {
		const filePath = path.join(CONTENT_DIR, fileName);
		const content = await fs.readFile(filePath, "utf8");
		return content;
	} catch {
		return "";
	}
}

async function listMediaFiles() {
	try {
		const entries = await fs.readdir(MEDIA_DIR, { withFileTypes: true });
		return entries.filter((e) => e.isFile()).slice(0, 50);
	} catch {
		return [];
	}
}

export async function getCmsState() {
	const current = await readLocalJson(STATE_FILE, DEFAULT_STATE);
	const files = await listContentFiles();
	const articles = [];
	const pages = [];
	for (const file of files) {
		const ext = path.extname(file.name).toLowerCase();
		const raw = await readContentFile(file.name);
		const item = {
			id: file.name,
			title: file.name.replace(ext, ""),
			status: "published",
			updated_at: current.articles?.find((a) => a.id === file.name)?.updated_at || "",
			content_length: raw.length,
		};
		if (file.name.toLowerCase().startsWith("page-")) {
			pages.push(item);
		} else {
			articles.push(item);
		}
	}
	const mediaFiles = await listMediaFiles();
	const media = mediaFiles.map((file) => ({
		id: file.name,
		name: file.name,
		type: path.extname(file.name).replace(".", ""),
		url: `/uploads/${file.name}`,
		uploaded_at: file.mtime ? new Date(file.mtime).toISOString() : "",
	}));
	return {
		...DEFAULT_STATE,
		...current,
		articles: articles.length > 0 ? articles : current.articles || [],
		pages: pages.length > 0 ? pages : current.pages || [],
		media: media.length > 0 ? media : current.media || [],
		theme: { ...DEFAULT_STATE.theme, ...(current.theme || {}) },
		seo: { ...DEFAULT_STATE.seo, ...(current.seo || {}) },
		cache: { ...DEFAULT_STATE.cache, ...(current.cache || {}) },
		env: { ...DEFAULT_STATE.env, ...(current.env || {}) },
	};
}

async function updateState(updater) {
	return updateLocalJson(STATE_FILE, updater, DEFAULT_STATE);
}

export async function performCmsAction(action = "", payload = {}) {
	const actionId = crypto.randomUUID();
	const now = new Date().toISOString();
	let updated = null;

	if (action === "cms.article.create") {
		updated = await updateState((state) => {
			const entry = {
				id: actionId,
				title: payload.title || "Untitled",
				status: payload.status || "draft",
				author: payload.author || "admin",
				updated_at: now,
			};
			state.articles = [...(state.articles || []), entry];
			return state;
		});
		if (payload?.content) {
			await fs
				.mkdir(CONTENT_DIR, { recursive: true })
				.catch((err) => logError("cmsService: mkdir failed", err));
			await fs
				.writeFile(
					path.join(CONTENT_DIR, `${entryIdFromTitle(payload.title || "article")}-${actionId}.md`),
					String(payload.content),
					"utf8",
				)
				.catch((err) => logError("cmsService: writeFile failed", err));
		}
	} else if (action === "cms.page.create") {
		updated = await updateState((state) => {
			const entry = {
				id: actionId,
				title: payload.title || "New Page",
				slug: payload.slug || `page-${actionId.slice(0, 4)}`,
				status: payload.status || "draft",
				updated_at: now,
			};
			state.pages = [...(state.pages || []), entry];
			return state;
		});
		if (payload?.content) {
			await fs
				.mkdir(CONTENT_DIR, { recursive: true })
				.catch((err) => logError("cmsService: mkdir failed", err));
			await fs
				.writeFile(
					path.join(CONTENT_DIR, `page-${payload.slug || actionId}.md`),
					String(payload.content),
					"utf8",
				)
				.catch((err) => logError("cmsService: writeFile failed", err));
		}
	} else if (action === "cms.media.upload") {
		updated = await updateState((state) => {
			const entry = {
				id: actionId,
				name: payload.name || "media",
				type: payload.type || "image",
				url: payload.url || "",
				uploaded_at: now,
			};
			state.media = [...(state.media || []), entry];
			return state;
		});
	} else if (action === "cms.version.rollback") {
		updated = await updateState((state) => {
			state.versions = [
				{
					id: actionId,
					content_id: payload.content_id || "",
					version: payload.version || "latest",
					created_at: now,
					note: "rollback",
				},
				...(state.versions || []),
			];
			return state;
		});
	} else if (action === "cms.theme.switch") {
		updated = await updateState((state) => {
			state.theme = {
				...state.theme,
				active: payload.theme || state.theme.active,
			};
			return state;
		});
	} else if (action === "cms.seo.update") {
		updated = await updateState((state) => {
			state.seo = {
				...state.seo,
				default_title: payload.default_title ?? state.seo.default_title,
				meta_description: payload.meta_description ?? state.seo.meta_description,
				social_image: payload.social_image ?? state.seo.social_image,
			};
			return state;
		});
	} else if (action === "cms.cache.clear") {
		updated = await updateState((state) => {
			state.cache = { ...state.cache, last_cleared_at: now };
			return state;
		});
	} else if (action === "cms.env.update") {
		let vars = payload.vars;
		if (typeof vars === "string") {
			try {
				vars = JSON.parse(vars);
			} catch {
				vars = {};
			}
		}
		updated = await updateState((state) => {
			state.env = {
				...state.env,
				vars: { ...(state.env?.vars || {}), ...(vars || {}) },
			};
			return state;
		});
	} else if (action === "cms.deploy.run") {
		updated = await updateState((state) => {
			const entry = {
				id: actionId,
				status: "running",
				branch: payload.branch || "main",
				started_at: now,
			};
			state.deployments = [entry, ...(state.deployments || [])].slice(0, 20);
			return state;
		});
	} else if (action === "cms.backup.run") {
		updated = await updateState((state) => {
			const entry = {
				id: actionId,
				status: "completed",
				provider: payload.provider || "local",
				created_at: now,
			};
			state.backups = [entry, ...(state.backups || [])].slice(0, 20);
			return state;
		});
	} else if (action === "cms.cron.add") {
		updated = await updateState((state) => {
			const entry = {
				id: actionId,
				schedule: payload.schedule || "0 2 * * *",
				command: payload.command || "backup",
				status: "active",
			};
			state.cron_scripts = [...(state.cron_scripts || []), entry];
			return state;
		});
	} else if (action === "cms.cron.remove") {
		updated = await updateState((state) => {
			state.cron_scripts = (state.cron_scripts || []).filter(
				(script) => String(script.id) !== String(payload.id),
			);
			return state;
		});
	}

	if (!updated) {
		return { ok: false, error: "Unsupported action" };
	}
	return { ok: true, state: updated };
}
