import type { PlanResponse } from '@rutalibre/contract'
import { useId, useRef } from 'react'
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

interface PlanResultProps {
  plan: PlanResponse
  /** Index into `plan.routes` of the route shown in full and drawn on the map. */
  selected: number
  onSelect: (index: number) => void
}

/**
 * The answer: what happened, the chosen route (the best one until the rider picks another), then
 * the others, collapsed, each of which can be chosen instead.
 */
export function PlanResult({ plan, selected, onSelect }: PlanResultProps) {
  const { t } = useI18n()
  const baseId = useId()
  const others = useRef<HTMLDetailsElement>(null)
  const { key, tone } = outcomeMessage(plan)
  const shown = plan.routes[selected]
  const rest = plan.routes.flatMap((route, index) => (index === selected ? [] : [{ route, index }]))

  function choose(index: number) {
    onSelect(index)
    if (others.current) others.current.open = false
    // Move to the chosen route, now the main card, so screen readers and phones follow.
    requestAnimationFrame(() => document.getElementById(`${baseId}-shown`)?.focus())
  }

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
      {selected !== 0 && (
        <p className="chosen-note">
          {t('route.chosenOther')}
          <button type="button" className="chip" onClick={() => choose(0)}>
            {t('route.backToBest')}
          </button>
        </p>
      )}
      {shown && <RouteCard route={shown} headingId={`${baseId}-shown`} demo={plan.status.demo} />}
      {rest.length > 0 && (
        <details className="other-routes" ref={others}>
          <summary>
            <ChevronIcon size={18} className="other-routes__chevron" />
            {t('route.otherOptions')} ({rest.length})
          </summary>
          {rest.map(({ route, index }) => (
            <RouteCard
              // Ranked order is the identity here: the list only changes with a new plan.
              key={index}
              route={route}
              headingId={`${baseId}-other-${index}`}
              demo={plan.status.demo}
              recommended={index === 0}
              action={
                <button type="button" className="chip route__choose" onClick={() => choose(index)}>
                  {t('route.choose')}
                </button>
              }
            />
          ))}
        </details>
      )}
    </section>
  )
}
