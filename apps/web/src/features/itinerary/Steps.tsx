import type { LegView } from '@rutalibre/contract'
import type { CSSProperties } from 'react'
import { minutes } from '../../shared/format.ts'
import { useI18n } from '../../shared/i18n/index.tsx'
import { BusIcon, ChevronIcon, MetroIcon, RailIcon, WalkIcon } from '../../shared/icons.tsx'

type TransitLeg = Exclude<LegView, { mode: 'walk' }>

const MODE_ICON = { metro: MetroIcon, bus: BusIcon, rail: RailIcon }

/** The line as riders see it: "L1" in the line's colours, or the bus route number. */
export function LineBadge({ leg }: { leg: TransitLeg }) {
  return (
    <span
      className={`line-badge line-badge--${leg.mode}`}
      style={{ background: leg.color, color: leg.textColor }}
    >
      {leg.mode === 'metro' ? leg.line : leg.label}
    </span>
  )
}

/** A one-line summary of the trip for sighted users; the timeline below says the same in full. */
export function RouteStrip({ legs }: { legs: readonly LegView[] }) {
  return (
    <div className="strip" aria-hidden="true">
      {legs.map((leg, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: legs have no ID; order is their identity
        <span key={i} className="strip__item">
          {i > 0 && <ChevronIcon size={14} className="strip__sep" />}
          {leg.mode === 'walk' ? (
            <span className="strip__walk">
              <WalkIcon size={16} />
              {minutes(leg.durationSeconds)}
            </span>
          ) : (
            <LineBadge leg={leg} />
          )}
        </span>
      ))}
    </div>
  )
}

/**
 * The trip as a Metro-style diagram: each transit leg is a bar in its line colour from the
 * station where you board to the one where you get off; walking is a dotted line. Findings
 * point at steps by index, so the order matters.
 */
export function Steps({ legs }: { legs: readonly LegView[] }) {
  return (
    <ol className="timeline">
      {legs.map((leg, i) =>
        leg.mode === 'walk' ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: stable for a given route
          <WalkStep key={i} leg={leg} />
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: stable for a given route
          <TransitStep key={i} leg={leg} />
        ),
      )}
    </ol>
  )
}

function WalkStep({ leg }: { leg: Extract<LegView, { mode: 'walk' }> }) {
  const { t } = useI18n()
  return (
    <li className="tl tl--walk">
      <span className="tl__rail" aria-hidden="true" />
      <span className="tl__body">
        <span className="tl__walk">
          <WalkIcon size={18} />
          {t('leg.walk', { minutes: minutes(leg.durationSeconds) })}
        </span>
      </span>
    </li>
  )
}

function TransitStep({ leg }: { leg: TransitLeg }) {
  const { t } = useI18n()
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
  const Icon = MODE_ICON[leg.mode]

  return (
    <li className="tl tl--transit" style={{ '--leg-color': leg.color } as CSSProperties}>
      <span className="tl__rail" aria-hidden="true" />
      <span className="tl__body">
        <span className="tl__stop">{leg.from.name}</span>
        <span className="tl__ride">
          <Icon size={18} className="tl__mode" />
          <LineBadge leg={leg} />
          <span className="tl__title">{title}</span>
          {leg.expressRoute && (
            <span className={`express express--${leg.expressRoute}`}>
              {t('leg.express', { color: t(`leg.express.${leg.expressRoute}`) })}
            </span>
          )}
        </span>
        {leg.stopCount !== null && (
          <span className="tl__detail">{t('leg.stops', { count: leg.stopCount })}</span>
        )}
        <span className="tl__stop">{leg.to.name}</span>
      </span>
    </li>
  )
}
