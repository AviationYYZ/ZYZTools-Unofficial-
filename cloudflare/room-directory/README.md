# ZYZTools Cloudflare Room Directory — local test build 0.1.0

Status: deployed with the user's approval on 2026-10-25. ZYZTools frontend and existing Windows server EXE remain unchanged.

Deployment URL: https://zyztools-room-directory-test.zyztools-room-directory.workers.dev

Cloudflare version: `5b884ce5-bbe3-492a-afab-e509a612b563`. Upload and trigger deployment succeeded. Initial TLS provisioning delays cleared. Live health and three distinct synthetic session registrations, lookups and cleanup passed on 2026-10-25, including authenticated EuroScope FSD transport through a session tunnel. Local tests passed before deployment. No GitHub publication was performed.

This supplies the *room directory* part of the spare-PC plan. The Worker uses its account's `workers.dev` URL; no purchased domain or router port forwarding is needed for this directory. ZYZTools Server test runs three isolated simulations and per-session tunnels on the spare PC. Desktop test 1.2.36 can resolve their connection codes. See `docs/THREE_SERVER_SETUP.md` in the project for installation and limitations.

## Data and protocol

| Method / route | Purpose |
| --- | --- |
| `GET /health` | Public, credential-free readiness marker |
| `POST /v1/rooms` | JSON `{ "url": "https://SESSION.trycloudflare.com", "token": "64 lowercase hex characters" }`; returns `code`, private `ownerToken`, `expiresAt`, `heartbeatSeconds:45` |
| `GET /v1/rooms/ABCDE-FG234` | Resolve code to session URL and access key, never owner token |
| `PUT /v1/rooms/CODE` | `Authorization: Bearer OWNER_TOKEN`, JSON `{}` to renew or a full replacement URL/token object |
| `DELETE /v1/rooms/CODE` | Host-only immediate revocation |

Ten-character codes contain 50 random bits and are bearer credentials: anyone with one can resolve the session access key. No directory listing exists. Codes expire after 120 seconds without heartbeat, with an absolute 12-hour lifetime. Only a SHA-256 hash of the 256-bit host owner token is stored. Short code lookup does not authorize renewal/deletion. Expired rooms cannot be revived by an old owner token; the host must create a new room.

Each room is a separate SQLite-backed Durable Object. Alarms clean up expired records. Per-client limiter objects enforce five creations, thirty lookups and sixty total API operations per minute. Clients are identified by Cloudflare's trusted ingress header, pseudonymized before naming the limiter; raw IPs are not stored by our application. Idle counters expire. These limits are not a global quota or a complete bot/DDoS defense. Account/platform limits and provider policies still apply.

Cloudflare processes connection metadata and stores active URL/access-key records. Record expiry blocks API access immediately; alarm cleanup is not a promise about the provider's backup/data-retention policies. Invocation logs are disabled and code does not log URLs, room codes, credentials, request bodies or exception details. Responses are `no-store`, with no CORS authorization or cookies. Request bodies are streamed with a 4-KB cap, strict JSON validation and a managed-tunnel hostname allowlist. The directory never fetches caller-provided URLs and cannot forward to arbitrary upstream servers.

## Local tools (Windows)

Node 24+ is required for the tests. For ordinary development, `npm install` in this folder installs the pinned dev dependencies. On this workstation tooling was deliberately installed outside OneDrive:

```powershell
$tools = "$env:LOCALAPPDATA/ZYZTools/WorkerDev/room-directory"
node "$tools/node_modules/wrangler/bin/wrangler.js" types worker-configuration.d.ts --config wrangler.jsonc
node "$tools/node_modules/typescript/bin/tsc" --project tsconfig.json
node --test test/core.test.mjs
node "$tools/node_modules/wrangler/bin/wrangler.js" deploy --dry-run --outdir "$tools/dry-run"
node test/runtime.test.mjs
```

The runtime test uses the dry-run bundle and real local `workerd`/SQLite through Miniflare. `ZYZ_WORKER_TOOLS` can select another tool-cache directory. It deliberately enables local storage inspection to force expiry; that inspection is not in deployment configuration. The test covers owner authorization, renewal, revocation, expiry/no revival, per-client limits, strict input validation and schema recreation after idle storage cleanup. No cloud resources, paid API calls or real aircraft are involved.

## Authorization and deployment gate

Authentication uses the official Wrangler OAuth browser flow. Windows keyring mode keeps the auth config encrypted with an OS-keystore-backed key. Do not paste Cloudflare tokens, passwords, authorization codes or config files into chat. Authentication is separate from publishing.

`wrangler deploy --dry-run` only bundles/validates locally; its “Total Upload” line is an estimate, not an upload in dry-run mode. Do not run a real deploy until the user approves these tested changes. No changes to account plans, billing, domains or GitHub are authorized by this package. Verify the destination account and whether the proposed test Worker name already exists before deployment.

The configured target is `zyztools-room-directory-test`, with SQLite-backed Durable Objects and `workers_dev:true`. Deployment will create/update Worker and Durable Object resources; it does not modify the ZYZTools desktop frontend. It requires user approval. Free-plan eligibility and limits should be checked in the chosen account; this package does not select or purchase a paid plan and is not a zero-cost guarantee.

Official references: https://developers.cloudflare.com/workers/configuration/routing/workers-dev/ , https://developers.cloudflare.com/durable-objects/platform/pricing/ , https://developers.cloudflare.com/workers/best-practices/workers-best-practices/ .
# Global app policy (ZYZTools 2.0)

The existing room directory also serves a separate AppPolicy Durable Object. The
room routes and existing storage migrations are unchanged. The client reads
`GET /v2/policy` and listens to the read-only `GET /v2/events` WebSocket. If the
socket is unavailable, the app refreshes over HTTPS. The last verified rules
are cached locally; existing simulations are not stopped by a policy change.

Before deploying, provision a random 64-hex-character `ZYZTOOLS_ADMIN_KEY` as a
Worker secret through the Cloudflare dashboard or Wrangler's protected secret
input. Never put the key in the app, repository, command line, or chat. The
public Training shortcut only reveals the sign-in panel. Admin sign-in is
memory-only and the Worker authorizes every change. Access codes are random,
stored as hashes, and displayed once on creation. Editing or revoking a code
invalidates all outstanding feature grants, which must then be redeemed again.
The Worker must be deployed before announcements can reach other installations.
App policies govern the listed 2.0 desktop actions; they do not disable older
versions, independently installed EuroScope plugins, or running server slots.
The shared policy catalog lives in `electron-app/src/policy-catalog.json`. When
new policy targets are added, deploy the Worker update before using them.

After the administrator-management Worker update is live, the owner can sign in
with the existing owner credential and issue a separate named administrator
credential from the Admin console. Send it only to that administrator through
a private channel. They can enroll it once on their Windows account and then
use Windows sign-in; the app stores it encrypted with Windows safe storage.
Revoking the account blocks its credential on the Worker, including credentials
already saved on a device. The owner key remains a Worker secret and should not
be shared with delegates.

