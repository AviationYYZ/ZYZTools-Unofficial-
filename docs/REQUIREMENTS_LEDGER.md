# Requirements ledger

| ID | Requirement | Hybrid component | Status | Verification |
|---|---|---|---|---|
| A-001 | Preserve native PDC flag/click routing and confirmation | Plugin tag and modal | Implemented | Source/build |
| A-002 | Preserve Hoppie receive, reject, sounds, and reconnect behavior | Plugin state/Hoppie worker | Implemented | Source/build; live Hoppie pending |
| A-003 | Preserve JSON SID editor and `.setting sids` | Electron settings app with native fallback | Implemented | Source/build; live UI pending |
| A-004 | Preserve clearance and IFR-release hooks | Controller-data callback | Implemented | Source/build; live EuroScope pending |
| A-005 | Preserve native bridge and installer | Bridge/Electron installer | Implemented | x86 and Electron builds |
| B-001 | Use Electron as main settings UI while preserving EuroScope runtime behavior | Electron app plus plugin fallback console | Implemented | Source/build; packaged app pending |
| B-002 | Show `>`, `RX`, `TX`, `TXH` with priority | Status tag | Implemented | Source inspection |
| B-003 | Permit repeat clicks and channel fallback | Send dispatcher | Implemented | Source inspection; live send pending |
| B-004 | Preserve a manually assigned runway; amend SID/RWY only when runway is blank | Shared send-selection path | Implemented | Source/build; live SDK pending |
| B-005 | Manual and polygon NCD priority | Runway calculator | Implemented | Source inspection; live position pending |
| B-006 | Operation/SID/existing/default runway priority | Runway calculator/config | Implemented | JSON and source checks |
| B-007 | PRWY uses the send calculator | `CYYZ_PDC RWY` tag | Implemented | Source inspection |
| B-008 | Exact random `###L`, `###L/NCD`, and post-clearance `NCD` scratchpad | Identifier/scratchpad path | Implemented | Source inspection |
| B-009 | Clear identifier on `PUSH` | Controller-data callback | Implemented | Source inspection; live pending |
| B-010 | Session-only RX/TX/TXH | In-memory maps | Implemented | Source inspection |
| B-011 | Hoppie receipt never auto-sends PDC | Incoming parser | Implemented | Source inspection |
| B-012 | Immediate correlated Hoppie reply after click | Click send path | Implemented | Source/build; live Hoppie pending |
| B-013 | 45–75 second polling and link test | Worker/settings UI | Implemented | Source/build; live network pending |
| B-014 | East Duals assigns MIXUT to 06L | Default JSON | Implemented | JSON validation |
| B-015 | Native x86 build and installer | Build scripts | Implemented | Local build |
| C-001 | Continuously retain the newest configured replay window of receive audio | Native WASAPI helper/ring buffer | Implemented | System and process capture smoke tests |
| C-002 | Save replay from a EuroScope button, `.REPLAY`, or an editable dot-prefixed command; browse/play saved replays in EuroScope | Recordings UI/command dispatcher | Implemented | Source/build; live EuroScope click pending |
| C-003 | Capture only TrackAudio radio output and never unrelated system audio | TrackAudio root process-tree loopback | Implemented | Live process-tree switching tests |
| C-004 | Save timestamped WAV files and close helper with EuroScope | WAV exporter/named-pipe shutdown | Implemented | WAV validation and exit-code smoke test |
| C-005 | Include the controller's Audio-for-VATSIM-processed transmission, not a raw microphone track | Private shared-memory taps for TrackAudio 1.4.0 stable, 1.3.3 legacy stable, and 1.4.0-beta.6 after VHF/radio processing; no audible sidetone mix | Implemented | Native module inspection, tap integration tests, live PTT user acceptance |
