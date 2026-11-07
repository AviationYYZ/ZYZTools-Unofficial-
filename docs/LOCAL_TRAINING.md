# Local practice — 1.2.37

Training now has separate **Student**, **Instructor** and **Local practice** views. This page covers Local practice on this PC. For managing three simulations on a spare PC from an instructor client, see [THREE_SERVER_SETUP.md](THREE_SERVER_SETUP.md). Scenario Builder remains separate. The former AI/ChatGPT pilot and all automatic voice/readback features have been removed.

ZYZTools is an offline aircraft simulator and classic-FSD traffic source. It does not launch EuroScopeFsdServer.exe, authenticate online, contact VATSIM/SweatBox, forward packets or make outbound network calls from the training module. Test listens on 127.0.0.1:6809; production uses 127.0.0.2:6809. No listener starts automatically. Closing ZYZTools disconnects its radar clients. Do not expose/forward the port.

## Quick start

1. Open Scenario Builder and import CZYZ.sct again. The app also reads the adjacent CZYZ.ese and navdata/airway.txt if present. No sector/navdata files are modified or uploaded.
2. Optionally load an ASR display profile to select map layers, fix symbols/names, window bounds and rotation. It is not a pixel-identical EuroScope renderer: plugin graphics/fonts, regions and free text are not reproduced.
3. Enter callsign/type, initial feet/IAS/magnetic heading, origin/destination and filed route. Select the arrival runway, then place the spawn on the map or use a named fix. Saved geographic headings remain true internally.
4. Set minutes plus seconds AFTER Run, never UTC. Zero means immediate. Add/update saves the aircraft. Switching edit selection, Start and Export also commit a dirty aircraft editor so delays are not silently discarded. Changing coordinates manually clears a stale named spawn fix.
5. Export the initial scenario as a reusable .zyztraining.json file. It includes used fix coordinates, compiled route, runway geometry and chart-speed rules, not moving aircraft positions or credentials.
6. In Training → Local practice start the local server. Wait for LISTENING, then connect EuroScope as described below. Press Run.

Load two-aircraft demo is available for a synthetic first test. Stop the server before editing initial scenario aircraft or importing data. Duplicate creates another aircraft/callsign/squawk; adjust its position and delay. Pending aircraft do not appear on the radar until their simulation-clock delay. Pause stops the whole clock; Reset deletes spawned aircraft and restores the schedule.

## Connect EuroScope without VATSIM

Disconnect from any existing session. Choose the normal direct connection mode (misleadingly labelled Direct to VATSIM), not Start SweatBox simulator session. Server is exactly 127.0.0.1 for test or 127.0.0.2 for production, without a port suffix or AUTOMATIC. UNCHECK Connect to VATSIM. Use dummy ID/password/name and a controller callsign/rating, e.g. TOR_APP, not OBS if flight-plan editing is needed. Never enter actual credentials.

The listener accepts at most four loopback clients. Login lines/passwords are neither logged nor retained. A port conflict fails closed; there is no public fallback. If the app shows no TCP connection while EuroScope reports a VATSIM/non-VATSIM mismatch, check the exact address, LISTENING state and checkbox; never solve it by enabling VATSIM. Old 6819-port instructions are obsolete.

ZYZTools cannot stop the user independently connecting EuroScope or unrelated plugins to the Internet. Leave unrelated online features disabled for isolated practice. This is not a firewall/sandbox.

## One filed route, including airways and STARs

There is no separately editable simulated route. The filed route is compiled into navigation fixes:

- BOXUM DUVOS ADSED: explicit fixes.
- YUY B7 REZIN: connected airway entry/exit, with intermediate fixes expanded from local navdata/SCT.
- OTNIK BOXUM7 CYYZ/23: runway-specific STAR and transition from ESE.
- BOXUM7 with arrival runway 23: the procedure's own named entry is used if unambiguous.

Unknown fixes/procedures, disconnected airways, ambiguous geographic names or missing runway/transition choices are rejected rather than skipped. Airways are generic undirected geometry for simulation, not a validation of airway direction, minimum altitudes, restrictions, NOTAMs or AIRAC currency. The app does not guess procedures from chart artwork. Imported ESE/navdata must match the sector and desired cycle. Automatic route expansion is local; no online route lookup is made.

The route preview shows expanded fixes and approximate leg distances/ETAs. Those fixes are available to the pilot's DCT command. DCT retains the filed route after that fix where available. Vectors suspend route following; ROUTE RESUME resumes it. Fly-by anticipation uses speed, turn rate and adjacent leg lengths, followed by outbound-leg guidance rather than orbiting an overflown fix.

A portable compiled route can be reopened without the original sector files. Changing its route or runway requires the relevant local navdata again. Initial scenarios are capped at 100 aircraft, 2,000 used waypoints and 1 MB on import.

## EuroScope flight plans, runway and squawk

Flight plans are sent on login, spawn, query and amendment, never every position tick. EuroScope $AM edits update the running plan and rebuild its expanded route; vectors remain active until a navigation instruction. Initial exported setup is unchanged. Filed altitude is sent in feet. EuroScope disables editing for observers or aircraft tracked by someone else.

