import { useEffect, useRef, useState } from "react";

export default function HorizontalScrollGallery({ children, className = "", snap = true }) {
	const containerRef = useRef(null);
	const [isHorizontal, setIsHorizontal] = useState(false);

	useEffect(() => {
		const check = () => {
			if (!containerRef.current) {
				return;
			}
			const container = containerRef.current;
			const hasOverflow = container.scrollWidth > container.clientWidth;
			setIsHorizontal(hasOverflow);
		};
		check();
		window.addEventListener("resize", check);
		return () => window.removeEventListener("resize", check);
	}, []);

	return (
		<div
			ref={containerRef}
			className={
				"flex gap-4 overflow-x-auto scrollbar-hide " +
				(snap ? "snap-x snap-mandatory " : "") +
				className
			}
			style={{
				scrollbarWidth: "none",
				msOverflowStyle: "none",
				WebkitOverflowScrolling: "touch",
				cursor: isHorizontal ? "grab" : "default",
			}}
		>
			{children}
		</div>
	);
}
