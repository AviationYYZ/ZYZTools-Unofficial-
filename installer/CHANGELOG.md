# Changelog

## 1.2.68 / server 0.4.16

- Simulated arrivals continue straight at the downwind discontinuity instead of flying the filed base turn. Runway-aligned approach fixes require an explicit direct-to, one fix at a time. Filed routes are unchanged; an instructor can still vector aircraft or clear them for ILS capture.

## 1.2.67 — Local test, awaiting approval

- CA tags use only the affected aircraft's filed route fixes within an inclusive 3 NM of the predicted loss midpoint. No unrelated sector fix or coordinate fallback appears in the tag. A small yellow radar dot marks the actual predicted point, once per pair; approach suppression removes both labels and dots.
- Both short-term and five-minute scans account for route turns, assigned vectors/directs, speed/Mach and altitude level-offs. Private instructor telemetry supplies actual remaining/filed route geometry and pilot targets rather than student annotations. Predictions refresh each scan; stale early warnings are not carried through a changed instruction.
- Removed sequencing/recommendation controls, order selection, AI sign-in/request IPC, native recommendation execution and compiled sequencing implementation. Conflict alerts and settings remain. Historical helper source and existing encrypted credentials are preserved, but retired AI modules are excluded from installed app code.
- App/plugin update only; server 0.4.15 remains compatible. Local tests only; nothing published.

## 1.2.66 — Local test, awaiting approval

- Server 0.4.15 owns each slot's speed profile in servers.json. Configure from the server dashboard or paired instructor panel before import or while running; imports cannot override it, and reset/restart retains it. Existing saved server/scenario settings seed the profile once on migration. Scenario files no longer control the server profile.
- A climb ALT instruction while approach guidance is active now cancels that guidance, holds present heading and climbs to the assigned altitude. Prevents completed-route deletion during go-around; manual IAS/Mach overrides remain unchanged.

- Replaced the quick-value/chip editor with independent numbered Name/Value slots per category, matching the speed-until editor. Twelve available slots per category; altitude defaults 080/060/070/050/040/030. Existing custom quick values migrate without deleting their old file. Each category's slots appear only in its own native dropdown.
- IAS dropdown includes six dynamic speed-until slots, defaulting to 24R/170/NOAHA, 24L/170/KIREX and 23/170/OMTOK. Added six crossing-altitude Name/Altitude/Waypoint slots in the altitude dropdown.
- Native dropdown list scrolling is wheel-driven: hover/drag edge scrolling, auto-scroll timers and scrollbar scrolling are blocked in our own list. Plain clicking still selects an item; EuroScope/Situ windows are not subclassed.
- CA tags show a predicted conflict point near a sector fix, or distance/direction from the Toronto reference when no fix lies within 5 NM. Labels use the predicted loss-of-separation midpoint and respect all existing approach suppression. Both our pilot tags and the Situ adapter receive labels.
- New Challenge D retains 65 hourly arrivals and five deliberate VERKO merges, but all five streams start within 20 seconds. Origins and airline types match the entry direction. Original compact STAR notation, speed profile, 15NM entry, bedpost/SFI/instructor ownership rules retained.
- Update app/plugin 1.2.66 and server 0.4.15 for all changes above. Local testing only; nothing published.

## 1.2.65 — Local test, awaiting approval

- Private instructor conflict scans use fresh authenticated simulator telemetry instead of depending on EuroScope radar/flight-plan correlation being available. Public/live radar scans retain strict SDK correlation checks. Status identifies the active data source; user enable/mute settings remain unchanged.
- Suppress conflicts involving either aircraft cleared for approach in the actual private simulator state or Situ's ILS/visual cleared-altitude status. Exclusion applies to current, predicted, wake and cached/displayed alerts. Cancel restores eligibility.
- Added VERKO Challenge C: 65 arrivals, prior west-flow/SFI/15NM/bedpost/instructor-ownership rules, new callsigns and the screenshot's speed profile embedded explicitly. Native replay verifies all five deliberate pairs alert, and approach suppression works.
- Saved the supplied profile in project instructions for future generated scenarios. No server update required; nothing published.

## 1.2.64 — Local test, awaiting approval

- Quick-control preset editor now has explicit Add buttons and individual removable choices. Adding/saving a second preset preserves the first, including when saving directly without pressing Add. Existing saved presets load unchanged.
- Partial category saves preserve other categories instead of resetting them to defaults. Inputs remain disabled until initial loading completes, and during saves.
- Presets remain in their respective native dropdowns. No server update required; nothing published.

## 1.2.63 — Local test, awaiting approval

- Added configurable quick choices for every instructor control category, with useful defaults and up to 12 choices per category. Edit under Instructor > Scenario and session > Speed restriction presets > Quick control presets. Native tag and list dropdowns open at the top, with the full choices retained below.
- Squawk now offers saved choices and custom entry; Advanced exposes vertical-rate choices and cancel approach. Existing named IAS-until-fix presets remain separate.
- Radar tag navigation now uses left-click direct waypoint, right-click heading. List bindings remain unchanged. Server 0.4.14 remains compatible; nothing published.

## 1.2.62 — Local test, awaiting approval

- Native EuroScope All Aircraft list can be reopened from an instructor tag's Advanced menu or `.aircraft`. It retains native profile styling and independent actual/pilot-target columns, without modifying Situ or student annotations.
- Corrected list-opening instructions: no QUICK SET Aircraft lists submenu is required. Server 0.4.14 remains compatible.

## 1.2.61 / Server test 0.4.14 — Local test, awaiting approval

