import type { Waypoint } from '@rutalibre/contract'
import { type FormEvent, useEffect, useState } from 'react'
import { useI18n } from '../../shared/i18n/index.tsx'
import { FreeTextSearch } from './FreeTextSearch.tsx'
import { PlaceField } from './PlaceField.tsx'
import type { Selection } from './selection.ts'
import { useLocation } from './useLocation.ts'

interface SearchFormProps {
  onSearch: (origin: Waypoint, destination: Waypoint) => void
  busy: boolean
  geolocation?: Geolocation
}

/** Origin and destination: autocomplete fields as the main path, free text as an extra. */
export function SearchForm({ onSearch, busy, geolocation }: SearchFormProps) {
  const { t } = useI18n()
  const [origin, setOrigin] = useState<Selection | null>(null)
  const [destination, setDestination] = useState<Selection | null>(null)
  const [incomplete, setIncomplete] = useState(false)
  const location = useLocation(geolocation)

  useEffect(() => {
    if (location.state.kind === 'found') {
      const { lat, lng } = location.state
      setOrigin({ waypoint: { kind: 'point', lat, lng }, label: t('search.myLocation') })
    }
  }, [location.state, t])

  function submit(e?: FormEvent, from = origin, to = destination) {
    e?.preventDefault()
    if (!from || !to) {
      setIncomplete(true)
      return
    }
    setIncomplete(false)
    onSearch(from.waypoint, to.waypoint)
  }

  const locationMessage =
    location.state.kind === 'denied'
      ? t('search.locationDenied')
      : location.state.kind === 'failed'
        ? t('search.locationFailed')
        : null

  return (
    <div className="search">
      <form className="search__form" onSubmit={submit} noValidate>
        <PlaceField
          label={t('search.origin')}
          placeholder={t('search.placeholder.origin')}
          value={origin}
          onChange={setOrigin}
        >
          <button
            type="button"
            className="button button--link"
            onClick={location.locate}
            disabled={location.state.kind === 'locating'}
          >
            <span aria-hidden="true">📍 </span>
            {location.state.kind === 'locating' ? t('search.locating') : t('search.useLocation')}
          </button>
          {locationMessage && (
            <p className="form-message" role="alert">
              {locationMessage}
            </p>
          )}
        </PlaceField>
        <button
          type="button"
          className="button button--icon search__swap"
          onClick={() => {
            setOrigin(destination)
            setDestination(origin)
          }}
        >
          <span aria-hidden="true">⇅</span>
          <span className="visually-hidden">{t('search.swap')}</span>
        </button>
        <PlaceField
          label={t('search.destination')}
          placeholder={t('search.placeholder.destination')}
          value={destination}
          onChange={setDestination}
        />
        {incomplete && (
          <p className="form-message" role="alert">
            {t('search.needBoth')}
          </p>
        )}
        <button type="submit" className="button button--primary" disabled={busy}>
          {busy ? t('search.searching') : t('search.submit')}
        </button>
      </form>
      <FreeTextSearch
        onInterpreted={(from, to) => {
          const start = from ?? origin
          if (from) setOrigin(from)
          setDestination(to)
          submit(undefined, start, to)
        }}
      />
    </div>
  )
}
