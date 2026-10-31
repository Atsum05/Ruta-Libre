// Checks the committed stations.json against the real sources and against core's rules: the
// registry is what turns a Google stop into elevators, so it gets real-data tests.

import { readFileSync } from 'node:fs'
import {
  DeviceId,
  type DeviceState,
  evaluateRoute,
  matchStop,
  normalizeName,
  type Route,
  resolveTerminal,
  type StatusSnapshot,
  type TransitLeg,
} from '@rutalibre/core'
import { describe, expect, it } from 'vitest'
import { buildRegistry } from './build.ts'
import { LINES } from './config.ts'
import { loadRegistry } from './index.ts'
import { CatalogueSchema, LiveDevicesSchema } from './schema.ts'

const registry = loadRegistry()
const readSource = (name: string): unknown =>
  JSON.parse(readFileSync(new URL(`../sources/${name}`, import.meta.url), 'utf8'))

describe('stations.json', () => {
  it('is up to date with sources/ (regenerate with build:registry, never edit by hand)', () => {
    const { file } = buildRegistry(
      CatalogueSchema.parse(readSource('metro_dispositivos.geojson')),
      LiveDevicesSchema.parse(readSource('seguimos-devices.json')),
    )
    const committed: unknown = JSON.parse(
      readFileSync(new URL('../stations.json', import.meta.url), 'utf8'),
    )
    expect(committed).toEqual(file)
  })

  it('covers every configured line with two terminals', () => {
    expect(registry.lines.map((l) => l.id)).toEqual(LINES.map((l) => l.id))
    for (const line of registry.lines) expect(line.terminals).toHaveLength(2)
  })

  it('matches each station to itself by its own position and line', () => {
    for (const station of registry.stations) {
      const line = station.lines[0]
      const stop = { name: station.name, location: station.location }
      expect(matchStop(stop, registry, line ? { line } : {})?.id).toBe(station.id)
    }
  })

  it('matches platforms far from the complex point, as Google places them (2026-10-31)', () => {
    // Irarrázaval Line 5, 182 m from the single Irarrázaval point; it used to go unmatched.
    const ir = { name: 'Irarrázaval', location: { lat: -33.45347, lng: -70.6288 } }
    expect(matchStop(ir, registry, { line: 'L5' })?.id).toBe('IR')
    expect(matchStop(ir, registry, { line: 'L3' })?.id).toBe('IRA')
  })

  it('has no line with two stations of the same name, which named matching relies on', () => {
    for (const line of registry.lines) {
      const names = registry.stations
        .filter((s) => s.lines.includes(line.id))
        .map((s) => normalizeName(s.name))
      expect(new Set(names).size, line.id).toBe(names.length)
    }
  })

  it('resolves every terminal name on its own line', () => {
    for (const line of LINES) {
      for (const name of line.terminals) {
        expect(resolveTerminal(name, registry, line.id), `${line.id} ${name}`).not.toBeNull()
      }
    }
  })

  it('points every platform device at a real terminal', () => {
    const terminals = new Set(registry.lines.flatMap((l) => l.terminals))
    for (const s of registry.stations) {
      for (const d of s.devices) {
        if (d.scope.kind === 'platform')
          for (const t of d.scope.towards) expect(terminals).toContain(t)
      }
    }
  })
})

describe('core rules on the real registry', () => {
  const at = (code: string) => {
    const s = registry.stations.find((x) => x.id === code)
    if (!s) throw new Error(`no station ${code}`)
    return { name: s.name, location: s.location }
  }
  const leg = (from: string, to: string, line: string, headsign: string): TransitLeg => ({
    mode: 'metro',
    line,
    headsign,
    from: at(from),
    to: at(to),
    durationSeconds: 300,
  })
  const NOW = Date.UTC(2026, 9, 28, 12)
  const allWorking = () =>
    new Map<DeviceId, DeviceState>(
      registry.stations.flatMap((s) => s.devices.map((d) => [d.id, 'working'] as const)),
    )
  const snapshotWith = (devices: Map<DeviceId, DeviceState>): StatusSnapshot => ({
    observedAt: NOW,
    devices,
  })

  // Universidad de Chile (CH, L1) → Los Héroes (LH, L1) → Toesca on L2 towards Hospital El Pino.
  const transfer: Route = {
    durationSeconds: 1200,
    legs: [leg('CH', 'LH', 'L1', 'San Pablo'), leg('HE', 'TO', 'L2', 'Hospital El Pino')],
  }

  it('is ok when everything works', () => {
    expect(evaluateRoute(transfer, snapshotWith(allWorking()), registry, NOW).kind).toBe('ok')
  })

  it("blocks on the L2 platform elevator of the second leg's direction", () => {
    const devices = allWorking()
    devices.set(DeviceId('HE-0f6a35'), 'out-of-service') // towards San Pablo (L1) and Hospital El Pino (L2)
    expect(evaluateRoute(transfer, snapshotWith(devices), registry, NOW).kind).toBe('blocked')
  })

  it('only warns about the L2 platform towards Vespucio Norte', () => {
    const devices = allWorking()
    devices.set(DeviceId('HE-ad0600'), 'out-of-service') // towards Los Dominicos (L1) and Vespucio Norte (L2)
    expect(evaluateRoute(transfer, snapshotWith(devices), registry, NOW).kind).toBe('warning')
  })

  it('applies a broken street-access elevator of the complex to L2 trips too', () => {
    const devices = allWorking()
    devices.set(DeviceId('LH-349493'), 'out-of-service') // Los Héroes access, catalogued under L1
    const startOnL2: Route = {
      durationSeconds: 300,
      legs: [leg('HE', 'TO', 'L2', 'Hospital El Pino')],
    }
    expect(evaluateRoute(startOnL2, snapshotWith(devices), registry, NOW).kind).toBe('blocked')
  })
})
