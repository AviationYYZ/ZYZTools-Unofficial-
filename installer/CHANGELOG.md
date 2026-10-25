# Changelog

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

