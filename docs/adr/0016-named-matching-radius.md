# 16. Match a platform by name and line further out

- **Status:** Accepted
- **Date:** 2026-10-31
- Refines [ADR 0006](0006-match-stops-by-location.md) and [ADR 0011](0011-registry-stations-per-line.md).

## Context

The registry has one point per transfer complex: the catalogue codes of each line share
OpenStreetMap's single station node. Google places each line's platform where it really is. At
Irarrázaval, Google's Line 5 stop is 182 m from that point, beyond the 150 m match radius, so a
real route came back "we can't be sure" with every elevator working. OpenStreetMap's stop
positions show the same pattern elsewhere: Los Leones up to 309 m, Puente Cal y Canto 180 m,
Baquedano 137 m, Plaza de Armas 131 m.

Raising the radius for everyone isn't safe: two stations of one line can be 477 m apart
(Universidad de Chile and Santa Lucía, Line 1).

## Decision

- A stop **on a known line, whose name matches the station's name or an alias**, may be up to
  **500 m** away (`NAMED_MATCH_RADIUS_M`). Name and line together identify the station; the
  distance is only a sanity limit.
- Everything else keeps the 150 m radius: a stop with another name, or a leg whose line the
  registry doesn't know.
- The map's "stations on this route" highlight uses the same rule.
- A real-data test asserts that no line has two stations with the same name, which the rule
  relies on.

## Consequences

- Platforms far from the complex point are recognised; a misspelt stop name falls back to the
  strict radius, as before. A platform more than 500 m away still goes unmatched (`unknown`).
- The station dot stays at the complex point, not at each platform. Verdicts don't depend on it:
  devices belong to the station, not to a position.
- Official per-platform coordinates (DTPM GTFS) would make this unnecessary.
