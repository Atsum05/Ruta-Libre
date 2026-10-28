import type { Logger } from '../log.ts'
import type { StatusProvider } from '../providers.ts'
import { diffSnapshots, type SnapshotStore, type StatusHistory } from './store.ts'

export interface PollerDeps {
  readonly provider: StatusProvider
  readonly store: SnapshotStore
  readonly history: StatusHistory
  readonly log: Logger
  readonly now?: () => number
}

/**
 * Fetches the live status on a schedule and keeps the last good snapshot. On any failure it keeps
 * what it had and records the error, so the API reports "degraded" and verdicts age into
 * `unknown`. It never overwrites good data with garbage (roadmap phase 5).
 */
export class StatusPoller {
  readonly #deps: PollerDeps
  #timer: ReturnType<typeof setInterval> | undefined

  constructor(deps: PollerDeps) {
    this.#deps = deps
  }

  async refresh(): Promise<void> {
    const { provider, store, history, log, now = Date.now } = this.#deps
    const prev = await store.get()
    try {
      const next = await provider.snapshot()
      if (prev.snapshot && next.observedAt < prev.snapshot.observedAt) {
        throw new Error('upstream went back in time; keeping the newer snapshot')
      }
      const changes = diffSnapshots(prev.snapshot, next)
      if (changes.length > 0) await history.record(changes)
      await store.set({ snapshot: next, fetchedAt: now(), lastError: null, failingSince: null })
      if (prev.lastError) log.info('status source recovered', { failingSince: prev.failingSince })
      log.info('status refreshed', {
        devices: next.devices.size,
        changes: changes.length,
        observedAt: new Date(next.observedAt).toISOString(),
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      await store.set({ ...prev, lastError: message, failingSince: prev.failingSince ?? now() })
      log.error('status refresh failed', { error: message, keptSnapshot: prev.snapshot !== null })
    }
  }

  /** Refreshes now, then every `intervalMs`. Errors are contained; the loop keeps going. */
  start(intervalMs: number): void {
    void this.refresh()
    this.#timer = setInterval(() => void this.refresh(), intervalMs)
    this.#timer.unref?.()
  }

  stop(): void {
    clearInterval(this.#timer)
  }
}
