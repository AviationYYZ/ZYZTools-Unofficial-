# ZYZTools

ZYZTools is a native x86 EuroScope plugin and desktop application for Toronto controller operations. Test builds are named **ZYZTools test**. It combines PDC clearance, SID runway assignments, Hoppie, statistics, and audio replay.

Legacy DLL, helper, pipe, and configuration filenames remain compatible with existing EuroScope installations. The desktop application, installer, shortcuts, and EuroScope plugin display use the ZYZTools name.

Production **ZYZTools** and **ZYZTools test** install independently and can both remain open. The test app has its own installer identity, `%APPDATA%\ZYZTools-test` data, test plugin directory, and `.Test` helper endpoints. Production retains compatible legacy plugin filenames and destinations. Install each channel's own payload, and select the appropriate DLL in EuroScope when testing; the desktop apps may run side by side. Test installation does not automatically patch the shared TrackAudio client.

The main settings UI is now an Electron desktop app. The EuroScope DLL still owns the actual tag items, runway/NCD logic, PDC sending, Hoppie polling, statistics, replay helper control, and bridge lifecycle. The Electron app edits the same JSON config and includes an **Install / Update EuroScope Plugin** button that copies the DLL, helpers, sounds, docs, and config into the selected EuroScope plugin folder.

## Build

Open an x86 Native Tools Command Prompt for Visual Studio, change to this folder, and run:

```bat
build.bat
```

Expected outputs:

- `build\PreferredCYYZPdcPlugin.dll`
- `build\PreferredCYYZPdcBridge.exe`
- `build\PreferredCYYZAudioReplay.exe`
- `build\PreferredCYYZPdcPlugin.json`
- `build\PDCBridge.ini`
- `build\EuroScopePlugInDll.dll`

Build the self-contained installer with:

```bat
installer\build.bat
```

The test installer is written to `installer\dist\test\ZYZTools-Test-Setup-VERSION.exe`. Build the independent production installer with `npm run dist:production`; it is written to `installer\dist\production\ZYZTools-Setup.exe`. `npm run dist:both` builds both. Neither is automatically published.

To share a beta, use **Advanced → Publish beta** in ZYZTools test. Connect GitHub once and optionally remember access using encrypted local storage. The app finds the beta installer automatically in Downloads when possible, otherwise asks for that one file. It uploads beta source to the `beta` branch and creates a `vVERSION-beta` prerelease. A production installer is not needed. Production promotion is a separate action.

Install the Electron app first. In the app, use **Install / Update EuroScope Plugin** to choose the EuroScope parent/plugin folder. The default parent path is `%APPDATA%\EuroScope`; it remains editable if the active EuroScope profile uses a deeper folder such as `CZYZ\plugins`.

## Load in EuroScope

1. Run the setup executable and open **ZYZTools test**.
2. Click **Install / Update EuroScope Plugin** and choose the correct EuroScope plugin parent/folder.
3. In EuroScope, open **OTHER SET > Plug-ins**.
4. Load `PreferredCYYZPdcPlugin.dll`.
5. Type `.ui` to reopen the Electron settings app from EuroScope. If the app path is missing, the old native fallback console still opens.

The plugin reads configuration from the DLL folder. It can migrate the old `PreferredPDCPlugin.json` format when the new file is absent.

The setup package includes `pdc_request.wav` and `IFR_release.wav`. The incoming-request sound is selected by default in the bundled JSON. A compatibility copy named `cpdlc_rx.wav` is also installed so an older preserved configuration continues to work.

## Themes

The theme control cycles through three complete interfaces:

- `CURRENT` - the original teal/cyan console, Consolas typography, and horizontal tab layout
- `VATCAN` - a compact VATCANSitu-inspired layout with Segoe UI typography, a left navigation strip, grey 3D modules, and green/orange/red accents
- `CPP` - the compact 440px controller utility design from `electron.zip`, recreated natively in EuroScope with Segoe UI, flat charcoal controls, slate-blue actions, an inline status banner, stacked departure/Hoppie/request sections, and the Charlie/Elliot credit

