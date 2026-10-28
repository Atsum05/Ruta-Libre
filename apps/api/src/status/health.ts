import type { StoredStatus } from './store.ts'

/**
 * - ok: fresh data, last fetch succeeded.
 * - stale: the source answers, but its newest observation is older than the threshold.
 * - degraded: the last fetch failed; serving the last good snapshot.
 * - unavailable: we have never had a good snapshot.
 */
export type StatusHealth = 'ok' | 'stale' | 'degraded' | 'unavailable'

export function statusHealth(status: StoredStatus, now: number, maxAgeMs: number): StatusHealth {
  if (status.snapshot === null) return 'unavailable'
  if (status.lastError !== null) return 'degraded'
  if (now - status.snapshot.observedAt > maxAgeMs) return 'stale'
  return 'ok'
}
