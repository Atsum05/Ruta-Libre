import type { StationId } from './ids.ts'
import { matchStop, resolveTerminal } from './match.ts'
import type { Device, Registry } from './registry.ts'
import type { Route, TransitLeg } from './route.ts'
import type { StatusSnapshot } from './status.ts'
import { combineFindings, type Finding, type PlatformRelation, type Verdict } from './verdict.ts'

/** A snapshot older than this can't vouch for an elevator, so verdicts become `unknown`. */
export const DEFAULT_MAX_SNAPSHOT_AGE_MS = 10 * 60_000

export interface EvaluateOptions {
  readonly maxSnapshotAgeMs?: number
}

/**
 * Decides whether a route works for someone who needs elevators, right now (ADR 0005).
 *
 * Every Metro leg is checked at both ends, against that leg's own direction, so a transfer
 * station is checked once per leg. Buses aren't checked (no live accessibility data); trains are
 * reported as not covered.
 */
export function evaluateRoute(
  route: Route,
  snapshot: StatusSnapshot | null,
  registry: Registry,
  now: number,
  options: EvaluateOptions = {},
): Verdict {
  const findings: Finding[] = []
  const usesMetro = route.legs.some((leg) => leg.mode === 'metro')

  // Without fresh status, nothing about a device can be trusted: not even a reported failure.
  const maxAge = options.maxSnapshotAgeMs ?? DEFAULT_MAX_SNAPSHOT_AGE_MS
  let status: StatusSnapshot | null = null
  if (usesMetro) {
    if (snapshot === null) {
      findings.push({ effect: 'unknown', legIndex: null, reason: { code: 'status-unavailable' } })
    } else if (now - snapshot.observedAt > maxAge) {
      const ageMs = now - snapshot.observedAt
      findings.push({ effect: 'unknown', legIndex: null, reason: { code: 'status-stale', ageMs } })
    } else {
      status = snapshot
    }
  }

  route.legs.forEach((leg, legIndex) => {
    if (leg.mode === 'rail') {
      findings.push({
        effect: 'unknown',
        legIndex,
        reason: { code: 'mode-not-covered', mode: 'rail', line: leg.line },
      })
    } else if (leg.mode === 'metro') {
      findings.push(...evaluateMetroLeg(leg, legIndex, status, registry))
    }
  })

  return combineFindings(findings)
}

function evaluateMetroLeg(
  leg: TransitLeg,
  legIndex: number,
  status: StatusSnapshot | null,
  registry: Registry,
): Finding[] {
  const findings: Finding[] = []
  // Alighting happens on the same platform side as boarding: the one signed towards the terminal.
  const towards = resolveTerminal(leg.headsign, registry, leg.line)

  for (const stop of [leg.from, leg.to]) {
    const station = matchStop(stop, registry, { line: leg.line })
    if (station === null) {
      findings.push({
        effect: 'unknown',
        legIndex,
        reason: { code: 'stop-unmatched', stopName: stop.name },
      })
      continue
    }
    if (status === null) continue

    let hasUsableElevator = false
    for (const device of station.devices) {
      const platform = relationTo(device, towards)
      if (device.kind === 'elevator' && platform !== 'other') hasUsableElevator = true
      const finding = deviceFinding(device, platform, status, station.id, legIndex)
      if (finding) findings.push(finding)
    }
    if (!hasUsableElevator) {
      findings.push({
        effect: 'unknown',
        legIndex,
        reason: { code: 'no-known-elevator', stationId: station.id },
      })
    }
  }
  return findings
}

function relationTo(device: Device, towards: StationId | null): PlatformRelation {
  switch (device.scope.kind) {
    case 'station':
      return 'yours'
    case 'unknown':
      return 'uncertain'
    case 'platform':
      if (towards === null) return 'uncertain'
      return device.scope.towards.includes(towards) ? 'yours' : 'other'
  }
}

function deviceFinding(
  device: Device,
  platform: PlatformRelation,
  status: StatusSnapshot,
  stationId: StationId,
  legIndex: number,
): Finding | null {
  const state = status.devices.get(device.id)
  const deviceId = device.id

  if (device.kind === 'escalator') {
    // An escalator never blocks: the elevator still gets you through. A missing status can at
    // most hide a warning, so it's not reported.
    if (state !== 'out-of-service' || platform === 'other') return null
    return { effect: 'warning', legIndex, reason: { code: 'escalator-out', stationId, deviceId } }
  }

  if (state === undefined) {
    if (platform === 'other') return null
    return {
      effect: 'unknown',
      legIndex,
      reason: { code: 'elevator-status-missing', stationId, deviceId },
    }
  }
  if (state === 'working') return null

  // Warn too much rather than too little: the other platform's elevator still gets a warning,
  // in case we have the direction wrong.
  const effect = platform === 'yours' ? 'blocked' : platform === 'other' ? 'warning' : 'unknown'
  return { effect, legIndex, reason: { code: 'elevator-out', stationId, deviceId, platform } }
}
