import { z } from 'zod'
import { requestJson, UpstreamError } from '../http/request.ts'
import type { PlacesProvider } from '../providers.ts'

const AUTOCOMPLETE_URL = 'https://places.googleapis.com/v1/places:autocomplete'

// Santiago's urban area, roughly: suggestions near the city come first.
const SANTIAGO_BIAS = {
  circle: { center: { latitude: -33.45, longitude: -70.66 }, radius: 30_000 },
}

const ResponseSchema = z.object({
  suggestions: z
    .array(
      z.object({
        placePrediction: z
          .object({
            placeId: z.string(),
            text: z.object({ text: z.string() }).optional(),
            structuredFormat: z
              .object({
                mainText: z.object({ text: z.string() }),
                secondaryText: z.object({ text: z.string() }).optional(),
              })
              .optional(),
          })
          .optional(),
      }),
    )
    .optional(),
})

export interface GooglePlacesOptions {
  readonly apiKey: string
  readonly timeoutMs: number
  readonly fetchFn?: typeof fetch
}

/**
 * Place autocomplete via Places API (New). The session token groups one search's keystrokes for
 * billing; the client starts a new one per search (roadmap phase 6).
 */
export class GooglePlacesProvider implements PlacesProvider {
  readonly #options: GooglePlacesOptions

  constructor(options: GooglePlacesOptions) {
    this.#options = options
  }

  async search(query: string, session: string) {
    const { apiKey, timeoutMs, fetchFn } = this.#options
    const json = await requestJson(
      AUTOCOMPLETE_URL,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': apiKey },
        body: JSON.stringify({
          input: query,
          sessionToken: session,
          languageCode: 'es',
          regionCode: 'cl',
          includedRegionCodes: ['cl'],
          locationBias: SANTIAGO_BIAS,
        }),
      },
      { timeoutMs, retries: 1, ...(fetchFn && { fetchFn }) },
    )
    const parsed = ResponseSchema.safeParse(json)
    if (!parsed.success) throw new UpstreamError('Places API: unexpected response format')

    return (parsed.data.suggestions ?? []).flatMap(({ placePrediction: p }) => {
      if (!p) return [] // query predictions ("pizza near…") aren't places we can route to
      const primary = p.structuredFormat?.mainText.text ?? p.text?.text
      if (!primary) return []
      return [
        { placeId: p.placeId, primary, secondary: p.structuredFormat?.secondaryText?.text ?? null },
      ]
    })
  }
}
