import { DeviceId } from '@rutalibre/core'
import { describe, expect, it } from 'vitest'
import { createApp } from '../app.ts'
import { parseConfig } from '../config.ts'
import { EMPTY_STATUS, InMemorySnapshotStore, type StoredStatus } from '../status/store.ts'

const HOUR = 60 * 60_000
const NOW = Date.parse('2026-10-28T12:00:00Z')
const config = parseConfig({ STATUS_MAX_AGE_MINUTES: String(13 * 60) })

async function getStatus(stored: StoredStatus) {
  const store = new InMemorySnapshotStore()
  await store.set(stored)
  const res = await createApp({ config, statusStore: store, now: () => NOW }).request('/v1/status')
  return { res, body: (await res.json()) as Record<string, unknown> }
}

const good = (ageMs: number): StoredStatus => ({
  snapshot: {
    observedAt: NOW - ageMs,
    devices: new Map([[DeviceId('HE-0f6a35'), 'out-of-service']]),
  },
  fetchedAt: NOW - 60_000,
  lastError: null,
  failingSince: null,
})

describe('GET /v1/status', () => {
  it('serves the snapshot with its age and health', async () => {
    const { res, body } = await getStatus(good(2 * HOUR))
    expect(res.status).toBe(200)
    expect(body).toEqual({
      health: 'ok',
      observedAt: '2026-10-28T10:00:00.000Z',
      ageSeconds: 7200,
      maxAgeSeconds: 13 * 3600,
      fetchedAt: '2026-10-28T11:59:00.000Z',
      lastError: null,
      devices: { 'HE-0f6a35': 'out-of-service' },
      demo: false,
    })
  })

  it('allows a short shared cache', async () => {
    const { res } = await getStatus(good(0))
    expect(res.headers.get('cache-control')).toBe('public, max-age=30')
  })

  it('says stale when the source has stopped updating, however recent our fetch', async () => {
    const { body } = await getStatus(good(12 * 24 * HOUR))
    expect(body['health']).toBe('stale')
  })

  it('says degraded while serving the last good snapshot after a failure', async () => {
    const { body } = await getStatus({
      ...good(HOUR),
      lastError: 'HTTP 503',
      failingSince: NOW - 120_000,
    })
    expect(body).toMatchObject({ health: 'degraded', lastError: 'HTTP 503' })
  })

  it('says unavailable before the first good snapshot', async () => {
    const { body } = await getStatus(EMPTY_STATUS)
    expect(body).toMatchObject({
      health: 'unavailable',
      observedAt: null,
      ageSeconds: null,
      devices: {},
    })
  })
})

describe('GET /v1/status in demo mode (ADR 0014)', () => {
  it('reports two-week-old data as usable, and flags the demo', async () => {
    const store = new InMemorySnapshotStore()
    await store.set(good(14 * 24 * HOUR))
    const demoConfig = parseConfig({ STATUS_DEMO: 'true' })
    const res = await createApp({ config: demoConfig, statusStore: store, now: () => NOW }).request(
      '/v1/status',
    )
    expect(await res.json()).toMatchObject({ health: 'ok', demo: true, ageSeconds: 14 * 24 * 3600 })
  })

  it('still reports a failing source as degraded', async () => {
    const store = new InMemorySnapshotStore()
    await store.set({ ...good(HOUR), lastError: 'HTTP 503', failingSince: NOW })
    const demoConfig = parseConfig({ STATUS_DEMO: 'true' })
    const res = await createApp({ config: demoConfig, statusStore: store, now: () => NOW }).request(
      '/v1/status',
    )
    expect(await res.json()).toMatchObject({ health: 'degraded', demo: true })
  })
})
