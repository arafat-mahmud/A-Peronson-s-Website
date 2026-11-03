import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef } from "react";

const overlayVariants = {
	hidden: { opacity: 0 },
	visible: { opacity: 1 },
};

const modalVariants = {
	hidden: { opacity: 0, scale: 0.92, y: 20 },
	visible: {
		opacity: 1,
		scale: 1,
		y: 0,
		transition: { type: "spring", stiffness: 350, damping: 28, mass: 0.6 },
	},
	exit: {
		opacity: 0,
		scale: 0.95,
		y: 10,
		transition: { duration: 0.2, ease: "easeIn" },
	},
};

const slideRightVariants = {
	hidden: { x: "100%" },
	visible: {
		x: 0,
		transition: { type: "spring", stiffness: 300, damping: 28 },
	},
	exit: {
		x: "100%",
		transition: { duration: 0.2, ease: "easeIn" },
	},
};

/**
 * Renders an animated modal component.
 *
 * @param {Object} props
 * @param {boolean} props.open - Whether the modal is open.
 * @param {Function} props.onClose - Function to call when the modal should close.
 * @param {React.ReactNode} props.children - The content of the modal.
 * @param {string} [props.className=""] - Additional CSS class names.
 * @param {'center'|'right'} [props.variant="center"] - The variant of the modal.
 * @param {boolean} [props.overlay=true] - Whether to show the overlay.
 * @returns {JSX.Element|null} The rendered animated modal component.
 */
const FOCUSABLE =
	'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function useFocusTrap(open, containerRef) {
	const previousFocus = useRef(null);

	useEffect(() => {
		if (!open) {
			return;
		}
		previousFocus.current = document.activeElement;
		const timer = setTimeout(() => {
			const el = containerRef.current;
			if (!el) {
				return;
			}
			const first = el.querySelector(FOCUSABLE);
			if (first) {
				first.focus();
			}
		}, 50);

		function handleKeyDown(e) {
			if (e.key !== "Tab" || !containerRef.current) {
				return;
			}
			const focusable = containerRef.current.querySelectorAll(FOCUSABLE);
			if (focusable.length === 0) {
				return;
			}
			const first = focusable[0];
			const last = focusable.at(-1);
			if (e.shiftKey) {
				if (document.activeElement === first) {
					e.preventDefault();
					last.focus();
				}
			} else if (document.activeElement === last) {
				e.preventDefault();
				first.focus();
			}
		}

		document.addEventListener("keydown", handleKeyDown);
		return () => {
			clearTimeout(timer);
			document.removeEventListener("keydown", handleKeyDown);
			if (previousFocus.current?.focus) {
				previousFocus.current.focus();
			}
		};
	}, [open, containerRef]);
}

export default function AnimatedModal({
	open,
	onClose,
	children,
	className = "",
	variant = "center",
	overlay = true,
}) {
	const reduceMotion = useReducedMotion();
	const containerRef = useRef(null);
	useFocusTrap(open, containerRef);

	if (reduceMotion) {
		if (!open) {
			return null;
		}
		return (
			<div
				ref={containerRef}
				className="fixed inset-0 z-50 flex items-center justify-center"
				role="dialog"
				aria-modal="true"
			>
				{overlay && (
					<div
						className="absolute inset-0 bg-black/50"
						onClick={onClose}
						aria-label="Close modal"
					/>
				)}
				<div className={`relative ${className}`}>{children}</div>
			</div>
		);
	}

	const contentVariants = variant === "right" ? slideRightVariants : modalVariants;

	return (
		<AnimatePresence>
			{open && (
				<div
					ref={containerRef}
					className="fixed inset-0 z-50 flex items-center justify-center"
					role="dialog"
					aria-modal="true"
				>
					{overlay && (
						<motion.div
							className="absolute inset-0 bg-black/50"
							variants={overlayVariants}
							initial="hidden"
							animate="visible"
							exit="hidden"
							onClick={onClose}
							aria-label="Close modal"
						/>
					)}
					<motion.div
						className={`relative ${className}`}
						variants={contentVariants}
						initial="hidden"
						animate="visible"
						exit="exit"
					>
						{children}
					</motion.div>
				</div>
			)}
		</AnimatePresence>
	);
}
