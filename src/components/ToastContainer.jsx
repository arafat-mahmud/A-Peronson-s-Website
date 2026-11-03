import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import PropTypes from "prop-types";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { addToast, removeToast as removeToastAction } from "../store/toastSlice.js";

const ToastContext = createContext(null);

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
	const ctx = useContext(ToastContext);
	if (!ctx) {
		throw new Error("useToast must be used within ToastProvider");
	}
	return ctx;
}

ToastProvider.propTypes = {
	children: PropTypes.node.isRequired,
};

export function ToastProvider({ children }) {
	const toasts = useSelector((s) => s.toast.toasts);
	const dispatch = useDispatch();
	const timersRef = useRef({});
	const reduceMotion = useReducedMotion();

	const removeToast = useCallback(
		(id) => {
			dispatch(removeToastAction(id));
			clearTimeout(timersRef.current[id]);
			delete timersRef.current[id];
		},
		[dispatch],
	);

	useEffect(() => {
		const timers = timersRef.current;
		return () => {
			Object.values(timers).forEach(clearTimeout);
		};
	}, []);

	useEffect(() => {
		const currentIds = toasts.map((t) => t.id);
		Object.keys(timersRef.current).forEach((id) => {
			const numId = Number(id);
			if (!currentIds.includes(numId)) {
				clearTimeout(timersRef.current[numId]);
				delete timersRef.current[numId];
			}
		});
		toasts.forEach((t) => {
			if (!timersRef.current[t.id]) {
				timersRef.current[t.id] = setTimeout(() => removeToast(t.id), t.duration || 4000);
			}
		});
	}, [toasts, removeToast]);

	const toast = useMemo(
		() =>
			Object.assign((message, opts) => dispatch(addToast({ message, ...opts })), {
				success: (msg, opts) => dispatch(addToast({ message: msg, type: "success", ...opts })),
				error: (msg, opts) => dispatch(addToast({ message: msg, type: "error", ...opts })),
				info: (msg, opts) => dispatch(addToast({ message: msg, type: "info", ...opts })),
			}),
		[dispatch],
	);

	const typeStyles = {
		success: "bg-emerald-600 text-white shadow-lg shadow-emerald-500/20",
		error: "bg-red-600 text-white shadow-lg shadow-red-500/20",
		info: "bg-sky-600 text-white shadow-lg shadow-sky-500/20",
	};

	return (
		<ToastContext.Provider value={toast}>
			{children}
			<div className="fixed bottom-6 left-1/2 z-[200] flex -translate-x-1/2 flex-col items-center gap-2 pointer-events-none">
				<AnimatePresence mode="popLayout">
					{toasts.map((t) => (
						<motion.div
							key={t.id}
							layout={true}
							className={`pointer-events-auto rounded-2xl px-5 py-3 text-sm font-semibold shadow-xl ${typeStyles[t.type] || typeStyles.info}`}
							initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 20, scale: 0.9 }}
							animate={{ opacity: 1, y: 0, scale: 1 }}
							exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -10, scale: 0.9 }}
							transition={{ type: "spring", stiffness: 400, damping: 28 }}
							onClick={() => removeToast(t.id)}
						>
							{t.message}
						</motion.div>
					))}
				</AnimatePresence>
			</div>
		</ToastContext.Provider>
	);
}
