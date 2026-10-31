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

/** "45 min", "1 h 14 min", "2 h": hours once a duration reaches an hour. */
export function formatDuration(seconds: number, t: Translate): string {
  const total = minutes(seconds)
  if (total < 60) return t('duration.minutes', { m: total })
  const h = Math.floor(total / 60)
  const m = total % 60
  return m === 0 ? t('duration.hours', { h }) : t('duration.hoursMinutes', { h, m })
}

/** "14:05": a clock time in Santiago, whatever the device's own time zone. */
export function formatClock(iso: string, locale: 'es' | 'en'): string {
  return new Intl.DateTimeFormat(locale === 'es' ? 'es-CL' : 'en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    // es-CL defaults to "03:35 p. m."; a 24-hour clock is shorter and reads the same everywhere.
    hourCycle: 'h23',
    timeZone: 'America/Santiago',
  }).format(new Date(iso))
}
