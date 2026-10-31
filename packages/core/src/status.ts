import type { DeviceId } from './ids.ts'

export type DeviceState = 'working' | 'out-of-service'

/** Live status of every device, as last reported by the upstream source (Phase 5). */
export interface StatusSnapshot {
  /**
   * When the source observed these statuses, in epoch milliseconds. Not when we fetched them:
   * a feed that stopped updating must age, however often we poll it.
   */
  readonly observedAt: number
  readonly devices: ReadonlyMap<DeviceId, DeviceState>
}
