import { describe, expect, it } from 'vitest'
import { bus, metro, route, S, walk } from './__fixtures__/network.ts'
import { adjustedDurationSeconds, adjustWalkingTime, WALKING_FACTOR } from './walking.ts'

describe('adjustWalkingTime', () => {
  it('scales walking by 1.5 by default (~0.9 m/s instead of Google’s ~1.4 m/s)', () => {
    expect(WALKING_FACTOR).toBe(1.5)
    expect(adjustWalkingTime(600)).toBe(900)
  })

  it('accepts a custom factor', () => {
    expect(adjustWalkingTime(600, 2)).toBe(1200)
  })

  it('rounds to whole seconds', () => {
    expect(adjustWalkingTime(7)).toBe(11)
  })

  it.each([0.5, Number.NaN, Number.POSITIVE_INFINITY])('rejects the factor %d', (factor) => {
    expect(() => adjustWalkingTime(60, factor)).toThrow(RangeError)
  })
})

describe('adjustedDurationSeconds', () => {
  it('stretches only the walking legs, not time on board', () => {
    const r = route(walk(300), metro(S.uChile, S.losHeroes, 'San Pablo', 'L1', 600), walk(100))
    // 1000 s total; 400 s walking becomes 600 s.
    expect(adjustedDurationSeconds(r)).toBe(1200)
  })

  it('keeps waiting time that the provider included in the total', () => {
    const r = { ...route(walk(100), bus('210', 600)), durationSeconds: 1000 }
    expect(adjustedDurationSeconds(r)).toBe(1050)
  })
})
