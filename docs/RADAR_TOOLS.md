# ZYZTools radar tools

### Toronto-area weather (simulation only)

- `.wx` toggles precipitation. Use `.wx rain lightning` for observed precipitation and lightning density, `.wx vertical` for modeled 700 hPa vertical motion, `.wx all` to combine them, or `.wx off` to hide weather.
- Data: Environment and Climate Change Canada MSC GeoMet. The 700 hPa layer is RDPS forecast pressure velocity: negative values indicate ascent and positive values indicate descent. It is not a live measurement of thunderstorm updrafts, downdrafts, wind shear or microbursts. Lightning density is aggregated, not individual strike positions. No shading does not mean safe conditions.

In **Controller Tools → Calculators → EuroScope radar tools**, set FixWatch defaults and leader-line length. In EuroScope, press **Ctrl+Shift+F** and click near a fix, VOR or NDB to open the FixWatch dialog. Set the aircraft scope, optional STAR names, and entry alert radius, then choose **Start watch**. Press **Ctrl+Shift+S** and click two aircraft for spacing. **Esc** cancels picking. The commands below still work.

- `.calc` opens the calculator menu. Choose a calculator, enter the comma-separated values in the order displayed, then press Enter. Results appear in the menu. Use groundspeed for time/distance calculations.
- `.leader 0.5 SEL` draws a 30-second track line for the selected aircraft. Use `ALL` for every displayed target or `PICK` to select aircraft by clicking their symbols. Lengths can be 0.5–10 minutes in 0.5-minute steps. `.leader off` clears the lines. Turn off duplicate built-in or third-party prediction lines if desired.
- `.fixwatch VERKO 5 PICK` highlights VERKO and watches selected aircraft for entry inside 5 NM. Click aircraft symbols and choose **Done picking**. Use `ALL` instead of `PICK` for all targets, or radius `0` for highlights and distances without alerts. An aircraft already inside the radius must leave before an entry alert can fire. `.fixwatch clear VERKO` removes a watch; `.fixwatch clear all` removes all.
- `.fixwatch VERKO STAR LINNG3,NUBER6` watches just those arrival streams. Use `.fixwatch VERKO 5 STAR LINNG3,NUBER6` to add a 5 NM entry alert. The alert radius is not drawn.
- Add **ZYZTools: waypoint distance** to a compatible tag layout to put the distance inside the tag. Layouts that do not draw the item get a small numeric readout beside the aircraft instead. The highlighted fix itself still shows its name.
- `.spacing` lets you click two aircraft for measured horizontal and pressure-altitude spacing, closure and a ten-minute constant-track closest-approach estimate for pairs within 50 NM. It does not account for future turns, climbs or descents. `.spacing off` clears the pair.
- `.radartools` opens the controls and spacing readout.

These are display and planning aids, not clearance or separation assurance. Settings are session-local; the tools do not issue instructions to aircraft.
