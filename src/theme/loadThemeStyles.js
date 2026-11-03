// The default "blue" theme ships in the main stylesheet. The other eleven
// personalities (~860 KB of CSS together) used to be imported there too, so
// every visitor downloaded them before the first paint. Each one is now its
// own stylesheet, fetched the first time that theme is applied. Their rules
// are all scoped to [data-theme="<name>"], so setting the attribute before the
// file arrives simply shows the default palette for that moment.
const LOADERS = {
	aurora: () => import("./themes/aurora.css"),
	violet: () => import("./themes/violet.css"),
	sapphire: () => import("./themes/sapphire.css"),
	arctic: () => import("./themes/arctic.css"),
	emerald: () => import("./themes/emerald.css"),
	blurple: () => import("./themes/blurple.css"),
	mono: () => import("./themes/mono.css"),
	plasma: () => import("./themes/plasma.css"),
	solaris: () => import("./themes/solaris.css"),
	forest: () => import("./themes/forest.css"),
	crimson: () => import("./themes/crimson.css"),
};

const requested = new Set();

export function ensureThemeStyles(name) {
	const load = LOADERS[name];
	if (!load || requested.has(name)) {
		return Promise.resolve();
	}
	requested.add(name);
	return load().catch(() => {
		// Offline or a deploy changed the file name: allow a later retry.
		requested.delete(name);
	});
}
