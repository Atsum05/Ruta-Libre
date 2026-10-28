import { useI18n } from '../../shared/i18n/index.tsx'
import { MARKER_COLOR } from './colors.ts'

const ITEMS = ['ok', 'warning', 'blocked', 'unknown'] as const

/** What the station colours mean, as text: the map itself isn't readable by screen readers. */
export function Legend() {
  const { t } = useI18n()
  return (
    <ul className="legend">
      {ITEMS.map((kind) => (
        <li key={kind}>
          <span
            className="legend__dot"
            style={{ background: MARKER_COLOR[kind] }}
            aria-hidden="true"
          />
          {t(`map.legend.${kind}`)}
        </li>
      ))}
    </ul>
  )
}
