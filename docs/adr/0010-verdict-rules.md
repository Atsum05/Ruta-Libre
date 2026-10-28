# 10. Verdict rules

- **Status:** Accepted
- **Date:** 2026-10-28
- Refines [ADR 0005](0005-tri-state-accessibility-verdict.md). Implemented in
  `packages/core/src/evaluate.ts` and `choose.ts`; every row below has a test.

## Context

ADR 0005 defined the four verdicts but not the exact rules. Building `packages/core` needed
answers for cases the prototype never handled: a platform we can't identify, a station with no
elevator on record, an escalator with no status. The rules here decide whether someone in a
wheelchair is sent to a station they can't leave, so they're written down in one place.

## Decision

**What is checked.** Each Metro leg is checked at both ends (boarding and alighting) against
that leg's own direction: the platform signed towards the terminal its headsign names. A
transfer station is checked once per leg. Bus legs aren't checked (no live data; out of scope in
the brief). Train legs are `unknown` (no data).

**Platform relation** of each device at a station:

| Device scope          | Leg direction known      | Relation  |
| --------------------- | ------------------------ | --------- |
| Station-wide (access) | any                      | yours     |
| Platform towards T    | towards T                | yours     |
| Platform towards T    | towards another terminal | other     |
| Platform towards T    | not resolvable           | uncertain |
| Unknown platform      | any                      | uncertain |

**Effect of each device:**

| Device    | State          | yours   | uncertain | other   |
| --------- | -------------- | ------- | --------- | ------- |
| Elevator  | out of service | blocked | unknown   | warning |
| Elevator  | no status      | unknown | unknown   | —       |
| Escalator | out of service | warning | warning   | —       |
| Escalator | no status      | —       | —         | —       |

A station end with no elevator that is `yours` or `uncertain` → `unknown`.

**Whole-route conditions** (only when the route uses the Metro): no snapshot, or a snapshot
older than 10 minutes (configurable) → `unknown`, and no device result is trusted, not even a
reported failure. A stop no station matches within 150 m → `unknown`.

**Combining:** blocked > unknown > warning > ok. A confirmed broken elevator on your path
makes the route blocked whatever else is uncertain.

**Ranking** (`chooseRoute`): ok and warning share the first tier (a broken escalator doesn't
justify a different route), then unknown, then blocked. Within a tier: primary, alternatives, then
bus only, keeping the provider's order. If the best route is blocked, show it with "no accessible
alternative, ask for assistance at the station".

## Consequences

- An escalator with no status is silent. It could only ever have produced a warning, and making
  the whole route `unknown` over it would bury real uncertainty.
- An elevator on the other platform still warns, because the direction could be wrong.
- Uncertain platforms make verdicts `unknown` rather than `blocked`, so a route with a confirmed
  problem ranks below one we merely can't vouch for.
- Phase 4's registry has to supply each device's scope; anything it can't classify becomes
  "unknown platform" and shows up as `unknown` verdicts we can measure and fix.
