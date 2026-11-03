import { motion as Motion, useReducedMotion } from "framer-motion";
import { Link } from "react-router-dom";
import { cn } from "../../lib/cn.js";

export function IconNavLink({ to, label, active, Icon, badgeCount = 0 }) {
	const reduceMotion = useReducedMotion();
	const IconComponent = Icon;
	return (
		<div className="group relative flex items-center justify-center">
			<Motion.div
				whileHover={reduceMotion ? undefined : { scale: 1.3 }}
				whileTap={reduceMotion ? undefined : { scale: 0.95 }}
				transition={{ type: "spring", stiffness: 400, damping: 17 }}
			>
				<Link
					to={to}
					className={cn(
						"relative inline-flex h-11 w-11 items-center justify-center rounded-full text-slate-600 transition hover:-translate-y-0.5 hover:text-sky-600 dark:text-slate-300 dark:hover:text-sky-300",
						active && "text-sky-600 dark:text-sky-300",
					)}
					aria-label={label}
				>
					{active ? (
						<Motion.span
							layoutId="nav-active"
							className="absolute inset-0 rounded-full bg-sky-500/15 ring-1 ring-sky-400/30"
							transition={{ type: "spring", stiffness: 500, damping: 42 }}
						/>
					) : null}
					<span className="relative z-10 inline-flex">
						{IconComponent && <IconComponent className="h-5 w-5" />}
						{badgeCount > 0 ? (
							<Motion.span
								animate={{ scale: [1, 1.2, 1] }}
								transition={{
									duration: 1.5,
									repeat: Number.POSITIVE_INFINITY,
									ease: "easeInOut",
								}}
								className="absolute right-0 top-0 rounded-full bg-cyan-500 px-1.5 py-0.5 text-[10px] font-semibold text-white shadow-sm"
							>
								{badgeCount > 99 ? "99+" : badgeCount}
							</Motion.span>
						) : null}
					</span>
				</Link>
			</Motion.div>

			<span className="pointer-events-none absolute -top-9 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-full border border-white/10 bg-slate-950/95 px-2.5 py-1 text-xs text-white opacity-0 shadow-lg transition duration-200 group-hover:block group-hover:opacity-100 dark:bg-slate-900/95">
				{label}
			</span>
		</div>
	);
}
