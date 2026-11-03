import { Upload } from "lucide-react";
import { useState } from "react";
import NeonAtom from "../components/ui/NeonAtom.jsx";
import UploadProgressBar from "../components/ui/UploadProgressBar.jsx";
import { apiRequest, getCurrentUser, getToken } from "../lib/auth.js";
import { useTheme } from "../lib/ThemeProvider.jsx";
import { uploadFile } from "../lib/upload.js";

const FEEDBACK_CATEGORIES = [
	"Bug Report",
	"Feature Request",
	"Account Problem",
	"Payment / Verification Issue",
	"Report a User",
	"Content Report",
	"General Feedback",
];

export default function FeedbackPage() {
	const token = getToken();
	const sessionUser = getCurrentUser();

	const { theme: currentTheme } = useTheme();
	const darkMode = currentTheme === "dark";

	const theme = darkMode ? "bg-slate-950 text-white" : "bg-sky-50 text-slate-900";
	const cardTheme = darkMode
		? "bg-white/5 border-white/10 shadow-[0_20px_80px_rgba(32,101,152,0.18)]"
		: "bg-white border-slate-200 shadow-[0_20px_60px_rgba(51,122,176,0.10)]";
	const inputTheme = darkMode
		? "bg-slate-900/70 border-white/10 placeholder:text-slate-400 text-white focus:border-sky-400 focus:ring-sky-400/20"
		: "bg-white border-slate-200 placeholder:text-slate-400 text-slate-900 focus:border-sky-500 focus:ring-sky-500/20";

	const [category, setCategory] = useState("Bug Report");
	const [subject, setSubject] = useState("");
	const [description, setDescription] = useState("");
	const [contactEmail, setContactEmail] = useState(sessionUser?.email || "");
	const [attachment, setAttachment] = useState(null);
	const [attachmentUploadProgress, setAttachmentUploadProgress] = useState(0);
	const [loading, setLoading] = useState(false);
	const [feedback, setFeedback] = useState("");

	async function handleSubmit(e) {
		e.preventDefault();
		setLoading(true);
		setFeedback("");

		try {
			const payload = {
				category: "feedback",
				subject,
				description,
				contact_email: contactEmail,
				feedback_type: category,
			};

			const result = await apiRequest("/support/tickets", {
				method: "POST",
				...(token ? { token } : {}),
				body: payload,
			});

			const ticketId = result?.ticket?.id || result?.id;
			if (attachment && ticketId) {
				setAttachmentUploadProgress(0);
				await uploadFile("/documents", {
					file: attachment,
					token,
					fields: {
						entity_type: "support_ticket",
						entity_id: ticketId,
						type: "screenshot",
					},
					onProgress: setAttachmentUploadProgress,
				});
			}

			setFeedback("Feedback submitted successfully.");
			setSubject("");
			setDescription("");
			setCategory("Bug Report");
			setContactEmail(sessionUser?.email || "");
			setAttachment(null);
		} catch (err) {
			setFeedback(err.message || "Unable to submit feedback");
		} finally {
			setLoading(false);
		}
	}

	return (
		<div className={`min-h-screen ${theme} transition-colors duration-300`}>
			<div className="absolute inset-0 pointer-events-none overflow-hidden">
				<div className="absolute -top-24 left-[-6rem] h-72 w-72 rounded-full bg-sky-500/20 blur-3xl" />
				<div className="absolute top-40 right-[-6rem] h-80 w-80 rounded-full bg-cyan-400/15 blur-3xl" />
				<div className="absolute bottom-0 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-blue-500/10 blur-3xl" />
			</div>

			<div className="relative mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
				<header className={`mb-6 overflow-hidden rounded-[28px] border ${cardTheme} backdrop-blur-xl`}>
					<div className="p-6 lg:p-8">
						<h1 className="text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">
							Feedback
						</h1>
						<p
							className={`mt-4 max-w-2xl text-sm leading-6 sm:text-base ${darkMode ? "text-slate-300" : "text-slate-600"}`}
						>
							Help us improve. Submit bug reports, feature requests, or general feedback and we'll
							track everything as a support ticket.
						</p>
					</div>
				</header>

				{feedback && (
					<div
						className={`mb-6 rounded-2xl border px-4 py-3 ${
							feedback.includes("success")
								? "border-emerald-400/20 bg-emerald-500/10 text-emerald-300"
								: "border-rose-400/20 bg-rose-500/10 text-rose-300"
						}`}
					>
						{feedback}
					</div>
				)}

				<section className={`rounded-[28px] border ${cardTheme} p-5 backdrop-blur-xl sm:p-6`}>
					<form onSubmit={handleSubmit} className="space-y-5">
						<label className="block">
							<span className={`mb-2 block text-sm font-medium ${darkMode ? "text-slate-200" : "text-slate-700"}`}>
								Category
							</span>
							<select
								value={category}
								onChange={(e) => setCategory(e.target.value)}
								className={`w-full rounded-2xl border px-4 py-3 text-sm outline-none transition ${inputTheme}`}
								required={true}
							>
								{FEEDBACK_CATEGORIES.map((item) => (
									<option key={item} value={item}>
										{item}
									</option>
								))}
							</select>
						</label>

						<label className="block">
							<span className={`mb-2 block text-sm font-medium ${darkMode ? "text-slate-200" : "text-slate-700"}`}>
								Subject
							</span>
							<input
								value={subject}
								onChange={(e) => setSubject(e.target.value)}
								placeholder="Brief summary of your feedback"
								className={`w-full rounded-2xl border px-4 py-3 text-sm outline-none transition ${inputTheme}`}
								required={true}
							/>
						</label>

						<label className="block">
							<span className={`mb-2 block text-sm font-medium ${darkMode ? "text-slate-200" : "text-slate-700"}`}>
								Description
							</span>
							<textarea
								rows={6}
								value={description}
								onChange={(e) => setDescription(e.target.value)}
								placeholder="Provide as much detail as possible"
								className={`w-full rounded-3xl border px-4 py-3 text-sm outline-none transition ${inputTheme}`}
								required={true}
							/>
						</label>

						<div className={`rounded-[24px] border border-dashed p-5 ${darkMode ? "border-white/10 bg-slate-900/30" : "border-slate-200 bg-slate-50"}`}>
							<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
								<div className="flex items-start gap-3">
									<Upload className={`mt-0.5 h-5 w-5 ${darkMode ? "text-sky-300" : "text-sky-600"}`} />
									<div>
										<p className="font-medium">
											File attachment{" "}
											<span className={darkMode ? "text-slate-500" : "text-slate-400"}>(optional)</span>
										</p>
										<p className={`mt-1 text-sm ${darkMode ? "text-slate-400" : "text-slate-600"}`}>
											{attachment ? attachment.name : "No file chosen"}
										</p>
									</div>
								</div>
								<label
									className={`inline-flex cursor-pointer items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-medium transition hover:scale-[1.01] active:scale-[0.99] ${darkMode ? "border-white/10 bg-white/5 text-white hover:bg-white/10" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}
								>
									<input
										type="file"
										className="hidden"
										onChange={(e) => setAttachment(e.target.files?.[0] || null)}
									/>
									{attachment ? "Change" : "Choose file"}
								</label>
							</div>
							{attachmentUploadProgress > 0 && (
								<UploadProgressBar progress={attachmentUploadProgress} className="mt-2" />
							)}
						</div>

						<label className="block">
							<span className={`mb-2 block text-sm font-medium ${darkMode ? "text-slate-200" : "text-slate-700"}`}>
								Contact Email{" "}
								<span className={darkMode ? "text-slate-500" : "text-slate-400"}>(optional)</span>
							</span>
							<input
								type="email"
								value={contactEmail}
								onChange={(e) => setContactEmail(e.target.value)}
								placeholder="you@example.com"
								className={`w-full rounded-2xl border px-4 py-3 text-sm outline-none transition ${inputTheme}`}
							/>
						</label>

						<button
							type="submit"
							disabled={loading}
							className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-sky-500 via-cyan-400 to-blue-500 px-5 py-4 text-sm font-semibold text-white shadow-xl shadow-sky-500/20 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70"
						>
							{loading ? <NeonAtom fill={true} size={24} /> : null}
							{loading ? "Submitting..." : "Submit Feedback"}
						</button>
					</form>
				</section>
			</div>
		</div>
	);
}
