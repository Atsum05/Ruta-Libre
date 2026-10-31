import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderApp, stubApi } from '../../test/render.tsx'
import { FreeTextSearch } from './FreeTextSearch.tsx'
import {
  listen,
  NOTHING_HEARD_MS,
  QUIET_AFTER_SPEECH_MS,
  STOP_GRACE_MS,
  speechSupported,
} from './speech.ts'

type Script =
  | { heard: string[]; error?: undefined }
  | { heard?: string[]; error: string }
  | { manual: true }

interface FakeRecognition {
  lang: string
  interimResults: boolean
  stopped: boolean
  /** Feeds a recognition update (for scripts driven by the test). */
  emit(text: string): void
  end(): void
}

/**
 * A stand-in for the browser's SpeechRecognition. It "hears" a scripted sequence of interim
 * results, or fails with a browser error code, or waits for the test to drive it.
 */
function fakeRecognition(script: Script, created: FakeRecognition[] = []) {
  return class implements FakeRecognition {
    lang = ''
    interimResults = false
    stopped = false
    onresult: ((e: { results: { transcript: string }[][] }) => void) | null = null
    onerror: ((e: { error: string }) => void) | null = null
    onend: (() => void) | null = null
    constructor() {
      created.push(this)
    }
    emit(text: string) {
      this.onresult?.({ results: [[{ transcript: text }]] })
    }
    end() {
      this.onend?.()
    }
    start() {
      if ('manual' in script) return
      queueMicrotask(() => {
        for (const text of script.heard ?? []) this.emit(text)
        if (script.error) this.onerror?.({ error: script.error })
        this.end()
      })
    }
    stop() {
      this.stopped = true
      queueMicrotask(() => this.end())
    }
  }
}

/**
 * A browser that says it's listening and then goes quiet: no words, no error, no end, even when
 * asked to stop. What Safari does with dictation off. `audio` makes it report the microphone
 * starting first; `emit` still feeds words when a test needs them.
 */
function silentRecognition(
  audio: boolean,
  created: { emit(text: string): void; stopped: boolean }[],
) {
  return class {
    lang = ''
    interimResults = false
    stopped = false
    onresult: ((e: { results: { transcript: string }[][] }) => void) | null = null
    onerror: ((e: { error: string }) => void) | null = null
    onend: (() => void) | null = null
    onaudiostart: (() => void) | null = null
    constructor() {
      created.push(this)
    }
    emit(text: string) {
      this.onresult?.({ results: [[{ transcript: text }]] })
    }
    start() {
      if (audio) this.onaudiostart?.()
    }
    stop() {
      this.stopped = true
    }
    abort() {}
  }
}

describe('listen when the browser goes quiet (Safari)', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('gives up when the microphone never starts, and says so', async () => {
    const created: { emit(text: string): void; stopped: boolean }[] = []
    vi.stubGlobal('SpeechRecognition', silentRecognition(false, created))
    const session = listen('es-CL')
    await vi.advanceTimersByTimeAsync(NOTHING_HEARD_MS + STOP_GRACE_MS)
    await expect(session.result).resolves.toEqual({ kind: 'failed', reason: 'no-audio' })
    expect(created[0]?.stopped).toBe(true)
  })

  it('reports no speech when the microphone worked but nothing was said', async () => {
    vi.stubGlobal('SpeechRecognition', silentRecognition(true, []))
    const session = listen('es-CL')
    await vi.advanceTimersByTimeAsync(NOTHING_HEARD_MS + STOP_GRACE_MS)
    await expect(session.result).resolves.toEqual({ kind: 'failed', reason: 'no-speech' })
  })

  it('finishes by itself after a pause in speech, even if the browser never ends', async () => {
    const created: { emit(text: string): void; stopped: boolean }[] = []
    vi.stubGlobal('SpeechRecognition', silentRecognition(true, created))
    const session = listen('es-CL')
    await vi.advanceTimersByTimeAsync(NOTHING_HEARD_MS - 1000)
    created[0]?.emit('a Irarrázaval')
    // Speaking resets the clock: the "nothing heard" limit no longer applies.
    await vi.advanceTimersByTimeAsync(QUIET_AFTER_SPEECH_MS - 100)
    expect(created[0]?.stopped).toBe(false)
    await vi.advanceTimersByTimeAsync(100 + STOP_GRACE_MS)
    await expect(session.result).resolves.toEqual({ kind: 'heard', text: 'a Irarrázaval' })
    expect(created[0]?.stopped).toBe(true)
  })

  it('ends when tapped, even if the browser never confirms', async () => {
    const created: { emit(text: string): void; stopped: boolean }[] = []
    vi.stubGlobal('SpeechRecognition', silentRecognition(true, created))
    const session = listen('es-CL')
    created[0]?.emit('al hospital')
    session.stop()
    await vi.advanceTimersByTimeAsync(STOP_GRACE_MS)
    await expect(session.result).resolves.toEqual({ kind: 'heard', text: 'al hospital' })
  })
})