- Automatic jet speed bands use the instructor's pilot target altitude before approach clearance, excluding student CFL annotations. ALT/profile changes immediately update the IAS target without jumping actual IAS.
- APP CLEAR switches the profile to current altitude immediately, even before capture; APP CANCEL restores assigned-target logic. Manual IAS/Mach and speed restrictions retain priority. Speed status identifies the reference basis/altitude.
- Student invites now open a mobile-friendly pilot dashboard with live actual/target data, equivalent dropdown controls, restrictions/browser preset slots, route plot, confirmed deletion and normal handoffs. Invite holders can control all active aircraft, including queued orders while the host is paused, but cannot administer sessions/servers or load scenarios. Credentials remain memory-only; browser presets are separate non-secret preferences.
- Recalculated the separate 10NM-spacing exercise's injection intervals for the new default speed behavior. Hourly-rate/15NM-entry scenarios retain their schedules.
- Local test builds only; nothing published.

## 1.2.60 — Local test, awaiting approval

- Independent instructor All Aircraft EuroScope list, explicitly populated from authenticated active simulator targets without sector/facility/ownership/radar-view filters. Auto-opens on private instructor binding; cleans up on deletion/disconnect/reset.
- Preconfigured actual ALT/IAS/HDG plus independent pilot-target columns, blue targets/green student-match indicators, direct/Advanced controls, route/handoff, actual owner, next fix and SFI. Existing list/profile settings are not edited.
- Server 0.4.13 stays compatible. Local test build only, nothing published.

## 1.2.59 / Server test 0.4.13 — Local test, awaiting approval

- Heading dropdowns in tags/lists offer custom 000–360 magnetic entry and Fly present heading. Present heading is sampled at execution on the server, not from stale radar data; numeric targets retain student-match checks.
- Six named IAS-until-waypoint preset slots in Instructor settings, persisted separately per app channel and applied from Advanced. Aircraft route validation and automatic release still apply.
- Synthetic localizer range extended to 35 NM. Capture tests cover 6,000 feet on 05/06R/23/24R and up to 10,000 feet on 23; capture does not climb onto the beam or force an above-beam dive. Dashboard displays waiting/above-beam status.
- Local tests/builds only. No live-network connections or GitHub publication.

## 1.2.58 — Local test, awaiting approval

- Registered instructor list click functions for altitude, IAS, Mach, heading, direct waypoint and Advanced. Bind these to columns in Sector Inbound/Exit lists in the dedicated instructor profile.
- List and radar controls share the same bounded dropdowns, captured aircraft/session context, command bridge and student matching. Existing list data providers and student annotations stay unchanged; no live profiles are edited.
- Server 0.4.12 remains compatible. Nothing published.

## 1.2.57 / Server test 0.4.12 — Local test, awaiting approval

- Instructor-owned variant of the 65/h 15NM SFI scenario. The paired app registers its connected instructor EuroScope through the authenticated instructor API; the first student login is never used to guess that role.
- Initial active aircraft and delayed spawns receive real, globally shared tracking ownership once. Normal handoffs, accepted ownership transfers and explicit drops are preserved; no recurring forced owner override.
- Optional scenario flag round-trips through exports. Older scenarios remain unowned by default. Local test builds only; nothing published.

## 1.2.56 / Server test 0.4.11 — Local test, awaiting approval

- New 65/h west-flow scenario retaining 15 route NM entry and bedpost targets, with fleet-matched fictional airline callsigns/types and Situ SFI scratchpads (N for 23, R for 24R).
- Optional initial scratchpads survive validation, scenario load/reset, delayed spawning and late joins; old scenarios retain their empty defaults.
- Local test builds only; nothing published.

## 1.2.55 / Server test 0.4.10 — Local test, awaiting approval

- App altitude/IAS band editor for automatic jet profiles: local scenario export and remotely persisted per-server-slot changes, validation and default restore.
- Callsign left click toggles EuroScope route drawing; right click opens its handoff menu. Squawk and IDENT moved to Advanced; squawk assignments are no longer drawn.
- Instructor tags display the existing correlated conflict-alert stages and urgent flashing without changing detection thresholds.
- Speed restrictions release by actual fix passage on vectors/ILS despite unsequenced STAR fixes; expired blue targets disappear. Clearing restrictions returns to automatic speeds, not a previous manual override.
- Aircraft automatically disconnect/delete at touchdown or filed-route completion; vector-only aircraft remain and approach traffic stays until touchdown.
- Local test builds only; nothing published.

## 1.2.54 / Server test 0.4.9 — Local test, awaiting approval

- Three-row instructor tags based on the user's numbered reference: altitude on either click, IAS/Mach, heading/direct, callsign squawk/ident, aircraft-type Advanced menu. Blue targets and green student checks retained.
- Actual aircraft data remains visible beside targets. Altitude targets and dropdowns use compact three-digit levels (080 = 8,000 feet), without a C prefix. All instructor selection lists have dark-gray rows and compact scrolling.
- Advanced offers confirmed aircraft deletion, queued IAS-until-fix and crossing-altitude constraints, plus clearing active restrictions. Constraints are route-validated, pause/reset safe, and never teleport aircraft.
- Simplified common jet altitude-based IAS schedule; retains non-jet performance data, explicit manual overrides, five-second radar samples and stopped-aircraft protection.
- Sharp rolling turns retain fly-by guidance until the outbound track is recovered, including the higher-speed LINNG corner regression.
- The bundled 10 NM spacing scenario's spawn intervals were recalculated for the changed default jet speeds; hourly-rate scenarios retain their schedules.
- Local-only builds; no GitHub publication or live-network connections.

## 1.2.53 / Server test 0.4.8 — Local test, awaiting approval

- Use CSiT's EuroScope font, normal beige/orange palette and live callsign/altitude/vertical-motion/GS/type/destination rows. Add live IAS, heading, next fix and squawk. Only instructor-selected values are blue; matching student annotations keep green checks. No Situ DLL/profile edits or fake ownership.
- Consolidate to four click zones. ALT left: whole-thousand altitudes or cleared approach. IAS left/right: IAS/Mach. HDG left/right: heading/direct-to, including typed waypoint entry. SQ left/right: squawk entry/IDENT. Remove redundant RATE, DCT and APP tag buttons; command-centre rate controls remain.
- Replace paginated SDK menus with compact native scrolling dropdowns (eight visible rows), no Next/Previous entries. Add real Mach speed control with altitude-dependent TAS/IAS and student Mach confirmation. Fixed five-second position updates remain. Native hidden-window dropdown and matching/Mach regression tests added. Nothing published; actual EuroScope integration still needs user testing.

