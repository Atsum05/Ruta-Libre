# Registry sources

Inputs to `src/cli.ts`. Regenerate `stations.json` after changing anything here:

```bash
pnpm --filter @rutalibre/registry build:registry
```

| File                         | What                                                                        | Source                                                                                                 | Terms                                                                                                    |
| ---------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| `metro_dispositivos.geojson` | Every Metro elevator and escalator: ID, station code, line, position        | [ariellopez.cl](https://ariellopez.cl/metro/accesibilidad/), copied from the 2026 prototype            | Used with permission of Ariel López ([DATA_SOURCES](../../../docs/DATA_SOURCES.md)). Credit the authors. |
| `seguimos-devices.json`      | Static fields of the live feed: station code, `tipo`, `texto` (no statuses) | `https://velocidades.seguimos.cl/?metro=1&all=1`, one request on 2026-10-28 (newest record 2026-10-16) | Same authors and permission as above.                                                                    |

## Refreshing `seguimos-devices.json`

Fetch the feed once, identifying RutaLibre in the `User-Agent`, keep only `estacion`, `tipo` and
`texto` per device, and sort by ID so the diff is reviewable. Do this when the feed gains devices
or the network changes (e.g. Line 7), not on a schedule: live statuses come from the poller
(Phase 5), not from here.

## When the network changes

1. Add the line and its terminals to `src/config.ts`.
2. Refresh both files above.
3. Run `build:registry`. It fails on any issue not explained in `config.EXPLAINED_ISSUES`.
4. Review the `stations.json` and `REPORT.md` diffs in the PR.
