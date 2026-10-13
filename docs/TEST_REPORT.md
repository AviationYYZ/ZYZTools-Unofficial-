# Test report

## Built and tested locally

- x86 plugin DLL compiled with MSVC.
- x86 native bridge compiled with MSVC.
- x86 native audio replay helper compiled with MSVC.
- x86 native installer compiled with MSVC.
- x64 TrackAudio 1.4.0 stable native audio module compiled in Release mode from the exact `afv-native` stable submodule revision `05b6448639cf437056698b93bbc0c68637e49d8b`.
- x64 TrackAudio 1.3.3 stable native audio module compiled in Release mode from the exact `afv-native` stable submodule revision.
- x64 TrackAudio 1.4.0-beta.6 native audio module compiled in Release mode from the exact `afv-native` beta submodule revision.
- The patched TrackAudio module preserves all 185 official exports with no missing or additional exports.
- DLL exports use the C++ linkage declared by the supplied EuroScope SDK.
- Native bridge process starts successfully and was stopped after the smoke test.
- A live named-pipe shutdown smoke test confirmed the bridge exits with code 0.
- A live named-pipe shutdown smoke test confirmed the audio replay helper exits with code 0.
- Process-specific WASAPI activation was verified against a running target process.
- Strict process mode was verified to wait without falling back when its configured target was absent, then switch into process capture when the target started.
- Strict process mode waits without recording when TrackAudio is absent and switches to the TrackAudio root process when it starts.
- TrackAudio root-process selection was verified against its Electron renderer, network, GPU, and audio-service child processes.
- The saved replay WAV format has valid RIFF/WAVE headers and uses 48 kHz, 16-bit, stereo PCM.
- Bridge source contains no Ctrl+A or Backspace message-box clearing sequence; it sends one Escape before opening private chat.
- CURRENT, VATCAN, and CPP compile as separate console layout renderers with distinct typography and control geometry.
- CURRENT retains the original Consolas horizontal-tab layout.
- VATCAN compiles with compact Segoe UI fonts, a left navigation strip, and beveled module controls.
- CPP compiles as a 440x615 Segoe UI controller utility matching the supplied `electron.zip` colors and stacked layout, implemented entirely with native EuroScope/GDI controls.
- Theme selection is wired to the settings control, `.THEME` commands, JSON save/load, dark editor, confirmation modal, and RX/TX tag colors.
- Radar-screen command handling explicitly requests a repaint after `.SETTINGS` / `.SETTING`, and the settings rectangle is clamped into the active radar area before drawing.
- CURRENT, VATCAN, and CPP expose a bottom-right resize grip that supports enlarging and shrinking, with compact theme-specific minimum dimensions and active-radar-area bounds.
- All themes expose a Statistics page with cleared, takeoff, landing, movements/hour, 15-minute volume chart, recent events, and spreadsheet export.
- Statistics session lifecycle is tied to direct, proxy, or Sweatbox network connections.
- Statistics events use per-aircraft duplicate guards and combine clearance-flag, ground-state, radar-transition, and near-airport disconnect signals.
- Completed sessions auto-export as SpreadsheetML with Summary, Movements, and Traffic Volume worksheets.
- Statistics now write quiet live SpreadsheetML snapshots when a network session starts and after each recorded movement event, so the Electron UI can refresh current stats from disk.
- The Electron Statistics page is present in the packaged app and reads Summary, Movements, and Traffic Volume worksheets from the installed `Statistics` folder.
- The Electron Statistics page exposes refresh, open Statistics folder, open latest spreadsheet, download latest spreadsheet, latest-session summary, traffic-volume bars, recent events, and saved spreadsheet list.
- Electron source syntax checks passed for `main.js`, `renderer.js`, and `preload.js`.
- The packaged Electron asar was inspected and contains the Recordings-page controller-only radio hardware intensity slider, config normalization, replay-runtime change detection, helper status/config matching, and `--tx-radio-intensity` helper launch argument.
- The packaged Electron asar was inspected and contains the TrackAudio Stable 1.4.0, Legacy stable 1.3.3, and Beta 1.4.0-beta.6 selector plus the 1.4.0 tap filename mapping.
- The packaged Electron asar was inspected and contains `--plugin-dir` / `--install-folder` parsing so `.UI` opens the live EuroScope plugin folder instead of the generic `%APPDATA%\EuroScope` fallback.
- The packaged Electron UI exposes the controller-only radio hardware intensity slider as a true 0-100% range, and the helper/DLL clamps the runtime value to the same range.
- The default source and packaged payload configs include `audio_replay_tx_radio_intensity`.
- The audio replay helper status string exposes the configured replay window and controller radio intensity for runtime diagnostics.
- Fresh helper runtime smoke test started `PreferredCYYZAudioReplay.exe` with `--seconds 300 --tx-radio-intensity 0`; named-pipe status reported `window 300 sec // controller radio 0%`, then clean shutdown returned exit code 0.
- Live CZYZ plugin folder was updated while EuroScope was closed; installed DLL/helper hashes match the fresh build, and the live config now has `audio_replay_enabled=1`, `audio_replay_seconds=180`, and `audio_replay_tx_radio_intensity=70`.
- Installed Electron settings app under `%LOCALAPPDATA%\Programs\Preferred CYYZ PDC Settings` was refreshed from the new setup; its asar contains profile-folder auto-detection, `--plugin-dir` parsing, helper status/config matching, and the 0-100% controller intensity slider.
- Live CZYZ helper smoke test started the installed helper with `--seconds 180 --tx-radio-intensity 70`; named-pipe status reported `window 180 sec // controller radio 70%`, then clean shutdown returned exit code 0.
- Fresh helper runtime smoke test started `PreferredCYYZAudioReplay.exe` with `--seconds 300 --tx-radio-intensity 70`; named-pipe status reported `WAITING // TrackAudio is not running // PROCESSED TX TAP WAITING // window 300 sec // controller radio 70%`, then clean shutdown returned `OK|shutdown` and the helper exited.
- Unified JSON parsed successfully with PowerShell `ConvertFrom-Json`.
- Default EAST DUALS matrix contains `MIXUT` only under runway `06L`.
- `.UI` launches the linked Electron settings app when available and falls back to the native `CRadarScreen` console when not available.
- Electron app source and package metadata are present under `electron-app/`.
- One plugin init/export pair is present.
- The setup EXE is built by electron-builder and carries the native EuroScope plugin payload as Electron extra resources.
- The packaged Electron asar was inspected and contains the Statistics tab, statistics IPC, and statistics renderer code.
- Packaged plugin DLL and audio replay helper hashes match the freshly compiled build outputs.
- The installer packages separate TrackAudio private-tap modules for 1.4.0 stable, 1.3.3 legacy stable, and 1.4.0-beta.6 beta and selects by TrackAudio file version.
- Packaged 1.4.0 stable, legacy stable, and beta TrackAudio tap hashes match the built tap DLLs.
- Deep 1.4.0 stable-tap compatibility pass compared the patched TrackAudio 1.4.0 module against the locally installed stock 1.4.0 module: both exported 185 names, with 0 missing and 0 extra exports.
- Installed TrackAudio 1.4.0 was repaired with the patched 1.4.0 tap in both native-module locations; both installed module hashes match the packaged 1.4.0 tap hash.
- Deep stable-tap compatibility pass compared the patched TrackAudio 1.3.3 stable module against a saved stock stable module backup: both exported 168 names, with 0 missing and 0 extra exports.
- Fake TrackAudio 1.3.3 stable install test confirmed the Electron Apply / repair TrackAudio tap path detects stock stable modules, writes the stable tap to both expected native-module locations, and reports ready after both target hashes match the stable tap hash.
- TrackAudio running detection now uses PowerShell `Get-Process` before falling back to `tasklist`, avoiding `tasklist.exe` access-denied failures that could otherwise make the repair button think TrackAudio is closed.
- TrackAudio 1.3.3 stable launched successfully with the patched native module loaded.
- TrackAudio 1.4.0-beta.6 launched successfully with the patched native module loaded.
- TrackAudio 1.4.0 stable private tap source inspection confirms the processed loopback frame is published to the replay shared memory and the headset/speaker sidetone mix is removed.
- The replay helper selected TrackAudio's root process and entered strict RX process capture. The processed-TX tap correctly remained in its waiting state while TrackAudio was not connected and had not started an audio session.
- Replay helper smoke test confirmed named-pipe `status`, no-audible-audio `save` rejection, clean `shutdown`, exit code 0, and no silent WAV creation when TrackAudio is not running.
- Electron Statistics parser test confirmed a SpreadsheetML sample is read into latest-session metrics, one movement event, and one traffic-volume bucket.
- Source inspection confirms the normal TrackAudio loopback mix is absent from both headset and speaker output paths.

