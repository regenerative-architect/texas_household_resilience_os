# Zero-dependency collaboration server

This server turns the browser Collaboration Hub into real cross-device multiplayer using the WebSocket protocol and serves the PWA bundle from the same origin. It uses only Node built-ins; no `npm install` is required.

## Run

```bash
node server/server.js
```

or:

```bash
cd server
npm start
```

Open `http://localhost:8787` in two browsers/tabs, create the same room code, and connect. On a LAN, use the host computer's reachable address and ensure your firewall permits the port. Internet deployments should sit behind HTTPS/TLS so the browser uses `wss://`.

## Privacy boundary

The server accepts only five whitelisted coordination event shapes: shared task, comment, evidence, decision and incident. It does **not** accept the OS's private policy, income, claims, inventory, digital-twin or vault schemas. The `/server/*` path is blocked from static serving so the room-state file is not exposed by this process.

Room codes are collaboration identifiers, not strong authentication. For sensitive or institutional production use, add identity, authorization, audited retention, encryption/key management, backups, abuse controls and an organizational privacy/security review.

Set `ALLOWED_ORIGINS` to comma-separated exact origins in production. Shared event history persists to `server/data/rooms.json` by default.
