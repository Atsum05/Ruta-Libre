import { describe, expect, it } from 'vitest'
import { buildRegistry, issueKey } from './build.ts'
import { COORDINATE_FIXES } from './config.ts'
import type { Catalogue, LiveDevices } from './schema.ts'

// A miniature network: L1 with both terminals and a transfer to L2 at Los Héroes.
type Point = [id: string, code: string, name: string, line: string, lat: number, lng: number]

function catalogue(points: Point[]): Catalogue {
  return {
    type: 'FeatureCollection',
    features: points.map(([equipo, estacion, nombre_estacion, linea, lat, lng]) => ({
      properties: { equipo, estacion, nombre_estacion, linea },
      geometry: { type: 'Point', coordinates: [lng, lat] },
    })),
  }
}

const BASE: Point[] = [
  ['SP-1', 'SP', 'San Pablo', 'Línea 1', -33.4447, -70.723],
  ['LD-1', 'LD', 'Los Dominicos', 'Línea 1', -33.408, -70.5452],
  ['LH-1', 'LH', 'Los Héroes', 'Línea 1', -33.4458, -70.6605],
  ['LH-2', 'LH', 'Los Héroes', 'Línea 1', -33.4458, -70.6605],
  ['HE-1', 'HE', 'Los Héroes', 'Línea 2', -33.4462, -70.6604],
  ['AV-1', 'AV', 'Vespucio Norte', 'Línea 2', -33.3807, -70.645],
  ['PI-1', 'PI', 'Hospital El Pino', 'Línea 2', -33.58, -70.62],
]

const LIVE: LiveDevices = {
  'SP-1': { estacion: 'SP', tipo: 'ascensor', texto: 'Ascensor de acceso' },
  'LD-1': { estacion: 'LD', tipo: 'ascensor', texto: 'Ascensor de acceso' },
  'LH-1': { estacion: 'LH', tipo: 'ascensor', texto: 'Ascensor de acceso calle' },
  'LH-2': { estacion: 'LH', tipo: 'ascensor', texto: 'Ascensor Andén Línea 1 dirección San Pablo' },
  'HE-1': {
    estacion: 'HE',
    tipo: 'ascensor',
    texto: 'Ascensor Andén Línea 2 dirección Hospital El Pino',
  },
  'AV-1': { estacion: 'AV', tipo: 'ascensor', texto: 'Ascensor de acceso' },
  'PI-1': { estacion: 'PI', tipo: 'escalera', texto: 'Escalera mecánica' },
}

const build = (points: Point[] = BASE, live: LiveDevices = LIVE) =>
  buildRegistry(catalogue(points), live)
const station = (code: string, points?: Point[], live?: LiveDevices) =>
  build(points, live).file.stations.find((s) => s.id === code)
// The fixture only has L1 and L2, so the other configured lines' terminals are always missing.
const kinds = (points?: Point[], live?: LiveDevices) =>
  build(points, live)
    .issues.filter((i) => !(i.kind === 'terminal-not-found' && !/^L[12]:/.test(i.subject)))
    .map(issueKey)

