# 2. Monorepo with a pure domain core

- **Status:** Accepted
- **Date:** 2026-10-27

## Context

In the prototype, the accessibility logic (matching stations, checking directions, choosing a
fallback route) lived inside a 700-line React component mixed with map and UI code. It had no
tests, and it had a real bug at transfer stations that nobody could have caught without them.

## Decision

One pnpm workspace with:

- `packages/core`: pure TypeScript domain logic. No network, no DOM, no framework, no runtime
  dependencies.
- `packages/registry`: build-time pipeline producing the station registry.
- `apps/api`: HTTP layer and adapters to external services.
- `apps/web`: the user interface.

Dependencies point inward only (`apps/*` → `packages/core`), enforced in CI.

## Consequences

- The logic people's safety depends on can be tested exhaustively with plain unit tests.
- The same `core` runs on the server (normal planning) and in the browser (demos, offline later).
- Slightly more setup than a single app; worth it from day one.
