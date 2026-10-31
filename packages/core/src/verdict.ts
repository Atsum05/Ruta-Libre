import type { DeviceId, StationId } from './ids.ts'

// The four possible outcomes of checking a route (ADR 0005). `unknown` is a
// first-class result: missing or stale data must never read as "fine".
export const VERDICT_KINDS = ['ok', 'warning', 'blocked', 'unknown'] as const

export type VerdictKind = (typeof VERDICT_KINDS)[number]

/** Where a device sits relative to the platform this leg uses. */
export type PlatformRelation = 'yours' | 'other' | 'uncertain'

/** Machine-readable cause of a finding. The UI turns these into text. */
export type Reason =
  | { readonly code: 'status-unavailable' }
  | { readonly code: 'status-stale'; readonly ageMs: number }
  | { readonly code: 'stop-unmatched'; readonly stopName: string }
  | { readonly code: 'mode-not-covered'; readonly mode: 'rail'; readonly line: string }
  | { readonly code: 'no-known-elevator'; readonly stationId: StationId }
  | {
      readonly code: 'elevator-out'
      readonly stationId: StationId
      readonly deviceId: DeviceId
      readonly platform: PlatformRelation
    }
  | {
      readonly code: 'elevator-status-missing'
      readonly stationId: StationId
      readonly deviceId: DeviceId
    }
  | { readonly code: 'escalator-out'; readonly stationId: StationId; readonly deviceId: DeviceId }
  | {
      /** Out of service, but another working elevator connects the same two places (ADR 0015). */
      readonly code: 'elevator-out-backup'
      readonly stationId: StationId
      readonly deviceId: DeviceId
      readonly backupDeviceId: DeviceId
    }

export interface Finding {
  readonly effect: Exclude<VerdictKind, 'ok'>
  /** Index into `route.legs`, or null when the finding applies to the whole route. */
  readonly legIndex: number | null
  readonly reason: Reason
}

export interface Verdict {
  readonly kind: VerdictKind
  readonly findings: readonly Finding[]
}

/**
 * Combines findings into one verdict. A confirmed block outranks uncertainty: if any elevator on
 * the path is known broken, the route is blocked whatever else we don't know.
 */
export function combineFindings(findings: readonly Finding[]): Verdict {
  const has = (effect: Finding['effect']) => findings.some((f) => f.effect === effect)
  const kind: VerdictKind = has('blocked')
    ? 'blocked'
    : has('unknown')
      ? 'unknown'
      : has('warning')
        ? 'warning'
        : 'ok'
  return { kind, findings }
}