## 1.2.52 — Local test, awaiting approval

- Reduce instructor tags from 348×66 to 204×48 pixels and font height from 14 to 11. Compact the header and approach label, shrink confirmation markers, and use shared dimensions for drawing, dropdown hitboxes, dragging and radar-edge clamping. Blue orders and green student-match checks remain unchanged. Server 0.4.7 remains compatible; no server update required. Nothing published.

## 1.2.51 / Server test 0.4.7 — Local test, awaiting approval

- Replace the selected-aircraft pilot strip with independent, draggable, Situ-inspired instructor tags beside all visible active training aircraft. Blue pilot orders persist in the data block; all seven fields use paginated dropdowns. Regular Situ drawing, annotations and ownership remain untouched.
- Add student-authored annotation provenance. Green checks indicate matching ALT/IAS/HDG/RATE/DCT/SQ/APP annotations, never maneuver completion. Checks clear on mismatch, failed/pending orders, session reset or annotation-author disconnect. Instructor-authored annotations do not confirm their own orders; when another controller owns the track, their annotation is required.
- Scope pilot orders and menus to the authenticated instructor socket/session. Add native shared drawing harness and synthetic two-client matching/menu tests. Fixed 5-second aircraft updates and 2,250 FPM default remain. Update desktop, instructor DLL and private server; real EuroScope dropdown/drag testing remains for user verification. Nothing published.

## 1.2.50 / Server test 0.4.6 — Local test, awaiting approval

- Replace coupled regular-tag pilot controls with a separate, selected-aircraft ZYZTools PILOT strip. Middle-click ALT/HDG/IAS/RATE/DCT/SQUAWK to enter a value, or APP CLR to arm the approach. Pilot requests use independent authenticated command data, including identical values already annotated by the student.
- Remove instructor fake-ownership injection and automatic assumptions. Both clients receive real ownership after handoff; pilot controls remain independent of tracking. All regular Situ tag/scratchpad edits are shared annotations, never pilot commands. Situ remains unmodified.
- Lock position publication to every 5 seconds, disable rate selectors and migrate legacy rates. Keep continuous physics and no command-triggered extra samples. Update instructor DLL, desktop and server. Local protocol tests and SDK build pass; actual EuroScope middle-click UI verification remains for user testing. Nothing published.

## 1.2.49 / Server test 0.4.5 — Local test, awaiting approval

- Handle classic $HO/$HA handoff offers/acceptances and WH/IH ownership queries, DR track drops, cancellation/refusal and late-join ownership. Instructor connector announces genuine ownership for initially unowned aircraft, without stealing student-owned tracks. Keep private pilot-control access after a handoff.
- Reassert the private instructor tag-access view after student metadata and restores; repair reconnect/session overlay registration. Restoration suppression now only filters matching restored values, not a subsequent different instructor command.
- Share ordinary instructor scratchpad notes (and clearing) with students. Typed heading/speed/rate/fix pilot-control messages remain private and restore after about three seconds. Update desktop plus private server. Nothing published; actual Situ UI verification remains for user testing.

## 1.2.48 / Server test 0.4.4 — Local test, awaiting approval

- Default missing/new-aircraft vertical rate is 2,250 FPM. Named initial descents retain the selected rate rather than continually replacing it with a calculated rate. Explicit saved rates and manual RATE commands remain supported; captured ILS glidepaths retain their own guidance.
- Import companion navdata/isec.txt and icao.txt plus airway endpoint coordinates. Resolve omitted route/spawn fixes offline, retain sector coordinates as authoritative, reject ambiguous names, and embed used coordinates in portable scenarios. Re-import the SCT once to refresh the old catalogue.
- Add synthetic west 65 arrivals/hour, east 40 arrivals/hour plus 10 airborne runway-05 departures, and a separate west 10-NM-entry-spacing exercise. See scenarios/README.md for the rate/spacing tradeoff and setup. Nothing published or connected to public networks.

## 1.2.47 / Server test 0.4.3 — Local test, awaiting approval

- Private instructor assigned-data controls alongside unmodified VATCAN Situ: altitude, IAS, magnetic heading, rate, direct-to and actual squawk. Match an SDK edit with its outgoing annotation before commanding; filter annotations before transport and restore the latest student annotation after roughly 3 seconds without undoing maneuvers.
- Private instructor-only ownership view for tag access, separate from student tracking. Add distinct controller presence, late-join state, handoff offer/accept/recall and disconnect cleanup. Use unique sector-defined callsigns and dummy credentials only.
- Includes paused 1.2.46 rate/PTL work. Native mode stays removed. See docs/INSTRUCTOR_TAG_CONTROLS.md for setup and limits. Nothing published; full Situ UI verification remains for user testing.

## 1.2.46 / Server test 0.4.2 — Local test, awaiting approval

- Configurable 1/2/5 Hz aircraft position publication; balanced 2 Hz default. Hosted rates persist per slot and change live through Instructor or server dashboard. Local rates travel in scenario JSON. Simulation physics/time and flight-plan refresh remain independent.
- Add optional selected-aircraft ZYZTools training prediction line, using reported true heading and groundspeed rather than timestamp-derived velocity. Off by default; 1/2/3/5/10 minute choices, cyan dotted line and minute marks, scoped to the verified instructor simulation. Existing external PTL plugins remain untouched.
- Retain 1 Hz compatibility fallback. EuroScope's own redraw limits and third-party plugin compatibility need user verification. See docs/TRAINING_UPDATE_RATE.md. Nothing published.

