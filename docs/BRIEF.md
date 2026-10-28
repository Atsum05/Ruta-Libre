# RutaLibre: product brief

- **Status:** Draft, awaiting sign-off on the success metrics
- **Date:** 2026-10-28

## Who it's for

People in Santiago who can't rely on stairs: wheelchair users, people walking with a cane or
crutches, older adults, people pushing a pram, and anyone temporarily injured. The app always
assumes reduced mobility; there's no "normal" mode. Someone without that need would use Google Maps.

## The problem

People with reduced mobility take on average 25 minutes longer per trip in Santiago (PUC study). No
routing app accounts for the live state of Metro elevators and escalators: if the elevator at your
destination is broken, you find out when you get there.

## The one promise

> **Tell me a Metro and bus route that works for me right now, or tell me plainly that you can't be sure.**
- Every Metro station on the route is checked against the live status of its elevators and
  escalators. A broken elevator on your path blocks the route; a broken escalator warns.
- If the best route is blocked, RutaLibre picks another automatically: alternative routes, then
  bus only, then "no accessible alternative, ask for assistance at the station".
- Missing, stale, or unmatched data is shown as **unknown**, never as fine
  ([ADR 0005](adr/0005-tri-state-accessibility-verdict.md)).
- Walking times are scaled to a reduced-mobility pace (× 1.5).

## Non-goals for launch

- User accounts, saved trips, or history.
- Cities other than Santiago.
- Driving, cycling, taxi, or ride-hailing directions.
- Turn-by-turn live navigation (we plan the trip; we don't guide each step).
- Accessibility of bus vehicles and bus stops (ramps, low floors). We have no live data for it.
- Native iOS/Android apps. Launch is a mobile-first web app.
- A commercial offering. Revisit after launch, driven by usage data.

## Success metrics

What we will measure from launch. Instrumented in Phase 8.

| Metric                                                  | Target  | Why it matters                                       |
| ------------------------------------------------------- | ------- | ---------------------------------------------------- |
| Stop-match rate (routing stops → registry stations)     | ≥ 99%   | An unmatched stop is a blind spot in the verdict     |
| Share of plans with a confident verdict (not `unknown`) | ≥ 95%   | Too many `unknown`s means the product isn't useful   |
| Status freshness, p95 age of the snapshot served        | < 3 min | Old status is as dangerous as no status              |
| `/plan` latency, p95                                    | < 2.5 s | Users give up on slow answers                        |
| Crash-free sessions                                     | ≥ 99.5% | The app must work when someone is standing at a gate |

## Constraints

- One developer. Infrastructure stays minimal ([roadmap principle 7](ROADMAP.md#principles-these-apply-to-every-phase)).
- Relies on volunteer-run data with no SLA. See [`DATA_SOURCES.md`](DATA_SOURCES.md).
- Location and voice queries are personal data under Chilean law (Ley 21.719).
