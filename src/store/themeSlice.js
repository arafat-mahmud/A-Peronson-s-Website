import { createSlice } from "@reduxjs/toolkit";
import { ensureThemeStyles } from "../theme/loadThemeStyles.js";
import { DEFAULT_THEME, VALID_THEMES } from "../theme/themes/registry.js";

function resolveTheme(mode) {
	if (mode === "system") {
		return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
	}
	return mode === "dark" ? "dark" : "light";
}

function getInitialTheme() {
	const stored = localStorage.getItem("theme");
	if (stored === "dark" || stored === "light" || stored === "system") {
		return stored;
	}
	return "system";
}

function getInitialThemeName() {
	const stored = localStorage.getItem("themeName");
	if (stored && VALID_THEMES.has(stored)) {
		return stored;
	}
	return DEFAULT_THEME;
}

function applyThemeToDOM(mode, name) {
	const resolved = resolveTheme(mode);
	const themeName = name && VALID_THEMES.has(name) ? name : getInitialThemeName();
	const root = document.documentElement;
	// Canonical theme scope (section 11: runtime dynamic theming).
	root.setAttribute("data-theme", themeName);
	ensureThemeStyles(themeName);
	root.setAttribute("data-mode", resolved);
	if (resolved === "dark") {
		root.classList.add("dark");
	} else {
		root.classList.remove("dark");
	}
	window.dispatchEvent(new Event("theme-change"));
	let meta = document.querySelector('meta[name="theme-color"]');
	if (!meta) {
		meta = document.createElement("meta");
		meta.setAttribute("name", "theme-color");
		document.head.appendChild(meta);
	}
	meta.setAttribute("content", resolved === "dark" ? "#0f172a" : "#f8fafc");
}

const initialState = {
	theme: getInitialTheme(),
	themeName: getInitialThemeName(),
};

const themeSlice = createSlice({
	name: "theme",
	initialState,
	reducers: {
		setTheme(state, action) {
			const next = action.payload;
			if (next !== "dark" && next !== "light" && next !== "system") {
				return;
			}
			state.theme = next;
			localStorage.setItem("theme", next);
			applyThemeToDOM(next, state.themeName);
		},
		toggleTheme(state) {
			const next = state.theme === "dark" ? "light" : "dark";
			state.theme = next;
			localStorage.setItem("theme", next);
			applyThemeToDOM(next, state.themeName);
		},
		syncThemeFromStorage(state) {
			const stored = localStorage.getItem("theme");
			if (stored === "dark" || stored === "light" || stored === "system") {
				state.theme = stored;
				applyThemeToDOM(stored, state.themeName);
			}
			const storedName = localStorage.getItem("themeName");
			if (storedName && VALID_THEMES.has(storedName)) {
				state.themeName = storedName;
				applyThemeToDOM(state.theme, storedName);
			}
		},
		setThemeName(state, action) {
			const next = action.payload;
			if (!(next && VALID_THEMES.has(next))) {
				return;
			}
			state.themeName = next;
			localStorage.setItem("themeName", next);
			applyThemeToDOM(state.theme, next);
		},
	},
});

export const { setTheme, toggleTheme, syncThemeFromStorage, setThemeName } = themeSlice.actions;
export { applyThemeToDOM };

/**
 * Canonical runtime API (THEME.md): setThemeName("<slug>").
 * Valid slugs: see src/theme/themes/registry.js (blue + 11 personalities).
 */
export function setThemeNameBySlug(name) {
	if (!(name && VALID_THEMES.has(name))) {
		return;
	}
	if (typeof document !== "undefined") {
		document.documentElement.setAttribute("data-theme", name);
		ensureThemeStyles(name);
	}
}

/** Back-compat alias (pre-multi-theme API kept working). */
export function setThemeNameLegacy(name) {
	setThemeNameBySlug(name || "blue");
}

/** Back-compat alias so setTheme("blue") keeps the canonical theme. */
export function setCanonicalTheme(nameOrMode) {
	if (nameOrMode && VALID_THEMES.has(nameOrMode)) {
		setThemeNameBySlug(nameOrMode);
	}
}
export default themeSlice.reducer;
