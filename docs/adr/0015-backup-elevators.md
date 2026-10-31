# 15. Backup elevators: only an elevator that makes the same trip

- **Status:** Accepted
- **Date:** 2026-10-31
- Refines [ADR 0010](0010-verdict-rules.md).

## Context

Until now, any broken elevator on the rider's path blocked the route, even when a second
elevator at the station does exactly the same job (two street entrances into one ticket hall).
The tempting fix, "another elevator reaches the same platform", is wrong. At Los Héroes, Line 2,
on 2026-10-16:

| Elevator  | From → to                                                                  | State   |
| --------- | -------------------------------------------------------------------------- | ------- |
| HE-0f6a35 | Line 1 hall, San Pablo side → Line 2 platform towards Hospital El Pino     | out     |
| HE-d50594 | Line 1 hall, Los Dominicos side → Line 2 platform towards Hospital El Pino | working |

Both reach the same platform, but from different halls. Someone arriving on the San Pablo side
can't change level: the working elevator starts somewhere they aren't. Whether the two halls
connect without stairs isn't in the data.

## Decision

- Each device's source description ("… hacia Boletería") is kept in the registry and shown to
  riders. From it the registry derives a **link**: the two places the device connects,
  normalised, both directions, scoped to its own line's station code.
- **A broken elevator is backed up only by a working elevator with the same link**: same start,
  same end, same line's part of the station. Then the finding is a **warning** that names both
  elevators ("out of service: …", "use this one: …"). An unreported elevator with a working
  twin produces no finding.
- **Anything else stays as before:** a broken elevator on your path with no such backup blocks
  the route; when we can't tell whether it affects you, the verdict is `unknown`. We either
  avoid the route or say we can't be sure.
- Every street entrance counts as the same place ("calle"): two entrance elevators into the same
  ticket hall back each other up even from different corners. The warning says which one to use.
- Links are scoped per line because at transfer stations each line can have its own ticket hall:
  "street → ticket hall" on Line 5 is not a backup for Line 1. (An early version without this
  scope produced 32 false backups; caught before release.)

## Consequences

- With the October data, backups exist at 19 station codes, almost all entrances; one platform
  case (Estadio Nacional, Line 6). Transfer stations such as Los Héroes keep the strict rule.
- Step-free detours inside a station (up to the ticket hall, across, down another elevator) are
  not found. That needs a map of which places connect on flat ground: the next stage, best done
  with Metro's station plans (roadmap Phase 10).
- About 1% of descriptions don't follow the "X hacia Y" pattern; those devices have no link and
  never count as a backup (the safe side).
