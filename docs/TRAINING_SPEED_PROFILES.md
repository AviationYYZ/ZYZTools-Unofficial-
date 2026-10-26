# Automatic aircraft speeds — client 1.2.43 / server 0.3.3

Install both the updated desktop client and the updated server on the spare PC. Updating the client alone does not replace the remote simulation engine. Reload the scenario after updating. Reimport original TXT scenarios to recover their REQALT metadata; old exported JSON did not retain that information.

## Default and manual override

Automatic speeds now initialize every aircraft by default, including old JSON scenarios with `publishedSpeeds:false`. This obsolete flag no longer silently keeps aircraft at initial/cruise speed. New scenarios can explicitly opt out using the aircraft editor checkbox (`automaticSpeeds:false`), retaining the entered initial IAS/TAS. Ground aircraft with zero speed remain stationary.

IAS/SPD commands override automatic speed in the running session. `SPEED PUBLISHED` resumes automatic performance and arrival scheduling. Reset restores the saved initial policy, not a previous session's manual instruction. Manual speed commands remain authoritative during approach. IAS is not ground speed: in this no-wind model GS equals TAS, with ISA density conversion.

## Performance and ceilings

447 aircraft types come from the MIT-licensed [VATSIM EuroScope performance repository](https://github.com/vatsimnetwork/euroscope-performance-data/tree/6dcc431a07e41a83450ac72a0f141b8a8f29b9e1). The bundled data and full copyright/license are `electron-app/src/training-performance.txt` and `training-performance-license.txt`. SHA256 of the unmodified data: `4dbc5583ea2110a0b7ecf1a8131282a3f72cd2bb183198483fccce8737e01d41`. No network fetch occurs during simulation.

The selected climb/cruise/descent column is interpolated by altitude. Mach rows are converted through the simulator's ISA model. Your 270 IAS above 10,000 feet and 250 at/below are ceilings, not speeds that force a slower prop aircraft to accelerate. Descent anticipates the 10,000-foot crossing. Unknown types use a labelled generic training fallback. This reuses the published performance DATA, not EuroScope's proprietary engine or exact algorithm, and is not a certified aircraft model.

## Arrival and approach

- Planned downwind turns anticipate slowing to no more than 210 IAS; naturally slower aircraft remain slower. Recognition requires runway geometry and a terminal route/vector (up to 12,000 ft, within 60 NM; planned downwind fix within 40 NM). Immediate vectors cannot guarantee an already-achieved speed.
- An armed approach within 25 NM is capped at 210. After localizer capture, deceleration anticipates 180 IAS by 12 NM, 160 by 7 NM and the final training target by 4 NM. No approach/final schedule is inferred without approach clearance/capture and matching runway geometry. Late clearances cannot retroactively meet an earlier gate.
- Final defaults: most jets 140 IAS, recognized heavy types 150, turboprops 120 and light aircraft lower (C172: 70). These are explicit TRAINING assumptions, not weight/configuration/weather-dependent real Vref. A scenario author can set `finalApproachIAS` (50–190) for an individual aircraft. Manual IAS remains an override.
- Touchdown sets IAS and GS to zero. Pause/reset, delayed spawns and ground protection are unchanged.

## Initial scenario descent

Named `REQALT:FIX:feet` and equivalent old $ROUTE initial-target fields are retained in exported scenarios as `initialDescent`. The simulator attempts to reach the altitude before that fix, allowing for turn lead. Rates are bounded by generic performance-derived training limits; too-late targets receive a status notice instead of an altitude jump. A manual RATE remains authoritative and may miss the fix; manual ALT replaces/cancels the initial target. Approach cancellation holds current altitude and also cancels the initial target. A route amendment removing the target fix cancels its automatic guidance.

Off-route REQALT targets are omitted with an import-review warning, not by omitting the aircraft. Empty-fix takeoff/climb targets are still unsupported; ground/takeoff behavior is not invented. General route slash-altitude constraints, full STAR vertical profiles, per-scenario PERFAC/PERFLINE overrides and IASVARIATION remain unsupported and reported.

Automated checks cover data integrity, migration/opt-out, aircraft-type/Mach behavior, default spawn speed, final speed gates through touchdown, manual override/resume, REQALT/ALT precedence, delayed/ground protection and the user's 44-aircraft ARR - 06 Hard file. These tests do not establish parity with EuroScope or real aircraft operations.
