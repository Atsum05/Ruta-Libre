# Data sources and legal audit

- **Status:** Researched 2026-10-28. **2 blockers open** (see the bottom of this page).
- Re-check each row before launch: terms change. Every row links to where we read it.

## Summary

| Source                                         | Used for                          | Licence / terms                      | Attribution                    | Rate limit            | Status      |
| ---------------------------------------------- | --------------------------------- | ------------------------------------ | ------------------------------ | --------------------- | ----------- |
| Elevator & escalator catalogue (ariellopez.cl) | Device IDs, stations, coordinates | **None stated**                      | Unknown; credit them anyway    | n/a (static file)     | ⚠️ Ask      |
| Live device status (seguimos.cl)               | Working / out of service, now     | **None stated**, no API docs         | Unknown; credit them anyway    | **None stated**       | ⚠️ Ask      |
| OpenStreetMap                                  | Metro line geometry, base map     | ODbL 1.0                             | "© OpenStreetMap contributors" | n/a (we extract once) | ✅ OK       |
| OpenFreeMap                                    | Map tiles and style               | Free, no key                         | OpenFreeMap, OpenMapTiles, OSM | Fair use              | ✅ OK       |
| Santiago GTFS (DTPM)                           | Station registry (Phase 4), OTP   | **None stated** on the download page | Unknown                        | n/a (download)        | ⚠️ Ask      |
| Google Routes API                              | Transit routing                   | Google Maps Platform terms           | Google Maps logo               | Quota + billing       | ❌ Blocker  |
| Google Places API                              | Place search / autocomplete       | Google Maps Platform terms           | Google Maps logo               | Quota + billing       | ❌ Blocker  |
| Gemini API                                     | Free text → origin/destination    | Gemini API terms                     | n/a                            | Quota                 | ⚠️ Decide   |
| Web Speech API (browser)                       | Voice input                       | Browser feature, no contract         | n/a                            | n/a                   | ⚠️ Disclose |

## Details

### Elevator & escalator catalogue: ariellopez.cl

- Page: <https://ariellopez.cl/metro/accesibilidad/>. Built by **Ariel López and Willy Maikowski**.
- The page states no licence, no data source, and offers no download. Our copy
  (`metro_dispositivos.geojson`, ~949 devices) came from the prototype.
- Contact: only through the authors' X (Twitter) profiles linked on the page. No email.
- **To do:** ask permission to use and redistribute the catalogue, how they want to be credited,
  and where the data originally comes from (Metro de Santiago?). An official source would be better.

### Live device status: seguimos.cl

- Endpoint: `https://velocidades.seguimos.cl/?metro=1&all=1`. **Same two authors** as the
  catalogue, so one conversation covers both.
- No terms, no API documentation, no rate limit published. The page says its (bus) data updates
  every 30 s; elevator status cadence is unknown.
- **To do:** agree on a polling rate (we propose 1 request per 1–2 min from one server, per
  ADR 0004), our `User-Agent` string, and credit. Ask where elevator status comes from.

### OpenStreetMap

- Licence: [Open Database License (ODbL) 1.0](https://www.openstreetmap.org/copyright).
- Map must show "© OpenStreetMap contributors".
- `metro_lineas.geojson` is a **derived database**: it stays under ODbL (share-alike), not MIT.
  Mark it as such when it's added to the repo (Phase 4).

### OpenFreeMap

- <https://openfreemap.org>: free vector tiles, no API key, no registration.
- The default style already carries the required attribution (OpenFreeMap, OpenMapTiles, OSM).
  Keep MapLibre's attribution control visible.

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
- **Effect:** drawing a Google route or Google place on our MapLibre map
  ([ADR 0003](adr/0003-maplibre-for-map-rendering.md)) breaks these terms. See blocker 1.

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

## Open blockers (Phase 0 isn't done until these are resolved)

1. **Google results on a non-Google map.** Choose one, and record it in a new ADR:
   - **A.** Use the Google Maps JavaScript API for the map, superseding ADR 0003. Fastest path;
     map loads are billed beyond the free monthly quota.
   - **B.** Keep MapLibre; replace Google with OpenTripPlanner (routing, using DTPM GTFS + OSM) and
     a geocoder whose terms allow any map. More infrastructure; also makes accessibility a routing
     constraint (roadmap Phase 10 moves before launch).
   - **C.** Keep MapLibre for the Metro network and elevator status, but show the Google route
     only as a text itinerary with the Google logo, never on the map. Weakest user experience.
2. **Permission from the catalogue and live-status authors** (Ariel López and Willy Maikowski).
   Without it the core data has no legal basis for a public launch.

Not blocking yet: DTPM licence (needed by Phase 4), Gemini tier (needed by Phase 6).
