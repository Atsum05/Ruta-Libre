import type { StatusResponse } from '@rutalibre/contract'
import type { Device, Registry, Station } from '@rutalibre/core'
import { formatAge } from '../../shared/format.ts'
import { type Translate, useI18n } from '../../shared/i18n/index.tsx'
import { ElevatorIcon } from '../../shared/icons.tsx'
import { isCurrent } from './stationStatus.ts'

type DeviceState = 'working' | 'out-of-service' | 'unknown'

const STATE_ORDER: Record<DeviceState, number> = { 'out-of-service': 0, unknown: 1, working: 2 }
const STATE_LABEL = {
  working: 'device.working',
  'out-of-service': 'device.out',
  unknown: 'device.unknown',
} as const

/** Where a device takes you, in rider terms: the platform's direction, or the station access. */
function whereLabel(device: Device, registry: Registry, t: Translate): string {
  if (device.scope.kind === 'station') return t('device.access')
  if (device.scope.kind === 'unknown') return t('device.platformUnknown')
  const names = device.scope.towards.map(
    (id) => registry.stations.find((s) => s.id === id)?.name ?? id,
  )
  return t('device.platform', { terminals: names.join(t('station.and')) })
}

function summary(rows: readonly { device: Device; state: DeviceState }[], t: Translate): string {
  const out = (kind: Device['kind']) =>
    rows.filter((r) => r.device.kind === kind && r.state === 'out-of-service').length
  const elevators = out('elevator')
  const escalators = out('escalator')
  const parts = [
    elevators === 1
      ? t('station.elevatorOut')
      : elevators > 1
        ? t('station.elevatorsOut', { n: elevators })
        : null,
    escalators === 1
      ? t('station.escalatorOut')
      : escalators > 1
        ? t('station.escalatorsOut', { n: escalators })
        : null,
  ].filter((p): p is string => p !== null)
  if (parts.length > 0) return parts.join(' · ')
  if (rows.some((r) => r.state === 'unknown')) return t('station.someUnknown')
  return t('station.allWorking')
}

interface StationDetailsProps {
  station: Station
  registry: Registry
  status: StatusResponse | undefined
}

/**
 * What's wrong at a station: shown when its dot on the map is tapped. Every elevator and
 * escalator, the platform it serves, and its state, broken ones first.
 */
export function StationDetails({ station, registry, status }: StationDetailsProps) {
  const { t } = useI18n()
  // Old data is still worth showing (it's the last known state), but never as if current.
  const usable = status !== undefined && status.health !== 'unavailable'
  const stale = usable && !isCurrent(status)
  const rows = station.devices
    .map((device) => ({
      device,
      state: (usable ? (status.devices[device.id] ?? 'unknown') : 'unknown') as DeviceState,
    }))
    .sort(
      (a, b) =>
        STATE_ORDER[a.state] - STATE_ORDER[b.state] ||
        (a.device.kind === b.device.kind ? 0 : a.device.kind === 'elevator' ? -1 : 1),
    )
  const lines = station.lines
    .map((id) => t('station.line', { n: id.replace(/^L/, '') }))
    .join(' · ')

  return (
    <div className="station-card">
      <p className="station-card__lines">{lines}</p>
      <p className="station-card__summary">{usable ? summary(rows, t) : t('station.noData')}</p>
      {stale && (
        <p className="station-card__stale">
          {t('station.stale', { age: formatAge(status.ageSeconds ?? 0, t) })}
        </p>
      )}
      <ul className="station-card__devices">
        {rows.map(({ device, state }) => (
          <li key={device.id} className={`device device--${state}`}>
            <span className="device__icon" aria-hidden="true">
              {device.kind === 'elevator' ? <ElevatorIcon size={18} /> : <EscalatorGlyph />}
            </span>
            <span className="device__text">
              <span className="device__kind">
                {device.kind === 'elevator' ? t('device.elevator') : t('device.escalator')}
              </span>
              <span className="device__where">{whereLabel(device, registry, t)}</span>
              {device.description && (
                <span className="device__description">{device.description}</span>
              )}
            </span>
            <span className="device__state">{t(STATE_LABEL[state])}</span>
          </li>
        ))}
      </ul>
      {usable && status.ageSeconds !== null && (
        <p className="station-card__age">
          {status.demo
            ? t('station.demoAge')
            : t('station.updated', {
                age: t('status.ago', { age: formatAge(status.ageSeconds, t) }),
              })}
        </p>
      )}
    </div>
  )
}

/** A small escalator drawing: steps on a slope. */
function EscalatorGlyph() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 19h4l10-12h4" />
      <path d="M7 19v-3h3v-3h3v-3h3V7" />
    </svg>
  )
}
