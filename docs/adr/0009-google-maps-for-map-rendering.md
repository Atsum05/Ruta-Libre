# 9. Google Maps JavaScript API for map rendering

- **Status:** Accepted. Supersedes [ADR 0003](0003-maplibre-for-map-rendering.md).
- **Date:** 2026-10-28

## Context

ADR 0003 chose MapLibre, and ADR 0007 flagged that Google's terms might not allow showing Google
results on a non-Google map. The Phase 0 audit ([`DATA_SOURCES.md`](../DATA_SOURCES.md)) confirmed it.
Google's policy pages (last updated 2026-10-27) say "Routes API results displayed on a map must be
shown on a Google Map", and the same for Places API results.

Drawing the route and the chosen places is the core of the UI, so MapLibre plus Google Routes and
Places is not allowed. The alternatives were to replace Google with OpenTripPlanner and a non-Google
geocoder (more infrastructure for one developer, and blocked on the DTPM GTFS licence), or to show
the route only as text (much worse for users).

## Decision

- Render the map with the **Google Maps JavaScript API**, behind the `<MapCanvas>` component.
- Keep Google Routes and Places for routing and search, called only from our API (ADR 0004).
- Our own data (Metro lines, elevator and escalator status) is drawn as overlays on the Google map.
- **Exception to ADR 0004:** the Maps JavaScript API needs a key in the browser. It gets its own
  key, restricted to our domains (HTTP referrer) and to the Maps JavaScript API only, with a
  billing quota cap. Every other key stays server-side.
- OpenTripPlanner remains the planned Phase 10 adapter (ADR 0007). Switching to it would make a
  non-Google map possible again; that would be a new ADR.

## Consequences

- Phase 2 can start immediately and stays within Google's terms.
- Map loads are billed by Google beyond its free monthly usage. Cap the quota and track spend
  (Phase 8). Check current pricing before launch.
- A public key exists in the browser. It's low risk only while the referrer and API restrictions
  are in place; Phase 8 verifies them.
- No map-tile attribution to manage: Google draws its own. Our Metro line overlay is derived from
  OpenStreetMap, so the map must still credit "© OpenStreetMap contributors".
- Deeper lock-in to Google until Phase 10. The provider interfaces and `<MapCanvas>` keep the
  switch contained.
- Self-hosted map tiles (Protomaps) are no longer planned.
