import { loadRegistry } from '@rutalibre/registry'
import { describe, expect, it } from 'vitest'
import { STATUS_OK } from '../../test/render.tsx'
import { stationMarkers } from './stationStatus.ts'

const registry = loadRegistry()
const losHeroesL1 = registry.stations.find((s) => s.id === 'LH')
if (!losHeroesL1) throw new Error('LH missing from the registry')

/** Every device working, then the given overrides. */
function status(overrides: Record<string, 'working' | 'out-of-service' | undefined>) {
  const devices: Record<string, 'working' | 'out-of-service'> = {}
  for (const s of registry.stations) for (const d of s.devices) devices[d.id] = 'working'
  for (const [id, state] of Object.entries(overrides)) {
    if (state) devices[id] = state
    else delete devices[id]
  }
  return { ...STATUS_OK, devices }
}
const markerFor = (s: ReturnType<typeof status> | undefined) =>
  stationMarkers(registry, s).find((m) => m.id === 'LH')?.status

describe('stationMarkers', () => {
  it('draws one marker per station', () => {
    expect(stationMarkers(registry, status({}))).toHaveLength(registry.stations.length)
  })

  it('is ok when every device works', () => {
    expect(markerFor(status({}))).toBe('ok')
  })

  it('is blocked when any elevator is out', () => {
    expect(markerFor(status({ 'LH-60d634': 'out-of-service' }))).toBe('blocked')
  })

  it('only warns when just an escalator is out', () => {
    const escalator = losHeroesL1?.devices.find((d) => d.kind === 'escalator')
    expect(escalator).toBeDefined()
    expect(markerFor(status({ [escalator?.id ?? '']: 'out-of-service' }))).toBe('warning')
  })

  it('is unknown when an elevator has no status', () => {
    expect(markerFor(status({ 'LH-60d634': undefined }))).toBe('unknown')
  })

  it('is unknown everywhere without data, never green', () => {
    const markers = stationMarkers(registry, undefined)
    expect(new Set(markers.map((m) => m.status))).toEqual(new Set(['unknown']))
    expect(markerFor({ ...status({}), health: 'unavailable' })).toBe('unknown')
  })
})
