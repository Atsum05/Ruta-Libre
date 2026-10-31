// Unit tests for the plan service's own decisions, with a fake routing provider. The full
// request path (Google adapter, real registry, HTTP) is in routes/trip.test.ts.

import { DeviceId, StationId } from '@rutalibre/core'
import { describe, expect, it } from 'vitest'
import { silentLogger } from '../log.ts'
import type { DetailedRoute, DetailedTransitLeg, RoutingRequest } from '../providers.ts'
import { EMPTY_STATUS, InMemorySnapshotStore } from '../status/store.ts'
import { planTrip } from './service.ts'

const NOW = Date.parse('2026-10-28T15:00:00Z')

// One station with one elevator, enough to exercise the service.
const registry = {
  lines: [{ id: 'L1', terminals: [StationId('A'), StationId('B')] }],
  stations: ['A', 'B'].map((id, i) => ({
    id: StationId(id),
    name: `Estación ${id}`,
    location: { lat: -33.44, lng: -70.65 + i * 0.05 },
    lines: ['L1'],
    aliases: [],
    devices: [
      { id: DeviceId(`${id}-1`), kind: 'elevator' as const, scope: { kind: 'station' as const } },
    ],
  })),
}

const transit = (
  mode: DetailedTransitLeg['mode'],
  headsign: string | null = 'B',
): DetailedTransitLeg => ({
  mode,
  durationSeconds: 300,
  line: mode === 'metro' ? 'L1' : 'X',
  label: mode,
  color: '#e1261c',
  textColor: '#ffffff',
  headsign,
  from: { name: 'Estación A', location: { lat: -33.44, lng: -70.65 } },
  to: { name: 'Estación B', location: { lat: -33.44, lng: -70.6 } },
  stopCount: null,
  path: [[-70.65, -33.44]],
})
const route = (...legs: DetailedRoute['legs']): DetailedRoute => ({ durationSeconds: 900, legs })

async function storeWith(
  states: Record<string, 'working' | 'out-of-service'> | null,
  ageMs = 60_000,
) {
  const store = new InMemorySnapshotStore()
  if (states) {
    await store.set({
      ...EMPTY_STATUS,
      snapshot: {
        observedAt: NOW - ageMs,
        devices: new Map(Object.entries(states).map(([k, v]) => [DeviceId(k), v])),
      },
      fetchedAt: NOW,
    })
  }
  return store
}

async function plan(
  routes: { main: DetailedRoute[]; metro?: DetailedRoute[] | Error; bus?: DetailedRoute[] },
  states: Record<string, 'working' | 'out-of-service'> | null = {
    'A-1': 'working',
    'B-1': 'working',
  },
  options: { departAt?: string; demo?: boolean; ageMs?: number } = {},
) {
  const requests: RoutingRequest[] = []
  const result = await planTrip(
    {
      routing: {
        plan: async (r) => {
          requests.push(r)
          if (r.travel === 'bus') return routes.bus ?? []
          if (r.travel === 'metro') {
            if (routes.metro instanceof Error) throw routes.metro
            return routes.metro ?? routes.main
          }
          return routes.main
        },
      },
      statusStore: await storeWith(states, options.ageMs),
      registry,
      maxAgeMs: 13 * 3_600_000,
      demo: options.demo ?? false,
      now: () => NOW,
      log: silentLogger,
    },
    {
      origin: { kind: 'point', lat: -33.44, lng: -70.65 },
      destination: { kind: 'address', text: 'Estación B' },
      ...(options.departAt ? { departAt: options.departAt } : {}),
    },
  )
  return { result, requests }
}

