import { useEffect, useState } from "react";

/**
 * Hook to detect scroll direction.
 * @param {number} [threshold=10] - The scroll threshold.
 * @returns {string|null} Scroll direction ('up', 'down', or null).
 */
export default function useScrollDirection(threshold = 10) {
	const [direction, setDirection] = useState(null);

	useEffect(() => {
		let lastScrollY = window.scrollY;
		let ticking = false;

		const update = () => {
			const currentScrollY = window.scrollY;
			const delta = currentScrollY - lastScrollY;

			if (Math.abs(delta) >= threshold) {
				setDirection(delta > 0 ? "down" : "up");
				lastScrollY = currentScrollY;
			}
			ticking = false;
		};

		const onScroll = () => {
			if (!ticking) {
				window.requestAnimationFrame(update);
				ticking = true;
			}
		};

		window.addEventListener("scroll", onScroll, { passive: true });
		return () => window.removeEventListener("scroll", onScroll);
	}, [threshold]);

	return direction;
}
