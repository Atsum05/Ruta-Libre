// A small slice of the Santiago network for tests: part of L1 and L2, meeting at Los Héroes.
// Coordinates are approximate; device IDs are made up. The real registry comes in Phase 4.

import { DeviceId, StationId } from '../ids.ts'
import type { Device, DeviceKind, DeviceScope, Registry, Station } from '../registry.ts'
import type { Leg, Route, TransitLeg, TransitStop } from '../route.ts'
import type { DeviceState, StatusSnapshot } from '../status.ts'

export const S = {
  sanPablo: StationId('san-pablo'),
  losHeroes: StationId('los-heroes'),
  uChile: StationId('universidad-de-chile'),
  santaLucia: StationId('santa-lucia'),
  losDominicos: StationId('los-dominicos'),
  toesca: StationId('toesca'),
  laCisterna: StationId('la-cisterna'),
  vespucioNorte: StationId('vespucio-norte'),
  parqueBustamante: StationId('parque-bustamante'),
}

const platform = (towards: StationId): DeviceScope => ({ kind: 'platform', towards })
const STATION_WIDE: DeviceScope = { kind: 'station' }
const UNKNOWN: DeviceScope = { kind: 'unknown' }

function device(id: string, kind: DeviceKind, scope: DeviceScope): Device {
  return { id: DeviceId(id), kind, scope }
}

function stationOf(
  id: StationId,
  name: string,
  lat: number,
  lng: number,
  lines: string[],
  devices: Device[],
  aliases: string[] = [],
): Station {
  return { id, name, location: { lat, lng }, lines, aliases, devices }
}

export const registry: Registry = {
  lines: [
    { id: 'L1', terminals: [S.sanPablo, S.losDominicos] },
    { id: 'L2', terminals: [S.vespucioNorte, S.laCisterna] },
  ],
  stations: [
    stationOf(
      S.sanPablo,
      'San Pablo',
      -33.4447,
      -70.723,
      ['L1', 'L5'],
      [device('SP-ACC', 'elevator', STATION_WIDE)],
    ),
    stationOf(
      S.losHeroes,
      'Los Héroes',
      -33.4462,
      -70.6603,
      ['L1', 'L2'],
      [
        device('LH-ACC', 'elevator', STATION_WIDE),
        device('LH-L1-LD', 'elevator', platform(S.losDominicos)),
        device('LH-L1-SP', 'elevator', platform(S.sanPablo)),
        device('LH-L2-LC', 'elevator', platform(S.laCisterna)),
        device('LH-L2-VN', 'elevator', platform(S.vespucioNorte)),
        device('LH-ESC-LD', 'escalator', platform(S.losDominicos)),
      ],
    ),
    stationOf(
      S.uChile,
      'Universidad de Chile',
      -33.444,
      -70.6506,
      ['L1', 'L3'],
      [
        device('UC-ACC', 'elevator', STATION_WIDE),
        device('UC-L1-LD', 'elevator', platform(S.losDominicos)),
        device('UC-L1-SP', 'elevator', platform(S.sanPablo)),
        device('UC-ESC', 'escalator', STATION_WIDE),
      ],
    ),
    stationOf(
      S.santaLucia,
      'Santa Lucía',
      -33.4426,
      -70.6447,
      ['L1'],
      [device('SL-ACC', 'elevator', STATION_WIDE), device('SL-UNK', 'elevator', UNKNOWN)],
    ),
    stationOf(
      S.losDominicos,
      'Los Dominicos',
      -33.408,
      -70.5452,
      ['L1'],
      [device('LD-ACC', 'elevator', STATION_WIDE)],
    ),
    stationOf(
      S.toesca,
      'Toesca',
      -33.4528,
      -70.658,
      ['L2'],
      [device('TO-ACC', 'elevator', STATION_WIDE)],
    ),
    stationOf(
      S.laCisterna,
      'La Cisterna',
      -33.5373,
      -70.6643,
      ['L2', 'L4A'],
      [device('LC-ACC', 'elevator', STATION_WIDE)],
    ),
    stationOf(
      S.vespucioNorte,
      'Vespucio Norte',
      -33.3807,
      -70.645,
      ['L2'],
      [device('VN-ACC', 'elevator', STATION_WIDE)],
    ),
    // Only an escalator is known here: we can't say a wheelchair user gets through.
    stationOf(
      S.parqueBustamante,
      'Parque Bustamante',
      -33.4436,
      -70.6327,
      ['L5'],
      [device('PB-ESC', 'escalator', STATION_WIDE)],
    ),
  ],
}

export function stationById(id: StationId): Station {
  const found = registry.stations.find((s) => s.id === id)
  if (!found) throw new Error(`no fixture station ${id}`)
  return found
}

/** The stop as a routing provider would report it: the station's name and position. */
export function stopAt(id: StationId, nameOverride?: string): TransitStop {
  const s = stationById(id)
  return { name: nameOverride ?? s.name, location: s.location }
}

export function metro(
  from: StationId,
  to: StationId,
  headsign: string | null,
  line = 'L1',
  durationSeconds = 300,
): TransitLeg {
  return { mode: 'metro', line, headsign, from: stopAt(from), to: stopAt(to), durationSeconds }
}

export function walk(durationSeconds: number): Leg {
  return { mode: 'walk', durationSeconds }
}

export function bus(line: string, durationSeconds = 600): TransitLeg {
  // Bus stops never match a Metro station; buses aren't evaluated (no live data, BRIEF non-goal).
  const nowhere: TransitStop = { name: 'Parada 6', location: { lat: -33.5, lng: -70.6 } }
  return { mode: 'bus', line, headsign: null, from: nowhere, to: nowhere, durationSeconds }
}

export function route(...legs: Leg[]): Route {
  return { legs, durationSeconds: legs.reduce((sum, leg) => sum + leg.durationSeconds, 0) }
}

export const NOW = Date.UTC(2026, 9, 28, 12, 0, 0)

/** Every fixture device working, fetched a minute ago, except the overrides. */
export function snapshot(
  overrides: Record<string, DeviceState | 'missing'> = {},
  fetchedAt = NOW - 60_000,
): StatusSnapshot {
  const devices = new Map<DeviceId, DeviceState>()
  for (const s of registry.stations) {
    for (const d of s.devices) {
      const state = overrides[d.id] ?? 'working'
      if (state !== 'missing') devices.set(d.id, state)
    }
  }
  return { fetchedAt, devices }
}
