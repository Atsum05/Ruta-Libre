import { describe, expect, it } from 'vitest'
import { normalizeName, parseHeadsign } from './names.ts'

describe('normalizeName', () => {
  it.each([
    ['Chile-España', 'chile espana'],
    ['Los Héroes', 'los heroes'],
    ['  ÑUBLE ', 'nuble'],
    ['Estación Baquedano', 'baquedano'],
    ['Metro Irarrázaval', 'irarrazaval'],
    ['Pza. de Puente Alto', 'pza de puente alto'],
  ])('%j → %j', (input, expected) => {
    expect(normalizeName(input)).toBe(expected)
  })
})

describe('parseHeadsign', () => {
  it('returns a plain headsign unchanged', () => {
    expect(parseHeadsign('Los Dominicos')).toEqual({
      destination: 'Los Dominicos',
      expressRoute: null,
    })
  })

  it.each([
    ['La Cisterna (Ruta Roja)', 'roja'],
    ['Vespucio Norte (ruta verde)', 'verde'],
  ] as const)('extracts the express route from %j', (headsign, route) => {
    expect(parseHeadsign(headsign).expressRoute).toBe(route)
  })

  it('removes any other trailing note without inventing a route', () => {
    expect(parseHeadsign('Plaza de Maipú (Expreso)')).toEqual({
      destination: 'Plaza de Maipú',
      expressRoute: null,
    })
  })
})

describe('parseHeadsign edge cases', () => {
  it.each([
    ['  La Cisterna (Ruta Roja)  ', 'La Cisterna', 'roja'],
    ['A (b) (Ruta Verde)', 'A (b)', 'verde'],
    ['Tobalaba (a) b)', 'Tobalaba (a) b)', null],
    ['Los Héroes ()', 'Los Héroes', null],
    ['(Ruta Roja)', '', 'roja'],
    ['Sin paréntesis', 'Sin paréntesis', null],
  ] as const)('%j → %j, %j', (headsign, destination, expressRoute) => {
    expect(parseHeadsign(headsign)).toEqual({ destination, expressRoute })
  })

  // Regression for a CodeQL alert: the old regex took ~2 s on 80 KB of "((" (quadratic).
  it('stays fast on crafted input from the routing provider', () => {
    const n = 200_000
    const started = Date.now()
    parseHeadsign(`a${' '.repeat(n)}x`)
    parseHeadsign(`(${'(('.repeat(n)}`)
    parseHeadsign(`${'('.repeat(n)})`)
    expect(Date.now() - started).toBeLessThan(200)
  })
})
