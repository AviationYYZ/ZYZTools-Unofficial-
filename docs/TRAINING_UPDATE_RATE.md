# Aircraft updates and ZYZTools training prediction line

Update the desktop test app and hosted server app. Update the client EuroScope
DLL through Install / Link with EuroScope closed to enable the prediction line.
All testing and connections must stay on localhost or your private server.

## Faster position updates

Choose **Aircraft position updates** in Local practice, the Instructor session
section, or each server dashboard slot:

- **1/sec:** previous cadence; compatibility fallback for third-party PTL plugins.
- **2/sec:** new balanced default, approximately one position batch per 500 ms.
- **5/sec:** one position batch per 200 ms, with higher multiplayer bandwidth.

Hosted settings persist per slot and apply live to all its participants. Local
practice stores the rate in exported scenario JSON. Physics still integrates at
10 Hz; update rate does not accelerate time, change turns, speeds, spawn delays
or reset a session. Commands retain their immediate position publication.
Periodic updates do not resend flight plans or reset tags. Delayed timer callbacks
do not emit catch-up bursts. The authenticated tunnel read wakes when data arrives.

This changes outgoing server cadence, not EuroScope's own display refresh or
radar filtering. Network latency and client redraw settings still apply. Synthetic
tests verify delivery, not compatibility with every external PTL implementation.

## Independent prediction-line option

In Instructor choose **ZYZTools prediction line · selected training aircraft**:
Off, 1, 2, 3, 5 or 10 minutes. Off is the default. Use Connect my EuroScope and
select an active aircraft in EuroScope. The updated DLL draws a cyan dotted line
with one-minute marks on that radar screen. Turn off the external PTL if using
this alternative, to avoid two overlapping lines. External plugins are not altered.

The line projects the latest reported true heading and reported groundspeed;
it does not estimate speed by dividing successive positions by whole-second
timestamps. It therefore does not depend on whether samples arrive at 1, 2 or
5 Hz. IAS is not substituted for groundspeed. The preference is local to each
test/production desktop installation, not a shared student/server setting.

This is a constant-motion reference, not an intended-route/turn predictor or a
separation guarantee. The local instructor binding, active simulated callsign list,
direct connection and verified loopback socket gate its visibility; stale bindings
expire. It sends no aircraft commands and never connects to a live network.

The projection math, binding scope and UI are covered by automated tests. Actual
in-EuroScope visual validation and external PTL coexistence still need user testing.
