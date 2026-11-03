/** Theme utilities: accent maps + strict Tailwind color parser (tested in themeTokens.test.js). */
import type { AccentClasses, AccentName } from "./theme-types.js";

/** Static accent class sets. Every string below appears literally so Tailwind generates it. */
export const ACCENT_THEMES: Record<AccentName, AccentClasses> = {
	sky: {
		border: "border-[var(--theme-sky-400-20)]",
		bg: "bg-[var(--theme-sky-400-10)]",
		text: "text-[var(--theme-sky-400)]",
	},
	cyan: {
		border: "border-[var(--theme-cyan-400-20)]",
		bg: "bg-[var(--theme-cyan-400-10)]",
		text: "text-[var(--theme-cyan-400)]",
	},
	blue: {
		border: "border-[var(--theme-blue-400-20)]",
		bg: "bg-[var(--theme-blue-400-10)]",
		text: "text-[var(--theme-blue-400)]",
	},
	emerald: {
		border: "border-[var(--theme-emerald-400-20)]",
		bg: "bg-[var(--theme-emerald-400-10)]",
		text: "text-[var(--theme-emerald-400)]",
	},
	amber: {
		border: "border-[var(--theme-amber-400-20)]",
		bg: "bg-[var(--theme-amber-400-10)]",
		text: "text-[var(--theme-amber-400)]",
	},
};

/** Resolve an accent name to static classes; unknown accents fall back to sky. */
export function accentClasses(accent: string | undefined | null): AccentClasses {
	if (accent && accent in ACCENT_THEMES) return ACCENT_THEMES[accent as AccentName];
	return ACCENT_THEMES.sky;
}
