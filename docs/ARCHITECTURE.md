# Architecture

## Layers

1. **Base local OS** — the original single-file application: insurance literacy, policy summaries, coverage-gap review, deductible/premium calculations, risk planner, roof, inventory, vault, maintenance, repair comparison, claims, recovery, savings, scenarios, digital twin, projects, research and portable data.
2. **Upgrade layer** — additional routes and modular JS/CSS for collaboration, cross-domain planning, live official context, source library, WebLLM and diagnostics.
3. **PWA layer** — manifest, service worker, icons and offline fallback.
4. **Optional collaboration server** — same-origin static hosting + WebSocket rooms with file-backed shared-event persistence.
5. **External optional adapters** — NWS API, OpenFEMA and WebLLM/model distribution. These are never required for the core local OS.

## State boundary

`state` remains the authoritative browser-local application object. Full backups export local state only on explicit action.

Shared collaboration state is a restricted subset:

- `collab.sharedTasks`
- `collab.comments`
- `sharedEvidence`
- `decisions`
- `incidents`

The server's event sanitizer independently re-whitelists allowed fields, so client-side manipulation does not automatically permit private schemas.

## Multiplayer paths

### No server

BroadcastChannel enables same-origin cross-tab cooperation on the same browser profile. Local application records continue to work when collaboration transport is absent.

### Optional server

Native browser WebSocket → `/ws` → zero-dependency Node WebSocket server. Rooms receive recent event snapshots and presence updates. The persistence file keeps only sanitized shared events.

## Data provenance

The bundle separates:

- official measured/administrative data (A);
- peer-reviewed evidence (B);
- institutional analysis/guidance (C);
- preliminary evidence (D);
- modeled scenario (E);
- conceptual proposal (F).

Source records carry publisher, date/freshness, jurisdiction/topic and limitations where available.

## Cross-system federation

`data/cross-domain-schema.json` provides a portable vocabulary for projects involving the Texas Housing, Energy, Water, Health, Mobility, Community Resilience and related systems. It is intentionally a data contract rather than a hidden network dependency. Other OS instances can import/export or map these task/domain fields without requiring one centralized service.
