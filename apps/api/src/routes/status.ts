import { Hono } from 'hono'
import { statusHealth } from '../status/health.ts'
import type { SnapshotStore } from '../status/store.ts'

export interface StatusRouteDeps {
  readonly store: Pick<SnapshotStore, 'get'>
  readonly maxAgeMs: number
  readonly now: () => number
}

const iso = (epoch: number | null) => (epoch === null ? null : new Date(epoch).toISOString())

/** GET /v1/status: the latest snapshot, how old it is, and whether the source is healthy. */
export function statusRoutes({ store, maxAgeMs, now }: StatusRouteDeps) {
  return new Hono().get('/v1/status', async (c) => {
    const stored = await store.get()
    const t = now()
    const snapshot = stored.snapshot
    // Statuses change at most every few minutes; a short shared cache spares the API.
    c.header('Cache-Control', 'public, max-age=30')
    return c.json({
      health: statusHealth(stored, t, maxAgeMs),
      observedAt: iso(snapshot?.observedAt ?? null),
      ageSeconds: snapshot ? Math.round((t - snapshot.observedAt) / 1000) : null,
      maxAgeSeconds: Math.round(maxAgeMs / 1000),
      fetchedAt: iso(stored.fetchedAt),
      lastError: stored.lastError,
      devices: snapshot ? Object.fromEntries(snapshot.devices) : {},
    })
  })
}
