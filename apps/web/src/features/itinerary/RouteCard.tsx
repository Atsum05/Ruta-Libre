import type { RouteView } from '@rutalibre/contract'
import { minutes } from '../../shared/format.ts'
import { useI18n } from '../../shared/i18n/index.tsx'
import { AlertIcon, BlockedIcon, QuestionIcon } from '../../shared/icons.tsx'
import { orderFindings } from './findings.ts'
import { RouteStrip, Steps } from './Steps.tsx'
import { VerdictBadge } from './VerdictBadge.tsx'

const FINDING_ICON = { blocked: BlockedIcon, unknown: QuestionIcon, warning: AlertIcon }

interface RouteCardProps {
  route: RouteView
  headingId: string
}

/** One route: time at the rider's pace and the verdict first, then why, then the steps. */
export function RouteCard({ route, headingId }: RouteCardProps) {
  const { t } = useI18n()
  const findings = orderFindings(route.verdict.findings, t)

  return (
    <article className={`route route--${route.verdict.kind}`} aria-labelledby={headingId}>
      <header className="route__header">
        <h3 id={headingId} className="route__time">
          <span className="route__minutes">
            {t('route.minutes', { minutes: minutes(route.durationSeconds) })}
          </span>{' '}
          <span className="route__pace">{t('route.pace')}</span>
        </h3>
        <VerdictBadge kind={route.verdict.kind} />
      </header>
      {route.source === 'bus-only' && <span className="tag">{t('route.source.bus-only')}</span>}
      <RouteStrip legs={route.legs} />
      {findings.length > 0 && (
        <ul className="findings">
          {findings.map((f) => {
            const Icon = FINDING_ICON[f.effect]
            return (
              <li key={f.text} className={`finding finding--${f.effect}`}>
                <Icon size={18} className="finding__icon" />
                <span>{f.text}</span>
              </li>
            )
          })}
        </ul>
      )}
      <Steps legs={route.legs} />
    </article>
  )
}
