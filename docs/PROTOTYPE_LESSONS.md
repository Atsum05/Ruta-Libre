# Lessons from the hackathon prototype

What we learned from the HaCAithon 2026 prototype (`equipo-3-haCAIthon-2026`, 2nd place,
14-08-2026), so the rebuild keeps the knowledge without keeping the code. Read this before
working on phases 3–6.

## Product decisions carried over

These were tested at the hackathon and stay unless an ADR changes them:

- **The app always assumes reduced mobility.** There's no profile picker or "normal" mode;
  someone without that need would use Google Maps.
- **Rerouting is automatic,** with no button. Order: main route → alternative routes → bus only →
  "no accessible alternative, ask for assistance at the station".
- **A broken elevator blocks a route; a broken escalator only warns**, because the elevator still works.
- **Warn too much rather than too little:** if we can't tell whether a failure is on the
  user's platform, we still warn.
- **Walking time × 1.5:** Google assumes ~1.4 m/s; a person with reduced mobility walks at
  ~0.9 m/s. Only walking legs are scaled, not time on board.

## Data sources: facts we verified

### Elevator and escalator catalogue

- File: `frontend/public/data/metro_dispositivos.geojson` in the prototype (253 KB, ~949 devices,
  132 stations). Source: <https://ariellopez.cl/metro/accesibilidad/> (licence still to confirm, see
  roadmap phase 0).
- Useful fields: `properties.equipo` (device ID), `properties.nombre_estacion`,
  `properties.linea`, point coordinates.
- **129 of 132 stations have all their devices at the same coordinate.** The map needs a sort
  key so the worst status is drawn on top, and this data alone can't tell us which platform a device serves.

### Live status

- `GET https://velocidades.seguimos.cl/?metro=1&all=1`: a JSON object keyed by device ID.
- Each value has `tipo` (`'ascensor'` for elevators; anything else is treated as an escalator),
  `estado` (`1` = working; anything else = out of service), `texto` (free-text description).
- **Join by device ID, exactly:** 946 of 949 IDs matched `properties.equipo`. Never join by name.
- If `texto` ends in `dirección <terminal>`, the device serves only that platform. With no
  direction it's an access/ticket-hall device and affects both directions.
- Volunteer-run, no SLA, called from the browser with CORS. That's why ADR 0004 moves it behind
  a server-side poller.

### Metro line geometry

- `frontend/public/data/metro_lineas.geojson` (46 KB): the 7 lines, extracted once from
  OpenStreetMap via Overpass. Properties: `ref`, `nombre`, `color`. Must be regenerated when a line
  opens (e.g. Line 7).

## Google Routes API: what we learned

- `POST https://routes.googleapis.com/directions/v2:computeRoutes` with `travelMode: 'TRANSIT'`,
  `computeAlternativeRoutes: true` (up to ~3 routes), `languageCode: 'es-CL'`, `regionCode: 'CL'`.
- Bus-only fallback: `transitPreferences: { allowedTravelModes: ['BUS'] }`.
- Requires an `X-Goog-FieldMask` header. The prototype requested duration, step travel mode,
  static duration, polyline, instructions, and `transitDetails` (line name / nameShort / color /
  vehicle type, headsign, departure/arrival stop names, stop count).
  **It forgot two fields we need:** `transitLine.textColor` (badge contrast) and the stop
  **locations** (for matching by location, ADR 0006).
- **Text addresses must be anchored to Santiago.** "Irarrázaval" on its own geocoded to a
  passage in Maipú and returned no routes. Appending `", Santiago, Chile"` fixed it. Autocomplete with
  a location bias is the proper fix (roadmap phase 6).
- Bus stop names come prefixed with stop codes: `PB1960-Parada 6 / (M) Pza. Chacabuco`. Strip
  `/^P[A-Z]{1,2}\d+\s*-\s*/` for display.
- For buses, show `nameShort` (the route number, e.g. "210"); the long name is useless to users.
- **Express services:** at rush hour L2/L4/L5 run "Ruta Roja/Verde". The headsign arrives as
  `"<terminal> (Ruta Roja)"`. Extract the colour, and **remove it before comparing directions**,
  or the comparison always fails.