The selected theme immediately changes the console layout, fonts, confirmation modal, text editors, controls, and RX/TX tag colors. Click **SAVE CONFIG** to persist it. Select the theme in the settings UI.

The Electron settings app is the primary settings surface. The native EuroScope console remains as a fallback if the app is not installed or cannot be found.

## Session statistics

The **Statistics** page records a session automatically while EuroScope is connected to the network. It tracks:

- CYYZ departures cleared using the clearance-received flag
- CYYZ takeoffs
- CYYZ landings
- total movements and average movements per hour
- 15-minute traffic-volume buckets and recent movement events

The session ends automatically when the network connection terminates. An Excel-compatible spreadsheet is saved in the plugin's `Statistics` folder, with separate Summary, Movements, and Traffic Volume worksheets. The Electron **Statistics** page reads those spreadsheets, previews the latest summary/chart/events, and can open or download the latest spreadsheet. Use **EXPORT SPREADSHEET** or `.STATS EXPORT` to force an active snapshot from EuroScope.

## Configurable audio replay

`PreferredCYYZAudioReplay.exe` starts and stops with the EuroScope plugin. It continuously keeps only the newest configured amount of TrackAudio-rendered radio audio in memory; it does not write a permanent recording until you request one.

- Open **Recordings** and click **SAVE RADIO REPLAY NOW**, type `.REPLAY`, or use your configured save command.
- Use the **Recordings** page replay-length control to choose 1-10 minutes.
- Use **Radio hardware intensity (controller transmission only)** from 0-100% to keep controller TX noticeably radio-filtered while trimming replay-only muffling.
- The **Recordings** page lists saved WAV files and can play them inside EuroScope without opening File Explorer.
- The save command defaults to `.replay save`; edit the command suffix on the **Recordings** page. The leading `.` is fixed and cannot be removed.
- Replay can be turned on/off from the **Recordings** page.
- Choose TrackAudio **Auto**, **Stable 1.4.0**, **Legacy stable 1.3.3**, or **Beta 1.4.0-beta.6** on the **Recordings** page. Auto uses the installed TrackAudio file version.
- If you reinstall TrackAudio and replays save empty audio or the tap status says stock, close TrackAudio and click **Apply / repair TrackAudio tap** on the **Recordings** page.
- WAV files are saved in the plugin's `Recordings` folder using Zulu start/end filenames like `VATSIM_Replay-20260623-175930Z-180230Z.wav`.
- Capture is restricted to the root `trackaudio.exe` process and its complete Electron audio-process tree.
- If TrackAudio is not running, the helper waits and records nothing. It never records general Windows/system audio.
- The helper notices when TrackAudio starts, exits, or restarts and reconnects automatically.
- Incoming frequency audio is captured directly from TrackAudio's rendered output.
- TrackAudio 1.4.0 stable, 1.3.3 legacy stable, and 1.4.0-beta.6 are integrated through private processed-transmit taps. Your Audio-for-VATSIM-processed transmission is saved with received radio audio without raw microphone capture, audible self-monitoring, a virtual cable, or a dummy playback device.
- The setup executable detects the installed TrackAudio version, applies the matching native tap, and backs up TrackAudio's original module first. Close TrackAudio before running setup. Later TrackAudio updates may replace the tap and require a compatibility rebuild rather than reusing a bundled tap blindly.

Optional JSON settings:

```json
"audio_replay_enabled": 1,
"audio_replay_seconds": 180,
"audio_replay_tx_radio_intensity": 70,
"audio_replay_capture_mode": "process",
"audio_replay_processes": "trackaudio.exe",
"audio_replay_folder": "Recordings",
"audio_replay_save_command": "replay save",
"trackaudio_version": "auto"
```

The buffer can be set from 1 to 10 minutes. Legacy `auto` or `system` capture-mode values are coerced to `process`; system-audio recording is disabled. Recording laws and consent rules vary; review them before distributing recordings.

## Departure-list columns

Status column:

