# AI-assisted VATSIM sequencing

The Conflict & Sequencing tab can ask OpenAI for up to three structured maneuver proposals per round. ChatGPT plan sign-in is the default connection; API-key billing is a separate explicit choice. This is a VATSIM simulation aid, not certified ATC or a real-world separation system.

## Continue with ChatGPT

Select Continue with ChatGPT, then finish sign-in and approve plan usage in your system browser. Refresh models to choose from your account's current catalog. Saved account/workspace registrations can be selected or reconnected; Add account / workspace starts a separate registration. Sign-in alone does not prove inference eligibility: the first completed request verifies access. Availability and usage limits depend on OpenAI and your account; this is not unlimited or guaranteed access. Manage usage opens ChatGPT settings. There is no automatic paid API-key fallback.

The main process implements the official public-client OAuth/PKCE loopback flow, validates state and signed ID-token issuer/audience/expiry/nonce/subject, and retains the issued client ID and stable installation host ID. Tokens are saved only in safeStorage-encrypted chatgpt-plan.bin under the channel's user-data directory, never renderer IPC, environment files, DLLs, logs or installers. Test and production stores are separate. Sign out locally removes session tokens but retains the registration; revoke remote app access through ChatGPT settings. Refresh-token rotation is serialized and checkpointed before refreshed identity verification. Browser sign-in uses no API key or client secret.

Plan requests use the public Responses endpoint with OAuth bearer authorization, array input, store=false and stream=true, and require response.completed. Unsupported API-only generation options are not forwarded. Only displayable catalog models are shown, in server order.

Official contract: https://developers.openai.com/siwc/token-sharing-open-source (registration/sign-in, models/inference and preview limitations). No DevKit code or third-party authentication library is bundled.

## Key setup

Choose Import local .env key and select a file containing OPENAI_API_KEY=your-key. The importer also recognizes OPENAI_KEY, API_KEY or a single bare key. It never displays the value. The Electron main process encrypts the key with Windows user-bound safeStorage and stores only the encrypted openai-key.bin in this app channel's user-data directory. OPENAI_API_KEY in the process environment takes precedence.

The developer's project key.env was imported locally for the test app only. It is not copied into source snapshots, DLLs, installers or other users' installations. Every user supplies their own credentials. Test and production encrypted stores are separate. Forget saved key removes the encrypted file, but does not unset an inherited environment variable.

Environment files are excluded by .gitignore, source snapshot traversal and Electron packaging. The source builder also rejects likely literal API keys. Your original .env file is not deleted or uploaded; protect that plaintext file and preferably keep it outside shared/project directories.

## Use

1. Install the test build and update the matching EuroScope DLL through Install / Link.
2. Open .UI, then Conflict & Sequencing. Enable alerts and sequencing, select the two aircraft/order and save.
3. Choose the AI connection and model. Confirm the data-sharing/allowance checkbox, then Ask AI for this order.
4. Wait for an API response and the native validation result. No candidate is displayed as validated until the native plugin acknowledges that request.

Requests are manual, single-flight, limited to one start every 15 seconds and use a 45-second network timeout per generation round plus up to 12 seconds for each native acknowledgement. ChatGPT mode permits at most two rounds: if all proposals fail native validation, it tries one revision with a fresh anonymized snapshot and previous structured proposals. No native rejection prose or callsigns are uploaded. API-key mode remains one round. Cancel stops waiting but cannot undo allowance or charges already consumed. There is no automatic inference polling or automatic aircraft amendment.

HTTP 401, 429, missing credits, incomplete/refused responses and native timeouts are shown as errors. The integration cannot bypass API billing/account limits. Local conflict detection continues if OpenAI is slow or unavailable.

## Data sent

The prompt contains the selected LEADER/FOLLOWER and up to 24 nearby eligible targets renamed T1, T2, etc. It includes positions relative to the leader (NM), altitude, groundspeed, model track, vertical speed, report age, numerical cleared altitude, IAS reference, wake, vector state and up to 64 route-fix coordinates. It does not include callsigns, pilot names, CIDs, remarks, recordings, logs, source files or credentials. Route fix names and geometry remain real aviation data. Requests set store=false; this is not a promise of zero retention by the API provider.

## What the AI can propose

Only bounded typed actions are supported: direct the leader to an existing forward fix; adjust leader/follower IAS within 170–300 kt and at most -40/+30 kt from an available reference; or delay the follower with an offset up to 60 degrees for 20–120 seconds before rejoining an existing follower fix. The model must name a merge fix already in the leader's route and honor an explicitly selected merge fix.

The native plugin does not trust model prose or safety assertions. It renders its own maneuver text after checking current aircraft ownership/eligibility, known fix geometry, speed/vector bounds, desired order, merge spacing, and separation/wake against all eligible aircraft for ten minutes. It includes a ten-second response delay and bounded turns. AI candidates are rechecked approximately every five seconds, discarded if settings change and expire one minute after delivery to the native plugin.

Model ground tracks are not magnetic heading clearances. Terrain, restricted airspace, procedures, weather, actual pilot response, aircraft performance and controller coordination are not validated. Approach-cleared and below-2,000-ft targets are outside the inherited conflict model. A passing model check cannot establish safety; the controller remains responsible for every clearance.

## Verification

Automated tests cover OAuth callbacks/PKCE, signed identity claims, encrypted storage, host/client reuse, rotation serialization, catalog filtering, completed-stream gating, no paid fallback, anonymized payloads, consent, structured requests, rate limits and native acknowledgement. Native tests cover accepted shortcuts and rejection of invented fixes, invalid speeds/vectors and conflicts with third aircraft. UI tests use synthetic responses. Live ChatGPT eligibility, consent and inference cannot be verified until the user signs in. No paid API smoke request is made by the OAuth test suite.
