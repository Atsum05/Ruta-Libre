import { useI18n } from '../../shared/i18n/index.tsx'
import { AlertIcon, BlockedIcon, CheckIcon, QuestionIcon } from '../../shared/icons.tsx'

type Kind = 'ok' | 'warning' | 'blocked' | 'unknown'

// Shape and text carry the meaning; colour only reinforces it (WCAG 1.4.1).
const ICON = { ok: CheckIcon, warning: AlertIcon, blocked: BlockedIcon, unknown: QuestionIcon }

/** The verdict as colour + icon + text. `unknown` is as prominent as `blocked` (ADR 0005). */
export function VerdictBadge({ kind }: { kind: Kind }) {
  const { t } = useI18n()
  const Icon = ICON[kind]
  return (
    <span className={`verdict verdict--${kind}`}>
      <Icon size={18} className="verdict__icon" />
      {t(`verdict.${kind}`)}
    </span>
  )
}
