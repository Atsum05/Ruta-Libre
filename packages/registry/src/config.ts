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
 * Corrections to catalogue positions that are demonstrably wrong, each with its evidence. Keyed
 * by station code. Replace with official coordinates (DTPM GTFS) when available.
 */
export const COORDINATE_FIXES: Readonly<Record<string, { lat: number; lng: number; why: string }>> =
  {
    BA: {
      // Line 1 Baquedano shares Plaza Italia with Line 5 (BQ), a transfer station.
      lat: -33.4372174,
      lng: -70.6334109,
      why: 'Catalogue point was 682 m east of Plaza Italia, 834 m from Salvador; moved onto the Line 5 (BQ) point of the same transfer station.',
    },
    // The following come from OpenStreetMap station nodes (ODbL, credited on the map), each of
    // which sits on its line where the catalogue point was far off.
    SA: {
      lat: -33.4327195,
      lng: -70.6260885,
      why: 'OpenStreetMap node 520459156 (Salvador), on Line 1; the catalogue point was 665 m away.',
    },
    LM: {
      lat: -33.4448711,
      lng: -70.6548709,
      why: 'OpenStreetMap node 3391796062 (La Moneda), on Line 1; the catalogue point was 157 m away.',
    },
    LE: {
      lat: -33.422019,
      lng: -70.6085607,
      why: 'OpenStreetMap node 5227884071 (Los Leones), on Line 1; the catalogue point was 159 m away.',
    },
    LVA: {
      lat: -33.4784048,
      lng: -70.6809001,
      why: 'OpenStreetMap node 3670590083 (Lo Valledor), on Line 6; the catalogue point was 135 m away.',
    },
    PAC: {
      lat: -33.4786906,
      lng: -70.6647874,
      why: 'OpenStreetMap node 601268662 (Presidente Pedro Aguirre Cerda), on Line 6; the catalogue point was 1.6 km away, near Lo Valledor.',
    },
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
}
