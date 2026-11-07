# VERKO Challenge B — instructor notes

Load `CYYZ-West-65-15NM-VERKO-Challenge-B.json` using the instructor's Load scenario button. The manifest and this sheet are references, not scenario files. Use only your private ZYZTools server. No application/server update is needed if already using app 1.2.63 and server 0.4.14.

Connect instructor EuroScope through **Connect my EuroScope** before Run so initial instructor ownership is registered. Run starts the elapsed scenario clock; times below are elapsed, not UTC.

## Retained exercise rules

- 65 arrivals injected during the first hour: LINNG3 20, NUBER6 15, BOXUM7 10, IMEBA9 10, RAGID6 10. Timings are deliberately irregular; these are hourly totals, not constant spacing or guaranteed landing throughput.
- West flow: BOXUM7/IMEBA9 runway 23 with ` N` scratchpad; all others runway 24R with ` R`. The leading space is intentional for Situ SFI.
- Spawn 15 route NM before the bedpost, not 15 NM behind the preceding aircraft.
- LINNG/NUBER/BOXUM start at 14,000 ft and descend to 11,000 ft by the bedpost; IMEBA/RAGID start at 11,000 ft and descend to 8,000 ft by the bedpost. Default descent rate 2,250 FPM.
- Automatic speed profiles, initial instructor ownership, unique squawks, airline-matched aircraft types from the previous scenario fleet mappings, and `/v/` in every remarks field.
- New synthetic callsigns, origin selections and injection timings. No real airline schedules are represented.

## Deliberate VERKO encounters — spoilers

Each pair merges from LINNG3 and NUBER6, respectively. Without instructions they remain at FL110 and converge near VERKO. Resolve before the merge using your normal simulated sequencing instructions.

| Pair | LINNG3 aircraft | NUBER6 aircraft | Approximate VERKO gate time | Closest sampled encounter near VERKO |
| --- | --- | --- | --- | --- |
| 1 | POE2246 | JZA875 | 11:36 | 11:59 |
| 2 | KLM6537 | ACA1651 | 23:19 | 23:42 |
| 3 | UAL3434 | POE2508 | 34:54 | 35:17 |
| 4 | DAL8815 | BAW8318 | 46:35 | 46:58 |
| 5 | BAW911 | AAL2535 | 58:13 | 58:36 |

Offline verification used the current simulator with default automatic speeds, one-second observation samples and quarter-second physics steps, with no network connection or instructor commands. All five designated pairs reached approximately 0.14 NM horizontal separation at the same altitude while both within 2 NM of VERKO. All bedpost altitude targets passed. The arrival count, saved/reloaded scenario and reset behavior were also checked.

These are five deliberately constructed encounters, not a promise of exactly five alerts across the airport. Actual CA settings, modified speed profiles, vectors, altitude/speed instructions, pauses and other sequencing decisions can change alert counts and timing. Other stream/final merges still require normal control. Aircraft follow their filed routes; issue approach clearances to land them rather than expecting automatic landings.
