import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";

export default function TextColorReveal({
	children,
	className = "",
	as = "span",
	fromColor = "rgb(51, 122, 176)",
	toColor = "currentColor",
	scrollOffset = ["0px", "200px"],
}) {
	const ref = useRef(null);
	const reduceMotion = useReducedMotion();
	const { scrollYProgress } = useScroll({
		target: ref,
		offset: ["start end", `start+=${scrollOffset[1]}`],
	});

	const color = useTransform(scrollYProgress, [0, 1], [fromColor, toColor]);

	if (reduceMotion) {
		const Tag = as;
		return <Tag className={className}>{children}</Tag>;
	}

	const MotionTag = motion[as];
	return (
		<MotionTag ref={ref} className={className} style={{ color }}>
			{children}
		</MotionTag>
	);
}
