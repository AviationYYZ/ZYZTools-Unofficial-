# Separate instructor pilot controls — test 1.2.50 / server 0.4.6

Update both apps. With instructor EuroScope closed, use Install / Link to update
its ZYZTools DLL. Restart the private slot and reconnect both clients using dummy
credentials, NORMAL DIRECT mode and Connect to VATSIM UNCHECKED. Never connect to
VATSIM or public SweatBox. The server PC does not need EuroScope.

## How to control a plane

1. Use Training → Instructor → Connect my EuroScope, then complete the private
   EuroScope connection. Ensure ZYZTools is allowed to draw on your ASR display.
2. Click an aircraft to select it (ASEL). A small PILOT strip appears at the bottom
   of the radar. It names the selected aircraft and its actual tracking owner.
3. MIDDLE-click the strip's ALT, HDG, IAS, RATE, DCT or SQUAWK field, enter a value,
   and press Enter. ALT uses feet, HDG magnetic degrees, IAS knots, RATE positive
   feet/minute magnitude, DCT an embedded scenario fix, SQUAWK four octal digits.
4. MIDDLE-click APP CLR to arm the assigned runway's ILS. Its existing interception
   and altitude requirements still apply. Typed command-bar/dashboard controls
   remain available for other actions (e.g. approach cancel, pause, delete).

The SDK does not expose another plugin's tag-field middle-clicks to ZYZTools, so
these are separate ZYZTools screen objects, NOT an invisible modification of Situ.
VATCAN Situ's DLL and tag layout are untouched. Left/right clicks on the strip do
not issue commands. A popup is bound to its original aircraft and session; a stale
popup cannot command a replacement session. Requests are not retried automatically.

## Student annotations and ownership

Regular Situ data-block edits on EITHER client are shared controller annotations,
not pilot instructions. Scratchpad changes are shared too. Pilot-strip actions go
directly to the authenticated instructor API and never set controller-assigned
altitude, speed, heading, rate, direct-to or scratchpad fields. Therefore selecting
the same value as the student's annotation works and does not overwrite it.

The pilot strip shows brief three-second submission feedback. Actual acknowledgments
or errors appear in EuroScope messages. The aircraft target persists after the
feedback clears. This version retires the old regular-click/restore mechanism.

There is NO private ownership override and no automatic assumption of unowned
targets. Use normal Situ Assume/track and handoff menus with different sector-defined
callsigns. On acceptance the real owner is published to both clients. Instructor
pilot-strip control remains independent of the student's tracking ownership.

## Fixed refresh

Aircraft position samples publish once every FIVE SECONDS (0.2 Hz), not five times
per second. The rate controls are disabled and legacy rates migrate to 0.2 Hz.
Physics continues at 10 Hz; pilot commands take effect in the simulation immediately
but the next radar position may take up to five seconds to arrive. Initial spawn,
late-join snapshots and removal messages are lifecycle events, not periodic refreshes.
The optional ZYZTools selected-aircraft PTL remains a constant-motion reference.

Synthetic two-client tests cover identical student/instructor values, repeated
commands, shared annotations, real ownership on both sockets and retired legacy
tag controls. The DLL builds against the installed SDK. Full middle-click popup
and drawing behavior in the actual EuroScope/Situ UI still needs user verification.
Nothing is published until the user approves the tested build.
