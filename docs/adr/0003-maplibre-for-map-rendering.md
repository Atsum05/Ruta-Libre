# 3. MapLibre GL JS for map rendering

- **Status:** Superseded by [ADR 0009](0009-google-maps-for-map-rendering.md) (Google's terms require
  Google results to be shown on a Google map)
- **Date:** 2026-10-27

## Context

The prototype used Mapbox GL JS. Since v2 (Dec 2020), Mapbox GL JS is proprietary, requires a
Mapbox account and token, and bills per map load. RutaLibre uses only basic features (GeoJSON
line/circle layers, markers, popups, light/dark styles), which MapLibre also supports.

## Decision

Use **MapLibre GL JS** (open-source fork of Mapbox GL JS v1). Start with **OpenFreeMap** styles
(free, no key); move to self-hosted **Protomaps** tiles for Santiago if traffic grows, or to
MapTiler if more polished styles are needed. All map code lives behind the `<MapCanvas>` component.

## Consequences

- No per-load billing, no map token in the browser, one fewer account to own.
- Map data source is a single URL; switching providers is a config change.
- Default styles are a little less polished than Mapbox's; custom styling may take extra work.
- OSM attribution must be shown on the map.
- Interacts with Google's terms on non-Google maps. See [ADR 0007](0007-routing-behind-provider-interface.md).
