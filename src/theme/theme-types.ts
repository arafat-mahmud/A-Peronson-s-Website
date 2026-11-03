/** Canonical Blue Theme types. Single source of truth: blueTheme.css. */

export type ThemeName = "blue";

export type ThemeMode = "light" | "dark" | "system";

export type ResolvedMode = Exclude<ThemeMode, "system">;

export interface ModeValues {
	light: string;
	dark: string;
}

export type AccentName = "sky" | "cyan" | "blue" | "emerald" | "amber";

export interface AccentClasses {
	border: string;
	bg: string;
	text: string;
}

export interface ChatTheme {
	pageBg: string;
	panelBg: string;
	rightPanelBg: string;
	subPanelBg: string;
	tileBg: string;
	threadIdleBg: string;
	threadActiveBg: string;
	textPrimary: string;
	textMuted: string;
	inputBg: string;
	shadow: string;
	accent: string;
}
