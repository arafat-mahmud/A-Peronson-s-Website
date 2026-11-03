import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useState } from "react";

/**
 * @typedef {Object} AccordionItem
 * @property {string|number} id - Unique identifier for the item.
 * @property {string|JSX.Element} title - Title of the accordion item.
 * @property {string|JSX.Element} content - Content of the accordion item.
 */

/**
 * Renders an accordion component with animated transitions.
 *
 * @param {Object} props
 * @param {AccordionItem[]} props.items - The list of items in the accordion.
 * @param {string} [props.className=""] - Additional CSS class names.
 * @param {boolean} [props.allowMultiple=false] - Whether multiple items can be open at once.
 * @returns {JSX.Element} The rendered animated accordion component.
 */
export default function AnimatedAccordion({ items, className = "", allowMultiple = false }) {
	const [openSet, setOpenSet] = useState(new Set());
	const reduceMotion = useReducedMotion();

	function toggle(id) {
		setOpenSet((prev) => {
			const next = new Set(allowMultiple ? prev : []);
			if (prev.has(id)) {
				next.delete(id);
			} else {
				next.add(id);
			}
			return next;
		});
	}

	return (
		<div className={`space-y-2 ${className}`}>
			{items.map((item) => {
				const isOpen = openSet.has(item.id);
				return (
					<div
						key={item.id}
						className="rounded-2xl border border-slate-200/70 bg-white dark:border-slate-800/60 dark:bg-slate-950/80 overflow-hidden"
					>
						<button
							onClick={() => toggle(item.id)}
							className="flex w-full items-center justify-between px-5 py-4 text-left text-sm font-semibold text-slate-900 dark:text-white"
						>
							{item.title}
							<motion.svg
								animate={{ rotate: isOpen ? 180 : 0 }}
								transition={{ duration: 0.2 }}
								width="16"
								height="16"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2"
								strokeLinecap="round"
								strokeLinejoin="round"
							>
								<path d="m6 9 6 6 6-6" />
							</motion.svg>
						</button>
						<AnimatePresence initial={false}>
							{isOpen && (
								<motion.div
									key="content"
									initial={
										reduceMotion ? { height: "auto", opacity: 1 } : { height: 0, opacity: 0 }
									}
									animate={{ height: "auto", opacity: 1 }}
									exit={{ height: 0, opacity: 0 }}
									transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
									className="overflow-hidden"
								>
									<div className="px-5 pb-4 text-sm leading-6 text-slate-600 dark:text-slate-300">
										{item.content}
									</div>
								</motion.div>
							)}
						</AnimatePresence>
					</div>
				);
			})}
		</div>
	);
}
