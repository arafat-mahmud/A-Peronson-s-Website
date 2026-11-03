import {
	Bell,
	ChevronDown,
	ChevronRight,
	FileText,
	LayoutDashboard,
	MessageCircle,
	MessageSquare,
	Package,
	Search,
	Settings,
	ShieldCheck,
	Star,
	Users,
	Vote,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "../../lib/cn.js";

export function NavDropdown({ group, isOpen, onToggle, userRole, badgeCount = 0 }) {
	const location = useLocation();
	const IconComponent = group.icon;

	const visibleItems = group.items.filter((item) => !item.roles || item.roles.includes(userRole));

	if (visibleItems.length === 0) {
		return null;
	}

	const handleToggle = (e) => {
		e.stopPropagation();
		onToggle(isOpen ? null : group.label);
	};

	return (
		<div className="relative">
			<button
				onClick={handleToggle}
				className={cn(
					"group inline-flex items-center gap-2 rounded-full px-1.5 xl:px-3 py-2 text-[0.65rem] xl:text-sm font-medium whitespace-nowrap transition",
					isOpen
						? "text-sky-700 bg-sky-500/10 ring-1 ring-sky-400/25 dark:text-sky-300"
						: "text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white",
				)}
			>
				<span className="inline-flex items-center gap-2">
					{IconComponent && <IconComponent className="h-4 w-4" />}
					<span className="hidden lg:inline">{group.label}</span>
				</span>
				<ChevronDown className={cn("h-4 w-4 transition-transform", isOpen ? "rotate-180" : "")} />
			</button>

			{isOpen && (
				<div
					className={cn(
						"absolute left-0 top-full z-50 mt-2 min-w-72 overflow-hidden rounded-3xl border border-white/10 bg-white/95 p-2 shadow-[0_25px_70px_rgba(15,23,42,0.18)] backdrop-blur-2xl dark:bg-slate-950/98",
						"block animate-in fade-in",
					)}
				>
					<div className="px-3 pb-2 pt-1">
						<div className="flex items-center justify-between text-xs uppercase tracking-[0.22em] text-slate-400">
							<span>{group.label}</span>
							<span className="rounded-full bg-sky-500/10 px-2 py-1 text-sky-700 dark:text-sky-300">
								{visibleItems.length} links
							</span>
						</div>
					</div>
					{group.label === "Communication" && badgeCount > 0 && (
						<div className="mt-2 mx-3 mb-2 rounded-2xl bg-sky-500/10 px-3 py-2 text-xs text-sky-700 dark:text-sky-300">
							{badgeCount} unread notifications
						</div>
					)}
					<div className="space-y-1">
						{visibleItems.map((item) => {
							const isActive =
								location.pathname === item.to ||
								`${location.pathname}?${location.search}` === item.to;
							const LinkTag = item.external ? "a" : Link;
							const linkProps = item.external
								? { href: item.to, target: "_blank", rel: "noopener noreferrer" }
								: { to: item.to, onClick: () => onToggle(null) };
							return (
								<LinkTag
									key={item.to}
									{...linkProps}
									className={cn(
										"group/item flex items-center justify-between rounded-2xl px-3 py-2.5 text-sm transition",
										isActive
											? "bg-sky-500/10 text-sky-700 ring-1 ring-sky-400/25 dark:text-sky-300"
											: "text-slate-600 hover:bg-slate-900/5 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white",
									)}
								>
									<span className="flex items-center gap-3">
										<span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-slate-900/5 text-slate-700 dark:bg-white/5 dark:text-slate-200">
											{item.label === "My Profile" && <Vote className="h-4 w-4" />}
											{item.label === "Feed" && <LayoutDashboard className="h-4 w-4" />}
											{item.label === "Manage Listings" && <Package className="h-4 w-4" />}
											{item.label === "Search" && <Search className="h-4 w-4" />}
											{item.label === "Contracts" && <FileText className="h-4 w-4" />}
											{item.label === "Verification" && <ShieldCheck className="h-4 w-4" />}
											{item.label === "Notifications" && <Bell className="h-4 w-4" />}
											{item.label === "Chat" && <MessageSquare className="h-4 w-4" />}
											{item.label === "Requests" && <FileText className="h-4 w-4" />}
											{item.label === "Products" && <Package className="h-4 w-4" />}
											{item.label === "Partners" && <Users className="h-4 w-4" />}
											{item.label === "Ratings" && <Star className="h-4 w-4" />}
											{item.label === "Members" && <Users className="h-4 w-4" />}
											{item.label === "Settings" && <Settings className="h-4 w-4" />}
											{item.label === "Insights" && <FileText className="h-4 w-4" />}
											{item.label === "Owner Dashboard" && <Star className="h-4 w-4" />}
											{item.label === "Agent Dashboard" && <Star className="h-4 w-4" />}
											{item.label === "Admin Panel" && <ShieldCheck className="h-4 w-4" />}
											{item.label === "Governance" && <Settings className="h-4 w-4" />}
											{item.label === "Contact Support" && <Settings className="h-4 w-4" />}
											{item.label === "Onboarding" && <Star className="h-4 w-4" />}
											{item.label === "Feedback" && <MessageCircle className="h-4 w-4" />}
										</span>
										<span>{item.label}</span>
									</span>
									<ChevronRight className="h-4 w-4 opacity-40 transition group-hover/item:translate-x-0.5 group-hover/item:opacity-80" />
								</LinkTag>
							);
						})}
					</div>
				</div>
			)}
		</div>
	);
}
