# Instructor commands inside EuroScope — client 1.2.40

## Setup

1. Update the instructor desktop app to **ZYZTools test 1.2.40**. With EuroScope closed, use **Install / Link** to install/update its plugin DLL. Updating only the desktop EXE is not enough for `.sim` or selection tracking.
2. Update the server PC to **ZYZTools Server test 0.3.1** for the accompanying approach-turn fix. Stop sessions and exit the old server app from the tray before updating.
3. Pair the instructor, select the server slot and click **Connect my EuroScope**. In EuroScope connect to the copied local address with Connect to VATSIM unchecked, dummy credentials and a unique instructor callsign. Keep the desktop app running.
4. Click an aircraft/tag in EuroScope so it is ASEL-selected. The instructor dashboard follows the selection, normally within a few seconds. Command-bar instructions read the current selection directly, without waiting for the dashboard poll. Normal manual selection in the dashboard remains available.

This connection stays bound to the server shown in EuroScope. Merely switching the dashboard to another slot does not redirect EuroScope commands. A new aircraft selection switches the dashboard to the connected slot. Disconnect the old connector before using Connect my EuroScope for another server.

## Command bar

Select the aircraft, then enter a command beginning with `.sim`:

| Example | Action |
| --- | --- |
| `.sim ALT 5000` | Target altitude, feet |
| `.sim RATE 1500` | Vertical-rate magnitude, ft/min; ALT determines climb/descent |
| `.sim SPD 210` or `.sim IAS 210` | Assigned IAS, knots |
| `.sim HDG 240` | Shortest turn to magnetic heading |
| `.sim LHDG 240` / `.sim RHDG 240` | Left/right turn to magnetic heading |
| `.sim DCT LERAT` | Direct to a known scenario fix |
| `.sim APP CLEAR` | Clear approach for assigned arrival runway |
| `.sim APP CANCEL` | Cancel approach guidance |
| `.sim PAUSE ON` / `.sim PAUSE OFF` | Pause/resume this aircraft |
| `.sim SQ 4321` / `.sim IDENT` | Transponder code / IDENT |
| `.sim MODE C` / `.sim MODE STBY` | Transponder mode |
| `.sim SPEED PUBLISHED` | Resume available scenario speed rules |
| `.sim ROUTE RESUME` | Resume route navigation |
| `.sim DELETE` | Delete selected aircraft from the live session immediately |
| `.sim help` | Display command reference without executing an instruction |

The input is consumed as a plugin command, not sent as a radio/chat clearance. The plugin first reports queued, then displays applied or an error in EuroScope's ZYZTools TRAINING messages. Only an applied acknowledgement establishes success. Do not blindly repeat a timed-out command; check the dashboard first. Commands are not automatically retried. Only one command per plugin instance waits for acknowledgement at a time. DELETE typed explicitly is immediate; the dashboard button still asks for confirmation. Reset/reload restores deleted aircraft.

## Approach clearances while turning

If an aircraft is still turning to an assigned heading, APP CLEAR keeps that heading target until the turn finishes, then permits localizer capture. It does not freeze the aircraft on its current intermediate heading. A straight-in aircraft, or one following its route without a pending heading vector, can capture normally. Clear sufficiently early: finishing a late or unsuitable vector can leave too little distance to intercept physically, requiring corrective vectors. The generic flight model and below/near-beam glideslope limits still apply.

## Isolation and privacy

The plugin checks that its own EuroScope process has an established TCP connection to this channel's loopback training connector on port 6809. The desktop app checks the connector's actual client port/controller login, active paired instructor role, connected slot, scenario session and selected simulated callsign. Commands go only to the simulator instructor API; they do not amend live VATSIM aircraft. Student-only connections, playback/other network connections, stale selections and expired session capabilities fail closed.

The local adapter listens only on 127.0.0.1:6815 (test) or :6816 (production), starts when Connect my EuroScope prepares it, rejects browser-origin requests, and uses an ephemeral capability in the channel-private `%APPDATA%\ZYZTools-test\TrainingCommands` or `%APPDATA%\ZYZTools\TrainingCommands` folder. No key, server access token or login is printed. Normal app exit removes the binding. Test and production DLLs/apps must stay matched. This is an accidental-cross-connection safeguard, not protection from malicious software running as the same Windows user.

Tests exercise the compiled Windows helper's process/socket check and HTTP command/acknowledgement path with synthetic FSD traffic, plus dashboard selection and stale/role/session rejection. Actual tag clicking and command-bar UI behaviour must still be checked in the user's EuroScope build and tag setup; the implementation uses the SDK's current ASEL APIs, never a last-rendered-aircraft guess.
