import { useMutation } from '@tanstack/react-query'
import { type FormEvent, useId, useRef, useState } from 'react'
import { api } from '../../shared/api.ts'
import { useI18n } from '../../shared/i18n/index.tsx'
import { ArrowIcon, MicIcon, StopIcon } from '../../shared/icons.tsx'
import { newSession, type Selection } from './selection.ts'
import { type Listening, listen, type SpeechFailure, speechSupported } from './speech.ts'

interface FreeTextSearchProps {
  /** Called with what was understood; origin is null when the person didn't say one. */
  onInterpreted: (origin: Selection | null, destination: Selection) => void
}

const asAddress = (text: string): Selection => ({
  waypoint: { kind: 'address', text },
  label: text,
})

/**
 * A name as understood ("Metro Irarrázaval") → the place the search fields would pick for it.
 * Sent as plain text, Google can geocode a name to the wrong place (that one lands in Puente
 * Alto); the place search is biased to Santiago. Plain text only if it finds nothing.
 */
async function resolvePlace(name: string): Promise<Selection> {
  try {
    const top = (await api.places(name, newSession())).suggestions[0]
    if (top) {
      const label = top.secondary ? `${top.primary}, ${top.secondary}` : top.primary
      return { waypoint: { kind: 'place', placeId: top.placeId }, label }
    }
  } catch {
    // The place search is down: the plain text still gives Google something to route.
  }
  return asAddress(name)
}

const FAILURE_MESSAGE = {
  'not-allowed': 'search.voice.notAllowed',
  'no-speech': 'search.voice.noSpeech',
  'no-microphone': 'search.voice.noMicrophone',
  'no-audio': 'search.voice.noAudio',
  unavailable: 'search.voice.unavailable',
} as const satisfies Record<SpeechFailure, string>

/**
 * The extra path: say or type the trip in your own words (roadmap phase 7). Every outcome is
 * visible: the words appear as they're heard, and any failure says what to do next. If
 * interpreting fails, we point back to the search fields, which always work.
 */
export function FreeTextSearch({ onInterpreted }: FreeTextSearchProps) {
  const { t, locale } = useI18n()
  const id = useId()
  const [text, setText] = useState('')
  const [voiceError, setVoiceError] = useState<SpeechFailure | null>(null)
  const listening = useRef<Listening | null>(null)
  const [isListening, setIsListening] = useState(false)
  const interpret = useMutation({
    mutationFn: async (input: string) => {
      const r = await api.interpret(input)
      const [origin, destination] = await Promise.all([
        r.origin ? resolvePlace(r.origin) : null,
        resolvePlace(r.destination),
      ])
      return { origin, destination }
    },
    onSuccess: ({ origin, destination }) => onInterpreted(origin, destination),
  })

  function submit(e: FormEvent) {
    e.preventDefault()
    if (text.trim().length >= 3) interpret.mutate(text.trim())
  }

  async function toggleDictation() {
    if (listening.current) {
      listening.current.stop()
      return
    }
    setVoiceError(null)
    interpret.reset()
    setIsListening(true)
    const session = listen(locale === 'es' ? 'es-CL' : 'en-US', setText)
    listening.current = session
    const result = await session.result
    listening.current = null
    setIsListening(false)
    if (result.kind === 'failed') {
      setVoiceError(result.reason)
    } else if (result.text.length >= 3) {
      setText(result.text)
      interpret.mutate(result.text)
    }
  }

  const message = voiceError
    ? t(FAILURE_MESSAGE[voiceError])
    : interpret.isError
      ? t('search.freeText.failed')
      : null

  return (
    <form className="free-text" onSubmit={submit}>
      <label htmlFor={id} className="free-text__label">
        {t('search.freeText.label')}
      </label>
      <div className={`free-text__box${isListening ? ' is-listening' : ''}`}>
        <input
          id={id}
          type="text"
          value={text}
          placeholder={isListening ? t('search.voice.listening') : t('search.freeText.placeholder')}
          onChange={(e) => setText(e.target.value)}
        />
        {speechSupported() && (
          <button
            type="button"
            className="icon-button icon-button--voice"
            aria-pressed={isListening}
            onClick={toggleDictation}
          >
            {isListening ? <StopIcon /> : <MicIcon />}
            <span className="visually-hidden">
              {isListening ? t('search.voice.stop') : t('search.voice.start')}
            </span>
          </button>
        )}
        <button
          type="submit"
          className="icon-button icon-button--send"
          disabled={interpret.isPending || isListening || text.trim().length < 3}
        >
          <ArrowIcon />
          <span className="visually-hidden">{t('search.freeText.submit')}</span>
        </button>
      </div>
      <p className="free-text__status" aria-live="polite">
        {isListening && t('search.voice.listening')}
        {interpret.isPending && t('search.freeText.interpreting')}
      </p>
      {message && (
        <p className="form-message" role="alert">
          {message}
        </p>
      )}
    </form>
  )
}
