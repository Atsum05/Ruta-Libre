import type { MarkerStatus } from './stationStatus.ts'

/** Station marker colours. Kept apart from the map so the legend doesn't load Google Maps. */
export const MARKER_COLOR: Record<MarkerStatus, string> = {
  ok: '#1a8f5a',
  warning: '#c27c00',
  blocked: '#d12f2f',
  unknown: '#6b7280',
}
