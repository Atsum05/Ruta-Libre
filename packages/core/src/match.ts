import { distanceMeters } from './geo.ts'
import type { StationId } from './ids.ts'
import { normalizeName, parseHeadsign } from './names.ts'
import type { Registry, Station } from './registry.ts'
import type { TransitStop } from './route.ts'

/** How far a routing stop may be from a station's registered position and still match it. */
export const MATCH_RADIUS_M = 150

/**
 * How far a stop may be when it is on the station's line and has the station's name. In a
 * transfer complex a line's platforms can be 300 m from the station's single registered point
 * (Irarrázaval Line 5: 232 m; Los Leones Line 6: 309 m), still well under the spacing between
 * two stations of one line.
 */
export const NAMED_MATCH_RADIUS_M = 500

export interface MatchOptions {
  /** The leg's line, as a registry line ID ("L1"). Only stations on that line can match. */
  readonly line?: string
  readonly radiusM?: number
  /** The radius for a station on the leg's line that has the stop's name. */
  readonly namedRadiusM?: number
}

const namesOf = (station: Station) => [station.name, ...station.aliases].map(normalizeName)

// A line the registry doesn't know (a bus, a new line) gives no constraint rather than no match.
function knownLine(registry: Registry, line: string | undefined): string | undefined {
  return line !== undefined && registry.lines.some((l) => l.id === line) ? line : undefined
}

/**
 * Finds the station a routing stop refers to (ADR 0006, 0011). Candidates are the stations on the
 * leg's line within the radius: at a transfer station each line has its own entry a few metres
 * apart, so position alone can't tell them apart. Among candidates, a matching name wins,
 * otherwise the nearest. With the line known, a station with the stop's name may be further away,
 * since its platforms can be far from its registered point. Returns null rather than guessing
 * when nothing qualifies.
 */
export function matchStop(
  stop: TransitStop,
  registry: Registry,
  options: MatchOptions = {},
): Station | null {
  const radiusM = options.radiusM ?? MATCH_RADIUS_M
  const namedRadiusM = Math.max(radiusM, options.namedRadiusM ?? NAMED_MATCH_RADIUS_M)
  const line = knownLine(registry, options.line)
  const name = normalizeName(stop.name)
  let best: { station: Station; distance: number; nameMatches: boolean } | null = null

  for (const station of registry.stations) {
    if (line !== undefined && !station.lines.includes(line)) continue
    const distance = distanceMeters(stop.location, station.location)
    const nameMatches = namesOf(station).includes(name)
    const limit = line !== undefined && nameMatches ? namedRadiusM : radiusM
    // `!(d <= r)` also skips NaN: a stop without real coordinates must never match.
    if (!(distance <= limit)) continue
    const better =
      best === null ||
      (nameMatches && !best.nameMatches) ||
      (nameMatches === best.nameMatches && distance < best.distance)
    if (better) best = { station, distance, nameMatches }
  }
  return best?.station ?? null
}

/**
 * Turns a vehicle headsign into the terminal station it names, so directions are compared by ID
 * (ADR 0006). With a known line, only that line's terminals count. Returns null when the headsign
 * isn't one of them, e.g. a short-turn train.
 */
export function resolveTerminal(
  headsign: string | null,
  registry: Registry,
  line?: string,
): StationId | null {
  if (headsign === null) return null
  const destination = normalizeName(parseHeadsign(headsign).destination)
  const onLine = knownLine(registry, line)
  const terminals = new Set(
    registry.lines
      .filter((l) => onLine === undefined || l.id === onLine)
      .flatMap((l) => l.terminals),
  )

  for (const station of registry.stations) {
    if (terminals.has(station.id) && namesOf(station).includes(destination)) return station.id
  }
  return null
}
