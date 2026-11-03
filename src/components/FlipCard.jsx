import { motion, useReducedMotion } from "framer-motion";

/**
 * Renders a flip card component.
 *
 * @param {Object} props
 * @param {React.ReactNode} props.front - The front content.
 * @param {React.ReactNode} props.back - The back content.
 * @param {string} [props.className=""] - Additional CSS class names.
 * @param {'hover'|'click'} [props.flipOn="hover"] - Trigger for flipping.
 * @param {boolean} [props.isFlipped] - Controlled flip state.
 * @param {Function} [props.onFlip] - Function to call on flip.
 * @returns {JSX.Element} The rendered flip card component.
 */
export default function FlipCard({
	front,
	back,
	className = "",
	flipOn = "hover",
	isFlipped: controlledFlip,
	onFlip,
}) {
	const reduceMotion = useReducedMotion();

	if (reduceMotion) {
		return <div className={className}>{front}</div>;
	}

	const isControlled = controlledFlip !== undefined;

	return (
		<div
			className={`group perspective-[1000px] ${className}`}
			onClick={!isControlled && flipOn === "click" ? () => onFlip?.() : undefined}
		>
			<motion.div
				className="relative w-full h-full preserve-3d"
				style={{ transformStyle: "preserve-3d" }}
				animate={{
					rotateY: isControlled ? (controlledFlip ? 180 : 0) : undefined,
				}}
				whileHover={!isControlled && flipOn === "hover" ? { rotateY: 180 } : undefined}
				transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
			>
				<div
					className="absolute inset-0"
					style={{ backfaceVisibility: "hidden", transform: "translateZ(0)" }}
				>
					{front}
				</div>
				<div
					className="absolute inset-0"
					style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
				>
					{back}
				</div>
			</motion.div>
		</div>
	);
}
