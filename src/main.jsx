import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import "./tailwind.css";
import App from "./App.jsx";
import { logEnvStatus } from "./lib/envCheck.js";
import { ThemeProvider } from "./lib/ThemeProvider.jsx";
import { store } from "./store/index.js";

logEnvStatus();

function registerServiceWorker() {
	try {
		if (!("serviceWorker" in navigator)) return;
		// Prod-only: enabled for production builds, or explicitly via ?sw=1.
		// import.meta.env.PROD is statically replaced by Vite at build time.
		let allow = false;
		try {
			allow = Boolean(import.meta.env?.PROD);
		} catch {
			allow = false;
		}
		if (!allow) {
			try {
				allow = new URLSearchParams(window.location.search).has("sw");
			} catch {
				allow = false;
			}
		}
		if (!allow) return;

		const base = import.meta.env?.BASE_URL || "/";
		const swUrl = base.startsWith("http")
			? new URL("sw.js", base).toString()
			: `${window.location.origin}${base.startsWith("/") ? base : `/${base}`}${base.endsWith("/") ? "" : "/"}sw.js`;

		window.addEventListener("load", () => {
			navigator.serviceWorker
				.register(swUrl)
				.then((registration) => {
					const notifyWaiting = () => {
						window.dispatchEvent(new CustomEvent("sw:update-available", { detail: registration }));
					};
					if (registration.waiting) {
						notifyWaiting();
					} else {
						registration.addEventListener("updatefound", () => {
							const installing = registration.installing;
							if (!installing) return;
							installing.addEventListener("statechange", () => {
								if (installing.state === "installed" && navigator.serviceWorker.controller) {
									notifyWaiting();
								}
							});
						});
					}
				})
				.catch(() => {
					/* SW registration is best-effort — app works without it */
				});
		});
	} catch {
		/* never break boot on SW errors */
	}
}

registerServiceWorker();

createRoot(document.getElementById("root")).render(
	<StrictMode>
		<Provider store={store}>
			<ThemeProvider>
				<App />
			</ThemeProvider>
		</Provider>
	</StrictMode>,
);
