import { motion as Motion, useMotionValue, useReducedMotion, useSpring } from "framer-motion";
import { Link } from "react-router-dom";
import { cn } from "../../lib/cn.js";

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

export function MagneticNavLink({ to, label, active }) {
	const reduceMotion = useReducedMotion();
	const x = useMotionValue(0);
	const y = useMotionValue(0);
	const springX = useSpring(x, { stiffness: 500, damping: 32, mass: 0.6 });
	const springY = useSpring(y, { stiffness: 500, damping: 32, mass: 0.6 });

	const className = cn(
		"relative inline-flex items-center rounded-full px-1.5 xl:px-3 py-2 text-[0.65rem] xl:text-sm font-medium transition-colors whitespace-nowrap",
		active
			? "text-sky-700 dark:text-sky-300"
			: "text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white",
	);

	return (
		<Link
			to={to}
			className={className}
			onMouseMove={(e) => {
				if (reduceMotion) {
					return;
				}
				const rect = e.currentTarget.getBoundingClientRect();
				const relX = e.clientX - rect.left - rect.width / 2;
				const relY = e.clientY - rect.top - rect.height / 2;
				const maxX = 3;
				const maxY = 2;
				x.set(clamp((relX / (rect.width / 2)) * maxX, -maxX, maxX));
				y.set(clamp((relY / (rect.height / 2)) * maxY, -maxY, maxY));
			}}
			onMouseLeave={() => {
				x.set(0);
				y.set(0);
			}}
		>
			{active ? (
				<Motion.span
					layoutId="nav-active"
					className="absolute inset-0 rounded-full bg-sky-500/15 ring-1 ring-sky-400/30 shadow-[0_0_0_1px_rgba(109,171,223,0.12)]"
					transition={{ type: "spring", stiffness: 500, damping: 42 }}
				/>
			) : null}
			<Motion.span style={{ x: springX, y: springY }} className="relative z-10 inline-block">
				{label}
			</Motion.span>
		</Link>
	);
}
