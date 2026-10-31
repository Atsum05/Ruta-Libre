import type { RouteView, StatusResponse } from '@rutalibre/contract'
import { distanceMeters, type Registry } from '@rutalibre/core'

export type MarkerStatus = 'ok' | 'warning' | 'blocked' | 'unknown'

export interface StationMarker {
  readonly id: string
  readonly name: string
  readonly lat: number
  readonly lng: number
  readonly status: MarkerStatus
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
  const usable = status !== undefined && status.health !== 'unavailable'
  return registry.stations.map((s) => {
    let result: MarkerStatus = 'ok'
    if (!usable) result = 'unknown'
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
 * rest. Matched by position; transfers count once per line.
 */
export function stationsOnRoute(
  route: RouteView | undefined,
  markers: readonly StationMarker[],
): Set<string> | null {
  if (!route) return null
  const stops = route.legs.flatMap((leg) => (leg.mode === 'metro' ? [leg.from, leg.to] : []))
  const ids = new Set<string>()
  for (const m of markers) {
    if (stops.some((s) => distanceMeters(s, m) <= ON_ROUTE_M)) ids.add(m.id)
  }
  return ids
}
