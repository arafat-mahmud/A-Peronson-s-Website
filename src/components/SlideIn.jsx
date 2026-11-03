import { motion, useReducedMotion } from "framer-motion";

const directionMap = {
	left: { x: -40, y: 0 },
	right: { x: 40, y: 0 },
	up: { x: 0, y: -40 },
	down: { x: 0, y: 40 },
};

export default function SlideIn({
	children,
	className = "",
	as = "div",
	direction = "up",
	delay = 0,
	duration = 0.5,
	distance = 40,
	...rest
}) {
	const reduceMotion = useReducedMotion();
	if (reduceMotion) {
		const Tag = as;
		return (
			<Tag className={className} {...rest}>
				{children}
			</Tag>
		);
	}
	const base = directionMap[direction] || directionMap.up;
	const offset = { x: base.x * (distance / 40), y: base.y * (distance / 40) };
	const MotionTag = motion[as];

	return (
		<MotionTag
			className={className}
			initial={{ opacity: 0, x: offset.x, y: offset.y }}
			whileInView={{ opacity: 1, x: 0, y: 0 }}
			viewport={{ once: true, margin: "-40px" }}
			transition={{ duration, delay, ease: [0.16, 1, 0.3, 1] }}
			{...rest}
		>
			{children}
		</MotionTag>
	);
}