## 1.2.45 / Server test 0.4.1 — Local test, awaiting approval

- Remove experimental native EuroScope mode, its profile/scenario exporter, relay, launch buttons and engine selector. All saved server slots use ZYZTools simulation again; scenario files, names, autostart preferences and instructor pairing settings remain intact.
- Preserve the graphical scenario builder, private three-slot hosting, mobile dashboard and instructor EuroScope command bridge. EuroScope is no longer required on the server PC. Clients use normal direct/private connections with Connect to VATSIM unchecked, not native simulator sessions.
- No publication or automatic installation. The separate non-native runway-route mismatch report remains under investigation; this build does not claim to fix it.

## 1.2.44 / Server test 0.4.0 — Experimental local test

- Keep the graphical scenario editor and client scenario uploads. Add an independent native EuroScope or ZYZTools engine choice for each private server slot.
- Native mode generates dedicated local profiles and resolved scenario files, launches installed EuroScope without connecting, and separates instructor control transport from read-only student transport. No VATSIM/public SweatBox connection.
- Native controls required manual private server-PC setup and end-to-end user verification. This experiment was subsequently removed in 1.2.45 / Server 0.4.1. No publication authorized.

## 1.2.43 / Server test 0.3.3 — Local test, awaiting approval

- Automatic speed profiles are the default even for old scenarios containing legacy publishedSpeeds:false. New explicit automaticSpeeds:false remains available through the aircraft editor. Live IAS commands still override automation until SPEED PUBLISHED; reset returns to the saved scenario policy.
- Bundled 447-type MIT EuroScope performance database from VATSIM, pinned at 6dcc431a07e41a83450ac72a0f141b8a8f29b9e1 (SHA256 4dbc5583ea2110a0b7ecf1a8131282a3f72cd2bb183198483fccce8737e01d41). Type/phase/altitude speed interpolation and Mach conversion sit below the requested 270/250 IAS ceilings. Unknown types have an explicit generic fallback. Automatic spawns initialize at their computed target, not obsolete filed/initial cruise speeds.
- Downwind slowing can apply at terminal altitudes up to 12,000 ft. On captured approach, anticipatory 180/160/final gates at 12/7/4 NM replace the old permanent 210 target. Final IAS defaults are training assumptions (not real Vref), configurable in scenario finalApproachIAS. Ground/touchdown never accelerates automatically. Manual IAS minimum now 50 for light-aircraft training.
- Imported named REQALT and legacy $ROUTE initial descent targets. The initial descent attempts to meet the fix using remaining route distance and bounded generic rates; impossible targets are reported. Manual ALT replaces the initial target; RATE stays authoritative. Empty-fix takeoff/climb targets, full slash-altitude/STAR vertical profiles and custom PERFAC/PERFLINE overrides remain unsupported and reported, not guessed. Off-route REQALT is omitted with a review warning rather than dropping the aircraft; malformed fields are rejected explicitly.
- Update both desktop and hosted server engine. No GitHub push, release upload or cloud deployment authorized for this new change.

## 1.2.42 / Server test 0.3.2 — Local test, awaiting approval

- Replaced chart-based automatic speeds with a training-only IAS profile: 270 above 10,000 ft, 250 at/below (including the unspecified 5–10k band), 210 before a planned downwind turn. Assigned IAS still overrides it; SPEED PUBLISHED resumes it. Runway geometry identifies reciprocal downwind legs/vectors. Immediate vectors initiate deceleration, not instant speed changes. Stationary aircraft remain stationary.
- Faster roll-aware turn rollout removes the old long widening tail. Physical TAS/bank limits and directed turns remain; regression coverage includes outbound overshoot and localizer capture.
- Sharp route corners now predict the same rolling turn model used by aircraft, rather than clipping all turn angles to 150 degrees. Actual LINNG scenario regression includes its approximately 172-degree near-reversal at YZDW06 as well as the downwind-entry turn; insufficient leg space is reported rather than claiming an impossible turn will fit.
- Legacy import reports repairs for invalid/duplicate squawks and an exact missing-first-character flight-plan callsign typo. ARR - 06 Hard now imports 44/44 instead of 35/44. Originals are not modified. Other unsupported/ambiguous records still require review, not silent invention.
- Directed flight-plan replies and missing assigned-squawk query responses improve correlation. No periodic flight-plan spam. Added altitude-filter warning: installed Arrival06 hides above 24,500 ft while this scenario includes 28,000-ft spawns; this is independent of importer success.
- Corrected delete-pilot disconnect packets: the second field is now a numeric local certificate ID, not SERVER. Delete removes the runtime aircraft before broadcasting; reset/stop use the same encoding. Verified delivery across real TCP + authenticated HTTP transport and no later position updates; actual EuroScope renderer removal still requires user validation.
- Up to eight comma-separated commands in one message, e.g. .LHDG 330, ALT 3000. Full batch validation is atomic; a bad instruction applies none. DELETE remains standalone. Applies to local, remote panel and native instructor bridge, with existing role/session safeguards.
- Mobile shared web panel: aircraft cards on small screens, touch-sized controls, responsive flight-plan fields, tap/keyboard selection, jump-to-controls and compact expandable fixes/log. Student read-only role and memory-only credentials remain unchanged.
- Update desktop app plus DLL and hosted server engine. No GitHub publication or cloud deployment.

## 1.2.41 — Local test, awaiting approval

- Added instructor-only shorthand: .ALT, .RATE, .SPD/.IAS, .HDG/.LHDG/.RHDG, .DCT, .APP, .PAUSE, .IDENT, .SQ, .MODE, .SPEED, .ROUTE and .DELETE. The .sim namespace/help remains compatible.
- Exact verb boundaries and existing ZYZTools/conflict/configured replay priority avoid claiming unrelated commands. Shorthand requires a direct, verified local instructor training socket/context; backend instructor/session/peer checks still apply. External-plugin dispatch order remains host-dependent.
- Client app plus installed DLL update required; server 0.3.1 unchanged. Nothing published.

