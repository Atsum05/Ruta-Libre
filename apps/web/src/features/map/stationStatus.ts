import type { StatusResponse } from '@rutalibre/contract'
import type { Registry } from '@rutalibre/core'

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
