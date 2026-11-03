import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

const VENDOR_CHUNKS = {
	react: "vendor-react",
	"react-dom": "vendor-react",
	scheduler: "vendor-react",
	// Tiny helpers shared by app code and recharts. Left alone, Rollup puts
	// them in vendor-charts and every page would download the charts.
	"prop-types": "vendor-react",
	"react-is": "vendor-react",
	"object-assign": "vendor-react",
	clsx: "vendor-react",
	"@babel/runtime": "vendor-react",
	"tiny-invariant": "vendor-react",
	"react-router": "vendor-router",
	"react-router-dom": "vendor-router",
	"framer-motion": "vendor-motion",
	"motion-dom": "vendor-motion",
	"motion-utils": "vendor-motion",
	"@reduxjs/toolkit": "vendor-redux",
	"react-redux": "vendor-redux",
	redux: "vendor-redux",
	immer: "vendor-redux",
	reselect: "vendor-redux",
	"lucide-react": "vendor-icons",
	dompurify: "vendor-security",
	recharts: "vendor-charts",
};

// "/x/node_modules/.pnpm/a@1/node_modules/@scope/pkg/index.js" -> "@scope/pkg"
function packageName(id) {
	const marker = "node_modules/";
	const at = id.lastIndexOf(marker);
	if (at === -1) {
		return "";
	}
	const parts = id.slice(at + marker.length).split("/");
	return parts[0].startsWith("@") ? `${parts[0]}/${parts[1]}` : parts[0];
}

// https://vite.dev/config/
export default defineConfig({
	base: process.env.VITE_BASE_URL || "./",
	logLevel: "info",
	clearScreen: false,
	envDir: process.cwd(),
	css: {
		cssCodeSplit: true,
	},
	build: {
		chunkSizeWarningLimit: 1000,
		rollupOptions: {
			external: ["rtf.js"],
			output: {
				// Group by exact package name. The old `id.includes("node_modules/react")`
				// test also matched react-markdown, react-syntax-highlighter (+ its
				// ~1 MB of grammars), react-router and every other "react-*" package,
				// so all of them shipped in the vendor chunk every page loads first.
				manualChunks(id) {
					const pkg = packageName(id);
					if (!pkg) {
						return undefined;
					}
					return VENDOR_CHUNKS[pkg];
				},
			},
		},
		reportCompressedSize: false,
		sourcemap: "hidden",
	},
	plugins: [
		tailwindcss(),
		react(),
		VitePWA({
			strategies: "injectManifest",
			srcDir: "src",
			filename: "sw.js",
			registerType: "autoUpdate",
			injectRegister: false,
			manifest: false,
			devOptions: { enabled: false },
			injectManifest: {
				// Shell-only precache. Precaching every lazy route chunk made
				// first visits download the whole app (~150 files) and starved
				// the critical path. Page/component chunks load on demand and
				// are runtime-cached by src/sw.js (CacheFirst, capped).
				globPatterns: [
					"index.html",
					"assets/index-*.{js,css}",
					"fonts/*.woff2",
					"manifest.json",
					"favicon.*",
					"android-chrome-*.png",
					"apple-touch-icon.png",
					"screenshot-*.png",
					"og-image.png",
				],
				globIgnores: ["**/*.map"],
			},
		}),
	],
	server: {
		allowedHosts: process.env.VITE_ALLOWED_HOSTS
			? process.env.VITE_ALLOWED_HOSTS.split(",").map((s) => s.trim())
			: ["localhost"],
		proxy: {
			"/api": {
				target: process.env.VITE_API_PROXY || "http://localhost:4000",
				changeOrigin: true,
			},
			"/uploads": {
				target: process.env.VITE_API_PROXY || "http://localhost:4000",
				changeOrigin: true,
			},
			"/ws": {
				target: process.env.VITE_API_PROXY || "http://localhost:4000",
				changeOrigin: true,
				ws: true,
			},
		},
		watch: {
			ignored: ["**/server/database/**", "**/server/uploads/**"],
		},
	},
});
