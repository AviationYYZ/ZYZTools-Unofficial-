# Shared manual sweatbox (1.2.31)

## 1.2.33 command conventions

HDG/LHDG/RHDG are magnetic in degrees. Use the Scenario Builder magnetic variation field to match EuroScope (positive WEST, negative EAST). SCT INFO imports supply this value; legacy Toronto scenarios default to 10.37°W from the user's sector, not a date/location-dependent magnetic model. Internal saved heading coordinates and FSD position packets remain true for geographic route/ILS compatibility. The initial-heading editor and live displays convert to magnetic. Re-export your scenario to preserve its variation.

SPD and IAS both assign indicated speed (80–400 knots). Approximate ISA conversion gives TAS; with no wind, TAS equals GS. At sea level IAS and GS may be equal; higher altitude generally gives greater GS. No real weather/wind/compressibility model is implied. Filed cruise speed remains TAS. Successful manual sends clear the command box on both panels; rejected commands stay available for correction.

This is not an AI pilot. One computer runs the simulation; another person manually controls the same simulated aircraft through a browser command centre. No ZYZTools install is needed for the browser panel. Starting in 1.2.32, remote EuroScope controllers can install ZYZTools and use the built-in connector too.

## Remote EuroScope controller (1.2.32)

The host starts shared control and runs the HTTP tunnel exactly as below. On the other computer, install ZYZTools 1.2.32, open Local Training → Multiplayer → Join as a remote EuroScope controller. Leave that computer's local training server stopped. Enter the host HTTPS tunnel URL and current access key, then Start EuroScope connector. In EuroScope enter 127.0.0.1 (test) or 127.0.0.2 (production), no port suffix, with Connect to VATSIM UNCHECKED and dummy login credentials. Do not enter the public URL or real VATSIM credentials in EuroScope. The connector transports the controller's local FSD connection over authenticated HTTPS to the host's fixed local simulation socket. It never selects or forwards to another upstream server. Close the connector when done. A failed tunnel disconnects the controller; restart/reconnect explicitly. Host Stop revokes active remote connections. There is no automatic reconnect to any network.

Use distinct controller callsigns. This supports viewing simulated traffic and the implemented flight-plan/squawk/track metadata messages; it is not a full FSD implementation of every EuroScope inter-controller feature. Test a full two-computer session before relying on handoffs or third-party plugin behavior.

Manual RATE is 100–6000 ft/min toward the assigned ALT. It does not initiate descent alone. Captured ILS glidepath controls descent instead and rejects RATE with an explicit explanation; use APP CANCEL, then ALT and RATE to fly a manual rate. Radar samples now publish at 1 Hz (motion still integrates at 10 Hz) as a compatibility mitigation for prediction plugins; EuroScope Tools PTL has not been live-verified.

1. Import a scenario, Start local server, and connect the host's EuroScope using the existing non-VATSIM instructions.
2. Disable the AI pilot bridge. In Local Training → Multiplayer, click Start shared control. Click Open shared panel to try it locally.
3. For internet access, install cloudflared from its official distribution and run the exact tunnel command shown by the app. Test uses `cloudflared tunnel --url http://127.0.0.1:6811`; production uses port 6812.
4. Share the generated HTTPS URL and host access key privately, preferably separately. The other person opens that URL, enters the key and clicks Connect. Never publish the key. Anyone with it has all manual aircraft controls.
5. Host clicks Run. The other person selects an active aircraft and enters ALT, RATE, IAS, HDG/LHDG/RHDG, DCT, SQ or other commands listed on the panel. Quick buttons support IDENT, individual pause/resume, approach clear/cancel and published speeds. Flight-plan edits use Load selected flight plan then Apply flight plan. Selected runway supplies the simulated ILS. Aircraft spawning later appear as scheduled until active.
6. Host retains session Run/Pause/Reset and can also issue commands. Coordinate who works each aircraft: there is no exclusive aircraft ownership/locking; last accepted command wins. Commands are manual and immediate, without robotic or AI readbacks. Use a separate voice call for your session if desired.
7. Stop shared control revokes its key; Start generates a new one. Stopping the training server or exiting the app closes shared control. Close the tunnel terminal too. Scenario reset rejects stale commands until the participant refreshes.

The panel binds to loopback only, uses a random 256-bit per-start bearer key held in memory, and has no file/shell/settings/network-control API. The key is entered manually, never in a URL, cookie or browser storage. Use the HTTPS tunnel URL remotely; direct HTTP is intended only for the same machine. Do not port-forward or tunnel FSD port 6809. No tunnel starts automatically, and no VATSIM traffic is contacted. Tunnel providers process the simulated session data; this feature intentionally permits your invited participant to receive it.

Cloudflare quick-tunnel instructions: https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/ . A public tunnel across two computers has not been verified by local automated tests. Quick tunnels are temporary development/testing connections, not an availability guarantee.
