# Challenge C — corrected EuroScope flight-plan routes

Load `CYYZ-West-65-15NM-VERKO-Challenge-C-RoutesFixed.json` instead of the previous
Challenge C file. Stop the current slot, load this file, then start a fresh session
and reconnect the instructor/student EuroScope clients to receive fresh flight plans.
No app or server reinstall is required for this scenario-only correction.

The simulator already had complete navigation paths, but the old file sent STAR
shorthand to EuroScope. This version sends all the named fixes explicitly, ending
with the selected CYYZ/runway. Synthetic spawn markers stay internal. Every filed
fix has been checked against the main PC's installed CZYZ sector catalogue.
Other PCs must also have the matching sector/fix data loaded.

All 65 callsigns, spawn times, actual navigation routes, runway assignments, N/R
scratchpads, /v/ remarks, instructor ownership, bedpost targets and the embedded
speed profile are unchanged. The five VERKO conflicts retain the original C times:

| Pair | Aircraft | Approximate VERKO gate time |
| --- | --- | --- |
| 1 | POE2260 / JZA6108 | 11:36 |
| 2 | KLM5713 / ACA7732 | 23:19 |
| 3 | UAL7613 / POE2790 | 34:54 |
| 4 | DAL3709 / BAW7844 | 46:35 |
| 5 | BAW2615 / AAL7152 | 58:16 |

These timings assume no controller interventions. Existing approach-clearance
suppression still applies. The manifest is reference information, not an import.
Packet tests check every flight plan contains the full named route, and offline
route parsing succeeds without any STAR definitions. EuroScope's actual route
display still needs checking in your private session; no live networks were used.
