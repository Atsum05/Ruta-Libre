import type { StatusResponse } from '@rutalibre/contract'
import { formatAge } from '../../shared/format.ts'
import { useI18n } from '../../shared/i18n/index.tsx'

interface StatusBannerProps {
  status: StatusResponse | undefined
  /** The status request itself failed (API unreachable). */
  failed: boolean
}

/**
 * How fresh the elevator data is, always visible. Anything but "ok" is a warning banner: without
 * fresh data, no route can be confirmed (ADR 0005, 0012).
 */
export function StatusBanner({ status, failed }: StatusBannerProps) {
  const { t } = useI18n()

  if (failed || status?.health === 'unavailable') {
    return (
      <p className="status-banner status-banner--alert" role="alert">
        <span aria-hidden="true">⚠ </span>
        {t('status.unavailable')}
      </p>
    )
  }
  if (!status) {
    return <p className="status-banner">{t('status.loading')}</p>
  }

  const age = formatAge(status.ageSeconds ?? 0, t)
  if (status.health === 'ok') {
    return (
      <p className="status-banner" aria-live="polite">
        {t('status.ok', { age: t('status.ago', { age }) })}
      </p>
    )
  }
  return (
    <p className="status-banner status-banner--alert" role="alert">
      <span aria-hidden="true">⚠ </span>
      {status.health === 'stale'
        ? t('status.stale', { age })
        : t('status.degraded', { age: t('status.ago', { age }) })}
    </p>
  )
}
