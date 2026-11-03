import { motion, useReducedMotion } from "framer-motion";

const containerVariants = (staggerDelay, staggerChildren) => ({
	hidden: {},
	visible: {
		transition: {
			staggerChildren,
			delayChildren: staggerDelay,
		},
	},
});

const itemVariants = {
	hidden: { opacity: 0, y: 20 },
	visible: {
		opacity: 1,
		y: 0,
		transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] },
	},
};

export function StaggerContainer({
	children,
	className = "",
	staggerDelay = 0,
	staggerChildren = 0.06,
	as = "div",
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
	const MotionTag = motion[as];
	return (
		<MotionTag
			className={className}
			variants={containerVariants(staggerDelay, staggerChildren)}
			initial="hidden"
			whileInView="visible"
			viewport={{ once: true, margin: "-60px" }}
			{...rest}
		>
			{children}
		</MotionTag>
	);
}

export function StaggerItem({ children, className = "", as = "div", ...rest }) {
	const reduceMotion = useReducedMotion();
	if (reduceMotion) {
		const Tag = as;
		return (
			<Tag className={className} {...rest}>
				{children}
			</Tag>
		);
	}
	const MotionTag = motion[as];
	return (
		<MotionTag className={className} variants={itemVariants} {...rest}>
			{children}
		</MotionTag>
	);
}
