// Integration tests for the planning API (roadmap phase 6): real app, real station registry,
// the real Google adapter fed a saved response, fake network. Every response is checked against
// the contract the web app relies on.

import {
  ErrorResponseSchema,
  InterpretResponseSchema,
  PlacesResponseSchema,
  PlanResponseSchema,
} from '@rutalibre/contract'
import { DeviceId, type DeviceState } from '@rutalibre/core'
import { loadRegistry } from '@rutalibre/registry'
import { describe, expect, it } from 'vitest'
import { type AppDeps, createApp } from '../app.ts'
import { parseConfig } from '../config.ts'
import transfer from '../google/__fixtures__/routes-transfer.json' with { type: 'json' }
import { GoogleRoutesProvider } from '../google/routes.ts'
import { UpstreamError } from '../http/request.ts'
import type { Logger } from '../log.ts'
import { silentLogger } from '../log.ts'
import type { RoutingProvider, RoutingRequest } from '../providers.ts'
import { InMemorySnapshotStore } from '../status/store.ts'

const registry = loadRegistry()
const NOW = Date.parse('2026-10-28T15:00:00Z')
const HOUR = 60 * 60_000
const SESSION = '7d0c2a5e-0000-4000-8000-000000000000'

const allWorking = () =>
  new Map<DeviceId, DeviceState>(
    registry.stations.flatMap((s) => s.devices.map((d) => [d.id, 'working'] as const)),
  )

async function store(devices = allWorking(), ageMs = HOUR) {
  const s = new InMemorySnapshotStore()
  await s.set({
    snapshot: { observedAt: NOW - ageMs, devices },
    fetchedAt: NOW,
    lastError: null,
    failingSince: null,
  })
  return s
}

/** The Google adapter answering with the saved response: one L1→L2 transfer, one bus route. */
const google = (body: unknown = transfer) =>
  new GoogleRoutesProvider({
    apiKey: 'k',
    timeoutMs: 1000,
    fetchFn: async () => new Response(JSON.stringify(body)),
  })

/** Wraps a provider to record each request (to see when the bus-only fallback is used). */
function recording(provider: RoutingProvider) {
  const requests: RoutingRequest[] = []
  return {
    requests,
    provider: {
      plan: (r: RoutingRequest) => {
        requests.push(r)
        return provider.plan(r)
      },
    },
  }
}

async function app(overrides: Partial<AppDeps> = {}) {
  return createApp({
    config: parseConfig({ CORS_ORIGINS: 'https://rutalibre.test' }),
    statusStore: await store(),
    registry,
    routing: google(),
    places: { search: async () => [{ placeId: 'p1', primary: 'Toesca', secondary: 'Santiago' }] },
    language: { interpret: async () => ({ origin: null, destination: 'Metro Toesca' }) },
    now: () => NOW,
    log: silentLogger,
    ...overrides,
  })
}

const TRIP = {
  origin: { kind: 'point', lat: -33.4432, lng: -70.6512 },
  destination: { kind: 'place', placeId: 'ChIJ-toesca' },
}
const post = (body: unknown, headers: Record<string, string> = {}) => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...headers },
  body: JSON.stringify(body),
})

async function plan(a: Awaited<ReturnType<typeof app>>, body: unknown = TRIP) {
  const res = await a.request('/v1/plan', post(body))
  return { res, body: (await res.json()) as unknown }
}

