import { motion, useScroll, useSpring, useTransform } from "framer-motion";
import { useRef } from "react";

export default function StickySection({
	children,
	className = "",
	top = 100,
	as = "div",
	parallaxSpeed = 0,
	...rest
}) {
	const Tag = as;
	const ref = useRef(null);
	const { scrollYProgress } = useScroll({
		target: ref,
		offset: ["start end", "end start"],
	});
	const parallaxY = useSpring(
		useTransform(scrollYProgress, [0, 1], [parallaxSpeed, -parallaxSpeed]),
		{ stiffness: 100, damping: 30, restDelta: 0.001 },
	);

	return (
		<Tag ref={ref} className={`sticky z-10 ${className}`} style={{ top: `${top}px` }} {...rest}>
			{parallaxSpeed === 0 ? (
				children
			) : (
				<motion.div style={{ y: parallaxY }}>{children}</motion.div>
			)}
		</Tag>
	);
}
