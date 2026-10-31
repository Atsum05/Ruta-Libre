# Deploying RutaLibre

The API runs on **Render**, the web app on **Netlify** ([ADR 0008](adr/0008-hosting-platform.md)).
Both deploy themselves from GitHub; after this one-time setup, merging to `main` is the whole
release process. Configuration lives in the repo: [`render.yaml`](../render.yaml) and
[`netlify.toml`](../netlify.toml). Secrets never do.

```
Browser ──► Netlify (web app)  ── /api/* proxy ──►  Render (API)  ──► Google, seguimos.cl
            rutalibre.netlify.app                    rutalibre-api.onrender.com
```

## 0. Before you start

- **Accounts owned by the project**, not a personal or borrowed one (the prototype's open risk).
  Use one project email for Google Cloud, Render and Netlify, and sign in to each with GitHub.
- **Production Google keys, separate from your local ones**, in the same Google Cloud project:

  | Key         | Application restriction                                      | API restriction              |
  | ----------- | ------------------------------------------------------------ | ---------------------------- |
  | Browser key | Websites: added in step 3, once you know the Netlify address | Maps JavaScript API          |
  | Server key  | None (Render has no fixed address on the starter plan)       | Routes API, Places API (New) |

- **Billing safety:** in Google Cloud set a budget alert, and under each API's _Quotas_ cap the
  requests per day so a bug or abuse can't run up a bill.

## 1. Deploy the API on Render

1. Render dashboard → **New** → **Blueprint** → connect your GitHub account → pick `Ruta-Libre`.
2. Render reads `render.yaml` and shows one service, `rutalibre-api`. It asks for the secrets:
   - `GOOGLE_MAPS_API_KEY`: the **server** key.
   - `GEMINI_API_KEY`: optional; leave empty to turn off free-text search.

   Paste each value directly. Don't pipe a key through PowerShell's `echo`: it adds an invisible
   character that breaks the key (the API refuses to start and names the variable).
3. **Apply.** The first build takes a few minutes.
4. Check `https://<your-service>.onrender.com/v1/health`. You should see
   `{"status":"ok","version":"0.1.0","commit":"<sha>","env":"production"}`.
5. Check `/v1/status`. While seguimos.cl stays frozen it says `"health":"stale"`; that's expected
   ([ADR 0012](adr/0012-status-freshness-follows-the-source.md)).

The service uses the **starter** plan: the free plan sleeps when idle, which would stop the status
poller and make the first request after a pause slow.

## 2. Deploy the web app on Netlify

1. Netlify → **Add new site** → **Import an existing project** → GitHub → pick `Ruta-Libre`.
2. Netlify reads `netlify.toml`, so leave the build settings as detected (base directory empty,
   build command and publish directory come from the file).
3. **Environment variables** (Site configuration → Environment variables), before the first deploy:
   - `VITE_GOOGLE_MAPS_KEY`: the **browser** key.
   - `API_ORIGIN`: the Render address from step 1, e.g. `https://rutalibre-api.onrender.com`
     (no trailing path). The build fails with a clear message if it's missing or malformed.
4. **Deploy.** Open the site: the footer shows `web 0.1.0 (<sha>) · api 0.1.0 (<sha>, production)`.

## 3. Restrict the browser key to your site

Google Cloud → Credentials → the browser key → **Websites**, add:

- `https://<your-site>.netlify.app/*`
- `https://deploy-preview-*--<your-site>.netlify.app/*` (pull-request previews)
- your custom domain later, e.g. `https://rutalibre.cl/*`

Until this is done the key works from any website, so do it right after the first deploy.

## 4. How deploys work from now on

| Event           | Web (Netlify)                                | API (Render)                                              |
| --------------- | -------------------------------------------- | --------------------------------------------------------- |
| Pull request    | A **deploy preview** URL is posted on the PR | Nothing (previews use the production API)                 |
| Merge to `main` | Deploys to production                        | Deploys if `apps/api`, `packages` or dependencies changed |

The `main` ruleset already requires a PR with green CI, so only tested code reaches production.
Render preview environments (a preview API per PR) need a paid Render workspace; turn them on
later if a PR changes the API in a way previews must show.

## 5. Check the live site

- [ ] `/api/v1/health` **through the Netlify address** returns JSON (the proxy works).
- [ ] The status banner appears (stale is fine while the feed is frozen).
- [ ] The map loads, with Metro lines and coloured stations.
- [ ] Searching two places and planning a trip returns a route.
- [ ] On a phone: the layout fits, location permission is asked only when you tap the button.

## 6. Turn on the web Content-Security-Policy

`netlify.toml` ships the CSP as **report-only**, because Google Maps loads code from several
Google domains and a wrong policy would break the map. After the first deploy, open the site with
the browser console open, use the map and plan a trip. If the console shows no
`Content-Security-Policy-Report-Only` violations, rename the header to `Content-Security-Policy`
in `netlify.toml` and merge. If it does, add the reported domain to the matching directive first.

## 7. Roll back once, on purpose (roadmap phase 2)

- **Web:** Netlify → Deploys → pick the previous deploy → **Publish deploy**.
- **API:** Render → `rutalibre-api` → **Events** → previous deploy → **Rollback**.

Do both once while nothing is at stake, so you know the way when something is. To return to the
latest version, publish (Netlify) or redeploy (Render) the newest deploy.

## Troubleshooting

| Symptom                                                | Likely cause                                                                |
| ------------------------------------------------------ | --------------------------------------------------------------------------- |
| Render log: `Refusing to start: invalid configuration` | A variable is missing or malformed; the log names it.                       |
| `/v1/plan` and place search answer 503                 | `GOOGLE_MAPS_API_KEY` not set on Render.                                    |
| Free-text search says to use the fields                | `GEMINI_API_KEY` not set (optional), or Gemini failed.                      |
| "El mapa no está disponible"                           | Browser key wrong, or the site's address isn't in its website restrictions. |
| `/api/...` returns 404 on Netlify                      | `API_ORIGIN` wrong, or set after the deploy: redeploy.                      |
| Netlify build fails with `API_ORIGIN must ...`         | Fix the variable as the message says, then retry.                           |
| Every route says "No podemos confirmarlo"              | The status feed is stale; check `/api/v1/status`.                           |