describe('POST /v1/plan', () => {
  it('returns the primary route when every elevator works', async () => {
    const { res, body } = await plan(await app())
    expect(res.status).toBe(200)
    const out = PlanResponseSchema.parse(body)
    expect(out).toMatchObject({ outcome: 'accessible', rerouted: false, status: { health: 'ok' } })
    expect(out.routes[0]).toMatchObject({
      source: 'primary',
      verdict: { kind: 'ok', findings: [] },
    })
  })

  it('stretches walking to a reduced-mobility pace in the response', async () => {
    const out = PlanResponseSchema.parse((await plan(await app())).body)
    const first = out.routes[0]
    expect(first?.legs[0]).toMatchObject({ mode: 'walk', durationSeconds: 270 }) // 180 s × 1.5
    // Google said 1680 s; 660 s of walking (180 + 180 + 300) becomes 990 s.
    expect(first?.durationSeconds).toBe(2010)
  })

  it('separates the express route from the direction', async () => {
    const out = PlanResponseSchema.parse((await plan(await app())).body)
    expect(out.routes[0]?.legs[3]).toMatchObject({
      line: 'L2',
      headsign: 'Hospital El Pino',
      expressRoute: 'roja',
      textColor: '#000000',
    })
  })

  it('reroutes when an elevator on the transfer platform is out (real registry)', async () => {
    const devices = allWorking()
    devices.set(DeviceId('HE-0f6a35'), 'out-of-service') // Los Héroes L2, towards Hospital El Pino
    const out = PlanResponseSchema.parse(
      (await plan(await app({ statusStore: await store(devices) }))).body,
    )
    expect(out).toMatchObject({ outcome: 'accessible', rerouted: true })
    expect(out.routes.map((r) => [r.source, r.verdict.kind])).toEqual([
      ['alternative', 'ok'],
      ['primary', 'blocked'],
    ])
    expect(out.routes[1]?.verdict.findings[0]).toMatchObject({
      effect: 'blocked',
      legIndex: 3,
      stationName: 'Los Héroes',
      reason: { code: 'elevator-out', deviceId: 'HE-0f6a35', platform: 'yours' },
    })
  })

  it('asks for bus-only routes when nothing is accessible, and says so when none help', async () => {
    const devices = allWorking()
    devices.set(DeviceId('HE-0f6a35'), 'out-of-service')
    const metroOnly = { routes: [transfer.routes[0]] }
    const { requests, provider } = recording({
      plan: (r) => google(r.busOnly ? {} : metroOnly).plan(r),
    })
    const out = PlanResponseSchema.parse(
      (await plan(await app({ routing: provider, statusStore: await store(devices) }))).body,
    )
    expect(requests.map((r) => r.busOnly)).toEqual([false, true])
    expect(out).toMatchObject({ outcome: 'no-accessible-route', rerouted: false })
  })

  it('does not ask for bus-only routes when a Metro route works', async () => {
    const { requests, provider } = recording(google())
    await plan(await app({ routing: provider }))
    expect(requests.map((r) => r.busOnly)).toEqual([false])
  })

  // The status feed stopped on 2026-10-16 (ADR 0012): the answer must say it can't be sure.
  it('is uncertain, not ok, when the status data is stale', async () => {
    const metroOnly = { routes: [transfer.routes[0]] }
    const routing = { plan: (r: RoutingRequest) => google(r.busOnly ? {} : metroOnly).plan(r) }
    const stale = await store(allWorking(), 12 * 24 * HOUR)
    const out = PlanResponseSchema.parse(
      (await plan(await app({ routing, statusStore: stale }))).body,
    )
    expect(out).toMatchObject({ outcome: 'uncertain', status: { health: 'stale' } })
    expect(out.routes[0]?.verdict.kind).toBe('unknown')
  })

  it('keeps the Metro answer if the bus-only fallback fails', async () => {
    const devices = allWorking()
    devices.set(DeviceId('HE-0f6a35'), 'out-of-service')
    const routing = {
      plan: (r: RoutingRequest) =>
        r.busOnly
          ? Promise.reject(new UpstreamError('HTTP 500'))
          : google({ routes: [transfer.routes[0]] }).plan(r),
    }
    const { res, body } = await plan(await app({ routing, statusStore: await store(devices) }))
    expect(res.status).toBe(200)
    expect(PlanResponseSchema.parse(body).outcome).toBe('no-accessible-route')
  })

  it('reports no route when the provider finds none', async () => {
    const out = PlanResponseSchema.parse((await plan(await app({ routing: google({}) }))).body)
    expect(out).toMatchObject({ outcome: 'no-route', routes: [] })
  })

  it('rejects a request that breaks the contract, with a request ID', async () => {
    const { res, body } = await plan(await app(), { origin: { kind: 'point', lat: 999, lng: 0 } })
    expect(res.status).toBe(400)
    const err = ErrorResponseSchema.parse(body)
    expect(err.error.code).toBe('bad-request')
    expect(err.requestId).toBe(res.headers.get('x-request-id'))
  })

  it('rejects a body that is not JSON', async () => {
    const res = await (await app()).request('/v1/plan', { method: 'POST', body: 'not json' })
    expect(res.status).toBe(400)
  })

  it('answers 502 when Google fails', async () => {
    const routing = { plan: () => Promise.reject(new UpstreamError('HTTP 500', 500)) }
    const { res, body } = await plan(await app({ routing }))
    expect(res.status).toBe(502)
    expect(ErrorResponseSchema.parse(body).error.code).toBe('upstream-failed')
  })

  it('answers 503 without a Google key', async () => {
    const { res, body } = await plan(await app({ routing: null }))
    expect(res.status).toBe(503)
    expect(ErrorResponseSchema.parse(body).error.code).toBe('not-configured')
  })

  it('is never cached', async () => {
    const { res } = await plan(await app())
    expect(res.headers.get('cache-control')).toBe('no-store')
  })

  it('rate-limits each client', async () => {
    const a = await app()
    for (let i = 0; i < 20; i++) await a.request('/v1/plan', post(TRIP))
    const res = await a.request('/v1/plan', post(TRIP))
    expect(res.status).toBe(429)
    expect(res.headers.get('retry-after')).toBeTruthy()
    expect(ErrorResponseSchema.parse(await res.json()).error.code).toBe('rate-limited')
  })
})

describe('GET /v1/places', () => {
  it('returns suggestions', async () => {
    const res = await (await app()).request(`/v1/places?q=Toesca&session=${SESSION}`)
    expect(PlacesResponseSchema.parse(await res.json()).suggestions).toHaveLength(1)
  })

  it('requires a session token', async () => {
    const res = await (await app()).request('/v1/places?q=Toesca')
    expect(res.status).toBe(400)
  })
})