describe('listen', () => {
  it('is unsupported where the browser has no recognition (Firefox, jsdom)', async () => {
    expect(speechSupported()).toBe(false)
    await expect(listen('es-CL').result).resolves.toEqual({ kind: 'failed', reason: 'unavailable' })
  })

  it('reports each partial result, then resolves with the final text', async () => {
    const created: FakeRecognition[] = []
    vi.stubGlobal(
      'SpeechRecognition',
      fakeRecognition({ heard: ['de Toesca', 'de Toesca a Baquedano'] }, created),
    )
    const interim: string[] = []
    const session = listen('es-CL', (t) => interim.push(t))
    await expect(session.result).resolves.toEqual({ kind: 'heard', text: 'de Toesca a Baquedano' })
    expect(interim).toEqual(['de Toesca', 'de Toesca a Baquedano'])
    expect(created[0]).toMatchObject({ lang: 'es-CL', interimResults: true })
  })

  it("uses Chrome's prefixed version", async () => {
    vi.stubGlobal('webkitSpeechRecognition', fakeRecognition({ heard: ['a Toesca'] }))
    await expect(listen('es-CL').result).resolves.toEqual({ kind: 'heard', text: 'a Toesca' })
  })

  it.each([
    ['not-allowed', 'not-allowed'],
    ['service-not-allowed', 'not-allowed'],
    ['no-speech', 'no-speech'],
    ['aborted', 'no-speech'],
    ['audio-capture', 'no-microphone'],
    ['network', 'unavailable'],
    ['language-not-supported', 'unavailable'],
  ])('turns the browser error %j into %j', async (error, reason) => {
    vi.stubGlobal('SpeechRecognition', fakeRecognition({ error }))
    await expect(listen('es-CL').result).resolves.toEqual({ kind: 'failed', reason })
  })

  it('keeps what was heard before an error', async () => {
    vi.stubGlobal('SpeechRecognition', fakeRecognition({ heard: ['a Toesca'], error: 'network' }))
    await expect(listen('es-CL').result).resolves.toEqual({ kind: 'heard', text: 'a Toesca' })
  })

  it('treats silence as no speech', async () => {
    vi.stubGlobal('SpeechRecognition', fakeRecognition({ heard: [] }))
    await expect(listen('es-CL').result).resolves.toEqual({ kind: 'failed', reason: 'no-speech' })
  })

  it('stops on request and keeps the text so far', async () => {
    const created: FakeRecognition[] = []
    vi.stubGlobal('SpeechRecognition', fakeRecognition({ manual: true }, created))
    const session = listen('es-CL')
    created[0]?.emit('al hospital')
    session.stop()
    await expect(session.result).resolves.toEqual({ kind: 'heard', text: 'al hospital' })
    expect(created[0]?.stopped).toBe(true)
  })

  it('reports a browser that refuses to start', async () => {
    vi.stubGlobal(
      'SpeechRecognition',
      class {
        start() {
          throw new DOMException('already started', 'InvalidStateError')
        }
      },
    )
    await expect(listen('es-CL').result).resolves.toEqual({ kind: 'failed', reason: 'unavailable' })
  })
})

