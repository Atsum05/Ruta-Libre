# RutaLibre

**English** · [Español](README.es.md)

[![CI](https://github.com/Atsum05/Ruta-Libre/actions/workflows/ci.yml/badge.svg)](https://github.com/Atsum05/Ruta-Libre/actions/workflows/ci.yml)
[![CodeQL](https://github.com/Atsum05/Ruta-Libre/actions/workflows/codeql.yml/badge.svg)](https://github.com/Atsum05/Ruta-Libre/actions/workflows/codeql.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Accessible public-transport routes for Santiago de Chile. RutaLibre plans Metro and bus trips
around the elevators and escalators that are out of service, checks every station on the way in
the rider's own direction, and says plainly when it can't be sure.

> **Status:** working demo. The API runs on Render and the website on Netlify
> ([`docs/DEPLOY.md`](docs/DEPLOY.md)). The elevator status feed is currently paused, so the demo
> uses its last known state, labelled on screen ([ADR 0014](docs/adr/0014-metro-first-and-demo-mode.md)).
> RutaLibre is a production rebuild of a HaCAithon 2026 prototype: same idea, rebuilt from the
> ground up with tests, CI, a typed API and documented decisions
> ([what the prototype taught us](docs/PROTOTYPE_LESSONS.md)).

## Contents

- [What it does](#what-it-does)
- [How it decides](#how-it-decides)
- [Architecture](#architecture)
- [Tech stack](#tech-stack)
- [Data pipeline](#data-pipeline)
- [API](#api)
- [Web app](#web-app)
- [Security and privacy](#security-and-privacy)
- [Testing](#testing)
- [CI/CD](#cicd)
- [Engineering workflow](#engineering-workflow)
- [Getting started](#getting-started)
- [Documentation](#documentation)
- [Data and credits](#data-and-credits)

## What it does

- **Plans a trip** between two places, from free text ("from Plaza Italia to the Costanera"), or
  by voice. Metro routes come first among equally accessible options.
- **Checks every station on the trip**: the entrance, the platform you board from, the one you
  get off at, and each transfer, in your direction of travel.
- **Gives each route a verdict:** accessible, accessible with warnings, not accessible, or "we
  can't be sure", with the reason in plain language and the elevator named in Metro's own words.
- **Shows the route on the map** with leave and arrive times, walking at a reduced-mobility pace.
- **Lets you choose** any other option: it becomes the main card and is drawn on the map.
- **Explains each station:** tap a dot to see every elevator and escalator, where it goes, and
  whether it works.
- Spanish (es-CL) and English, phone-first, usable with a keyboard and a screen reader.

## How it decides

The verdict is the product, so its rules are pure, tested functions in `packages/core` and are
written down as decisions.

| Situation on your path                                    | Verdict                                  |
| --------------------------------------------------------- | ---------------------------------------- |
| Every elevator works                                      | Accessible                               |
| An escalator is out                                       | Warning                                  |
| An elevator is out, but a working one makes the same trip | Warning, naming which to use             |
| An elevator is out on the opposite platform               | Warning (in case the direction is wrong) |
| An elevator is out on your platform, entrance or transfer | **Not accessible**                       |
| Status missing, too old, or a stop we can't identify      | **We can't be sure**                     |
- Missing data is never treated as "fine" ([ADR 0005](docs/adr/0005-tri-state-accessibility-verdict.md)).
- Directions are compared by station ID, from the train's headsign to the line's terminal
  ([ADR 0006](docs/adr/0006-match-stops-by-location.md), [ADR 0011](docs/adr/0011-registry-stations-per-line.md)).
- A backup only counts if it connects exactly the same two places on the same line
  ([ADR 0015](docs/adr/0015-backup-elevators.md)).
- Status age comes from when the source observed it, not when we fetched it
  ([ADR 0012](docs/adr/0012-status-freshness-follows-the-source.md)).
- Ranking: accessible first, then uncertain, then blocked; Metro first within a tier
  ([ADR 0014](docs/adr/0014-metro-first-and-demo-mode.md)). Full rule table:
  [ADR 0010](docs/adr/0010-verdict-rules.md).

## Architecture

```
 Browser (apps/web)                       API (apps/api)                          Outside
 ─────────────────                        ──────────────                          ───────
 places, text or voice ──► POST /v1/plan ──► Google Routes API (transit) ─────────► Google
                                │             (any mode + Metro-only, in parallel)
                                │
                                ├─ each Metro leg: match both stops to the station registry
                                │    (by line, position and name)       ◄── packages/registry
                                ├─ evaluate each station against the latest status snapshot
                                │    ok | warning | blocked | unknown   ◄── poller ◄── seguimos.cl
                                ├─ nothing accessible? ask again, buses only
                                └─ rank, attach times and descriptions ──► typed JSON response
 verdict + steps + map ◄────────┘
```

**Dependencies point inward only:** apps → packages → `core`. Core has no runtime dependencies and
no I/O: no network, DOM or Node built-ins. This is enforced three ways: a lint rule that forbids
those imports, a separate TypeScript config without DOM or Node types, and a test that scans
core's imports ([ADR 0002](docs/adr/0002-monorepo-with-pure-core.md)). Everything that talks to
the outside world is an adapter behind an interface in `apps/api`, so routing providers can be
swapped and every external call can be faked in tests ([ADR 0007](docs/adr/0007-routing-behind-provider-interface.md)).
API keys never reach the browser except the restricted Maps display key
([ADR 0004](docs/adr/0004-thin-server-api-no-keys-in-browser.md)).

## Tech stack

| Area        | Choice                                                            | Why                                                                                               |
| ----------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Language    | TypeScript 7, strictest settings                                  | `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `erasableSyntaxOnly`          |
| Runtime     | Node 24                                                           | Runs TypeScript directly (type stripping): no build step for the API                              |
| Monorepo    | pnpm workspaces with a version catalog                            | One edit upgrades a shared tool everywhere ([ADR 0002](docs/adr/0002-monorepo-with-pure-core.md)) |
| API         | Hono on `@hono/node-server`                                       | Small, typed, standard `Request`/`Response`                                                       |
| Contract    | zod 4 schemas shared by API and web, OpenAPI generated from them  | One source of truth for the HTTP API ([ADR 0013](docs/adr/0013-shared-contract-package.md))       |
| Web         | React 19, Vite 8, TanStack Query                                  | Fast builds; server state with caching and retries                                                |
| Maps        | Google Maps (`@vis.gl/react-google-maps`), Routes and Places APIs | Transit routing in Santiago ([ADR 0009](docs/adr/0009-google-maps-for-map-rendering.md))          |
| AI          | Google Gemini                                                     | Turns free text into an origin and a destination                                                  |
| Lint/format | Biome                                                             | One fast tool for both                                                                            |
| Tests       | Vitest 5 + Testing Library, Playwright + axe-core                 | Unit, integration and browser tests with accessibility checks                                     |
| Hosting     | Render (API), Netlify (web)                                       | [ADR 0008](docs/adr/0008-hosting-platform.md)                                                     |

## Data pipeline

`packages/registry` turns the raw sources into `stations.json`, the station registry that
matching and verdicts rely on:

- **Inputs:** Metro's device catalogue (one point per elevator and escalator) and the live status
  feed's device list, both in [`packages/registry/sources/`](packages/registry/sources/).
- **Output:** 143 stations, one per line at transfer stations, with 1,111 devices. Each device has
  a kind, a scope (station-wide, or a platform with its direction), Metro's own description, and a
  normalised `link` (the two places it connects) used to find backups.
- **Zero unexplained issues:** the build reports every anomaly (unknown kinds, unrecognised
  directions, missing terminals, duplicate names) and **fails** on any that isn't listed with a
  reason in `config.ts`. The result is written to
  [`REPORT.md`](packages/registry/REPORT.md), including coordinate corrections with their
  OpenStreetMap evidence.
- A test rebuilds the registry from the sources and fails if the committed `stations.json`
  differs, so it can't be edited by hand.

**Live status:** the API polls the status feed every 2 minutes. A failed or malformed fetch never
replaces the last good snapshot; it records the error and keeps serving the previous data, marked
by age. Snapshots older than 13 hours make verdicts "we can't be sure", unless demo mode
(`STATUS_DEMO=true`) is on, which is labelled in the UI and in every response.

## API

| Endpoint               | What it does                                                         |
| ---------------------- | -------------------------------------------------------------------- |
| `POST /v1/plan`        | Plans a trip: routes from Google, checked station by station, ranked |
| `GET /v1/places`       | Place autocomplete, biased to Santiago (session tokens for billing)  |
| `POST /v1/interpret`   | Free text → origin and destination (Gemini)                          |
| `GET /v1/status`       | Elevator and escalator status, its age and health                    |
| `GET /v1/health`       | Version, commit and environment                                      |
| `GET /v1/openapi.json` | OpenAPI document generated from the zod schemas                      |
- Requests and responses are validated against the shared zod schemas; the web app uses a typed
  client built from the same schemas, so a breaking change fails the typecheck, not production.
- Outgoing calls have a hard timeout per attempt and exponential backoff on 429 and 5xx.
- Configuration is validated at startup and the server refuses to start with a malformed value
  (the prototype once failed because a key contained an invisible byte-order mark).

## Web app

- Phone-first layout: a bottom sheet over the map on phones, a floating panel on desktop.
- **"Cordillera" design:** the top of the panel shows the Andes under a sky that follows the
  time of day in Santiago (dawn sun behind the peaks, pink snow at dusk, stars at night). Warm
  snow-white paper, deep ink, a coral glow for the main action; Fraunces for headings, Atkinson
  Hyperlegible for reading; a matching recoloured map and a dark mode. Add `?sky=dawn`, `day`,
  `dusk` or `night` to the address to see each sky.
- The map library loads as a separate chunk, so the first screen is fast (about 115 KB of
  JavaScript, gzipped).
- **Accessibility:** WCAG 2.2 AA, checked with axe in the browser tests, including colour
  contrast. Verdicts use words and icon shapes, never colour alone; focus moves to the chosen
  route; times are read as a sentence by screen readers.
- Voice input uses the browser's speech recognition and explains every failure (permission
  denied, no speech, no microphone, unsupported browser).
- All text lives in typed Spanish and English catalogues; a test keeps their keys and
  placeholders identical.

## Security and privacy

- **Keys on the server** ([ADR 0004](docs/adr/0004-thin-server-api-no-keys-in-browser.md)): the
  browser only has a Maps display key, restricted to the site's domains.
- **HTTP hardening:** strict security headers and `default-src 'none'` on the API; a Content
  Security Policy for the website (in report-only mode while it's tuned); CORS limited to listed
  origins.
- **Rate limits per client** on every paid endpoint (`/v1/plan` 20/min, `/v1/places` 60/min,
  `/v1/interpret` 10/min), with standard `RateLimit-*` headers; client IPs are only taken from
  `X-Forwarded-For` behind a trusted proxy.
- **No personal data in logs:** one structured line per request with a request ID, method, path,
  status and duration, never query strings or bodies, which can contain places (Chile's data
  protection law, Ley 21.719; see [`DATA_SOURCES.md`](docs/DATA_SOURCES.md)).
- **Supply chain:** `pnpm audit` fails CI on high-severity vulnerabilities in production
  dependencies; CodeQL scans every pull request and runs weekly; Renovate keeps dependencies and
  GitHub Actions (pinned by digest) up to date.

## Testing

About **500 unit and integration tests** and **26 browser tests**, all run on every pull request.

- **Coverage gates:** the whole codebase must keep at least 98% of lines, 97% of statements and
  functions, and 90% of branches; `packages/core` has a stricter 95% on everything. Currently
  99.5% of lines and 92.5% of branches. Gates are raised as coverage grows, never lowered to merge.
- **Test at the right level:** pure rules are unit-tested in core; the API is tested through HTTP
  with fake providers; whole flows run in a real browser.
- **Real data in tests:** core's rules run against the real station registry; the Google adapter
  is tested with a saved real response; the status parser with a real feed sample; one test uses
  Google's actual coordinates for a platform that once failed to match.
- **Every bug becomes a regression test**, including those found in the prototype.
- **Browser tests** (Playwright, phone and desktop): clean, rerouted and no-alternative trips,
  choosing another route, stale data, map failure, voice input, English, keyboard only, no
  sideways scrolling, and WCAG 2.2 AA checks with axe. The API is mocked and Google is blocked,
  so they're deterministic and need no keys. They run in about 8 seconds.

## CI/CD

Every pull request and every push to `main` runs, in GitHub Actions
([`.github/workflows/`](.github/workflows/)):

| Job            | What it runs                                                                                                                                                                                             |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **CI / check** | Lint, typecheck, all tests with the coverage gates, a coverage table on the run's summary page (full HTML report as a download), a production build of the website, and a dependency vulnerability audit |
| **CI / e2e**   | The Playwright suite in Chromium, with screenshots and traces kept on failure                                                                                                                            |
| **CodeQL**     | GitHub's security and quality analysis, also every Monday                                                                                                                                                |
- Newer pushes cancel outdated runs; jobs have timeouts and read-only permissions.
- **Branch protection on `main`:** changes only arrive through pull requests, the `check` job must
  pass, and merges are squash-only, so `main` has one commit per change and is always deployable.
- **Continuous deployment:** a merge to `main` redeploys the API on Render (`render.yaml`) and
  the website on Netlify (`netlify.toml`), which also builds a preview for every pull request.
  Rollback steps are in [`docs/DEPLOY.md`](docs/DEPLOY.md).
- **Renovate** opens one grouped pull request per week for minor and patch updates, with
  semantic commit messages, and keeps the lockfile fresh.

## Engineering workflow

- **Conventional Commits:** `type(scope): summary`, for example
  `feat(core): evaluate each leg against its own direction` or `fix(registry): …`, with the usual
  types (`feat`, `fix`, `docs`, `chore`, `test`, `refactor`). Squash merging keeps one such commit per pull
  request on `main`.
- **Branches:** `feat/…`, `fix/…`, `chore/…`, `docs/…`, small and focused (one idea per pull
  request).
- **Definition of Done** in the [pull request template](.github/pull_request_template.md):
  `pnpm check` passes, tests at the right level, no secrets or personal data, checked at phone
  width with a keyboard, docs and ADRs updated, verified in the preview deployment.
- **Architecture Decision Records:** every decision someone might question later is written down
  with its context and consequences: [`docs/adr/`](docs/adr/), 16 so far, from the monorepo layout
  to the backup-elevator rule.
- **Roadmap by phases**, each with a "done when" check: [`docs/ROADMAP.md`](docs/ROADMAP.md).

## Getting started

Needs Node 24 (`.nvmrc`) and pnpm (version pinned in `package.json`).

```bash
pnpm install
cp apps/web/.env.example apps/web/.env.local   # Maps JavaScript key (browser)
cp apps/api/.env.example apps/api/.env          # Google key for routes and places, optional Gemini key
pnpm dev                                        # API on :8787, web on :5173 (proxied as /api)
```

Without keys the API still starts and serves elevator status; planning trips needs the Google
key. Set `STATUS_DEMO=true` in `apps/api/.env` to use the last known status as current.

| Command                                            | What it does                                                      |
| -------------------------------------------------- | ----------------------------------------------------------------- |
| `pnpm check`                                       | Lint, typecheck and all tests with coverage: exactly what CI runs |
| `pnpm test:e2e`                                    | Browser tests on phone and desktop, with accessibility checks     |
| `pnpm test:watch`                                  | Tests in watch mode while working                                 |
| `pnpm format`                                      | Fix formatting and safe lint issues                               |
| `pnpm --filter @rutalibre/registry build:registry` | Rebuild `stations.json` and `REPORT.md` from the sources          |

### Repository layout

```
rutalibre/
├─ packages/core/       rules: matching stops, verdicts, ranking, walking pace. Pure, no dependencies
├─ packages/registry/   station registry built from sources/, with its build report
├─ packages/contract/   zod schemas for the HTTP API, typed client, OpenAPI source
├─ apps/api/            Hono API: routes, Google and Gemini adapters, status poller, middleware
├─ apps/web/            React app: search, results, map, i18n; Playwright tests in e2e/
├─ docs/                roadmap, deployment, data sources, ADRs
└─ .github/             CI and CodeQL workflows, pull request template
```

## Documentation

- [`docs/ROADMAP.md`](docs/ROADMAP.md): the build plan, phase by phase, with what's done and open
- [`docs/BRIEF.md`](docs/BRIEF.md): who it's for, the one promise, non-goals, success metrics
- [`docs/DEPLOY.md`](docs/DEPLOY.md): deploying to Render and Netlify, and rolling back
- [`docs/DATA_SOURCES.md`](docs/DATA_SOURCES.md): licences, permissions and terms for every source
- [`docs/adr/`](docs/adr/): Architecture Decision Records
- [`docs/PROTOTYPE_LESSONS.md`](docs/PROTOTYPE_LESSONS.md): what the hackathon prototype taught us
- [`CONTRIBUTING.md`](CONTRIBUTING.md) and [`AGENTS.md`](AGENTS.md): how to work in this repo

## Data and credits

- Elevator and escalator catalogue and status: [ariellopez.cl](https://ariellopez.cl/metro/accesibilidad/)
  and [seguimos.cl](https://velocidades.seguimos.cl/), by Ariel López and Willy Maikowski.
- Metro line geometry and station corrections: © OpenStreetMap contributors
  ([ODbL](https://www.openstreetmap.org/copyright)).
- Maps, routing and place search: Google Maps Platform. Free-text trips: Google Gemini.

## License

Code: [MIT](LICENSE). Data files keep their own terms ([`docs/DATA_SOURCES.md`](docs/DATA_SOURCES.md));
the Metro line geometry derived from OpenStreetMap stays under the ODbL.
