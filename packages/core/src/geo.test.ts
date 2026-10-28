import { describe, expect, it } from 'vitest'
import { distanceMeters } from './geo.ts'

describe('distanceMeters', () => {
  it('is zero for the same point', () => {
    expect(distanceMeters({ lat: -33.44, lng: -70.65 }, { lat: -33.44, lng: -70.65 })).toBe(0)
  })

  it('measures 0.001° of latitude as about 111 m', () => {
    const d = distanceMeters({ lat: -33.444, lng: -70.65 }, { lat: -33.445, lng: -70.65 })
    expect(d).toBeCloseTo(111.2, 0)
  })

  it('is symmetric', () => {
    const a = { lat: -33.4462, lng: -70.6603 }
    const b = { lat: -33.408, lng: -70.5452 }
    expect(distanceMeters(a, b)).toBeCloseTo(distanceMeters(b, a), 6)
  })
})
