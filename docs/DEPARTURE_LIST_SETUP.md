# ZYZTools — EuroScope Departure List Setup

Load only `PreferredCYYZPdcPlugin.dll` in EuroScope.  
The plugin is displayed as **ZYZTools**. Its DLL filename is retained for compatibility with existing profiles.
`EuroScopePlugInDll.dll` is a required runtime dependency and must remain beside the plugin, but it is not selected in the plug-in loader.

## PDC status column

Open the Departure List column editor and add:

- Header: `PDC`
- Tag item type: `CYYZ_PDC STATUS`
- Left-button function: `CYYZ_PDC SEND PDC`
- Right-button function: `CYYZ_PDC RESTORE FLAG`
- Recommended width: `3`

Displayed states:

- `>` - idle
- `RX` - Hoppie request received
- `TX` - normal PDC sent
- `TXH` - Hoppie CPDLC PDC sent

## Optional runway preview column

Add another column:

- Header: `PRWY`
- Tag item type: `CYYZ_PDC RWY`
- Recommended width: `4`

The PRWY value uses the same runway selection as the actual PDC send. It preserves a manually assigned runway and adds `*` when that runway is non-conforming. The north-side / North GA automatic NCD zone uses the correlated radar target when available and the flight-plan track position as a fallback.

## First-time configuration

1. Type `.ui` in EuroScope.
2. Select the active WEST, EAST, NORTH, or SOUTH direction.
3. Click the operation field to cycle through the valid operation modes.
4. Open the SID Matrix tab and verify the SID-to-runway assignments.
5. Open the Hoppie tab and enter the station and logon code if Hoppie is used.
6. Click `SAVE CONFIG`.

The included sounds are:

- `pdc_request.wav` - new PDC/CPDLC request alert
- `IFR_release.wav` - IFR release request alert

EuroScope must remain focused while a normal PDC is delivered through the native bridge.

## Configurable audio replay

The installer includes `PreferredCYYZAudioReplay.exe`. It is started and closed automatically with the plugin.

- Open `.UI RECORDINGS` and click `SAVE RADIO REPLAY NOW`, type `.REPLAY`, or use your configured save command.
- Use the Recordings-page length control to choose 1-10 minutes.
- Use Radio hardware intensity (controller transmission only), 0-100%, to make saved controller audio clearer or more hardware-heavy without changing pilot audio.
- The Recordings page lists saved WAV files and can play them inside EuroScope without opening File Explorer.
- The save command defaults to `.replay save`; edit the command suffix on the Recordings page. The leading `.` is fixed and cannot be removed.
- Replay can be turned on/off from the Recordings page.
- Choose TrackAudio Auto, Stable 1.4.0, Legacy stable 1.3.3, or Beta 1.4.0-beta.6 from the Recordings page. If TrackAudio was reinstalled, close TrackAudio and use Apply / repair TrackAudio tap.
- Saved WAV files are written to the `Recordings` folder beside the plugin with Zulu start/end filenames.
- `.REPLAY STATUS` shows whether the helper is attached to TrackAudio.
- The helper never records the Windows system mix. It records TrackAudio's process tree only.
- The included TrackAudio 1.4.0 stable, 1.3.3 legacy stable, and 1.4.0-beta.6 integrations record your processed controller transmission alongside received frequency audio through a private internal tap. It does not require a virtual cable and does not play your own voice back to you.
- Close TrackAudio while installing. The setup applies the matching tap only when it detects an exact compatible TrackAudio version and preserves the original native audio module as a timestamped backup.

## Statistics exports

Statistics start automatically when EuroScope connects to the network and stop when the network connection ends. The Electron Statistics page previews the latest exported session, traffic-volume buckets, and recent movement events. It can also open the `Statistics` folder or download the latest Excel-compatible spreadsheet.
