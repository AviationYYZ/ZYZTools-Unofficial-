# Local pilot and controller feedback

The current Flight Narrative page replaces the original incident-report interface described below. See [FLIGHT_NARRATIVE.md](FLIGHT_NARRATIVE.md) for time-range selection and AI movement prose. Log import and local AI setup remain available.

Update the EuroScope plugin through Install / Link, then connect to the network. CYYZ arrivals and departures are recorded automatically while the network session is active. No retrospective history is downloaded. Recording ends when the connection ends.

In **Pilot Feedback**, refresh the aircraft list and select a callsign/session. Describe the issue in your own words; the system does not guess what the pilot did wrong. Optionally enter the UTC incident time, instructions/readbacks with their timing, and your own controller context. Generate the report, then save its Markdown or export its complete evidence JSON.

The factual report is generated offline by a local evidence-analysis engine. It includes every usable selected-aircraft snapshot, assigned-data changes, numerical movement summaries, the closest recorded same-session YYZ traffic, and time-linked controller review prompts. Optional Ollama AI adds a clearly labeled interpretation using a bounded subset of evidence and your context. It does not establish intent, blame, a separation violation or compliance with spoken instructions.

## EuroScope log import

Click Import EuroScope log. The start date is inferred from EuroScopeYYYYMMDD.txt or can be entered explicitly. The log clock is treated as UTC; verify the date/clock if the original recording used another time zone. Midnight rollovers are handled. Import requires flight-plan messages identifying CYYZ origin/destination and pilot-position messages. Only flight metadata and movement are retained. Authentication entries, identities, flight-plan remarks and chat are discarded. The original log is never modified or bundled with a release.

Imported histories are kept in this app's user-data FeedbackImports folder, separate for production/test, and appear even without a live EuroScope connection. Missing early flight-plan context is backfilled and labeled. Ground track is derived from successive positions. FSD altitude datum is unverified; assigned clearances, scratchpad/SFI and radio messages are not reconstructed from this importer.

## Local AI setup

Use Get Ollama for Windows to open the official installer page. Install/start Ollama, then Check local AI and Download Qwen3 4B (approximately 2.5 GB). Select the installed model and enable Include local AI pilot and controller debrief before generating a report. Setup requires an Internet download; incident analysis uses only http://127.0.0.1:11434. Cloud model names and remote-model metadata are rejected. No fallback sends data to a hosted service.

The model runs on demand, with keep_alive=0 and an explicit unload request after completion/failure. It can use substantial RAM/GPU/CPU during generation. Cancel AI retains the factual report. Failure to connect also retains the factual report. Model output is fallible; evidence references are checked against the supplied sample IDs, but that does not guarantee that its interpretations are correct. The complete factual timeline and export remain available alongside the AI's explicitly subsampled context.

Telemetry includes position, pressure altitude, ground speed/track, vertical speed, reported headings, position age, route/runways, clearance flag, scratchpad, assigned altitude/heading/speed/Mach/squawk, flight metadata and tracking controller. Radar samples are limited to about one per five seconds; assignment and flight-plan changes create additional state snapshots. Radio audio and transmissions are not captured or transcribed by this feature. Assigned speed is not compared directly with ground speed, nor is magnetic heading compared directly with ground track to judge compliance.

Files are stored in the active plugin folder's **FeedbackTelemetry** directory, separately for test and production. Each file covers one aircraft in one network session. All history is retained locally until manually removed; monitor disk usage. Reports and evidence leave the computer only if you share an exported file yourself. Test-source publication snapshots never include runtime telemetry or reports.

Incomplete final records from a still-writing file are skipped. Other corrupt records are counted. Reports have explicit file/session size limits (64 MB per history, 250,000 snapshots across the session), and fail rather than silently discard excess evidence. Nearby traffic context excludes stale positions and does not include non-YYZ flights or replace a full separation assessment.

Live-network accuracy still requires user testing with the updated DLL. Test with a known flight and verify the route, times, assigned fields and movement before using the report for feedback.
