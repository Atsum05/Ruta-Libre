import type { Waypoint } from '@rutalibre/contract'
import { type FormEvent, useEffect, useState } from 'react'
import { useI18n } from '../../shared/i18n/index.tsx'
import { LocateIcon, SwapIcon } from '../../shared/icons.tsx'
import { FreeTextSearch } from './FreeTextSearch.tsx'
import { PlaceField } from './PlaceField.tsx'
import type { Selection } from './selection.ts'
import { useLocation } from './useLocation.ts'

interface SearchFormProps {
  onSearch: (origin: Waypoint, destination: Waypoint) => void
  busy: boolean
  geolocation?: Geolocation
}

/**
 * Origin and destination as a trip card: two fields joined by a route rail, a swap button
 * beside them, and the device location as an explicit choice. Free text and voice come after.
 */
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
    <section className="search" aria-labelledby="search-title">
      <h2 id="search-title" className="section-title">
        {t('search.title')}
      </h2>
      <form className="trip" onSubmit={submit} noValidate>
        <div className="trip__fields">
          <span className="trip__rail" aria-hidden="true">
            <span className="trip__dot trip__dot--from" />
            <span className="trip__line" />
            <span className="trip__dot trip__dot--to" />
          </span>
          <div className="trip__inputs">
            <PlaceField
              label={t('search.origin')}
              placeholder={t('search.placeholder.origin')}
              value={origin}
              onChange={setOrigin}
            />
            <PlaceField
              label={t('search.destination')}
              placeholder={t('search.placeholder.destination')}
              value={destination}
              onChange={setDestination}
            />
          </div>
          <button
            type="button"
            className="icon-button trip__swap"
            onClick={() => {
              setOrigin(destination)
              setDestination(origin)
            }}
          >
            <SwapIcon />
            <span className="visually-hidden">{t('search.swap')}</span>
          </button>
        </div>

        <button
          type="button"
          className="chip"
          onClick={location.locate}
          disabled={location.state.kind === 'locating'}
        >
          <LocateIcon size={18} />
          {location.state.kind === 'locating' ? t('search.locating') : t('search.useLocation')}
        </button>
        {locationMessage && (
          <p className="form-message" role="alert">
            {locationMessage}
          </p>
        )}
        {incomplete && (
          <p className="form-message" role="alert">
            {t('search.needBoth')}
          </p>
        )}
        <button type="submit" className="button-primary" disabled={busy}>
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
    </section>
  )
}
