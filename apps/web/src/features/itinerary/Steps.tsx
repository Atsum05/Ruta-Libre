import type { LegView } from '@rutalibre/contract'
import { minutes } from '../../shared/format.ts'
import { useI18n } from '../../shared/i18n/index.tsx'

const ICON = { walk: '🚶', metro: '🚇', bus: '🚌', rail: '🚆' } as const

/** The trip as an ordered list of steps; findings point at steps by index. */
export function Steps({ legs }: { legs: readonly LegView[] }) {
  return (
    <ol className="steps">
      {legs.map((leg, i) => (
        // Legs have no ID; their order is their identity within one route.
        // biome-ignore lint/suspicious/noArrayIndexKey: stable for a given route
        <li key={i} className={`step step--${leg.mode}`}>
          <span className="step__icon" aria-hidden="true">
            {ICON[leg.mode]}
          </span>
          <StepText leg={leg} />
        </li>
      ))}
    </ol>
  )
}

function StepText({ leg }: { leg: LegView }) {
  const { t } = useI18n()
  if (leg.mode === 'walk') {
    return <span>{t('leg.walk', { minutes: minutes(leg.durationSeconds) })}</span>
  }

  const line = leg.label
  const title =
    leg.mode === 'bus'
      ? leg.headsign
        ? t('leg.bus', { line, headsign: leg.headsign })
        : t('leg.busNoDirection', { line })
      : leg.mode === 'metro'
        ? leg.headsign
          ? t('leg.metro', { line, headsign: leg.headsign })
          : t('leg.metroNoDirection', { line })
        : t('leg.rail', { line })

  return (
    <span className="step__body">
      <span className="step__title">
        <span className="line-badge" style={{ background: leg.color, color: leg.textColor }}>
          {leg.mode === 'metro' ? leg.line : leg.label}
        </span>{' '}
        {title}
        {leg.expressRoute && (
          <span className={`express express--${leg.expressRoute}`}>
            {t('leg.express', { color: t(`leg.express.${leg.expressRoute}`) })}
          </span>
        )}
      </span>
      <span className="step__detail">
        {t('leg.fromTo', { from: leg.from.name, to: leg.to.name })}
        {leg.stopCount !== null && <> · {t('leg.stops', { count: leg.stopCount })}</>}
      </span>
    </span>
  )
}
