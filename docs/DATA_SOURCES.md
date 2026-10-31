# Data sources and legal audit

- **Status:** Researched 2026-10-28. **No blockers open**; follow-ups listed at the bottom.
- Re-check each row before launch: terms change. Every row links to where we read it.

## Summary

| Source                                         | Used for                          | Licence / terms                      | Attribution                    | Rate limit            | Status      |
| ---------------------------------------------- | --------------------------------- | ------------------------------------ | ------------------------------ | --------------------- | ----------- |
| Elevator & escalator catalogue (ariellopez.cl) | Device IDs, stations, coordinates | Permission from Ariel López          | Credit the authors             | n/a (static file)     | ✅ Approved |
| Live device status (seguimos.cl)               | Working / out of service, now     | Permission from Ariel López          | Credit the authors             | 1 req / 1–2 min       | ✅ Approved |
| OpenStreetMap                                  | Metro line geometry overlay       | ODbL 1.0                             | "© OpenStreetMap contributors" | n/a (we extract once) | ✅ OK       |
| Santiago GTFS (DTPM)                           | Station registry (Phase 4), OTP   | **None stated** on the download page | Unknown                        | n/a (download)        | ⚠️ Ask      |
| Google Maps JavaScript API                     | The map itself                    | Google Maps Platform terms           | Drawn by Google                | Quota + billing       | ✅ OK       |
| Google Routes API                              | Transit routing                   | Google Maps Platform terms           | Shown on a Google map          | Quota + billing       | ✅ OK       |
| Google Places API                              | Place search / autocomplete       | Google Maps Platform terms           | Shown on a Google map          | Quota + billing       | ✅ OK       |
| Gemini API                                     | Free text → origin/destination    | Gemini API terms                     | n/a                            | Quota                 | ⚠️ Decide   |
| Web Speech API (browser)                       | Voice input                       | Browser feature, no contract         | n/a                            | n/a                   | ⚠️ Disclose |

## Details

### Elevator & escalator catalogue: ariellopez.cl

- Page: <https://ariellopez.cl/metro/accesibilidad/>. Built by **Ariel López and Willy Maikowski**.
- The page states no licence, no data source, and offers no download. Our copy
  (`metro_dispositivos.geojson`, ~949 devices) came from the prototype.
- Contact: only through the authors' X (Twitter) profiles linked on the page. No email.
- **Approved:** Ariel López gave RutaLibre permission to use the data (recorded 2026-10-28). Keep a
  copy of that message outside the repo as evidence.
- **Follow-up (not blocking):** confirm the credit wording, whether redistributing the catalogue
  file in a public repo is fine, and where the data originally comes from (Metro de Santiago?).

### Live device status: seguimos.cl

- Endpoint: `https://velocidades.seguimos.cl/?metro=1&all=1`. **Same two authors** as the
  catalogue, so one conversation covers both.
- No terms, no API documentation, no rate limit published. The page says its (bus) data updates
  every 30 s; elevator status cadence is unknown.
- **Approved:** covered by Ariel López's permission (see the catalogue above).
- We poll from one server at most once per 1–2 min (ADR 0004), with a `User-Agent` naming RutaLibre
  and a contact. **Follow-up:** tell Ariel that rate and agent string before Phase 5 goes live.
- ⚠️ **Found 2026-10-28:** each device record carries the time seguimos.cl last checked it. Checks
  happen about twice a day (12:21 and 20:21), and the newest was **2026-10-16 20:21**: the feed
  had stopped updating 12 days earlier while still answering normally. We date snapshots by that
  time, so the app shows `unknown`/`stale` instead of a false all-clear
  ([ADR 0012](adr/0012-status-freshness-follows-the-source.md)). **Ask Ariel** about the intended
  cadence and the outage, and where elevator status originates (an official Metro source?).

### OpenStreetMap

- Licence: [Open Database License (ODbL) 1.0](https://www.openstreetmap.org/copyright).
- The base map is Google's, but our Metro line overlay comes from OSM, so the map must still show
  "© OpenStreetMap contributors".
- `metro_lineas.geojson` is a **derived database**: it stays under ODbL (share-alike), not MIT.
  Mark it as such when it's added to the repo (Phase 4).

### Santiago GTFS: DTPM

- Download: <https://www.dtpm.cl/index.php/gtfs-vigente>. Current feed valid from 3 Oct 2026.
  Listed on [MobilityDatabase](https://mobilitydatabase.org/feeds/gtfs/mdb-3357) as covering Metro
  de Santiago, Red Movilidad buses, EFE trains, and the airport bus.
- The page states **no licence**.
- Contact: dtpm.custhelp.com, tel. 22 421 3000 ext. 8511 (Mon–Fri 9:00–14:00).
- **To do:** ask for the licence and update cadence. Not urgent until Phase 4.

### Google Routes API and Places API

From Google's own policy pages (both last updated 2026-10-27):

- [Routes API policies](https://developers.google.com/maps/documentation/routes/policies):
  "Routes API results displayed on a map must be shown on a Google Map." Attribution with the
  Google logo is required if not shown on a Google Map. Caching of most route content is
  restricted; place IDs may be stored indefinitely.
- [Places API policies](https://developers.google.com/maps/documentation/places/web-service/policies):
  "Places API results displayed on a map must be shown on a Google Map." Without a Google Map, show
  the Google logo. Autocomplete suggestions fall under the same restrictions. No pre-fetching,
  caching, or storing beyond the exceptions (place IDs).
- **Resolved by [ADR 0009](adr/0009-google-maps-for-map-rendering.md):** the map is a Google map
  (Maps JavaScript API), so Google routes and places are shown where the terms allow. That key is
  the one key in the browser: restricted to our domains and to the Maps JavaScript API, with a
  quota cap. Routes and Places are still called only from our API.

### Gemini API

- [Gemini API terms](https://ai.google.dev/gemini-api/terms): on the **unpaid** tier, Google may
  use prompts and responses to improve its products, and human reviewers may read them. Google
  advises not sending personal information to unpaid services.
- On the **paid** tier (a Cloud Billing account enabled), prompts aren't used for training; they're
  logged for a limited time for abuse detection.
- Users' free-text queries contain where they're going, and may mention a disability.
- **Decision:** use the paid tier in production, or drop the natural-language feature at launch.

### Web Speech API

- Runs in the browser with no key. In Chrome, recognition may send audio to Google's servers.
- **To do:** say so in the privacy policy (Phase 9), and keep voice optional.

## Personal data: Ley 21.719

- Published 13 Dec 2024; **in force 1 Dec 2026**, before our launch. A government bill
  (boletín 18.623-07, Sept 2026) proposes postponing it to 1 Dec 2027; plan for the earlier date.
- It creates a data-protection agency with real enforcement.
- What we handle: device location (GPS), typed or spoken trip queries, IP addresses in logs.
  Treat all of them as personal data; queries may reveal health information (a disability).
- Our design already minimises: no accounts, no stored trips. Still to do (Phases 6, 8, 9):
  - Don't log raw coordinates or query text (round coordinates, no user identifiers).
  - Set and publish a retention period for logs.
  - Privacy policy naming the processors (Google, hosting provider) and what each receives.
- Get a lawyer's read before launch. This section is research, not legal advice.

## Blockers

None open. Resolved:

- Google results on a non-Google map → Google Maps for the map
  ([ADR 0009](adr/0009-google-maps-for-map-rendering.md), 2026-10-28).
- Permission for the catalogue and live status → approved by Ariel López (2026-10-28).

Not blocking yet: DTPM licence (needed by Phase 4), Gemini tier (needed by Phase 6).
