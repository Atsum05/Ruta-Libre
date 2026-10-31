import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { renderApp, stubApi } from '../../test/render.tsx'
import { FreeTextSearch } from './FreeTextSearch.tsx'
import { listenOnce, speechSupported } from './speech.ts'

/** A stand-in for the browser's SpeechRecognition that "hears" a fixed phrase, or fails. */
function fakeRecognition(heard: string | null, created: { lang: string }[] = []) {
  return class {
    lang = ''
    interimResults = true
    onresult: ((e: { results: { transcript: string }[][] }) => void) | null = null
    onerror: (() => void) | null = null
    onend: (() => void) | null = null
    constructor() {
      created.push(this)
    }
    start() {
      queueMicrotask(() => {
        if (heard === null) this.onerror?.()
        else this.onresult?.({ results: [[{ transcript: heard }]] })
        this.onend?.()
      })
    }
  }
}

describe('speech', () => {
  it('is unsupported where the browser has no recognition (Firefox, jsdom)', async () => {
    expect(speechSupported()).toBe(false)
    await expect(listenOnce('es-CL')).resolves.toBeNull()
  })

  it('hears a phrase in the requested language', async () => {
    const created: { lang: string }[] = []
    vi.stubGlobal('SpeechRecognition', fakeRecognition('de Toesca a Baquedano', created))
    expect(speechSupported()).toBe(true)
    await expect(listenOnce('es-CL')).resolves.toBe('de Toesca a Baquedano')
    expect(created[0]?.lang).toBe('es-CL')
  })

  it("uses Chrome's prefixed version", async () => {
    vi.stubGlobal('webkitSpeechRecognition', fakeRecognition('a Toesca'))
    await expect(listenOnce('es-CL')).resolves.toBe('a Toesca')
  })

  it('resolves to nothing when recognition fails', async () => {
    vi.stubGlobal('SpeechRecognition', fakeRecognition(null))
    await expect(listenOnce('es-CL')).resolves.toBeNull()
  })
})

describe('FreeTextSearch voice input', () => {
  it('dictates a trip and interprets it', async () => {
    vi.stubGlobal('SpeechRecognition', fakeRecognition('de Toesca a Baquedano'))
    const calls = stubApi({
      '/api/v1/interpret': { origin: 'Metro Toesca', destination: 'Metro Baquedano' },
    })
    const onInterpreted = vi.fn()
    const user = userEvent.setup()
    renderApp(<FreeTextSearch onInterpreted={onInterpreted} />)

    await user.click(screen.getByRole('button', { name: 'Dictar por voz' }))
    await waitFor(() => expect(onInterpreted).toHaveBeenCalled())
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({ text: 'de Toesca a Baquedano' })
    expect(screen.getByLabelText('O describe tu viaje')).toHaveProperty(
      'value',
      'de Toesca a Baquedano',
    )
  })

  it('does nothing when nothing was heard', async () => {
    vi.stubGlobal('SpeechRecognition', fakeRecognition(null))
    const calls = stubApi({})
    const user = userEvent.setup()
    renderApp(<FreeTextSearch onInterpreted={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Dictar por voz' }))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Dictar por voz' })).toHaveProperty(
        'disabled',
        false,
      ),
    )
    expect(calls).toEqual([])
  })

  it('dictates in English when the app is in English', async () => {
    const created: { lang: string }[] = []
    vi.stubGlobal('SpeechRecognition', fakeRecognition(null, created))
    const user = userEvent.setup()
    renderApp(<FreeTextSearch onInterpreted={vi.fn()} />, 'en')
    await user.click(screen.getByRole('button', { name: 'Dictate' }))
    await waitFor(() => expect(created[0]?.lang).toBe('en-US'))
  })
})