- Google's station names differ from the Metro's in accents, case, and hyphens ("Chile-España").
  The prototype normalised strings; the rebuild matches by location instead (ADR 0006).
- Polylines use Google's standard encoded format, with coordinates as `[lng, lat]` after decoding.

## Gemini (natural language → trip)

- Model: `gemini-3.1-flash-lite`. In Aug 2026, `gemini-2.5-*` was closed to new accounts and the
  `gemini-flash-latest` alias returned 503s under load.
- Use `responseSchema` with `responseMimeType: 'application/json'` to force
  `{ origen, destino, necesidad }`.
- Telling the model the user always has reduced mobility, and to name places that sound like
  stations as **"Metro <nombre>"**, greatly improved geocoding.
- `necesidad` (wheelchair, cane, stroller…) was extracted but never used. Decide whether it
  should change anything before extracting it again.
- Voice input used the browser's Web Speech API (`lang = 'es-CL'`): no key, Chrome only.

## Map and UI traps

- **Changing the map style wipes custom sources and layers.** Re-add them after `style.load`.
  In the rebuild this lives in one place, `<MapCanvas>`.
- HTML markers are positioned with a CSS `transform` on the root element. To scale them with
  zoom, put the `scale` on an inner child.
- Walking legs drawn as round dots: `line-dasharray: [0, 2]` with `line-cap: 'round'`.
- A contrasting "casing" line under the route keeps it readable over the Metro network.
- Popups built from data must escape HTML.

## Operations traps

- **BOM in environment variables:** piping a value with PowerShell `echo` into a hosting
  CLI added an invisible U+FEFF. The key was invalid, and the browser reported it as a
  **CORS error**. Validated config at startup (roadmap phase 2) catches this.
- Build-time variables (`VITE_*`) are compiled into the JavaScript: visible to every visitor, and
  changing them does nothing until a new build. Hence no keys in the browser (ADR 0004).
- The Vercel CLI hung on "Building…" on the dev machine; the dashboard's Redeploy worked.
- An HTTP 200 from the terminal doesn't prove the app works. Check the real page in a browser.

## Bugs found in the prototype → where the rebuild fixes them

| #   | Bug                                                                                                           | Effect                                                                   | Fixed by                                                                     |
| --- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| 1   | At a transfer station, stations were de-duplicated by name, so only the **first** leg's direction was checked | Could say "❓ might not affect you" about a failure that does affect you | Each leg evaluated with its own direction: ADR 0006, phase 3 regression test |
| 2   | Live status failed → no broken stations known → every route looked clean                                      | A false "all clear": the worst failure for this app                      | `unknown` verdict: ADR 0005, phase 3/5                                       |
| 3   | Status loaded once per page, never refreshed                                                                  | Stale data in long sessions                                              | Server poller + 60 s client refresh: phases 5, 7                             |
| 4   | `textColor` not requested → all badges white text                                                             | White on yellow (Line 2): fails contrast                                 | Field mask, phase 6; contrast checks, phase 7                                |
| 5   | Fixed 320 px side panel, no media queries                                                                     | Poor on phones, where users actually are                                 | Mobile-first layout, phase 7                                                 |
| 6   | GPS denied → origin silently set to Campus San Joaquín                                                        | Wrong route without the user noticing                                    | Ask for an origin instead, phase 7                                           |
| 7   | "Simulate failure" permanently changed the shared data                                                        | Demo leaked into real results for the session                            | Demos re-evaluate a copy using `core`                                        |
| 8   | All API keys in the browser bundle; Gemini key in the URL                                                     | Anyone can use up the quotas                                             | Server-side API: ADR 0004                                                    |
| 9   | Accessibility check only filters Google's ~3 routes                                                           | If all hit a broken station, no accessible option                        | Routing provider interface → OpenTripPlanner later: ADR 0007                 |
| 10  | No tests, logic inside a 700-line React component                                                             | Bugs 1–2 went unnoticed                                                  | Pure tested `core`: ADR 0002                                                 |
