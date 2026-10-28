import { describe, expect, it } from 'vitest'
import { registry, S, stationById } from './__fixtures__/network.ts'
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
    expect(matchStop(at200m, registry, 250)?.id).toBe(S.uChile)
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

  it('returns null for an unknown or missing headsign', () => {
    expect(resolveTerminal('Neptuno', registry)).toBeNull()
    expect(resolveTerminal(null, registry)).toBeNull()
  })
})
