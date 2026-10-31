// The Web Speech API isn't in TypeScript's DOM types; this is the small part we use. It runs in
// the browser with no key; in Chrome, audio is sent to Google for recognition (DATA_SOURCES.md).
// Support varies: Chrome, Edge and Safari have it; Firefox doesn't; Brave and Opera expose it but
// fail with a "network" error because they don't ship Google's recognition service.

interface RecognitionEvent {
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal?: boolean }>
}

interface Recognition {
  lang: string
  interimResults: boolean
  onresult: ((e: RecognitionEvent) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
}

type RecognitionConstructor = new () => Recognition

function recognitionConstructor(): RecognitionConstructor | undefined {
  if (typeof window === 'undefined') return undefined
  const w = window as unknown as Record<string, RecognitionConstructor | undefined>
  return w['SpeechRecognition'] ?? w['webkitSpeechRecognition']
}

export const speechSupported = () => recognitionConstructor() !== undefined

/** Why dictation produced nothing, so the UI can say what to do about it. */
export type SpeechFailure =
  /** The person or the browser refused the microphone. */
  | 'not-allowed'
  /** Listening worked but nothing was said. */
  | 'no-speech'
  /** No microphone found. */
  | 'no-microphone'
  /** The browser has the API but recognition doesn't work (offline, Brave, Opera…). */
  | 'unavailable'

export type ListenResult =
  | { kind: 'heard'; text: string }
  | { kind: 'failed'; reason: SpeechFailure }

export interface Listening {
  readonly result: Promise<ListenResult>
  /** Stops listening and keeps what was heard so far. */
  stop(): void
}

function failureFor(error: string): SpeechFailure {
  if (error === 'not-allowed' || error === 'service-not-allowed') return 'not-allowed'
  if (error === 'no-speech' || error === 'aborted') return 'no-speech'
  if (error === 'audio-capture') return 'no-microphone'
  return 'unavailable'
}

/**
 * Starts listening. `onInterim` receives the text as it's recognised, so the person sees that
 * it's working; the result resolves once they stop talking or call stop(). Never rejects.
 */
export function listen(lang: string, onInterim?: (text: string) => void): Listening {
  const Ctor = recognitionConstructor()
  if (!Ctor) {
    return { result: Promise.resolve({ kind: 'failed', reason: 'unavailable' }), stop() {} }
  }
  const r = new Ctor()
  let text = ''
  let failure: SpeechFailure | null = null
  r.lang = lang
  r.interimResults = true

  const result = new Promise<ListenResult>((resolve) => {
    r.onresult = (e) => {
      text = Array.from(e.results, (alternatives) => alternatives[0]?.transcript ?? '')
        .join('')
        .trim()
      onInterim?.(text)
    }
    r.onerror = (e) => {
      failure = failureFor(e.error)
    }
    r.onend = () => {
      // Whatever was heard before an error or a stop still counts.
      if (text) resolve({ kind: 'heard', text })
      else resolve({ kind: 'failed', reason: failure ?? 'no-speech' })
    }
    try {
      r.start()
    } catch {
      resolve({ kind: 'failed', reason: 'unavailable' })
    }
  })
  return { result, stop: () => r.stop() }
}
