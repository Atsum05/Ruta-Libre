import type { LegView, RouteView } from '@rutalibre/contract'
import { loadRegistry } from '@rutalibre/registry'
import { describe, expect, it } from 'vitest'
import { ROUTE_OK, STATUS_OK } from '../../test/render.tsx'
import { stationMarkers, stationsOnRoute } from './stationStatus.ts'

const registry = loadRegistry()
const losHeroesL1 = registry.stations.find((s) => s.id === 'LH')
if (!losHeroesL1) throw new Error('LH missing from the registry')

/** Every device working, then the given overrides. */
function status(overrides: Record<string, 'working' | 'out-of-service' | undefined>) {
  const devices: Record<string, 'working' | 'out-of-service'> = {}
  for (const s of registry.stations) for (const d of s.devices) devices[d.id] = 'working'
  for (const [id, state] of Object.entries(overrides)) {
    if (state) devices[id] = state
    else delete devices[id]
  }
  return { ...STATUS_OK, devices }
}
const markerFor = (s: ReturnType<typeof status> | undefined) =>
  stationMarkers(registry, s).find((m) => m.id === 'LH')?.status

describe('stationMarkers', () => {
  it('draws one marker per station', () => {
    expect(stationMarkers(registry, status({}))).toHaveLength(registry.stations.length)
  })

  it('is ok when every device works', () => {
    expect(markerFor(status({}))).toBe('ok')
  })

  it('is blocked when any elevator is out', () => {
    expect(markerFor(status({ 'LH-60d634': 'out-of-service' }))).toBe('blocked')
  })

  it('only warns when just an escalator is out', () => {
    const escalator = losHeroesL1?.devices.find((d) => d.kind === 'escalator')
    expect(escalator).toBeDefined()
    expect(markerFor(status({ [escalator?.id ?? '']: 'out-of-service' }))).toBe('warning')
  })

  it('is unknown when an elevator has no status', () => {
    expect(markerFor(status({ 'LH-60d634': undefined }))).toBe('unknown')
  })

  it('is unknown everywhere without data, never green', () => {
    const markers = stationMarkers(registry, undefined)
    expect(new Set(markers.map((m) => m.status))).toEqual(new Set(['unknown']))
    expect(markerFor({ ...status({}), health: 'unavailable' })).toBe('unknown')
  })
})

describe('stationsOnRoute', () => {
  const markers = stationMarkers(registry, status({}))
  const at = (code: string) => {
    const s = registry.stations.find((x) => x.id === code)
    if (!s) throw new Error(`no station ${code}`)
    return { name: s.name, lat: s.location.lat, lng: s.location.lng }
  }
  const leg = (mode: 'metro' | 'bus', from: string, to: string): LegView => ({
    mode,
    durationSeconds: 300,
    line: 'L1',
    label: 'Línea 1',
    color: '#e1261c',
    textColor: '#ffffff',
    headsign: 'San Pablo',
    expressRoute: null,
    from: at(from),
    to: at(to),
    stopCount: 2,
    path: [],
  })
  const routeOf = (...legs: LegView[]): RouteView => ({ ...ROUTE_OK, legs })

  it('is null without a route, so nothing is faded', () => {
    expect(stationsOnRoute(undefined, markers)).toBeNull()
  })

  it('finds where the route boards and alights, including other lines at the same place', () => {
    const ids = stationsOnRoute(routeOf(leg('metro', 'CH', 'LH')), markers)
    expect(ids?.has('CH')).toBe(true)
    expect(ids?.has('LH')).toBe(true)
    // Los Héroes on L2 is 39 m away: the same place for the rider.
    expect(ids?.has('HE')).toBe(true)
    expect(ids?.has('PQU')).toBe(false)
  })

  it('ignores bus stops', () => {
    expect(stationsOnRoute(routeOf(leg('bus', 'CH', 'LH')), markers)?.size).toBe(0)
  })
})
