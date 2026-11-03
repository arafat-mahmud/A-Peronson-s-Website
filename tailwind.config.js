/** @type {import('tailwindcss').Config} */
export default {
	darkMode: "class",
	content: ["./index.html", "./src/**/*.{js,jsx}"],
	theme: {
		extend: {
			screens: {
				print: { raw: "print" },
			},
			colors: {
				gtBlue: "#0a66c2",
				gtBlueHover: "#004182",
			},
			boxShadow: {
				borderless: "0 1px 2px rgba(15, 23, 42, 0.06), 0 12px 28px rgba(15, 23, 42, 0.10)",
				borderlessDark: "0 10px 26px rgba(0, 0, 0, 0.45), 0 22px 50px rgba(0, 0, 0, 0.55)",
				dividerB: "inset 0 -1px 0 rgba(15, 23, 42, 0.12)",
				dividerBDark: "inset 0 -1px 0 rgba(255, 255, 255, 0.08)",
				dividerT: "inset 0 1px 0 rgba(15, 23, 42, 0.12)",
				dividerTDark: "inset 0 1px 0 rgba(255, 255, 255, 0.08)",
				dividerL: "inset 1px 0 0 rgba(15, 23, 42, 0.12)",
				dividerLDark: "inset 1px 0 0 rgba(255, 255, 255, 0.08)",
				dividerR: "inset -1px 0 0 rgba(15, 23, 42, 0.12)",
				dividerRDark: "inset -1px 0 0 rgba(255, 255, 255, 0.08)",
			},
			keyframes: {
				skeletonShimmer: {
					"0%": { transform: "translateX(-140%)" },
					"100%": { transform: "translateX(140%)" },
				},
			},
			animation: {
				skeleton: "skeletonShimmer 1.4s linear infinite",
			},
			fontFamily: {
				sans: ["Inter", "system-ui", "sans-serif"],
			},
		},
	},
};