## 1.2.40 / Server test 0.3.1 — Local test, awaiting approval

- EuroScope ASEL selection follows into the instructor dashboard. Added `.sim` command-bar instructions for the selected simulated aircraft with asynchronous applied/error acknowledgement.
- Require the plugin process's actual loopback training TCP connection, matching connector peer/controller, active instructor pairing, connected slot/session and ephemeral channel-private capability. Student/live/playback/stale requests cannot route through this adapter; no live-aircraft amendment path is added.
- Approach clearance while turning preserves the last assigned vector until rollout; straight-in/route approaches without a pending vector still capture normally.
- Both the desktop app and its installed DLL must be updated for EuroScope commands. The new approach behavior also requires server 0.3.1. No cloud deployment or GitHub publication.

## 1.2.39 / Server test 0.3.0 — Local test, awaiting approval

- Unified physical TAS/turn-radius calculations, gradual bank changes and earlier roll-aware route fly-bys. Generic bank/rate assumptions remain explicit, not claimed aircraft-specific EuroScope performance parity.
- Anticipatory localizer capture and damped tracking, including late-clearance recovery. Heading vectors retain armed approach clearance; explicit APP CANCEL cancels. Glideslope capture still requires lateral alignment and a below/near-beam intercept.
- Native SweatBox import prefers arrival-end runway suffixes. Canonical destination/runway is last in emitted routes; announce position before initial flight plan to prevent runway/plan loss in clients that do not yet know the aircraft.
- Added confirmed live Delete selected aircraft in local and instructor dashboards; broadcast removal without affecting other aircraft. Reset/reload restores the initial scenario.
- Both client and hosted engine installers are required. No cloud changes or GitHub publication.

## 1.2.38 — Local test, awaiting user approval

- Import EuroScope SweatBox TXT in Scenario Builder and instructor uploads, with mandatory compatibility review. Preserve flight plans, explicit navigation, START minutes, squawks and ILS geometry; reject missing fixes and ambiguous/duplicate records. Original scenario files are not modified or redistributed.
- Report unsupported simulation features. Ground traffic is stationary, not a taxi/takeoff model; altitude instructions/holdings/performance/response-delay directives are not executed. Airborne speed defaults are explicit approximations, not full EuroScope performance compatibility.
- Added Connect my EuroScope for the instructor's selected server. Automatically obtain the session transport key, prepare the existing connector and copy its local address; require non-VATSIM EuroScope setup with dummy credentials and a unique callsign. Do not replace an active local server/connector.
- Server 0.2.0 remains compatible. No server rebuild, cloud deployment or GitHub publication required.

## 1.2.37 — Local test, awaiting user approval

- One private instructor pairing controls all three server-PC slots from the client: upload local scenarios, start/run/pause/reset/stop, aircraft dashboard, manual commands, flight-plan amendments and Copy student invite. ZYZTools Server test 0.2.0 keeps all simulation on the spare PC.
- Separate instructor authorization from server-hosted student access. Student keys cannot manage servers or manually command aircraft; EuroScope controller edits remain available. Validate uploads before replacement; reject stale/duplicate/conflicting instructions.
- Organized Training into Student, Instructor and Local practice views, collapsed optional local sharing/help, and retained Scenario Builder separately.
- Removed the training AI-pilot bridge, ChatGPT/Windows readbacks, check-ins, speech helper and pilot-plugin package/IPC. Unrelated conflict-sequencing AI is unchanged.
- Instructor pairing may be remembered only with explicit Windows-encrypted opt-in. Scenario changes do not require re-pairing; restarting the server app/recreating the management tunnel can. No backend deployment, GitHub publication or billing changes.

## 1.2.36 — Local test, awaiting user approval

- Added connection-code joining alongside existing private invites in Training. The fixed Cloudflare directory validates short codes and managed session URLs; credentials are not logged.
- Added a separate ZYZTools Server test 0.1.0 installer for a spare Windows PC: three process-isolated scenarios, independent clocks/controls, private tunnels and directory heartbeats, per-slot pause/run/reset/stop, copied scenarios and bounded logs.
- Optional startup after Windows sign-in and per-slot paused autostart. Worker crash recovery is bounded and restarts only the affected scenario from the beginning, paused; no claim of aircraft-state restoration or tunnel uptime guarantee.
- Verify the public session before advertising its code. Clean up only owned helpers, revoke/expire codes on shutdown, keep host administration local, and preserve non-VATSIM loopback-only FSD transport.
- Build installers outside OneDrive to reduce sync/indexing load. No GitHub publication or account/billing changes.

## 1.2.29 — Local test, awaiting user approval

- Preserve dirty aircraft edits on selection change, Start and Export; clear stale spawn fixes when coordinates change. Added regressions for delayed/separate spawns and reset.
- One filed route now drives navigation. Import adjacent ESE procedures and airway navdata, expand runway-specific STARs/airway segments, reject missing/ambiguous items and preserve portable compiled fixes. Added anticipatory fly-by turns and outbound guidance.
- Added individual pause/resume, assigned IAS, published-speed resume and simulated ILS approach clear/cancel. Strip/route runway assignments select the centreline; glidepath capture is from below/near the beam, not a dive from above. Generic 3-degree training approximation, not a certified approach database.
- Transcribed 59 runway-specific jet speed rules from the ten user-provided charts (effective 27 Nov 2025). Holding-only limits and 15/33-flow rules are not invented; missing coverage is visible. Current chart validity is not independently established.
- Added ChatGPT-own-voice readback mode and concise pilot skill with one post-readback maneuver call. Completion is an agent report, not a verified ChatGPT audio callback; four-second response/order cannot be guaranteed on every host. Windows verified playback mode remains optional. No paid API request, model-weight fine-tuning, VATSIM connection or publication.

