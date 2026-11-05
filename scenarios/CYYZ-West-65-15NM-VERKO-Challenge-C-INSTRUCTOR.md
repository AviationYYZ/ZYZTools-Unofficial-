# VERKO Challenge C

Load **CYYZ-West-65-15NM-VERKO-Challenge-C.json** through Instructor > Load scenario.
The manifest is optional reference information, not an import file.

Install app/plugin test 1.2.65, link the updated DLL and restart EuroScope. Server
0.4.14 remains compatible. In the linked app's Conflicts page, enable conflict
alerts and Save. Connect instructor EuroScope through Connect my EuroScope before
Run to register initial instructor ownership. Use only your private server.

This is 65 scheduled arrivals in the first hour, not guaranteed landing throughput:
LINNG3 20, NUBER6 15, BOXUM7 10, IMEBA9 10, RAGID6 10. BOXUM/IMEBA use runway 23
and ` N`; all other streams use 24R and ` R`. All remarks include `/v/`. Entries
remain 15 route NM before their bedpost, not 15 NM inter-aircraft spacing.

Default descent is 2250 FPM. LINNG/NUBER/BOXUM descend from 14000 to 11000 by their
bedpost; IMEBA/RAGID descend from 11000 to 8000. The screenshot speed profile is
explicitly saved in the scenario, in inclusive upper-altitude/IAS pairs:
1999/136, 2999/160, 3999/200, 8100/210, 11099/230, 15000/250, 60000/270.
Before approach clearance the instructor target altitude chooses the band;
after clearance the actual altitude does. Manual speed instructions override it.

## Deliberate conflicts — instructor spoilers

Times are elapsed since Run; interventions change the timings. Each row lists
the LINNG3 aircraft first and the NUBER6 aircraft second. Without intervention
they converge near VERKO at FL110.

| Pair | Aircraft | Approximate VERKO gate time | Closest sampled encounter near VERKO |
| --- | --- | --- | --- |
| 1 | POE2260 / JZA6108 | 11:36 | 11:59 |
| 2 | KLM5713 / ACA7732 | 23:19 | 23:42 |
| 3 | UAL7613 / POE2790 | 34:54 | 35:17 |
| 4 | DAL3709 / BAW7844 | 46:35 | 46:58 |
| 5 | BAW2615 / AAL7152 | 58:16 | 58:39 |

Offline physics validation checked all bedpost targets and five designated pairs
under 1 NM horizontal at the same altitude while both within 2 NM of VERKO.
A separate native C++ alert replay used 161 samples at five-second intervals:
all five pairs produced warnings before 3 NM loss. Tests also confirmed either
aircraft's simulator approach clearance or Situ ILS/visual status suppresses
alerts in both immediate and predictive scans. This is not a live EuroScope UI
test or a guarantee of exactly five alerts elsewhere in the exercise.

Approach-cleared aircraft are deliberately excluded, including while approach
is armed before capture. To test these conflicts, do not mark those aircraft
cleared for approach beforehand. Approach cancellation restores eligibility,
provided Situ has not independently retained its cleared-approach status.

Native alert enable/mute preferences are not silently changed. The status line
identifies private simulator vs EuroScope radar data. If it says Disabled, enable
and save in the correct linked app/plugin copy. Flights still need normal
sequencing and approach clearances to land. No real airline schedule is used.
