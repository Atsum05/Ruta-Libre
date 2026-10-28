# 7. External services behind provider interfaces

- **Status:** Accepted
- **Date:** 2026-10-27

## Context

Google Routes can't be told to avoid a specific station, so the best it allows is "fetch a few
routes and filter". OpenTripPlanner (OTP) with Santiago's GTFS feed can treat accessibility as a
routing constraint, but it's infrastructure to run. Separately, Google Maps Platform terms have
historically restricted showing Google route/place results on a non-Google map, which may affect
the MapLibre choice ([ADR 0003](0003-maplibre-for-map-rendering.md)). This must be verified.

## Decision

The API talks to external services only through interfaces:

```ts
interface RoutingProvider {
  plan(req: PlanRequest): Promise<Route[]>
}
interface PlacesProvider {
  search(q: string, session: string): Promise<Place[]>
}
interface StatusProvider {
  snapshot(): Promise<StatusSnapshot>
}
interface LanguageProvider {
  interpret(text: string): Promise<TripIntent>
}
```

Launch with Google (Routes, Places), seguimos.cl, and Gemini adapters. Each adapter maps to
`core` types and validates the upstream payload.

## Consequences

- Swapping Google for OTP (or a geocoder with compatible terms) means writing one adapter.
- Integration tests use fake providers, so CI needs no network or keys.
- If Google's terms rule out MapLibre display, the OTP adapter becomes a launch requirement.
