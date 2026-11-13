# CYYZ AeroView

Open **Controller Tools → Calculators → CYYZ winds and ATIS** in ZYZTools and click **Open AeroView**. Keep the AeroView window open; it can be minimized. No instructor pairing, server URL, or code is needed. ATIS appears in that card. In EuroScope, type `.winds on` to display both field winds or `.winds off` to hide them. Keep the desktop app open and install its matching EuroScope DLL.

Each desktop reads its own AeroView window; there is no central distribution of live observations.

The server dashboard's **Open AeroView** button opens the normal NAV CANADA CYYZ page in an isolated window. Keep it open. The observer switches between the two field tabs once a minute and reads only visible wind and ATIS widgets. It does not log in, use private endpoints, or replace missing wind with METAR.

Live forwarding is disabled by default. Only after verifying that your use and recipients are permitted by NAV CANADA, launch the server with the process environment variable `ZYZTOOLS_AEROVIEW_RELAY=1`. The relay uses the existing authenticated instructor connection. It is not exposed on student invites or publicly.

Source: NAV CANADA AeroView. For simulation and informational use only. Reports may be delayed or unavailable; missing and stale readings are not substituted.
