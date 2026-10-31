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

const MapCanvas = lazy(() => import('./features/map/MapCanvas.tsx'))

export function App({ config }: { config: WebConfig }) {
  const { t, locale, setLocale } = useI18n()
  const status = useStatus()
  const plan = useMutation({ mutationFn: (request: PlanRequest) => api.plan(request) })

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-header__title">{t('app.title')}</h1>
        <p className="app-header__tagline">{t('app.tagline')}</p>
        <button
          type="button"
          className="button button--link app-header__lang"
          lang={locale === 'es' ? 'en' : 'es'}
          onClick={() => setLocale(locale === 'es' ? 'en' : 'es')}
        >
          {t('lang.switch')}
        </button>
      </header>

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

      <main className="panel">
        <StatusBanner status={status.data} failed={status.isError} />
        <SearchForm
          busy={plan.isPending}
          onSearch={(origin, destination) => plan.mutate({ origin, destination })}
        />
        {plan.isError && (
          <p className="outcome outcome--alert" role="alert">
            {t('outcome.error')}
          </p>
        )}
        {plan.data && <PlanResult plan={plan.data} />}
        <Legend />
        <footer className="panel__footer">
          <p>{t('map.attribution')}</p>
          <p>{t('footer.credits')}</p>
          <DebugFooter />
        </footer>
      </main>
    </div>
  )
}
