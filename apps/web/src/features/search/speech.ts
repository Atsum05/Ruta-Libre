// The Web Speech API isn't in TypeScript's DOM types; this is the small part we use. It runs in
// the browser with no key; in Chrome, audio is sent to Google for recognition (DATA_SOURCES.md).
// Support varies: Chrome, Edge and Safari have it; Firefox doesn't; Brave and Opera expose it but
// fail with a "network" error because they don't ship Google's recognition service. Safari uses
// Apple's dictation: with dictation off or the microphone blocked, it can start "listening" and
// then never report a word, an error or an end, so listen() has its own time limits.

interface RecognitionEvent {
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal?: boolean }>
}

interface Recognition {
  lang: string
  interimResults: boolean
  onresult: ((e: RecognitionEvent) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
  /** Fires once the microphone is actually capturing. Not every browser sends it. */
  onaudiostart: (() => void) | null
  start(): void
  stop(): void
  abort(): void
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
  /** The browser said it was listening but the microphone never started (Safari, dictation off). */
  | 'no-audio'
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

/** Nothing heard by then: give up and say why, rather than "listening" forever. */
export const NOTHING_HEARD_MS = 8_000
/** Words heard, then this much quiet: treat it as the end (Safari may never end by itself). */
export const QUIET_AFTER_SPEECH_MS = 2_500
/** After asking the browser to stop, how long to wait for it to confirm before moving on. */
export const STOP_GRACE_MS = 1_500

function failureFor(error: string): SpeechFailure {
  if (error === 'not-allowed' || error === 'service-not-allowed') return 'not-allowed'
  if (error === 'no-speech' || error === 'aborted') return 'no-speech'
  if (error === 'audio-capture') return 'no-microphone'
  return 'unavailable'
}

/**
 * Starts listening. `onInterim` receives the text as it's recognised, so the person sees that
 * it's working; the result resolves once they stop talking or call stop(). Never rejects, and
 * always settles: the time limits above cover browsers that go silent.
 */
export function listen(lang: string, onInterim?: (text: string) => void): Listening {
  const Ctor = recognitionConstructor()
  if (!Ctor) {
    return { result: Promise.resolve({ kind: 'failed', reason: 'unavailable' }), stop() {} }
  }
  const r = new Ctor()
  let text = ''
  let failure: SpeechFailure | null = null
  let audioStarted = false
  let timer: ReturnType<typeof setTimeout> | undefined
  r.lang = lang
  r.interimResults = true

  let finish: () => void = () => {}
  // Asks the browser to stop, and moves on anyway if it never confirms.
  const end = () => {
    clearTimeout(timer)
    try {
      r.stop()
    } catch {
      // Already stopped.
    }
    timer = setTimeout(finish, STOP_GRACE_MS)
  }

  const result = new Promise<ListenResult>((resolve) => {
    let settled = false
    finish = () => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      // Whatever was heard before an error or a stop still counts.
      if (text) resolve({ kind: 'heard', text })
      else resolve({ kind: 'failed', reason: failure ?? 'no-speech' })
    }
    r.onaudiostart = () => {
      audioStarted = true
    }
    r.onresult = (e) => {
      text = Array.from(e.results, (alternatives) => alternatives[0]?.transcript ?? '')
        .join('')
        .trim()
      onInterim?.(text)
      clearTimeout(timer)
      timer = setTimeout(end, QUIET_AFTER_SPEECH_MS)
    }
    r.onerror = (e) => {
      failure = failureFor(e.error)
    }
    r.onend = finish
    try {
      r.start()
      timer = setTimeout(() => {
        failure ??= audioStarted ? 'no-speech' : 'no-audio'
        end()
      }, NOTHING_HEARD_MS)
    } catch {
      failure = 'unavailable'
      finish()
    }
  })
  return { result, stop: end }
}
