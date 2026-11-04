# Instructor controls in Sector Inbound and Sector Exit lists

## Recommended: the independent All Aircraft list

Desktop test 1.2.60 adds **ZYZTools test - All Aircraft** (production name:
**ZYZTools - All Aircraft**). It opens automatically after Instructor → Connect
my EuroScope is active and the private EuroScope connection has logged in. The
columns and click functions are supplied by ZYZTools: no Situ list setup is needed.
Server 0.4.13 remains compatible; update/relink only the instructor app/DLL.

Every active simulated aircraft with a received flight plan is explicitly added,
without CTR/APP facility, sector inbound/exit, tag ownership or radar-view filters.
Unspawned scheduled aircraft are not real targets yet; they appear when spawned.
Deleted/disconnected targets are removed; disconnecting the instructor binding
clears/hides this list. It is not populated from public/live-network flight plans.

Actual ALT / IAS / HDG columns sit beside independent P ALT / P SPD / P NAV
targets. Click either altitude cell for altitude/approach, either speed cell for
IAS (left) or Mach (right), and either heading/navigation cell for heading (left)
or direct-to (right). Next opens direct-to. Type opens Advanced, including preset
speed restrictions, squawk/IDENT and confirmed deletion. Callsign left toggles
route drawing; right opens normal handoff. Owner shows actual tracking ownership.

Pilot targets are blue; a green `+` means the student's annotation matches.
Pending orders have `~`, failed orders `!`. This is not proof a maneuver is complete.
You can move/resize/scroll the list using EuroScope's normal list controls. Default
columns are added only when the list has no saved column configuration; your
existing Sector Inbound/Exit lists and live/student profiles are never modified.

## Optional: keep using Sector Inbound / Exit

Requires desktop test 1.2.59 and its linked DLL plus server 0.4.13 for the latest
heading/ILS behavior. The list column bindings introduced in 1.2.58 are unchanged.
Use only your private training connection through Instructor → Connect my EuroScope.

EuroScope exposes separate item and click-function settings for list columns.
In your INSTRUCTOR profile, open the column settings for each list and keep the
current item provider (Situ or built-in). Change only the click-function provider
to the loaded ZYZTools plugin and select the functions below.

| Existing column | Left-click function | Right-click function |
| --- | --- | --- |
| Altitude | ZYZTools PILOT: altitude | ZYZTools PILOT: altitude |
| Speed | ZYZTools PILOT: IAS | ZYZTools PILOT: Mach |
| Heading / navigation / exit fix | ZYZTools PILOT: heading | ZYZTools PILOT: direct waypoint |
| Aircraft type or another convenient column | ZYZTools PILOT: advanced | ZYZTools PILOT: advanced |

Select the aircraft's row first (ASEL), then click the configured cell. The same
compact dark-gray dropdowns used by the radar tag will open. Altitudes use 080
for 8,000 feet; Advanced includes squawk, IDENT, approach-related restrictions,
clear speed restrictions, and confirmed deletion. Cleared approach is in altitude.
Direct-to offers route fixes and typed entry.
Heading offers custom magnetic entry and Fly present heading. Advanced includes
the six named speed-restriction slots saved in the app's Instructor settings.

Save this layout in your dedicated instructor profile. Do not copy these click
bindings into your live-control or student profile: the student's normal Situ
functions should stay unchanged. The installer does not modify any profiles or
existing list columns automatically.

List cells retain their existing actual/Situ data display. Pilot targets and
student-match checks appear in the separate ZYZTools radar tags. Pilot actions
never write controller annotations just to make list text change.

The clicked/selected aircraft and private session are checked when opening the
menu, and captured again for submission. Changing ASEL while a menu is open does
not redirect its command to a different aircraft. Commands are refused without
an active instructor binding; this feature does not control live-network aircraft.

Native list interaction still needs testing in EuroScope; synthetic command,
session/role and target-binding regressions and SDK compilation are checked locally.
