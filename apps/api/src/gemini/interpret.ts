import { z } from 'zod'
import { requestJson, UpstreamError } from '../http/request.ts'
import type { LanguageProvider } from '../providers.ts'

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'

// Lessons from the prototype: tell the model the user always has reduced mobility, and to name
// places that sound like stations "Metro <name>": both improved geocoding a lot. The prototype
// also extracted a "need" (wheelchair, cane…) that nothing used; it's not asked for any more.
const INSTRUCTION = [
  'Extrae de la consulta del usuario el origen y el destino de un viaje en transporte público.',
  'Si no menciona origen, origin debe ser cadena vacía.',
  'Los lugares están en Santiago de Chile; devuelve los nombres tal como se buscarían en un mapa.',
  'Si un lugar es o suena a una estación de Metro de Santiago, devuélvelo como "Metro <nombre>".',
  'El usuario siempre tiene movilidad reducida; no lo incluyas en la respuesta.',
].join(' ')

const ModelOutputSchema = z.object({
  origin: z.string().max(200),
  destination: z.string().trim().min(1).max(200),
})

const ResponseSchema = z.object({
  candidates: z
    .array(z.object({ content: z.object({ parts: z.array(z.object({ text: z.string() })) }) }))
    .min(1),
})

export interface GeminiOptions {
  readonly apiKey: string
  readonly model: string
  readonly timeoutMs: number
  readonly fetchFn?: typeof fetch
}

/** Free text → trip intent with Gemini, forced to JSON and validated (roadmap phase 6). */
export class GeminiLanguageProvider implements LanguageProvider {
  readonly #options: GeminiOptions

  constructor(options: GeminiOptions) {
    this.#options = options
  }

  async interpret(text: string) {
    const { apiKey, model, timeoutMs, fetchFn } = this.#options
    const json = await requestJson(
      `${API_BASE}/${encodeURIComponent(model)}:generateContent`,
      {
        method: 'POST',
        // In a header: the prototype put the key in the URL, where it ends up in logs.
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          contents: [{ parts: [{ text }] }],
          systemInstruction: { parts: [{ text: INSTRUCTION }] },
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: 'OBJECT',
              properties: { origin: { type: 'STRING' }, destination: { type: 'STRING' } },
              required: ['origin', 'destination'],
            },
          },
        }),
      },
      // No retry: the user is waiting, and the search fields are the fallback.
      { timeoutMs, ...(fetchFn && { fetchFn }) },
    )

    const response = ResponseSchema.safeParse(json)
    const raw = response.success ? response.data.candidates[0]?.content.parts[0]?.text : undefined
    let output: unknown
    try {
      output = JSON.parse(raw ?? '')
    } catch {
      throw new UpstreamError('Gemini: no JSON in the response')
    }
    const parsed = ModelOutputSchema.safeParse(output)
    if (!parsed.success) throw new UpstreamError('Gemini: response did not match the schema')
    const origin = parsed.data.origin.trim()
    return { origin: origin === '' ? null : origin, destination: parsed.data.destination }
  }
}