- Header: `PDC`
- Tag item type: `CYYZ_PDC STATUS`
- Left button: `CYYZ_PDC SEND PDC`
- Right button: `CYYZ_PDC RESTORE FLAG`
- Recommended width: 3

Optional runway preview:

- Header: `PRWY`
- Tag item type: `CYYZ_PDC RWY`
- Recommended width: 4

States:

- `>`: idle
- `RX` blue: a Hoppie request is pending
- `TX` green: a normal PDC was sent
- `TXH` green: a Hoppie TELEX PDC was sent

`RX` always has priority. Clicking again is allowed. A repeated `TX` sends an updated normal PDC. A repeated `TXH` uses Hoppie only if a request context still exists; otherwise it sends normally.

## Runway assignment

Choose Off (default), Duals East, or Duals West in Operations and save. The saved selection is the only source of runway configuration and applies live within two seconds. Departures are assigned from the SID matrix when spawn data becomes available. Incomplete data is retried; unknown or conflicting SID entries are left unassigned. Existing plugin assignments update when the configuration or SID changes, while later manual amendments are preserved. Use Apply assignments now to explicitly reassign uncleared departures.

Location-based NCD assignment has been removed. Manual NCD and runway mismatches still use a plain NCD scratchpad marker after the clearance flag is set. While a PDC is pending, the scratchpad contains only its identifier.

## Hoppie

The Hoppie logon code is stored only in `PreferredCYYZPdcPlugin.json`; it is never written to the audit log.

- Polling interval is constrained to 45-75 seconds.
- **LINK TEST** sends `type=ping`.
- Polling uses `type=poll`.
- A real PDC request becomes blue `RX`; receipt never sends the clearance automatically.
- Clicking `RX` sends the clearance as plain TELEX.
- `TXH` is set only after the send succeeds or in explicit test mode.

Use **TEST INCOMING PDC** to inject an `ACA236` request. For a live fake request, send `REQUEST PREDEPARTURE CLEARANCE` from the desired Hoppie aircraft callsign (for example `GTI962`) to station `CYYZ`, wait for `RX`, then click the PDC cell.

## Native bridge

`PreferredCYYZPdcBridge.exe` is auto-started hidden for normal PDC sends. EuroScope must remain focused while it performs the transparent clipboard/keyboard sequence.

When EuroScope closes or unloads the plugin, the bridge receives a shutdown command and exits. If a bridge started by the plugin does not respond, the plugin terminates that owned process as a fallback.

Before opening the private chat, the bridge presses `Esc` once to cancel unfinished EuroScope command-line input. It does not use Ctrl+A/Backspace and does not erase the message box before pasting the PDC.

`PDCBridge.ini` controls the command used to open a private message:

```ini
[pdcbridge]
open_chat_command=.chat {CALLSIGN}
```

Change it to `.msg {CALLSIGN}` if that matches the local EuroScope setup.

## Controls

Open settings with .ui. Operations contains runway selection, theme, and Apply assignments now. Hoppie contains enable/disable, connection testing, request rejection, and an incoming PDC test. Replay & Recordings contains buffer controls and saving. Statistics contains current-session export and saved spreadsheets. All configuration saves apply live; no duals commands are required.

The configurable dot-prefixed replay-save shortcut remains available (default .replay save). Other previous text commands have been retired.

## Troubleshooting

- `cl.exe not found`: run from an x86 Native Tools Command Prompt.
- SDK error: place `EuroScopePlugIn.h`, `.lib`, and `.dll` in `SDK\`.
- Bridge error: keep `PreferredCYYZPdcBridge.exe` beside the plugin DLL.
- Audio replay error: keep `PreferredCYYZAudioReplay.exe` beside the plugin DLL and make sure TrackAudio is running.
- No Hoppie link: confirm station/logon and use **LINK TEST**.
- Wrong runway: check direction, operation, and the JSON-backed WEST/EAST SID matrix.
- `MIXUT` in EAST DUALS should preview and send runway `06L`.

Audit log: `PreferredCYYZPdcPlugin.log` beside the DLL.
