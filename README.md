# Texas Household Resilience & Insurance Operating System — v2.0

A local-first, public-facing resilience platform for Texas renters, homeowners, families, seniors, landlords, rural households, disaster survivors, housing counselors, nonprofits, small businesses, municipalities, researchers and public institutions.

The system treats household resilience as a connected system:

**Protection + Preparedness + Savings + Maintenance + Documentation + Recovery Capacity + Cross-Domain Coordination**

It is an educational/planning system, not an insurer, broker, adjuster, attorney, financial adviser, engineer, contractor, emergency dispatch service or claims representative.

## What v2 adds

- Functional collaboration rooms with same-device BroadcastChannel and optional cross-device WebSocket sync.
- Strict multiplayer privacy boundary: only shared tasks, comments, evidence, decisions and incident-coordination records are synchronized.
- Cross-domain working-group templates spanning insurance literacy, housing, construction, water, energy, health, mobility, emergency management, finance, social services, research, wildfire, flood and municipal planning.
- Optional WebLLM browser inference using WebGPU, loaded only on explicit user action.
- Deterministic local planning fallback when WebGPU or a model is unavailable.
- PWA manifest, icons, service worker and explicit offline fallbacks.
- Optional official live adapters for NWS Texas alerts and OpenFEMA disaster declarations; no background polling.
- Dated 2025–2026 Texas insurance-market context sourced to the Texas Department of Insurance.
- TWDB flood-planning, Texas A&M Forest Service wildfire, TDEM recovery and NFIP references.
- Shared evidence register, decision log, incident room, activity ledger and handoff-package export.
- Capability diagnostics and deployment truth table.
- Original single-file application preserved at `legacy/original-single-file.html`.

## Fast start — static/local tools

For the cleanest browser behavior, serve the folder rather than opening it with `file://`:

```bash
python -m http.server 8000
```

Open `http://localhost:8000/`.

The original single-file edition can still be opened directly, but service workers do not normally operate under `file://`.

## Fast start — functional remote multiplayer

```bash
node server/server.js
```

No package installation is required; the collaboration server uses Node built-ins only.

Open `http://localhost:8787/` in two tabs/browsers. Create or enter the same room code and connect. The default same-origin WebSocket endpoint is `/ws`.

For internet use, deploy behind HTTPS/TLS and use `wss://`. See `server/README.md` and `SECURITY.md` before exposing the service publicly.

## Privacy architecture

Private local records include policy summaries, income/savings inputs, household digital-twin data, inventories, claims, communications, maintenance, vault files and other household-specific records. They remain in browser storage unless the user explicitly exports them.

The multiplayer protocol does **not** include those schemas. The server sanitizes and whitelists these shareable event types only. Shared edits created while remote transport is unavailable are retained locally in a pending-sync queue and flushed on reconnection:

1. shared task;
2. comment;
3. evidence record;
4. decision record;
5. incident-coordination update.

Room codes are collaboration identifiers, not strong authentication. A public institutional deployment should add identity, authorization, access review, encryption/key management, retention rules, abuse controls, logging policy and incident response.

## WebLLM

The Local AI Lab dynamically imports `@mlc-ai/web-llm` from the CDN pattern documented by the WebLLM project and discovers the package's current prebuilt model registry instead of hard-coding one model as permanently available.

Requirements and boundaries:

- WebGPU-capable browser/device for model inference.
- First-time library/model loading requires connectivity and may download substantial data.
- Inference runs in-browser after the model is loaded.
- Model artifacts may be cached by WebLLM/browser storage but can be evicted.
- Model licenses are separate from WebLLM's Apache-2.0 license and must be reviewed before institutional redistribution/use.
- The collaboration server never receives Local AI prompts through this app.

## PWA / offline contract

After a successful install on HTTPS or localhost, the service worker caches the app shell, local modules, reference JSON and icons. Offline availability includes locally stored planning records and the cached core interface.

Not claimed offline:

- fresh NWS alerts;
- fresh FEMA declarations;
- external official websites;
- remote WebSocket collaboration;
- first-time WebLLM/package/model downloads.

## Core Texas data snapshot embedded in the bundle

The bundled `data/texas-context.json` records source/date/limitations for state context, including 2025 TDI homeowners market statistics, June 2026 TDI loss transparency information, 2026 rate-filing aggregates, 2024 TWDB flood-planning context, NFIP waiting-period context and Texas A&M Forest Service wildfire preparedness context.

These are contextual educational facts, not an individual quote, forecast, eligibility decision or coverage determination.

## File tree

```text
index.html
manifest.webmanifest
sw.js
offline.html
assets/
  collab.js
  data-sources.js
  pwa-register.js
  upgrade.css
  upgrade.js
  webllm.js
data/
  texas-context.json
  resources.json
  cross-domain-schema.json
icons/
  icon-192.png
  icon-512.png
server/
  server.js
  package.json
  .env.example
  Dockerfile
  README.md
  data/
docs/
  ARCHITECTURE.md
  ATTRIBUTIONS.md
  DEPLOYMENT.md
legacy/
  original-single-file.html
tools/
  verify.py
SECURITY.md
LICENSE.txt
README.md
```

## Verification

Run:

```bash
python tools/verify.py
```

The verifier checks required files, JSON validity, duplicate HTML IDs, referenced core PWA assets and JavaScript syntax when Node is available. It does not substitute for browser/device/accessibility/security testing.

## Zero-Harm / Anti-Inversion

The OS exists to improve financial stability, preparedness, informed insurance use, property resilience and recovery capacity. It must not exploit disaster survivors, encourage unsafe repair/heating/generator practices, misstate coverage or legal rights, hide uncertainty, expose private household data or turn disaster losses into a game mechanic.

Preparedness progress may be gamified; loss and suffering are not.

## Attribution

Systems architecture / concept: **Ricky Foster + Navi — Planetary Restoration Archive**.

See `docs/ATTRIBUTIONS.md` for data/software sources and license notes.
