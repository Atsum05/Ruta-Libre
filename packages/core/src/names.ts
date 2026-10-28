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

const SERVICE_SUFFIX = /\s*\(([^)]*)\)\s*$/

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
  const suffix = SERVICE_SUFFIX.exec(headsign)
  const note = suffix ? normalizeName(suffix[1] ?? '') : ''
  return {
    destination: suffix ? headsign.slice(0, suffix.index) : headsign.trim(),
    expressRoute: note === 'ruta roja' ? 'roja' : note === 'ruta verde' ? 'verde' : null,
  }
}
