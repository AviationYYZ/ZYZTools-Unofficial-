# Fixed aircraft refresh — 1.2.50 / server 0.4.6

Position updates are fixed at one sample every five seconds (0.2 Hz) across local
and hosted sessions. Legacy scenario/config values 1, 2 and 5 migrate to 0.2 Hz.
The selectors are disabled, and legacy API calls cannot change the interval or
reset its countdown. No burst of old samples is sent after an event-loop stall.

Simulation physics runs continuously at 10 Hz. Commands change simulation targets
without forcing an extra radar sample; the visible maneuver can take up to five
seconds to appear. Spawn/connection snapshots and deletion messages remain immediate.
Dashboard/status polling and local UI repaint are not aircraft sample publication.

The optional ZYZTools PTL uses reported heading and groundspeed, not speed estimated
from update arrival times. It remains off by default. This is not a route prediction
or separation guarantee. See INSTRUCTOR_TAG_CONTROLS.md for separate pilot controls.
