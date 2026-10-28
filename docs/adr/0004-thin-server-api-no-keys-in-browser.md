# 4. Thin server API; no keys in the browser

- **Status:** Accepted
- **Date:** 2026-10-27

## Context

The prototype ran entirely in the browser. All API keys were compiled into the JavaScript and
readable by any visitor, every browser fetched the live status from a volunteer-run third-party
API (fragile CORS, extra load on the upstream), and the status was loaded once per page and never refreshed.

## Decision

A small **Hono** API sits between the web app and every external service:

- `/v1/status`: serves the latest snapshot produced by a scheduled poller; users never call the
  upstream.
- `/v1/plan`: routing + evaluation with `core`.
- `/v1/places`, `/v1/interpret`: proxies for geocoding and the LLM.

All requests and upstream responses are validated with zod. Per-IP rate limiting and CORS
locked to our origins.

## Consequences

- Keys stay server-side; quota abuse is limited by rate limiting.
- One place for caching, logging, and detecting upstream format changes.
- We now operate a backend (monitoring, deploys), kept minimal on purpose.
