import type { StationId } from './ids.ts'
import { matchStop, resolveTerminal } from './match.ts'
import type { Device, Registry, Station } from './registry.ts'
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
      const finding = deviceFinding(device, platform, status, station, legIndex)
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

/**
 * A working elevator at the same station that connects exactly the same two places (ADR 0015).
 * Only that counts: an elevator reaching the same platform from somewhere else doesn't help
 * someone standing where the broken one starts (the Los Héroes case).
 */
function workingBackup(device: Device, station: Station, status: StatusSnapshot): Device | null {
  if (device.link === undefined) return null
  return (
    station.devices.find(
      (other) =>
        other.id !== device.id &&
        other.kind === 'elevator' &&
        other.link === device.link &&
        status.devices.get(other.id) === 'working',
    ) ?? null
  )
}

function deviceFinding(
  device: Device,
  platform: PlatformRelation,
  status: StatusSnapshot,
  station: Station,
  legIndex: number,
): Finding | null {
  const state = status.devices.get(device.id)
  const deviceId = device.id
  const stationId = station.id

  if (device.kind === 'escalator') {
    // An escalator never blocks: the elevator still gets you through. A missing status can at
    // most hide a warning, so it's not reported.
    if (state !== 'out-of-service' || platform === 'other') return null
    return { effect: 'warning', legIndex, reason: { code: 'escalator-out', stationId, deviceId } }
  }

  // A confirmed working twin covers this elevator whatever its own state: still say when it's
  // broken, so the rider knows which one to use; say nothing when it's merely unreported.
  const backup = platform === 'other' ? null : workingBackup(device, station, status)

  if (state === undefined) {
    if (platform === 'other' || backup) return null
    return {
      effect: 'unknown',
      legIndex,
      reason: { code: 'elevator-status-missing', stationId, deviceId },
    }
  }
  if (state === 'working') return null

  if (backup) {
    return {
      effect: 'warning',
      legIndex,
      reason: { code: 'elevator-out-backup', stationId, deviceId, backupDeviceId: backup.id },
    }
  }

  // Warn too much rather than too little: the other platform's elevator still gets a warning,
  // in case we have the direction wrong.
  const effect = platform === 'yours' ? 'blocked' : platform === 'other' ? 'warning' : 'unknown'
  return { effect, legIndex, reason: { code: 'elevator-out', stationId, deviceId, platform } }
}
