import { useMutation } from '@tanstack/react-query'
import { type FormEvent, useId, useState } from 'react'
import { api } from '../../shared/api.ts'
import { useI18n } from '../../shared/i18n/index.tsx'
import type { Selection } from './selection.ts'
import { listenOnce, speechSupported } from './speech.ts'

interface FreeTextSearchProps {
  /** Called with what was understood; origin is null when the person didn't say one. */
  onInterpreted: (origin: Selection | null, destination: Selection) => void
}

const asAddress = (text: string): Selection => ({
  waypoint: { kind: 'address', text },
  label: text,
})

/**
 * The extra path: say or type the trip in your own words (roadmap phase 7). If interpreting
 * fails for any reason, we point back to the search fields, which always work.
 */
export function FreeTextSearch({ onInterpreted }: FreeTextSearchProps) {
  const { t, locale } = useI18n()
  const id = useId()
  const [text, setText] = useState('')
  const [listening, setListening] = useState(false)
  const interpret = useMutation({
    mutationFn: (input: string) => api.interpret(input),
    onSuccess: (r) =>
      onInterpreted(r.origin ? asAddress(r.origin) : null, asAddress(r.destination)),
  })

  function submit(e: FormEvent) {
    e.preventDefault()
    if (text.trim().length >= 3) interpret.mutate(text.trim())
  }

  async function dictate() {
    setListening(true)
    const heard = await listenOnce(locale === 'es' ? 'es-CL' : 'en-US')
    setListening(false)
    if (heard) {
      setText(heard)
      interpret.mutate(heard)
    }
  }

  return (
    <form className="free-text" onSubmit={submit}>
      <label htmlFor={id}>{t('search.freeText.label')}</label>
      <div className="free-text__row">
        <input
          id={id}
          type="text"
          value={text}
          placeholder={t('search.freeText.placeholder')}
          onChange={(e) => setText(e.target.value)}
        />
        {speechSupported() && (
          <button
            type="button"
            className="button button--icon"
            onClick={dictate}
            disabled={listening}
          >
            <span aria-hidden="true">🎤</span>
            <span className="visually-hidden">
              {listening ? t('search.voice.listening') : t('search.voice.start')}
            </span>
          </button>
        )}
        <button
          type="submit"
          className="button"
          disabled={interpret.isPending || text.trim().length < 3}
        >
          {t('search.freeText.submit')}
        </button>
      </div>
      {interpret.isError && (
        <p className="form-message" role="alert">
          {t('search.freeText.failed')}
        </p>
      )}
    </form>
  )
}
