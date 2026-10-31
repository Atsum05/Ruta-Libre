import type { PlanRequest } from '@rutalibre/contract'
import { useMutation } from '@tanstack/react-query'
import { lazy, Suspense, useState } from 'react'
import type { WebConfig } from './config.ts'
import { DebugFooter } from './features/debug/DebugFooter.tsx'
import { PlanResult } from './features/itinerary/PlanResult.tsx'
import { Legend } from './features/map/Legend.tsx'
import { SearchForm } from './features/search/SearchForm.tsx'
import { TripSummary } from './features/search/TripSummary.tsx'
import { StatusBanner } from './features/status/StatusBanner.tsx'
import { useStatus } from './features/status/useStatus.ts'
import { api } from './shared/api.ts'
import { useI18n } from './shared/i18n/index.tsx'
import { AlertIcon } from './shared/icons.tsx'
import { SheetHandle } from './shared/SheetHandle.tsx'
import { SkyHeader } from './shared/SkyHeader.tsx'
import { useSky } from './shared/sky.ts'
import { Wordmark } from './shared/Wordmark.tsx'

const MapCanvas = lazy(() => import('./features/map/MapCanvas.tsx'))

/**
 * On a phone the sheet covers the map once you scroll down to a result. Scroll back up so the
 * route on the map and the result below it are seen together. Desktop shows both side by side.
 */
function showMapOnPhone() {
  if (typeof window.matchMedia !== 'function' || !window.matchMedia('(max-width: 959px)').matches)
    return
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })
}

/**
 * Mobile: the map stays put at the top while the panel slides up over it as you scroll, like a
 * bottom sheet; its handle lowers the panel to show the whole map. Desktop: a full-screen map
 * with the panel floating on the left.
 */
export function App({ config }: { config: WebConfig }) {
  const { t, locale, setLocale } = useI18n()
  const status = useStatus()
  const [trip, setTrip] = useState<{ from: string; to: string } | null>(null)
  const [editing, setEditing] = useState(true)
  // A new key gives the search form fresh, empty fields after "New search".
  const [formKey, setFormKey] = useState(0)
  // Which of the plan's routes is shown and drawn: the best one until the rider picks another.
  const [selected, setSelected] = useState(0)
  // Phone only: the panel lowered so the map fills the screen.
  const [mapOpen, setMapOpen] = useState(false)
  const { sky, greeting } = useSky()
  const plan = useMutation({
    mutationFn: (request: PlanRequest) => api.plan(request),
    onSuccess: () => {
      setSelected(0)
      setEditing(false)
      showMapOnPhone()
    },
  })

  return (
    <div className={mapOpen ? 'app app--map-open' : 'app'}>
      <div className="map-area">
        <Suspense fallback={<div className="map map--loading" />}>
          <MapCanvas
            apiKey={config.googleMapsKey}
            mapId={config.googleMapsMapId}
            status={status.data}
            route={plan.data?.routes[selected]}
          />
        </Suspense>
      </div>

      <main className="sheet">
        <SheetHandle
          mapOpen={mapOpen}
          onChange={(open) => {
            setMapOpen(open)
            showMapOnPhone()
          }}
        />
        <SkyHeader sky={sky}>
          <div className="sheet__header">
            <h1 className="sheet__title">
              <Wordmark />
            </h1>
            <button
              type="button"
              className="lang-toggle"
              lang={locale === 'es' ? 'en' : 'es'}
              onClick={() => setLocale(locale === 'es' ? 'en' : 'es')}
            >
              {t('lang.switch')}
            </button>
          </div>
          <p className="sheet__tagline">{t('app.tagline')}</p>
        </SkyHeader>

        <StatusBanner status={status.data} failed={status.isError} />
        {trip && !editing && (
          <TripSummary
            from={trip.from}
            to={trip.to}
            onEdit={() => setEditing(true)}
            onReset={() => {
              plan.reset()
              setTrip(null)
              setEditing(true)
              setFormKey((k) => k + 1)
            }}
          />
        )}
        {/* Hidden, not removed, while showing a result: "Change" reopens it with the same places. */}
        <div hidden={!editing}>
          <SearchForm
            key={formKey}
            busy={plan.isPending}
            greeting={t(`greeting.${greeting}`)}
            onSearch={(origin, destination) => {
              setTrip({ from: origin.label, to: destination.label })
              plan.mutate({ origin: origin.waypoint, destination: destination.waypoint })
            }}
          />
        </div>
        {plan.isError && (
          <p className="notice notice--alert" role="alert">
            <AlertIcon className="notice__icon" />
            {t('outcome.error')}
          </p>
        )}
        {plan.data && <PlanResult plan={plan.data} selected={selected} onSelect={setSelected} />}

        <footer className="sheet__footer">
          <Legend />
          <p>{t('map.attribution')}</p>
          <p>{t('footer.credits')}</p>
          <DebugFooter />
        </footer>
      </main>
    </div>
  )
}
