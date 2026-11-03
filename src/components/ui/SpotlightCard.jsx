import { useRef } from "react";

export default function SpotlightCard({ className = "", children }) {
	const rafRef = useRef(null);

	function handleSpotlightMove(event) {
		if (rafRef.current) {
			return;
		}
		const el = event.currentTarget;
		const { clientX, clientY } = event;
		rafRef.current = requestAnimationFrame(() => {
			rafRef.current = null;
			const rect = el.getBoundingClientRect();
			el.style.setProperty("--spotlight-x", `${clientX - rect.left}px`);
			el.style.setProperty("--spotlight-y", `${clientY - rect.top}px`);
		});
	}

	return (
		<div
			className={[
				"relative overflow-hidden",
				"before:pointer-events-none before:absolute before:inset-0",
				"before:opacity-0 hover:before:opacity-100",
				"before:transition-opacity before:duration-200",
				"before:bg-[radial-gradient(600px_circle_at_var(--spotlight-x)_var(--spotlight-y),rgba(255,255,255,0.55),transparent_40%)]",
				"dark:before:bg-[radial-gradient(600px_circle_at_var(--spotlight-x)_var(--spotlight-y),rgba(10,102,194,0.16),transparent_45%)]",
				className,
			].join(" ")}
			onMouseMove={handleSpotlightMove}
		>
			{children}
		</div>
	);
}
