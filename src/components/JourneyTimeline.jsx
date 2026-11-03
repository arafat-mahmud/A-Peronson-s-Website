import PropTypes from "prop-types";
import { useEffect, useMemo, useState } from "react";
import { apiRequest, getToken } from "../lib/auth.js";

const ORDERED_STATES = [
	"discovered",
	"matched",
	"contacted",
	"meeting_scheduled",
	"negotiating",
	"contract_drafted",
	"contract_signed",
	"closed",
];

function toLabel(state) {
	return String(state || "")
		.replace(/_/g, " ")
		.replace(/^./, (c) => c.toUpperCase());
}

JourneyTimeline.propTypes = {
	title: PropTypes.string,
	matchId: PropTypes.string,
};

export default function JourneyTimeline({ title = "Journey Timeline", matchId = "" }) {
	const [journey, setJourney] = useState(null);
	const [error, setError] = useState("");

	useEffect(() => {
		const token = getToken();
		if (!(token && matchId)) {
			return;
		}

		apiRequest(`/workflow/journeys/by-match/${encodeURIComponent(matchId)}`, {
			token,
		})
			.then((row) => {
				setJourney(row);
				setError("");
			})
			.catch(() => {
				setJourney(null);
				setError("Journey not started yet.");
			});
	}, [matchId]);

	const currentIndex = useMemo(
		() => ORDERED_STATES.indexOf(String(journey?.current_state || "")),
		[journey?.current_state],
	);

	return (
		<section className="rounded-2xl bg-white p-4 ring-1 ring-slate-200/70">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<h3 className="text-sm font-semibold text-slate-900">{title}</h3>
				{journey?.id ? (
					<span className="text-[11px] text-slate-500">Journey #{journey.id.slice(0, 8)}</span>
				) : null}
			</div>

			<div className="mt-3 flex flex-wrap gap-2">
				{ORDERED_STATES.map((state, idx) => {
					const done = currentIndex >= idx;
					return (
						<span
							key={state}
							className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ${done ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-slate-50 text-slate-500 ring-slate-200"}`}
						>
							{toLabel(state)}
						</span>
					);
				})}
			</div>

			{journey?.transitions?.length > 0 ? (
				<div className="mt-3 text-xs text-slate-600">
					Recent transitions:
					<ul className="mt-1 list-disc pl-5">
						{journey.transitions
							.slice(-3)
							.reverse()
							.map((row) => (
								<li key={row.id}>
									{toLabel(row.from_state)} → {toLabel(row.to_state)} ({row.event_type})
								</li>
							))}
					</ul>
				</div>
			) : null}

			{!journey && error ? <div className="mt-2 text-xs text-slate-500">{error}</div> : null}
		</section>
	);
}
