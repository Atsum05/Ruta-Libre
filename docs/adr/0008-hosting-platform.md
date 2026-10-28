# 8. Hosting platform

- **Status:** Proposed (needs team agreement)
- **Date:** 2026-10-27

## Context

We need: static hosting for the web app, serverless functions for the API, a scheduled job
every 1–2 minutes (status poller), a key-value store (latest snapshot), a small SQL database
(status history), and optionally object storage for self-hosted map tiles. The prototype ran on
Vercel's personal plans, which allow only very infrequent cron jobs on the free tier.

## Options

- **Cloudflare:** Pages (web), Workers (Hono runs natively), Cron Triggers (minute
  granularity), KV, D1 (SQLite), R2 (tiles, no egress fees). All on one platform, generous free tier.
- **Vercel + Upstash/Neon:** familiar to the team, good preview deploys; frequent cron needs a
  paid plan; the database and KV come from separate vendors.
- **Netlify (web) + Render (API):** the developer's current preference. Netlify gives excellent
  static hosting and deploy previews. Render runs the Hono API as a plain Node service, with
  Postgres and Key Value (Redis-compatible) available on the same platform. Things to know
  (check current pricing and limits):
  - Free Render web services sleep when idle, so the first request after a pause is slow. The
    API needs an always-on (paid) instance for a usable launch.
  - The status poller can start as a timer inside the single always-on API instance. Move it to a
    Render Cron Job once there's more than one instance, or polling gets duplicated.
  - Use a Netlify proxy rule (`/api/*` → Render) so the browser sees one origin, avoiding
    CORS setup and keeping the API URL out of the frontend.

## Decision (proposed)

Not decided yet; leaning toward **Netlify + Render** for familiarity and plain Node. All accounts must be owned by
the project, not a personal or borrowed account. Because the API is written in Hono with providers
behind interfaces, moving platforms later is a contained change.

## Consequences

- One vendor and one bill for everything the app needs to run in production.
- Workers runtime is not full Node.js; dependencies must be Workers-compatible.
