# 5. Accessibility verdict includes an explicit "unknown"

- **Status:** Accepted
- **Date:** 2026-10-27

## Context

In the prototype, "no data" and "working" looked the same: if the live status failed to load, or
a station name didn't match, the route was presented as accessible with no visible warning. For
a user who depends on elevators, a false "all clear" is the worst failure the app can have.

## Decision

`evaluateRoute` returns one of:

- `ok`: every relevant device confirmed working.
- `warning`: usable, but something worth knowing (broken escalator; broken elevator that likely
  serves the other platform).
- `blocked`: a confirmed broken elevator on the user's path.
- `unknown`: we can't be sure (stale snapshot, unmatched stop, device without status).

Each verdict carries machine-readable reasons. The UI shows `unknown` as prominently as `blocked`.

## Consequences

- Users are never told a route is fine when we don't know.
- Data quality problems show up as a measurable rate of `unknown` verdicts instead of staying hidden.
- `chooseRoute` must rank `unknown` routes (below `ok`/`warning`, above `blocked`).
