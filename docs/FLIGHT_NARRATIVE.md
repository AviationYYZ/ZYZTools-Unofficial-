# Aircraft movement narratives

Flight Narrative replaces the incident-report UI. Select a recorded/imported aircraft, then choose a UTC start and end time. The initial selection is the last ten recorded minutes. Blank start/end fields use the beginning/end of available history.

Generate flight narrative produces readable sentences about recorded altitude, groundspeed, ground track and heading when available. Consecutive changes in the same direction are grouped; gaps longer than 30 seconds are not interpolated. The narrative does not infer pilot intent, compliance or unrecorded maneuvers. Imported logs retain their unverified altitude datum and derived-ground-track limitations.

With local AI enabled, Ollama rewrites the structured movement segments into prose in bounded batches. All segments from the selected range are supplied, rather than subsampling the whole flight. More than 1,000 segments requires a shorter AI range. The factual narrative is retained on cancellation/failure. Model wording remains fallible and should be checked against exported evidence.

The visible report is prose, not a timestamp table or incident finding. Raw selected-range samples and structured movement actions remain available through Export evidence JSON. No cloud inference is used. Ollama is requested to unload after completion/cancellation. Imported log histories and live recording remain unchanged.

## Phase, waypoint context and flight questions

The phase selector labels the time interval you chose (ground/taxi, takeoff, climb, cruise, descent, approach, landing or go-around). It is your context label, not automatically detected and does not change the chosen start/end times.

New live telemetry records EuroScope's assigned direct-to waypoint, calculated next route point, nearest extracted-route waypoint and distances where available. Update the DLL through Install / Link to collect these fields. These are distinct: an assigned direct-to field does not prove a spoken clearance, a calculated next point is not an assigned direct-to, and route proximity does not imply pilot intent. Older logs may only contain filed route names; the report explicitly states when current direct-to or waypoint location is unavailable.

Enter a question such as "When did it turn?" or "What was its ground speed during the turn?" before generating. Local AI answers from matching movement intervals and known waypoint context inside the selected range. Factual answers are available without AI for common movement questions. Questions asking why cannot establish intent from movement alone. Long questions spanning too many intervals require a shorter range, and unknowns are not filled in with assumptions.
