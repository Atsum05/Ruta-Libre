import { normalizeName, StationId } from '@rutalibre/core'
import { describe, expect, it } from 'vitest'
import { deviceKind, displayName, parseDirections, type TerminalName } from './parse.ts'

const terminal = (id: string, name: string): TerminalName => ({
  stationId: StationId(id),
  name: normalizeName(name),
})
const TERMINALS = [
  terminal('SP', 'San Pablo'),
  terminal('LD', 'Los Dominicos'),
  terminal('PPA', 'Plaza de Puente Alto'),
  terminal('PPA', 'Puente Alto'),
  terminal('VV', 'Vicente Valdés'),
]

describe('parseDirections', () => {
  it('reads the platform from a real live-status text', () => {
    expect(
      parseDirections('Ascensor Andén Línea 1 dirección San Pablo e Intermedio', TERMINALS),
    ).toEqual({
      towards: ['SP'],
      unrecognised: [],
    })
  })

  it('finds every platform a device serves', () => {
    const text =
      'Ascensor Andén Línea 1 dirección Los Dominicos hacia combinación Línea 1 dirección San Pablo'
    expect(parseDirections(text, TERMINALS).towards).toEqual(['LD', 'SP'])
  })

  it('lists a repeated terminal once', () => {
    const text = 'Ascensor dirección San Pablo y hacia andén dirección San Pablo'
    expect(parseDirections(text, TERMINALS).towards).toEqual(['SP'])
  })

  it('prefers the longest terminal name', () => {
    expect(parseDirections('Ascensor dirección Plaza de Puente Alto', TERMINALS).towards).toEqual([
      'PPA',
    ])
  })

  it('tolerates accents, case and trailing punctuation from the feed', () => {
    expect(parseDirections('Ascensor andén DIRECCIÓN Vicente Váldes.', TERMINALS).towards).toEqual([
      'VV',
    ])
  })

  it('reports what follows an unrecognised "dirección"', () => {
    expect(parseDirections('Ascensor dirección Neptuno hacia la calle y más', TERMINALS)).toEqual({
      towards: [],
      unrecognised: ['neptuno hacia la calle'],
    })
  })

  it('returns nothing for an access device with no direction', () => {
    expect(
      parseDirections('Ascensor de acceso ubicado en Av. Suecia hacia Intermedio', TERMINALS),
    ).toEqual({ towards: [], unrecognised: [] })
  })

  it('does not match a terminal name that is only a prefix of another word', () => {
    expect(parseDirections('Ascensor dirección San Pablos', TERMINALS).towards).toEqual([])
  })
})

describe('deviceKind', () => {
  it.each([
    ['ascensor', 'elevator'],
    ['escalera', 'escalator'],
    ['rampa', null],
  ])('%s → %s', (tipo, kind) => {
    expect(deviceKind(tipo)).toBe(kind)
  })
})

describe('displayName', () => {
  it.each([
    ['Plaza Egaña L3', 'Plaza Egaña'],
    ['Línea 4a', 'Línea 4a'],
    ['Los Héroes', 'Los Héroes'],
  ])('%j → %j', (input, expected) => {
    expect(displayName(input)).toBe(expected)
  })
})

describe('displayName edge cases', () => {
  it.each([
    ['Plaza de Armas L3', 'Plaza de Armas'],
    ['Vicuña Mackenna L4a', 'Vicuña Mackenna'],
    ['Universidad de Chile  L3  ', 'Universidad de Chile'],
    ['L3', 'L3'],
    ['Línea Larga', 'Línea Larga'],
    ['Estación L3x5', 'Estación L3x5'],
  ])('%j → %j', (input, expected) => {
    expect(displayName(input)).toBe(expected)
  })

  // Regression for a CodeQL alert: the old /\s+L\d+[A-Za-z]?$/ backtracked on long runs of spaces.
  it('stays fast on a long run of spaces', () => {
    const started = performance.now()
    displayName(`a${' '.repeat(200_000)}x`)
    expect(performance.now() - started).toBeLessThan(200)
  })
})
