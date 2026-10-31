import { describe, expect, it } from 'vitest'
import { GooglePlacesProvider } from './places.ts'

const SESSION = '7d0c2a5e-0000-4000-8000-000000000000'

function provider(body: unknown, seen: Request[] = []) {
  return new GooglePlacesProvider({
    apiKey: 'test-key',
    timeoutMs: 1000,
    fetchFn: async (input, init) => {
      seen.push(new Request(input, init))
      return new Response(JSON.stringify(body))
    },
  })
}

describe('GooglePlacesProvider', () => {
  it('biases to Santiago, sends the session token, and keeps the key out of the URL', async () => {
    const seen: Request[] = []
    await provider({ suggestions: [] }, seen).search('Toesca', SESSION)
    expect(seen[0]?.url).not.toContain('test-key')
    expect(seen[0]?.headers.get('x-goog-api-key')).toBe('test-key')
    expect(await seen[0]?.json()).toMatchObject({
      input: 'Toesca',
      sessionToken: SESSION,
      includedRegionCodes: ['cl'],
      locationBias: { circle: { center: { latitude: -33.45, longitude: -70.66 } } },
    })
  })

  it('maps place predictions to suggestions', async () => {
    const body = {
      suggestions: [
        {
          placePrediction: {
            placeId: 'ChIJ1',
            text: { text: 'Toesca, Santiago, Chile' },
            structuredFormat: {
              mainText: { text: 'Toesca' },
              secondaryText: { text: 'Santiago, Chile' },
            },
          },
        },
        { placePrediction: { placeId: 'ChIJ2', text: { text: 'Metro Toesca' } } },
        { queryPrediction: { text: { text: 'toesca restaurantes' } } },
      ],
    }
    await expect(provider(body).search('Toesca', SESSION)).resolves.toEqual([
      { placeId: 'ChIJ1', primary: 'Toesca', secondary: 'Santiago, Chile' },
      { placeId: 'ChIJ2', primary: 'Metro Toesca', secondary: null },
    ])
  })

  it('returns nothing when there are no suggestions', async () => {
    await expect(provider({}).search('zzzz', SESSION)).resolves.toEqual([])
  })

  it('fails on a response it cannot read', async () => {
    await expect(provider({ suggestions: 'x' }).search('Toesca', SESSION)).rejects.toThrow(
      'unexpected response format',
    )
  })
})
