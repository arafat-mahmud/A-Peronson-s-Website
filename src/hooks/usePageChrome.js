import { useCallback, useEffect, useState } from "react";
import useLocalStorageState from "./useLocalStorageState.js";

/**
 * Per-dashboard global-chrome collapse state.
 * Manual toggle persists to localStorage and always wins over scroll autohide.
 * @param {"owner"|"agent"|"admin"|"governance"} pageKey - namespace for storage keys + body classes.
 */
export default function usePageChrome(pageKey) {
	const [navCollapsed, setNavCollapsed] = useLocalStorageState(`chrome:${pageKey}:nav`, false);
	const [footerCollapsed, setFooterCollapsed] = useLocalStorageState(
		`chrome:${pageKey}:footer`,
		false,
	);
	const [autoHiddenNav, setAutoHiddenNav] = useState(false);
	const [autoHiddenFooter, setAutoHiddenFooter] = useState(false);

	const toggleNav = useCallback(() => setNavCollapsed((v) => !v), [setNavCollapsed]);
	const toggleFooter = useCallback(() => setFooterCollapsed((v) => !v), [setFooterCollapsed]);

	useEffect(() => {
		let lastY = window.scrollY;
		let ticking = false;
		const onScroll = () => {
			if (ticking) return;
			ticking = true;
			window.requestAnimationFrame(() => {
				const y = window.scrollY;
				const down = y > lastY && y > 200;
				const up = y < lastY;
				if (down) {
					setAutoHiddenNav(true);
					setAutoHiddenFooter(true);
				} else if (up) {
					setAutoHiddenNav(false);
					setAutoHiddenFooter(false);
				}
				lastY = y;
				ticking = false;
			});
		};
		window.addEventListener("scroll", onScroll, { passive: true });
		return () => window.removeEventListener("scroll", onScroll);
	}, []);

	const navHidden = navCollapsed || autoHiddenNav;
	const footerHidden = footerCollapsed || autoHiddenFooter;

	useEffect(() => {
		document.body.classList.toggle("chrome-nav-hidden", navHidden);
		document.body.classList.toggle("chrome-footer-hidden", footerHidden);
		return () => {
			document.body.classList.remove("chrome-nav-hidden");
			document.body.classList.remove("chrome-footer-hidden");
		};
	}, [navHidden, footerHidden]);

	return {
		navCollapsed,
		footerCollapsed,
		toggleNav,
		toggleFooter,
		autoHiddenNav,
		autoHiddenFooter,
	};
}
