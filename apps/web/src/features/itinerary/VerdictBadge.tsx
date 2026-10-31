import { useI18n } from '../../shared/i18n/index.tsx'

type Kind = 'ok' | 'warning' | 'blocked' | 'unknown'

// Shape and text carry the meaning; colour only reinforces it (WCAG 1.4.1).
const ICON: Record<Kind, string> = { ok: '✓', warning: '!', blocked: '✕', unknown: '?' }

/** The verdict as colour + icon + text. `unknown` is as prominent as `blocked` (ADR 0005). */
export function VerdictBadge({ kind }: { kind: Kind }) {
  const { t } = useI18n()
  return (
    <span className={`verdict verdict--${kind}`}>
      <span className="verdict__icon" aria-hidden="true">
        {ICON[kind]}
      </span>
      {t(`verdict.${kind}`)}
    </span>
  )
}
