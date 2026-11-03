# Independent instructor pilot tags — test 1.2.51 / server 0.4.7

Update BOTH apps. Close instructor EuroScope and update its ZYZTools DLL using
Install / Link. Stop/exit the old server app from its tray before updating it.
Restart the private slot and reconnect both EuroScopes: NORMAL DIRECT connection,
dummy credentials, Connect to VATSIM UNCHECKED. Never use public SweatBox/VATSIM.
EuroScope is not needed on the server PC.

## New tag UI

In Training → Instructor, pair and use Connect my EuroScope for the slot. Allow
ZYZTools to draw on your radar display/ASR types. Blue ZYZTools PILOT data blocks
appear beside visible active aircraft without needing track ownership or selection.
The compact monospace rows and leader lines are inspired by the installed CSiT
family; they are not an exact reproduction of Situ's proprietary drawing.

- LEFT-click a blue field to open its dropdown (middle-click works too).
- Use Previous/Next to page through options. No typed-value popup is required.
- Drag the callsign header to reposition a tag; its leader line follows the plane.
- Orders stay blue after selection. A pending request has a small ~; a failed order
  has a red ! and an error message. Acknowledgment is not assumed from local entry.
- Long names can be shortened visually; hover for the full callsign/field/value.

| Field | Dropdown values / meaning |
| --- | --- |
| ALT | Feet, 500–60,000 in 500-foot increments |
| IAS | Knots, 80–400 in 5-knot increments |
| HDG | Magnetic degrees, 5–360 in 5-degree increments |
| RATE / R | Positive climb/descent magnitude, 500–6,000 FPM in 250-FPM increments; ALT determines direction |
| DCT / D | Remaining route fixes first, then embedded scenario fixes |
| SQ | Scenario actual/assigned squawks plus common training codes; leading zeroes retained |
| APP | CLEAR arms the assigned runway ILS; CANCEL cancels it |

Other command-bar/dashboard actions remain available, e.g. pause, delete or a
specific value outside the dropdown increments. Ordinary Situ tag edits on EITHER
client are shared controller annotations, not pilot commands. The new tag sends
independent authenticated pilot requests and never modifies those annotation fields.
Selecting the same value already shown in the student's tag therefore still works.

## Green checks

A green check means the latest STUDENT annotation for that field matches the
instructor's acknowledged order. It does NOT mean the plane has reached the altitude,
speed or heading, or completed an approach. Incoming annotations never maneuver planes.

Instructor-authored annotations cannot confirm their own orders. When another
controller owns the track, the matching annotation must be from that controller;
otherwise a different connected controller's last annotation is used. Use different
instructor/student callsigns. Checks disappear if the student changes to a mismatch,
the author disconnects, the order is pending/failed, or the scenario/session changes.
An already matching student annotation may confirm a newly acknowledged order.

The order and matching cache is scoped to the instructor connection/session; it is
not saved across app restarts or scenario resets. Tag positions reset with a new
session. Both clients see actual tracking ownership; there is no fake-owner override
or automatic instructor assumption. Normal Situ Assume/handoff menus remain normal.

## Refresh and limits

Aircraft positions still publish every FIVE SECONDS, fixed. Physics continues at
10 Hz; a new maneuver may not appear on radar until the next sample. Order and
annotation indicators poll separately (approximately once per second).

Situ DLLs, profiles and tag definitions are not edited. These are additional ZYZTools
tags, so drag them away from existing Situ tags as needed. Synthetic two-client tests
cover matching provenance, identical values, dropdown endpoints, role/peer/session
gates, ownership and reset. A standalone native harness renders the same tag drawing
code. The DLL compiles against your SDK. Actual EuroScope dropdown/drag behavior
still needs user testing; no public-network connections or publication were made.
