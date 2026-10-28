import type { DeviceId } from './ids.ts'

export type DeviceState = 'working' | 'out-of-service'

/** Live status of every device, as last fetched by the status poller (Phase 5). */
export interface StatusSnapshot {
  /** Epoch milliseconds. */
  readonly fetchedAt: number
  readonly devices: ReadonlyMap<DeviceId, DeviceState>
}
