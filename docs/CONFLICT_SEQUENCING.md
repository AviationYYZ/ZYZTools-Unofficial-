# United conflict alerts and arrival sequencing (test build)

The former CZYZ Conflict Alert 1.0.4 engine is compiled into the existing ZYZTools DLL. There is one EuroScope CPlugIn instance and the normal ZYZTools initialization/export. No second conflict DLL is installed. PDC, runway assignment, replay, statistics, themes, updates and Discord remain separate modules of the same app.

## Setup

1. Close EuroScope and install this local test build.
2. Use Install / Link in the test app to update its matching EuroScope plugin.
3. Unload the separate CZYZConflictAlert DLL in EuroScope. The united module pauses while it detects that old DLL, preventing two tag hooks and duplicate alarms.
4. Open .UI and choose Conflict & Sequencing. Enable alerts, optionally enable SiTu decoration, choose arrival airports and save.
5. For inbound/exit list warnings, change only the ACID display item provider to ZYZTools test / CA Callsign (ZYZTools in production). Retain existing left/right click functions. Allow drawing on the Standard ES radar screen.

The installer copies legacy conflict supporting configuration/tables/sounds from the sibling CZYZConflictAlert folder only when the destination lacks them. It never overwrites existing custom copies or loads the standalone DLL. Fresh installations include synthesized caution and urgent tones; choose custom WAVs in the new tab. Existing standalone files and profile settings are not deleted.

## Existing behavior retained

The original engine, vector hysteresis, sector runway lookup, route speed limits, wake tables, numeric cleared-altitude level-off and dual correlation checks are retained. Minimum separation is 3 NM / 1,000 ft, with five-minute early warnings and 45/30/15-second escalation. Both targets must be eligible. VFR, stale, uncorrelated, approach-cleared and below-2,000-ft targets are excluded. Tag/list decorations and alert-owned audio cleanup remain native. Live testing after a SiTu update is still required because its DrawText import adapter is version-sensitive.

## Sequencing

Choose the aircraft to put first, the aircraft to follow, and optionally a common merge waypoint. In the pictured situation, select the southern aircraft first and eastern aircraft second. By default both tags must be owned by you. Analysis can be permitted for unowned pairs by clearing that option; recommendations never change anyone's flight plan.

The initial solver supports fresh correlated IFR arrivals to the same airport with existing forward route geometry. It tries shortcuts to later waypoints already in the leader's route and follower IAS reductions of 10–40 knots when a usable IAS reference exists, without suggesting below 170 kt. It does not invent downwind coordinates from a screenshot, propose arbitrary vectors or depend on cloud/local AI.

Candidates use bounded turns (up to 3 degrees/second), a ten-second communication/response delay, aircraft altitude intent and the original conflict/wake model. They must reach a shared fix within five minutes in the requested order, with a time gap based on required spacing plus ten seconds. Both changed trajectories are checked against every other eligible target's intent prediction and current short-term track. A candidate that conflicts with a third aircraft is rejected. More than 120 targets suppresses recommendations rather than silently omitting targets.

Results show the proposed shortcut/speed adjustment, merge fix, approximate arrival times, gap and route saving. Updates run approximately every five seconds. If no modeled solution exists, geometry is missing, data is stale or a current separation loss already exists, no shortcut recommendation is issued. The model does not validate terrain, weather, restricted airspace, published procedure legality, coordination or aircraft performance; the controller must do that before issuing any clearance. Approach-cleared/below-2,000-ft traffic is outside this model, not guaranteed clear. These are simulator advisories, not certified separation assurance.

## Native operation and data

The app provides controls and displays native snapshots. Alerts and analysis continue when the settings app is closed. Settings are stored beside the matching plugin in ZYZToolsConflict.ini; snapshots in ZYZToolsConflictStatus.json are discarded by the UI when older than 15 seconds. Test and production use their separate plugin directories. No aircraft data is sent to AI or an external service by this feature.

## Tests and remaining acceptance

Run tools/Test-Conflict.ps1 for the original 60 engine scenarios, native drawing/hook attach-detach tests and new sequencing scenarios (southern shortcut before eastern traffic, third-aircraft blocking, no mutation, bad geometry, stale/correlation/altitude/approach exclusions and load limit). Run the Electron conflict settings test for settings round-trip and stale snapshot rejection.

Automated checks cannot substitute for a EuroScope playback acceptance test. Verify moved SiTu tags, list click actions, sound escalation, a genuine selected pair, no recommendations during a current loss and route changes before relying on this simulation aid.