describe('POST /v1/interpret', () => {
  it('returns origin and destination', async () => {
    const res = await (await app()).request('/v1/interpret', post({ text: 'llévame a Toesca' }))
    expect(InterpretResponseSchema.parse(await res.json())).toEqual({
      origin: null,
      destination: 'Metro Toesca',
    })
  })

  it('answers 503 without a Gemini key, so the app uses the search fields', async () => {
    const res = await (await app({ language: null })).request(
      '/v1/interpret',
      post({ text: 'a Toesca' }),
    )
    expect(res.status).toBe(503)
  })

  it('answers 502 when Gemini fails', async () => {
    const language = { interpret: () => Promise.reject(new UpstreamError('Gemini: no JSON')) }
    const res = await (await app({ language })).request('/v1/interpret', post({ text: 'a Toesca' }))
    expect(res.status).toBe(502)
  })
})

describe('cross-cutting', () => {
  it('reuses a well-formed incoming request ID and ignores a malformed one', async () => {
    const a = await app()
    const kept = await a.request('/v1/health', { headers: { 'X-Request-Id': 'abc-12345678' } })
    expect(kept.headers.get('x-request-id')).toBe('abc-12345678')
    const replaced = await a.request('/v1/health', { headers: { 'X-Request-Id': 'bad id!' } })
    expect(replaced.headers.get('x-request-id')).not.toBe('bad id!')
  })

  it('logs paths but never query strings or bodies (personal data)', async () => {
    const lines: string[] = []
    const log: Logger = {
      info: (msg, f) => lines.push(JSON.stringify({ msg, ...f })),
      warn: (msg, f) => lines.push(JSON.stringify({ msg, ...f })),
      error: (msg, f) => lines.push(JSON.stringify({ msg, ...f })),
    }
    const a = await app({ log })
    await a.request(`/v1/places?q=Calle+Secreta+123&session=${SESSION}`)
    await a.request(
      '/v1/plan',
      post({ ...TRIP, destination: { kind: 'address', text: 'Mi casa 42' } }),
    )
    expect(lines.join('\n')).toContain('/v1/places')
    expect(lines.join('\n')).not.toMatch(/Secreta|Mi casa|-33\.44/)
  })

  it('opens CORS only to listed origins', async () => {
    const a = await app()
    const allowed = await a.request('/v1/health', { headers: { Origin: 'https://rutalibre.test' } })
    expect(allowed.headers.get('access-control-allow-origin')).toBe('https://rutalibre.test')
    const other = await a.request('/v1/health', { headers: { Origin: 'https://evil.test' } })
    expect(other.headers.get('access-control-allow-origin')).toBeNull()
  })

  it('answers unknown endpoints with the contract’s error shape', async () => {
    const res = await (await app()).request('/v1/nope')
    expect(res.status).toBe(404)
    expect(ErrorResponseSchema.parse(await res.json()).error.code).toBe('not-found')
  })

  it('hides internal errors from clients', async () => {
    const routing = { plan: () => Promise.reject(new Error('secret stack detail')) }
    const res = await (await app({ routing })).request('/v1/plan', post(TRIP))
    expect(res.status).toBe(500)
    expect(await res.text()).not.toContain('secret')
  })
})

describe('GET /v1/openapi.json', () => {
  it('documents every endpoint from the contract schemas', async () => {
    const res = await (await app()).request('/v1/openapi.json')
    const doc = (await res.json()) as { openapi: string; paths: Record<string, unknown> }
    expect(doc.openapi).toBe('3.1.0')
    expect(Object.keys(doc.paths).sort()).toEqual([
      '/v1/health',
      '/v1/interpret',
      '/v1/places',
      '/v1/plan',
      '/v1/status',
    ])
  })
})

describe('security headers', () => {
  it('forbids framing, sniffing and embedded content', async () => {
    const res = await (await app()).request('/v1/health')
    expect(res.headers.get('content-security-policy')).toBe(
      "default-src 'none'; frame-ancestors 'none'",
    )
    expect(res.headers.get('x-content-type-options')).toBe('nosniff')
    expect(res.headers.get('x-frame-options')).toBe('SAMEORIGIN')
    expect(res.headers.get('strict-transport-security')).toMatch(/max-age=/)
  })
})

describe('not configured', () => {
  it('answers 503 for place search without a Google key', async () => {
    const res = await (await app({ places: null })).request(
      `/v1/places?q=Toesca&session=${SESSION}`,
    )
    expect(res.status).toBe(503)
    expect(ErrorResponseSchema.parse(await res.json()).error.code).toBe('not-configured')
  })

  it('rejects an empty free-text request', async () => {
    const res = await (await app()).request('/v1/interpret', post({ text: '' }))
    expect(res.status).toBe(400)
  })
})
