# RutaLibre: build roadmap

This is the plan for taking RutaLibre from hackathon prototype to a maintained, live product.
Work through the phases in order. Each phase ends with a **Done when** check. A phase isn't
finished until that check is true, even if the code exists.

Phase 2 deliberately ships a _walking skeleton_: a thin version of every layer, deployed
automatically. Everything after that deepens a system that already ships, which is far
safer than building everything first and deploying at the end.

---

## Principles (these apply to every phase)

1. **The verdict is the product.** "This route works for you right now" is the only thing
   RutaLibre does that others don't. That logic lives in `packages/core`, is pure, and is the most
   heavily tested code in the repo.
2. **Fail visibly, never silently.** Missing data, stale data, or an unmatched stop produces an
   explicit `unknown` verdict and shows up in the UI. It is never treated as "fine".
   ([ADR 0005](adr/0005-tri-state-accessibility-verdict.md))
3. **Dependencies point inward.** `apps/web` and `apps/api` depend on `packages/core`, never the
   reverse. External services sit behind interfaces (adapters) so they can be swapped.
4. **Validate at the edges, trust inside.** Every external input (HTTP request, upstream API
   payload, env var, LLM output) is parsed with a schema (zod) at the boundary. Inside, types are
   trusted. Parse, don't validate.
5. **Every merge to `main` is deployable**, and deployment is automatic. Small PRs, short-lived
   branches, squash merges.
6. **Decisions are written down.** Anything that would make a newcomer ask "why is it like this?"
   gets an ADR in `docs/adr/`.
7. **YAGNI on infrastructure.** No microservices, Kubernetes, or Turborepo until a measured pain
   justifies them. The simplest thing that meets the "Done when" wins.
8. **Automate what repeats.** If a step is done twice by hand (deploy, release, data regen), script it.

### Definition of Done (every PR)

- [ ] Typecheck, lint, and tests pass in CI.
- [ ] New behaviour has tests at the right level (unit for core, integration for API, e2e for flows).
- [ ] No secrets, tokens, or personal data in code, logs, or fixtures.
- [ ] UI changes checked on a phone-width viewport, with keyboard and screen reader basics.
- [ ] Docs/ADR updated if behaviour or a decision changed.
- [ ] Verified in the preview deployment, not just locally.

---

## Phase 0: Frame the product (before any code)

**Goal:** agree on what "live" means and remove legal/data blockers early.

- [x] Write a one-page **product brief** ([`BRIEF.md`](BRIEF.md)): who the users are, the one
  promise, and **non-goals** for launch.
- [x] Agree the **success metrics** proposed in the brief (stop-match ≥ 99%, confident verdicts
  ≥ 95%, status freshness p95 < 3 min, `/plan` p95 < 2.5 s, crash-free ≥ 99.5%).
- [x] **Data & legal audit** in [`DATA_SOURCES.md`](DATA_SOURCES.md): licence, attribution, rate
  limits, and contacts for every source, plus Ley 21.719.
  - [x] **Google Maps Platform terms** verified: Google routes/places must be shown on a Google map.
    Resolved by switching the map to Google Maps ([ADR 0009](adr/0009-google-maps-for-map-rendering.md)).
  - [x] **Permission** from the catalogue and live-status authors (ariellopez.cl / seguimos.cl):
    approved by Ariel López. Credit wording and polling rate to confirm before Phase 5.
  - [ ] Ask DTPM for the GTFS licence (needed by Phase 4).
- [x] Review and accept the ADRs in `docs/adr/`, including hosting
  ([ADR 0008](adr/0008-hosting-platform.md): Netlify + Render).

**Done when:** brief merged, metrics agreed, data table filled with no unresolved blocker.
✅ Signed off 2026-10-28; complete once the Phase 0 PR is merged.

---

## Phase 1: Repository foundations

**Goal:** a repo where doing the right thing is the default.

