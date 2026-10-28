import { describe, expect, it } from 'vitest'
import { requestJson, UpstreamError } from './request.ts'

/** A fetch that returns the queued responses (or throws the queued errors) in order. */
function queue(...outcomes: (Response | Error)[]) {
  const calls: RequestInit[] = []
  const fetchFn: typeof fetch = async (_url, init) => {
    calls.push(init ?? {})
    const next = outcomes.shift()
    if (!next) throw new Error('no more responses')
    if (next instanceof Error) throw next
    return next
  }
  return { fetchFn, calls }
}
const json = (status: number, body: unknown = {}) => new Response(JSON.stringify(body), { status })
const noSleep = async () => {}

describe('requestJson', () => {
  it('returns the parsed body', async () => {
    const { fetchFn } = queue(json(200, { a: 1 }))
    await expect(requestJson('u', {}, { timeoutMs: 100, fetchFn })).resolves.toEqual({ a: 1 })
  })

  it('sets a timeout signal on every attempt', async () => {
    const { fetchFn, calls } = queue(json(200))
    await requestJson('u', {}, { timeoutMs: 100, fetchFn })
    expect(calls[0]?.signal).toBeInstanceOf(AbortSignal)
  })

  it('retries a 503 and a network error, with growing waits', async () => {
    const waits: number[] = []
    const { fetchFn } = queue(json(503), new TypeError('reset'), json(200, { ok: true }))
    const result = await requestJson(
      'u',
      {},
      {
        timeoutMs: 100,
        retries: 2,
        backoffMs: 100,
        fetchFn,
        sleep: async (ms) => {
          waits.push(ms)
        },
      },
    )
    expect(result).toEqual({ ok: true })
    expect(waits).toEqual([100, 200])
  })

  it('does not retry a client error', async () => {
    const { fetchFn, calls } = queue(json(400), json(200))
    await expect(
      requestJson('u', {}, { timeoutMs: 100, retries: 2, fetchFn, sleep: noSleep }),
    ).rejects.toThrow('HTTP 400')
    expect(calls).toHaveLength(1)
  })

  it('gives up after the last retry', async () => {
    const { fetchFn } = queue(json(429), json(429))
    const err = await requestJson(
      'u',
      {},
      { timeoutMs: 100, retries: 1, fetchFn, sleep: noSleep },
    ).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(UpstreamError)
    expect(err).toMatchObject({ status: 429 })
  })

  it('reports a network failure on the last attempt', async () => {
    const { fetchFn } = queue(new TypeError('getaddrinfo ENOTFOUND'))
    await expect(requestJson('u', {}, { timeoutMs: 100, fetchFn })).rejects.toThrow('ENOTFOUND')
  })

  it('rejects a body that is not JSON', async () => {
    const { fetchFn } = queue(new Response('<html>', { status: 200 }))
    await expect(requestJson('u', {}, { timeoutMs: 100, fetchFn })).rejects.toThrow('not JSON')
  })
})
