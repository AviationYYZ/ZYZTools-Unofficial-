# Instructor data-block controls (local test)

Update the desktop app, the instructor ZYZTools EuroScope DLL through Install /
Link (with EuroScope closed), and the private server app. Keep VATCAN Situ as-is;
no Situ DLL or source changes are made. Native simulation mode remains removed.
This build also includes the previously paused position-rate and optional PTL work.

## Connect

1. Stop the old server slots and exit its app from the tray before updating. Open
   the updated server app, enable instructor access, load/start the scenario and Run.
2. Pair in Training → Instructor and click Connect my EuroScope for the slot.
   Complete a NORMAL DIRECT EuroScope connection to the copied local address,
   Connect to VATSIM UNCHECKED, dummy credentials. Never use public SweatBox.
3. The student joins using the separate student invite/connector and a normal
   direct/private connection, also with dummy credentials and VATSIM unchecked.
4. Use DIFFERENT callsigns/positions defined in your sector pack, e.g. an upstream
   CTR position and the student's APP position. Both can keep VATCAN Situ loaded.
   The same callsign cannot log in twice. The server PC does not need EuroScope.

## Control an aircraft

Use its normal Situ/EuroScope assigned-data fields:

| Instructor field | Aircraft action |
| --- | --- |
| Temporary/assigned altitude | ALT in feet; ILS selection requests APP CLEAR |
| Assigned IAS | IAS in knots |
| Assigned heading | Magnetic heading; 360 means north |
| Assigned rate | Positive ft/min magnitude; altitude target determines climb/descent |
| Direct-to | DCT to a fix already embedded in the scenario |
| Assigned squawk | Aircraft squawks the code; student assigned-code annotation is retained |

Instructor pilot-control annotation messages are filtered BEFORE reaching the transport/server/
student. An SDK callback AND a matching outgoing local annotation are required
before issuing a pilot command; incoming student annotations alone cannot command
an aircraft. Ordinary instructor scratchpad notes ARE shared with the student and
remain there; they do not clear after three seconds. H/S/R or known-fix scratchpad
encodings are pilot controls and stay private. Arbitrary notes are not commands.

The temporary entry restores after roughly three seconds (SDK-only fields restore
on the next EuroScope timer callback). It restores the LATEST student annotation,
including changes during those three seconds, without undoing the maneuver.
Re-editing restarts the overlay timer. Student edits remain controller annotations.

Initially unowned aircraft are genuinely assumed by the instructor connector, so
the student sees the instructor as owner and can receive handoffs. It never steals
a student-owned track. The instructor also sees a private ownership view so tag click spots remain
usable while the student owns the real track. That view is not published as real
tracking ownership. Pilot control and real track ownership are separate. Disconnect
the instructor connector before changing roles.

## Handoffs

Update BOTH desktop 1.2.49 and server 0.4.5 for this fix. Reconnect both EuroScopes
after restarting the updated slot. The server PC still does not need EuroScope.
Classic handoff offer/accept packets and ownership queries are now handled, not
only synthetic test metadata. Drop, recall and refusal update the shared owner state.
Controller position reports are relayed/cached so separate sector-defined positions
can appear in EuroScope. An upstream instructor may offer an unowned aircraft to
the connected student through the standard handoff UI. Acceptance gives the student
real tracking ownership; pilot control remains instructor-only. Already owned tracks
can only be offered by their actual tracking controller. Recall/disconnect clear
pending offers. Matching sector position definitions are needed for Situ menus.

## Limits and verification

- SDK assigned-data fields only: if a custom Situ field emits an unsupported wire
  format, use the existing command box/bar. Unchanged displayed values may not
  generate an edit event. No automatic retries after uncertain command outcomes.
- Mach, visual-approach selection, filed cruise altitude and arbitrary scratchpad
  text are not pilot tag controls in this version. Use IAS and the supported fields.
- Synthetic two-client tests cover privacy, fragmented TCP, latest-value restore,
  SDK/wire correlation, role/session rejection, control and handoff state. The DLL
  compiles against the installed SDK. Full in-EuroScope Situ menu/visual testing
  still needs user verification; this is a local test build, not a compatibility guarantee.
- The separate non-native 06R→05 route report is not fixed by this change.
