# Independent instructor pilot tags — test 1.2.59 / server 0.4.13

Update BOTH apps. Close instructor EuroScope and update its ZYZTools DLL using
Install / Link. Stop/exit the old server app from its tray before updating it.
Restart the private slot and reconnect both EuroScopes: NORMAL DIRECT connection,
dummy credentials, Connect to VATSIM UNCHECKED. Never use public SweatBox/VATSIM.
EuroScope is not needed on the server PC.

## New tag UI

Sector Inbound and Sector Exit list clicks can use the same pilot controls. See
INSTRUCTOR_LIST_CONTROLS.md for the one-time instructor-only column bindings.

In Training → Instructor, pair and use Connect my EuroScope for the slot. Allow
ZYZTools to draw on your radar display/ASR types. Independent ZYZTools data blocks
appear beside visible active aircraft without needing track ownership or selection.
The three compact rows match the user's reference: callsign, actual altitude /
groundspeed, then aircraft type / destination. They use the EuroScope font and
CSiT base palette. Actual data stays visible; instructor targets appear beside it
in blue, with student-match checks. Altitude targets use three digits without a C
prefix: actual 110 and assigned 080 means 11,000 feet and target 8,000 feet.

- LEFT-click for the primary control; RIGHT-click for its secondary control.
- Dropdowns have a compact scrollable list. Use the wheel or scrollbar; there
  are no Next/Previous pages. Lists are dark gray, with eight compact visible rows.
  Squawk and custom direct-to use text entry.
- Drag the callsign header to reposition a tag; its leader line follows the plane.
- Orders stay blue after selection. A pending request has a small ~; a failed order
  has a red ! and an error message. Acknowledgment is not assumed from local entry.
- Long names can be shortened visually; hover for the full callsign/field/value.

| Field | Left click | Right click |
| --- | --- | --- |
| 1 · Altitude (second row, left) | 010–600 in steps of 010 (1,000–60,000 ft), plus Cleared approach | Same (middle click too) |
| 2 · Groundspeed / speed target (second row, right) | 80–400 knots IAS in 5-knot increments | Mach 0.40–0.99 |
| 3 · Destination / navigation target (bottom row, right) | Magnetic heading, 5–360 degrees in 5-degree increments | Direct-to: route fixes first, or Type waypoint |
| 4 · Callsign (top row) | Toggle EuroScope route drawing | Standard EuroScope handoff menu |
| 5 · Aircraft type (bottom row, left) | Advanced options | Same (middle click too) |

Rate remains available in the command centre; default descent rate is 2,250 FPM.
There are no separate rate, approach or direct-to buttons cluttering the tag.

Heading menus (radar tags and configured list cells) also offer Enter custom
heading and Fly present heading. Custom entry accepts any whole magnetic degree
000–360, not just the five-degree presets. Fly present heading samples the actual
aircraft heading on the server when executed, ends its current turn/route guidance,
and holds that heading. It does not use the last five-second radar sample. The
command-bar equivalent is `HDG PRESENT`.

## Saved speed-restriction slots

In Instructor → Scenario and session → Speed restriction presets, fill up to six
slots with a name, knots IAS and until-waypoint, then click Save restriction presets.
Blank rows disable slots. Entries appear as Preset 1–6 in each aircraft's Advanced
menu, including when opened from a list cell. The aircraft must still have that
waypoint ahead in its route; invalid or unavailable fixes are rejected.

Slots are stored in this app's local settings, independently for test/production,
not embedded in the scenario or shared with students. Applying a slot creates the
same runtime restriction as typed IAS-until-fix. Normal fix-passage release and
Clear speed restrictions return the aircraft to its automatic speed profile.

## Higher straight-in ILS interception

The synthetic localizer capture range is now 35 NM. Glideslope interception has
no separate altitude cutoff: tests cover 6,000 feet on 05/06R/23/24R and up to
10,000 feet on 23. Capture does not climb the aircraft onto the beam. The aircraft
must meet the modeled three-degree glidepath from below or near it; 6,000 feet
MSL is roughly 17 NM from a YYZ threshold in this model. At 6,000 feet close in,
it is above the beam and will not dive/teleport down to capture.

