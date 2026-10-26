# Shared manual sweatbox (1.2.31)

Client 1.2.42 / server 0.3.2: the shared web panel adapts to phones/tablets, with labelled aircraft cards, 44px touch controls and responsive flight-plan fields. Tap an active aircraft to select it and jump to controls. Comma-separated commands work, e.g. `LHDG 330, ALT 3000`. Use the same private invite in the phone browser; no mobile app is required. Phones control only the existing shared-manual role; server-PC student invites remain read-only, not instructor credentials. Keys remain memory-only and are removed from invite fragments/history after joining. Open through the host's HTTPS invite when outside the LAN. Simulator hosting and EuroScope remain on Windows.

Current 1.2.37 navigation: **Training → Student · join** for students; **Training → Local practice → Optional share** for desktop-hosted manual sharing. For the spare-PC instructor/server/student workflow, use [THREE_SERVER_SETUP.md](THREE_SERVER_SETUP.md). The training AI-pilot/readback system is removed. The older instructions below describe optional desktop hosting, not the server-PC instructor workflow.

## Quick connect (1.2.35)

Host: create/import your scenario, then click **Start hosting** under Local practice. This saves the current editor, starts the local simulator server and prepares shared control plus the managed internet tunnel. Wait for the tunnel to say **ready**, then click **Copy private invite**. Send this link only to your invited participant. Press **Run** when everyone is ready; hosting does not start the clock automatically or reset an already-running simulation.

Browser participant: open the invite. It signs into the manual command panel automatically. The access key is in the URL fragment, not sent in HTTP URL requests; the page removes the fragment from the current browser history entry and holds the key in memory only. Browser extensions or clipboard history may still see the copied invite, so treat it as a password.

EuroScope participant: open ZYZTools → Local Training → Multiplayer. Click **Paste invite**, then **Join with EuroScope**. The app checks the remote host and access key before marking the connector ready. Click **Copy EuroScope server address**, paste it into EuroScope's non-VATSIM connection dialog, use dummy credentials and a distinct callsign, and keep **Connect to VATSIM UNCHECKED**. EuroScope connection selection is deliberately not automated. Keep ZYZTools running. Old URL/key fields remain as a manual fallback.

Click **Stop hosting / disconnect everyone** to close the local server, managed tunnel and shared controls and revoke invites. A new hosting session needs a fresh invite. This is a small private training host, not a full replacement for every inter-controller FSD feature. Coordinate manual aircraft ownership; last accepted command wins.

## Built-in tunnel (1.2.34)

No separate tunnel app or terminal is needed. The host starts the local simulation and shared control, then clicks **Start internet tunnel** in Multiplayer. Wait for **ready**, copy its public HTTPS URL, and send it and the shared-control key privately to the invited participant. Browser participants open the URL; EuroScope participants enter it and the key in ZYZTools' existing remote connector. The host must keep ZYZTools running. Stopping shared control, stopping the local server or normally exiting the app also stops this managed helper. A restarted tunnel has a new URL. External tunnels previously launched manually are not managed by ZYZTools; close those separately.

The installer bundles the official, unmodified cloudflared 2026.10.3 Windows 386 helper, Apache License 2.0, source https://github.com/cloudflare/cloudflared/tree/2026.10.3 . Its SHA256 is pinned from the official release metadata and rechecked before execution. Bundled resources are copied into a channel-private cache; no administrator permission, PATH entry, service installation or runtime download is required. Cloudflare's temporary tunnel service still processes connection data and offers no uptime guarantee. The host's access key is never passed to cloudflared or placed in the public URL. No public tunnel starts without a click. There is no VATSIM connection.

The manual terminal instructions below remain an advanced alternative for older builds, not the normal 1.2.34 workflow.

## 1.2.33 command conventions

HDG/LHDG/RHDG are magnetic in degrees. Use the Scenario Builder magnetic variation field to match EuroScope (positive WEST, negative EAST). SCT INFO imports supply this value; legacy Toronto scenarios default to 10.37°W from the user's sector, not a date/location-dependent magnetic model. Internal saved heading coordinates and FSD position packets remain true for geographic route/ILS compatibility. The initial-heading editor and live displays convert to magnetic. Re-export your scenario to preserve its variation.

