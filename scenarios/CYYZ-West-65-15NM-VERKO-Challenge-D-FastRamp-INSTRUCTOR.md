# Challenge D — fast ramp, coherent origins

Load `CYYZ-West-65-15NM-VERKO-Challenge-D-FastRamp.json` on your private server.
No expanded-waypoint workaround is used: filed routes retain bedpost + STAR +
CYYZ/runway notation. Origins and airline/type pairings now agree with each
entry direction; east/European origins are not randomly put on west-entry STARs.

All five streams are active by 20 seconds (0, 6, 12, 16, 20), with three more
aircraft at 116, 137 and 152 seconds. The first ten spawn by 245 seconds.
There are still 65 total first-hour arrivals: LINNG3 20, NUBER6 15, BOXUM7 10,
IMEBA9 10, RAGID6 10. This is a front-loaded schedule, not a constant 65/hour
instantaneous rate or guaranteed landing throughput.

Prior rules remain: west flow, BOXUM/IMEBA to 23 with ` N`; other streams to
24R with ` R`; 15 route NM before each bedpost; instructor initial ownership;
/v/ remarks; 2250 FPM descent; 11000 by LINNG/NUBER/BOXUM and 8000 by IMEBA/RAGID.
Speed profiles are controlled by the server, not this scenario file. Use the
supplied seven-band default table on the server/instructor panel for the
calibrated conflicts; the manifest records the verification profile. You can
change it mid-session, but that changes the encounter timings and severity.

Five LINNG/NUBER merge encounters near VERKO remain calibrated offline with the
default server profile. Their callsigns and exact elapsed timings are in the manifest.
Expect them around 12, 24, 35, 47 and 59 minutes if you make no interventions.
Normal instructions change timings, and approach-cleared aircraft are excluded
from CA by design. Other final/stream merges still need normal control.

Connect the instructor through Connect my EuroScope before Run. App/plugin test
1.2.66 supplies the new slots, wheel-only dropdowns and predicted CA locations;
server 0.4.15 persists the speed profile and contains the go-around fix. The
manifest is reference only, not an import.
