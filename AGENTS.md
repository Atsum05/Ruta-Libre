# AGENTS.md: instructions for AI agents and contributors

Read this first. Details live in `docs/`; open them when the task needs them.

## What this is

RutaLibre: accessible public-transport routing for Santiago. Plans Metro and bus trips around the
elevators and escalators that are out of service right now, and says so plainly when it can't be
sure. A broken elevator blocks a route; a broken escalator only warns.

- **Status:** production rebuild in progress, following [`docs/ROADMAP.md`](docs/ROADMAP.md) phase by phase.
- **Team:** one developer. Keep process lightweight but keep the gates (CI, tests, ADRs).
- The original hackathon prototype (`equipo-3-haCAIthon-2026`) is **reference only**. Don't copy
  code from it without tests. What it taught us (data formats, API quirks, known bugs) is in
  [`docs/PROTOTYPE_LESSONS.md`](docs/PROTOTYPE_LESSONS.md). Read it before phases 3–6.

## Decisions already made (see `docs/adr/`)

- pnpm monorepo; `packages/core` is pure TypeScript with no I/O; dependencies point inward only.
- Google Maps JavaScript API behind a `<MapCanvas>` component (ADR 0009 supersedes MapLibre:
  Google's terms require Google routes/places to be shown on a Google map).
- Thin Hono API holds every key; the browser never calls third-party APIs directly. One exception:
  the Maps JavaScript key, restricted to our domains and to that API only.
- Verdicts are `ok | warning | blocked | unknown`. Never treat missing data as "fine".
- Stops are matched to stations by location via a generated station registry, not by name.
- External services (Google Routes/Places, seguimos.cl, Gemini) sit behind provider interfaces.
  Google is the routing provider for now.
- Hosting is **not decided yet** (candidates in ADR 0008). Keep code platform-neutral.

## Commands

```bash
pnpm install
pnpm dev          # API on :8787 + web on :5173 (needs apps/web/.env.local, see .env.example)
pnpm check        # lint + typecheck + test (exactly what CI runs). Must pass before "done"
pnpm format       # auto-fix formatting and safe lint issues
pnpm test:watch
```

## How purity of `packages/core` is enforced

- `packages/core/tsconfig.json` has no DOM lib and no Node types, so `fetch`, `window`,
  `process` and `node:*` fail the typecheck.
- `biome.json` blocks `node:*`, `@rutalibre/*` and `apps/**` imports in core source.
- `purity.test.ts` fails if core gains any runtime dependency.

Don't loosen these to make something compile. Move the I/O into an adapter instead.

## Rules

1. Never commit secrets. Env vars are declared in a zod schema; `.env.example` holds the template.
2. Work on the current roadmap phase; don't jump ahead without asking.
3. Every change passes `pnpm check` (typecheck, lint, test) before it's called done.
4. A new or changed architectural decision gets an ADR.
