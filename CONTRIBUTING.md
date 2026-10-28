# Contributing

## Setup

Requires Node 24 (see `.nvmrc`) and pnpm (version pinned in `package.json`).

```bash
pnpm install
pnpm check   # lint + typecheck + test: the same thing CI runs
```

Useful while working: `pnpm test:watch`, and `pnpm format` to auto-fix formatting and safe lint issues.

## Workflow

1. Branch from `main`: `feat/…`, `fix/…`, `chore/…`, `docs/…`.
2. Keep the change small: one idea per PR, ideally under ~400 changed lines.
3. Commit messages follow [Conventional Commits](https://www.conventionalcommits.org):
   `feat(core): evaluate each leg against its own direction`.
4. Open a PR, fill in the Definition of Done checklist, and wait for CI to pass.
5. Squash-merge. `main` must always be deployable.

## Where things go

- Domain rules → `packages/core` (pure: no network, DOM, Node built-ins, or runtime dependencies;
  enforced by typecheck and lint).
- Anything that talks to the outside world → an adapter in `apps/api`.
- A decision someone might later question → a new ADR in `docs/adr/`.