The selected-aircraft dashboard reports whether it is waiting below the beam or
above it, including current glidepath altitude. These are simulation defaults,
not certified ILS service volumes or chart procedures.

## Advanced restrictions

Advanced also contains Enter squawk and IDENT. Setting a squawk never prints
that code on the instructor tag. Callsign handoffs use EuroScope's normal ownership
rules and the private simulator's coordination; they do not force track ownership.
Existing enabled ZYZTools conflict alerts colour the instructor callsign and show
CA (including urgent flashing), using the same correlated-aircraft checks/stages.

- Custom speed restrictions: enter `170 UNTIL KIREX`. Speed is IAS. The fix must
  be ahead on the aircraft's route. Add multiple fixes to queue successive speeds;
  the earliest upcoming fix wins. The speed is held until that fix sequences
  (turn entry for a fly-by fix), is reached within 0.15 NM, or is passed abeam
  within 1.5 NM. This geometric release also works on vectors/ILS when earlier
  STAR fixes are still unsequenced. After the final restriction, automatic speeds
  resume and the expired blue target disappears. A new normal IAS/Mach/published command replaces
  all queued speed restrictions. Advanced always offers Clear speed restrictions:
  it clears manual speed overrides too and switches back to automatic speeds.
- Crossing altitude restrictions: enter `LINNG AT 11000` (feet). The aircraft
  continuously adjusts its vertical rate to meet the upcoming route fix, allowing
  for fly-by turn lead. It never teleports. Required rates are capped at 6,000 FPM;
  impossible crossings are reported as unable/missed rather than guaranteed.
  Restrictions suspend on vectors or a captured ILS; return to route to resume.
  A normal ALT command replaces crossing restrictions. Advanced offers Clear
  crossing restrictions; clearing retains the last assigned target altitude.
- Delete aircraft requires a second selection to confirm, and removes the target
  from the simulator and radar feed. Cancel leaves it untouched.

The same commands work in the command centre: `IAS 170 UNTIL KIREX`,
`CROSS LINNG AT 11000`, `RESTRICTIONS SPEED CLEAR`, `RESTRICTIONS ALT CLEAR`.
Skipped restriction fixes retire on the next simulation step. Scenario reset
clears all runtime restrictions. Paused aircraft do not advance their restrictions.

## Default jet IAS profile

Edit the altitude/IAS table in Scenario Builder → Automatic jet speed profile,
or Instructor → Scenario and session → Automatic jet speed profile. Ceilings are
inclusive whole feet MSL, strictly increasing, ending at 60,000 feet; IAS is
50–400 knots. Apply explicitly. Local profiles save with exported scenarios;
instructor edits are scoped to the selected slot and saved on the server PC.
Manual assignments stay unchanged until cleared. Restore defaults populates the
table; click Apply to activate it. Non-jet profiles are not changed by this editor.

| Altitude (feet MSL) | Target IAS |
| --- | --- |
| Ground–1,999 | 136 knots |
| 2,000–2,999 | 160 knots |
| 3,000–3,999 | 200 knots |
| 4,000–8,100 | 210 knots |
| Above 8,100–11,099 | 230 knots |
| 11,100–15,000 | 250 knots |
| Above 15,000 | 270 knots (existing high-altitude default) |

These are simulation targets, not chart or aircraft operating limits. The lower
band owns exactly 8,100 feet, and gaps in the requested bands continue the lower
band. Actual IAS changes gradually, at the existing acceleration/deceleration rate.
All jets use the same schedule; old downwind/final speed caps no longer override
it. Non-jets retain their aircraft-specific profile. Manual assignments and custom
restrictions override automatic speeds. Stationary/landed aircraft remain stopped.

## Automatic aircraft cleanup

Touchdown and completion of the filed route send a radar disconnect and remove
the simulated aircraft. A vector-only aircraft with no route does not disappear;
an approach-cleared aircraft stays until touchdown, even after its route ends.
Reset restores the scenario's initial aircraft and schedule as usual.

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
