import { describe, expect, it } from 'vitest'
import { fetchHealth } from './health.ts'

function fakeFetch(status: number, body: unknown): typeof fetch {
  return async () => new Response(JSON.stringify(body), { status })
}

describe('fetchHealth', () => {
  it('returns the parsed health payload', async () => {
    const health = { status: 'ok', version: '0.1.0', commit: 'abc1234', env: 'preview' }
    await expect(fetchHealth(fakeFetch(200, health))).resolves.toEqual(health)
  })

  it('calls the API through the same-origin proxy', async () => {
    let calledWith = ''
    const spy: typeof fetch = async (input) => {
      calledWith = String(input)
      return new Response(JSON.stringify({ status: 'ok', version: '1', commit: 'x', env: 'local' }))
    }
    await fetchHealth(spy)
    expect(calledWith).toBe('/api/v1/health')
  })

  it('fails on an HTTP error', async () => {
    await expect(fetchHealth(fakeFetch(502, {}))).rejects.toThrow(/502/)
  })

  // Validate at the edge: a changed API shape must fail loudly, not render "undefined".
  it('fails on an unexpected payload', async () => {
    await expect(fetchHealth(fakeFetch(200, { status: 'ok' }))).rejects.toThrow()
  })
})
