import type { PlanResponse } from '@rutalibre/contract'
import { useId } from 'react'
import { useI18n } from '../../shared/i18n/index.tsx'
import { AlertIcon, CheckIcon, ChevronIcon } from '../../shared/icons.tsx'
import { RouteCard } from './RouteCard.tsx'

type Tone = 'good' | 'alert'

function outcomeMessage(plan: PlanResponse): {
  key: Parameters<ReturnType<typeof useI18n>['t']>[0]
  tone: Tone
} {
  switch (plan.outcome) {
    case 'accessible':
      return { key: plan.rerouted ? 'outcome.rerouted' : 'outcome.accessible', tone: 'good' }
    case 'uncertain':
      return { key: 'outcome.uncertain', tone: 'alert' }
    case 'no-accessible-route':
      return { key: 'outcome.noAccessible', tone: 'alert' }
    case 'no-route':
      return { key: 'outcome.noRoute', tone: 'alert' }
  }
}

/** The answer: what happened, the best route, then the others (collapsed). */
export function PlanResult({ plan }: { plan: PlanResponse }) {
  const { t } = useI18n()
  const baseId = useId()
  const { key, tone } = outcomeMessage(plan)
  const [best, ...others] = plan.routes

  return (
    <section className="plan-result" aria-labelledby={`${baseId}-outcome`}>
      <p
        id={`${baseId}-outcome`}
        className={`notice notice--${tone}`}
        role={tone === 'alert' ? 'alert' : 'status'}
      >
        {tone === 'alert' ? (
          <AlertIcon className="notice__icon" />
        ) : (
          <CheckIcon className="notice__icon" />
        )}
        {t(key)}
      </p>
      {best && <RouteCard route={best} headingId={`${baseId}-best`} />}
      {others.length > 0 && (
        <details className="other-routes">
          <summary>
            <ChevronIcon size={18} className="other-routes__chevron" />
            {t('route.otherOptions')} ({others.length})
          </summary>
          {others.map((route, i) => (
            <RouteCard
              // biome-ignore lint/suspicious/noArrayIndexKey: ranked order is the identity here
              key={i}
              route={route}
              headingId={`${baseId}-other-${i}`}
            />
          ))}
        </details>
      )}
    </section>
  )
}