## Source-inspected

- RX overrides sent state.
- TX/TXH remain repeat-clickable.
- A manually assigned route/departure runway is preserved for preview and send even when it differs from the SID recommendation.
- Route amendment is required only when no runway is currently assigned.
- Manual runway mismatch sets the NCD state for normal and Hoppie PDC scratchpads.
- Clearance receipt clears a normal PDC identifier and replaces an NCD identifier with plain `NCD`.
- Manual NCD precedes polygon/SID/default logic.
- Hoppie PDC reply retains the incoming request ID.
- Worker thread does not call EuroScope SDK objects.
- Session statuses are not serialized.

## Requires live EuroScope validation

- DEP-list rendering, colors, click payload, and PRWY display.
- Route/runway extraction after `AmendFlightPlan()`.
- NCD polygon using both a correlated live radar target and the flight-plan-track fallback for North GA / uncorrelated aircraft.
- Scratchpad restore and `PUSH` clear behavior.
- Dark settings UI interaction in EuroScope 3.3.0.9.
- Normal bridge delivery while EuroScope has focus.
- `.REPLAY`, the Recordings-page replay button/player, editable save command, and user-message feedback inside a live EuroScope radar screen.
- Live received-frequency capture while TrackAudio is connected to Audio for VATSIM.
- Live on-network controller-transmission capture remains a user acceptance test because it requires an actual PTT transmission. Static inspection and local integration tests verify that the private processed-transmit tap is enabled while the audible sidetone mix is removed.
- Subjective tuning of the new controller-only radio hardware intensity slider against a live TrackAudio frequency.
- Runtime smoke testing of the freshly rebuilt helper's named pipe was deferred because an installed helper was already running from the user's EuroScope plugin folder and was left untouched to preserve the active rolling replay buffer.

## Requires live Hoppie validation

- Link test against the controller’s logon.
- Poll group formatting for the live account.
- Correlated CPDLC reply acceptance and TXH transition.
