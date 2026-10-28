// The four possible outcomes of checking a route (ADR 0005). `unknown` is a
// first-class result: missing or stale data must never read as "fine".
export const VERDICT_KINDS = ['ok', 'warning', 'blocked', 'unknown'] as const

export type VerdictKind = (typeof VERDICT_KINDS)[number]
