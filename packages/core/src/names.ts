/**
 * Folds a station name for comparison: lower case, no accents, punctuation as spaces, and no
 * "Estación"/"Metro" prefix. Google and Metro spell names differently ("Chile-España" vs
 * "Chile España"), so names only ever break ties between stations matched by location (ADR 0006).
 */
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/^(estacion|metro) /, '')
}

export interface Headsign {
  /** Where the train is heading, with any service note removed. */
  readonly destination: string
  /** Rush-hour express service on L2/L4/L5, if the headsign names one. */
  readonly expressRoute: 'roja' | 'verde' | null
}

/**
 * Splits "La Cisterna (Ruta Roja)" into its destination and express route. The suffix must be
 * removed before comparing directions, or the comparison always fails (prototype lesson).
 */
export function parseHeadsign(headsign: string): Headsign {
  // Parsed with string operations, not a regex: headsigns come from the routing provider, and a
  // pattern like /\s*\(([^)]*)\)\s*$/ backtracks quadratically on crafted input (CodeQL).
  const text = headsign.trim()
  const open = text.lastIndexOf('(')
  const hasNote = open !== -1 && text.endsWith(')') && text.indexOf(')', open) === text.length - 1
  if (!hasNote) return { destination: text, expressRoute: null }

  const note = normalizeName(text.slice(open + 1, -1))
  return {
    destination: text.slice(0, open).trimEnd(),
    expressRoute: note === 'ruta roja' ? 'roja' : note === 'ruta verde' ? 'verde' : null,
  }
}
