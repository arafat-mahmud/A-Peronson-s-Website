import { motion, useMotionValue, useReducedMotion, useSpring } from "framer-motion";
import { Link, useLocation, useNavigate } from "react-router-dom";

const _MotionLink = motion.create(Link);

export default function MagneticButton({ to, onClick, className = "", children, ...rest }) {
	const reduceMotion = useReducedMotion();
	const x = useMotionValue(0);
	const y = useMotionValue(0);
	const springX = useSpring(x, { stiffness: 320, damping: 22, mass: 0.45 });
	const springY = useSpring(y, { stiffness: 320, damping: 22, mass: 0.45 });
	const maxShift = 10;
	const location = useLocation();
	const navigate = useNavigate();

	function handleMove(event) {
		if (reduceMotion) {
			return;
		}
		const rect = event.currentTarget.getBoundingClientRect();
		const relX = (event.clientX - rect.left) / rect.width;
		const relY = (event.clientY - rect.top) / rect.height;
		x.set((relX - 0.5) * 2 * maxShift);
		y.set((relY - 0.5) * 2 * maxShift);
	}

	function handleLeave() {
		x.set(0);
		y.set(0);
	}

	const commonProps = {
		className,
		onMouseMove: handleMove,
		onMouseLeave: handleLeave,
		style: reduceMotion ? undefined : { x: springX, y: springY },
		...rest,
	};

	// Special handling for hash anchors (e.g., "#plans").
	if (typeof to === "string" && to.startsWith("#")) {
		const hash = to;
		const handleHash = (e) => {
			e?.preventDefault?.();
			const targetId = hash.slice(1);
			// If already on Pricing page, try to scroll to the element.
			if (location.pathname === "/pricing") {
				const el = document.getElementById(targetId);
				if (el) {
					el.scrollIntoView({ behavior: "smooth", block: "start" });
					// update URL fragment without reloading
					window.history.replaceState({}, "", `${location.pathname}${hash}`);
					return;
				}
				// Fallback: set location.hash so page-level effect can react
				window.location.hash = targetId;
				return;
			}

			// If not on the target page, navigate to /pricing with fragment.
			navigate(`/pricing${hash}`);
		};

		return (
			<motion.button type="button" onClick={handleHash} {...commonProps}>
				{children}
			</motion.button>
		);
	}

	if (to) {
		return (
			<_MotionLink to={to} {...commonProps}>
				{children}
			</_MotionLink>
		);
	}

	return (
		<motion.button type="button" onClick={onClick} {...commonProps}>
			{children}
		</motion.button>
	);
}
