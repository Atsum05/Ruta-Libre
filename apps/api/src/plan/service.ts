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
  /** Demo mode (ADR 0014): the last snapshot counts as current, however old. Labelled in the UI. */
  readonly demo: boolean
  readonly now: () => number
  readonly log: Logger
}

/**
 * Plans an accessible trip (roadmap phase 6): the provider's routes, evaluated by core; if none
 * is ok or warning, bus-only routes too; then ranked into the fallback order.
 */
export async function planTrip(deps: PlanDeps, request: PlanRequest): Promise<PlanResponse> {
  const { routing, statusStore, registry, now, log, demo } = deps
  const maxAgeMs = demo ? Number.POSITIVE_INFINITY : deps.maxAgeMs
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
  // The provider's own choice, plus Metro-only options so they're always considered (ADR 0014).
  // Metro-only is a bonus: if that request fails, the plan goes on without it.
  const [main, metroOnly] = await Promise.all([
    routing.plan({ ...base, ...when, travel: 'any' }),
    routing.plan({ ...base, ...when, travel: 'metro' }).catch((err: unknown) => {
      log.warn('metro-only request failed', {
        error: err instanceof Error ? err.message : String(err),
      })
      return []
    }),
  ])
  // The same trip can come back twice, even in one response (a later departure): keep the first,
  // so riders choosing between options never see two identical ones. The primary is always kept.
  const seen = new Set<string>()
  const isNew = (route: DetailedRoute) => {
    const key = signature(route)
    return !seen.has(key) && Boolean(seen.add(key))
  }
  let candidates = [
    ...evaluate(main.filter(isNew), (i) => (i === 0 ? 'primary' : 'alternative')),
    ...evaluate(metroOnly.filter(isNew), () => 'alternative'),
  ]

  if (!hasAccessibleRoute(candidates)) {
    try {
      const busOnly = await routing.plan({ ...base, ...when, travel: 'bus' })
      candidates = [...candidates, ...evaluate(busOnly.filter(isNew), () => 'bus-only')]
    } catch (err) {
      // The Metro answer still stands; only the last fallback is missing.
      if (candidates.length === 0) throw err
      log.warn('bus-only fallback failed', {
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  const plan = chooseRoute(candidates)
  const names: Names = {
    stations: new Map(registry.stations.map((s) => [s.id as string, s.name])),
    devices: new Map(
      registry.stations.flatMap((s) =>
        s.devices.flatMap((d) => (d.description ? [[d.id as string, d.description] as const] : [])),
      ),
    ),
  }
  return {
    outcome: plan.outcome,
    rerouted: plan.rerouted,
    routes: plan.ranked.map((c) => toRouteView(c, names)),
    status: {
      health: statusHealth(stored, t, maxAgeMs),
      observedAt: stored.snapshot ? new Date(stored.snapshot.observedAt).toISOString() : null,
      demo,
    },
  }
}

/** Two routes are the same trip if they ride the same lines between the same stops. */
function signature(route: DetailedRoute): string {
  return route.legs
    .map((leg) =>
      leg.mode === 'walk' ? 'walk' : `${leg.mode}:${leg.line}:${leg.from.name}>${leg.to.name}`,
    )
    .join('|')
}

/** Human-facing names for IDs in findings: stations, and devices' own descriptions. */
interface Names {
  readonly stations: ReadonlyMap<string, string>
  readonly devices: ReadonlyMap<string, string>
}

function toRouteView(c: Candidate<DetailedRoute>, names: Names): RouteView {
  const findings: Finding[] = c.verdict.findings.map((f) => ({
    effect: f.effect,
    legIndex: f.legIndex,
    reason: f.reason,
    stationName: 'stationId' in f.reason ? (names.stations.get(f.reason.stationId) ?? null) : null,
    ...describe('deviceId' in f.reason ? f.reason.deviceId : undefined, 'deviceDescription', names),
    ...describe(
      'backupDeviceId' in f.reason ? f.reason.backupDeviceId : undefined,
      'backupDescription',
      names,
    ),
  }))
  return {
    source: c.source,
    verdict: { kind: c.verdict.kind, findings },
    durationSeconds: adjustedDurationSeconds(c.route),
    ...tripTimes(c.route),
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
            ...(leg.departAt && { departAt: leg.departAt }),
            ...(leg.arriveAt && { arriveAt: leg.arriveAt }),
            path: toPath(leg.path),
          },
    ),
  }
}

/** The contract's mutable [lng, lat] pairs, copied from the provider's readonly path. */
const toPath = (path: Path): [number, number][] => path.map(([lng, lat]) => [lng, lat])

/** { [field]: description } when the device has one, otherwise nothing (the field is optional). */
function describe<K extends 'deviceDescription' | 'backupDescription'>(
  deviceId: string | undefined,
  field: K,
  names: Names,
): Partial<Record<K, string>> {
  const description = deviceId === undefined ? undefined : names.devices.get(deviceId)
  return description === undefined ? {} : ({ [field]: description } as Partial<Record<K, string>>)
}

/**
 * Leave-at and arrive-at times at a reduced-mobility pace. Vehicles keep their timetable; the
 * walks before the first and after the last are scaled, so you leave earlier and arrive later
 * than a standard planner says. Transfers aren't rechecked: the times are an estimate.
 */
function tripTimes(route: DetailedRoute): { departAt?: string; arriveAt?: string } {
  const transit = route.legs.flatMap((leg, i) => (leg.mode === 'walk' ? [] : [{ leg, i }]))
  const first = transit[0]
  const last = transit.at(-1)
  if (!first?.leg.departAt || !last?.leg.arriveAt) return {}
  const walking = (legs: readonly DetailedRoute['legs'][number][]) =>
    legs.reduce((sum, l) => sum + (l.mode === 'walk' ? adjustWalkingTime(l.durationSeconds) : 0), 0)
  const before = walking(route.legs.slice(0, first.i))
  const after = walking(route.legs.slice(last.i + 1))
  return {
    departAt: new Date(Date.parse(first.leg.departAt) - before * 1000).toISOString(),
    arriveAt: new Date(Date.parse(last.leg.arriveAt) + after * 1000).toISOString(),
  }
}
