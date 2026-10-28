import { describe, expect, it } from 'vitest'
import { registry, S, stationById } from './__fixtures__/network.ts'
import { StationId } from './ids.ts'
import { matchStop, resolveTerminal } from './match.ts'
import type { Registry } from './registry.ts'

describe('matchStop', () => {
  it('matches the nearest station within 150 m, whatever the name says', () => {
    const near = { name: 'Some other name', location: { lat: -33.4445, lng: -70.6507 } }
    expect(matchStop(near, registry)?.id).toBe(S.uChile)
  })

  it('returns null when no station is within the radius', () => {
    const far = { name: 'Universidad de Chile', location: { lat: -33.45, lng: -70.6506 } }
    expect(matchStop(far, registry)).toBeNull()
  })

  it('accepts a custom radius', () => {
    const at200m = { name: 'x', location: { lat: -33.4458, lng: -70.6506 } }
    expect(matchStop(at200m, registry)).toBeNull()
    expect(matchStop(at200m, registry, { radiusM: 250 })?.id).toBe(S.uChile)
  })

  describe('with the leg line (one registry entry per line at a transfer, ADR 0011)', () => {
    const l1 = { ...stationById(S.losHeroes), id: StationId('LH-L1'), lines: ['L1'] }
    const l2 = {
      ...stationById(S.losHeroes),
      id: StationId('LH-L2'),
      lines: ['L2'],
      location: { lat: -33.4466, lng: -70.6603 },
    }
    const transfer: Registry = { lines: registry.lines, stations: [l1, l2] }
    // Closer to the L1 entry, same name: only the line can decide.
    const stop = { name: 'Los Héroes', location: { lat: -33.4462, lng: -70.6603 } }

    it('only matches a station on that line', () => {
      expect(matchStop(stop, transfer, { line: 'L2' })?.id).toBe('LH-L2')
      expect(matchStop(stop, transfer, { line: 'L1' })?.id).toBe('LH-L1')
    })

    it('returns null when only another line is nearby, instead of borrowing its devices', () => {
      expect(matchStop(stop, { lines: registry.lines, stations: [l1] }, { line: 'L2' })).toBeNull()
    })

    it('ignores a line the registry does not know', () => {
      expect(matchStop(stop, transfer, { line: 'L9' })?.id).toBe('LH-L1')
    })
  })

  it('uses the name to break a tie between nearby stations', () => {
    // Two stations 60 m apart; the farther one has the matching name.
    const twin: Registry = {
      lines: [],
      stations: [
        { ...stationById(S.uChile), location: { lat: -33.444, lng: -70.65 } },
        {
          ...stationById(S.santaLucia),
          location: { lat: -33.4445, lng: -70.65 },
          aliases: ['Sta. Lucía'],
        },
      ],
    }
    const stop = { name: 'Sta Lucia', location: { lat: -33.4441, lng: -70.65 } }
    expect(matchStop(stop, twin)?.id).toBe(S.santaLucia)
  })
})

describe('resolveTerminal', () => {
  it('resolves a headsign to the terminal station', () => {
    expect(resolveTerminal('Los Dominicos', registry)).toBe(S.losDominicos)
  })

  it('ignores case and accents', () => {
    expect(resolveTerminal('LA CISTERNA', registry)).toBe(S.laCisterna)
    expect(resolveTerminal('San Pablo', registry)).toBe(S.sanPablo)
  })

  it('removes the express route suffix', () => {
    expect(resolveTerminal('La Cisterna (Ruta Verde)', registry)).toBe(S.laCisterna)
  })

  it('returns null for a station that is not a terminal', () => {
    expect(resolveTerminal('Los Héroes', registry)).toBeNull()
  })

  it("only accepts the leg line's own terminals", () => {
    expect(resolveTerminal('La Cisterna', registry, 'L2')).toBe(S.laCisterna)
    expect(resolveTerminal('La Cisterna', registry, 'L1')).toBeNull()
  })

  it('returns null for an unknown or missing headsign', () => {
    expect(resolveTerminal('Neptuno', registry)).toBeNull()
    expect(resolveTerminal(null, registry)).toBeNull()
  })
})
