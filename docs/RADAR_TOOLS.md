# ZYZTools radar tools

In **Controller Tools → Calculators → EuroScope radar tools**, set the FixWatch aircraft scope, optional entry alert and leader-line length. In EuroScope, press **Ctrl+Shift+F** and click near a fix, VOR or NDB. Press **Ctrl+Shift+S** and click two aircraft for spacing. **Esc** cancels picking. The commands below still work.

- `.calc` opens the calculator menu. Choose a calculator, enter the comma-separated values in the order displayed, then press Enter. Results appear in the menu. Use groundspeed for time/distance calculations.
- `.leader 0.5 SEL` draws a 30-second track line for the selected aircraft. Use `ALL` for every displayed target or `PICK` to select aircraft by clicking their symbols. Lengths can be 0.5–10 minutes in 0.5-minute steps. `.leader off` clears the lines. Turn off duplicate built-in or third-party prediction lines if desired.
- `.fixwatch VERKO 5 PICK` highlights VERKO and watches selected aircraft for entry inside 5 NM. Click aircraft symbols and choose **Done picking**. Use `ALL` instead of `PICK` for all targets, or radius `0` for highlights and distances without alerts. An aircraft already inside the radius must leave before an entry alert can fire. `.fixwatch clear VERKO` removes a watch; `.fixwatch clear all` removes all.
- `.fixwatch VERKO STAR LINNG3,NUBER6` watches just those arrival streams. Use `.fixwatch VERKO 5 STAR LINNG3,NUBER6` to add a 5 NM entry alert. The alert radius is not drawn.
- Add **ZYZTools: waypoint distance** to your tag layout. It shows only the distance in NM to the nearest matching watched fix, with no duplicate radar label. The highlighted fix itself still shows its name.
- `.spacing` lets you click two aircraft for measured horizontal and pressure-altitude spacing, closure and a ten-minute constant-track closest-approach estimate for pairs within 50 NM. It does not account for future turns, climbs or descents. `.spacing off` clears the pair.
- `.radartools` opens the controls and spacing readout.

These are display and planning aids, not clearance or separation assurance. Settings are session-local; the tools do not issue instructions to aircraft.
