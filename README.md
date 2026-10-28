# RutaLibre

Accessible public-transport routing for Santiago. RutaLibre plans Metro and bus trips around the
elevators and escalators that are out of service **right now**, and tells you plainly when it
can't be sure.

> **Status:** the code for every roadmap phase up to deployment is built and tested; it is **not
> live yet**. Deployment (Netlify + Render) is the next step. This is a production rebuild of the
> HaCAithon 2026 prototype (`../equipo-3-haCAIthon-2026`), which is reference material only.

## How it works

```
 Browser (apps/web)                       API (apps/api)                         Outside
 ─────────────────                        ──────────────                         ───────
 search: origin + destination ──► POST /v1/plan ──► Google Routes (transit) ─────► Google
                                      │
                                      ├─ every Metro leg, both ends, own direction
                                      │    matchStop → station registry (packages/registry)
                                      │    evaluateRoute → ok | warning | blocked | unknown
                                      │      using the latest status snapshot ◄── poller ◄── seguimos.cl
                                      ├─ nothing accessible? ask again, buses only
                                      └─ chooseRoute → ranked plan
 verdict + steps + map  ◄─────────────────┘
```

- **A broken elevator blocks a route; a broken escalator only warns.** The elevator on the other
  platform warns too, in case we have the direction wrong.
- **Missing, stale or unmatched data is `unknown`, never "fine"** ([ADR 0005](docs/adr/0005-tri-state-accessibility-verdict.md)).
  Snapshots are dated by when the source observed them, not when we fetched them
  ([ADR 0012](docs/adr/0012-status-freshness-follows-the-source.md)).
- Walking time is scaled by 1.5 for a reduced-mobility pace.
- The full rule table is [ADR 0010](docs/adr/0010-verdict-rules.md).

## Repository layout

```
rutalibre/
├─ packages/core/       # pure domain logic: matching, verdicts, ranking. No I/O, no dependencies
├─ packages/registry/   # builds stations.json (143 per-line stations, 1,111 devices) from sources/
├─ packages/contract/   # zod schemas for the HTTP API, a typed client, OpenAPI source
├─ apps/api/            # Hono API: /v1/health, /status, /plan, /places, /interpret, /openapi.json
└─ apps/web/            # Vite + React + TanStack Query + Google Maps, mobile-first, es-CL / en
```

Dependencies point **inward only**: apps → packages → `core`. Core can't import I/O, other packages,
or apps; the typecheck, the linter and a test enforce it ([ADR 0002](docs/adr/0002-monorepo-with-pure-core.md)).

## Getting started

Requires Node 24 (`.nvmrc`) and pnpm (version pinned in `package.json`).

```bash
pnpm install
cp apps/web/.env.example apps/web/.env.local    # add a Maps JavaScript key (browser key)
cp apps/api/.env.example apps/api/.env           # optional locally; add GOOGLE_MAPS_API_KEY to plan trips
pnpm dev                                         # API on :8787, web on :5173 (proxied as /api)
```

Without keys the API still starts: live status works, and `/v1/plan` and `/v1/places` answer 503.
Both apps validate their configuration at startup and refuse to run with a malformed value (for
example a key with an invisible BOM, which broke the prototype).

## Commands

| Command                                            | What it does                                                             |
| -------------------------------------------------- | ------------------------------------------------------------------------ |
| `pnpm check`                                       | Lint, typecheck, unit and integration tests with coverage. What CI runs. |
| `pnpm test:e2e`                                    | Playwright flows on phone and desktop against a mocked API, with axe.    |
| `pnpm format`                                      | Auto-fix formatting and safe lint issues.                                |
| `pnpm --filter @rutalibre/registry build:registry` | Regenerate `stations.json` and its report.                               |

## Testing

- **313 unit and integration tests.** Core carries a 95% coverage gate (currently 100% lines,
  99% branches). Every prototype bug is a regression test.
- **Real data in tests:** core's rules run against the real station registry; the API's planning
  tests feed the Google adapter a saved response and evaluate it against the registry; status
  contract tests use a real seguimos.cl sample.
- **18 end-to-end tests** in Chromium (phone and desktop): clean, rerouted and no-alternative
  trips, stale status, map fallback, English, keyboard only, no sideways scrolling, and WCAG 2.2 AA
  checks including colour contrast.

## Documentation

- [`docs/ROADMAP.md`](docs/ROADMAP.md): the build plan, phase by phase, with what's done and what's open.
- [`docs/BRIEF.md`](docs/BRIEF.md): who it's for, the one promise, non-goals, success metrics.
- [`docs/DATA_SOURCES.md`](docs/DATA_SOURCES.md): licences, permissions and terms for every data source.
- [`docs/adr/`](docs/adr/): why things are built the way they are.
- [`docs/PROTOTYPE_LESSONS.md`](docs/PROTOTYPE_LESSONS.md): what the hackathon prototype taught us.
- [`AGENTS.md`](AGENTS.md) and [`CONTRIBUTING.md`](CONTRIBUTING.md): how to work in this repo.

## Data and credits

- Elevator and escalator catalogue and live status: [ariellopez.cl](https://ariellopez.cl/metro/accesibilidad/)
  and [seguimos.cl](https://velocidades.seguimos.cl/) by Ariel López and Willy Maikowski, used with permission.
- Metro line geometry: © OpenStreetMap contributors ([ODbL](https://www.openstreetmap.org/copyright)).
- Maps, routing and place search: Google Maps Platform. Free-text trips: Google Gemini.

## License

Code: [MIT](LICENSE). Data files keep their own terms (see [`docs/DATA_SOURCES.md`](docs/DATA_SOURCES.md));
the Metro line geometry derived from OpenStreetMap stays under the ODbL.
