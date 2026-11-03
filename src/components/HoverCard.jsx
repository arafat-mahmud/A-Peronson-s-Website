import { motion, useMotionValue, useReducedMotion, useSpring } from "framer-motion";

export default function HoverCard({
	children,
	className = "",
	scale = 1.02,
	lift = -4,
	shadow = true,
	tilt = false,
	tiltAmount = 6,
	...rest
}) {
	const reduceMotion = useReducedMotion();
	const x = useMotionValue(0);
	const y = useMotionValue(0);

	const springX = useSpring(x, { stiffness: 300, damping: 25 });
	const springY = useSpring(y, { stiffness: 300, damping: 25 });

	function handleMove(e) {
		if (reduceMotion || !tilt) {
			return;
		}
		const rect = e.currentTarget.getBoundingClientRect();
		const relX = (e.clientX - rect.left) / rect.width;
		const relY = (e.clientY - rect.top) / rect.height;
		x.set((relX - 0.5) * tiltAmount);
		y.set((relY - 0.5) * tiltAmount);
	}

	function handleLeave() {
		x.set(0);
		y.set(0);
	}

	return (
		<motion.div
			className={className}
			whileHover={reduceMotion ? {} : { scale, y: lift }}
			style={tilt && !reduceMotion ? { rotateX: springY, rotateY: springX } : {}}
			onMouseMove={handleMove}
			onMouseLeave={handleLeave}
			transition={{ type: "spring", stiffness: 300, damping: 20, mass: 0.6 }}
			{...rest}
		>
			{children}
		</motion.div>
	);
}
