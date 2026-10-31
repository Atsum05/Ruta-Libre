import { type DeviceKind, normalizeName, type StationId } from '@rutalibre/core'

export interface TerminalName {
  readonly stationId: StationId
  /** Normalised with core's normalizeName. */
  readonly name: string
}

export interface ParsedDirections {
  /** Terminals named after "dirección", in order of first mention, without duplicates. */
  readonly towards: readonly StationId[]
  /** What followed a "dirección" that matched no terminal, for the report. */
  readonly unrecognised: readonly string[]
}

/**
 * Reads which platforms a device serves from its live-status text, e.g. "Ascensor Andén Línea 1
 * dirección San Pablo e Intermedio" → San Pablo. Texts can name several platforms; each
 * "dirección" is followed by a terminal and then free text, so terminals are matched as prefixes,
 * longest first ("Plaza de Puente Alto" before "Puente Alto").
 */
export function parseDirections(
  text: string,
  terminals: readonly TerminalName[],
): ParsedDirections {
  const byLength = [...terminals].sort((a, b) => b.name.length - a.name.length)
  const towards: StationId[] = []
  const unrecognised: string[] = []

  for (const after of normalizeName(text).split(' direccion ').slice(1)) {
    const match = byLength.find((t) => after === t.name || after.startsWith(`${t.name} `))
    if (!match) {
      unrecognised.push(after.split(' ').slice(0, 4).join(' '))
    } else if (!towards.includes(match.stationId)) {
      towards.push(match.stationId)
    }
  }
  return { towards, unrecognised }
}

/** The live feed's `tipo`: "ascensor" is an elevator, "escalera" an escalator. */
export function deviceKind(tipo: string): DeviceKind | null {
  if (tipo === 'ascensor') return 'elevator'
  if (tipo === 'escalera') return 'escalator'
  return null
}

// Anchored at both ends and tested against one word only, so it can't backtrack (CodeQL).
const LINE_TAG = /^L\d+[A-Za-z]?$/

/** The catalogue disambiguates some names per line ("Plaza Egaña L3"); riders say "Plaza Egaña". */
export function displayName(catalogueName: string): string {
  const name = catalogueName.trimEnd()
  const lastSpace = Math.max(name.lastIndexOf(' '), name.lastIndexOf('\t'))
  if (lastSpace === -1 || !LINE_TAG.test(name.slice(lastSpace + 1))) return catalogueName
  return name.slice(0, lastSpace).trimEnd()
}

/**
 * The two places a device connects, from its live-status text, as a stable key: "Ascensor de
 * acceso ubicado en Av. X hacia Boletería" → "boleteria <-> calle". Elevators run both ways, so
 * the ends are sorted. Every street entrance counts as "calle": two entrance elevators into the
 * same ticket hall do the same job, even from different corners (ADR 0015). Returns undefined
 * when the text doesn't follow the "X hacia Y" pattern (about 1% of devices).
 */
export function connectionKey(text: string): string | undefined {
  let t = normalizeName(text).replace(
    /^(ascensor|escalera mecanica)( de acceso| de combinacion)?( \d+[ns]?)?( de acceso)? /,
    '',
  )
  if (t.startsWith('ubicado en ')) {
    const at = t.indexOf(' hacia ')
    if (at === -1) return undefined
    t = `calle${t.slice(at)}`
  }
  if (t.startsWith('desde ')) t = t.slice('desde '.length)
  const at = t.indexOf(' hacia ')
  if (at <= 0) return undefined
  const from = t.slice(0, at).trim()
  const to = t
    .slice(at + ' hacia '.length)
    .split(/ y hacia | hacia /)
    .map((p) => p.trim())
    .filter(Boolean)
    .sort()
    .join(' + ')
  if (!from || !to) return undefined
  return [from, to].sort().join(' <-> ')
}
