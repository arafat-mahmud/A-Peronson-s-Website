import { createContext, useContext, useEffect, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
	applyThemeToDOM,
	setTheme,
	setThemeName,
	syncThemeFromStorage,
	toggleTheme,
} from "../store/themeSlice.js";
import { ensureThemeStyles } from "../theme/loadThemeStyles.js";

function resolveTheme(mode) {
	if (mode === "system") {
		return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
	}
	return mode === "dark" ? "dark" : "light";
}

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
	const theme = useSelector((s) => s.theme.theme);
	const themeName = useSelector((s) => s.theme.themeName);
	const dispatch = useDispatch();
	const resolved = useMemo(() => resolveTheme(theme), [theme]);

	useEffect(() => {
		// Theme personality scope; modes switch values centrally per theme.
		document.documentElement.setAttribute("data-theme", themeName || "blue");
		ensureThemeStyles(themeName || "blue");
	}, [themeName]);

	useEffect(() => {
		dispatch(syncThemeFromStorage());
	}, [dispatch]);

	useEffect(() => {
		function handleStorage(e) {
			if (e.key === "theme" || e.key === "themeName") {
				dispatch(syncThemeFromStorage());
			}
		}
		window.addEventListener("storage", handleStorage);
		return () => window.removeEventListener("storage", handleStorage);
	}, [dispatch]);

	useEffect(() => {
		const mq = window.matchMedia("(prefers-color-scheme: dark)");
		const handler = () => {
			if (theme === "system") {
				applyThemeToDOM("system");
			}
		};
		mq.addEventListener("change", handler);
		return () => mq.removeEventListener("change", handler);
	}, [theme]);

	return (
		<ThemeContext.Provider
			value={{
				theme: resolved,
				themeMode: theme,
				themeName: themeName || "blue",
				resolvedTheme: resolved,
				setTheme: (t) => dispatch(setTheme(t)),
				/** Canonical runtime API: setThemeName("<slug>") — see registry.js. */
				setThemeName: (name) => dispatch(setThemeName(name)),
				toggleTheme: () => dispatch(toggleTheme()),
			}}
		>
			{children}
		</ThemeContext.Provider>
	);
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme() {
	const ctx = useContext(ThemeContext);
	if (!ctx) {
		throw new Error("useTheme must be used within ThemeProvider");
	}
	return ctx;
}
