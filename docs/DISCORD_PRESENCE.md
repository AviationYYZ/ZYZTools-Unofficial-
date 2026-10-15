# Discord controller status

Install the new test app, close EuroScope, and use Install / Link to update its matching plugin. Reload EuroScope and keep the ZYZTools app open (minimized is fine). Open Discord status, enable it, customize the fields and save. Discord desktop must be running with activity sharing enabled.

The shared public Discord Application ID is 1560430298968105010. No user token, bot, personal Application ID or developer account is required. The application name and uploaded image assets are managed in its Discord Developer Portal.

Status is off by default. Test and production settings and plugin heartbeats remain separate. Enable only one app at a time to avoid competing for the same Discord profile's activity.

## Traffic

- Callsigns ending in _APP or _CTR: count every flight plan whose tracking controller is you. Airport selection does not restrict owned tags.
- Other positions: enter ICAO airports separated by commas, spaces or semicolons. Count each aircraft once near those airports, below the configured ground-speed limit and within the airport-elevation tolerance. This includes ground departures, landed arrivals and local traffic regardless of filed route. It is an estimate; low flying aircraft can occasionally qualify.
- Defaults: radius 4 NM, elevation tolerance 300 feet, maximum groundspeed 60 knots. Moderate starts at 6 aircraft and heavy at 15. All are editable.
- Airport reference: mwgg/Airports public JSON, fetched on first use and cached in the app's own user-data directory. VATSIM public data refreshes at most once a minute. Network/Discord failures back off for a minute. Unknown airports and stale/unavailable data clear presence rather than falsely displaying light traffic.

## Customization and privacy

Status and image-hover text support {position}, {airports}, {count}, {traffic}, {source}. Expanded lines are limited to 128 characters. Optional uploaded image asset keys and two HTTP(S) buttons are supported. Button labels allow 32 characters. Clear both button fields to remove a button. Discord may hide buttons when viewing your own activity.

Your connected position, traffic summary and selected links become public on your Discord profile. No pilot names, CIDs or aircraft lists are exported by the plugin. Only controller callsign, network-connected flag, owned-tag count, session start and heartbeat time are written to local DiscordPresence.json.

The heartbeat updates every five seconds. Disable the setting, disconnect EuroScope or close either application to clear presence. A crashed plugin is treated as disconnected after 20 seconds plus the five-second polling interval. The feature never changes aircraft data or controller assignments.

## Verification

Automated tests use mocked Discord IPC and synthetic VATSIM/airport records. They cover handshake framing and fragmented responses, activity acknowledgement, ping/pong, customization validation, radar/ground modes, deduplication, caching, network failures, disconnects, stale heartbeats and disabled preferences. A real-account Discord profile check remains part of user testing.