SPD and IAS both assign indicated speed (80–400 knots). Approximate ISA conversion gives TAS; with no wind, TAS equals GS. At sea level IAS and GS may be equal; higher altitude generally gives greater GS. No real weather/wind/compressibility model is implied. Filed cruise speed remains TAS. Successful manual sends clear the command box on both panels; rejected commands stay available for correction.

This is not an AI pilot. One computer runs the simulation; another person manually controls the same simulated aircraft through a browser command centre. No ZYZTools install is needed for the browser panel. Starting in 1.2.32, remote EuroScope controllers can install ZYZTools and use the built-in connector too.

## Remote EuroScope controller (1.2.32)

The host starts shared control and runs the HTTP tunnel exactly as below. On the other computer, install ZYZTools 1.2.32, open Local Training → Multiplayer → Join as a remote EuroScope controller. Leave that computer's local training server stopped. Enter the host HTTPS tunnel URL and current access key, then Start EuroScope connector. In EuroScope enter 127.0.0.1 (test) or 127.0.0.2 (production), no port suffix, with Connect to VATSIM UNCHECKED and dummy login credentials. Do not enter the public URL or real VATSIM credentials in EuroScope. The connector transports the controller's local FSD connection over authenticated HTTPS to the host's fixed local simulation socket. It never selects or forwards to another upstream server. Close the connector when done. A failed tunnel disconnects the controller; restart/reconnect explicitly. Host Stop revokes active remote connections. There is no automatic reconnect to any network.

Use distinct controller callsigns. This supports viewing simulated traffic and the implemented flight-plan/squawk/track metadata messages; it is not a full FSD implementation of every EuroScope inter-controller feature. Test a full two-computer session before relying on handoffs or third-party plugin behavior.

Manual RATE is 100–6000 ft/min toward the assigned ALT. It does not initiate descent alone. Captured ILS glidepath controls descent instead and rejects RATE with an explicit explanation; use APP CANCEL, then ALT and RATE to fly a manual rate. Radar samples now publish at 1 Hz (motion still integrates at 10 Hz) as a compatibility mitigation for prediction plugins; EuroScope Tools PTL has not been live-verified.

1. Import a scenario, Start local server, and connect the host's EuroScope using the existing non-VATSIM instructions.
2. Under Local practice → Optional share, click Start shared control. Click Open shared panel to try it locally.
3. For internet access, install cloudflared from its official distribution and run the exact tunnel command shown by the app. Test uses `cloudflared tunnel --url http://127.0.0.1:6811`; production uses port 6812.
4. Share the generated HTTPS URL and host access key privately, preferably separately. The other person opens that URL, enters the key and clicks Connect. Never publish the key. Anyone with it has all manual aircraft controls.
5. Host clicks Run. The other person selects an active aircraft and enters ALT, RATE, IAS, HDG/LHDG/RHDG, DCT, SQ or other commands listed on the panel. Quick buttons support IDENT, individual pause/resume, approach clear/cancel and published speeds. Flight-plan edits use Load selected flight plan then Apply flight plan. Selected runway supplies the simulated ILS. Aircraft spawning later appear as scheduled until active.
6. Host retains session Run/Pause/Reset and can also issue commands. Coordinate who works each aircraft: there is no exclusive aircraft ownership/locking; last accepted command wins. Commands are manual and immediate, without robotic or AI readbacks. Use a separate voice call for your session if desired.
7. Stop shared control revokes its key; Start generates a new one. Stopping the training server or exiting the app closes shared control. Close the tunnel terminal too. Scenario reset rejects stale commands until the participant refreshes.

The panel binds to loopback only, uses a random 256-bit per-start bearer key held in memory, and has no file/shell/settings/network-control API. The key is entered manually, never in a URL, cookie or browser storage. Use the HTTPS tunnel URL remotely; direct HTTP is intended only for the same machine. Do not port-forward or tunnel FSD port 6809. No tunnel starts automatically, and no VATSIM traffic is contacted. Tunnel providers process the simulated session data; this feature intentionally permits your invited participant to receive it.

Cloudflare quick-tunnel instructions: https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/ . A public tunnel across two computers has not been verified by local automated tests. Quick tunnels are temporary development/testing connections, not an availability guarantee.
