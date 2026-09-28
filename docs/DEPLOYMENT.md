# Deployment notes

## Static PWA only

Upload the bundle root to an HTTPS static host. Remote collaboration will be unavailable unless `collabServer` points to a separate reachable WebSocket server. Core local tools and PWA caching still work.

## Node all-in-one deployment

The optional zero-dependency `server/server.js` serves the parent bundle and `/ws` from one Node process.

```bash
PORT=8787 node server/server.js
```

Put a TLS reverse proxy in front for public deployment. Set `ALLOWED_ORIGINS` to the exact permitted browser origin(s).

## Docker

Build from the bundle root using the provided server Dockerfile, or adapt it to your platform. Do not publish the server persistence directory as static content.

## Updates

Bump the cache version in `sw.js` when core assets change. The service worker removes old versioned caches on activation.

## WebLLM

No model weights are bundled because they are large and model licenses vary. The Local AI Lab loads WebLLM/model resources only after explicit user action. For a controlled institutional deployment, pin and self-host a reviewed model/runtime build and then update CSP and license documentation accordingly.
