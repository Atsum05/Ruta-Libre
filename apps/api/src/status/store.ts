import type { DeviceId, DeviceState, StatusSnapshot } from '@rutalibre/core'

/** What the poller last learned. Kept separate from requests: users never hit the upstream. */
export interface StoredStatus {
  /** The last good snapshot, kept even while the upstream is failing. */
  readonly snapshot: StatusSnapshot | null
  /** When we last fetched a good snapshot (epoch ms). */
  readonly fetchedAt: number | null
  /** Why the last attempt failed, or null if it succeeded. */
  readonly lastError: string | null
  /** When the current run of failures began. */
  readonly failingSince: number | null
}

export const EMPTY_STATUS: StoredStatus = {
  snapshot: null,
  fetchedAt: null,
  lastError: null,
  failingSince: null,
}

/** Latest-status storage. In memory for one instance; Render Key Value once deployed (ADR 0008). */
export interface SnapshotStore {
  get(): Promise<StoredStatus>
  set(status: StoredStatus): Promise<void>
}

export class InMemorySnapshotStore implements SnapshotStore {
  #status: StoredStatus = EMPTY_STATUS

  async get() {
    return this.#status
  }

  async set(status: StoredStatus) {
    this.#status = status
  }
}

/** One device changing state between two snapshots: the basis for reliability scores later. */
export interface StatusChange {
  readonly deviceId: DeviceId
  /** null when the device wasn't in the previous snapshot. */
  readonly from: DeviceState | null
  /** null when the device disappeared from the feed. */
  readonly to: DeviceState | null
  readonly observedAt: number
}

/** Status-change log. In memory for now; Render Postgres once deployed (ADR 0008). */
export interface StatusHistory {
  record(changes: readonly StatusChange[]): Promise<void>
}

export class InMemoryStatusHistory implements StatusHistory {
  readonly #changes: StatusChange[] = []
  readonly #limit: number

  constructor(limit = 10_000) {
    this.#limit = limit
  }

  async record(changes: readonly StatusChange[]) {
    this.#changes.push(...changes)
    this.#changes.splice(0, Math.max(0, this.#changes.length - this.#limit))
  }

  recent(): readonly StatusChange[] {
    return this.#changes
  }
}

/** Devices whose state differs between two snapshots, sorted by ID. */
export function diffSnapshots(prev: StatusSnapshot | null, next: StatusSnapshot): StatusChange[] {
  if (prev === null) return []
  const ids = new Set([...prev.devices.keys(), ...next.devices.keys()])
  const changes: StatusChange[] = []
  for (const deviceId of [...ids].sort()) {
    const from = prev.devices.get(deviceId) ?? null
    const to = next.devices.get(deviceId) ?? null
    if (from !== to) changes.push({ deviceId, from, to, observedAt: next.observedAt })
  }
  return changes
}
