# Changelog

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
