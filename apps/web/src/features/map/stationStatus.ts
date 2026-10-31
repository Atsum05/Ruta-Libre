import type { RouteView, StatusResponse } from '@rutalibre/contract'
import { distanceMeters, NAMED_MATCH_RADIUS_M, normalizeName, type Registry } from '@rutalibre/core'

export type MarkerStatus = 'ok' | 'warning' | 'blocked' | 'unknown'

export interface StationMarker {
  readonly id: string
  readonly name: string
  readonly lat: number
  readonly lng: number
  readonly status: MarkerStatus
}

/**
 * Whether statuses can be shown as current: data exists and is within the freshness limit, or
 * it's demo mode (which says so on screen). Matches the verdicts: when routes say "we can't be
 * sure", the map mustn't paint stations green (ADR 0005, 0012).
 */
export function isCurrent(status: StatusResponse | undefined): boolean {
  if (status === undefined || status.health === 'unavailable') return false
  if (status.demo) return true
  return status.ageSeconds !== null && status.ageSeconds <= status.maxAgeSeconds
}

/** Worst first: drawn on top when stations overlap (prototype lesson: a sort key). */
export const MARKER_ORDER: Record<MarkerStatus, number> = {
  blocked: 3,
  unknown: 2,
  warning: 1,
  ok: 0,
}

/**
 * One marker per station, coloured by its worst device: any elevator out → blocked; only an
 * escalator out → warning; an elevator with no status, or no usable data → unknown.
 */
export function stationMarkers(
  registry: Registry,
  status: StatusResponse | undefined,
): StationMarker[] {
  const usable = isCurrent(status)
  return registry.stations.map((s) => {
    let result: MarkerStatus = 'ok'
    if (!usable || status === undefined) result = 'unknown'
    else {
      for (const d of s.devices) {
        const state = status.devices[d.id]
        if (d.kind === 'elevator' && state === 'out-of-service') {
          result = 'blocked'
          break
        }
        if (d.kind === 'elevator' && state === undefined) result = 'unknown'
        if (d.kind === 'escalator' && state === 'out-of-service' && result === 'ok')
          result = 'warning'
      }
    }
    return { id: s.id, name: s.name, lat: s.location.lat, lng: s.location.lng, status: result }
  })
}

/** How far a route's stop may be from a station marker and still count as that station. */
const ON_ROUTE_M = 200

/**
 * The stations a route boards or leaves at, so the map can keep them prominent and fade the
 * rest. Matched by position, or by name further out, as a line's platforms can be far from the
 * station's point (as in core's matchStop); transfers count once per line.
 */
export function stationsOnRoute(
  route: RouteView | undefined,
  markers: readonly StationMarker[],
): Set<string> | null {
  if (!route) return null
  const stops = route.legs.flatMap((leg) => (leg.mode === 'metro' ? [leg.from, leg.to] : []))
  const ids = new Set<string>()
  for (const m of markers) {
    const name = normalizeName(m.name)
    const onRoute = stops.some((s) => {
      const distance = distanceMeters(s, m)
      return (
        distance <= ON_ROUTE_M ||
        (distance <= NAMED_MATCH_RADIUS_M && normalizeName(s.name) === name)
      )
    })
    if (onRoute) ids.add(m.id)
  }
  return ids
}
