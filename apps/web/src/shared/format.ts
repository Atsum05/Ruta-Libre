import type { Translate } from './i18n/index.tsx'

/** "40 s", "12 min", "3 h", "11 días": the largest unit that fits, rounded down. */
export function formatAge(seconds: number, t: Translate): string {
  const s = Math.max(0, Math.floor(seconds))
  if (s < 60) return t('age.seconds', { n: s })
  if (s < 3600) return t('age.minutes', { n: Math.floor(s / 60) })
  if (s < 86_400) return t('age.hours', { n: Math.floor(s / 3600) })
  return t('age.days', { n: Math.floor(s / 86_400) })
}

/** Whole minutes, never 0 for a step that takes any time. */
export const minutes = (seconds: number) => Math.max(1, Math.round(seconds / 60))