describe('buildRegistry', () => {
  it('builds one station per catalogue code, with its line and position', () => {
    expect(station('SP')).toMatchObject({
      name: 'San Pablo',
      lines: ['L1'],
      location: { lat: -33.4447, lng: -70.723 },
    })
  })

  it('resolves each line’s terminals to station codes', () => {
    expect(build().file.lines.find((l) => l.id === 'L1')).toEqual({
      id: 'L1',
      terminals: ['SP', 'LD'],
    })
  })

  it('classifies devices by kind and platform from the live texts', () => {
    expect(station('LH')?.devices).toEqual([
      {
        id: 'LH-1',
        kind: 'elevator',
        scope: { kind: 'station' },
        description: 'Ascensor de acceso calle',
      },
      {
        id: 'LH-2',
        kind: 'elevator',
        scope: { kind: 'platform', towards: ['SP'] },
        description: 'Ascensor Andén Línea 1 dirección San Pablo',
      },
    ])
    expect(station('PI')?.devices).toEqual([
      {
        id: 'PI-1',
        kind: 'escalator',
        scope: { kind: 'station' },
        description: 'Escalera mecánica',
      },
    ])
  })

  it('shares street-access devices across the codes of one transfer complex', () => {
    const l2 = station('HE')?.devices.map((d) => d.id)
    expect(l2).toEqual(['HE-1', 'LH-1'])
  })

  it('does not share platform devices across lines', () => {
    expect(station('HE')?.devices.map((d) => d.id)).not.toContain('LH-2')
  })

  it('marks a device with an unrecognised direction as unknown scope', () => {
    const live = {
      ...LIVE,
      'LH-2': { ...LIVE['LH-2'], texto: 'Ascensor dirección Neptuno' },
    } as LiveDevices
    expect(station('LH', BASE, live)?.devices.find((d) => d.id === 'LH-2')?.scope).toEqual({
      kind: 'unknown',
    })
    expect(kinds(BASE, live)).toContain('direction-unrecognised:LH-2')
  })

  it('strips the per-line suffix from names and keeps the original as an alias', () => {
    const points: Point[] = [...BASE, ['PE-1', 'PZE', 'Plaza Egaña L3', 'Línea 3', -33.45, -70.57]]
    const live = { ...LIVE, 'PE-1': { estacion: 'PZE', tipo: 'ascensor', texto: '' } }
    expect(station('PZE', points, live)).toMatchObject({
      name: 'Plaza Egaña',
      aliases: ['Plaza Egaña L3'],
    })
  })

  it('links devices that make the same trip, scoped to their own station code (ADR 0015)', () => {
    const points: Point[] = [
      ...BASE,
      ['LH-3', 'LH', 'Los Héroes', 'Línea 1', -33.4458, -70.6605],
      ['HE-2', 'HE', 'Los Héroes', 'Línea 2', -33.4462, -70.6604],
    ]
    const live: LiveDevices = {
      ...LIVE,
      'LH-1': {
        estacion: 'LH',
        tipo: 'ascensor',
        texto: 'Ascensor de acceso ubicado en Av. Bernardo O’Higgins hacia Boletería ',
      },
      'LH-3': {
        estacion: 'LH',
        tipo: 'ascensor',
        texto: 'Ascensor 2 de acceso ubicado en Calle Manuel Rodríguez hacia Boletería',
      },
      'HE-2': {
        estacion: 'HE',
        tipo: 'ascensor',
        texto: 'Ascensor de acceso ubicado en Av. Norte Sur hacia Boletería',
      },
    }
    const devices = station('LH', points, live)?.devices ?? []
    const link = (id: string) => devices.find((d) => d.id === id)?.link
    // Two street entrances into one ticket hall: the same trip, so each backs the other up.
    expect(link('LH-1')).toBe('LH: boleteria <-> calle')
    expect(link('LH-3')).toBe(link('LH-1'))
    // The source text is kept for riders, trimmed.
    expect(devices.find((d) => d.id === 'LH-1')?.description).toBe(
      'Ascensor de acceso ubicado en Av. Bernardo O’Higgins hacia Boletería',
    )
    // Line 2’s own ticket hall is another place, even with the same words.
    const he2 = station('HE', points, live)?.devices.find((d) => d.id === 'HE-2')
    expect(he2?.link).toBe('HE: boleteria <-> calle')
    // A text without "X hacia Y" gets no link, so it never counts as a backup.
    expect(link('LH-2')).toBeUndefined()
  })

  it('moves a station with a known coordinate correction', () => {
    const points: Point[] = [...BASE, ['SA-1', 'SA', 'Salvador', 'Línea 1', -33.43, -70.62]]
    const live = { ...LIVE, 'SA-1': { estacion: 'SA', tipo: 'ascensor', texto: '' } }
    expect(station('SA', points, live)?.location).toEqual({
      lat: COORDINATE_FIXES['SA']?.lat,
      lng: COORDINATE_FIXES['SA']?.lng,
    })
  })

  describe('reports', () => {
    it('a catalogue device missing from the live feed, and leaves it out', () => {
      const { 'AV-1': _gone, ...live } = LIVE
      expect(kinds(BASE, live)).toEqual([
        'device-not-in-live-feed:AV-1',
        'station-without-elevator:AV',
        'station-without-elevator:PI',
      ])
      expect(station('AV', BASE, live)?.devices).toEqual([])
    })

    it('a live device whose station code is not in the catalogue', () => {
      const live = { ...LIVE, 'XX-1': { estacion: 'XX', tipo: 'ascensor', texto: '' } }
      expect(kinds(BASE, live)).toEqual([
        'device-station-unknown:XX-1',
        'station-without-elevator:PI',
      ])
    })

    it('a device of unknown kind', () => {
      const live = { ...LIVE, 'SP-1': { estacion: 'SP', tipo: 'rampa', texto: '' } }
      expect(kinds(BASE, live)).toContain('device-kind-unknown:SP-1')
    })

    it('a line missing from the config', () => {
      const points: Point[] = [...BASE, ['L9-1', 'NEW', 'Nueva', 'Línea 9', -33.4, -70.6]]
      expect(kinds(points)).toContain('line-unknown:Línea 9')
    })

    it('a configured terminal with no station', () => {
      const points = BASE.filter(([id]) => id !== 'LD-1')
      expect(kinds(points)).toContain('terminal-not-found:L1:Los Dominicos')
    })

    it('two codes with the same name on the same line', () => {
      const points: Point[] = [...BASE, ['SP-9', 'SP2', 'San Pablo', 'Línea 1', -33.4447, -70.723]]
      const live = { ...LIVE, 'SP-9': { estacion: 'SP2', tipo: 'ascensor', texto: '' } }
      expect(kinds(points, live)).toContain('duplicate-name:SP2')
    })

    it('a transfer complex whose codes are far apart', () => {
      const points = BASE.map(
        (p): Point => (p[0] === 'HE-1' ? ([...p.slice(0, 4), -33.4558, -70.6604] as Point) : p),
      )
      expect(kinds(points)).toContain('complex-far-apart:LH+HE')
    })

    it('a station with no elevator on record', () => {
      expect(kinds()).toEqual(['station-without-elevator:PI'])
    })
  })
})
