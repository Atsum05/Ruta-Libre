// External services sit behind these interfaces (ADR 0007). Adapters map each upstream to core
// types and validate its payload; tests use fakes, so CI needs no network or keys.

import type { StatusSnapshot } from '@rutalibre/core'

export interface StatusProvider {
  /** Fetches and validates the latest statuses. Throws on any upstream or format problem. */
  snapshot(): Promise<StatusSnapshot>
}