describe('FreeTextSearch voice input', () => {
  const mic = () => screen.getByRole('button', { name: 'Dictar por voz' })

  it('shows the words as they are heard, then interprets them', async () => {
    vi.stubGlobal(
      'SpeechRecognition',
      fakeRecognition({ heard: ['de Toesca', 'de Toesca a Baquedano'] }),
    )
    const calls = stubApi({
      '/api/v1/interpret': { origin: 'Metro Toesca', destination: 'Metro Baquedano' },
    })
    const onInterpreted = vi.fn()
    const user = userEvent.setup()
    renderApp(<FreeTextSearch onInterpreted={onInterpreted} />)

    await user.click(mic())
    await waitFor(() => expect(onInterpreted).toHaveBeenCalled())
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({ text: 'de Toesca a Baquedano' })
    expect(screen.getByLabelText('O describe tu viaje')).toHaveProperty(
      'value',
      'de Toesca a Baquedano',
    )
  })

  it('shows that it is listening, and stops when tapped again', async () => {
    const created: FakeRecognition[] = []
    vi.stubGlobal('SpeechRecognition', fakeRecognition({ manual: true }, created))
    stubApi({ '/api/v1/interpret': { origin: null, destination: 'Metro Toesca' } })
    const user = userEvent.setup()
    renderApp(<FreeTextSearch onInterpreted={vi.fn()} />)

    await user.click(mic())
    const stop = screen.getByRole('button', { name: 'Terminar el dictado' })
    expect(stop.getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByText('Escuchando…')).toBeTruthy()
    created[0]?.emit('a Toesca')
    await user.click(stop)
    await waitFor(() => expect(created[0]?.stopped).toBe(true))
    await waitFor(() => expect(mic().getAttribute('aria-pressed')).toBe('false'))
  })

  it.each([
    ['not-allowed', 'Para dictar, permite el uso del micrófono'],
    ['no-speech', 'No te escuchamos.'],
    ['audio-capture', 'No encontramos un micrófono'],
    ['network', 'El dictado no funciona en este navegador'],
  ])('explains a %j failure instead of doing nothing', async (error, message) => {
    vi.stubGlobal('SpeechRecognition', fakeRecognition({ error }))
    const calls = stubApi({})
    const user = userEvent.setup()
    renderApp(<FreeTextSearch onInterpreted={vi.fn()} />)
    await user.click(mic())
    expect((await screen.findByRole('alert')).textContent).toContain(message)
    expect(calls).toEqual([])
  })

  it('looks the understood places up in the Santiago place search', async () => {
    vi.stubGlobal('SpeechRecognition', fakeRecognition({ heard: ['de Toesca a Irarrázaval'] }))
    stubApi({
      '/api/v1/interpret': { origin: 'Metro Toesca', destination: 'Metro Irarrázaval' },
      '/api/v1/places': {
        suggestions: [
          {
            placeId: 'p-ir',
            primary: 'Metro Irarrázaval',
            secondary: 'Avenida General Bustamante, Ñuñoa',
          },
        ],
      },
    })
    const onInterpreted = vi.fn()
    const user = userEvent.setup()
    renderApp(<FreeTextSearch onInterpreted={onInterpreted} />)
    await user.click(mic())
    await waitFor(() => expect(onInterpreted).toHaveBeenCalled())
    // A place ID, not the bare words, which Google once routed to Puente Alto.
    expect(onInterpreted.mock.calls[0]?.[1]).toEqual({
      waypoint: { kind: 'place', placeId: 'p-ir' },
      label: 'Metro Irarrázaval, Avenida General Bustamante, Ñuñoa',
    })
  })

  it('falls back to the words when the place search finds nothing', async () => {
    vi.stubGlobal('SpeechRecognition', fakeRecognition({ heard: ['a Toesca'] }))
    stubApi({
      '/api/v1/interpret': { origin: null, destination: 'Metro Toesca' },
      '/api/v1/places': { suggestions: [] },
    })
    const onInterpreted = vi.fn()
    const user = userEvent.setup()
    renderApp(<FreeTextSearch onInterpreted={onInterpreted} />)
    await user.click(mic())
    await waitFor(() => expect(onInterpreted).toHaveBeenCalled())
    expect(onInterpreted.mock.calls[0]).toEqual([
      null,
      { waypoint: { kind: 'address', text: 'Metro Toesca' }, label: 'Metro Toesca' },
    ])
  })

  it('tells Safari users to turn on dictation when the microphone never starts', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      vi.stubGlobal('SpeechRecognition', silentRecognition(false, []))
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      renderApp(<FreeTextSearch onInterpreted={vi.fn()} />)
      await user.click(mic())
      await vi.advanceTimersByTimeAsync(NOTHING_HEARD_MS + STOP_GRACE_MS)
      expect((await screen.findByRole('alert')).textContent).toContain('activa el Dictado')
    } finally {
      vi.useRealTimers()
    }
  })

  it('dictates in English when the app is in English', async () => {
    const created: FakeRecognition[] = []
    vi.stubGlobal('SpeechRecognition', fakeRecognition({ heard: [] }, created))
    const user = userEvent.setup()
    renderApp(<FreeTextSearch onInterpreted={vi.fn()} />, 'en')
    await user.click(screen.getByRole('button', { name: 'Dictate' }))
    await waitFor(() => expect(created[0]?.lang).toBe('en-US'))
  })

  it('hides the microphone where the browser has no dictation', () => {
    renderApp(<FreeTextSearch onInterpreted={vi.fn()} />)
    expect(screen.queryByRole('button', { name: 'Dictar por voz' })).toBeNull()
  })
})
