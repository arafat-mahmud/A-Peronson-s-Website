import { useCallback, useEffect, useMemo, useState } from "react";
import { useTheme } from "../lib/ThemeProvider.jsx";
import { createThemeHotkeyState, trackThemeHotkey } from "../lib/themeHotkey.js";
import { THEMES } from "../theme/themes/registry.js";

/** Cosmetic preview swatches only (primary -> highlight per theme). Theming itself comes from CSS vars. */
const SWATCHES = {
	blue: ["#0ea5e9", "#22d3ee"],
	aurora: ["#6366f1", "#22d3ee"],
	violet: ["#8b5cf6", "#6366f1"],
	sapphire: ["#2563eb", "#38bdf8"],
	arctic: ["#0891b2", "#67e8f9"],
	emerald: ["#10b981", "#6ee7b7"],
	blurple: ["#5865f2", "#22d3ee"],
	mono: ["#737373", "#60a5fa"],
	plasma: ["#ff2daa", "#22d3ee"],
	solaris: ["#f97316", "#ec4899"],
	forest: ["#16a34a", "#86efac"],
	crimson: ["#e11d48", "#a78bfa"],
};

const OPEN_EVENT = "open-theme-switcher";

export function openThemeSwitcher() {
	window.dispatchEvent(new Event(OPEN_EVENT));
}

export default function ThemeSwitcher() {
	const { themeName, setThemeName } = useTheme();
	const [open, setOpen] = useState(false);
	const hotkey = useMemo(() => createThemeHotkeyState(), []);

	const close = useCallback(() => setOpen(false), []);

	useEffect(() => {
		function onKey(e) {
			// NOTE: read fields explicitly — {...e} on a native event copies nothing.
			if (
				trackThemeHotkey(hotkey, {
					key: e.key,
					repeat: e.repeat,
					metaKey: e.metaKey,
					ctrlKey: e.ctrlKey,
					altKey: e.altKey,
					now: Date.now(),
				})
			) {
				setOpen(true);
			}
		}
		function onOpen() {
			setOpen(true);
		}
		function onEsc(e) {
			if (e.key === "Escape") setOpen(false);
		}
		window.addEventListener("keydown", onKey);
		window.addEventListener(OPEN_EVENT, onOpen);
		window.addEventListener("keydown", onEsc);
		return () => {
			window.removeEventListener("keydown", onKey);
			window.removeEventListener(OPEN_EVENT, onOpen);
			window.removeEventListener("keydown", onEsc);
		};
	}, [hotkey]);

	// Lock background scroll while the modal is open so wheel/touch gestures
	// over the backdrop can never move the page behind it.
	useEffect(() => {
		if (!open) return;
		const prev = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		return () => {
			document.body.style.overflow = prev;
		};
	}, [open]);

	if (!open) return null;

	return (
		<div
			class="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
			onClick={close}
			role="dialog"
			aria-modal="true"
			aria-label="Theme switcher"
		>
			<div
				class="w-full max-w-lg overflow-hidden rounded-3xl border border-white/10 bg-white shadow-2xl dark:bg-slate-950"
				onClick={(e) => e.stopPropagation()}
			>
				<div class="flex items-center justify-between border-b border-slate-200/70 px-5 py-4 dark:border-white/10">
					<div>
						<h2 class="text-base font-bold text-slate-900 dark:text-white">Themes</h2>
						<p class="text-xs text-slate-500 dark:text-slate-400">
							Type{" "}
							<kbd class="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] dark:bg-white/10">
								themes
							</kbd>{" "}
							anywhere within 3.6s to open this
						</p>
					</div>
					<button
						type="button"
						onClick={close}
						aria-label="Close theme switcher"
						class="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/10 dark:hover:text-slate-200"
					>
						✕
					</button>
				</div>
				<div
					data-lenis-prevent
					onWheel={(e) => e.stopPropagation()}
					onTouchMove={(e) => e.stopPropagation()}
					class="grid max-h-[60vh] grid-cols-1 gap-2 overflow-y-auto overscroll-contain p-4 sm:grid-cols-2"
				>
					{THEMES.map((t) => {
						const [c1, c2] = SWATCHES[t.slug] || ["#0ea5e9", "#22d3ee"];
						const active = themeName === t.slug;
						return (
							<button
								key={t.slug}
								type="button"
								onClick={() => {
									setThemeName(t.slug);
									close();
								}}
								class={`flex items-center gap-3 rounded-2xl border p-3 text-left transition hover:-translate-y-0.5 ${
									active
										? "border-sky-400 bg-sky-500/10 dark:border-sky-400/40"
										: "border-slate-200 hover:border-sky-300 dark:border-white/10 dark:hover:border-sky-400/30"
								}`}
							>
								<span
									aria-hidden="true"
									class="h-10 w-10 shrink-0 rounded-xl shadow-md"
									style={{ backgroundImage: `linear-gradient(135deg, ${c1}, ${c2})` }}
								/>
								<span class="min-w-0">
									<span class="block truncate text-sm font-semibold text-slate-900 dark:text-white">
										{t.label}
									</span>
									<span class="block text-xs text-slate-500 dark:text-slate-400">
										{active ? "✓ Active" : t.slug}
									</span>
								</span>
							</button>
						);
					})}
				</div>
			</div>
		</div>
	);
}
