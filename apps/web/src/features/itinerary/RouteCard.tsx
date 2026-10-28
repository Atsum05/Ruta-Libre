import type { RouteView } from '@rutalibre/contract'
import { minutes } from '../../shared/format.ts'
import { useI18n } from '../../shared/i18n/index.tsx'
import { orderFindings } from './findings.ts'
import { Steps } from './Steps.tsx'
import { VerdictBadge } from './VerdictBadge.tsx'

const ICON = { blocked: '✕', unknown: '?', warning: '!' } as const

interface RouteCardProps {
  route: RouteView
  headingId: string
}

/** One route: verdict, why, duration at the rider's pace, then the steps. */
export function RouteCard({ route, headingId }: RouteCardProps) {
  const { t } = useI18n()
  const findings = orderFindings(route.verdict.findings, t)

  return (
    <article className="route-card" aria-labelledby={headingId}>
      <header className="route-card__header">
        <h3 id={headingId} className="route-card__duration">
          {t('route.duration', { minutes: minutes(route.durationSeconds) })}
          {route.source === 'bus-only' && <span className="tag">{t('route.source.bus-only')}</span>}
        </h3>
        <VerdictBadge kind={route.verdict.kind} />
      </header>
      {findings.length > 0 && (
        <ul className="findings">
          {findings.map((f) => (
            <li key={f.text} className={`finding finding--${f.effect}`}>
              <span aria-hidden="true">{ICON[f.effect]} </span>
              {f.text}
            </li>
          ))}
        </ul>
      )}
      <Steps legs={route.legs} />
    </article>
  )
}
