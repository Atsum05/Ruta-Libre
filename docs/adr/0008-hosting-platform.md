# 8. Hosting platform

- **Status:** Accepted (2026-10-28)
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

## Decision

**Netlify (web) + Render (API)**, for familiarity and plain Node:

- Netlify hosts `apps/web` with a deploy preview per PR, and proxies `/api/*` to Render so the
  browser sees one origin.
- Render runs `apps/api` as a Node web service, plus Postgres (status history) and Key Value
  (latest snapshot). The status poller starts as a timer inside the single API instance.

All accounts must be owned by the project, not a personal or borrowed account. Because the API is
written in Hono with providers behind interfaces, moving platforms later is a contained change.

## Consequences

- Two vendors and two bills, but plain Node: no runtime restrictions on dependencies.
- The API needs a paid always-on Render instance before launch; free instances sleep when idle.
- Once there's more than one API instance, the poller must move to a Render Cron Job, or polling
  gets duplicated.
- Previews of the API per PR need Render's preview environments; check the plan that includes them
  when setting up Phase 2.