## 1.2.28 — Local test, awaiting user approval

- Fixed pilot MCP discovery: portable packages use a bare Windows launcher and contained working directory instead of a rejected absolute executable. Added Set up / repair and Check pilot connection buttons; desktop-host discovery verified both tools.
- Replaced the clock-style spawn editor with explicit minutes plus seconds after Run. Added aircraft duplication, next-unused squawk and route-copy helpers.
- Removed periodic flight-plan retransmission that could reset EuroScope tags/dialogs. Added validated EuroScope $AM amendments, corrected filed altitude units to feet, stored controller metadata and announced initial assigned squawks separately from actual transponders.
- Added optional ASR layer selections, viewport and rotation over named SCT geometry, with sector colours and filtered fix labels. This preview does not reproduce EuroScope plugin overlays, custom fonts, regions or free-text rendering.
- Local protocol/UI/host tests do not establish end-to-end behaviour for every EuroScope build or ChatGPT voice mode. No VATSIM connection or publication.

## 1.2.27 — Local test, awaiting user approval

- Split Scenario Builder from the Local Training run/command centre. Added local sector-fix/map import, click/fix spawn placement, scheduled spawn times and portable used-fix coordinates.
- Added screenshot-style full flight-plan fields, explicit simulated-route preview/ETA estimates, isolated live flight-plan amendments and squawk/IDENT/standby controls.
- Added optional local ChatGPT pilot MCP/skill export with exact-callsign/bounded-command checks, duplicate/stale/manual-override gates and Windows spoken-readback completion before maneuver execution. No VATSIM control path or paid API call is added.
- Simulator/IPC/UI tests use synthetic traffic. Local-plugin installation and actual ChatGPT voice behavior require desktop-host verification; simplified performance, true-heading/TAS conventions and no automatic airway/STAR decoding remain explicit.

## 1.2.26 — Local test, awaiting user approval

- Fixed the training endpoint mismatch: EuroScope uses standard port 6809, not the old test port 6819. Test/production remain isolated using 127.0.0.1 / 127.0.0.2, with no public-network fallback.
- Start now shows progress, LISTENING/stopped state, ready/errors beside the button, aircraft count and credential-free connection activity. Empty scenarios can start with an explicit warning.
- Added one-click two-aircraft demo and clearer non-VATSIM connection instructions. Start disables while running/starting. No EuroScope executable patch or VATSIM authentication change.

## 1.2.25 — Local test, awaiting user approval

- Added Local Training: aircraft/waypoint scenario editor, portable initial-setup files, generic motion and ALT/RATE/SPD/HDG/DCT/ROUTE RESUME controls.
- Added a loopback-only classic-FSD traffic source with no outbound connection or VATSIM/SweatBox authentication. Test/production default ports are separate. Closing the app stops the source.
- Run, Pause, Reset and Stop controls; no automatic approach/landing, type-specific performance or STAR expansion. Native EuroScope client compatibility still requires an isolated local-session test.

## 1.2.24 — Local test, awaiting user approval

- Added Continue with ChatGPT for the documented plan-usage OAuth flow, with PKCE, signed identity validation, Windows-encrypted profile storage and serialized token refresh.
- Added saved account/workspace selection, account-specific model picker, usage settings link and local sign-out. API keys remain an explicit separate billing option; no automatic fallback.
- ChatGPT sequencing can revise once after all candidates fail native validation (maximum two rounds per manual request). No automatic clearances or background inference.
- Isolated OAuth, streaming, native-ack and UI tests use synthetic credentials. Account eligibility and actual plan-backed inference require the user's browser sign-in and live test.

## 1.2.23 — Local test, awaiting user approval

- Added manual OpenAI-assisted sequencing with structured proposals, anonymized traffic context, encrypted local key import, cancellation and explicit API-charge consent.
- AI maneuvers require current native validation; unsupported/unsafe candidates are rejected and accepted results expire. No automatic clearances.
- Expanded local sequencing to ten minutes, spatial merge matching, full forward-route shortcuts, first-fix vector rejoins and bounded delaying vectors, with rejection diagnostics instead of generic failure.
- Excluded environment/key files from packaging/publication and added a source-secret guard.

## 1.2.22 — Local test, awaiting user approval

- Merged CZYZ Conflict Alert 1.0.4 into the ZYZTools DLL, retaining native alerts, SiTu/list decorations, exclusions and audio.
- Added Conflict & Sequencing controls, live alert list and advisory selected-pair shortcut/speed analysis with third-aircraft conflict rejection. No automatic clearances or aircraft changes.
- Added default alert tones, legacy support-file migration and standalone-DLL duplicate protection. Both new features are opt-in.

## 1.2.21 — Local test, awaiting user approval

- Added opt-in Discord Rich Presence using the shared ZYZTools Application ID, with airport list, editable text/traffic thresholds, image asset and two configurable link buttons.
- APP/CTR positions use owned EuroScope tags; other positions estimate ground traffic from VATSIM and cached airport reference data. Disconnects, disabled status, stale data and app exit clear presence.

## 1.2.20 — Local test, awaiting user approval

- Added {controller_callsign} to both PDC template editors, using the current EuroScope controller identity at send time. Existing default messages are unchanged.

## 1.2.19 — Local test, awaiting user approval

- Essential startup updates now display a visible automatic update notice before downloading and closing the app, with a minimum display time and clear failure messages.

## 1.2.18 — Local test, awaiting user approval

- Added Operations-page PDC template editing for EuroScope/bridge and Hoppie TELEX, with insertable aircraft variables and original-format defaults.
- Added restore-defaults and template validation; invalid externally edited native templates fall back to the original message.

## 1.2.17 — Local test, awaiting user approval

- Removed the flight narrative and pilot feedback pages, local AI integration, log importing, and background aircraft-history recording.
- Existing saved logs, imports, reports, and installed local AI software are left untouched. Statistics and audio replay remain available.

