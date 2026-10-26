# ZYZTools — instructor, student and server PC

Install `ZYZTools-Server-Test-Setup-0.3.0.exe` on the spare Windows PC. Install `ZYZTools-Test-Setup-1.2.39.exe` on instructor/student PCs. They remain separate installed apps. No Node.js, EuroScope, purchased domain, router port forwarding or separate cloudflared installation is needed on the server PC. Training does not connect to VATSIM.

Reviewed EuroScope SweatBox `.txt` import and **Connect my EuroScope** are under Instructor. The 1.2.39 guidance fixes require server **0.3.0**: the simulation runs on the server, so updating only the client will not fix hosted aircraft motion. Stop sessions and exit the old server app from its tray before updating. See [SWEATBOX_IMPORT.md](SWEATBOX_IMPORT.md) for conversion limits.

## Pair the instructor once for this server-app run

1. On the spare PC open the server app and click **Enable instructor access**. No aircraft slots need to be started first.
2. Wait for its single **instructor pairing code**, then copy it privately to the instructor. This grants management of **all three slots**. Never give it to a student.
3. On your own PC open **Training → Instructor · server PC**, enter the code and Pair with server PC. Optionally select Remember to store this connection encrypted for this Windows account. Reconnect saved server retrieves it later; nothing is stored without opt-in.
4. Keep the server app running, or close its window to the tray. Enabling instructor access is remembered and starts it again at the next server-app launch. Enable/disable remote access on the server PC; all normal scenario/aircraft work can now be done from the instructor client.

The instructor connection is independent of individual scenarios and workers. Stopping, replacing or restarting a scenario does not require re-pairing. Because the transport uses temporary tunnels, **restarting the server app or recreating its management tunnel can require a new pairing code**. Remember is not a permanent server hostname/discovery service. Disabling instructor access revokes the old credential. This version requires no changes to the deployed directory backend.

## Instructor workflow — from your own PC

1. Select Server 1, 2 or 3. Each has an independent scenario, clock and aircraft.
2. Click **Load scenario from this PC**, or Load demo. Uploads are validated before replacing the selected slot. Replacement stops/disconnects that slot only; the others continue. The scenario is transferred to the server PC without Remote Desktop or server-side file copying.
3. Scenarios built/exported by Scenario Builder include resolved waypoints and routes. If importing a scenario requiring sector data, import the corresponding sector/navdata into the instructor client first. The server does not invent missing STAR coordinates.
4. Click **Start paused**, then **Copy student invite** once that slot's internet connection is ready. Send the invite to students directly from your client. No return to the server PC to collect per-slot codes is needed.
5. Click Run when students are connected. Pause, Reset or Stop affects only the selected slot. Reset starts from the beginning, paused.
6. Use the **Aircraft dashboard** to select aircraft, issue commands, pause individual aircraft, clear/cancel the simulated approach, and amend flight plans. Instructions can be prepared while the scenario is paused; aircraft move only while running and not individually paused. Altitudes are feet, rates ft/min, speeds IAS, headings magnetic. The input clears on success, stays on failure. There is no AI/ChatGPT pilot, synthetic voice or automatic readback system.

The server PC performs all aircraft simulation. Disconnecting the instructor client leaves sessions running. Students cannot use their session key to upload scenarios, start/stop/reset servers, or manually command aircraft. Genuine controller flight-plan/tag edits through the EuroScope FSD connector remain supported.

## Student workflow

Open **Training → Student · join**, paste the student invite from the instructor, then Join with EuroScope. Copy the local server address supplied by the connector. In EuroScope use port 6809 with **Connect to VATSIM unchecked** and dummy credentials. Do not enter a Cloudflare URL directly into EuroScope. Keep ZYZTools running while connected. An instructor can join the same way in addition to using the management dashboard if they need their own EuroScope view.

Student browser views are read-only. For backward compatibility, optional shared hosting under Local practice still supports manual shared control when hosted by the desktop app itself; server-PC student sessions enforce the new read-only manual-panel role. Do not distribute instructor pairing codes as student invites.

## Availability and startup

Keep the spare PC powered on and online, preferably by Ethernet; disable automatic sleep. The app requests an idle-sleep blocker, but cannot prevent shutdown, power loss, Windows Update, or user-initiated sleep. Use its tray menu **Stop all servers and exit** to shut down. Closing the window only hides it.

Open dashboard when I sign in and per-slot Start paused are optional. Startup runs after Windows sign-in, not before login. Worker crash recovery retries up to three times, restarting only the affected scenario **from the beginning, paused**. It does not restore aircraft positions. Other slots and instructor access continue.

Each slot supports up to three remote EuroScope connections. FSD ports 16801–16803, student panel ports 16811–16813 and instructor gateway port 16820 bind only to loopback. Do not expose them through router rules. The instructor gateway exposes authenticated training operations, not shell commands, arbitrary filesystem paths, host startup settings or arbitrary network proxies.

Treat pairing codes and student invites as passwords; their privileges differ. Codes expire within two minutes after directory heartbeat stops. Cloudflare processes directory/tunnel traffic. Temporary Quick Tunnels are intended for testing/development, have no uptime guarantee, and may change addresses. This test build makes no production-availability guarantee, purchases no domain, and changes no plan/billing setting.

Settings, copied scenarios and bounded logs are in `%APPDATA%\ZYZTools Server test`. Optional client pairing is in that desktop app's distinct user-data folder, Windows-encrypted and never included in source/installer publication. Keys are not written to event logs. Forget saved pairing removes the client copy; disable/re-enable instructor access on the server to revoke all old instructor copies.
