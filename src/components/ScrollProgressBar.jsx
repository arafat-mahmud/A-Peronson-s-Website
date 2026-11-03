import { motion, useReducedMotion, useScroll, useSpring } from "framer-motion";

export default function ScrollProgressBar({ sectionIds }) {
	const reduceMotion = useReducedMotion();
	const { scrollYProgress } = useScroll();

	const scaleX = useSpring(scrollYProgress, {
		stiffness: 100,
		damping: 30,
		restDelta: 0.001,
	});

	if (reduceMotion) {
		return (
			<div className="fixed inset-x-0 top-0 z-[100] h-[3px] bg-gradient-to-r from-sky-500 to-indigo-500" />
		);
	}

	return (
		<motion.div
			className="fixed inset-x-0 top-0 z-[100] h-[3px] origin-left bg-gradient-to-r from-sky-500 via-cyan-400 to-indigo-500"
			style={{ scaleX }}
		/>
	);
}
