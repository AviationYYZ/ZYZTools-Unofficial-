# ZYZ Instructor home-screen web app

1. Install ZYZTools Server test 2.0.11 or later on your server PC.
2. In **Remote instructor access**, enable access and wait for its code. Copy the iPhone web app link and open it in Safari.
3. Tap **Share → Add to Home Screen** and enable **Open as Web App** if offered. Open the new icon and pair using the current instructor code. Don't share the instructor code with students.
4. Choose a slot, select a spawned aircraft, and review commands before sending. Tap **Change runway or planned route** to amend its flight plan. An aircraft on vectors stays on its assigned heading; if the new route cannot continue to the current next fix, the aircraft holds its heading until you send a direct-to or resume instruction. A changed runway requires a new approach clearance.

The private instructor server must be reachable for traffic, commands and the journal. The installed app caches only its shell and calculators, not the token, roster, or journal. It asks for the code again after a fresh launch. If the server's quick tunnel changes URL, open the new link and recreate the home-screen icon. No App Store install or public VATSIM connection is required.

The editor accepts any valid runway designator. If a runway-only change has no matching STAR, the simulator removes the incompatible STAR and holds heading for vectors or a new route. If the runway has no geometry in the scenario, it can be assigned but cannot be used for a simulated approach. Explicit route edits still resolve named fixes and known STAR variants or are rejected without changing the aircraft.
