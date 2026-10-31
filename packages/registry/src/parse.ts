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
