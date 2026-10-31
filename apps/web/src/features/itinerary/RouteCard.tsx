import type { RouteView } from '@rutalibre/contract'
import type { ReactNode } from 'react'
import { formatClock, formatDuration } from '../../shared/format.ts'
import { useI18n } from '../../shared/i18n/index.tsx'
import { AlertIcon, BlockedIcon, QuestionIcon } from '../../shared/icons.tsx'
import { orderFindings } from './findings.ts'
import { RouteStrip, Steps } from './Steps.tsx'
import { VerdictBadge } from './VerdictBadge.tsx'

const FINDING_ICON = { blocked: BlockedIcon, unknown: QuestionIcon, warning: AlertIcon }

interface RouteCardProps {
  route: RouteView
  headingId: string
  /** The verdict comes from demo data (ADR 0014): label it next to the verdict. */
  demo?: boolean
  /** Marks the route ranked first, when it's listed among the other options. */
  recommended?: boolean
  /** Shown above the steps, e.g. a button to pick this route. */
  action?: ReactNode
}

/** One route: time at the rider's pace and the verdict first, then why, then the steps. */
export function RouteCard({
  route,
  headingId,
  demo = false,
  recommended = false,
  action,
}: RouteCardProps) {
  const { t, locale } = useI18n()
  const findings = orderFindings(route.verdict.findings, t)
  const duration = formatDuration(route.durationSeconds, t)
  const depart = route.departAt && formatClock(route.departAt, locale)
  const arrive = route.arriveAt && formatClock(route.arriveAt, locale)
  const timed = depart !== undefined && arrive !== undefined
  const pace = t('route.durationAtPace', { duration })

  return (
    <article className={`route route--${route.verdict.kind}`} aria-labelledby={headingId}>
      <header className="route__header">
        <h3
          id={headingId}
          className="route__time"
          tabIndex={-1}
          // The visible "15:35 – 16:49" read as a sentence: the dash alone says nothing.
          aria-label={
            timed
              ? `${t('route.leave')} ${depart}, ${t('route.arrive')} ${arrive}. ${pace}`
              : undefined
          }
        >
          {timed ? (
            <>
              <span className="route__minutes">
                {depart} – {arrive}
              </span>{' '}
              <span className="route__pace">{pace}</span>
            </>
          ) : (
            <>
              <span className="route__minutes">{duration}</span>{' '}
              <span className="route__pace">{t('route.pace')}</span>
            </>
          )}
        </h3>
        <span className="route__verdict">
          {recommended && <span className="tag">{t('route.recommended')}</span>}
          {demo && <span className="tag tag--demo">{t('route.demo')}</span>}
          <VerdictBadge kind={route.verdict.kind} />
        </span>
      </header>
      {timed && <p className="route__note">{t('route.timesNote')}</p>}
      {route.source === 'bus-only' && <span className="tag">{t('route.source.bus-only')}</span>}
      <RouteStrip legs={route.legs} />
      {findings.length > 0 && (
        <ul className="findings">
          {findings.map((f) => {
            const Icon = FINDING_ICON[f.effect]
            return (
              <li key={f.key} className={`finding finding--${f.effect}`}>
                <Icon size={18} className="finding__icon" />
                <span className="finding__body">
                  <span>{f.text}</span>
                  {f.details.map((d) => (
                    <span key={d} className="finding__detail">
                      {d}
                    </span>
                  ))}
                </span>
              </li>
            )
          })}
        </ul>
      )}
      {action}
      <Steps legs={route.legs} />
    </article>
  )
}
