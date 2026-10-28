import { describe, expect, it } from 'vitest'
import { decodePolyline } from './polyline.ts'

describe('decodePolyline', () => {
  // The worked example from Google's polyline algorithm documentation.
  it("decodes Google's documented example", () => {
    expect(decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@')).toEqual([
      [-120.2, 38.5],
      [-120.95, 40.7],
      [-126.453, 43.252],
    ])
  })

  it('returns [lng, lat] pairs for a Santiago point', () => {
    // Encodes (-33.4378, -70.6505).
    const [point] = decodePolyline('fyakEr|enL')
    expect(point?.[0]).toBeCloseTo(-70.6505, 4)
    expect(point?.[1]).toBeCloseTo(-33.4378, 4)
  })

  it('returns nothing for an empty string', () => {
    expect(decodePolyline('')).toEqual([])
  })

  it('stops at a truncated string instead of inventing a point', () => {
    expect(decodePolyline('_p~iF~ps|U_ulL')).toEqual([[-120.2, 38.5]])
  })
})