## 1.2.8 — Local beta, awaiting user testing

- Simplified Advanced to Publish beta. Only one matching beta installer is needed, and the app finds it automatically in Downloads or beside the app when possible.
- Beta publication uses a beta branch and a GitHub prerelease; production source/releases remain separate.
- Added opt-in encrypted GitHub credential storage for subsequent one-click publications.
- Beta update checks now find beta prereleases rather than production releases.
- Added versioned beta installer names to make selection and sharing clearer.

## 1.2.7 — Local beta test, awaiting user approval

- Added a dedicated Appearance page with ZYZTools dark, VATCAN and Classic themes, immediate previews, selected-theme highlighting, and a save button.
- Theme preferences remain isolated between production and test apps.

## 1.2.6 — Local test, awaiting user approval

- Production ZYZTools and ZYZTools test now have different installer identities, executables, shortcuts, user-data folders, and single-instance locks, allowing both apps to remain open.
- Test plugin deployment, settings, recordings, statistics, bridge and replay endpoints are isolated from production.
- Test installation no longer auto-repairs the shared TrackAudio installation.
- Updates select the matching production/test installer; publication requires both matching installers and never substitutes a test app for production.
- Added separate production and test build targets. Neither artifact is published until approved.

## 1.2.5 — Local test, awaiting user approval

- Navigation highlights now follow the selected page instead of leaving Install / Link highlighted.

## 1.2.4 — Local test, awaiting user approval

- Renamed the project to ZYZTools and the test desktop app, executable, installer branding, and shortcuts to ZYZTools test.
- Renamed the EuroScope plugin display to ZYZTools and updated app discovery.
- New installers use ZYZTools-Setup.exe; legacy update assets and technical filenames remain supported for existing installations.

## 1.2.3 — Local test, awaiting user approval

- Moved Check for updates and its conditional install button to Advanced.
- Added a test-build Publish to GitHub action. User approval via that button pushes the bundled matching source snapshot and selected same-version installer, then publishes the release.
- GitHub credentials are requested only during publication and are never saved. Existing releases are not overwritten.
- The publishing panel hides once this version is publicly released.

## 1.2.2 — Local test, awaiting user approval

- Removed the GitHub repository URL field and preferences. Update checks always use the project's approved-release repository.
- The update area shows Check for updates; an install button appears only when a newer release is available.
- Changes remain local until the user finishes testing and approves publication.

## 1.2.1 — 2026-10-12

- Set AviationYYZ/ZYZTools-Unofficial- as the default GitHub release source so startup checks work without manual repository configuration.

## 1.2.0 — 2026-10-12

- Departure assignment resets to Off whenever EuroScope loads the plugin or the settings app opens.
- Added startup GitHub release checks and a download/install update button. Configure the repository URL once in App updates; releases need a stable version tag and the setup EXE asset.
- Replaced the subtle controller clarity trim with a measurable additional radio filter blend: 0% adds no filter, 100% applies the full extra effect over TrackAudio's selected hardware.
- Slider changes apply live to newly captured controller audio without resetting the replay buffer; pilot audio is unaffected.
- Replay configuration failures are now reported instead of silently ignored.

## 1.1.1 — 2026-10-12

- Fixed replay status/save responses being discarded when Windows ends the named-pipe connection with EPIPE.
- Serialized replay helper requests, increased the save timeout, and surfaced actual helper errors.
- Verified repeated status requests against the running TrackAudio replay helper.

## 1.1.0 — 2026-10-12

- Removed all polygon/location-based NCD runway assignment and its UI controls.
- Unified duals around the saved Off/East/West UI selection; legacy fields cannot override it.
- Settings reload live, with atomic saves and corrected east/west switching.
- Moved apply, Hoppie rejection/testing, and session export actions into the UI with response/error handling.
- Retained `.ui` and the configurable replay-save shortcut; retired other text controls.
- Preserved manual runway/NCD handling and TELEX PDC delivery.
- Added regression tests for mode switching and UI action recovery after a crash.

## 1.0.0

