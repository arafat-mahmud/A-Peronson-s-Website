import { motion, useReducedMotion } from "framer-motion";

export default function MasonryGrid({
	children,
	className = "",
	columnCount = 3,
	gap = 4,
	staggerDelay = 0.05,
}) {
	const reduceMotion = useReducedMotion();
	const items = Array.isArray(children) ? children : [children];

	if (reduceMotion) {
		return (
			<div
				className={className}
				style={{
					columns: columnCount,
					columnGap: `${gap * 0.25}rem`,
				}}
			>
				{items.map((child, i) => (
					<div key={i} style={{ breakInside: "avoid", marginBottom: `${gap * 0.25}rem` }}>
						{child}
					</div>
				))}
			</div>
		);
	}

	return (
		<div
			className={className}
			style={{
				columns: columnCount,
				columnGap: `${gap * 0.25}rem`,
			}}
		>
			{items.map((child, i) => (
				<motion.div
					key={i}
					initial={{ opacity: 0, y: 20 }}
					whileInView={{ opacity: 1, y: 0 }}
					viewport={{ once: true, margin: "-40px" }}
					transition={{
						delay: i * staggerDelay,
						duration: 0.5,
						ease: [0.16, 1, 0.3, 1],
					}}
					style={{ breakInside: "avoid", marginBottom: `${gap * 0.25}rem` }}
				>
					{child}
				</motion.div>
			))}
		</div>
	);
}
