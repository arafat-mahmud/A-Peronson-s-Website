import { Link } from "react-router-dom";
import { getCurrentUser } from "../lib/auth.js";
import { isRouteValid } from "../lib/routeHealthCheck.js";
import ScrollReveal from "./ScrollReveal.jsx";
import BrandMark from "./ui/BrandMark.jsx";

/**
 * Renders the application footer.
 *
 * @returns {JSX.Element} The rendered footer component.
 */
export default function Footer() {
	const user = getCurrentUser();

	if (!user) {
		return (
			<ScrollReveal
				as="footer"
				className="shadow-dividerT dark:shadow-dividerTDark bg-white py-8 dark:bg-slate-950"
			>
				<div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
					<div className="flex flex-col items-center justify-center gap-4 text-center">
						<div className="flex items-center gap-2">
							<BrandMark size={28} alt="" />
							<span className="text-lg font-bold text-slate-900 dark:text-white">GarTexHub</span>
						</div>
						<div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-slate-600 dark:text-slate-400">
							<Link to="/pricing" className="hover:text-gtBlue">
								Garment sourcing pricing
							</Link>
							<Link to="/about" className="hover:text-gtBlue">
								About our marketplace
							</Link>
							<Link to="/help" className="hover:text-gtBlue">
								Sourcing help &amp; FAQs
							</Link>
							<Link to="/terms" className="hover:text-gtBlue">
								Terms & Conditions
							</Link>
							<Link to="/privacy" className="hover:text-gtBlue">
								Privacy Policy
							</Link>
						</div>
						<p className="text-xs text-slate-500 dark:text-slate-400">
							© 2026 GarTexHub. All Rights Reserved.
						</p>
					</div>
				</div>
			</ScrollReveal>
		);
	}

	return (
		<ScrollReveal
			as="footer"
			className="shadow-dividerT dark:shadow-dividerTDark bg-white pt-12 pb-8 dark:bg-slate-950"
		>
			<div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
				<div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
					{/* Company Identity */}
					<div className="lg:col-span-1">
						<div className="flex items-center gap-2 mb-4">
							<BrandMark size={28} alt="" />
							<span className="text-lg font-bold text-slate-900 dark:text-white">GarTexHub</span>
						</div>
						<p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
							Trusted B2B Marketplace for Garments & Textile Industry. Connecting International
							Buyers, Buying Houses, and Verified Factories through structured communication and
							professional digital workflows.
						</p>
						<div className="mt-6 flex gap-4">
							<a href="#" className="text-slate-400 hover:text-gtBlue transition-colors">
								LinkedIn
							</a>
							<a href="#" className="text-slate-400 hover:text-gtBlue transition-colors">
								Facebook
							</a>
							<a href="#" className="text-slate-400 hover:text-gtBlue transition-colors">
								YouTube
							</a>
						</div>
					</div>

					{/* Quick Links & Account Types */}
					<div>
						<h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white">
							Quick Navigation
						</h3>
						<ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
							<li>
								<Link to="/" className="hover:text-gtBlue">
									Home
								</Link>
							</li>
							<li>
								<Link to="/search" className="hover:text-gtBlue">
									Search
								</Link>
							</li>
							<li>
								<Link to="/buyer-requests" className="hover:text-gtBlue">
									Buyer Requests
								</Link>
							</li>
							<li>
								<Link to="/product-management" className="hover:text-gtBlue">
									Company Products
								</Link>
							</li>
							<li>
								<Link to="/pricing" className="hover:text-gtBlue">
									Subscription Plans
								</Link>
							</li>
							<li>
								<Link to="/help" className="hover:text-gtBlue">
									Help Center
								</Link>
							</li>
						</ul>
					</div>

					{/* Verification & Legal */}
					<div>
						<h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white">
							Verification
						</h3>
						<ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
							{isRouteValid("/verification") && (
								<li>
									<Link to="/verification" className="hover:text-gtBlue">
										Document Verification
									</Link>
								</li>
							)}
							{isRouteValid("/contracts") && ["owner", "admin", "buying_house", "factory"].includes(user?.role) && (
								<li>
									<Link to="/contracts" className="hover:text-gtBlue">
										Digital Contract System
									</Link>
								</li>
							)}
							<li>
								<Link to="/privacy" className="hover:text-gtBlue">
									Privacy Policy
								</Link>
							</li>
							<li>
								<Link to="/terms" className="hover:text-gtBlue">
									Terms & Conditions
								</Link>
							</li>
							<li>
								<Link to="/privacy" className="hover:text-gtBlue">
									Cookie Policy
								</Link>
							</li>
						</ul>
					</div>

					{/* Support & Contact */}
					<div>
						<h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white">
							Support
						</h3>
						<ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
							<li>
								<span className="font-semibold">Email:</span>{" "}
								<a href="mailto:gartexhubsupport@gmail.com" className="text-gtBlue hover:underline">
									gartexhubsupport@gmail.com
								</a>
							</li>
							<li>
								<span className="font-semibold">Business:</span>{" "}
								<a href="mailto:gartexhubsupport@gmail.com" className="text-gtBlue hover:underline">
									gartexhubsupport@gmail.com
								</a>
							</li>
							<li className="pt-2 text-xs italic text-slate-500">
								The more verified documentation a company provides, the stronger its international
								credibility.
							</li>
						</ul>
					</div>
				</div>

				<div className="mt-12 shadow-dividerT dark:shadow-dividerTDark pt-8">
					<p className="text-center text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
						© 2026 GarTexHub. All Rights Reserved. GarTexHub is an independent B2B networking
						platform.
						<br />
						The platform does not directly process financial transactions. All recorded
						communications are subject to consent and compliance regulations.
					</p>
				</div>
			</div>
		</ScrollReveal>
	);
}
