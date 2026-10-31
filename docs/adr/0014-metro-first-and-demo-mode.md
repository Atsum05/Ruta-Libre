# 14. Metro first, less walking, and a labelled demo mode

- **Status:** Accepted
- **Date:** 2026-10-31
- Refines [ADR 0010](0010-verdict-rules.md) (ranking) and [ADR 0012](0012-status-freshness-follows-the-source.md) (freshness).

## Context

Three things came up while preparing a demo for Metro de Santiago:

1. Google's first suggestion is often a bus, even when a Metro route works. The Metro is the only
   network whose accessibility RutaLibre can check (live elevator status), so a working Metro
   route is the one we can actually vouch for.
2. "Rerouted" was shown whenever the best route wasn't Google's first, which would be misleading
   once Metro routes are preferred: nothing was avoided, we just chose differently.
3. The status feed stopped updating on 2026-10-16. With honest freshness rules every Metro verdict
   is `unknown`, so the app can't show what it would do with current data.

## Decision

- **Metro first.** The API asks Google for its usual routes and, in parallel, for Metro-only
  routes, keeping the Metro-only ones Google didn't already return. Ranking stays tiered by verdict
  (ok/warning, then unknown, then blocked); **within a tier, routes that use the Metro come
  first**, then the provider's order. A blocked or uncertain Metro route never outranks an
  accessible bus route.
- **"Rerouted" means accessibility changed the answer:** the provider's own first route had a
  worse verdict than the one we show.
- **Less walking.** Every Google request asks for `routingPreference: LESS_WALKING`.
- **Demo mode** (`STATUS_DEMO=true` on the API, off by default): the last snapshot is treated as
  current, so verdicts use it however old it is. `/v1/status` and `/v1/plan` say `demo: true`, and
  the web app shows a banner with the snapshot's date plus a "Demo" label on every verdict.

## Consequences

- One plan costs two Routes requests (three with the bus-only fallback).
- A Metro route can be chosen over a faster bus route in the same tier, sometimes with more
  walking. Revisit with real users (e.g. prefer Metro only when walking stays within a limit).
- Demo mode must never be on for real users: it presents old data as current. It exists to show
  how the app works; the labels make that visible to anyone looking.
