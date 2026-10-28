import { describe, expect, it } from 'vitest'
import { formatAge } from './format.ts'
import { en } from './i18n/en.ts'
import { es } from './i18n/es.ts'
import { format, translator } from './i18n/index.tsx'

describe('message catalogues', () => {
  it('have exactly the same keys in Spanish and English', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(es).sort())
  })

  it('use the same placeholders in both languages', () => {
    const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()
    for (const key of Object.keys(es) as (keyof typeof es)[]) {
      expect(placeholders(en[key]), key).toEqual(placeholders(es[key]))
    }
  })

  it('have no empty messages', () => {
    for (const [key, value] of [...Object.entries(es), ...Object.entries(en)]) {
      expect(value.trim(), key).not.toBe('')
    }
  })
})

describe('format', () => {
  it('fills placeholders', () => {
    expect(format('{a} y {b}', { a: 1, b: 'dos' })).toBe('1 y dos')
  })

  it('leaves a missing placeholder visible instead of dropping it', () => {
    expect(format('hace {age}')).toBe('hace {age}')
  })
})

describe('formatAge', () => {
  const t = translator('es')
  it.each([
    [40, '40 s'],
    [125, '2 min'],
    [3 * 3600 + 59, '3 h'],
    [11 * 86_400 + 5, '11 días'],
    [-5, '0 s'],
  ])('%d s → %s', (seconds, text) => {
    expect(formatAge(seconds, t)).toBe(text)
  })
})
