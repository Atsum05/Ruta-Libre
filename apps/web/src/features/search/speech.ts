// The Web Speech API isn't in TypeScript's DOM types; this is the small part we use. It runs in
// the browser with no key; in Chrome, audio may be sent to Google (disclosed in DATA_SOURCES.md).

interface RecognitionEvent {
  results: ArrayLike<ArrayLike<{ transcript: string }>>
}

interface Recognition {
  lang: string
  interimResults: boolean
  onresult: ((e: RecognitionEvent) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
  start(): void
}

type RecognitionConstructor = new () => Recognition

function recognitionConstructor(): RecognitionConstructor | undefined {
  if (typeof window === 'undefined') return undefined
  const w = window as unknown as Record<string, RecognitionConstructor | undefined>
  return w['SpeechRecognition'] ?? w['webkitSpeechRecognition']
}

export const speechSupported = () => recognitionConstructor() !== undefined

/** Listens once and resolves with what was said, or null if nothing was understood. */
export function listenOnce(lang: string): Promise<string | null> {
  const Ctor = recognitionConstructor()
  if (!Ctor) return Promise.resolve(null)
  return new Promise((resolve) => {
    const r = new Ctor()
    let heard: string | null = null
    r.lang = lang
    r.interimResults = false
    r.onresult = (e) => {
      heard = e.results[0]?.[0]?.transcript ?? null
    }
    r.onerror = () => resolve(null)
    r.onend = () => resolve(heard)
    r.start()
  })
}
