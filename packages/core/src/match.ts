import { distanceMeters } from './geo.ts'
import type { StationId } from './ids.ts'
import { normalizeName, parseHeadsign } from './names.ts'
import type { Registry, Station } from './registry.ts'
import type { TransitStop } from './route.ts'

/** How far a routing stop may be from a station's registered position and still match it. */
export const MATCH_RADIUS_M = 150

const namesOf = (station: Station) => [station.name, ...station.aliases].map(normalizeName)

/**
 * Finds the station a routing stop refers to (ADR 0006): every station within the radius is a
 * candidate; a candidate whose name matches wins, otherwise the nearest one does. Returns null
 * rather than guessing when nothing is close enough.
 */
export function matchStop(
  stop: TransitStop,
  registry: Registry,
  radiusM: number = MATCH_RADIUS_M,
): Station | null {
  const name = normalizeName(stop.name)
  let best: { station: Station; distance: number; nameMatches: boolean } | null = null

  for (const station of registry.stations) {
    const distance = distanceMeters(stop.location, station.location)
    if (distance > radiusM) continue
    const nameMatches = namesOf(station).includes(name)
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
 * (ADR 0006). Returns null when the headsign isn't a known terminal, e.g. a short-turn train.
 */
export function resolveTerminal(headsign: string | null, registry: Registry): StationId | null {
  if (headsign === null) return null
  const destination = normalizeName(parseHeadsign(headsign).destination)
  const terminals = new Set(registry.lines.flatMap((line) => line.terminals))

  for (const station of registry.stations) {
    if (terminals.has(station.id) && namesOf(station).includes(destination)) return station.id
  }
  return null
}
