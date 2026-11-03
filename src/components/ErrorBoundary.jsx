import PropTypes from "prop-types";
import { Component } from "react";

/**
 * An error boundary component to catch JavaScript errors in its child component tree.
 *
 * @typedef {Object} ErrorBoundaryProps
 * @property {React.ReactNode} children - The child components.
 * @property {Function} [fallback] - The fallback component to render on error.
 * @property {Function} [onError] - Function to call on error.
 *
 * @extends {Component<ErrorBoundaryProps>}
 */
export default class ErrorBoundary extends Component {
	static propTypes = {
		children: PropTypes.node.isRequired,
		fallback: PropTypes.func,
		onError: PropTypes.func,
	};
	constructor(props) {
		super(props);
		this.state = { hasError: false, error: null };
	}

	static getDerivedStateFromError(error) {
		return { hasError: true, error };
	}

	componentDidCatch(error, info) {
		if (typeof this.props.onError === "function") {
			this.props.onError(error, info);
		}
	}

	render() {
		if (this.state.hasError) {
			if (typeof this.props.fallback === "function") {
				return this.props.fallback(this.state.error);
			}
			return (
				<div className="flex min-h-[400px] flex-col items-center justify-center gap-4 p-8 text-center">
					<div className="rounded-full bg-red-100 p-4 dark:bg-red-900/30">
						<svg
							className="h-8 w-8 text-red-500"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
							/>
						</svg>
					</div>
					<h2 className="text-xl font-semibold text-slate-900 dark:text-white">
						Something went wrong
					</h2>
					<p className="max-w-md text-sm text-slate-500 dark:text-slate-400">
						An unexpected error occurred. Please try refreshing the page.
					</p>
					<button
						onClick={() => window.location.reload()}
						className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700"
					>
						Refresh Page
					</button>
				</div>
			);
		}
		return this.props.children;
	}
}
