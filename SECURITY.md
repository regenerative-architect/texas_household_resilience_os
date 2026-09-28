# Security & privacy notes

## Local data

The application stores structured household records in IndexedDB when available. Browser/site-data deletion can erase them, so encrypted and offline backups are still necessary. The document vault never auto-uploads.

## Collaboration server

The bundled server is deliberately narrow and sanitizes every accepted event into one of five shareable schemas. It blocks `/server/*` from static serving so its persistence file is not exposed as a public asset.

Room codes are not equivalent to user authentication. Before a public institutional deployment, add:

- authenticated identity and organization/workspace membership;
- explicit authorization for room/project resources;
- TLS termination and secure WebSocket (`wss://`);
- server-side audit policy with privacy-preserving retention;
- encryption/key-management policy for stored shared data;
- rate limiting at reverse proxy/load balancer level;
- CSRF/session protections if account APIs are added;
- backups and tested recovery;
- abuse reporting/moderation where public participation is allowed;
- data-processing agreements and jurisdictional privacy review when applicable.

## Recommended response headers

A deployment should tune a Content Security Policy to its chosen WebLLM delivery/model hosts. A strict starting point for deployments **without** WebLLM is:

```text
Content-Security-Policy: default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self' ws: wss: https://api.weather.gov https://www.fema.gov; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'
X-Content-Type-Options: nosniff
Referrer-Policy: no-referrer
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

WebLLM CDN/model use requires carefully extending `script-src`, `connect-src`, `worker-src` and WebAssembly-related directives for the exact selected distribution/model hosts. Do not weaken CSP globally without understanding the effect.

## Sensitive fields

Do not put policy numbers, banking details, government IDs, health records, passwords, precise household security details or unneeded personal data in a collaboration room. The current protocol excludes common private OS schemas, but free-text fields still require user judgment.

## Hashing

SHA-256 integrity hashes detect byte changes relative to a known digest. They do not establish authorship, identity, ownership or publication time. Use cryptographic signatures/timestamping systems when provenance claims require them.
