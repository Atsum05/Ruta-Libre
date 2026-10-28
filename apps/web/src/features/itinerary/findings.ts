import type { Finding } from '@rutalibre/contract'
import { formatAge } from '../../shared/format.ts'
import type { Translate } from '../../shared/i18n/index.tsx'

/** One finding as a sentence a rider understands. */
export function describeFinding(f: Finding, t: Translate): string {
  const station = f.stationName ?? t('reason.unknownStation')
  const r = f.reason
  switch (r.code) {
    case 'status-unavailable':
      return t('reason.status-unavailable')
    case 'status-stale':
      return t('reason.status-stale', { age: formatAge(r.ageMs / 1000, t) })
    case 'stop-unmatched':
      return t('reason.stop-unmatched', { stop: r.stopName })
    case 'mode-not-covered':
      return t('reason.mode-not-covered', { line: r.line })
    case 'no-known-elevator':
      return t('reason.no-known-elevator', { station })
    case 'elevator-out':
      return t(`reason.elevator-out.${r.platform}`, { station })
    case 'elevator-status-missing':
      return t('reason.elevator-status-missing', { station })
    case 'escalator-out':
      return t('reason.escalator-out', { station })
  }
}

const SEVERITY = { blocked: 0, unknown: 1, warning: 2 } as const

/**
 * Findings worst first, with exact repeats removed: a station-wide device is checked at both
 * the alighting and the boarding end of a transfer, which would otherwise read twice.
 */
export function orderFindings(
  findings: readonly Finding[],
  t: Translate,
): { effect: Finding['effect']; text: string }[] {
  const seen = new Set<string>()
  return [...findings]
    .sort((a, b) => SEVERITY[a.effect] - SEVERITY[b.effect])
    .map((f) => ({ effect: f.effect, text: describeFinding(f, t) }))
    .filter(({ text }) => !seen.has(text) && Boolean(seen.add(text)))
}
