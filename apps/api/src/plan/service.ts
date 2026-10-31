import type { Finding, PlanRequest, PlanResponse, RouteView } from '@rutalibre/contract'
import {
  adjustedDurationSeconds,
  adjustWalkingTime,
  type Candidate,
  type CandidateSource,
  chooseRoute,
  evaluateRoute,
  hasAccessibleRoute,
  parseHeadsign,
  type Registry,
} from '@rutalibre/core'
import type { Logger } from '../log.ts'
import type { DetailedRoute, Path, RoutingProvider } from '../providers.ts'
import { statusHealth } from '../status/health.ts'
import type { SnapshotStore } from '../status/store.ts'

export interface PlanDeps {
  readonly routing: RoutingProvider
  readonly statusStore: Pick<SnapshotStore, 'get'>
  readonly registry: Registry
  readonly maxAgeMs: number
  readonly now: () => number
  readonly log: Logger
}

/**
 * Plans an accessible trip (roadmap phase 6): the provider's routes, evaluated by core; if none
 * is ok or warning, bus-only routes too; then ranked into the fallback order.
 */
export async function planTrip(deps: PlanDeps, request: PlanRequest): Promise<PlanResponse> {
  const { routing, statusStore, registry, maxAgeMs, now, log } = deps
  const stored = await statusStore.get()
  const t = now()
  const evaluate = (routes: readonly DetailedRoute[], source: (i: number) => CandidateSource) =>
    routes.map(
      (route, i): Candidate<DetailedRoute> => ({
        route,
        source: source(i),
        verdict: evaluateRoute(route, stored.snapshot, registry, t, { maxSnapshotAgeMs: maxAgeMs }),
      }),
    )

  const base = { origin: request.origin, destination: request.destination }
  const when = request.departAt ? { departAt: request.departAt } : {}
  const main = await routing.plan({ ...base, ...when, busOnly: false })
  let candidates = evaluate(main, (i) => (i === 0 ? 'primary' : 'alternative'))

  if (!hasAccessibleRoute(candidates)) {
    try {
      const busOnly = await routing.plan({ ...base, ...when, busOnly: true })
      candidates = [...candidates, ...evaluate(busOnly, () => 'bus-only')]
    } catch (err) {
      // The Metro answer still stands; only the last fallback is missing.
      if (main.length === 0) throw err
      log.warn('bus-only fallback failed', {
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  const plan = chooseRoute(candidates)
  const stationNames = new Map(registry.stations.map((s) => [s.id as string, s.name]))
  return {
    outcome: plan.outcome,
    rerouted: plan.rerouted,
    routes: plan.ranked.map((c) => toRouteView(c, stationNames)),
    status: {
      health: statusHealth(stored, t, maxAgeMs),
      observedAt: stored.snapshot ? new Date(stored.snapshot.observedAt).toISOString() : null,
    },
  }
}

function toRouteView(
  c: Candidate<DetailedRoute>,
  stationNames: ReadonlyMap<string, string>,
): RouteView {
  const findings: Finding[] = c.verdict.findings.map((f) => ({
    effect: f.effect,
    legIndex: f.legIndex,
    reason: f.reason,
    stationName: 'stationId' in f.reason ? (stationNames.get(f.reason.stationId) ?? null) : null,
  }))
  return {
    source: c.source,
    verdict: { kind: c.verdict.kind, findings },
    durationSeconds: adjustedDurationSeconds(c.route),
    legs: c.route.legs.map((leg) =>
      leg.mode === 'walk'
        ? {
            mode: 'walk' as const,
            durationSeconds: adjustWalkingTime(leg.durationSeconds),
            path: toPath(leg.path),
          }
        : {
            mode: leg.mode,
            durationSeconds: leg.durationSeconds,
            line: leg.line,
            label: leg.label,
            color: leg.color,
            textColor: leg.textColor,
            headsign: leg.headsign === null ? null : parseHeadsign(leg.headsign).destination,
            expressRoute: leg.headsign === null ? null : parseHeadsign(leg.headsign).expressRoute,
            from: { name: leg.from.name, lat: leg.from.location.lat, lng: leg.from.location.lng },
            to: { name: leg.to.name, lat: leg.to.location.lat, lng: leg.to.location.lng },
            stopCount: leg.stopCount,
            path: toPath(leg.path),
          },
    ),
  }
}

/** The contract's mutable [lng, lat] pairs, copied from the provider's readonly path. */
const toPath = (path: Path): [number, number][] => path.map(([lng, lat]) => [lng, lat])
