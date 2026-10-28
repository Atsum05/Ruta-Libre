// Hand-maintained facts the source data doesn't state cleanly. Update when the network changes
// (e.g. when Line 7 opens): add the line, its catalogue name, and its terminals.

export interface LineConfig {
  /** Registry line ID; routing adapters map provider line names to these. */
  readonly id: string
  /** How the device catalogue's `linea` field names the line. */
  readonly catalogueName: string
  /** Station names the trains are signed towards, as the catalogue spells them. */
  readonly terminals: readonly [string, string]
}

export const LINES: readonly LineConfig[] = [
  { id: 'L1', catalogueName: 'Línea 1', terminals: ['San Pablo', 'Los Dominicos'] },
  { id: 'L2', catalogueName: 'Línea 2', terminals: ['Vespucio Norte', 'Hospital El Pino'] },
  {
    id: 'L3',
    catalogueName: 'Línea 3',
    terminals: ['Plaza Quilicura', 'Fernando Castillo Velasco'],
  },
  { id: 'L4', catalogueName: 'Línea 4', terminals: ['Tobalaba', 'Plaza de Puente Alto'] },
  { id: 'L4A', catalogueName: 'Línea 4a', terminals: ['Vicuña Mackenna', 'La Cisterna'] },
  { id: 'L5', catalogueName: 'Línea 5', terminals: ['Plaza de Maipú', 'Vicente Valdés'] },
  { id: 'L6', catalogueName: 'Línea 6', terminals: ['Cerrillos', 'Los Leones'] },
]

/**
 * Other ways the live-status texts write a terminal after "dirección". Keyed by the catalogue
 * spelling. Misspellings found in the feed are listed so they still resolve.
 */
export const TERMINAL_SPELLINGS: Readonly<Record<string, readonly string[]>> = {
  'Plaza de Puente Alto': ['Puente Alto'],
  'Fernando Castillo Velasco': ['Fernando Castillo Velazco'],
}

/**
 * Issues the build may report without failing, each with the reason it's acceptable.
 * Anything not listed here fails the build: zero unexplained exceptions (roadmap phase 4).
 */
export const EXPLAINED_ISSUES: Readonly<Record<string, string>> = {
  'device-not-in-live-feed:PQU-2791eb':
    'In the catalogue, absent from the live feed (sample 2026-10-16); kind unknown, so excluded. Plaza Quilicura keeps 4 elevators.',
  'device-not-in-live-feed:SJU-0eecb3':
    'In the catalogue, absent from the live feed (sample 2026-10-16); kind unknown, so excluded. Santa Julia keeps 4 elevators.',
  'device-not-in-live-feed:SJU-560044':
    'In the catalogue, absent from the live feed (sample 2026-10-16); kind unknown, so excluded. Santa Julia keeps 4 elevators.',
  'complex-far-apart:BQ+BA':
    'Baquedano L1/L5 points are 682 m apart in the catalogue; likely a coordinate error. Stops beyond 150 m stay unmatched (unknown, never fine). Recheck against DTPM GTFS stops.',
}
