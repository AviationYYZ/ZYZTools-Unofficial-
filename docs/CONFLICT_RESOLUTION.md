# Conflict resolution

| Overlap | Decision |
|---|---|
| Electron helper versus native EuroScope UI | Replace Electron with the existing dark `CRadarScreen` console. |
| Helper-owned Hoppie versus plugin-owned Hoppie | Plugin owns Hoppie; only normal EuroScope chat uses the native helper. |
| `. / R / X` versus `> / RX / TX / TXH` | CYYZ states replace the visible status; legacy tag registration remains available. |
| Duals-only route amendment versus CYYZ operation calculator | One calculator handles all operations and NCD. It also drives PRWY. |
| Old fused/duplicated route tokens versus `SID/RWY` | Replace with first-token `SID/RWY` amendment. |
| TELEX Hoppie clearance versus correlated CPDLC | Use the retained incoming request ID in a correlated CPDLC response. |
| Five-second synchronous polling versus 45–75-second polling | Use a 60-second default and a background HTTP worker. |
| Hardcoded SID assignments versus editable configuration | JSON is the only runway-assignment source of truth. |
| Old and new config names | New file is authoritative; the old file is read only for migration. |
