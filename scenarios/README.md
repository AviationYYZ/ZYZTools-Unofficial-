# Toronto synthetic training pack

Use ZYZTools non-native training only, on localhost or your private server. These
are synthetic exercises built from your installed CZYZ SCT/ESE/navdata (AIRAC 2603
headers), not a claim of current chart currency, actual traffic or safe separation.
All coordinates and runway geometry used by these flights are embedded in JSON.
No EuroScope installation is required on the server.

## Load

Update desktop to 1.2.48 and server to 0.4.4; stop slots and exit the old server
from its tray before installing. In Training → Instructor, pair/select the slot,
Load scenario → select a JSON below → Start paused → Run. Use separate instructor
and student connectors and dummy credentials, never VATSIM/public SweatBox.
For localhost use Local Practice / Scenario Builder instead.

For other scenarios, re-import CZYZ.sct once in Scenario Builder. The new import
also reads adjacent navdata/isec.txt and icao.txt and airway endpoint fixes. It does
not change your sector files. Global lookup points stay out of map clutter;
type the fix in the route or spawn-fix box. Ambiguous names need explicit custom
coordinates. Cached pre-1.2.48 imports will not gain those files until re-imported.

## Exercises

| File | Traffic injection |
| --- | --- |
| CYYZ-West-65-per-hour.json | One hour: LINNG3 20/h, NUBER6 15/h, BOXUM7 10/h, IMEBA9 10/h, RAGID6 10/h. BOXUM/IMEBA land 23; others 24R. 65 arrivals. |
| CYYZ-West-65-15NM-SFI.json | New 65/h variant using the close-entry 15 route NM setup and randomized, fleet-matched airline callsigns/types. Initial Situ SFI scratchpads: ` N` for 23 (20 aircraft), ` R` for 24R (45 aircraft). Requires app 1.2.56 / server 0.4.11 or newer. |
| CYYZ-West-65-15NM-SFI-Instructor-Owned.json | Same SFI/fleet/15NM exercise, with initial ownership assigned to the authenticated instructor EuroScope. Requires app 1.2.57 / server 0.4.12. Use Instructor → Connect my EuroScope before Run; use a unique instructor callsign. Delayed aircraft inherit ownership when they spawn. Accepted handoffs and intentional drops are not reclaimed. Older scenarios keep their existing behavior. |
| CYYZ-East-40-per-hour-with-departures.json | One hour: 8/h on each STAR, 40 total arrivals. BOXUM/IMEBA land 05; others 06R. Also 10 runway-05 airborne departures. |
| CYYZ-West-10NM-spacing-20min.json | Separate exercise: 11 aircraft on each STAR, approximately 20 minutes of injection. Same west runway mapping, but successors spawn at 10 NM from their own stream predecessor under the default model. 55 arrivals. |

For the original three exercises, spawn is 35 route NM before the bedpost at 17,000 ft. The new 15NM-SFI variant preserves the existing close-entry version: 15 route NM before the bedpost, 14,000 ft for LINNG/NUBER/BOXUM and 11,000 ft for IMEBA/RAGID. Automatic
descent at 2,250 FPM reaches 11,000 ft by LINNG/NUBER/BOXUM, and 8,000 by IMEBA/RAGID.
It levels there until you issue ALT. Manual ALT overrides this initial target.
Routes use actual installed transitions and runway-specific continuations. IAS
profiles are enabled. Clear approaches and issue vectors/altitudes as instructor;
approach clearance is NOT automatically issued. Uncontrolled aircraft can conflict.

East departures spawn airborne shortly beyond runway 05 at 1,800 ft, starting
+2 minutes then every 6 minutes. Select each and assign ALT (e.g. ALT 7000), then
vectors/DCT as desired. These are synthetic straight-ahead climb-out exercises,
not a modeled ground roll, taxi system or published SID. Their filed cruise level
does not automatically authorize a climb. All aircraft have distinct squawks.

## Why two west versions?

A 20/h stream has 180-second intervals; a 10/h stream has 360-second intervals.
At realistic groundspeeds these cannot also all be 10 NM apart. The hourly-rate
version preserves your requested rates. The 10-NM version calculates intervals
using the actual simulator movement model, so its rates are different. Its 10 NM
applies at stream injection only, not throughout turns, deceleration, merged streams
or later instructor interventions. It is not a separation guarantee.

Default/new aircraft now use 2,250 FPM; explicitly saved scenario rates are retained.
Manual RATE overrides the default. A captured ILS glidepath controls descent rate
instead. Per-file manifests list rates, runway allocation and bedpost targets.
