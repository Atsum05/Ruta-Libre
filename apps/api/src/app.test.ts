import { describe, expect, it } from 'vitest'
import pkg from '../package.json' with { type: 'json' }
import { createApp } from './app.ts'

const app = createApp({ port: 8787, env: 'preview', commit: 'abc1234' })

describe('GET /v1/health', () => {
  it('reports the version, commit, and environment', async () => {
    const res = await app.request('/v1/health')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      status: 'ok',
      version: pkg.version,
      commit: 'abc1234',
      env: 'preview',
    })
  })

  it('is never cached', async () => {
    const res = await app.request('/v1/health')
    expect(res.headers.get('cache-control')).toBe('no-store')
  })
})

describe('unknown routes', () => {
  it('return 404', async () => {
    const res = await app.request('/v1/nope')
    expect(res.status).toBe(404)
  })
})