describe('planTrip', () => {
  it('passes the departure time to the provider', async () => {
    const { requests } = await plan({ main: [route(transit('metro'))] }, undefined, {
      departAt: '2026-10-29T08:00:00Z',
    })
    expect(requests[0]).toMatchObject({ departAt: '2026-10-29T08:00:00Z', travel: 'any' })
  })

  it('names the station in each finding for the UI', async () => {
    const { result } = await plan(
      { main: [route(transit('metro'))] },
      { 'A-1': 'out-of-service', 'B-1': 'working' },
    )
    expect(result.routes[0]?.verdict.findings[0]).toMatchObject({
      stationName: 'Estación A',
      effect: 'blocked',
    })
  })

  it('leaves the station name empty for findings about the whole route', async () => {
    const { result } = await plan({ main: [route(transit('metro'))] }, null)
    expect(result.routes[0]?.verdict.findings[0]).toEqual({
      effect: 'unknown',
      legIndex: null,
      reason: { code: 'status-unavailable' },
      stationName: null,
    })
    expect(result.status).toEqual({ health: 'unavailable', observedAt: null, demo: false })
  })

  it('reports trains as not covered and does not need status for buses', async () => {
    const { result } = await plan(
      { main: [route(transit('rail')), route(transit('bus', null))] },
      null,
    )
    expect(result.routes.map((r) => r.verdict.kind)).toEqual(['ok', 'unknown'])
    expect(result.routes[0]?.legs[0]).toMatchObject({
      mode: 'bus',
      headsign: null,
      expressRoute: null,
    })
  })

  it('splits the express route out of the headsign', async () => {
    const { result } = await plan({ main: [route(transit('metro', 'B (Ruta Verde)'))] })
    expect(result.routes[0]?.legs[0]).toMatchObject({ headsign: 'B', expressRoute: 'verde' })
  })

  it('falls back to bus-only routes when the provider finds nothing at all', async () => {
    const { result, requests } = await plan({ main: [], bus: [route(transit('bus'))] })
    expect(requests.map((r) => r.travel)).toEqual(['any', 'metro', 'bus'])
    // Not "rerouted": nothing was avoided, the provider simply had no other answer.
    expect(result).toMatchObject({ outcome: 'accessible', rerouted: false })
    expect(result.routes[0]?.source).toBe('bus-only')
  })

  it('fails when the provider finds nothing and the bus-only request fails too', async () => {
    const failing = planTrip(
      {
        routing: {
          plan: async (r) => (r.travel === 'bus' ? Promise.reject(new Error('down')) : []),
        },
        statusStore: await storeWith({}),
        registry,
        maxAgeMs: 1,
        demo: false,
        now: () => NOW,
        log: silentLogger,
      },
      { origin: { kind: 'place', placeId: 'a' }, destination: { kind: 'place', placeId: 'b' } },
    )
    await expect(failing).rejects.toThrow('down')
  })
})

describe('Metro options (ADR 0014)', () => {
  it('asks for Metro-only routes too, and offers the ones the provider left out', async () => {
    const busTrip = route(transit('bus'))
    const metroTrip = route(transit('metro'))
    const { result, requests } = await plan({ main: [busTrip], metro: [metroTrip] })
    expect(requests.map((r) => r.travel)).toEqual(['any', 'metro'])
    expect(result.routes.map((r) => [r.source, r.legs[0]?.mode])).toEqual([
      ['alternative', 'metro'],
      ['primary', 'bus'],
    ])
    // Not an accessibility reroute: the bus route was fine as well.
    expect(result).toMatchObject({ outcome: 'accessible', rerouted: false })
  })

  it('drops Metro-only routes the provider already gave', async () => {
    const metroTrip = route(transit('metro'))
    const { result } = await plan({ main: [metroTrip], metro: [route(transit('metro'))] })
    expect(result.routes).toHaveLength(1)
  })

  it('carries on without Metro-only routes if that request fails', async () => {
    const { result } = await plan({ main: [route(transit('bus'))], metro: new Error('quota') })
    expect(result.routes).toHaveLength(1)
  })
})

describe('demo mode (ADR 0014)', () => {
  const TWO_WEEKS = 14 * 24 * 3_600_000

  it('is honest by default: two-week-old statuses make Metro routes unknown', async () => {
    const { result } = await plan({ main: [route(transit('metro'))] }, undefined, {
      ageMs: TWO_WEEKS,
    })
    expect(result.routes[0]?.verdict.kind).toBe('unknown')
    expect(result.status).toMatchObject({ health: 'stale', demo: false })
  })

  it('uses the last known statuses as current, and says it is a demo', async () => {
    const { result } = await plan(
      { main: [route(transit('metro'))] },
      { 'A-1': 'out-of-service', 'B-1': 'working' },
      { ageMs: TWO_WEEKS, demo: true },
    )
    expect(result.routes[0]?.verdict.kind).toBe('blocked')
    expect(result.status).toMatchObject({ health: 'ok', demo: true })
  })
})
