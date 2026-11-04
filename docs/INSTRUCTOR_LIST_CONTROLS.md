# Instructor controls in Sector Inbound and Sector Exit lists

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
