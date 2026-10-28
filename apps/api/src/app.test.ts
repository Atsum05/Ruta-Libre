import { describe, expect, it } from 'vitest'
import pkg from '../package.json' with { type: 'json' }
import { createApp } from './app.ts'
import { parseConfig } from './config.ts'
import { InMemorySnapshotStore } from './status/store.ts'

const app = createApp({
  config: parseConfig({ APP_ENV: 'preview', COMMIT_SHA: 'abc1234' }),
  statusStore: new InMemorySnapshotStore(),
})

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
