# ZYZTools architecture

- `src/ZYZToolsPlugin.cpp`: one `CPlugIn`, one export pair, flight-plan/runway/PDC state, Hoppie worker, UI action routing, ZYZTools test app launch, and a fallback composite `CRadarScreen`.
- `electron-app/`: primary Electron settings app. It edits the plugin JSON and installs/updates the EuroScope DLL payload through its Install / Update EuroScope Plugin button.
- `tools/PDCBridge/PDCBridge.cpp`: native singleton bridge for normal EuroScope chat delivery only.
- `tools/AudioReplay/AudioReplay.cpp`: native WASAPI rolling-buffer helper restricted to the TrackAudio root process and its Electron audio-service children; no system-output fallback.
- `PreferredCYYZPdcPlugin.json`: sole operational source of truth for Hoppie settings, operation selection, SID assignments, audio replay settings, and the linked Electron app path.
- `installer/`: Electron app setup build output, with native payload files embedded as Electron extra resources.

Hoppie HTTP polling occurs on a joinable worker thread. The worker never calls the EuroScope SDK. It queues response text, and `OnTimer` parses/applies it on the EuroScope callback thread. Manual click sends remain immediate.

The runway calculator produces the recommended SID/runway assignment. Preview and send selection preserve any runway already assigned in the route or EuroScope departure-runway field, compare it against that recommendation, and mark a mismatch as NCD. The route is amended only when no runway is assigned. After clearance receipt, the PDC identifier is removed and a non-conforming departure retains the plain `NCD` scratchpad marker.

The Electron settings app is the main UI. `.UI` / `.SETTINGS` launches the linked app path from JSON or the standard installed app location. If the app cannot be found, the radar-screen console remains available as a fallback and still dispatches to the CURRENT, VATCAN, and CPP native renderers. Shared theme metadata continues to drive fallback modals, native text editor, controls, and PDC status tag colors.

Statistics sessions follow EuroScope's network connection type. Flight-plan clearance transitions, ground-state updates, and correlated radar-target transitions feed a deduplicated per-aircraft state machine. Completed sessions are automatically written as SpreadsheetML workbooks beside the plugin, containing summary, event-level, and 15-minute bucket worksheets.