- [x] **Move the repo out of OneDrive**: now at `C:\dev\rutalibre`.
- [x] Create the GitHub repo ([Atsum05/Ruta-Libre](https://github.com/Atsum05/Ruta-Libre));
  protect `main` with a ruleset: PR required, `check` must pass, squash-merge only, no force-push. Working solo, you merge your own PRs, but the PR still earns its keep: it's
  where CI runs and where the preview deploy appears.
- [x] **pnpm workspace** with `packages/*` and `apps/*`. Node pinned via `.nvmrc`, `engines`, and
  the `packageManager` field; tool versions shared through the pnpm `catalog`. Lockfile committed.
- [x] **TypeScript strict** everywhere, plus `noUncheckedIndexedAccess` and
  `exactOptionalPropertyTypes`, from a shared `tsconfig.base.json`.
- [x] **Biome** for lint + format, `.editorconfig`, format-on-save via `.vscode/settings.json`.
- [x] **Boundary enforcement** for `packages/core`: typecheck without DOM/Node types, Biome
  restricted imports, and a no-dependencies test. Verified by injecting violations.
- [x] **Vitest** wired at the root; one passing test per package.
- [x] Root scripts: `pnpm check` = lint + typecheck + test (the same command CI runs).
- [x] **CI (GitHub Actions):** `.github/workflows/ci.yml` runs `pnpm check` on every PR and push to `main`.
- [x] **Conventions:** Conventional Commits (in `CONTRIBUTING.md`) and a PR template containing the
  Definition of Done (add `CODEOWNERS` once there's a second contributor).
- [x] **Renovate:** `renovate.json` committed and the Renovate GitHub app installed on the repo.
- [x] `AGENTS.md` (+ a one-line `CLAUDE.md` pointing to it).
- [x] `CONTRIBUTING.md`.
- [x] `LICENSE`: MIT.

**Done when:** a trivial PR goes red when it breaks a test or the import boundary, and green when fixed.
✅ Verified 2026-10-28: a PR importing `node:fs` in core went red and couldn't merge, then green once fixed.

---

## Phase 2: Walking skeleton (deployed end to end)

**Goal:** the full path (browser → API → response) is live and deploys itself.

- [x] `apps/web`: Vite + React + TS rendering a **Google Maps** map of Santiago
  ([ADR 0009](adr/0009-google-maps-for-map-rendering.md)) behind `<MapCanvas>`.
- [ ] Browser Maps key restricted to our domains and the Maps JavaScript API, with a quota cap.
- [x] `apps/api`: **Hono** with `GET /v1/health` returning version + commit SHA.
- [x] Web calls `/v1/health` (through the same-origin `/api` proxy) and shows the version in a
  debug footer.
- [x] **Config:** every env var is declared in a zod schema per app; the app refuses to start
  with missing or malformed config (this would have caught the prototype's BOM-in-the-key bug
  at boot instead of as a fake CORS error).
- [ ] **Environments:** `local`, `preview` (every PR), `production` (main). Secrets live only in
  the hosting platform's secret store, with a template in `.env.example`.
- [ ] **CD:** PR → preview URL posted on the PR; merge → production. No manual deploy steps.
- [ ] **Rollback** documented and tried once (redeploy the previous version).

**Done when:** merging a PR changes the live site within minutes with no human action, and you've
rolled back once on purpose.

---

## Phase 3: Core domain (`packages/core`), test-first

**Goal:** the accessibility verdict as a pure, fully tested library.

- [x] **Types:** `StationId`, `DeviceId` (branded), `Station`, `Device` with a platform scope (by
  terminal station), `StatusSnapshot` (with `observedAt`), `Route`, `Leg`, `Verdict` with findings.
- [x] **Functions (no I/O):**
  - `matchStop(stop, registry)`: location first (nearest station within ~150 m), name as tie-breaker
    ([ADR 0006](adr/0006-match-stops-by-location.md))
  - `evaluateRoute(route, snapshot, registry, now)` → `ok | warning | blocked | unknown` with reasons
  - `chooseRoute(evaluated[])` → ranked plans (the fallback order, expressed as data)
  - `adjustWalkingTime(seconds)` (factor documented and configurable)
- [x] **Write the rules as tests first**, including every prototype bug as a regression test.
  The full rule table is [ADR 0010](adr/0010-verdict-rules.md):
  - transfer station: each leg is checked against **its own** direction
  - broken elevator on your platform → `blocked`
  - broken elevator on the opposite platform → `warning`, not silently ignored
  - broken escalator only → `warning`
  - snapshot older than the threshold → `unknown`
  - unmatched stop → `unknown`
  - elevator with no status → `unknown` (an escalator with no status is ignored: ADR 0010)
- [ ] **Golden tests:** record ~15 real Google responses (transfers, express "Ruta Roja/Verde",
  bus-only, no-alternative) as fixtures; assert the full plan output. Needs a Google key and the
  Routes adapter, so it's done with Phase 6.
- [x] Coverage gate on core: ≥ 95% branches, lines, functions and statements, enforced by `pnpm test`.
  Mutation check done by hand (2026-10-28): reintroducing prototype bugs #1 and #2, ignoring the
  direction, or letting escalators block each makes the suite fail.

**Done when:** every rule above has a test, and core has zero runtime dependencies.

---

## Phase 4: Station registry pipeline (`packages/registry`)

**Goal:** stations identified by ID, not by fuzzy strings.

- [x] Script that reads the elevator catalogue and the live feed's device texts, and outputs
  `stations.json`: ID, coordinates, lines, platforms by terminal, device IDs, name aliases.
  One station per line, grouped into complexes ([ADR 0011](adr/0011-registry-stations-per-line.md)).
- [ ] Add DTPM GTFS stop coordinates (fixes Baquedano, see the report) once DTPM confirms the
  licence. OSM line geometry is a map overlay, so it moves to Phase 7.
- [x] Zod schema for the output; the build fails on schema violations.
- [x] **Validation report** (`packages/registry/REPORT.md`): devices without a station, unknown
  device kinds, unrecognised directions, terminals that don't exist, duplicate names, spread-out
  complexes. The build fails on any exception not explained in its config.
- [x] Output is **committed** so every data change is a reviewable diff in a PR; a test fails if
  it's stale or hand-edited.
- [x] Document how and when to regenerate: `packages/registry/sources/README.md`.

**Done when:** the report is clean (or every exception is listed with a reason) and core tests use it.
✅ 2026-10-28: 143 stations, 1,111 device entries, 4 explained issues; core's rules are tested on
the real registry (`packages/registry/src/stations.test.ts`).

---

## Phase 5: Status ingestion

**Goal:** fresh, shared, validated live status, so no user's request ever hits the upstream directly.

- [x] `StatusProvider` adapter for seguimos.cl: parse with zod and map to `DeviceId`s. Snapshots
  are dated by the source's own observation time, not our fetch time
  ([ADR 0012](adr/0012-status-freshness-follows-the-source.md), proposed).
- [x] **Scheduled poller** (every 2 min by default, minimum 1 min) writes the latest snapshot to a
  store behind a `SnapshotStore` interface. In memory now; Render Key Value at deploy time.
- [x] On a failed fetch or a schema mismatch: **keep the last good snapshot, mark the source
  degraded, log an error** (alerts come with Phase 8). Never overwrite good data with garbage,
  nor with an older snapshot.
- [x] Record **status changes** (device, old → new, timestamp) behind a `StatusHistory` interface.
  In memory now; Render Postgres at deploy time.
- [x] `GET /v1/status` → snapshot + age + health (`ok | stale | degraded | unavailable`), with
  cache headers.
- [x] Contract tests against saved upstream payloads (a real sample, empty, malformed, HTML, HTTP
  error, timeout).
- [ ] Persistent store and history (Key Value, Postgres) when deploying.
- [ ] Decide ADR 0012: the freshness threshold (13 h proposed) and the freshness metric.

**Done when:** blocking the upstream in preview makes the UI show "degraded", and verdicts turn
`unknown` once the snapshot passes the freshness threshold.

---

## Phase 6: Planning API

**Goal:** one request returns ranked, evaluated plans; no keys ever reach the browser.

- [x] `POST /v1/plan {origin, destination, departAt?}`, with the request validated by zod.
- [x] `RoutingProvider` Google adapter: field mask includes **stop locations** and **line text
      colour**; bus-only fallback request; results mapped to core `Route` (Metro lines to registry
  IDs, ADR 0011).
- [x] `/plan` runs `core.evaluateRoute` on all candidates → `core.chooseRoute` → response. Bus-only
  is requested only when no route is ok or warning.
- [x] `GET /v1/places?q=&session=` autocomplete proxy, biased to Santiago, using session tokens.
- [x] `POST /v1/interpret`: `LanguageProvider` (Gemini), structured output **validated by zod**,
  hard timeout; any failure is a 502/503 and the web falls back to the search fields.
- [x] **Cross-cutting:** upstream timeouts + retry with backoff, per-IP rate limiting, request IDs,
  structured JSON logs (paths only: no query strings, bodies or coordinates), CORS locked to
  configured origins, versioned routes (`/v1`), contract-shaped errors.
- [x] **Typed contract:** `packages/contract` zod schemas → inferred types, a typed client, and
  OpenAPI 3.1 at `/v1/openapi.json` ([ADR 0013](adr/0013-shared-contract-package.md)).
- [x] Integration tests with fake providers (no network in CI): the real Google adapter fed a
  saved response, evaluated against the real registry.
- [ ] Measure `/plan` p95 latency in preview (needs deployment and a Google key).

**Done when:** integration tests pass, and the p95 latency of `/plan` is measured in preview.

---

## Phase 7: Web app

**Goal:** a mobile-first, accessible app built on the typed API.

- [ ] **Structure by feature:** `features/search`, `features/itinerary`, `features/alerts`,
  `features/map`, plus `shared/`. No component over ~200 lines.
- [ ] **Server state with TanStack Query:** status refetch every 60 s, "updated 40 s ago"
  indicator, degraded banner.
- [ ] **`<MapCanvas>`** owns the Google Maps lifecycle: declarative overlays (Metro lines, device
  status, route), re-applied after a theme change. That trap lives in one place. OSM attribution
  shown for the Metro line overlay.
- [ ] **Verdict UI:** `ok / warning / blocked / unknown` each with colour **+ icon + text** (never
  colour alone). `unknown` is prominent, not a footnote.
- [ ] **Inputs:** autocomplete fields as the main path; voice → `/interpret` as an extra.
- [ ] **Location:** explicit permission request; if denied, ask for an origin. No silent default.
- [ ] **i18n from day one** (es-CL default, en): all strings in a catalogue.
- [ ] **Accessibility (WCAG 2.2 AA):** axe checks in CI, full keyboard use, screen-reader labels on
  the itinerary, 44 px touch targets, `prefers-reduced-motion`, contrast from line text colour.
- [ ] **Performance budget:** set JS size and LCP targets (e.g. LCP < 2.5 s on a mid-range Android
  over 4G); enforce with Lighthouse CI. Lazy-load the map library.
- [ ] Playwright e2e for main flows against a mocked API: plan a clean trip, a rerouted trip, a
  no-alternative trip, the degraded-status state.

**Done when:** e2e and axe checks pass in CI and the budget holds on a real phone.

---

## Phase 8: Hardening & observability

**Goal:** you hear about problems before users do.

- [ ] **Error tracking** (e.g. Sentry) in web + API, with source maps and release tagging.
- [ ] **Metrics:** plans/day, verdict distribution, stop-match failures, status age, upstream error
  rate and latency, Google spend.
- [ ] **Alerts** (and fire each one once on purpose to test it): status stale > 5 min, upstream
  error spike, match-rate drop, spend over budget.
- [ ] **Synthetic check:** a scheduled real `/plan` request in production every 5–10 min.
- [ ] **Security:** CSP and security headers; `pnpm audit` / secret scanning in CI; Google key
  restricted to only the APIs used; billing quotas capped; **no raw locations in logs** (round
  coordinates, no user identifiers).
- [ ] **Load test** `/plan` and `/status` (k6) at ~10× expected launch traffic.

**Done when:** every alert has fired once in a test, and the load test passes within the latency targets.

---

## Phase 9: Launch

**Goal:** go public responsibly.

- [ ] Privacy policy, terms, and an attributions page (OSM, data sources, providers).
- [ ] **Runbooks** in `docs/runbooks/`: upstream status down, key leaked → rotate, bad deploy →
  rollback, Google quota exhausted.
- [ ] **Usability testing with real users with reduced mobility** (partner with an organisation)
  before the public launch. Fix what they hit.
- [ ] **In-app "this info was wrong" report** on each station: your only source of ground truth
  about the upstream data's accuracy.
- [ ] Custom domain, HTTPS, status of all accounts owned by a **team/organisation account**, not
  personal ones (the prototype's open risk).

**Done when:** beta feedback has been addressed and the launch checklist is complete.

---

## Phase 10: Evolve (after launch, driven by data)

- **Reliability scores** per elevator from the status history ("down 30% of the last month"),
  used in ranking and shown to users.
- **OpenTripPlanner adapter** with Santiago GTFS: accessibility becomes a _routing constraint_
  (ban stations with broken elevators) instead of a filter over three Google routes.
  Moving off Google routing would also allow a non-Google map again (new ADR).
- PWA install, offline shell, other cities.

---

## Tech stack summary

| Concern     | Choice                                            | Why                                                   |
| ----------- | ------------------------------------------------- | ----------------------------------------------------- |
| Language    | TypeScript (strict)                               | Domain types are the safety net                       |
| Workspace   | pnpm workspaces                                   | Simple, fast; add Turborepo only if builds get slow   |
| Lint/format | Biome                                             | One tool, fast                                        |
| Tests       | Vitest, Playwright, axe                           | Unit → integration → e2e + a11y                       |
| Validation  | zod                                               | One schema for runtime checks, types, and OpenAPI     |
| API         | Hono                                              | Tiny, typed, runs on any platform                     |
| Web         | Vite + React + TanStack Query                     | No SSR needed for a map app                           |
| Map         | Google Maps JavaScript API                        | [ADR 0009](adr/0009-google-maps-for-map-rendering.md) |
| Hosting     | Netlify (web) + Render (API, Postgres, Key Value) | [ADR 0008](adr/0008-hosting-platform.md)              |
| Errors      | Sentry                                            | Releases + source maps                                |
| Deps        | Renovate                                          | Grouped, scheduled updates                            |
