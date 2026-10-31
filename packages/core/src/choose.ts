import type { Route } from './route.ts'
import type { Verdict, VerdictKind } from './verdict.ts'

/** Where a candidate came from, in fallback order: main route, alternatives, bus only. */
export type CandidateSource = 'primary' | 'alternative' | 'bus-only'

export interface Candidate<R extends Route = Route> {
  readonly route: R
  readonly source: CandidateSource
  readonly verdict: Verdict
}

export interface Plan<C extends Candidate = Candidate> {
  readonly ranked: readonly C[]
  readonly best: C | null
  /**
   * - accessible: the best route is ok or only has warnings.
   * - uncertain: the best we have is `unknown`: show it, but say we can't be sure.
   * - no-accessible-route: every route is blocked; tell the user to ask for assistance.
   * - no-route: the provider found nothing.
   */
  readonly outcome: 'accessible' | 'uncertain' | 'no-accessible-route' | 'no-route'
  /** True when we're not showing the provider's main route because of accessibility. */
  readonly rerouted: boolean
}

// ok and warning share a tier: a broken escalator doesn't justify a different route (ADR 0005).
const TIER: Record<VerdictKind, number> = { ok: 0, warning: 0, unknown: 1, blocked: 2 }
const SOURCE_ORDER: Record<CandidateSource, number> = { primary: 0, alternative: 1, 'bus-only': 2 }

/** Routes that ride the Metro: the network whose elevators we can actually check (ADR 0014). */
export const usesMetro = (route: Route) => route.legs.some((leg) => leg.mode === 'metro')

/**
 * Ranks evaluated routes into the plan we show: the fallback order, expressed as data. Within a
 * tier, routes that use the Metro come first (ADR 0014), then the provider's own order.
 */
export function chooseRoute<C extends Candidate>(candidates: readonly C[]): Plan<C> {
  const metroFirst = (c: Candidate) => (usesMetro(c.route) ? 0 : 1)
  // Array.prototype.sort is stable, so the provider's own order survives within a tier.
  const ranked = [...candidates].sort(
    (a, b) =>
      TIER[a.verdict.kind] - TIER[b.verdict.kind] ||
      metroFirst(a) - metroFirst(b) ||
      SOURCE_ORDER[a.source] - SOURCE_ORDER[b.source],
  )
  const best = ranked[0]
  if (best === undefined) return { ranked, best: null, outcome: 'no-route', rerouted: false }

  const outcome =
    TIER[best.verdict.kind] === 0
      ? 'accessible'
      : best.verdict.kind === 'unknown'
        ? 'uncertain'
        : 'no-accessible-route'
  // "Rerouted" means accessibility changed the answer: the provider's own first choice was worse.
  const primary = candidates.find((c) => c.source === 'primary')
  const rerouted = primary !== undefined && TIER[primary.verdict.kind] > TIER[best.verdict.kind]
  return { ranked, best, outcome, rerouted }
}

/** Whether any route is ok or warning. If not, the API should also ask for bus-only routes. */
export function hasAccessibleRoute(candidates: readonly Candidate[]): boolean {
  return candidates.some((c) => TIER[c.verdict.kind] === 0)
}