Standard runway assignments encoded in the route (e.g. CYYZ/24R or a STAR/runway suffix) update the simulator's selected arrival runway. That selects both its approach geometry and matching speed branch. Controller scratchpad/track/temp-altitude metadata does not itself issue a pilot maneuver.

The initial squawk is both transmitted and announced as assigned at spawn. Later assigning another code in EuroScope does not secretly change the pilot transponder: issue a pilot squawk instruction or SQ. Duplicate codes/standby may prevent correlation. EuroScope's Accept pilot squawk is an optional client fallback, not automatically changed by this app.

## Aircraft controls and generic flight model

- ALT 5000: target altitude in feet; RATE 1500 sets vertical-rate magnitude in ft/min.
- IAS 210 or SPD 210: assigned indicated knots, overriding published speeds.
- SPEED PUBLISHED: cancel the assigned-speed override and resume the automatic training speed profile below.
- HDG/LHDG/RHDG 270: shortest/left/right magnetic-heading vector. DCT FIX / ROUTE RESUME control navigation.
- APP CLEAR / APP CANCEL: arm or cancel the simulated ILS for the selected runway.
- PAUSE ON / PAUSE OFF: freeze or resume one aircraft while the others and spawn clock continue.
- SQ 5636, IDENT and MODE C/STBY control the transponder.

Buttons expose individual pause, approach clear/cancel, assigned IAS and published speeds. Status shows the current runway, IAS/TAS, pause/approach state, speed mode and coverage notices.

New aircraft use IAS; older TAS scenarios retain their initial speed basis. ISA density approximates IAS/TAS conversion, with no wind, compressibility/Mach or aircraft-specific performance. Turn rate is bank-limited up to 3 degrees/s; acceleration/deceleration is 2 knots/s. Motion updates at 10 Hz; radar samples publish at 1 Hz for prediction-plugin compatibility.

### Simulated ILS

APP CLEAR requires an assigned arrival runway with imported geometry. Vector to a suitable intercept and altitude. Localizer capture anticipates rollout using speed/turn radius within 25 NM; the generic 3-degree glidepath captures only from below/near the beam with lateral alignment. A centred arrival reaching the threshold stops as simulated touchdown. Heading vectors retain armed approach clearance; APP CANCEL explicitly cancels it. A new DCT cancels approach mode. Physically unsuitable intercepts may require corrective vectors or lower speed. Client 1.2.39 and server 0.3.0 use the revised guidance.

This is a sector-centreline/3-degree training approximation, NOT an instrument-approach database: no localizer frequency, displaced-threshold/antenna model, published glide-slope/DA/minima, approach lighting, terrain, missed approach, runway closure, wind or certified landing model. CYYZ aerodrome elevation is 569 feet; other imported runway elevations default to zero unless supplied in scenario data. Never use it for navigation.

### Automatic training speed profiles (client 1.2.43 / server 0.3.3)

Automatic aircraft-type/phase/altitude speeds now apply by default, including migration of old scenario opt-outs. The bundled 447-type EuroScope performance dataset provides normal speeds; 270 knots IAS above 10,000 feet and 250 at/below are ceilings, not forced speeds for slower aircraft. Planned downwind is capped at 210. Assigned IAS overrides automation until SPEED PUBLISHED. Stationary ground aircraft are not accelerated. A new explicit editor opt-out retains initial speed when desired.

Downwind uses runway geometry and terminal position, up to 12,000 feet. Approach clearance/capture now enables progressive slowing: 180 by 12 NM, 160 by 7 NM, a training final IAS by 4 NM. Typical jet/heavy/turboprop targets are 140/150/120, with slower light-aircraft targets. These are training assumptions, not real Vref; late commands cannot guarantee speeds already reached. Named REQALT initial descents are imported and manual ALT overrides them. No wind is simulated; GS equals TAS, not IAS. See [TRAINING_SPEED_PROFILES.md](TRAINING_SPEED_PROFILES.md) for provenance, migration, limitations and tests.

Legacy chart rule data remains readable for file/protocol compatibility but is no longer flown or offered as an editable speed system. This is an offline simulation profile, not actual chart, regulatory or aircraft-performance guidance. Commands accept up to eight comma-separated instructions (512 characters), e.g. `LHDG 330, ALT 3000, IAS 210`. All are checked first; an invalid instruction applies none. DELETE must be sent alone. Use `.LHDG 330, ALT 3000` from EuroScope for an explicitly left turn; HDG alone selects the shortest turn.

## Verification limits

Automated tests cover delayed/reset/repeated spawns, editor autosaves, separate spawn positions, fly-by/outbound guidance, pause, synthetic localizer/glidepath capture/rejection, IAS conversion, runway-specific speeds, route expansion/cache, real loopback FSD amendments and instructor/student authorization. Packaged/runtime checks do not establish behavior in every EuroScope build. Validate with synthetic aircraft before complex scenarios. No VATSIM login is used during tests.

Routes accept both `RAGID6` and `RAGID RAGID6`. Import the matching SCT with its adjacent ESE, set destination CYYZ, and select the arrival runway.

