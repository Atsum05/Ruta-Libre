import { useQuery } from '@tanstack/react-query'
import { type KeyboardEvent, type ReactNode, useEffect, useId, useState } from 'react'
import { api } from '../../shared/api.ts'
import { useI18n } from '../../shared/i18n/index.tsx'
import { newSession, type Selection } from './selection.ts'

const DEBOUNCE_MS = 250

interface PlaceFieldProps {
  label: string
  placeholder: string
  value: Selection | null
  onChange: (value: Selection | null) => void
  /** Extra controls under the field (e.g. "use my location"). */
  children?: ReactNode
}

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(id)
  }, [value, ms])
  return debounced
}

/** A place search field: the ARIA 1.2 combobox pattern with a listbox of suggestions. */
export function PlaceField({ label, placeholder, value, onChange, children }: PlaceFieldProps) {
  const { t } = useI18n()
  const id = useId()
  const listId = `${id}-list`
  const [text, setText] = useState(value?.label ?? '')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [session, setSession] = useState(newSession)

  // A selection made elsewhere (location, swap, voice) shows up in the field.
  useEffect(() => setText(value?.label ?? ''), [value])

  const query = useDebounced(text.trim(), DEBOUNCE_MS)
  const typing = open && value === null && query.length >= 2
  const places = useQuery({
    queryKey: ['places', query, session],
    queryFn: ({ signal }) => api.places(query, session, signal),
    enabled: typing,
    staleTime: 60_000,
  })
  const suggestions = typing ? (places.data?.suggestions ?? []) : []

  function choose(index: number) {
    const s = suggestions[index]
    if (!s) return
    const label = s.secondary ? `${s.primary}, ${s.secondary}` : s.primary
    onChange({ waypoint: { kind: 'place', placeId: s.placeId }, label })
    setOpen(false)
    setActive(-1)
    setSession(newSession())
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setActive((i) => Math.min(i + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && open && active >= 0) {
      e.preventDefault()
      choose(active)
    } else if (e.key === 'Escape') {
      setOpen(false)
      setActive(-1)
    }
  }

  const expanded = typing && suggestions.length > 0
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="text"
        role="combobox"
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={expanded}
        aria-controls={listId}
        aria-activedescendant={active >= 0 ? `${id}-opt-${active}` : undefined}
        placeholder={placeholder}
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          setOpen(true)
          setActive(-1)
          if (value) onChange(null)
        }}
        onKeyDown={onKeyDown}
        onBlur={() => setOpen(false)}
      />
      <div
        id={listId}
        role="listbox"
        aria-label={t('search.suggestions', { field: label })}
        className="suggestions"
        hidden={!expanded}
      >
        {suggestions.map((s, i) => (
          <div
            key={s.placeId}
            id={`${id}-opt-${i}`}
            role="option"
            // Focus stays in the input (aria-activedescendant); -1 keeps options out of Tab order.
            tabIndex={-1}
            aria-selected={i === active}
            aria-label={s.secondary ? `${s.primary}, ${s.secondary}` : s.primary}
            className="suggestion"
            // mousedown, not click: it fires before the input's blur closes the list.
            onMouseDown={(e) => {
              e.preventDefault()
              choose(i)
            }}
          >
            <span className="suggestion__primary">{s.primary}</span>
            {s.secondary && <span className="suggestion__secondary">{s.secondary}</span>}
          </div>
        ))}
      </div>
      <p className="field__hint" role="status">
        {typing && places.isError && t('search.suggestionsUnavailable')}
        {typing &&
          !places.isError &&
          places.isFetched &&
          suggestions.length === 0 &&
          t('search.noSuggestions')}
      </p>
      {children}
    </div>
  )
}
