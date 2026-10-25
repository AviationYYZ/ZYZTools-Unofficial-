# ZYZTools Room Server 0.1.0 — spare Windows PC

This is the room-code backend only. It does not simulate aircraft, connect to VATSIM or change the current ZYZTools frontend. The frontend will be connected to this API in a later change.

## Install on the spare PC

1. Send `ZYZTools-Room-Server-Setup-0.1.0.exe` to the spare Windows 10 PC. It is a standalone EXE with the tunnel helper embedded. Keep a copy so you can reopen setup later.
2. Open it and click **Install / update local server**. Approve its Windows administrator prompt yourself.
3. Click **Check local server**. It should say HEALTHY for `http://127.0.0.1:6813`.

The installer creates **ZYZTools Room Directory**, an automatic Windows service running as the limited **Local Service** account. It starts at boot without signing in. Closing the setup window does not stop the service. Installation does not open firewall ports, alter router settings, disable Windows security, stop other servers or change power settings. Keep the PC powered on and awake; configure its sleep schedule yourself if necessary.

Requires Windows 10 with .NET Framework 4.x. This is an unsigned local test build. If Windows/security software blocks it, do not disable protection or bypass a safety warning; report the exact message. No Node.js or terminal commands are needed on the spare PC.

## One-time stable internet address

Short connection codes need a directory address all ZYZTools clients know. A temporary `trycloudflare.com` URL is not a stable address and cannot solve that bootstrap problem by itself.

Using Cloudflare's official dashboard:

1. Use your own Cloudflare account and domain. If you do not have a domain, stop here: the local server can be installed/tested, but a stable hosting/address choice is still required. The EXE does not create accounts or buy anything.
2. Create a remotely managed named Cloudflare Tunnel.
3. Add a public hostname such as `rooms.YOUR-DOMAIN` and route it to **HTTP** `127.0.0.1:6813`.
4. Copy only that tunnel's connector token, not the whole installation command. Paste the token and stable HTTPS hostname into the server EXE, then click **Save configuration and restart service**. Do not send tokens or account credentials in chat. There is no need to run Cloudflare's separate installation command.
5. Wait for the tunnel to connect and click **Test public address**. When it reports HEALTHY, give us only the public directory URL for the frontend work. Keep the token private.

Keep normal TLS certificate verification enabled. The app stores the token with Windows DPAPI machine-scope encryption under a folder restricted to Administrators, SYSTEM and Local Service. While the helper runs it reads a protected, ACL-restricted runtime token file; that file is removed on normal service stop. Tokens are not command-line arguments, public API data or logs.

Cloudflare receives directory traffic; invite URLs/keys are retained in server memory until expiry, deletion or restart. This is a small private-training directory, not a guarantee of internet availability or abuse-proof public hosting.

## Controls and maintenance

- **Start service / Stop service** require administrator approval. Stopping or restarting clears all room codes. Hosts must register again.
- **Remove service** unregisters it but retains installed files and protected configuration.
- Install/update stops only this service and replaces only its own payload. A previous EXE backup is retained. Updating the server clears rooms.
- Installation folder: `%ProgramFiles(x86)%\ZYZTools Room Server` on 64-bit Windows, or `%ProgramFiles%\ZYZTools Room Server` on 32-bit Windows.
- Protected data: `%ProgramData%\ZYZTools Room Server`. `status.txt` contains generic service/tunnel status, not tokens or room codes.
- Windows recovery attempts restart after 5/15/60 seconds on a service crash; the service retries a disconnected helper at most once a minute.
- Helper: official unmodified cloudflared 2026.10.3 Windows 386, SHA256 `84be6271133004dc103d71b1a2b6b80cf204685ebf277e2504082793507922cf`. Apache 2.0 license is embedded and installed beside it. Source: https://github.com/cloudflare/cloudflared/tree/2026.10.3 .

## Frontend integration contract (API v1)

The host/client must use the configured HTTPS directory origin. Every response is JSON with `Cache-Control: no-store`; no cookies or CORS access are provided. The service binds only to loopback. Cloudflare supplies `CF-Connecting-IP` for rate limiting; do not expose this service directly on a LAN or public IP or put an untrusted forward proxy in front of it.

| Request | Purpose |
| --- | --- |
| `GET /health` | Non-sensitive service/version readiness marker |
| `POST /v1/rooms` with JSON `{ "url": "https://HOST.trycloudflare.com", "token": "64 lowercase hex characters" }` | Create a room; returns `code`, private `ownerToken`, `expiresAt`, `heartbeatSeconds:45` |
| `GET /v1/rooms/ABCDE-FG234` | Resolve a code to its session URL/key. The code itself grants access; anyone holding it can resolve it. Never publish room codes. |
| `PUT /v1/rooms/CODE` with `Authorization: Bearer OWNER_TOKEN` and JSON `{}` | Renew for another 120 seconds; optional replacement URL/key body uses the creation schema |
| `DELETE /v1/rooms/CODE` with host authorization | Revoke immediately |

Codes are ten random characters (50 bits), displayed in two groups of five. They expire 120 seconds after the last heartbeat and at an absolute maximum age of 12 hours. Stopping a host should send DELETE; a crashed host expires automatically. The directory does not probe/fetch session URLs or forward arbitrary connections. It accepts only root HTTPS `*.trycloudflare.com` hosts and valid session keys. It never returns the owner token on a lookup. Rate limits: 5 creations/IP/minute, 30 creations globally/minute, 30 lookups/IP/minute, 60 total requests/IP/minute, 900 total API requests/minute, 500 concurrent rooms. Requests are limited to 4 KB and 32 concurrent local TCP handlers. Limits are in memory and reset after restart. Health probes are exempt.

Build locally with `tools/Build-RoomServer.ps1`. Tests: `node tools/RoomServer/test-room-server.cjs`. Tests run an isolated loopback listener and in-process expiry/DPAPI checks; they do not install the service, request administrator rights or expose the machine publicly. Actual service installation/start-at-boot, named-tunnel token configuration and Windows 10 end-to-end operation still need validation on the spare PC.

Official setup: https://developers.cloudflare.com/tunnel/get-started/ . Token-file documentation: https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/configure-tunnels/run-parameters/ .
