import { motion, useReducedMotion, useSpring } from "framer-motion";
import { useEffect, useState } from "react";

export default function ScrollToTop({ className = "" }) {
	const [visible, setVisible] = useState(false);
	const reduceMotion = useReducedMotion();
	const spring = useSpring(0, {
		stiffness: 100,
		damping: 20,
		restDelta: 0.001,
	});

	useEffect(() => {
		function check() {
			setVisible(window.scrollY > 800);
		}
		window.addEventListener("scroll", check, { passive: true });
		check();
		return () => window.removeEventListener("scroll", check);
	}, []);

	function scrollUp() {
		if (reduceMotion) {
			window.scrollTo({ top: 0, behavior: "auto" });
			return;
		}
		const start = window.scrollY;
		const duration = Math.min(start * 0.4, 800);
		const startTime = performance.now();

		function step(now) {
			const elapsed = now - startTime;
			const t = Math.min(elapsed / duration, 1);
			const ease = 1 - (1 - t) ** 3;
			window.scrollTo(0, start * (1 - ease));
			if (t < 1) {
				requestAnimationFrame(step);
			}
		}
		requestAnimationFrame(step);
	}

	if (!visible) {
		return null;
	}

	return (
		<motion.button
			onClick={scrollUp}
			className={`fixed bottom-24 right-6 z-40 flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-lg shadow-sky-500/30 transition-colors hover:from-sky-400 hover:to-blue-500 ${className}`}
			initial={{ opacity: 0, scale: 0.5 }}
			animate={{ opacity: 1, scale: 1 }}
			exit={{ opacity: 0, scale: 0.5 }}
			whileHover={{ scale: 1.1 }}
			whileTap={{ scale: 0.9 }}
			aria-label="Scroll to top"
		>
			<svg
				width="18"
				height="18"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="2.5"
				strokeLinecap="round"
				strokeLinejoin="round"
			>
				<path d="M12 19V5M5 12l7-7 7 7" />
			</svg>
		</motion.button>
	);
}
