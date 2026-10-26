# Private native EuroScope mode (experimental)

The same Scenario Builder remains available: place aircraft on the map or a fix,
edit flight plans and routes, and set delays measured from scenario start.
Export the scenario JSON and upload it from the Instructor page to a stopped slot.
There is no need to copy scenario files manually to the spare PC.

Each of the three slots can independently use ZYZTools or native EuroScope.
The spare Windows PC remains the host. Native mode requires an installed copy of
EuroScope and a logged-in desktop on that PC; EuroScope is not bundled.

## First setup

1. Install the matching Server test update on the spare PC and desktop test update
   on the instructor PC. Keep the existing private instructor pairing.
2. On the server dashboard, choose the installed EuroScope.exe if not detected.
3. Upload the editor scenario to a stopped slot. Select native EuroScope on that
   slot, then start its native relay. Open Native setup for its generated paths.
4. Launch native EuroScope. This opens a dedicated profile; it DOES NOT connect.
5. On the SERVER PC, manually choose Start simulator session, its generated
   loopback address (127.0.0.11, .12 or .13), and the generated scenario.txt.
   Connect to VATSIM MUST be unchecked. Use dummy credentials, never a real CID
   or password. Set Publish simulation data to To everyone, on this PRIVATE relay.
6. On the instructor client, click Connect my EuroScope and use its local connector
   address. Choose Start simulator session, leave Scenario EMPTY, and uncheck
   Connect to VATSIM. Use a unique callsign and dummy credentials.
7. Take simulation using EuroScope's native {} / Get simulation tag function, then
   use its simulator tag/ribbon controls. A tag layout exposing that function is
   required. Student access uses the separate student invite and normal direct
   connection, with Connect to VATSIM unchecked.

Never connect to VATSIM or the public SweatBox service for these sessions.

## Scope and limitations

- This mode relays native simulation messages; ZYZTools does not also move aircraft.
  Pause, run, reset and pilot maneuvers belong to native EuroScope, not ZYZ buttons.
- Changing a scenario requires stopping the slot, uploading, and reloading the
  generated scenario on the server-PC EuroScope. No automatic connection or hot reload.
- Native export currently requires whole-minute delays, one approach airport and
  no more than four used approach runways. Missing runway geometry is an error.
- Editor-resolved fixes are embedded in a minimal sector file. Import/resolution
  must be completed on the client before uploading. This is not a lossless export
  of every custom command, script, taxi definition or performance override in an
  arbitrary original EuroScope scenario.
- Native speed/performance behavior replaces ZYZTools automatic speed profiles.
  The dashboard does not fabricate native IAS, targets or a simulation clock.
- Stop closes the relay, not the native EuroScope window. Close that dedicated
  window yourself when finished; reconnect it after a relay restart.
- The generated profile is isolated from live-network profiles and credentials.
- Synthetic localhost tests cover export, role isolation, transport, lifecycle and
  mixed engine slots. Actual native EuroScope ribbon interoperability has NOT yet
  been verified end to end. Treat this as an experimental local test build.

To return to the existing engine, stop the slot and select ZYZTools simulation.
