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
