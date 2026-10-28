import { describe, expect, it } from 'vitest'
import { GeminiLanguageProvider } from './interpret.ts'

const reply = (text: string) => ({ candidates: [{ content: { parts: [{ text }] } }] })

function provider(body: unknown, seen: Request[] = []) {
  return new GeminiLanguageProvider({
    apiKey: 'test-key',
    model: 'gemini-3.1-flash-lite',
    timeoutMs: 1000,
    fetchFn: async (input, init) => {
      seen.push(new Request(input, init))
      return new Response(JSON.stringify(body))
    },
  })
}

describe('GeminiLanguageProvider', () => {
  it('keeps the key out of the URL (prototype bug #8) and forces a JSON schema', async () => {
    const seen: Request[] = []
    await provider(reply('{"origin":"","destination":"Metro Toesca"}'), seen).interpret(
      'llévame a Toesca',
    )
    expect(seen[0]?.url).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent',
    )
    expect(seen[0]?.headers.get('x-goog-api-key')).toBe('test-key')
    expect(await seen[0]?.json()).toMatchObject({
      generationConfig: { responseMimeType: 'application/json' },
    })
  })

  it('returns origin and destination', async () => {
    const out = await provider(
      reply('{"origin":"Metro San Joaquín","destination":"Hospital Sótero del Río"}'),
    ).interpret('de San Joaquín al Sótero del Río')
    expect(out).toEqual({ origin: 'Metro San Joaquín', destination: 'Hospital Sótero del Río' })
  })

  it('reports a missing origin as null, so the app uses the device location or asks', async () => {
    const out = await provider(reply('{"origin":" ","destination":"Metro Toesca"}')).interpret(
      'a Toesca',
    )
    expect(out.origin).toBeNull()
  })

  it.each([
    ['text that is not JSON', reply('Claro, te ayudo')],
    ['an empty destination', reply('{"origin":"","destination":""}')],
    ['no candidates', { candidates: [] }],
    ['a blocked prompt', { promptFeedback: { blockReason: 'SAFETY' } }],
  ])('fails on %s, so the app falls back to the search fields', async (_label, body) => {
    await expect(provider(body).interpret('…')).rejects.toThrow(/Gemini/)
  })
})