- Restored north-side / North GA automatic NCD detection by falling back to the EuroScope flight-plan track position when an aircraft has no valid correlated radar target yet.
- Converted the main settings UI to an Electron app. The setup EXE now installs the Electron settings app, and its Install / Update EuroScope Plugin button deploys the DLL, bridge, replay helper, sounds, docs, config, and TrackAudio tap payload to EuroScope.
- `.UI` / `.SETTINGS` now opens the linked Electron settings app, with the native EuroScope settings console retained as a fallback if the app cannot be found.
- Added a configurable 1-10 minute VATSIM audio instant replay buffer with a dedicated Recordings page, in-plugin playback for saved WAV files, editable dot-prefixed save command, `.REPLAY` commands, strict TrackAudio process-tree WASAPI capture, UTC start/end WAV export names, and automatic shutdown with EuroScope.
- Fixed Recordings-page replay-length saves so changing the replay window restarts the helper immediately instead of leaving the previous buffer length alive.
- Fixed `.UI` Electron launches so EuroScope passes the exact live plugin folder to the settings app instead of letting it fall back to a different `%APPDATA%\EuroScope` install.
- The settings app now auto-detects existing profile/plugin installs such as `%APPDATA%\EuroScope\CZYZ\plugins\PreferredCYYZPdcPlugin` when opened outside EuroScope.
- The EuroScope DLL now verifies the running replay helper's reported window/intensity before reusing it; mismatched or old helpers are shut down and restarted.
- Expanded the Recordings-page radio hardware intensity slider to 0-100% for replayed controller transmissions only, with a stronger low-end clarity curve and a clearer default that keeps the TrackAudio hardware texture.
- Added replay-side controller TX radio shaping so saved controller audio matches the received-radio texture more closely.
- Changed the full settings command to `.UI`; legacy `.SETTINGS` remains accepted as an alias.
- Removed general Windows-output fallback; the replay now waits for TrackAudio and records no unrelated computer audio.
- TrackAudio stable 1.4.0, legacy stable 1.3.3, and beta 1.4.0-beta.6 processed transmit audio is captured through version-matched private internal taps with no audible sidetone, raw microphone capture, virtual cable, or dummy playback device.
- Added a TrackAudio 1.4.0-compatible private tap built from the released 1.4.0 `afv-native` source; TrackAudio's new public loopback can feed replay without playing your own controller audio back to you.
- Added Recordings-page replay enable/disable, TrackAudio stable/beta selection, tap status, and one-click Apply / repair TrackAudio tap for after TrackAudio reinstalls.
- Replay save now rejects all-silent buffers instead of writing empty WAV files when no audible TrackAudio audio has reached the rolling buffer.
- Bundled `pdc_request.wav` and `IFR_release.wav` in the setup package.
- Added the Departure List setup guide to the installer display and installed files.
- The native PDC bridge now exits automatically when EuroScope closes or unloads the plugin.
- Replaced unreliable Ctrl+A/Backspace input clearing with a single EuroScope `Esc` before opening private chat; the PDC message box is no longer erased before paste.
- Added selectable CURRENT, VATCAN, and CPP interfaces with distinct layouts, fonts, controls, colors, JSON persistence, and `.THEME` commands; CPP now recreates the supplied compact controller utility design natively without Electron.
- Fixed the settings menu sometimes remaining invisible after `.SETTINGS` by requesting an immediate radar-screen repaint and keeping the panel inside the active radar area.
- Added a bottom-right resize grip to every settings-menu theme.
- Lowered the theme-specific minimum sizes so settings menus can be shrunk as well as enlarged.
- Updated the EuroScope plugin author to `Charlie Yablon and Elliot Potts`.
- PDC sending now preserves manually assigned runways instead of correcting them back to the SID-recommended runway.
- Manual SID/runway mismatches are marked NCD; activating the clearance flag replaces the PDC identifier with `NCD` for non-conforming departures.
- Added automatic network-session statistics for aircraft cleared, takeoffs, landings, traffic-volume charts, and average movements per hour.
- Added automatic and on-demand Excel-compatible exports with Summary, Movements, and Traffic Volume worksheets.
- Added an Electron Statistics page that previews the latest exported session, traffic-volume buckets, recent movement events, and opens/downloads the latest spreadsheet.
- Statistics now write quiet live spreadsheet snapshots when a network session starts and after each recorded movement so the Electron UI can refresh current data.
- Changed the installer default parent folder to `%APPDATA%\EuroScope`.
- Combined Preferred PDC Flag and CYYZ PDC behavior into one native EuroScope plugin.
- Earlier native-only architecture replaced by the Electron settings app plus native EuroScope runtime.
- Added `>`, `RX`, `TX`, and `TXH` status states.
- Added shared PRWY/send runway calculation.
- Added WEST/EAST/NORTH/SOUTH operations and supported operation variants.
- Added manual and north-side polygon NCD handling.
- Added route `SID/RWY` amendment for departures that do not already have a runway assigned.
- Added correlated Hoppie CPDLC replies and non-blocking polling.
- Added native EuroScope Hoppie settings and link test.
- Added unified JSON configuration and legacy migration.
- Added configurable native normal-message bridge.
- Added self-contained native installer.
# 1.2.31 — Shared manual sweatbox controls

- Added opt-in authenticated shared aircraft command centre, including flight-plan editing, via a separate loopback HTTP panel suitable for an HTTPS tunnel.
- Host retains simulation lifecycle; AI pilot bridge and manual sharing are mutually exclusive. No remote FSD exposure, automatic tunnel, VATSIM connection or publication.
- Keys rotate on restart and are revoked on Stop; bounded requests, stale-session/duplicate gates and host action history.

# 1.2.32 — Remote EuroScope connector

- Added opt-in controller-side loopback connector over the existing authenticated HTTPS tunnel, with bounded FSD queues, ordered writes and revocation on host Stop.
- Captured ILS now explains why RATE cannot override the glidepath; manual 2000/3000/6000 ft/min rates tested independently.
- Radar packet cadence reduced to 1 Hz while retaining 10 Hz integration as a prediction-plugin compatibility mitigation; EuroScope Tools needs live confirmation.

# 1.2.33 — Magnetic headings and IAS control polish

- Heading commands/readbacks and live displays are magnetic; true geometry/FSD packets remain unchanged. Scenario variation is editable and imported from SCT INFO; legacy Toronto defaults use the supplied sector's 10.37°W.
- Fixed directed-turn interception boundary that could retain a turn flag; cancel approach captures current heading.
- SPD now aliases IAS (80–400 knots); no-wind GS uses approximate ISA TAS, not indicated speed.
- Host and shared manual command boxes clear only after successful sends, preserving failed or newly typed commands.

# 1.2.34 — Built-in internet tunnel controls

- Bundled checksum-pinned cloudflared with its license; no external installation or terminal required.
- Added Start/Stop internet tunnel, live status, public URL and Copy URL to Multiplayer. Checks local panel availability before exposing it.
- Managed tunnel stops when shared control, the simulation server or ZYZTools closes. Public tunnel stays opt-in; manual external tunnels are not touched.

# 1.2.35 — Guided hosting and private invites

- Start hosting saves the editor, prepares the local server, switches off AI pilots, starts shared control and the managed tunnel. Simulation clock is not started automatically.
- Copy private invite combines URL and key in a fragment-only invite. Browser users auto-join; EuroScope users paste the same invite into ZYZTools and click Join.
- Connector validates host and key before opening its local EuroScope address; clearer expired-invite, 502 and non-ZYZTools response errors. Copy server address button and explicit VATSIM-off instructions.
- Stop hosting disconnects all clients and revokes the invite. Credentials remain in memory, not settings; invite links are passwords.

