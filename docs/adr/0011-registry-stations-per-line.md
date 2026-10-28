# 11. Registry stations are per line, grouped into complexes

- **Status:** Accepted
- **Date:** 2026-10-28
- Refines [ADR 0006](0006-match-stops-by-location.md) and [ADR 0010](0010-verdict-rules.md).

## Context

Building the registry from real data (Phase 4) showed that the device catalogue has one station
code per **line**: Los Héroes is `LH` on L1 and `HE` on L2, a few metres apart, with the same name.
A transfer station is therefore two or more codes. Matching a stop by position alone could pick
the other line's code and check the wrong platforms. Live-status texts also showed that one device
can serve several platforms ("… dirección Los Dominicos … dirección Vespucio Norte"), and that
street-access elevators are catalogued under just one of a complex's codes.

## Decision

- **One registry station per catalogue code**, with a single line. Codes with the same name form a
  **complex**.
- **Matching uses the leg's line:** only stations on that line are candidates. If none is within
  150 m, the stop is unmatched (`unknown`); we never borrow another line's devices.
- **Directions resolve within the leg's line:** only that line's terminals count.
- **Station-wide devices are shared across a complex:** street access serves every line there.
  Platform devices stay with their own code.
- **A device's platform scope is a list of terminals**, parsed from every "dirección X" in its
  text. Text after "dirección" that isn't a terminal makes the scope `unknown`.
- `stations.json` is generated from `packages/registry/sources/` and committed. A test fails if
  it differs from a fresh build; the build fails on any issue not explained in its config.

## Consequences

- Transfers are checked against the right line's platforms, using real station codes.
- Routing adapters must map provider line names to registry line IDs (`L1`, `L4A`…). An unmapped
  line gives no constraint (matching falls back to position and name).
- A complex whose codes are far apart (Baquedano: 682 m) is reported; stops beyond 150 m of its
  coordinate stay `unknown` until the coordinates are corrected (e.g. from DTPM GTFS).
- A broken street-access elevator blocks transfers through that complex too. It may not be on a
  transfer path, but ADR 0010 already prefers warning too much over too little.
