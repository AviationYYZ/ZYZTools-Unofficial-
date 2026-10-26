# EuroScope SweatBox import — desktop test 1.2.39

Use Load scenario under **Training → Instructor**, or Import in Scenario Builder. Both accept `.txt` EuroScope scenarios and existing ZYZTools JSON. Conversion happens on the instructor/client PC. Update the server to **0.3.0** for the new turn, approach, runway-transfer and deletion fixes; updating only the client does not replace the hosted simulation engine.

Import the matching SCT/ESE/navdata into Scenario Builder first. Scenario coordinates and ILS geometry come from the chosen file; named route fixes must exist in the imported catalogue. No online fix lookup, chart guessing or source-file modification occurs. The original flight-plan text is retained; an explicit `$ROUTE` supplies the converted navigation path, including old procedures whose current STAR name differs. Routes without overrides require matching local flight-plan navdata.

The importer handles aircraft positions, transponder mode/code, flight plans, initial heading, reusable routes, runway/ILS geometry and START delays in **minutes after simulation start**. Flight-level-style cruise altitude values are converted to feet. Files may be UTF-8, UTF-16LE or Windows-1252. It never executes directives or loads referenced scripts.

Every text import displays a compatibility review before loading/uploading. Cancel is the default. Review the imported count, rejected aircraft and unsupported features; accepting a partial import explicitly omits listed rejected aircraft. Duplicate aircraft/ambiguous records block import. An unmatched flight-plan callsign is reported, never guessed or silently renamed. Invalid ILS definitions are omitted with a warning. Current airport identifiers are limited to four letters.

This is conversion into the existing ZYZTools simulator, **not the complete EuroScope simulation engine**:

- Airborne aircraft use a visible training speed approximation: 210 IAS below 10,000 feet, otherwise 250 IAS. Scenario position records normally have no initial speed. Review/edit speeds before Run.
- Ground aircraft are stationary: no automatic taxi, takeoff or ground-collision simulation. Their filed plans are retained but ground navigation is disabled.
- REQALT, route altitude restrictions, INSTRUCTION, DELAY, IASVARIATION, predefined route menus, holdings, controller/pseudo-pilot assignments, METAR and PERFAC/PERFLINE are not executed. Warnings identify these. Use instructor commands for altitude, speed, approach and aircraft motion.
- Published-speed automation defaults off for converted scenarios; old scenario procedures must not silently inherit new chart constraints.
- ILS is the existing generic centreline/3-degree model; a suitable vector/altitude and APP CLEAR are still required. Importing geometry does not automatically clear the aircraft for approach.

The 17 files in the user's `Documents/sweatbox/ES` folder were checked against the installed CZYZ sector without modifying them. Sixteen offered at least some compatible aircraft: 361 convertible and 23 explicitly rejected among those files. `GND - 23 Pri Sec.txt` was blocked for duplicate aircraft records. Ground/departure file counts include stationary aircraft, not working taxi/takeoff simulation. Results depend on matching local navdata; this is not universal compatibility or AIRAC validation. No source scenarios are redistributed in the installer.

## Instructor EuroScope view

In Instructor select a running/paused slot whose tunnel is ready, then click **Connect my EuroScope**. ZYZTools retrieves that slot's student transport credential internally, verifies the remote session, starts the channel-private local connector and copies its address. No invite/key copy is required. In EuroScope choose the normal direct connection, leave **Connect to VATSIM unchecked**, use dummy credentials and a unique instructor callsign, then paste the local address (port 6809). Do not start a second simulator. The same server generates traffic for student and instructor; each EuroScope installation still needs its own matching sector/ASR/plugins for a matching visual display.

If a local practice server or another connector is already active, the button refuses to replace it. Stop local practice, or Disconnect under Student, before changing servers. The instructor uses one of the slot's existing three remote EuroScope connections. Closing only the instructor connector does not stop the simulation or disconnect the student.

Format reference: https://www.euroscope.hu/wp/scenario-file/

## Guidance fixes in 1.2.39 / server 0.3.0

Motion uses TAS-dependent coordinated-turn geometry with a 25-degree bank limit, 3-degree/second rate cap, and gradual bank changes (5 degrees/second). Route fly-by lead and localizer capture use the same turn-radius model. These are generic training assumptions, not measured aircraft-specific handling: the inspected scenario PERFAC/PERFLINE tables do not define an exact bank/roll model.

Localizer capture anticipates rollout, follows a damped centreline intercept and still rejects reciprocal/behind-threshold capture. APP CLEAR remains armed through heading vectors; APP CANCEL explicitly cancels it. A new DCT still cancels the approach. Glideslope capture remains from below/near the beam and requires lateral alignment; high aircraft are not forced to dive onto it. Late or physically impossible intercepts may still need corrective vectors, less speed or re-sequencing.

Imported runway inference prefers the arrival-end suffix/explicit ILS route, and emitted flight plans end with a canonical destination/runway token. Position is sent before the initial flight plan so the receiving client already knows the aircraft. Test EuroScope with matching sector/ASR data; protocol tests do not establish identical graphics in every third-party plugin.

Delete selected aircraft removes it from the current live session and sends a radar removal to connected controllers. The confirmation explains that Reset/reloading restores the original scenario, including deleted aircraft. Other aircraft and sessions continue. Student keys still cannot issue manual aircraft deletion.
