/**
 * Admin AI Section - AI Rules & Configuration
 */

import {
	AlertCircle,
	Bot,
	CheckCircle,
	Code2,
	Lightbulb,
	MessageSquare,
	Plus,
	Save,
	Settings,
	ToggleLeft,
	ToggleRight,
	Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Mosaic, ThreeDot } from "react-loading-indicators";
import { apiRequest } from "../../../lib/auth.js";
import { cn } from "../../../lib/cn.js";
import { TIMEOUTS } from "../../../lib/constants.js";
import { logger } from "../../../lib/logger.js";

export function AdminAISection({ activeCategory, adminDark }) {
	const [rules, setRules] = useState({ globalRules: [], smallTalkRules: [] });
	const [config, setConfig] = useState({
		systemPrompt: "",
		agentPrompt: "",
		codeContextEnabled: true,
		codeContextKeywords: "",
	});
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [notice, setNotice] = useState("");
	const [error, setError] = useState("");
	const [activeTab, setActiveTab] = useState("settings");

	const [newRule, setNewRule] = useState({
		source: "",
		keywords: "",
		response: "",
	});
	const [showAddForm, setShowAddForm] = useState(false);

	async function fetchData() {
		try {
			setLoading(true);
			const [rulesData, configData] = await Promise.all([
				apiRequest("/api/assistant/rules", { token: true }),
				apiRequest("/api/assistant/config", { token: true }),
			]);
			if (rulesData) {
				setRules({
					globalRules: rulesData.globalRules || [],
					smallTalkRules: rulesData.smallTalkRules || [],
				});
			}
			if (configData) {
				setConfig({
					systemPrompt: configData.systemPrompt || "",
					agentPrompt: configData.agentPrompt || "",
					codeContextEnabled: configData.codeContextEnabled !== false,
					codeContextKeywords: (configData.codeContextKeywords || []).join(", "),
				});
			}
		} catch (err) {
			logger.warn("Failed to load AI data:", err);
			setError("Failed to load data");
		} finally {
			setLoading(false);
		}
	}

	useEffect(() => {
		// eslint-disable-next-line react-hooks/set-state-in-effect
		fetchData();
	}, [
		// eslint-disable-next-line react-hooks/set-state-in-effect
		fetchData,
	]);

	if (activeCategory !== "ai") {
		return null;
	}

	async function saveConfig() {
		setSaving(true);
		setError("");
		setNotice("");
		try {
			await apiRequest("/api/assistant/config", {
				method: "POST",
				token: true,
				body: {
					systemPrompt: config.systemPrompt,
					agentPrompt: config.agentPrompt,
					codeContextEnabled: config.codeContextEnabled,
					codeContextKeywords: config.codeContextKeywords
						.split(",")
						.map((k) => k.trim())
						.filter(Boolean),
				},
			});
			setNotice("Configuration saved");
		} catch (err) {
			setError(err.message || "Failed to save configuration");
		} finally {
			setSaving(false);
		}
	}

	async function addRule() {
		if (!(newRule.response && newRule.keywords)) {
			setError("Keywords and response are required");
			return;
		}
		try {
			const keywordArray = newRule.keywords
				.split(",")
				.map((k) => k.trim())
				.filter(Boolean);
			const ruleType = activeTab === "global" ? "global" : "smalltalk";
			const rule = await apiRequest("/api/assistant/rules", {
				method: "POST",
				token: true,
				body: {
					type: ruleType,
					source: newRule.source || `${ruleType}_rule_${Date.now()}`,
					keywords: keywordArray,
					response: newRule.response,
				},
			});
			if (rule) {
				setRules((prev) => ({
					...prev,
					[ruleType === "global" ? "globalRules" : "smallTalkRules"]: [
						...(ruleType === "global" ? prev.globalRules : prev.smallTalkRules),
						rule,
					],
				}));
				setNewRule({ source: "", keywords: "", response: "" });
				setShowAddForm(false);
				setNotice("Rule added successfully");
				setTimeout(() => setNotice(""), TIMEOUTS.LONG);
			}
		} catch (err) {
			logger.warn("Failed to add rule:", err);
			setError("Failed to add rule");
		}
	}

	async function deleteRule(ruleId) {
		try {
			const ruleType = activeTab === "global" ? "global" : "smalltalk";
			await apiRequest(`/api/assistant/rules/${ruleType}/${ruleId}`, {
				method: "DELETE",
				token: true,
			});
			setRules((prev) => ({
				...prev,
				[ruleType === "global" ? "globalRules" : "smallTalkRules"]: (ruleType === "global"
					? prev.globalRules
					: prev.smallTalkRules
				).filter((r) => r.id !== ruleId),
			}));
			setNotice("Rule deleted");
			setTimeout(() => setNotice(""), TIMEOUTS.LONG);
		} catch (err) {
			logger.warn("Failed to delete rule:", err);
			setError("Failed to delete rule");
		}
	}

	const currentRules = activeTab === "global" ? rules.globalRules : rules.smallTalkRules;
	const tabs = [
		{ id: "settings", label: "Settings", icon: Settings },
		{ id: "global", label: "Global Rules", icon: Lightbulb },
		{ id: "smalltalk", label: "Small Talk", icon: MessageSquare },
	];

	return (
		<div className="space-y-6">
			<div
				className={cn(
					"rounded-3xl border p-6",
					adminDark ? "border-white/10 bg-white/5" : "border-slate-200 bg-white",
				)}
			>
				<div className="flex items-center gap-4">
					<div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-400 text-white">
						<Bot className="h-6 w-6" />
					</div>
					<div>
						<h2 className={cn("text-2xl font-semibold", adminDark ? "text-white" : "text-slate-900")}>
							AI Assistant Configuration
						</h2>
						<p className={adminDark ? "text-slate-400" : "text-slate-500"}>
							Configure AI behavior, prompts, and response rules
						</p>
					</div>
				</div>
			</div>

			{notice && (
				<div className="flex items-center gap-2 rounded-2xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-green-400">
					<CheckCircle className="h-5 w-5" />
					{notice}
				</div>
			)}

			{error && (
				<div className="flex items-center gap-2 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-400">
					<AlertCircle className="h-5 w-5" />
					{error}
				</div>
			)}

			{/* Tabs */}
			<div
				className={cn(
					"flex gap-2 rounded-2xl border p-1",
					adminDark ? "border-white/10 bg-white/5" : "border-slate-200 bg-slate-50",
				)}
			>
				{tabs.map((tab) => (
					<button
						key={tab.id}
						type="button"
						onClick={() => setActiveTab(tab.id)}
						className={cn(
							"flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
							activeTab === tab.id
								? adminDark
									? "bg-indigo-500/20 text-indigo-300"
									: "bg-white text-indigo-600 shadow-sm"
								: adminDark
									? "text-slate-400 hover:text-white"
									: "text-slate-600 hover:text-slate-900",
						)}
					>
						<tab.icon className="h-4 w-4" />
						{tab.label}
					</button>
				))}
			</div>

			{loading ? (
				<Mosaic color="#337ab0" size="large" style={{ fontSize: "40px" }} text="" textColor="" />
			) : activeTab === "settings" ? (
				<div className="space-y-6">
					{/* System Prompt */}
					<div
						className={cn(
							"rounded-3xl border p-6",
							adminDark ? "border-white/10 bg-white/5" : "border-slate-200 bg-white",
						)}
					>
						<div className="mb-4 flex items-center gap-2">
							<Code2 className="h-5 w-5 text-indigo-400" />
							<h3 className={cn("font-semibold", adminDark ? "text-white" : "text-slate-900")}>
								System Prompt
							</h3>
						</div>
						<p className={cn("mb-4 text-sm", adminDark ? "text-slate-400" : "text-slate-500")}>
							Short instruction that defines AI's role. Sent as "system" message to AI.
						</p>
						<textarea
							value={config.systemPrompt}
							onChange={(e) => setConfig((prev) => ({ ...prev, systemPrompt: e.target.value }))}
							rows={3}
							placeholder="You are a helpful GarTex assistant."
							className={cn(
								"w-full rounded-2xl border px-4 py-3 text-sm outline-none resize-none",
								adminDark
									? "border-slate-700 bg-slate-800 text-white placeholder:text-slate-500 focus:border-indigo-500"
									: "border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-indigo-500",
							)}
						/>
					</div>

					{/* Agent Prompt */}
					<div
						className={cn(
							"rounded-3xl border p-6",
							adminDark ? "border-white/10 bg-white/5" : "border-slate-200 bg-white",
						)}
					>
						<div className="mb-4 flex items-center gap-2">
							<Bot className="h-5 w-5 text-indigo-400" />
							<h3 className={cn("font-semibold", adminDark ? "text-white" : "text-slate-900")}>
								Agent Prompt
							</h3>
						</div>
						<p className={cn("mb-4 text-sm", adminDark ? "text-slate-400" : "text-slate-500")}>
							Full prompt with role description. Appended before knowledge base and user question.
						</p>
						<textarea
							value={config.agentPrompt}
							onChange={(e) => setConfig((prev) => ({ ...prev, agentPrompt: e.target.value }))}
							rows={6}
							placeholder="You are the GarTex Assistant, an expert on the GarTexHub textile marketplace platform..."
							className={cn(
								"w-full rounded-2xl border px-4 py-3 text-sm outline-none resize-none font-mono",
								adminDark
									? "border-slate-700 bg-slate-800 text-white placeholder:text-slate-500 focus:border-indigo-500"
									: "border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-indigo-500",
							)}
						/>
					</div>

					{/* Code Context Settings */}
					<div
						className={cn(
							"rounded-3xl border p-6",
							adminDark ? "border-white/10 bg-white/5" : "border-slate-200 bg-white",
						)}
					>
						<div className="mb-4 flex items-center justify-between">
							<div className="flex items-center gap-2">
								<Code2 className="h-5 w-5 text-indigo-400" />
								<h3 className={cn("font-semibold", adminDark ? "text-white" : "text-slate-900")}>
									Code Context Search
								</h3>
							</div>
							<button
								type="button"
								onClick={() =>
									setConfig((prev) => ({
										...prev,
										codeContextEnabled: !prev.codeContextEnabled,
									}))
								}
								className="text-indigo-400"
							>
								{config.codeContextEnabled ? (
									<ToggleRight className="h-6 w-6" />
								) : (
									<ToggleLeft className="h-6 w-6" />
								)}
							</button>
						</div>
						<p className={cn("mb-4 text-sm", adminDark ? "text-slate-400" : "text-slate-500")}>
							When enabled, AI will search your codebase for relevant code snippets when questions
							contain these keywords.
						</p>
						<div>
							<label
								className={cn(
									"mb-1.5 block text-sm font-medium",
									adminDark ? "text-slate-300" : "text-slate-700",
								)}
							>
								Keywords (comma separated)
							</label>
							<input
								type="text"
								value={config.codeContextKeywords}
								onChange={(e) =>
									setConfig((prev) => ({
										...prev,
										codeContextKeywords: e.target.value,
									}))
								}
								placeholder="api, route, server, code, bug, error"
								disabled={!config.codeContextEnabled}
								className={cn(
									"w-full rounded-2xl border px-4 py-2.5 text-sm outline-none",
									adminDark
										? "border-slate-700 bg-slate-800 text-white placeholder:text-slate-500 focus:border-indigo-500"
										: "border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-indigo-500",
									!config.codeContextEnabled && "opacity-50",
								)}
							/>
						</div>
					</div>

					{/* Save Button */}
					<button
						type="button"
						onClick={saveConfig}
						disabled={saving}
						className="flex w-full items-center justify-center gap-2 rounded-2xl border border-indigo-500/30 bg-indigo-500/20 px-6 py-3 text-sm font-medium text-indigo-300 transition-all hover:bg-indigo-500/30 disabled:opacity-50"
					>
						{saving ? (
							<ThreeDot variant="bounce" color="#337ab0" size="small" text="" textColor="" />
						) : (
							<Save className="h-4 w-4" />
						)}
						{saving ? "Saving..." : "Save Settings"}
					</button>
				</div>
			) : (
				<div className="space-y-4">
					{/* Rules List */}
					<div
						className={cn(
							"rounded-3xl border",
							adminDark ? "border-white/10 bg-white/5" : "border-slate-200 bg-white",
						)}
					>
						<div className="border-b border-slate-200/10 px-6 py-4">
							<div className="flex items-center justify-between">
								<h3 className={cn("font-semibold", adminDark ? "text-white" : "text-slate-900")}>
									{activeTab === "global" ? "Global Rules" : "Small Talk Rules"} (
									{currentRules.length})
								</h3>
								<button
									type="button"
									onClick={() => setShowAddForm(!showAddForm)}
									className="flex items-center gap-2 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-3 py-1.5 text-sm font-medium text-indigo-400 transition-all hover:bg-indigo-500/20"
								>
									<Plus className="h-4 w-4" />
									Add Rule
								</button>
							</div>
						</div>

						{currentRules.length === 0 ? (
							<div className="px-6 py-12 text-center">
								<Bot
									className={cn(
										"mx-auto h-12 w-12 mb-4",
										adminDark ? "text-slate-600" : "text-slate-300",
									)}
								/>
								<p className={adminDark ? "text-slate-400" : "text-slate-500"}>
									No rules configured yet
								</p>
							</div>
						) : (
							<div className="divide-y divide-slate-200/10">
								{currentRules.map((rule) => (
									<div key={rule.id} className="px-6 py-4 hover:bg-white/5">
										<div className="flex items-start justify-between gap-4">
											<div className="min-w-0 flex-1">
												<div className="flex items-center gap-2 flex-wrap">
													<span
														className={cn(
															"text-sm font-medium",
															adminDark ? "text-white" : "text-slate-900",
														)}
													>
														{rule.source}
													</span>
												</div>
												<div className="mt-2 flex items-center gap-2 flex-wrap">
													{rule.keywords?.map((kw, idx) => (
														<span
															key={idx}
															className={cn(
																"rounded-full border px-2 py-0.5 text-xs",
																adminDark
																	? "border-indigo-500/30 bg-indigo-500/10 text-indigo-300"
																	: "border-indigo-200 bg-indigo-50 text-indigo-600",
															)}
														>
															{kw}
														</span>
													))}
												</div>
												<p
													className={cn(
														"mt-2 text-sm",
														adminDark ? "text-slate-300" : "text-slate-600",
													)}
												>
													{rule.response}
												</p>
											</div>
											<button
												type="button"
												onClick={() => deleteRule(rule.id)}
												className="shrink-0 rounded-xl border border-red-500/30 bg-red-500/10 p-2 text-red-400 transition-all hover:bg-red-500/20"
											>
												<Trash2 className="h-4 w-4" />
											</button>
										</div>
									</div>
								))}
							</div>
						)}
					</div>

					{/* Add Rule Form */}
					{showAddForm && (
						<div
							className={cn(
								"rounded-3xl border p-6",
								adminDark ? "border-white/10 bg-white/5" : "border-slate-200 bg-white",
							)}
						>
							<h3 className={cn("mb-4 font-semibold", adminDark ? "text-white" : "text-slate-900")}>
								Add New Rule
							</h3>
							<div className="space-y-4">
								<div>
									<label
										className={cn(
											"mb-1.5 block text-sm font-medium",
											adminDark ? "text-slate-300" : "text-slate-700",
										)}
									>
										Source (optional)
									</label>
									<input
										type="text"
										value={newRule.source}
										onChange={(e) =>
											setNewRule((prev) => ({
												...prev,
												source: e.target.value,
											}))
										}
										placeholder="e.g., custom_rule_name"
										className={cn(
											"w-full rounded-2xl border px-4 py-2.5 text-sm outline-none",
											adminDark
												? "border-slate-700 bg-slate-800 text-white placeholder:text-slate-500 focus:border-indigo-500"
												: "border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-indigo-500",
										)}
									/>
								</div>
								<div>
									<label
										className={cn(
											"mb-1.5 block text-sm font-medium",
											adminDark ? "text-slate-300" : "text-slate-700",
										)}
									>
										Keywords (comma separated)
									</label>
									<input
										type="text"
										value={newRule.keywords}
										onChange={(e) =>
											setNewRule((prev) => ({
												...prev,
												keywords: e.target.value,
											}))
										}
										placeholder="e.g., setup, onboarding, profile"
										className={cn(
											"w-full rounded-2xl border px-4 py-2.5 text-sm outline-none",
											adminDark
												? "border-slate-700 bg-slate-800 text-white placeholder:text-slate-500 focus:border-indigo-500"
												: "border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-indigo-500",
										)}
									/>
								</div>
								<div>
									<label
										className={cn(
											"mb-1.5 block text-sm font-medium",
											adminDark ? "text-slate-300" : "text-slate-700",
										)}
									>
										Response
									</label>
									<textarea
										value={newRule.response}
										onChange={(e) =>
											setNewRule((prev) => ({
												...prev,
												response: e.target.value,
											}))
										}
										rows={3}
										placeholder="The response the AI should give when keywords match"
										className={cn(
											"w-full rounded-2xl border px-4 py-2.5 text-sm outline-none resize-none",
											adminDark
												? "border-slate-700 bg-slate-800 text-white placeholder:text-slate-500 focus:border-indigo-500"
												: "border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-indigo-500",
										)}
									/>
								</div>
								<div className="flex gap-2">
									<button
										type="button"
										onClick={addRule}
										className="flex items-center gap-2 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-4 py-2 text-sm font-medium text-indigo-400 transition-all hover:bg-indigo-500/20"
									>
										<Plus className="h-4 w-4" />
										Add Rule
									</button>
									<button
										type="button"
										onClick={() => {
											setShowAddForm(false);
											setNewRule({ source: "", keywords: "", response: "" });
										}}
										className={cn(
											"rounded-xl border px-4 py-2 text-sm font-medium transition-all",
											adminDark
												? "border-slate-700 text-slate-400 hover:text-white"
												: "border-slate-200 text-slate-600 hover:text-slate-900",
										)}
									>
										Cancel
									</button>
								</div>
							</div>
						</div>
					)}
				</div>
			)}
		</div>
	);
}

export default AdminAISection;
