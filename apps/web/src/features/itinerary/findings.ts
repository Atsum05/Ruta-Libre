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
    case 'elevator-out-backup':
      return t('reason.elevator-out-backup', { station })
  }
}

/**
 * The devices behind a finding, in the source's own words: which one is out, and for a backup,
 * which one to use instead. Lets the rider check it against the signs in the station.
 */
export function findingDetails(f: Finding, t: Translate): string[] {
  const details: string[] = []
  if (f.reason.code === 'elevator-out-backup') {
    if (f.deviceDescription)
      details.push(t('finding.outOfService', { description: f.deviceDescription }))
    if (f.backupDescription)
      details.push(t('finding.useInstead', { description: f.backupDescription }))
  } else if (f.deviceDescription) {
    details.push(f.deviceDescription)
  }
  return details
}

const SEVERITY = { blocked: 0, unknown: 1, warning: 2 } as const

/**
 * Findings worst first, with exact repeats removed: a station-wide device is checked at both
 * the alighting and the boarding end of a transfer, which would otherwise read twice.
 */
export function orderFindings(
  findings: readonly Finding[],
  t: Translate,
): { effect: Finding['effect']; text: string; details: string[]; key: string }[] {
  const seen = new Set<string>()
  return [...findings]
    .sort((a, b) => SEVERITY[a.effect] - SEVERITY[b.effect])
    .map((f) => {
      const text = describeFinding(f, t)
      const details = findingDetails(f, t)
      return { effect: f.effect, text, details, key: [text, ...details].join('|') }
    })
    .filter(({ key }) => !seen.has(key) && Boolean(seen.add(key)))
}
