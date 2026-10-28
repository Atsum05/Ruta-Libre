# RutaLibre

Accessible public-transport routing for Santiago. RutaLibre plans Metro and bus trips around the
elevators and escalators that are out of service **right now**, and tells you plainly when it
can't be sure.

> **Status:** rebuild in progress, not live yet. This is a production rebuild of the HaCAithon 2026
> prototype (`../equipo-3-haCAIthon-2026`). That code is reference material only; nothing is copied
> over without tests.

## Where to start

- [`docs/ROADMAP.md`](docs/ROADMAP.md): the step-by-step build plan, with a "done when" check
  for every phase.
- [`docs/adr/`](docs/adr/): architecture decision records, i.e. _why_ things are built the way
  they are. Read these before proposing a change in direction.

## Planned layout

```
rutalibre/
├─ packages/core/       # pure domain logic: types, matching, verdicts (no I/O)
├─ packages/registry/   # build pipeline for the station registry (stations.json)
├─ apps/api/            # Hono API: /status, /plan, /places, /interpret
└─ apps/web/            # Vite + React + TypeScript + MapLibre, mobile-first
```

Dependencies point **inward only**: `apps/*` → `packages/core`. Core never imports from apps.

## License

[MIT](LICENSE)
