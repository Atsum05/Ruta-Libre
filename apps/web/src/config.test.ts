import { describe, expect, it } from 'vitest'
import { parseWebConfig, WebConfigError } from './config.ts'

describe('parseWebConfig', () => {
  it('reads the Maps key and optional map ID', () => {
    expect(
      parseWebConfig({ VITE_GOOGLE_MAPS_KEY: 'key123', VITE_GOOGLE_MAPS_MAP_ID: 'map1' }),
    ).toEqual({ googleMapsKey: 'key123', googleMapsMapId: 'map1' })
  })

  it('treats the map ID as optional', () => {
    expect(parseWebConfig({ VITE_GOOGLE_MAPS_KEY: 'key123' }).googleMapsMapId).toBeUndefined()
  })

  it.each([
    ['missing', {}],
    ['empty', { VITE_GOOGLE_MAPS_KEY: '' }],
  ])('rejects a %s Maps key', (_label, env) => {
    expect(() => parseWebConfig(env)).toThrow(WebConfigError)
  })

  // Regression: the prototype's BOM-in-the-key bug (docs/PROTOTYPE_LESSONS.md).
  it('rejects a key containing a BOM', () => {
    expect(() => parseWebConfig({ VITE_GOOGLE_MAPS_KEY: '﻿key123' })).toThrow(/BOM/)
  })

  it('rejects a key with surrounding whitespace', () => {
    expect(() => parseWebConfig({ VITE_GOOGLE_MAPS_KEY: ' key123' })).toThrow(WebConfigError)
  })
})
