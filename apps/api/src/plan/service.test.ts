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

async function storeWith(states: Record<string, 'working' | 'out-of-service'> | null) {
  const store = new InMemorySnapshotStore()
  if (states) {
    await store.set({
      ...EMPTY_STATUS,
      snapshot: {
        observedAt: NOW - 60_000,
        devices: new Map(Object.entries(states).map(([k, v]) => [DeviceId(k), v])),
      },
      fetchedAt: NOW,
    })
  }
  return store
}

async function plan(
  routes: { main: DetailedRoute[]; bus?: DetailedRoute[] },
  states: Record<string, 'working' | 'out-of-service'> | null = {
    'A-1': 'working',
    'B-1': 'working',
  },
  departAt?: string,
) {
  const requests: RoutingRequest[] = []
  const result = await planTrip(
    {
      routing: {
        plan: async (r) => {
          requests.push(r)
          return r.busOnly ? (routes.bus ?? []) : routes.main
        },
      },
      statusStore: await storeWith(states),
      registry,
      maxAgeMs: 13 * 3_600_000,
      now: () => NOW,
      log: silentLogger,
    },
    {
      origin: { kind: 'point', lat: -33.44, lng: -70.65 },
      destination: { kind: 'address', text: 'Estación B' },
      ...(departAt ? { departAt } : {}),
    },
  )
  return { result, requests }
}

describe('planTrip', () => {
  it('passes the departure time to the provider', async () => {
    const { requests } = await plan(
      { main: [route(transit('metro'))] },
      undefined,
      '2026-10-29T08:00:00Z',
    )
    expect(requests[0]).toMatchObject({ departAt: '2026-10-29T08:00:00Z', busOnly: false })
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
    expect(result.status).toEqual({ health: 'unavailable', observedAt: null })
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
    expect(requests.map((r) => r.busOnly)).toEqual([false, true])
    expect(result).toMatchObject({ outcome: 'accessible', rerouted: true })
    expect(result.routes[0]?.source).toBe('bus-only')
  })

  it('fails when the provider finds nothing and the bus-only request fails too', async () => {
    const failing = planTrip(
      {
        routing: { plan: async (r) => (r.busOnly ? Promise.reject(new Error('down')) : []) },
        statusStore: await storeWith({}),
        registry,
        maxAgeMs: 1,
        now: () => NOW,
        log: silentLogger,
      },
      { origin: { kind: 'place', placeId: 'a' }, destination: { kind: 'place', placeId: 'b' } },
    )
    await expect(failing).rejects.toThrow('down')
  })
})
