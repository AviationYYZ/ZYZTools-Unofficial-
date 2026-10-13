# TrackAudio processed-transmit tap

The project packages three version-matched private taps:

- TrackAudio `1.4.0` stable, using `afv-native` submodule commit
  `05b6448639cf437056698b93bbc0c68637e49d8b`;
- TrackAudio `1.3.3` legacy stable, using `afv-native` submodule commit
  `55c38743bc2a92ea836e1ca0cead157880c89bb8`;
- TrackAudio `1.4.0-beta.6`, using `afv-native` submodule commit
  `bc93c086a7befd1d68018665a29057f65b4c7c41`.

The official TrackAudio 1.4 line creates a processed controller-transmit
loopback frame in `afv_native.dll`, but normally mixes that frame into a
headset or speaker as audible sidetone. The 1.3.3 stable line has no matching
loopback path, so its tap publishes a privately radio-shaped copy of the
preprocessed transmit frame.

This patch keeps TrackAudio's normal Audio-for-VATSIM processing, publishes the
processed 48 kHz mono transmit frames to
`Local\PreferredCYYZTrackAudioTx`, and removes the playback mix. The PDC replay
helper combines that private transmit tap with TrackAudio's normal rendered
receive audio.

The private tap remains enabled regardless of TrackAudio's microphone-loopback
setting. That setting cannot produce audible self-monitoring in this patched
build because the headset and speaker mixing block is removed.

Result:

- no raw-microphone capture in the PDC replay helper;
- no virtual audio cable or dummy playback endpoint;
- no audible self-monitoring;
- received radio and processed controller transmissions in one replay WAV.

The installer chooses the matching tap by the installed `trackaudio.exe` file
version and refuses unknown versions. Later TrackAudio updates need a fresh
compatibility build rather than reusing one of these DLLs blindly.
