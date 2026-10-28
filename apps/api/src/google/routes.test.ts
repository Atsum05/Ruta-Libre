// Adapter tests against a response built to Google's documented shape. Real recorded responses
// (golden tests) are roadmap phase 3's last item and need a key; see docs/ROADMAP.md.

import { describe, expect, it } from 'vitest'
import transfer from './__fixtures__/routes-transfer.json' with { type: 'json' }
import {
  FIELD_MASK,
  GoogleRoutesProvider,
  metroLineId,
  readableTextColor,
  toGoogleWaypoint,
} from './routes.ts'

function provider(body: unknown, seen: Request[] = [], status = 200) {
  return new GoogleRoutesProvider({
    apiKey: 'test-key',
    timeoutMs: 1000,
    fetchFn: async (input, init) => {
      seen.push(new Request(input, init))
      return new Response(JSON.stringify(body), { status })
    },
  })
}
const request = {
  origin: { kind: 'point', lat: -33.4432, lng: -70.6512 },
  destination: { kind: 'place', placeId: 'ChIJ-toesca' },
  busOnly: false,
} as const

describe('GoogleRoutesProvider', () => {
  it('sends the key in a header, never the URL, and asks for stop locations and text colour', async () => {
    const seen: Request[] = []
    await provider(transfer, seen).plan(request)
    const req = seen[0]
    expect(req?.url).not.toContain('test-key')
    expect(req?.headers.get('x-goog-api-key')).toBe('test-key')
    expect(FIELD_MASK).toContain('departureStop.location')
    expect(FIELD_MASK).toContain('transitLine.textColor')
    expect(await req?.json()).toMatchObject({
      travelMode: 'TRANSIT',
      computeAlternativeRoutes: true,
      origin: { location: { latLng: { latitude: -33.4432, longitude: -70.6512 } } },
      destination: { placeId: 'ChIJ-toesca' },
    })
  })

  it('asks for buses only on the last fallback', async () => {
    const seen: Request[] = []
    await provider(transfer, seen).plan({ ...request, busOnly: true })
    expect(await seen[0]?.json()).toMatchObject({
      transitPreferences: { allowedTravelModes: ['BUS'] },
    })
  })

  it('maps a Metro transfer into core legs with display details', async () => {
    const [route] = await provider(transfer).plan(request)
    expect(route?.durationSeconds).toBe(1680)
    expect(route?.legs.map((l) => l.mode)).toEqual(['walk', 'metro', 'walk', 'metro', 'walk'])
    expect(route?.legs[0]).toMatchObject({ mode: 'walk', durationSeconds: 180 }) // two steps merged
    expect(route?.legs[1]).toMatchObject({
      mode: 'metro',
      line: 'L1',
      label: 'Línea 1',
      headsign: 'San Pablo',
      from: { name: 'Universidad de Chile', location: { lat: -33.4440996, lng: -70.6494972 } },
      color: '#e1261c',
      textColor: '#ffffff',
      stopCount: 2,
    })
    expect(route?.legs[1]?.path.length).toBeGreaterThan(1)
  })

  it('keeps the express route in the headsign and computes a readable text colour', async () => {
    const [route] = await provider(transfer).plan(request)
    // No textColor for yellow L2 in the response: black reads on yellow, white doesn't.
    expect(route?.legs[3]).toMatchObject({
      line: 'L2',
      headsign: 'Hospital El Pino (Ruta Roja)',
      textColor: '#000000',
    })
  })

  it('shows the route number for buses and strips stop codes', async () => {
    const [, busRoute] = await provider(transfer).plan(request)
    expect(busRoute?.legs[1]).toMatchObject({
      mode: 'bus',
      line: '210',
      label: '210',
      from: { name: 'Parada 6 / (M) Universidad de Chile' },
    })
  })

  it('returns no routes when Google finds none', async () => {
    await expect(provider({}).plan(request)).resolves.toEqual([])
  })

  it('falls back to the path end when a stop has no location', async () => {
    const body = structuredClone(transfer) as typeof transfer
    const step = body.routes[0]?.legs[0]?.steps[2] as {
      transitDetails: { stopDetails: Record<string, unknown> }
    }
    step.transitDetails.stopDetails = {}
    const [route] = await provider(body).plan(request)
    const leg = route?.legs[1]
    expect(leg?.mode === 'metro' && leg.from.location.lat).toBeCloseTo(-33.4441, 3)
  })

  it('fails on a response it cannot read', async () => {
    await expect(provider({ routes: 'nope' }).plan(request)).rejects.toThrow(
      'unexpected response format',
    )
  })

  it('fails on an HTTP error', async () => {
    await expect(provider({ error: {} }, [], 403).plan(request)).rejects.toThrow('HTTP 403')
  })
})

describe('toGoogleWaypoint', () => {
  it('anchors free text to Santiago', () => {
    expect(toGoogleWaypoint({ kind: 'address', text: 'Irarrázaval' })).toEqual({
      address: 'Irarrázaval, Santiago, Chile',
    })
    expect(toGoogleWaypoint({ kind: 'address', text: 'Metro Baquedano, Santiago' })).toEqual({
      address: 'Metro Baquedano, Santiago',
    })
  })
})

describe('metroLineId', () => {
  it.each([
    ['Línea 1', 'L1', 'L1'],
    ['Línea 4A', undefined, 'L4A'],
    [undefined, 'L4a', 'L4A'],
    ['Linea 6', undefined, 'L6'],
    ['Tren Nos', undefined, 'Tren Nos'],
  ])('%s / %s → %s', (name, short, id) => {
    expect(metroLineId(name, short)).toBe(id)
  })
})

describe('readableTextColor', () => {
  it.each([
    ['#fbb800', '#000000'], // L2 yellow
    ['#e1261c', '#ffffff'], // L1 red
    ['#00a0e9', '#000000'],
    ['not a colour', '#ffffff'],
  ])('%s → %s', (bg, fg) => {
    expect(readableTextColor(bg)).toBe(fg)
  })
})
