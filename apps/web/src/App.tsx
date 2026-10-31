import type { PlanRequest } from '@rutalibre/contract'
import { useMutation } from '@tanstack/react-query'
import { lazy, Suspense } from 'react'
import type { WebConfig } from './config.ts'
import { DebugFooter } from './features/debug/DebugFooter.tsx'
import { PlanResult } from './features/itinerary/PlanResult.tsx'
import { Legend } from './features/map/Legend.tsx'
import { SearchForm } from './features/search/SearchForm.tsx'
import { StatusBanner } from './features/status/StatusBanner.tsx'
import { useStatus } from './features/status/useStatus.ts'
import { api } from './shared/api.ts'
import { useI18n } from './shared/i18n/index.tsx'
import { AlertIcon } from './shared/icons.tsx'
import { Wordmark } from './shared/Wordmark.tsx'

const MapCanvas = lazy(() => import('./features/map/MapCanvas.tsx'))

/**
 * Mobile: the map stays put at the top while the panel slides up over it as you scroll, like a
 * bottom sheet (pure CSS, no gesture code). Desktop: a full-screen map with the panel floating
 * on the left.
 */
export function App({ config }: { config: WebConfig }) {
  const { t, locale, setLocale } = useI18n()
  const status = useStatus()
  const plan = useMutation({ mutationFn: (request: PlanRequest) => api.plan(request) })

  return (
    <div className="app">
      <div className="map-area">
        <Suspense fallback={<div className="map map--loading" />}>
          <MapCanvas
            apiKey={config.googleMapsKey}
            mapId={config.googleMapsMapId}
            status={status.data}
            route={plan.data?.routes[0]}
          />
        </Suspense>
      </div>

      <main className="sheet">
        <span className="sheet__handle" aria-hidden="true" />
        <header className="sheet__header">
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
        </header>
        <p className="sheet__tagline">{t('app.tagline')}</p>

        <StatusBanner status={status.data} failed={status.isError} />
        <SearchForm
          busy={plan.isPending}
          onSearch={(origin, destination) => plan.mutate({ origin, destination })}
        />
        {plan.isError && (
          <p className="notice notice--alert" role="alert">
            <AlertIcon className="notice__icon" />
            {t('outcome.error')}
          </p>
        )}
        {plan.data && <PlanResult plan={plan.data} />}

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
