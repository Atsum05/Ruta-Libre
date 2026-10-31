# 13. A shared contract package instead of @hono/zod-openapi

- **Status:** Accepted
- **Date:** 2026-10-28

## Context

Phase 6 asks for a typed contract: OpenAPI generated from zod schemas and a typed client for the
web app, with no hand-written response types. The roadmap suggested `@hono/zod-openapi`, which
wraps routes in its own builder and its own extended `z`. The web app must also not import from
`apps/api` (dependencies point inward, ADR 0002).

## Decision

- `packages/contract` holds the zod schemas for every request and response, the inferred types,
  and `createApiClient`, a small typed client that validates every response.
- `apps/api` validates requests with those schemas and builds its responses to their types.
  Integration tests parse every response with them.
- The OpenAPI 3.1 document (`GET /v1/openapi.json`) is generated from the same schemas with zod 4's
  built-in `z.toJSONSchema`. Nothing in it is written by hand.
- Core's `Reason` and the wire `ReasonSchema` are kept identical by a compile-time test.

## Consequences

- One plain-zod source of truth used by both apps, with no extra framework in the routes.
- The web depends on `packages/contract`, never on `apps/api`.
- OpenAPI path entries (methods, parameters, status codes) are listed in one small file; adding an
  endpoint means adding it there too, which the OpenAPI test checks.
