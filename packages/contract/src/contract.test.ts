import type { DeviceId, Reason, StationId } from '@rutalibre/core'
import { describe, expect, expectTypeOf, it } from 'vitest'
import type { z } from 'zod'
import { ApiError, createApiClient } from './client.ts'
import { PlanRequestSchema, type ReasonSchema } from './schemas.ts'

describe('ReasonSchema', () => {
  it("matches core's Reason exactly (compile-time)", () => {
    // Branded IDs travel as plain strings over HTTP; everything else must line up.
    type Wire<T> = T extends unknown
      ? { -readonly [K in keyof T]: T[K] extends StationId | DeviceId ? string : T[K] }
      : never
    expectTypeOf<Wire<Reason>>().toEqualTypeOf<z.infer<typeof ReasonSchema>>()
  })
})

describe('PlanRequestSchema', () => {
  it('accepts a place, a point, and an address', () => {
    const ok = PlanRequestSchema.safeParse({
      origin: { kind: 'point', lat: -33.44, lng: -70.65 },
      destination: { kind: 'address', text: 'Metro Irarrázaval' },
    })
    expect(ok.success).toBe(true)
  })

  it.each([
    ['a missing destination', { origin: { kind: 'place', placeId: 'abc' } }],
    [
      'an out-of-range latitude',
      { origin: { kind: 'point', lat: 120, lng: 0 }, destination: { kind: 'place', placeId: 'x' } },
    ],
    [
      'a one-letter address',
      { origin: { kind: 'address', text: 'a' }, destination: { kind: 'place', placeId: 'x' } },
    ],
    [
      'a bad departure time',
      {
        origin: { kind: 'place', placeId: 'a' },
        destination: { kind: 'place', placeId: 'b' },
        departAt: 'soon',
      },
    ],
  ])('rejects %s', (_label, body) => {
    expect(PlanRequestSchema.safeParse(body).success).toBe(false)
  })
})

describe('createApiClient', () => {
  const respond =
    (status: number, body: unknown): typeof fetch =>
    async () =>
      new Response(JSON.stringify(body), { status })

  it('calls through the same-origin proxy and validates the response', async () => {
    let url = ''
    const client = createApiClient({
      fetchFn: async (input) => {
        url = String(input)
        return new Response(
          JSON.stringify({ status: 'ok', version: '1', commit: 'x', env: 'local' }),
        )
      },
    })
    await expect(client.health()).resolves.toMatchObject({ version: '1' })
    expect(url).toBe('/api/v1/health')
  })

  it('encodes the places query', async () => {
    let url = ''
    const client = createApiClient({
      fetchFn: async (input) => {
        url = String(input)
        return new Response(JSON.stringify({ suggestions: [] }))
      },
    })
    await client.places('Los Héroes & Co', '7d0c2a5e-0000-4000-8000-000000000000')
    expect(url).toContain('q=Los+H%C3%A9roes+%26+Co')
  })

  it('turns an API error body into an ApiError with its code', async () => {
    const client = createApiClient({
      fetchFn: respond(429, {
        error: { code: 'rate-limited', message: 'slow down' },
        requestId: 'r1',
      }),
    })
    await expect(client.health()).rejects.toMatchObject({ code: 'rate-limited', status: 429 })
  })

  it('rejects a response that breaks the contract', async () => {
    const client = createApiClient({ fetchFn: respond(200, { status: 'ok' }) })
    await expect(client.health()).rejects.toMatchObject({ code: 'invalid-response' })
  })

  it('reports a network failure', async () => {
    const client = createApiClient({
      fetchFn: () => Promise.reject(new TypeError('Failed to fetch')),
    })
    const err = await client.status().catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err).toMatchObject({ code: 'network', status: null })
  })

  it('reports a non-JSON error page', async () => {
    const client = createApiClient({
      fetchFn: async () => new Response('<html>502</html>', { status: 502 }),
    })
    await expect(client.status()).rejects.toMatchObject({ code: 'internal', status: 502 })
  })
})

describe('cancelling a request', () => {
  it('passes the abort through instead of reporting a network error', async () => {
    const controller = new AbortController()
    const client = createApiClient({
      fetchFn: () => {
        controller.abort()
        return Promise.reject(new DOMException('aborted', 'AbortError'))
      },
    })
    const err = await client.status(controller.signal).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(DOMException)
  })

  it('sends plan and interpret requests as JSON with the signal', async () => {
    const seen: RequestInit[] = []
    const client = createApiClient({
      fetchFn: async (_url, init) => {
        seen.push(init ?? {})
        return new Response(JSON.stringify({ origin: null, destination: 'x' }))
      },
    })
    const controller = new AbortController()
    await client.interpret('a Toesca', controller.signal)
    expect(seen[0]).toMatchObject({
      method: 'POST',
      body: '{"text":"a Toesca"}',
      signal: controller.signal,
    })
  })
})
